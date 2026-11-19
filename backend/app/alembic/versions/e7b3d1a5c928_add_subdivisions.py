"""Add administrator-managed subdivisions.

Revision ID: e7b3d1a5c928
Revises: a8d5c2e7f491

Starts empty: subdivisions are added by an administrator in Issuance settings.
"""

import sqlalchemy as sa
from alembic import op

revision = "e7b3d1a5c928"
down_revision = "a8d5c2e7f491"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "subdivisions",
        sa.Column(
            "id", sa.Integer(), sa.Identity(always=True), primary_key=True, nullable=False
        ),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.UniqueConstraint("name", name="uq_subdivisions_name"),
    )


def downgrade() -> None:
    op.drop_table("subdivisions")
