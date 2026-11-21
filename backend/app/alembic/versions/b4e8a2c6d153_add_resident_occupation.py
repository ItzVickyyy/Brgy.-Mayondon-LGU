"""Add an optional occupation to residents.

Revision ID: b4e8a2c6d153
Revises: e7b3d1a5c928

Free text, up to 100 characters; empty for every existing resident.
"""

import sqlalchemy as sa
from alembic import op

revision = "b4e8a2c6d153"
down_revision = "e7b3d1a5c928"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "residents",
        sa.Column("occupation", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("residents", "occupation")
