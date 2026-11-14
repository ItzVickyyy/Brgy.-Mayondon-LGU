"""Let an administrator ask a staff person to use two-factor (patch 77).

Revision ID: a2d7e4c9b613
Revises: f1a9c3d7e5b2

One boolean column on ``user``. It is added only when it is missing, so a
database that still has the old column of the lost first version of patch 71
(removed by ``f1a9c3d7e5b2``) or already has this one is not an error.
"""

import sqlalchemy as sa
from alembic import op

revision = "a2d7e4c9b613"
down_revision = "f1a9c3d7e5b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {
        column["name"] for column in sa.inspect(op.get_bind()).get_columns("user")
    }
    if "mfa_required" not in columns:
        op.add_column(
            "user",
            sa.Column(
                "mfa_required",
                sa.Boolean(),
                server_default=sa.false(),
                nullable=False,
            ),
        )


def downgrade() -> None:
    columns = {
        column["name"] for column in sa.inspect(op.get_bind()).get_columns("user")
    }
    if "mfa_required" in columns:
        op.drop_column("user", "mfa_required")
