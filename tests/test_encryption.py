"""Tests for backend/utils/encryption.py."""
import pytest
from unittest.mock import patch
from cryptography.fernet import InvalidToken


def test_encrypt_decrypt_roundtrip():
    from backend.utils.encryption import decrypt, encrypt
    plain = "my-secret-refresh-token"
    assert decrypt(encrypt(plain)) == plain


def test_different_inputs_produce_different_output():
    from backend.utils.encryption import encrypt
    assert encrypt("token_a") != encrypt("token_b")


def test_different_texts_produce_different_ciphertext():
    from backend.utils.encryption import encrypt
    ct1 = encrypt("hello")
    ct2 = encrypt("world")
    assert ct1 != ct2


def test_decrypt_with_wrong_key_raises():
    from backend.utils.encryption import encrypt

    encrypted = encrypt("sensitive")

    # Patch settings to use a different key so decryption fails
    with patch("backend.utils.encryption.settings") as mock_settings:
        mock_settings.app_secret_key = "completely-different-key"
        from backend.utils.encryption import decrypt
        with pytest.raises(InvalidToken):
            decrypt(encrypted)


def test_empty_string_encrypt_decrypt():
    from backend.utils.encryption import decrypt, encrypt
    assert decrypt(encrypt("")) == ""
