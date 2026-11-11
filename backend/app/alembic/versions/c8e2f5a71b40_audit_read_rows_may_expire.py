"""Let old READ rows of the audit log expire (and nothing else).

Revision ID: c8e2f5a71b40
Revises: a7c3e9f15b28

The audit log stays append-only. The only new exception is DELETE of a row that
only records a read (opening a profile, browsing a list) AND is older than 90
days. The database enforces both limits, so no program bug or stolen account
can remove a change record, a sign-in record or a recent row. TRUNCATE and
every UPDATE except the old "account deleted" case stay blocked.
"""

from alembic import op

revision = "c8e2f5a71b40"
down_revision = "a7c3e9f15b28"
branch_labels = None
depends_on = None

GUARD_WITH_EXPIRY = """
CREATE OR REPLACE FUNCTION audit_log_guard() RETURNS trigger AS $$
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
    IF TG_OP = 'DELETE' THEN
        -- Only allowed delete: a read-only row older than 90 days.
        IF OLD.action IN ('resident.view', 'resident.list', 'barangay_id.list')
           AND OLD.occurred_at < now() - interval '90 days'
        THEN
            RETURN OLD;
        END IF;
    END IF;
    RAISE EXCEPTION 'audit_log is append only (% is not allowed)', TG_OP;
END;
$$ LANGUAGE plpgsql;
"""

GUARD_APPEND_ONLY = """
CREATE OR REPLACE FUNCTION audit_log_guard() RETURNS trigger AS $$
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


def upgrade() -> None:
    op.execute(GUARD_WITH_EXPIRY)


def downgrade() -> None:
    op.execute(GUARD_APPEND_ONLY)
