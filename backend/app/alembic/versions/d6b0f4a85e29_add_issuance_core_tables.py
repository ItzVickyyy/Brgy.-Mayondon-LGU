"""Add issuance core tables: issuances, shared parts, per-type details, tricycles.

Also creates the sequence behind ``issuances.reference_no``.

Revision ID: d6b0f4a85e29
Revises: c5a9e3f71d48
Create Date: 2026-11-05 23:33:39.251134

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd6b0f4a85e29'
down_revision = 'c5a9e3f71d48'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE SEQUENCE issuance_reference_seq START 1")
    op.create_table('tricycles',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('association_id', sa.Integer(), nullable=False),
    sa.Column('make', sa.String(length=100), nullable=False),
    sa.Column('body_type', sa.String(length=100), nullable=False),
    sa.Column('motor_number', sa.String(length=100), nullable=False),
    sa.Column('color', sa.String(length=50), nullable=False),
    sa.Column('plate_number', sa.String(length=30), nullable=False),
    sa.ForeignKeyConstraint(['association_id'], ['tricycle_associations.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('motor_number'),
    sa.UniqueConstraint('plate_number')
    )
    op.create_table('issuances',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('reference_no', sa.String(length=30), nullable=True),
    sa.Column('document_type_id', sa.Integer(), nullable=False),
    sa.Column('resident_id', sa.Uuid(), nullable=False),
    sa.Column('issue_date', sa.Date(), nullable=False),
    sa.Column('purpose_id', sa.Integer(), nullable=True),
    sa.Column('remarks', sa.String(length=500), nullable=True),
    sa.Column('signatory_official_id', sa.Uuid(), nullable=True),
    sa.Column('status', sa.String(length=10), server_default='draft', nullable=False),
    sa.Column('issued_by_user_id', sa.Uuid(), nullable=True),
    sa.Column('issued_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('expires_on', sa.Date(), nullable=True),
    sa.Column('corrects_issuance_id', sa.Uuid(), nullable=True),
    sa.Column('correction_reason', sa.String(), nullable=True),
    sa.Column('void_reason', sa.String(), nullable=True),
    sa.Column('created_by_user_id', sa.Uuid(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("(status = 'voided') = (void_reason IS NOT NULL)", name='ck_issuances_void_reason'),
    sa.CheckConstraint("status = 'draft' OR (reference_no IS NOT NULL AND issued_at IS NOT NULL AND issued_by_user_id IS NOT NULL)", name='ck_issuances_issued_fields'),
    sa.CheckConstraint("status IN ('draft', 'issued', 'voided')", name='ck_issuances_status'),
    sa.CheckConstraint('(corrects_issuance_id IS NULL) = (correction_reason IS NULL)', name='ck_issuances_correction_reason'),
    sa.ForeignKeyConstraint(['corrects_issuance_id'], ['issuances.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['created_by_user_id'], ['user.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['document_type_id'], ['document_types.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['issued_by_user_id'], ['user.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['purpose_id'], ['issuance_purposes.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['resident_id'], ['residents.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['signatory_official_id'], ['officials.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('reference_no')
    )
    op.create_index('ix_issuances_issue_date', 'issuances', ['issue_date'], unique=False)
    op.create_index('ix_issuances_resident_type_status', 'issuances', ['resident_id', 'document_type_id', 'status'], unique=False)
    op.create_table('issuance_franchise',
    sa.Column('issuance_id', sa.Uuid(), nullable=False),
    sa.Column('tricycle_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['issuance_id'], ['issuances.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['tricycle_id'], ['tricycles.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('issuance_id')
    )
    op.create_table('issuance_identification',
    sa.Column('issuance_id', sa.Uuid(), nullable=False),
    sa.Column('id_type_id', sa.Integer(), nullable=False),
    sa.Column('id_number', sa.String(length=100), nullable=False),
    sa.Column('place_of_issue', sa.String(length=150), nullable=False),
    sa.Column('date_of_issue', sa.Date(), nullable=False),
    sa.ForeignKeyConstraint(['id_type_id'], ['id_types.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['issuance_id'], ['issuances.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('issuance_id')
    )
    op.create_table('issuance_indigency',
    sa.Column('issuance_id', sa.Uuid(), nullable=False),
    sa.Column('addressed_to_office', sa.String(length=200), nullable=False),
    sa.Column('requested_by', sa.String(length=255), nullable=True),
    sa.ForeignKeyConstraint(['issuance_id'], ['issuances.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('issuance_id')
    )
    op.create_table('issuance_payments',
    sa.Column('issuance_id', sa.Uuid(), nullable=False),
    sa.Column('is_free', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    sa.Column('official_receipt_no', sa.String(length=50), nullable=False),
    sa.Column('date_of_payment', sa.Date(), nullable=False),
    sa.Column('certified_by', sa.String(length=50), nullable=True),
    sa.CheckConstraint("NOT is_free OR official_receipt_no = 'FOC'", name='ck_issuance_payments_free_receipt'),
    sa.ForeignKeyConstraint(['issuance_id'], ['issuances.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('issuance_id')
    )
    op.create_table('issuance_resident_snapshot',
    sa.Column('issuance_id', sa.Uuid(), nullable=False),
    sa.Column('full_name', sa.String(length=400), nullable=False),
    sa.Column('address_line', sa.String(length=400), nullable=True),
    sa.Column('birth_date', sa.Date(), nullable=True),
    sa.Column('birth_place', sa.String(length=255), nullable=True),
    sa.Column('sex', sa.String(length=10), nullable=True),
    sa.Column('civil_status', sa.String(length=30), nullable=True),
    sa.Column('resident_since_year', sa.SmallInteger(), nullable=True),
    sa.Column('resident_since_birth', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    sa.ForeignKeyConstraint(['issuance_id'], ['issuances.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('issuance_id')
    )
    op.create_table('issuance_sectors',
    sa.Column('issuance_id', sa.Uuid(), nullable=False),
    sa.Column('sector_id', sa.Integer(), nullable=False),
    sa.Column('sector_id_number', sa.String(length=50), nullable=True),
    sa.ForeignKeyConstraint(['issuance_id'], ['issuances.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['sector_id'], ['sectors.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('issuance_id', 'sector_id')
    )
    op.create_table('issuance_utility',
    sa.Column('issuance_id', sa.Uuid(), nullable=False),
    sa.Column('has_electric', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    sa.Column('has_water', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    sa.Column('connection_type', sa.String(length=20), nullable=False),
    sa.Column('classification', sa.String(length=20), nullable=False),
    sa.Column('location', sa.String(length=255), nullable=False),
    sa.CheckConstraint("classification IN ('residential', 'commercial')", name='ck_issuance_utility_classification'),
    sa.CheckConstraint("connection_type IN ('new', 'reconnection')", name='ck_issuance_utility_connection'),
    sa.CheckConstraint('has_electric OR has_water', name='ck_issuance_utility_service'),
    sa.ForeignKeyConstraint(['issuance_id'], ['issuances.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('issuance_id')
    )


def downgrade():
    op.drop_table('issuance_utility')
    op.drop_table('issuance_sectors')
    op.drop_table('issuance_resident_snapshot')
    op.drop_table('issuance_payments')
    op.drop_table('issuance_indigency')
    op.drop_table('issuance_identification')
    op.drop_table('issuance_franchise')
    op.drop_index('ix_issuances_resident_type_status', table_name='issuances')
    op.drop_index('ix_issuances_issue_date', table_name='issuances')
    op.drop_table('issuances')
    op.drop_table('tricycles')
    op.execute("DROP SEQUENCE issuance_reference_seq")
