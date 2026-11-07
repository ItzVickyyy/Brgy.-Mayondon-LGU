"""Add the Barangay ID detail table and emergency contact snapshot columns.

Revision ID: f8d2b6c04e51
Revises: e7c1a5b93d40
Create Date: 2026-11-06 00:19:44.766849

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f8d2b6c04e51'
down_revision = 'e7c1a5b93d40'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('issuance_barangay_id',
    sa.Column('issuance_id', sa.Uuid(), nullable=False),
    sa.Column('transaction_type', sa.String(length=20), nullable=False),
    sa.Column('valid_until', sa.Date(), nullable=False),
    sa.Column('id_number', sa.String(length=50), nullable=True),
    sa.CheckConstraint("transaction_type IN ('new', 'renewal', 'replacement')", name='ck_issuance_barangay_id_transaction'),
    sa.ForeignKeyConstraint(['issuance_id'], ['issuances.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('issuance_id')
    )
    op.create_index('ix_issuance_barangay_id_number', 'issuance_barangay_id', ['id_number'], unique=False)
    op.add_column('issuance_resident_snapshot', sa.Column('emergency_contact_name', sa.String(length=255), nullable=True))
    op.add_column('issuance_resident_snapshot', sa.Column('emergency_contact_address', sa.String(length=500), nullable=True))
    op.add_column('issuance_resident_snapshot', sa.Column('emergency_contact_phone', sa.String(length=30), nullable=True))


def downgrade():
    op.drop_column('issuance_resident_snapshot', 'emergency_contact_phone')
    op.drop_column('issuance_resident_snapshot', 'emergency_contact_address')
    op.drop_column('issuance_resident_snapshot', 'emergency_contact_name')
    op.drop_index('ix_issuance_barangay_id_number', table_name='issuance_barangay_id')
    op.drop_table('issuance_barangay_id')
