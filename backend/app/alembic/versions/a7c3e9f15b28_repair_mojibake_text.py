"""Repair text saved with the wrong encoding (for example "Los BaÃ±os").

Revision ID: a7c3e9f15b28
Revises: d4f1b8a62e07
"""

import sqlalchemy as sa
from alembic import op

from app.core.text_repair import fix_mojibake

revision = "a7c3e9f15b28"
down_revision = "d4f1b8a62e07"
branch_labels = None
depends_on = None

# The audit log is append-only (a trigger blocks updates) and must not change.
SKIP_TABLES = {"alembic_version", "audit_log"}
SKIP_COLUMN_WORDS = ("password", "hash", "token", "secret")


def upgrade() -> None:
    bind = op.get_bind()
    columns = bind.execute(
        sa.text(
            "SELECT table_name, column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' "
            "AND data_type IN ('character varying', 'text')"
        )
    ).fetchall()
    for table, column in columns:
        if table in SKIP_TABLES or any(w in column for w in SKIP_COLUMN_WORDS):
            continue
        rows = bind.execute(
            sa.text(
                f'SELECT ctid::text, "{column}" FROM "{table}" '  # noqa: S608
                f'WHERE "{column}" ~ \'(Ã|Â|â€)\''
            )
        ).fetchall()
        for ctid, value in rows:
            fixed = fix_mojibake(value)
            if fixed != value:
                bind.execute(
                    sa.text(
                        f'UPDATE "{table}" SET "{column}" = :v '  # noqa: S608
                        "WHERE ctid = CAST(:c AS tid)"
                    ),
                    {"v": fixed, "c": ctid},
                )


def downgrade() -> None:
    # The old, broken text cannot be restored and nobody wants it back.
    pass
