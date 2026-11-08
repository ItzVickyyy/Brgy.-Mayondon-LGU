"""Add import_batches and import_rows (D-19 masterlist import staging).

Revision ID: d4f1b8a62e07
Revises: b3e7d1a9c552
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "d4f1b8a62e07"
down_revision = "b3e7d1a9c552"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "import_batches",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("created_by_email", sa.String(length=255), nullable=True),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_type", sa.String(length=10), nullable=False),
        sa.Column("status", sa.String(length=10), nullable=False),
        sa.Column("total_rows", sa.Integer(), nullable=False),
        sa.Column("headers", postgresql.JSONB(), nullable=False),
        sa.Column("mapping", postgresql.JSONB(), nullable=True),
        sa.Column("date_order", sa.String(length=3), nullable=False),
        sa.Column("duplicate_action", sa.String(length=10), nullable=False),
        sa.Column("counts", postgresql.JSONB(), nullable=True),
        sa.Column("result", postgresql.JSONB(), nullable=True),
        sa.Column("committed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('uploaded', 'mapped', 'committed', 'cancelled', 'expired', 'failed')",
            name="ck_import_batches_status",
        ),
        sa.CheckConstraint(
            "file_type IN ('csv', 'xlsx')", name="ck_import_batches_file_type"
        ),
        sa.CheckConstraint(
            "date_order IN ('ymd', 'mdy', 'dmy')", name="ck_import_batches_date_order"
        ),
        sa.CheckConstraint(
            "duplicate_action IN ('skip', 'update')",
            name="ck_import_batches_duplicate_action",
        ),
        sa.ForeignKeyConstraint(["created_by"], ["user.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_import_batches_created_at", "import_batches", ["created_at"], unique=False
    )
    op.create_table(
        "import_rows",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("batch_id", sa.Uuid(), nullable=False),
        sa.Column("row_number", sa.Integer(), nullable=False),
        sa.Column("raw", postgresql.JSONB(), nullable=True),
        sa.Column("mapped", postgresql.JSONB(), nullable=True),
        sa.Column("errors", postgresql.JSONB(), nullable=True),
        sa.Column("classification", sa.String(length=10), nullable=True),
        sa.Column("duplicate_resident_id", sa.Uuid(), nullable=True),
        sa.Column("duplicate_scope", sa.String(length=10), nullable=True),
        sa.Column("outcome", sa.String(length=10), nullable=True),
        sa.CheckConstraint(
            "classification IS NULL OR classification IN ('new', 'duplicate', 'error')",
            name="ck_import_rows_classification",
        ),
        sa.CheckConstraint(
            "outcome IS NULL OR outcome IN ('created', 'updated', 'skipped', 'failed')",
            name="ck_import_rows_outcome",
        ),
        sa.ForeignKeyConstraint(
            ["batch_id"], ["import_batches.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_import_rows_batch_row",
        "import_rows",
        ["batch_id", "row_number"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_import_rows_batch_row", table_name="import_rows")
    op.drop_table("import_rows")
    op.drop_index("ix_import_batches_created_at", table_name="import_batches")
    op.drop_table("import_batches")
