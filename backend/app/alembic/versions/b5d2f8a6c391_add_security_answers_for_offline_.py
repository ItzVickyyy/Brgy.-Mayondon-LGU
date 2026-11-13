"""Add security answers for offline recovery.

Revision ID: b5d2f8a6c391
Revises: a7c4e9d2b816

One new table, three rows per person who sets recovery questions. Only an
Argon2 hash of each normalised answer is stored. No existing data changes.
"""

import sqlalchemy as sa
from alembic import op

revision = "b5d2f8a6c391"
down_revision = "a7c4e9d2b816"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "security_answers",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("question_id", sa.String(length=8), nullable=False),
        sa.Column("answer_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "question_id"),
    )


def downgrade() -> None:
    op.drop_table("security_answers")
