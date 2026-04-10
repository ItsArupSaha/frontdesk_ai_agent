"""
Encrypt and decrypt sensitive strings for DB storage.
Key is derived from APP_SECRET_KEY in settings.
"""
import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from backend.config import settings


def _get_fernet() -> Fernet:
    """Derive a Fernet instance from APP_SECRET_KEY."""
    key = hashlib.sha256(settings.app_secret_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt(plain_text: str) -> str:
    """Encrypt a plaintext string. Returns encrypted string safe to store in DB."""
    f = _get_fernet()
    return f.encrypt(plain_text.encode()).decode()


def decrypt(encrypted_text: str) -> str:
    """Decrypt an encrypted string retrieved from DB.

    Raises:
        cryptography.fernet.InvalidToken: if the key is wrong or data is corrupt.
    """
    f = _get_fernet()
    return f.decrypt(encrypted_text.encode()).decode()
