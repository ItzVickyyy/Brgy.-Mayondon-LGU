"""Remove obsolete mfa_required column from user table.

Revision ID: f1a9c3d7e5b2
Revises: e8f3b1c6a925
"""

import sqlalchemy as sa
from alembic import op

revision = "f1a9c3d7e5b2"
down_revision = "e8f3b1c6a925"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("user")}

    if "mfa_required" in columns:
        op.drop_column(
            "user",
            "mfa_required",
            existing_type=sa.Boolean(),
        )


def downgrade() -> None:
    # The legacy column is not part of the current schema.
    # Its removal is intentionally irreversible.
    pass
