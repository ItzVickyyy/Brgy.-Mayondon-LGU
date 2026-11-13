"""Add two-factor sign-in (authenticator app and recovery codes).

Revision ID: c6e1a3f7d482
Revises: b5d2f8a6c391

Four columns on ``user`` (all empty or false for everyone at first, so nobody's
sign-in changes) and one new table of one-time recovery codes (hashes only).
"""

import sqlalchemy as sa
from alembic import op

revision = "c6e1a3f7d482"
down_revision = "b5d2f8a6c391"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user",
        sa.Column(
            "mfa_enabled", sa.Boolean(), server_default=sa.false(), nullable=False
        ),
    )
    op.add_column(
        "user", sa.Column("mfa_secret_encrypted", sa.String(length=255), nullable=True)
    )
    op.add_column("user", sa.Column("mfa_last_step", sa.Integer(), nullable=True))
    op.add_column(
        "user",
        sa.Column("mfa_enrolled_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "mfa_recovery_codes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("code_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_mfa_recovery_codes_user_id"), "mfa_recovery_codes", ["user_id"]
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_mfa_recovery_codes_user_id"), table_name="mfa_recovery_codes"
    )
    op.drop_table("mfa_recovery_codes")
    op.drop_column("user", "mfa_enrolled_at")
    op.drop_column("user", "mfa_last_step")
    op.drop_column("user", "mfa_secret_encrypted")
    op.drop_column("user", "mfa_enabled")
