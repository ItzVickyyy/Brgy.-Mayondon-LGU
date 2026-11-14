"""Add per-person read state for the notification bell.

Revision ID: e8f3b1c6a925
Revises: c6e1a3f7d482

Two small tables. The notices themselves are read from ``audit_log``, which is
not touched. No data change.
"""

import sqlalchemy as sa
from alembic import op

revision = "e8f3b1c6a925"
down_revision = "c6e1a3f7d482"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notification_state",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("read_upto", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_table(
        "notification_reads",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("audit_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "read_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "audit_id"),
    )


def downgrade() -> None:
    op.drop_table("notification_reads")
    op.drop_table("notification_state")
