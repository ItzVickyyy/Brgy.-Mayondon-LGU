"""Role-based access control: which role may do what.

This is the single place that maps roles to permissions. Routes ask for a
*permission* (``require_permission``), never for a role name, so the matrix can
change without touching every endpoint.

The matrix follows docs/05-Roles-Security-and-Privacy.md section A3. It is a
**proposal, not a client-approved policy** (D-10, D-11). Every permission below
has an endpoint except ``REGISTRATIONS_REVIEW`` (open registration is off, so
there is nothing to review yet); it stays declared so that a future review
endpoint is protected from its first commit. Deny by default: an unknown role
has no permissions.
"""

from enum import StrEnum

from app.models import User, UserRole


class Permission(StrEnum):
    # Allowed for Staff and System Administrator
    RECORDS_EDIT = "records.edit"  # residents: search, view, add, edit
    ISSUANCE_WRITE = "issuance.write"  # create, review, print, correct with reason
    ID_WRITE = "id.write"  # barangay ID create, renew, print
    ACTIVITY_VIEW_OWN = "activity.view_own"
    LOOKUPS_MANAGE = "lookups.manage"  # editable issuance, address and suggestion lists

    # System Administrator only
    USERS_MANAGE = "users.manage"  # user accounts, roles, access
    REGISTRATIONS_REVIEW = "registrations.review"
    OFFICIALS_MANAGE = "officials.manage"
    RECORDS_IMPORT = "records.import"  # import masterlist
    RECORDS_ARCHIVE = "records.archive"
    RECORDS_DECEASED = "records.deceased"  # record, correct and void a death
    ISSUANCE_VOID = "issuance.void"
    ISSUANCE_ARCHIVE = "issuance.archive"  # hide and restore, never delete
    ID_OVERRIDE = "id.override"  # override ID validity rules
    ACTIVITY_VIEW_ALL = "activity.view_all"
    REPORTS_VIEW = "reports.view"
    BACKUP_RESTORE = "backup.restore"
    SYSTEM_UPDATE = "system.update"  # install a new program version from the bell
    SYSTEM_STATUS = "system.status"  # read-only installation status


_STAFF_PERMISSIONS = frozenset(
    {
        Permission.RECORDS_EDIT,
        Permission.ISSUANCE_WRITE,
        Permission.ID_WRITE,
        Permission.ACTIVITY_VIEW_OWN,
        Permission.LOOKUPS_MANAGE,
    }
)

ROLE_PERMISSIONS: dict[UserRole, frozenset[Permission]] = {
    UserRole.staff: _STAFF_PERMISSIONS,
    UserRole.admin: frozenset(Permission),
}


def role_permissions(role: str | None) -> frozenset[Permission]:
    """Permissions for a role value; empty for anything unrecognised."""
    if role is None:
        return frozenset()
    try:
        return ROLE_PERMISSIONS[UserRole(role)]
    except ValueError:
        return frozenset()


def has_permission(user: User, permission: Permission) -> bool:
    return permission in role_permissions(user.role)


def is_admin(user: User) -> bool:
    return user.role == UserRole.admin
