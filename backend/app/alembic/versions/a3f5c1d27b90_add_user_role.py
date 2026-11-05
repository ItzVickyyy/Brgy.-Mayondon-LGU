"""Add an explicit account role (admin or staff) with database constraints."""

from alembic import op
import sqlalchemy as sa

revision = "a3f5c1d27b90"
down_revision = "ea61d8a4c902"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user",
        sa.Column("role", sa.String(length=20), nullable=False, server_default="staff"),
    )
    # Existing administrators keep their access; everyone else is Staff.
    op.execute("UPDATE \"user\" SET role = 'admin' WHERE is_superuser")
    op.create_check_constraint(
        "ck_user_role_valid", "user", "role IN ('admin', 'staff')"
    )
    op.create_check_constraint(
        "ck_user_role_matches_superuser", "user", "(role = 'admin') = is_superuser"
    )


def downgrade() -> None:
    op.drop_constraint("ck_user_role_matches_superuser", "user", type_="check")
    op.drop_constraint("ck_user_role_valid", "user", type_="check")
    op.drop_column("user", "role")
