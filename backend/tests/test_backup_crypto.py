"""Backup encryption: the file format, the key pair and the command line."""

import os
from pathlib import Path

import pytest

from app import backup_cli
from app.core import backup_crypto as crypto
from app.core.config import settings

PASSPHRASE = "correct horse battery staple"


@pytest.fixture
def keys(tmp_path: Path) -> tuple[Path, Path]:
    public_pem, private_pem = crypto.generate_keypair(PASSPHRASE)
    public = tmp_path / "backup-public.pem"
    private = tmp_path / "backup-private.pem"
    public.write_bytes(public_pem)
    private.write_bytes(private_pem)
    return public, private


def _encrypt(tmp_path: Path, keys: tuple[Path, Path], data: bytes) -> Path:
    plain = tmp_path / "plain.dump"
    plain.write_bytes(data)
    sealed = tmp_path / "plain.dump.enc"
    crypto.encrypt_file(plain, sealed, crypto.load_public_key(keys[0]))
    return sealed


@pytest.mark.parametrize(
    "size", [0, 1, crypto.CHUNK_SIZE - 1, crypto.CHUNK_SIZE, 2 * crypto.CHUNK_SIZE + 7]
)
def test_round_trip_for_every_chunk_boundary(
    tmp_path: Path, keys: tuple[Path, Path], size: int
) -> None:
    data = os.urandom(size)
    sealed = _encrypt(tmp_path, keys, data)
    if size >= 32:
        assert data not in sealed.read_bytes()
    out = tmp_path / "out.dump"
    private = crypto.load_private_key(keys[1], PASSPHRASE)
    assert crypto.decrypt_file(sealed, out, private) == size
    assert out.read_bytes() == data
    crypto.check_structure(sealed)


def test_the_public_key_cannot_open_a_backup_and_a_wrong_passphrase_fails(
    tmp_path: Path, keys: tuple[Path, Path]
) -> None:
    with pytest.raises(crypto.CryptoError, match="Wrong passphrase"):
        crypto.load_private_key(keys[1], "not the right passphrase!!")
    with pytest.raises(crypto.CryptoError):
        crypto.load_private_key(keys[0], PASSPHRASE)
    other_public, other_private = crypto.generate_keypair(PASSPHRASE)
    stranger = tmp_path / "other.pem"
    stranger.write_bytes(other_private)
    sealed = _encrypt(tmp_path, keys, b"resident data")
    with pytest.raises(crypto.CryptoError, match="could not be decrypted"):
        crypto.decrypt_file(
            sealed, tmp_path / "x", crypto.load_private_key(stranger, PASSPHRASE)
        )
    assert not (tmp_path / "x").exists()
    assert other_public


def test_changed_cut_short_and_reordered_files_are_refused(
    tmp_path: Path, keys: tuple[Path, Path]
) -> None:
    private = crypto.load_private_key(keys[1], PASSPHRASE)
    sealed = _encrypt(tmp_path, keys, os.urandom(2 * crypto.CHUNK_SIZE + 5))
    original = sealed.read_bytes()

    flipped = bytearray(original)
    flipped[200] ^= 0x01
    sealed.write_bytes(bytes(flipped))
    with pytest.raises(crypto.CryptoError):
        crypto.decrypt_file(sealed, None, private)

    # Cut after the first chunk: the structure looks fine, the data must not.
    first_chunk_end = 59 + 4 + crypto.CHUNK_SIZE + 16
    sealed.write_bytes(original[:first_chunk_end])
    crypto.check_structure(sealed)
    with pytest.raises(crypto.CryptoError):
        crypto.decrypt_file(sealed, tmp_path / "partial", private)
    assert not (tmp_path / "partial").exists()

    sealed.write_bytes(original[:-3])
    with pytest.raises(crypto.CryptoError):
        crypto.check_structure(sealed)
    sealed.write_bytes(b"PGDMP not encrypted at all, long enough to hold a header....")
    with pytest.raises(crypto.CryptoError, match="not an encrypted"):
        crypto.check_structure(sealed)


def test_short_passphrases_are_refused() -> None:
    with pytest.raises(crypto.CryptoError, match="at least"):
        crypto.generate_keypair("too short")


def test_command_line_key_set_up_and_decrypt(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    public = tmp_path / "keys" / "backup-public.pem"
    monkeypatch.setattr(settings, "BACKUP_PUBLIC_KEY_FILE", str(public))
    monkeypatch.setenv("BACKUP_PASSPHRASE", PASSPHRASE)
    assert backup_cli.main(["make-key"]) == 0
    private = public.with_name("backup-private.pem")
    assert public.is_file() and private.is_file()
    assert "Write the passphrase on paper" in capsys.readouterr().out
    # A second run never replaces an existing key.
    assert backup_cli.main(["make-key"]) == 2

    sealed = tmp_path / "b.dump.enc"
    plain = tmp_path / "b.dump"
    plain.write_bytes(b"PGDMP-fake")
    crypto.encrypt_file(plain, sealed, crypto.load_public_key(public))
    assert (
        backup_cli.main(
            ["decrypt", "--in", str(sealed), "--key", str(private), "--check"]
        )
        == 0
    )
    out = tmp_path / "restored.dump"
    assert (
        backup_cli.main(
            ["decrypt", "--in", str(sealed), "--key", str(private), "--out", str(out)]
        )
        == 0
    )
    assert out.read_bytes() == b"PGDMP-fake"

    monkeypatch.setenv("BACKUP_PASSPHRASE", "a different passphrase entirely")
    assert (
        backup_cli.main(
            ["decrypt", "--in", str(sealed), "--key", str(private), "--check"]
        )
        == 1
    )
