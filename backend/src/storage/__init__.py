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

from .supabase_db import (
    save_file_record,
    save_file_record_sync,
    create_thread_file_link,
    create_thread_file_link_sync,
    get_files_by_type,
    get_user_files,
    get_thread_files,
    get_file_by_id,
    count_file_thread_links,
    delete_file_record,
    delete_thread_file_link,
    create_thread,
    get_user_threads,
    get_thread_by_langgraph_id,
    update_thread_title,
    USE_SUPABASE_DB,
    FileType,
)

from .file_storage import (
    GeneratedFileStorage,
    get_file_storage,
    save_generated_file,
    get_generated_file,
    list_generated_files,
    cleanup_old_generated_files,
    FILE_STORAGE_DIR,
    FILE_BUCKET_NAME,
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
