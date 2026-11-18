"""Add administrator-managed addressed-office suggestions.

Revision ID: d3c7a9e5b162
Revises: c9d4e6a2b138

The office text on an issued certificate remains a snapshot. This table only
provides suggested values for future Indigency forms.
"""

import sqlalchemy as sa
from alembic import op

revision = "d3c7a9e5b162"
down_revision = "c9d4e6a2b138"
branch_labels = None
depends_on = None


OFFICES = (
    "CHED",
    "DOH",
    "DSWD - Region IV-A",
    "PAO",
    "RHU-II",
    "Mental Hospital - Mandaluyong City",
    "Laguna District Bay Laguna",
)


def upgrade() -> None:
    op.create_table(
        "addressed_offices",
        sa.Column(
            "id", sa.Integer(), sa.Identity(always=True), primary_key=True, nullable=False
        ),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.UniqueConstraint("name", name="uq_addressed_offices_name"),
    )
    offices = sa.table("addressed_offices", sa.column("name", sa.String(length=150)))
    op.bulk_insert(offices, [{"name": name} for name in OFFICES])


def downgrade() -> None:
    op.drop_table("addressed_offices")
