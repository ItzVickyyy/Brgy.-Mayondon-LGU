"""Add residents, resident_sectors and resident_photos."""

import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

revision = "c5a9e3f71d48"
down_revision = "b4e8d2a61c37"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "residents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "first_name", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False
        ),
        sa.Column(
            "middle_name", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=True
        ),
        sa.Column(
            "last_name", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False
        ),
        sa.Column("suffix", sqlmodel.sql.sqltypes.AutoString(length=10), nullable=True),
        sa.Column("birthdate", sa.Date(), nullable=True),
        sa.Column(
            "birth_place", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True
        ),
        sa.Column("sex", sqlmodel.sql.sqltypes.AutoString(length=10), nullable=True),
        sa.Column(
            "civil_status", sqlmodel.sql.sqltypes.AutoString(length=30), nullable=True
        ),
        sa.Column(
            "house_number", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=True
        ),
        sa.Column("street_id", sa.Integer(), nullable=True),
        sa.Column("purok", sa.SmallInteger(), nullable=True),
        sa.Column("resident_since_year", sa.SmallInteger(), nullable=True),
        sa.Column(
            "resident_since_birth",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "resident_type", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=True
        ),
        sa.Column(
            "id_number", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=True
        ),
        sa.Column(
            "voter_registration",
            sqlmodel.sql.sqltypes.AutoString(length=20),
            nullable=True,
        ),
        sa.Column(
            "emergency_contact_name",
            sqlmodel.sql.sqltypes.AutoString(length=255),
            nullable=True,
        ),
        sa.Column(
            "emergency_contact_address",
            sqlmodel.sql.sqltypes.AutoString(length=500),
            nullable=True,
        ),
        sa.Column(
            "emergency_contact_phone",
            sqlmodel.sql.sqltypes.AutoString(length=30),
            nullable=True,
        ),
        sa.Column(
            "status",
            sqlmodel.sql.sqltypes.AutoString(length=10),
            server_default="active",
            nullable=False,
        ),
        sa.Column("archive_reason", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_by_user_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("updated_by_user_id", sa.Uuid(), nullable=True),
        sa.CheckConstraint(
            "(status = 'archived' AND archive_reason IS NOT NULL AND archived_at IS NOT NULL) OR (status = 'active' AND archive_reason IS NULL AND archived_at IS NULL AND archived_by_user_id IS NULL)",
            name="ck_residents_archive_fields",
        ),
        sa.CheckConstraint(
            "civil_status IS NULL OR civil_status IN ('Single', 'Married', 'Legally Separated', 'Widow/Widower')",
            name="ck_residents_civil_status",
        ),
        sa.CheckConstraint(
            "sex IS NULL OR sex IN ('Male', 'Female')", name="ck_residents_sex"
        ),
        sa.CheckConstraint(
            "status IN ('active', 'archived')", name="ck_residents_status"
        ),
        sa.CheckConstraint(
            "suffix IS NULL OR suffix IN ('Jr.', 'Sr.', 'II', 'III', 'IV', 'V')",
            name="ck_residents_suffix",
        ),
        sa.CheckConstraint(
            "voter_registration IS NULL OR voter_registration IN ('registered', 'unregistered')",
            name="ck_residents_voter_registration",
        ),
        sa.CheckConstraint(
            "NOT (resident_since_birth AND resident_since_year IS NOT NULL)",
            name="ck_residents_since_not_both",
        ),
        sa.CheckConstraint("purok IS NULL OR purok > 0", name="ck_residents_purok"),
        sa.CheckConstraint(
            "resident_since_year IS NULL OR resident_since_year BETWEEN 1900 AND 2200",
            name="ck_residents_since_year",
        ),
        sa.ForeignKeyConstraint(
            ["archived_by_user_id"], ["user.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"], ["user.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["street_id"], ["streets.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["updated_by_user_id"], ["user.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_residents_birthdate", "residents", ["birthdate"], unique=False)
    op.create_index(
        "ix_residents_name_lower",
        "residents",
        [sa.literal_column("lower(last_name)"), sa.literal_column("lower(first_name)")],
        unique=False,
    )
    op.create_index(
        "uq_residents_id_number",
        "residents",
        ["id_number"],
        unique=True,
        postgresql_where=sa.text("id_number IS NOT NULL"),
    )
    op.create_table(
        "resident_photos",
        sa.Column("resident_id", sa.Uuid(), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.Column(
            "content_type", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False
        ),
        sa.Column("byte_size", sa.Integer(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_by_user_id", sa.Uuid(), nullable=True),
        sa.CheckConstraint(
            "content_type IN ('image/png', 'image/webp')",
            name="ck_resident_photos_type",
        ),
        sa.CheckConstraint(
            "byte_size > 0 AND byte_size <= 307200", name="ck_resident_photos_size"
        ),
        sa.ForeignKeyConstraint(["resident_id"], ["residents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["updated_by_user_id"], ["user.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("resident_id"),
    )
    op.create_table(
        "resident_sectors",
        sa.Column("resident_id", sa.Uuid(), nullable=False),
        sa.Column("sector_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["resident_id"], ["residents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sector_id"], ["sectors.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("resident_id", "sector_id"),
    )


def downgrade():
    op.drop_table("resident_sectors")
    op.drop_table("resident_photos")
    op.drop_index(
        "uq_residents_id_number",
        table_name="residents",
        postgresql_where=sa.text("id_number IS NOT NULL"),
    )
    op.drop_index("ix_residents_name_lower", table_name="residents")
    op.drop_index("ix_residents_birthdate", table_name="residents")
    op.drop_table("residents")
