"""Add the Residency additional statement to issuances.

Revision ID: a7c4e9d2b816
Revises: f3a8c1d7e925

One nullable text column. The form already had the field but never saved it.
No existing data changes.
"""

import sqlalchemy as sa
from alembic import op

revision = "a7c4e9d2b816"
down_revision = "f3a8c1d7e925"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "issuances",
        sa.Column("additional_statement", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("issuances", "additional_statement")
