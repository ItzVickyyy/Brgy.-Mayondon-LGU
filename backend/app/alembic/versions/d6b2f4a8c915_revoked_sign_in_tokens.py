"""Remember sign-in tokens that were ended by signing out.

Revision ID: d6b2f4a8c915
Revises: c5a1e9d7b304

A sign-in token used to stay valid until it expired (8 hours) even after the person signed out.
Each new token now has an id (``jti``); signing out stores that id here until the token's own
expiry, and the token is refused from then on. Tokens issued before this change have no id and
simply run out as before. Rows are removed once the token would have expired anyway.
"""

import sqlalchemy as sa
from alembic import op

revision = "d6b2f4a8c915"
down_revision = "c5a1e9d7b304"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "revokedtoken",
        sa.Column("jti", sa.String(length=64), primary_key=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_revokedtoken_expires_at", "revokedtoken", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_revokedtoken_expires_at", table_name="revokedtoken")
    op.drop_table("revokedtoken")
