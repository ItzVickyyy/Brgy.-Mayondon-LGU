"""Store the First-Time Jobseeker witness as a name (patch 133).

Revision ID: b7e3a1c5d902
Revises: a2d7e4c9b613

The witness is now the full name of the user who issues the document, kept as
text on the issuance. ``witness_official_id`` stays so older issuances keep
their witness. The column is added only when it is missing.
"""

import sqlalchemy as sa
from alembic import op

revision = "b7e3a1c5d902"
down_revision = "a2d7e4c9b613"
branch_labels = None
depends_on = None

TABLE = "issuance_first_time_jobseeker"


def _columns() -> set[str]:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(TABLE)}


def upgrade() -> None:
    if "witness_name" not in _columns():
        op.add_column(
            TABLE,
            sa.Column("witness_name", sa.String(length=255), nullable=True),
        )


def downgrade() -> None:
    if "witness_name" in _columns():
        op.drop_column(TABLE, "witness_name")
