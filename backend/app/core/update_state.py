"""What the office computer's update scripts report, and the Update button's request (patch 206).

The program runs in a Docker container and cannot start anything on the Windows
computer, so the two sides talk through three small files in the ``backups``
folder (the folder that is already shared with the container):

- ``update-state.json``  written by ``scripts/auto-update.ps1``: ``state`` is
  ``up_to_date``, ``available``, ``updating`` or ``failed``, with the short
  commit names ``installed`` and ``target``.
- ``update-watcher.json`` written every few seconds by ``scripts/update-watcher.ps1``.
  While it is fresh the watcher is running, so a request will be picked up. A
  computer without the watcher (a development computer, an older installation)
  never shows the Update button.
- ``update-request.json`` written here when an administrator presses Update; the
  watcher runs the update and removes it.

Nothing in these files is a secret. Only a short message from the script (for
example "the download failed") is passed on, and only to administrators.
"""

import json
import os
import re
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from app.core.config import settings

STATE_FILE = "update-state.json"
WATCHER_FILE = "update-watcher.json"
REQUEST_FILE = "update-request.json"

# The watcher writes its file every ~20 seconds; three minutes means it stopped.
WATCHER_FRESH = timedelta(minutes=3)
# An update takes 2 to 10 minutes; a state that still says "updating" after this long
# means the script died, so the Update button must not stay blocked for ever.
UPDATING_STALE = timedelta(minutes=45)
# A state that is older than this was written by a computer that is switched off or
# whose watcher is gone; it is not shown as current.
STATE_STALE = timedelta(days=2)

_STATES = {"up_to_date", "available", "updating", "failed"}
_COMMIT = re.compile(r"^[0-9a-f]{7,40}$")


class UpdateNotPossible(Exception):
    """The request cannot be made now; the message says why in plain words."""


@dataclass(frozen=True)
class UpdateStatus:
    watcher_running: bool
    # unknown | up_to_date | available | updating | failed
    state: str
    installed: str
    target: str
    checked_at: datetime | None
    requested: bool
    message: str


def _folder() -> Path:
    return Path(settings.BACKUP_DIR)


def _read_json(name: str) -> dict[str, Any] | None:
    try:
        raw = (_folder() / name).read_text(encoding="utf-8-sig")
        value = json.loads(raw)
    except OSError, ValueError:
        return None
    return value if isinstance(value, dict) else None


def _when(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    # The scripts write local time with an offset; a bare value is taken as UTC.
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _commit(value: object) -> str:
    text = value if isinstance(value, str) else ""
    return text[:7] if _COMMIT.match(text) else ""


def read_status(now: datetime | None = None) -> UpdateStatus:
    now = now or datetime.now(UTC)
    alive = _when((_read_json(WATCHER_FILE) or {}).get("alive_at"))
    watcher_running = alive is not None and now - alive <= WATCHER_FRESH
    requested = (_folder() / REQUEST_FILE).is_file()

    raw = _read_json(STATE_FILE) or {}
    checked_at = _when(raw.get("checked_at"))
    state = raw.get("state")
    if state not in _STATES or checked_at is None or now - checked_at > STATE_STALE:
        state = "unknown"
    elif state == "updating" and now - checked_at > UPDATING_STALE:
        state = "failed"
    message = raw.get("message")
    return UpdateStatus(
        watcher_running=watcher_running,
        state=str(state),
        installed=_commit(raw.get("installed")),
        target=_commit(raw.get("target")),
        checked_at=checked_at,
        requested=requested,
        message=message[:300] if isinstance(message, str) else "",
    )


def request_update() -> UpdateStatus:
    """Ask the watcher on the computer to install the approved version now."""
    status = read_status()
    if not status.watcher_running:
        raise UpdateNotPossible(
            "The update service of this computer is not running, so the program "
            "cannot be updated from here."
        )
    if status.requested or status.state == "updating":
        raise UpdateNotPossible("An update is already on its way.")
    if status.state != "available":
        raise UpdateNotPossible("There is no new version to install.")
    path = _folder() / REQUEST_FILE
    # Written whole, then renamed, so the watcher never reads half a file.
    temp = path.with_name(f"{REQUEST_FILE}.{uuid.uuid4().hex}.tmp")
    try:
        temp.write_text(
            json.dumps({"requested_at": datetime.now(UTC).isoformat()}),
            encoding="utf-8",
        )
        os.replace(temp, path)
    except OSError as exc:
        temp.unlink(missing_ok=True)
        raise UpdateNotPossible(
            "The update request could not be saved (the backups folder is not writable)."
        ) from exc
    return read_status()
