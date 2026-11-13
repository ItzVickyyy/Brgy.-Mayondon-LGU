"""Let an issuance be archived (hidden) without changing its status.

Revision ID: d9a3c6e8b215
Revises: c8e2f5a71b40

Adds who, when, why and the status the record had. ``status`` is never touched
by archiving, so an archived issued copy is still an issued copy. No data is
changed: every existing row stays unarchived.
"""

import sqlalchemy as sa
from alembic import op

revision = "d9a3c6e8b215"
down_revision = "c8e2f5a71b40"
branch_labels = None
depends_on = None

CHECK = (
    "(archived_at IS NULL AND archive_reason IS NULL "
    "AND original_status IS NULL AND archived_by_user_id IS NULL) OR "
    "(archived_at IS NOT NULL AND archive_reason IS NOT NULL "
    "AND original_status IN ('issued', 'voided') "
    "AND original_status = status)"
)


def upgrade() -> None:
    op.add_column(
        "issuances", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "issuances", sa.Column("archived_by_user_id", sa.Uuid(), nullable=True)
    )
    op.add_column("issuances", sa.Column("archive_reason", sa.String(), nullable=True))
    op.add_column(
        "issuances", sa.Column("original_status", sa.String(length=10), nullable=True)
    )
    op.create_foreign_key(
        "issuances_archived_by_user_id_fkey",
        "issuances",
        "user",
        ["archived_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_check_constraint("ck_issuances_archive_fields", "issuances", CHECK)
    op.create_index(
        "ix_issuances_archived_at",
        "issuances",
        ["archived_at"],
        postgresql_where=sa.text("archived_at IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_issuances_archived_at", table_name="issuances")
    op.drop_constraint("ck_issuances_archive_fields", "issuances", type_="check")
    op.drop_constraint(
        "issuances_archived_by_user_id_fkey", "issuances", type_="foreignkey"
    )
    op.drop_column("issuances", "original_status")
    op.drop_column("issuances", "archive_reason")
    op.drop_column("issuances", "archived_by_user_id")
    op.drop_column("issuances", "archived_at")
