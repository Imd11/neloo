"""
Storage Module

Provides unified storage interface for images and files.
Supports both local storage (development) and Supabase Storage (production/E2B).
"""

from .image_storage import (
    ImageStorage,
    get_image_storage,
    save_image,
    save_image_base64,
    get_image,
    get_image_url,
    cleanup_old_images,
    verify_url_signature,
    IMAGE_STORAGE_DIR,
    IMAGE_BUCKET_NAME,
)

__all__ = [
    "ImageStorage",
    "get_image_storage",
    "save_image",
    "save_image_base64",
    "get_image",
    "get_image_url",
    "cleanup_old_images",
    "verify_url_signature",
    "IMAGE_STORAGE_DIR",
    "IMAGE_BUCKET_NAME",
]
