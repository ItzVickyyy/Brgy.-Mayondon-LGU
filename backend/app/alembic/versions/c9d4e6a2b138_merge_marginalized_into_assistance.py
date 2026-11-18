"""Merge Marginalized Sector into Assistance Certification (patch 141).

Revision ID: c9d4e6a2b138
Revises: b7e3a1c5d902

The clerks treat the two certificates as one document. ``ASSISTANCE`` stays;
``MARGINALIZED_SECTOR`` is retired.

* ``issuance_assistance.assistance_type`` becomes nullable (NULL only on rows
  carried over from the old document) and gains ``health_condition``.
* Every ``issuance_marginalized_sector`` row is copied into
  ``issuance_assistance`` (type NULL, for the resident, the same condition).
* Old Marginalized issuances are pointed at ``ASSISTANCE``; reference numbers,
  resident snapshots, sector rows and the audit log are not touched.
* The old table and the document type row are removed.

The downgrade recreates both and moves back only the carried-over rows.
"""

import sqlalchemy as sa
from alembic import op

revision = "c9d4e6a2b138"
down_revision = "b7e3a1c5d902"
branch_labels = None
depends_on = None

OLD_CODE = "MARGINALIZED_SECTOR"
NEW_CODE = "ASSISTANCE"


def _type_id(bind: sa.Connection, code: str) -> int | None:
    return bind.execute(
        sa.text("SELECT id FROM document_types WHERE code = :c"), {"c": code}
    ).scalar()


def _columns(bind: sa.Connection) -> set[str]:
    return {
        c["name"] for c in sa.inspect(bind).get_columns("issuance_assistance")
    }


def upgrade() -> None:
    bind = op.get_bind()
    if "health_condition" not in _columns(bind):
        op.add_column(
            "issuance_assistance",
            sa.Column("health_condition", sa.String(length=500), nullable=True),
        )
    op.alter_column(
        "issuance_assistance",
        "assistance_type",
        existing_type=sa.String(length=20),
        nullable=True,
    )
    old_id = _type_id(bind, OLD_CODE)
    new_id = _type_id(bind, NEW_CODE)
    if old_id is not None and new_id is None:
        raise RuntimeError(
            f"{OLD_CODE} exists but {NEW_CODE} does not; cannot merge them."
        )
    if sa.inspect(bind).has_table("issuance_marginalized_sector"):
        if old_id is not None:
            bind.execute(
                sa.text(
                    "INSERT INTO issuance_assistance "
                    "(issuance_id, assistance_type, health_condition, for_self) "
                    "SELECT m.issuance_id, NULL, m.health_condition, true "
                    "FROM issuance_marginalized_sector m "
                    "WHERE NOT EXISTS (SELECT 1 FROM issuance_assistance a "
                    "WHERE a.issuance_id = m.issuance_id)"
                )
            )
        op.drop_table("issuance_marginalized_sector")
    if old_id is not None:
        bind.execute(
            sa.text("UPDATE issuances SET document_type_id = :n WHERE document_type_id = :o"),
            {"n": new_id, "o": old_id},
        )
        bind.execute(sa.text("DELETE FROM document_types WHERE id = :o"), {"o": old_id})


def downgrade() -> None:
    bind = op.get_bind()
    op.create_table(
        "issuance_marginalized_sector",
        sa.Column("issuance_id", sa.Uuid(), nullable=False),
        sa.Column("health_condition", sa.String(length=500), nullable=False),
        sa.ForeignKeyConstraint(["issuance_id"], ["issuances.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("issuance_id"),
    )
    new_id = _type_id(bind, NEW_CODE)
    if new_id is not None:
        bind.execute(
            sa.text(
                "INSERT INTO document_types (code, name, category, print_mode, "
                "validity_months, one_per_resident, signatory_default_position) "
                "VALUES (:code, 'Marginalized Sector (Pagpapatunay)', "
                "'certification', 'full_page', NULL, false, 'Barangay Kagawad')"
            ),
            {"code": OLD_CODE},
        )
        old_id = _type_id(bind, OLD_CODE)
        carried = (
            "SELECT issuance_id FROM issuance_assistance "
            "WHERE assistance_type IS NULL AND health_condition IS NOT NULL"
        )
        bind.execute(
            sa.text(
                "INSERT INTO issuance_marginalized_sector (issuance_id, health_condition) "
                "SELECT issuance_id, health_condition FROM issuance_assistance "
                "WHERE assistance_type IS NULL AND health_condition IS NOT NULL"
            )
        )
        bind.execute(
            sa.text(f"UPDATE issuances SET document_type_id = :o WHERE id IN ({carried})"),
            {"o": old_id},
        )
        bind.execute(
            sa.text(
                "DELETE FROM issuance_assistance "
                "WHERE assistance_type IS NULL AND health_condition IS NOT NULL"
            )
        )
    bind.execute(sa.text("DELETE FROM issuance_assistance WHERE assistance_type IS NULL"))
    op.alter_column(
        "issuance_assistance",
        "assistance_type",
        existing_type=sa.String(length=20),
        nullable=False,
    )
    op.drop_column("issuance_assistance", "health_condition")
