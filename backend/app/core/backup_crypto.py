"""Encrypt and decrypt backup files with a public key (step 15).

Why a public key: the server computer, and the scheduled task that runs on it,
only ever hold the PUBLIC key (``backup-public.pem``). That is enough to lock a
backup but not to open one. Opening needs the private key file
(``backup-private.pem``, itself locked with the administrator's passphrase) and
that passphrase, which is written on paper and kept sealed. A stolen backup
file, a stolen external drive and a stolen host computer therefore give nobody
the resident data.

File format (``*.dump.enc``), all numbers big-endian::

    magic       7 bytes  b"MAYBK1\\n"
    ephemeral   32 bytes X25519 public key made for this file only
    salt        16 bytes HKDF salt
    prefix       4 bytes start of every chunk nonce
    then chunks, each:  length (4 bytes) + AES-256-GCM ciphertext with its tag

Each chunk is at most 1 MiB of plain data. A chunk's nonce is ``prefix`` plus
its position, and its authenticated data is the header plus a flag that is 1 on
the last chunk, so a reordered, changed or cut-short file fails to decrypt.
The AES key comes from X25519 (ephemeral private key with the server's public
key) through HKDF-SHA256.
"""

import os
import struct
from collections.abc import Iterator
from pathlib import Path

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric.x25519 import (
    X25519PrivateKey,
    X25519PublicKey,
)
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

MAGIC = b"MAYBK1\n"
CHUNK_SIZE = 1024 * 1024
_TAG_SIZE = 16
_HEADER_SIZE = len(MAGIC) + 32 + 16 + 4
MIN_PASSPHRASE_LENGTH = 16
_HKDF_INFO = b"mayondon-backup-v1"


class CryptoError(Exception):
    """Encryption or decryption failed. The message is safe to show."""


def generate_keypair(passphrase: str) -> tuple[bytes, bytes]:
    """Return ``(public_pem, private_pem)``; the private PEM needs the passphrase."""
    if len(passphrase) < MIN_PASSPHRASE_LENGTH:
        raise CryptoError(
            f"The passphrase must be at least {MIN_PASSPHRASE_LENGTH} characters."
        )
    private = X25519PrivateKey.generate()
    public_pem = private.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    )
    private_pem = private.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.BestAvailableEncryption(passphrase.encode("utf-8")),
    )
    return public_pem, private_pem


def load_public_key(path: Path) -> X25519PublicKey:
    try:
        key = serialization.load_pem_public_key(path.read_bytes())
    except (OSError, ValueError) as exc:
        raise CryptoError(f"The backup public key could not be read: {exc}") from exc
    if not isinstance(key, X25519PublicKey):
        raise CryptoError("The backup public key is not an X25519 key.")
    return key


def load_private_key(path: Path, passphrase: str) -> X25519PrivateKey:
    try:
        data = path.read_bytes()
    except OSError as exc:
        raise CryptoError(f"The private key file could not be read: {exc}") from exc
    try:
        key = serialization.load_pem_private_key(data, passphrase.encode("utf-8"))
    except (ValueError, TypeError) as exc:
        raise CryptoError("Wrong passphrase, or this is not the key file.") from exc
    if not isinstance(key, X25519PrivateKey):
        raise CryptoError("The private key is not an X25519 key.")
    return key


def _derive(shared_secret: bytes, salt: bytes) -> AESGCM:
    key = HKDF(algorithm=hashes.SHA256(), length=32, salt=salt, info=_HKDF_INFO).derive(
        shared_secret
    )
    return AESGCM(key)


def _nonce(prefix: bytes, index: int) -> bytes:
    return prefix + struct.pack(">Q", index)


def _chunks(handle) -> Iterator[tuple[bytes, bool]]:  # noqa: ANN001
    """Yield ``(data, is_last)``; always yields at least one chunk."""
    current = handle.read(CHUNK_SIZE)
    while True:
        following = handle.read(CHUNK_SIZE) if len(current) == CHUNK_SIZE else b""
        yield current, not following
        if not following:
            return
        current = following


def encrypt_file(source: Path, destination: Path, public_key: X25519PublicKey) -> None:
    """Write the encrypted copy of ``source`` to ``destination``."""
    ephemeral = X25519PrivateKey.generate()
    ephemeral_public = ephemeral.public_key().public_bytes(
        serialization.Encoding.Raw, serialization.PublicFormat.Raw
    )
    salt = os.urandom(16)
    prefix = os.urandom(4)
    header = MAGIC + ephemeral_public + salt + prefix
    aead = _derive(ephemeral.exchange(public_key), salt)
    with source.open("rb") as reader, destination.open("wb") as writer:
        writer.write(header)
        for index, (data, last) in enumerate(_chunks(reader)):
            sealed = aead.encrypt(
                _nonce(prefix, index), data, header + (b"\x01" if last else b"\x00")
            )
            writer.write(struct.pack(">I", len(sealed)) + sealed)


def _read_header(handle) -> bytes:  # noqa: ANN001
    header = handle.read(_HEADER_SIZE)
    if len(header) != _HEADER_SIZE or not header.startswith(MAGIC):
        raise CryptoError("This is not an encrypted Mayondon backup.")
    return header


def decrypt_file(
    source: Path, destination: Path | None, private_key: X25519PrivateKey
) -> int:
    """Decrypt ``source`` to ``destination`` (``None`` = only check). Returns bytes."""
    total = 0
    size = source.stat().st_size
    complete = False
    writer = destination.open("wb") if destination else None
    try:
        with source.open("rb") as reader:
            header = _read_header(reader)
            ephemeral_public = X25519PublicKey.from_public_bytes(
                header[len(MAGIC) : len(MAGIC) + 32]
            )
            salt = header[len(MAGIC) + 32 : len(MAGIC) + 48]
            prefix = header[len(MAGIC) + 48 :]
            aead = _derive(private_key.exchange(ephemeral_public), salt)
            index = 0
            while True:
                raw = reader.read(4)
                if not raw:
                    raise CryptoError("The backup file is cut short.")
                if len(raw) != 4:
                    raise CryptoError("The backup file is damaged.")
                (length,) = struct.unpack(">I", raw)
                if length < _TAG_SIZE or length > CHUNK_SIZE + _TAG_SIZE:
                    raise CryptoError("The backup file is damaged.")
                sealed = reader.read(length)
                if len(sealed) != length:
                    raise CryptoError("The backup file is cut short.")
                last = reader.tell() >= size
                try:
                    data = aead.decrypt(
                        _nonce(prefix, index),
                        sealed,
                        header + (b"\x01" if last else b"\x00"),
                    )
                except InvalidTag as exc:
                    raise CryptoError(
                        "The backup could not be decrypted: wrong key, or the file "
                        "was changed or damaged."
                    ) from exc
                total += len(data)
                if writer:
                    writer.write(data)
                if last:
                    complete = True
                    return total
                index += 1
    finally:
        if writer:
            writer.close()
            if not complete and destination:
                destination.unlink(missing_ok=True)


def check_structure(path: Path) -> None:
    """Check the header and chunk framing WITHOUT the key (cannot prove the data)."""
    try:
        size = path.stat().st_size
        with path.open("rb") as handle:
            _read_header(handle)
            position = _HEADER_SIZE
            chunks = 0
            while position < size:
                raw = handle.read(4)
                if len(raw) != 4:
                    raise CryptoError("The backup file is damaged.")
                (length,) = struct.unpack(">I", raw)
                if length < _TAG_SIZE or length > CHUNK_SIZE + _TAG_SIZE:
                    raise CryptoError("The backup file is damaged.")
                position += 4 + length
                handle.seek(position)
                chunks += 1
            if position != size or chunks == 0:
                raise CryptoError("The backup file is cut short or damaged.")
    except OSError as exc:
        raise CryptoError(f"The backup file could not be read: {exc}") from exc
