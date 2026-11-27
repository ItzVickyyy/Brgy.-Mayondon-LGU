"""Record deaths: a ``deceased`` resident status and the ``resident_deaths`` table.

Revision ID: c7f4a1d9e352
Revises: b4d9e2a7c618

Going back is refused while any death record exists, so none is ever thrown away.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

revision = "c7f4a1d9e352"
down_revision = "b4d9e2a7c618"
branch_labels = None
depends_on = None

_ARCHIVE_FIELDS = (
    "(status = 'archived' AND archive_reason IS NOT NULL "
    "AND archived_at IS NOT NULL) OR "
    "({others} AND archive_reason IS NULL "
    "AND archived_at IS NULL AND archived_by_user_id IS NULL)"
)


def _resident_checks(statuses: str, not_archived: str) -> None:
    for name in ("ck_residents_status", "ck_residents_archive_fields"):
        op.drop_constraint(name, "residents", type_="check")
    op.create_check_constraint(
        "ck_residents_status", "residents", f"status IN ({statuses})"
    )
    op.create_check_constraint(
        "ck_residents_archive_fields",
        "residents",
        _ARCHIVE_FIELDS.format(others=not_archived),
    )


def upgrade() -> None:
    _resident_checks(
        "'active', 'archived', 'deceased'", "status IN ('active', 'deceased')"
    )
    op.create_table(
        "resident_deaths",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "resident_id",
            sa.Uuid(),
            sa.ForeignKey("residents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date_of_death", sa.Date(), nullable=True),
        sa.Column("date_precision", sa.String(length=10), nullable=False),
        sa.Column("evidence", sa.String(length=10), nullable=False),
        sa.Column("source_note", sa.String(length=500), nullable=True),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "recorded_by_user_id",
            sa.Uuid(),
            sa.ForeignKey("user.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("voided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "voided_by_user_id",
            sa.Uuid(),
            sa.ForeignKey("user.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("void_reason", sa.String(length=500), nullable=True),
        sa.CheckConstraint(
            "date_precision IN ('day', 'month', 'year', 'unknown')",
            name="ck_resident_deaths_precision",
        ),
        sa.CheckConstraint(
            "evidence IN ('reported', 'verified')",
            name="ck_resident_deaths_evidence",
        ),
        sa.CheckConstraint(
            "(date_precision = 'unknown') = (date_of_death IS NULL)",
            name="ck_resident_deaths_date",
        ),
        sa.CheckConstraint(
            "(voided_at IS NULL AND void_reason IS NULL "
            "AND voided_by_user_id IS NULL) OR "
            "(voided_at IS NOT NULL AND void_reason IS NOT NULL)",
            name="ck_resident_deaths_void_fields",
        ),
    )
    op.create_index(
        "ix_resident_deaths_resident_id", "resident_deaths", ["resident_id"]
    )
    op.create_index(
        "uq_resident_deaths_current",
        "resident_deaths",
        ["resident_id"],
        unique=True,
        postgresql_where=sa.text("voided_at IS NULL"),
    )


def downgrade() -> None:
    kept = op.get_bind().execute(text("SELECT count(*) FROM resident_deaths")).scalar()
    if kept:
        raise RuntimeError(
            "Death records exist, so the database cannot go back before them. "
            "Nothing was changed."
        )
    op.drop_table("resident_deaths")
    _resident_checks("'active', 'archived'", "status = 'active'")
