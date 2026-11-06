"""Add assistance, marginalized sector and jobseeker detail tables.

The health condition column is sensitive: it is masked in every response except
the audited single-issuance read.

Revision ID: e7c1a5b93d40
Revises: d6b0f4a85e29
Create Date: 2026-11-05 23:58:08.206964

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e7c1a5b93d40'
down_revision = 'd6b0f4a85e29'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('issuance_assistance',
    sa.Column('issuance_id', sa.Uuid(), nullable=False),
    sa.Column('assistance_type', sa.String(length=20), nullable=False),
    sa.Column('for_self', sa.Boolean(), server_default=sa.text('true'), nullable=False),
    sa.Column('beneficiary_name', sa.String(length=255), nullable=True),
    sa.Column('beneficiary_relationship', sa.String(length=100), nullable=True),
    sa.CheckConstraint("assistance_type IN ('financial', 'medical', 'burial')", name='ck_issuance_assistance_type'),
    sa.CheckConstraint('for_self OR (beneficiary_name IS NOT NULL AND beneficiary_relationship IS NOT NULL)', name='ck_issuance_assistance_beneficiary'),
    sa.ForeignKeyConstraint(['issuance_id'], ['issuances.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('issuance_id')
    )
    op.create_table('issuance_first_time_jobseeker',
    sa.Column('issuance_id', sa.Uuid(), nullable=False),
    sa.Column('educational_attainment', sa.String(length=150), nullable=False),
    sa.Column('course', sa.String(length=150), nullable=False),
    sa.Column('is_jobstart_beneficiary', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    sa.Column('witness_official_id', sa.Uuid(), nullable=True),
    sa.ForeignKeyConstraint(['issuance_id'], ['issuances.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['witness_official_id'], ['officials.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('issuance_id')
    )
    op.create_table('issuance_marginalized_sector',
    sa.Column('issuance_id', sa.Uuid(), nullable=False),
    sa.Column('health_condition', sa.String(length=500), nullable=False),
    sa.ForeignKeyConstraint(['issuance_id'], ['issuances.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('issuance_id')
    )


def downgrade():
    op.drop_table('issuance_marginalized_sector')
    op.drop_table('issuance_first_time_jobseeker')
    op.drop_table('issuance_assistance')
