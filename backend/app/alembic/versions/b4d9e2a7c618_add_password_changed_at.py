"""Record when each password was last set, for the 3-month password rule.

Revision ID: b4d9e2a7c618
Revises: a2f6c9e4b731

``user.password_changed_at`` is stamped whenever a password is set. A password expires
``PASSWORD_MAX_AGE_DAYS`` (90) days later. Existing accounts start their 90 days on the day
this migration runs, so nobody is locked out the moment the update is installed.
"""

import sqlalchemy as sa
from alembic import op

revision = "b4d9e2a7c618"
down_revision = "a2f6c9e4b731"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user",
        sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute('UPDATE "user" SET password_changed_at = now()')


def downgrade() -> None:
    op.drop_column("user", "password_changed_at")
