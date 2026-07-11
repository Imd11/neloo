"""
Storage Module

Provides unified storage interface for images and files.
Supports both local storage (development) and Supabase Storage (production/E2B).
"""

from .file_storage import (
    FILE_BUCKET_NAME,
    FILE_STORAGE_DIR,
    GeneratedFileStorage,
    cleanup_old_generated_files,
    get_file_storage,
    get_generated_file,
    list_generated_files,
    save_generated_file,
)
from .image_storage import (
    IMAGE_BUCKET_NAME,
    IMAGE_STORAGE_DIR,
    ImageStorage,
    cleanup_old_images,
    get_image,
    get_image_storage,
    get_image_url,
    save_image,
    save_image_base64,
    verify_url_signature,
)
from .supabase_db import (
    USE_SUPABASE_DB,
    FileType,
    count_file_thread_links,
    create_thread,
    create_thread_file_link,
    create_thread_file_link_sync,
    delete_file_record,
    delete_thread_file_link,
    get_file_by_id,
    get_files_by_type,
    get_thread_by_langgraph_id,
    get_thread_files,
    get_user_files,
    get_user_threads,
    save_file_record,
    save_file_record_sync,
    update_thread_title,
)

__all__ = [
    # Image storage
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
    # Supabase DB operations
    "save_file_record",
    "save_file_record_sync",
    "create_thread_file_link",
    "create_thread_file_link_sync",
    "get_files_by_type",
    "get_user_files",
    "get_thread_files",
    "get_file_by_id",
    "count_file_thread_links",
    "delete_file_record",
    "delete_thread_file_link",
    "create_thread",
    "get_user_threads",
    "get_thread_by_langgraph_id",
    "update_thread_title",
    "USE_SUPABASE_DB",
    "FileType",
    # Generated file storage
    "GeneratedFileStorage",
    "get_file_storage",
    "save_generated_file",
    "get_generated_file",
    "list_generated_files",
    "cleanup_old_generated_files",
    "FILE_STORAGE_DIR",
    "FILE_BUCKET_NAME",
]
