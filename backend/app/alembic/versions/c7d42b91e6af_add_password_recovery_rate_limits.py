"""Add persistent password recovery rate limits."""

from alembic import op
import sqlalchemy as sa

revision = "c7d42b91e6af"
down_revision = "b57a3c91d6e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "passwordrecoveryratelimit",
        sa.Column("bucket_key", sa.String(length=64), primary_key=True),
        sa.Column("window_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_index(
        "ix_passwordrecoveryratelimit_window_started_at",
        "passwordrecoveryratelimit",
        ["window_started_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_passwordrecoveryratelimit_window_started_at",
        table_name="passwordrecoveryratelimit",
    )
    op.drop_table("passwordrecoveryratelimit")
