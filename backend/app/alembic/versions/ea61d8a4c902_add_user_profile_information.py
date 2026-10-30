"""Add editable profile and contact information to user accounts."""

from alembic import op
import sqlalchemy as sa

revision = "ea61d8a4c902"
down_revision = "c7d42b91e6af"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = [
        ("first_name", sa.String(length=100)),
        ("middle_name", sa.String(length=100)),
        ("last_name", sa.String(length=100)),
        ("extension_name", sa.String(length=20)),
        ("sex", sa.String(length=30)),
        ("civil_status", sa.String(length=30)),
        ("birthdate", sa.String(length=10)),
        ("birthplace", sa.String(length=255)),
        ("phone_number", sa.String(length=30)),
        ("address", sa.String(length=500)),
        ("governing_lgu", sa.String(length=255)),
        ("profile_photo_url", sa.String(length=1000)),
    ]
    for name, column_type in columns:
        op.add_column("user", sa.Column(name, column_type, nullable=True))


def downgrade() -> None:
    for name in [
        "profile_photo_url", "governing_lgu", "address", "phone_number",
        "birthplace", "birthdate", "civil_status", "sex", "extension_name",
        "last_name", "middle_name", "first_name",
    ]:
        op.drop_column("user", name)
