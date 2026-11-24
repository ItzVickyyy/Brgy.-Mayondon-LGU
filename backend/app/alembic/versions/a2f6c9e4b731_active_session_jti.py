"""Remember which sign-in token an account may use now.

Revision ID: a2f6c9e4b731
Revises: e8c3a5d1f726

One account may be signed in on one computer at a time. ``user.active_session_jti`` holds the
``jti`` of the newest sign-in token; an older token of the same account is refused. Existing
rows stay NULL, which means "no limit until the next sign-in".
"""

import sqlalchemy as sa
from alembic import op

revision = "a2f6c9e4b731"
down_revision = "e8c3a5d1f726"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user",
        sa.Column("active_session_jti", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user", "active_session_jti")
