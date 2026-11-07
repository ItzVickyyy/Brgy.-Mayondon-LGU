"""Add must_change_password to user accounts (D-12 temporary passwords)."""

from alembic import op
import sqlalchemy as sa

revision = "a1c4e8b27d93"
down_revision = "f8d2b6c04e51"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user",
        sa.Column(
            "must_change_password",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("user", "must_change_password")
