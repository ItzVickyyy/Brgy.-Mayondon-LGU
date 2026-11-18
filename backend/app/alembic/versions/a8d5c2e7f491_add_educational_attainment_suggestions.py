"""Add administrator-managed educational-attainment suggestions.

Revision ID: a8d5c2e7f491
Revises: d3c7a9e5b162

The selected value remains text on the issuance detail row. This table only
provides administrator-managed choices for future First-Time Jobseeker forms.
"""

import sqlalchemy as sa
from alembic import op

revision = "a8d5c2e7f491"
down_revision = "d3c7a9e5b162"
branch_labels = None
depends_on = None


VALUES = (
    "Elementary",
    "Junior High School",
    "Senior High School",
    "Vocational",
    "College",
    "Postgraduate",
)


def upgrade() -> None:
    op.create_table(
        "educational_attainments",
        sa.Column(
            "id", sa.Integer(), sa.Identity(always=True), primary_key=True, nullable=False
        ),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.UniqueConstraint("name", name="uq_educational_attainments_name"),
    )
    values = sa.table(
        "educational_attainments", sa.column("name", sa.String(length=150))
    )
    op.bulk_insert(values, [{"name": name} for name in VALUES])


def downgrade() -> None:
    op.drop_table("educational_attainments")
