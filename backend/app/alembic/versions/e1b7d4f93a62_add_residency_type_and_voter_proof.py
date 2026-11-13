"""Add the residency type and the voter-registration proof to residents.

Revision ID: e1b7d4f93a62
Revises: d9a3c6e8b215

``residency_type`` (regular, new or renting) and the day proof of voter
registration was verified, with who recorded it. Both are optional; an empty
type counts as regular. No data is changed: every existing resident stays empty
and no issued ID changes.
"""

import sqlalchemy as sa
from alembic import op

revision = "e1b7d4f93a62"
down_revision = "d9a3c6e8b215"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "residents", sa.Column("residency_type", sa.String(length=10), nullable=True)
    )
    op.add_column(
        "residents", sa.Column("voter_proof_verified_at", sa.Date(), nullable=True)
    )
    op.add_column(
        "residents",
        sa.Column("voter_proof_verified_by_user_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "residents_voter_proof_verified_by_user_id_fkey",
        "residents",
        "user",
        ["voter_proof_verified_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_check_constraint(
        "ck_residents_residency_type",
        "residents",
        "residency_type IS NULL OR residency_type IN ('regular', 'new', 'renting')",
    )
    op.create_check_constraint(
        "ck_residents_voter_proof",
        "residents",
        "voter_proof_verified_by_user_id IS NULL OR voter_proof_verified_at IS NOT NULL",
    )


def downgrade() -> None:
    op.drop_constraint("ck_residents_voter_proof", "residents", type_="check")
    op.drop_constraint("ck_residents_residency_type", "residents", type_="check")
    op.drop_constraint(
        "residents_voter_proof_verified_by_user_id_fkey",
        "residents",
        type_="foreignkey",
    )
    op.drop_column("residents", "voter_proof_verified_by_user_id")
    op.drop_column("residents", "voter_proof_verified_at")
    op.drop_column("residents", "residency_type")
