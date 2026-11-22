"""Let the assistance health condition hold encrypted text.

Revision ID: e8c3a5d1f726
Revises: d6b2f4a8c915

The column was VARCHAR(500). Once ``DATA_ENCRYPTION_KEY`` is set the value is stored as
``enc1:`` + base64 of nonce and ciphertext, which is longer than the text it hides, so the column
becomes TEXT. This migration changes the type only; existing plain-text rows are encrypted at
start-up by ``core/field_crypto.encrypt_existing`` (needs the key, safe to repeat).

Going back decrypts every encrypted row first (it needs the same key) and stops, changing
nothing, if one cannot be read.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

revision = "e8c3a5d1f726"
down_revision = "d6b2f4a8c915"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "issuance_assistance",
        "health_condition",
        existing_type=sa.String(length=500),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    from app.core.field_crypto import PREFIX, decrypt_text

    connection = op.get_bind()
    rows = connection.execute(
        text(
            "SELECT issuance_id, health_condition FROM issuance_assistance "
            "WHERE health_condition LIKE :p"
        ),
        {"p": PREFIX + "%"},
    ).all()
    plain_values = []
    for issuance_id, stored in rows:
        plain = decrypt_text(stored)
        if plain is None:
            raise RuntimeError(
                "A health condition is encrypted and cannot be read with the current "
                "DATA_ENCRYPTION_KEY. Nothing was changed."
            )
        plain_values.append((issuance_id, plain))
    for issuance_id, plain in plain_values:
        connection.execute(
            text(
                "UPDATE issuance_assistance SET health_condition = :v "
                "WHERE issuance_id = :i"
            ),
            {"v": plain, "i": issuance_id},
        )
    op.alter_column(
        "issuance_assistance",
        "health_condition",
        existing_type=sa.Text(),
        type_=sa.String(length=500),
        existing_nullable=True,
    )
