# backend/routers/upload.py
# ─────────────────────────────────────────────────────────────
# Handles student photo uploads.
# Stores image as base64 in DB (simple, no S3 needed).
# For production you can swap to S3/Cloudinary later.
# ─────────────────────────────────────────────────────────────
import base64
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from routers.auth import get_current_user
from models.user import User

router = APIRouter()

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE_MB   = 2
MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024


@router.post("/student-photo")
async def upload_student_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    # Validate type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Only JPEG, PNG, WEBP allowed. Got: {file.content_type}")

    # Read and validate size
    content = await file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(400, f"File too large. Max {MAX_SIZE_MB}MB allowed.")

    # Convert to base64 data URL
    b64 = base64.b64encode(content).decode("utf-8")
    data_url = f"data:{file.content_type};base64,{b64}"

    return {
        "photo_url": data_url,
        "size_kb":   round(len(content) / 1024, 1),
        "type":      file.content_type,
    }
