"""Small, privacy-conscious audit events for administrative writes."""

import json
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

logger = logging.getLogger("app.audit")


def record_admin_action(
    *,
    actor_id: UUID,
    action: str,
    target_type: str,
    target_id: UUID | str,
) -> None:
    """Write a structured audit event without recording personal field values."""
    event: dict[str, Any] = {
        "event": "admin_action",
        "timestamp": datetime.now(UTC).isoformat(),
        "actor_id": str(actor_id),
        "action": action,
        "target_type": target_type,
        "target_id": str(target_id),
    }
    logger.info(json.dumps(event, separators=(",", ":")))
