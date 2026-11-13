"""Add the Barangay ID number series (off by default).

Revision ID: f3a8c1d7e925
Revises: e1b7d4f93a62

One settings row (id = 1) holds the prefix, whether the year is part of the
number, the digit width, whether numbering restarts each year and the next
number. It starts switched off, so staff keep typing the number as before. No
existing data changes.
"""

import sqlalchemy as sa
from alembic import op

revision = "f3a8c1d7e925"
down_revision = "e1b7d4f93a62"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "id_number_series",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("prefix", sa.String(length=30), nullable=False, server_default=""),
        sa.Column(
            "include_year", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column("digit_width", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column(
            "restart_yearly", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column("next_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("counter_year", sa.Integer(), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("updated_by_user_id", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(
            ["updated_by_user_id"],
            ["user.id"],
            name="id_number_series_updated_by_user_id_fkey",
            ondelete="SET NULL",
        ),
        sa.CheckConstraint("id = 1", name="ck_id_number_series_single_row"),
        sa.CheckConstraint(
            "digit_width >= 0 AND digit_width <= 12", name="ck_id_number_series_width"
        ),
        sa.CheckConstraint("next_number >= 1", name="ck_id_number_series_next"),
        sa.CheckConstraint(
            "NOT restart_yearly OR include_year", name="ck_id_number_series_restart"
        ),
    )
    op.execute("INSERT INTO id_number_series (id) VALUES (1)")


def downgrade() -> None:
    op.drop_table("id_number_series")
