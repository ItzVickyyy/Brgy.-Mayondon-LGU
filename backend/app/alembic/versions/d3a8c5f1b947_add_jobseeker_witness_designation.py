"""Store the First-Time Jobseeker witness designation (patch 346).

Revision ID: d3a8c5f1b947
Revises: c7f4a1d9e352

The clerk types the "Barangay Official/Designation/Position" printed under the
witness name when issuing. Older rows keep NULL and fall back to the Officials
list when printed.
"""

import sqlalchemy as sa
from alembic import op

revision = "d3a8c5f1b947"
down_revision = "c7f4a1d9e352"
branch_labels = None
depends_on = None

TABLE = "issuance_first_time_jobseeker"


def _columns() -> set[str]:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(TABLE)}


def upgrade() -> None:
    if "witness_designation" not in _columns():
        op.add_column(
            TABLE,
            sa.Column("witness_designation", sa.String(length=150), nullable=True),
        )


def downgrade() -> None:
    if "witness_designation" in _columns():
        op.drop_column(TABLE, "witness_designation")
