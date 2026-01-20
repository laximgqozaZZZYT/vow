"""
Token Encryption Utility

Provides secure encryption/decryption for sensitive tokens using Fernet.
"""

import os
import base64
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken


class TokenEncryption:
    """Handles encryption and decryption of sensitive tokens."""

    def __init__(self, encryption_key: Optional[str] = None):
        """
        Initialize with encryption key.
        
        Args:
            encryption_key: Base64-encoded 32-byte key. If not provided,
                           reads from TOKEN_ENCRYPTION_KEY environment variable.
        """
        key = encryption_key or os.environ.get("TOKEN_ENCRYPTION_KEY")
        
        if not key:
            raise ValueError(
                "TOKEN_ENCRYPTION_KEY environment variable must be set. "
                "Generate one with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
            )
        
        # Ensure key is bytes
        if isinstance(key, str):
            key = key.encode()
        
        self.fernet = Fernet(key)

    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt a plaintext string.
        
        Args:
            plaintext: The string to encrypt
            
        Returns:
            Base64-encoded encrypted string
        """
        if not plaintext:
            return ""
        
        encrypted = self.fernet.encrypt(plaintext.encode())
        return encrypted.decode()

    def decrypt(self, ciphertext: str) -> str:
        """
        Decrypt an encrypted string.
        
        Args:
            ciphertext: Base64-encoded encrypted string
            
        Returns:
            Decrypted plaintext string
            
        Raises:
            InvalidToken: If decryption fails (wrong key or corrupted data)
        """
        if not ciphertext:
            return ""
        
        decrypted = self.fernet.decrypt(ciphertext.encode())
        return decrypted.decode()

    def encrypt_if_present(self, value: Optional[str]) -> Optional[str]:
        """Encrypt value if it's not None or empty."""
        if value:
            return self.encrypt(value)
        return value

    def decrypt_if_present(self, value: Optional[str]) -> Optional[str]:
        """Decrypt value if it's not None or empty."""
        if value:
            try:
                return self.decrypt(value)
            except InvalidToken:
                # Return None if decryption fails
                return None
        return value


# Singleton instance for convenience
_encryption_instance: Optional[TokenEncryption] = None


def get_encryption() -> TokenEncryption:
    """Get or create the singleton encryption instance."""
    global _encryption_instance
    if _encryption_instance is None:
        _encryption_instance = TokenEncryption()
    return _encryption_instance


def encrypt_token(plaintext: str) -> str:
    """Convenience function to encrypt a token."""
    return get_encryption().encrypt(plaintext)


def decrypt_token(ciphertext: str) -> str:
    """Convenience function to decrypt a token."""
    return get_encryption().decrypt(ciphertext)


def generate_encryption_key() -> str:
    """Generate a new Fernet encryption key."""
    return Fernet.generate_key().decode()
