"""Foundation tables: lookups, officials and append-only audit log.

Also removes the unused template ``item`` table and clears stale
password-recovery rate-limit rows.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "b4e8d2a61c37"
down_revision = "a3f5c1d27b90"
branch_labels = None
depends_on = None

# Seed values come from the office's lists in frontend/src/components/Issuances
# (config.ts, NewIssuance/documentConfig.ts) and the groupmate's SQL script.
DOCUMENT_TYPES = [
    (
        "BARANGAY_CLEARANCE",
        "Barangay Clearance",
        "clearance",
        "overlay",
        2,
        False,
        None,
    ),
    (
        "FRANCHISE_CLEARANCE",
        "Franchise Clearance",
        "clearance",
        "overlay",
        None,
        False,
        None,
    ),
    (
        "UTILITY_CLEARANCE",
        "Electrical and Water Clearance",
        "clearance",
        "overlay",
        None,
        False,
        None,
    ),
    (
        "RESIDENCY",
        "Certification of Residency",
        "certification",
        "full_page",
        None,
        False,
        "Punong Barangay",
    ),
    (
        "INDIGENCY",
        "Certificate of Indigency",
        "certification",
        "overlay",
        None,
        False,
        None,
    ),
    (
        "ASSISTANCE",
        "Assistance Certification",
        "certification",
        "overlay",
        None,
        False,
        "Barangay Kagawad",
    ),
    (
        "MARGINALIZED_SECTOR",
        "Marginalized Sector (Pagpapatunay)",
        "certification",
        "full_page",
        None,
        False,
        "Barangay Kagawad",
    ),
    (
        "FIRST_TIME_JOBSEEKER",
        "First-Time Jobseeker",
        "certification",
        "full_page",
        12,
        True,
        "Punong Barangay",
    ),
    ("BARANGAY_ID", "Barangay ID", "id", "overlay", None, False, None),
]

SECTORS = [
    "Urban Poor",
    "Small Farmers and Rural Workers",
    "Fisherfolk",
    "Workers in the Informal Economy",
    "Person with Disabilities (PWD)",
    "Solo Parents",
    "Senior Citizens",
    "Barangay-based Volunteer Workers",
    "Government Employee",
    "STUDENT",
    "other marginalized sector",
]

ID_TYPES = [
    "CTC",
    "Barangay ID",
    "VIN",
    "Passport",
    "UMID",
    "School ID",
    "Driver's License",
    "Senior Citizen",
    "Solo Parent",
    "Postal ID",
    "PWD ID",
    "PhilHealth ID",
    "PRC ID",
    "National ID",
    "SSS ID",
    "TIN ID",
]

PURPOSES = [
    # Barangay Clearance
    "Employment Requirement",
    "Student Permit Requirement",
    "Proof of Residency only",
    "SIDECAR Loan Application Requirement",
    "Loan Application Requirement",
    "House Loan Application Requirement",
    "Franchise Requirement",
    "Internet Connection Application Requirement",
    "Bank Requirement (Opening Bank Account)",
    "Driver's License Requirement",
    "Overseas Employment Requirement",
    "E-BIKE Loan Application Requirement",
    "Permit to Carry Firearms License",
    "E-BIKE Franchise Requirement",
    "Employment Requirement/First Time Jobseeker",
    "School/OJT Requirement",
    "Motor Loan Application Requirement",
    "Electric Installation Requirements",
    "Senior Citizen Requirement",
    "Application for Service/Special Permit",
    "POSTAL ID",
    "OJT Requirement",
    "PESO Requirement",
    "Firearms License",
    "Franchise Requirement (Special Permit)",
    "Car Loan Application Requirement",
    "Marriage Application Requirement",
    "E-Bike Application",
    "LTOPF Registration",
    "PAARU",
    # Certificate of Indigency
    "Scholarship Requirement",
    "Medical Assistance",
    "Financial/Medical Assistance",
    "Financial/Burial Assistance",
    "Delayed Registration of Birth",
    "PAO Requirement",
    "BIR Tax Exemption for Scholarship Requirement",
    "Work Requirement",
]

AUDIT_GUARD_FUNCTION = """
CREATE FUNCTION audit_log_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Only allowed change: the actor's account was deleted (SET NULL).
        IF OLD.actor_user_id IS NOT NULL
           AND NEW.actor_user_id IS NULL
           AND (NEW.id, NEW.occurred_at, NEW.actor_email, NEW.action, NEW.module,
                NEW.record_type, NEW.record_id, NEW.outcome, NEW.reason,
                NEW.details)
               IS NOT DISTINCT FROM
               (OLD.id, OLD.occurred_at, OLD.actor_email, OLD.action, OLD.module,
                OLD.record_type, OLD.record_id, OLD.outcome, OLD.reason,
                OLD.details)
        THEN
            RETURN NEW;
        END IF;
    END IF;
    RAISE EXCEPTION 'audit_log is append only (% is not allowed)', TG_OP;
END;
$$ LANGUAGE plpgsql;
"""


def _lookup(name: str, length: int) -> None:
    op.create_table(
        name,
        sa.Column("id", sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column("name", sa.String(length=length), nullable=False),
        sa.UniqueConstraint("name", name=f"uq_{name}_name"),
    )


def upgrade() -> None:
    # --- Cleanup -----------------------------------------------------------
    op.drop_table("item")
    op.execute("DELETE FROM passwordrecoveryratelimit")

    # --- Lookups -----------------------------------------------------------
    document_types = op.create_table(
        "document_types",
        sa.Column("id", sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column("code", sa.String(length=40), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.Column("print_mode", sa.String(length=20), nullable=False),
        sa.Column("validity_months", sa.Integer(), nullable=True),
        sa.Column(
            "one_per_resident", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column("signatory_default_position", sa.String(length=100), nullable=True),
        sa.CheckConstraint(
            "category IN ('clearance', 'certification', 'id')",
            name="ck_document_types_category",
        ),
        sa.CheckConstraint(
            "print_mode IN ('overlay', 'full_page')",
            name="ck_document_types_print_mode",
        ),
        sa.CheckConstraint(
            "validity_months IS NULL OR validity_months > 0",
            name="ck_document_types_validity_positive",
        ),
    )
    op.create_index("ix_document_types_code", "document_types", ["code"], unique=True)

    _lookup("sectors", 100)
    _lookup("id_types", 50)
    _lookup("issuance_purposes", 150)
    _lookup("tricycle_associations", 150)
    _lookup("streets", 150)

    # --- Officials ---------------------------------------------------------
    op.create_table(
        "officials",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("position", sa.String(length=100), nullable=False),
        sa.Column("term_start", sa.Date(), nullable=False),
        sa.Column("term_end", sa.Date(), nullable=True),
        sa.Column(
            "is_elected", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.CheckConstraint(
            "term_end IS NULL OR term_end >= term_start",
            name="ck_officials_term_order",
        ),
    )

    # --- Audit log ---------------------------------------------------------
    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("actor_email", sa.String(length=255), nullable=True),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("module", sa.String(length=60), nullable=True),
        sa.Column("record_type", sa.String(length=60), nullable=True),
        sa.Column("record_id", sa.String(length=80), nullable=True),
        sa.Column(
            "outcome", sa.String(length=10), nullable=False, server_default="success"
        ),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["actor_user_id"], ["user.id"], ondelete="SET NULL"),
        sa.CheckConstraint(
            "outcome IN ('success', 'failed', 'denied')",
            name="ck_audit_log_outcome",
        ),
    )
    op.create_index("ix_audit_log_occurred_at", "audit_log", ["occurred_at"])
    op.create_index("ix_audit_log_record", "audit_log", ["record_type", "record_id"])

    op.execute(AUDIT_GUARD_FUNCTION)
    op.execute(
        "CREATE TRIGGER audit_log_no_change BEFORE UPDATE OR DELETE ON audit_log "
        "FOR EACH ROW EXECUTE FUNCTION audit_log_guard()"
    )
    op.execute(
        "CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log "
        "FOR EACH STATEMENT EXECUTE FUNCTION audit_log_guard()"
    )

    # --- Seed data ---------------------------------------------------------
    op.bulk_insert(
        document_types,
        [
            {
                "code": c,
                "name": n,
                "category": cat,
                "print_mode": pm,
                "validity_months": v,
                "one_per_resident": one,
                "signatory_default_position": sig,
            }
            for c, n, cat, pm, v, one, sig in DOCUMENT_TYPES
        ],
    )
    for table, values in (
        ("sectors", SECTORS),
        ("id_types", ID_TYPES),
        ("issuance_purposes", PURPOSES),
    ):
        t = sa.table(table, sa.column("name", sa.String))
        op.bulk_insert(t, [{"name": v} for v in values])


def downgrade() -> None:
    op.execute("DROP TRIGGER audit_log_no_truncate ON audit_log")
    op.execute("DROP TRIGGER audit_log_no_change ON audit_log")
    op.execute("DROP FUNCTION audit_log_guard()")
    op.drop_table("audit_log")
    op.drop_table("officials")
    for name in (
        "streets",
        "tricycle_associations",
        "issuance_purposes",
        "id_types",
        "sectors",
    ):
        op.drop_table(name)
    op.drop_index("ix_document_types_code", table_name="document_types")
    op.drop_table("document_types")
    op.create_table(
        "item",
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"], ondelete="CASCADE"),
    )
