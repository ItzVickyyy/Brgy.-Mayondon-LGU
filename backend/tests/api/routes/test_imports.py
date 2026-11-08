"""Masterlist import (D-19): upload, mapping, checks, duplicates, commit, audit.

All data is fictional and built in memory; no real names or spreadsheets.
"""

import io
import uuid
import zipfile
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook
from sqlalchemy import update
from sqlmodel import Session, col, select

from app.api.routes import imports as imports_route
from app.core import masterlist_import as mi
from app.core.config import settings
from app.core.db import engine
from app.models_foundation import AuditLog, Street
from app.models_import import ImportBatch, ImportRow
from app.models_residents import Resident

API = f"{settings.API_V1_STR}/imports"

HEADERS = [
    "First Name",
    "Last Name",
    "Middle Name",
    "Birthdate",
    "Sex",
    "Civil Status",
    "Street",
    "Purok",
    "ID Number",
]


def _tag() -> str:
    return uuid.uuid4().hex[:8].capitalize()


def _csv(rows: list[list[str]], headers: list[str] | None = None) -> bytes:
    lines = [",".join(headers or HEADERS)]
    lines += [",".join(r) for r in rows]
    return ("\n".join(lines) + "\n").encode()


def _upload(
    client: TestClient,
    headers: dict[str, str],
    content: bytes,
    name: str = "list.csv",
) -> Any:
    return client.post(API + "/", headers=headers, files={"file": (name, content)})


def _map(
    client: TestClient,
    headers: dict[str, str],
    batch: dict[str, Any],
    **extra: Any,
) -> Any:
    body = {"mapping": batch["suggested_mapping"], **extra}
    return client.put(f"{API}/{batch['id']}/mapping", headers=headers, json=body)


def _rows(client: TestClient, headers: dict[str, str], batch_id: str, **q: Any) -> Any:
    r = client.get(f"{API}/{batch_id}/rows", headers=headers, params=q)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture
def street(db: Session) -> Street:
    item = Street(name=f"Import Street {_tag()}")
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def _audit(action: str, record_id: str) -> list[AuditLog]:
    with Session(engine) as session:
        return list(
            session.exec(
                select(AuditLog).where(
                    col(AuditLog.action) == action,
                    col(AuditLog.record_id) == record_id,
                )
            ).all()
        )


def test_staff_cannot_use_imports(
    client: TestClient, staff_token_headers: dict[str, str]
) -> None:
    assert client.get(API + "/", headers=staff_token_headers).status_code == 403
    r = _upload(
        client, staff_token_headers, _csv([["Ana", "Test", "", "", "", "", "", "", ""]])
    )
    assert r.status_code == 403
    assert client.get(API + "/").status_code == 401


def test_upload_suggests_mapping_and_stages_rows(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    last = _tag()
    r = _upload(
        client,
        superuser_token_headers,
        _csv(
            [
                ["Ana", last, "", "1990-05-03", "F", "single", "", "", ""],
                ["Ben", last, "", "", "", "", "", "", ""],
            ]
        ),
    )
    assert r.status_code == 201, r.text
    batch = r.json()
    assert batch["status"] == "uploaded"
    assert batch["total_rows"] == 2
    assert batch["suggested_mapping"]["First Name"] == "first_name"
    assert batch["suggested_mapping"]["Last Name"] == "last_name"
    assert batch["suggested_mapping"]["Civil Status"] == "civil_status"
    assert len(batch["sample_rows"]) == 2
    assert _audit("import.upload", batch["id"])
    # Residents are untouched until commit.
    with Session(engine) as session:
        assert (
            session.exec(select(Resident).where(Resident.last_name == last)).first()
            is None
        )


@pytest.mark.parametrize(
    ("name", "content", "message"),
    [
        ("a.txt", b"x", "Only .csv and .xlsx"),
        ("macro.xlsm", b"x", "Only .csv and .xlsx"),
        ("a.csv", b"", "empty"),
        ("a.csv", b"First Name,Last Name\n", "no data rows"),
        ("a.csv", b"First Name,first name\nA,B\n", "same title"),
        ("a.csv", b"\x00\x01\x02", "CSV"),
        ("a.xlsx", b"not a zip", "valid .xlsx"),
    ],
)
def test_bad_files_are_rejected(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    name: str,
    content: bytes,
    message: str,
) -> None:
    r = _upload(client, superuser_token_headers, content, name)
    assert r.status_code == 422
    assert message in r.json()["detail"]


def test_file_over_size_limit_is_rejected(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    big = b"First Name,Last Name\n" + b"A,B\n" * (mi.MAX_FILE_BYTES // 4 + 10)
    r = _upload(client, superuser_token_headers, big)
    assert r.status_code == 422
    assert "5 MB" in r.json()["detail"]


def test_row_limit(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(mi, "MAX_ROWS", 2)
    content = _csv([[f"N{i}", "L", "", "", "", "", "", "", ""] for i in range(3)])
    r = _upload(client, superuser_token_headers, content)
    assert r.status_code == 422
    assert "more than 2 rows" in r.json()["detail"]


def test_xlsx_upload_reads_dates_and_numbers(
    client: TestClient, superuser_token_headers: dict[str, str], street: Street
) -> None:
    last = _tag()
    book = Workbook()
    sheet = book.active
    assert sheet is not None
    sheet.append(HEADERS)
    sheet.append(
        [
            "Cara",
            last,
            None,
            datetime(1985, 12, 24),
            "Female",
            "Married",
            street.name,
            3.0,
            None,
        ]
    )
    buffer = io.BytesIO()
    book.save(buffer)
    r = _upload(client, superuser_token_headers, buffer.getvalue(), "list.xlsx")
    assert r.status_code == 201, r.text
    batch = r.json()
    assert batch["file_type"] == "xlsx"
    assert batch["sample_rows"][0]["Birthdate"] == "1985-12-24"
    assert batch["sample_rows"][0]["Purok"] == "3"
    assert _map(client, superuser_token_headers, batch).json()["counts"] == {
        "new": 1,
        "duplicate": 0,
        "error": 0,
    }


def test_xlsx_with_macros_is_rejected(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("xl/vbaProject.bin", b"x")
        archive.writestr("[Content_Types].xml", "<x/>")
    r = _upload(client, superuser_token_headers, buffer.getvalue(), "list.xlsx")
    assert r.status_code == 422
    assert "macros" in r.json()["detail"]


def test_mapping_rules(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    batch = _upload(
        client,
        superuser_token_headers,
        _csv([["Ana", _tag(), "", "", "", "", "", "", ""]]),
    ).json()
    url = f"{API}/{batch['id']}/mapping"

    def put(mapping: dict[str, str]) -> Any:
        return client.put(
            url, headers=superuser_token_headers, json={"mapping": mapping}
        )

    assert put({"First Name": "first_name"}).status_code == 422  # last name missing
    assert put({"Nope": "first_name", "Last Name": "last_name"}).status_code == 422
    assert put({"First Name": "first_name", "Last Name": "nonsense"}).status_code == 422
    assert (
        put({"First Name": "first_name", "Last Name": "first_name"}).status_code == 422
    )
    assert (
        put({"First Name": "first_name", "Last Name": "last_name"}).status_code == 200
    )


def test_validation_uses_resident_rules_and_hides_values(
    client: TestClient, superuser_token_headers: dict[str, str], street: Street
) -> None:
    last = _tag()
    future = (datetime.now(UTC) + timedelta(days=400)).strftime("%Y-%m-%d")
    content = _csv(
        [
            [
                "Good",
                last,
                "",
                "1990-01-31",
                "male",
                "widowed",
                street.name.upper(),
                "2",
                "",
            ],
            ["Futura", last, "", future, "", "", "", "", ""],
            ["Bad", last, "", "31st of never", "robot", "", "No Such Street", "0", ""],
            ["", last, "", "", "", "", "", "", ""],
        ]
    )
    batch = _upload(client, superuser_token_headers, content).json()
    done = _map(client, superuser_token_headers, batch).json()
    assert done["status"] == "mapped"
    assert done["counts"] == {"new": 1, "duplicate": 0, "error": 3}

    rows = {
        r["row_number"]: r
        for r in _rows(client, superuser_token_headers, batch["id"])["data"]
    }
    good = rows[2]
    assert good["classification"] == "new"
    assert good["mapped"]["sex"] == "Male"
    assert good["mapped"]["civil_status"] == "Widow/Widower"
    assert good["mapped"]["street_id"] == street.id
    assert good["mapped"]["birthdate"] == "1990-01-31"
    assert any("future" in e["message"] for e in rows[3]["errors"])
    bad_fields = {e["field"] for e in rows[4]["errors"]}
    assert {"birthdate", "sex", "street", "purok"} <= bad_fields
    assert {e["field"] for e in rows[5]["errors"]} == {"first_name"}
    # No error text repeats what was typed in the file.
    for row in rows.values():
        for error in row["errors"]:
            assert "robot" not in error["message"]
            assert "never" not in error["message"]
            assert "No Such Street" not in error["message"]

    only_errors = _rows(
        client, superuser_token_headers, batch["id"], classification="error"
    )
    assert only_errors["count"] == 3


def test_date_order_setting(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    content = _csv([["Dee", _tag(), "", "05/03/1990", "", "", "", "", ""]])
    batch = _upload(client, superuser_token_headers, content).json()
    _map(client, superuser_token_headers, batch, date_order="mdy")
    row = _rows(client, superuser_token_headers, batch["id"])["data"][0]
    assert row["mapped"]["birthdate"] == "1990-05-03"
    _map(client, superuser_token_headers, batch, date_order="dmy")
    row = _rows(client, superuser_token_headers, batch["id"])["data"][0]
    assert row["mapped"]["birthdate"] == "1990-03-05"
    _map(client, superuser_token_headers, batch, date_order="ymd")
    row = _rows(client, superuser_token_headers, batch["id"])["data"][0]
    assert row["classification"] == "error"


def test_duplicates_in_file_and_in_database(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    staff_token_headers: dict[str, str],
) -> None:
    last = _tag()
    existing = client.post(
        f"{settings.API_V1_STR}/residents/",
        headers=staff_token_headers,
        json={"first_name": "Eli", "last_name": last, "birthdate": "1980-02-02"},
    )
    assert existing.status_code == 201, existing.text
    content = _csv(
        [
            ["eli", last.upper(), "", "1980-02-02", "", "", "", "", ""],  # in database
            ["Fay", last, "", "1991-01-01", "", "", "", "", ""],  # new
            ["FAY", last, "", "1991-01-01", "", "", "", "", ""],  # again in file
            [
                "Gus",
                last,
                "",
                "",
                "",
                "",
                "",
                "",
                "",
            ],  # no birthdate: never a duplicate
            ["Gus", last, "", "", "", "", "", "", ""],
        ]
    )
    batch = _upload(client, superuser_token_headers, content).json()
    done = _map(client, superuser_token_headers, batch).json()
    assert done["counts"] == {"new": 3, "duplicate": 2, "error": 0}
    rows = {
        r["row_number"]: r
        for r in _rows(client, superuser_token_headers, batch["id"])["data"]
    }
    assert rows[2]["duplicate_scope"] == "existing"
    assert rows[2]["duplicate_resident_id"] == existing.json()["id"]
    assert rows[4]["duplicate_scope"] == "file"


def test_commit_creates_new_and_skips_duplicates_by_default(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    staff_token_headers: dict[str, str],
    street: Street,
) -> None:
    last = _tag()
    client.post(
        f"{settings.API_V1_STR}/residents/",
        headers=staff_token_headers,
        json={
            "first_name": "Hal",
            "last_name": last,
            "birthdate": "1970-07-07",
            "purok": 1,
        },
    )
    content = _csv(
        [
            ["Hal", last, "", "1970-07-07", "", "", "", "4", ""],
            ["Ira", last, "Q", "1999-09-09", "Female", "Single", street.name, "2", ""],
            ["Jo", last, "", "bad date", "", "", "", "", ""],
        ]
    )
    batch = _upload(client, superuser_token_headers, content).json()
    _map(client, superuser_token_headers, batch)
    r = client.post(f"{API}/{batch['id']}/commit", headers=superuser_token_headers)
    assert r.status_code == 200, r.text
    done = r.json()
    assert done["status"] == "committed"
    assert done["result"] == {"created": 1, "updated": 0, "skipped": 1, "failed": 1}

    with Session(engine) as session:
        people = {
            p.first_name: p
            for p in session.exec(
                select(Resident).where(Resident.last_name == last)
            ).all()
        }
        assert set(people) == {"Hal", "Ira"}
        assert people["Hal"].purok == 1  # skipped, unchanged
        ira = people["Ira"]
        assert (ira.sex, ira.civil_status, ira.street_id, ira.purok) == (
            "Female",
            "Single",
            street.id,
            2,
        )
        assert ira.created_by_user_id is not None

    # Personal data is gone from staging; reasons and numbers remain.
    with Session(engine) as session:
        staged = session.exec(
            select(ImportRow).where(ImportRow.batch_id == uuid.UUID(batch["id"]))
        ).all()
        assert len(staged) == 3
        assert all(r.raw is None and r.mapped is None for r in staged)
        assert {r.outcome for r in staged} == {"created", "skipped", "failed"}

    # Audit holds counts and the file name, not names.
    events = _audit("import.commit", batch["id"])
    assert len(events) == 1
    assert events[0].details == {
        "file_name": "list.csv",
        "created": 1,
        "updated": 0,
        "skipped": 1,
        "failed": 1,
    }
    assert last not in str(events[0].details)

    # A finished batch cannot be committed or changed again.
    again = client.post(f"{API}/{batch['id']}/commit", headers=superuser_token_headers)
    assert again.status_code == 409
    assert _map(client, superuser_token_headers, batch).status_code == 409

    report = client.get(
        f"{API}/{batch['id']}/errors.csv", headers=superuser_token_headers
    )
    assert report.status_code == 200
    assert "Row,Field,Problem" in report.text
    assert "birthdate" in report.text
    assert last not in report.text


def test_update_action_fills_in_fields_but_not_blanks(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    staff_token_headers: dict[str, str],
    street: Street,
) -> None:
    last = _tag()
    made = client.post(
        f"{settings.API_V1_STR}/residents/",
        headers=staff_token_headers,
        json={
            "first_name": "Kim",
            "last_name": last,
            "birthdate": "1975-05-05",
            "purok": 1,
            "birth_place": "Keep Town",
            "resident_since_birth": True,
        },
    ).json()
    archived = client.post(
        f"{settings.API_V1_STR}/residents/",
        headers=staff_token_headers,
        json={"first_name": "Lou", "last_name": last, "birthdate": "1960-06-06"},
    ).json()
    client.post(
        f"{settings.API_V1_STR}/residents/{archived['id']}/archive",
        headers=superuser_token_headers,
        json={"reason": "moved away"},
    )
    content = _csv(
        [
            ["Kim", last, "", "1975-05-05", "Female", "", street.name, "", ""],
            ["Lou", last, "", "1960-06-06", "Male", "", "", "", ""],
        ]
    )
    batch = _upload(client, superuser_token_headers, content).json()
    _map(client, superuser_token_headers, batch, duplicate_action="update")
    done = client.post(
        f"{API}/{batch['id']}/commit", headers=superuser_token_headers
    ).json()
    assert done["result"] == {"created": 0, "updated": 1, "skipped": 1, "failed": 0}
    with Session(engine) as session:
        kim = session.get(Resident, uuid.UUID(made["id"]))
        assert kim is not None
        assert kim.sex == "Female"
        assert kim.street_id == street.id
        assert kim.purok == 1  # blank cell in the file did not erase it
        assert kim.birth_place == "Keep Town"
        lou = session.get(Resident, uuid.UUID(archived["id"]))
        assert lou is not None
        assert lou.sex is None  # archived records are never changed by an import


def test_id_number_conflicts_are_errors(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    staff_token_headers: dict[str, str],
) -> None:
    last = _tag()
    number = f"MAY-{uuid.uuid4().hex[:8].upper()}"
    client.post(
        f"{settings.API_V1_STR}/residents/",
        headers=staff_token_headers,
        json={"first_name": "Max", "last_name": last, "id_number": number},
    )
    fresh = f"MAY-{uuid.uuid4().hex[:8].upper()}"
    content = _csv(
        [
            ["Nia", last, "", "", "", "", "", "", number],  # held by someone else
            ["Oz", last, "", "", "", "", "", "", fresh],
            ["Pat", last, "", "", "", "", "", "", fresh],  # twice in the file
        ]
    )
    batch = _upload(client, superuser_token_headers, content).json()
    done = _map(client, superuser_token_headers, batch).json()
    assert done["counts"] == {"new": 1, "duplicate": 0, "error": 2}


def test_commit_needs_a_checked_mapping(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    batch = _upload(
        client,
        superuser_token_headers,
        _csv([["Quin", _tag(), "", "", "", "", "", "", ""]]),
    ).json()
    r = client.post(f"{API}/{batch['id']}/commit", headers=superuser_token_headers)
    assert r.status_code == 409


def test_commit_rechecks_so_a_stale_preview_is_not_imported(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    staff_token_headers: dict[str, str],
) -> None:
    last = _tag()
    content = _csv([["Rae", last, "", "1988-08-08", "", "", "", "", ""]])
    batch = _upload(client, superuser_token_headers, content).json()
    assert _map(client, superuser_token_headers, batch).json()["counts"]["new"] == 1
    # Someone adds the same person after the preview.
    client.post(
        f"{settings.API_V1_STR}/residents/",
        headers=staff_token_headers,
        json={"first_name": "Rae", "last_name": last, "birthdate": "1988-08-08"},
    )
    done = client.post(
        f"{API}/{batch['id']}/commit", headers=superuser_token_headers
    ).json()
    assert done["result"] == {"created": 0, "updated": 0, "skipped": 1, "failed": 0}
    with Session(engine) as session:
        count = len(
            session.exec(select(Resident).where(Resident.last_name == last)).all()
        )
    assert count == 1


def test_failed_write_rolls_back_the_whole_batch(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    last = _tag()
    content = _csv(
        [
            ["Sol", last, "", "", "", "", "", "", ""],
            ["Tia", last, "", "", "", "", "", "", ""],
        ]
    )
    batch = _upload(client, superuser_token_headers, content).json()
    _map(client, superuser_token_headers, batch)

    original = imports_route._apply_batch

    def explode(session: Session, batch: ImportBatch, user: Any) -> dict[str, int]:
        original(session, batch, user)
        raise RuntimeError("disk full")

    monkeypatch.setattr(imports_route, "_apply_batch", explode)
    r = client.post(f"{API}/{batch['id']}/commit", headers=superuser_token_headers)
    assert r.status_code == 500
    assert "nothing was saved" in r.json()["detail"]
    assert "disk full" not in r.text
    with Session(engine) as session:
        assert (
            session.exec(select(Resident).where(Resident.last_name == last)).first()
            is None
        )
        stored = session.get(ImportBatch, uuid.UUID(batch["id"]))
        assert stored is not None
        assert stored.status == "failed"
    failures = [
        e for e in _audit("import.commit", batch["id"]) if e.outcome == "failed"
    ]
    assert len(failures) == 1


def test_cancel_wipes_staged_data(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    batch = _upload(
        client,
        superuser_token_headers,
        _csv([["Uma", _tag(), "", "", "", "", "", "", ""]]),
    ).json()
    r = client.delete(f"{API}/{batch['id']}", headers=superuser_token_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled"
    rows = _rows(client, superuser_token_headers, batch["id"])
    assert rows["data"][0]["raw"] is None
    assert (
        client.delete(
            f"{API}/{batch['id']}", headers=superuser_token_headers
        ).status_code
        == 409
    )
    assert _audit("import.cancel", batch["id"])


def test_unfinished_batches_expire(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    batch = _upload(
        client,
        superuser_token_headers,
        _csv([["Vic", _tag(), "", "", "", "", "", "", ""]]),
    ).json()
    old = datetime.now(UTC) - timedelta(hours=imports_route.STAGING_HOURS + 1)
    db.execute(
        update(ImportBatch)
        .where(col(ImportBatch.id) == uuid.UUID(batch["id"]))
        .values(created_at=old)
    )
    db.commit()
    # Listing runs the cleanup (the batch is old, so read it back by id).
    assert client.get(API + "/", headers=superuser_token_headers).status_code == 200
    read = client.get(f"{API}/{batch['id']}", headers=superuser_token_headers)
    assert read.json()["status"] == "expired"
    assert _rows(client, superuser_token_headers, batch["id"])["data"][0]["raw"] is None


def test_previous_mapping_is_suggested_next_time(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    odd = ["Pangalan", "Apelyido", "Kaarawan"]
    first = _upload(
        client,
        superuser_token_headers,
        _csv([["Wil", "Xu", "1990-01-01"]], headers=odd),
    ).json()
    assert first["suggested_mapping"] == {}
    mapping = {
        "Pangalan": "first_name",
        "Apelyido": "last_name",
        "Kaarawan": "birthdate",
    }
    r = client.put(
        f"{API}/{first['id']}/mapping",
        headers=superuser_token_headers,
        json={"mapping": mapping},
    )
    assert r.status_code == 200
    second = _upload(
        client,
        superuser_token_headers,
        _csv([["Yan", "Zed", "1991-01-01"]], headers=odd),
    ).json()
    assert second["suggested_mapping"] == mapping
