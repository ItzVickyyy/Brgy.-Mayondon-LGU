"""Keep display preferences per account.

Revision ID: c5a1e9d7b304
Revises: b4e8a2c6d153

Theme, accent and font size move from the browser to the user row, so they
follow the person to another computer. Empty for every existing account; the
browser copies its own saved choice up the first time the person signs in.
"""

import sqlalchemy as sa
from alembic import op

revision = "c5a1e9d7b304"
down_revision = "b4e8a2c6d153"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user", sa.Column("preferences", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("user", "preferences")
