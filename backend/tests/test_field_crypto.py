"""Encryption of the assistance health condition (patch 213)."""

import pytest

from app.core import field_crypto as fc
from app.core.config import settings

KEY = "k" * 48
OTHER_KEY = "o" * 48


def test_round_trip_and_format() -> None:
    stored = fc.encrypt_text("Diabetes, left leg amputated — Ñandú", key=KEY)
    assert stored.startswith(fc.PREFIX)
    assert "Diabetes" not in stored
    assert fc.decrypt_text(stored, key=KEY) == "Diabetes, left leg amputated — Ñandú"
    # A new nonce every time: the same text never gives the same stored value.
    assert stored != fc.encrypt_text("Diabetes, left leg amputated — Ñandú", key=KEY)


def test_wrong_key_damaged_and_plain_values_are_not_read() -> None:
    stored = fc.encrypt_text("secret", key=KEY)
    assert fc.decrypt_text(stored, key=OTHER_KEY) is None
    assert fc.decrypt_text(stored[:-4] + "AAAA", key=KEY) is None
    assert fc.decrypt_text("plain text", key=KEY) is None
    assert fc.decrypt_text(fc.PREFIX + "!!not-base64!!", key=KEY) is None


def test_without_a_key_nothing_is_encrypted_or_read(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY", "")
    assert fc.is_available() is False
    with pytest.raises(fc.DataKeyMissing):
        fc.encrypt_text("x")
    assert fc.decrypt_text(fc.encrypt_text("x", key=KEY)) is None


def test_the_column_type_encrypts_only_when_a_key_is_set(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    column = fc.EncryptedText()
    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY", "")
    assert column.process_bind_param("abc", None) == "abc"
    assert column.process_bind_param(None, None) is None
    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY", KEY)
    stored = column.process_bind_param("abc", None)
    assert stored is not None and stored.startswith(fc.PREFIX)
    assert column.process_result_value(stored, None) == "abc"
    # A value saved before the key existed is returned as it is.
    assert column.process_result_value("old plain text", None) == "old plain text"
    assert column.process_result_value(None, None) is None
    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY", OTHER_KEY)
    assert column.process_result_value(stored, None) == fc.UNREADABLE


def test_a_value_that_starts_like_ciphertext_still_round_trips(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY", KEY)
    column = fc.EncryptedText()
    typed = "enc1:looks-like-ciphertext"
    stored = column.process_bind_param(typed, None)
    assert column.process_result_value(stored, None) == typed


def test_a_short_or_placeholder_key_is_refused() -> None:
    with pytest.raises(ValueError, match="at least 32 bytes"):
        settings.model_copy(update={"DATA_ENCRYPTION_KEY": "short"}).model_validate(
            settings.model_copy(update={"DATA_ENCRYPTION_KEY": "short"}).model_dump()
        )
