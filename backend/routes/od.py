"""
OD Document Intelligence Blueprint
Exposes:
  POST /api/od/extract-documents
Student-authenticated endpoint for dual document extraction using OpenAI Vision and Structured Outputs.
"""

import os
import sys
import io
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from PIL import Image

try:
    import pymupdf
except ImportError:
    pymupdf = None

try:
    from backend.routes.auth import role_required, current_user
    from backend.config import Config
    from backend.services.openai_extraction_service import OpenAIExtractionService
except ImportError:
    from routes.auth import role_required, current_user
    from config import Config
    from services.openai_extraction_service import OpenAIExtractionService

od_bp = Blueprint('od', __name__)

ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'webp'}
MAX_FILE_SIZE = 16 * 1024 * 1024  # 16 MB


def validate_file_content(file_bytes: bytes, filename: str) -> Tuple[bool, Optional[str]]:
    """
    Validates actual file content integrity and magic bytes beyond simple file extensions.
    Detects empty, corrupted, or unsupported files.
    """
    if not file_bytes or len(file_bytes) == 0:
        return False, f"File '{filename}' is empty (0 bytes)."

    if len(file_bytes) > MAX_FILE_SIZE:
        return False, f"File '{filename}' exceeds the maximum allowed size of 16MB."

    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"Unsupported file extension '{ext}' for '{filename}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}."

    # Validate PDF content integrity
    if ext == 'pdf':
        if not file_bytes.startswith(b'%PDF'):
            return False, f"File '{filename}' is not a valid PDF document (missing PDF header signature)."
        if pymupdf is not None:
            try:
                doc = pymupdf.open(stream=file_bytes, filetype="pdf")
                if len(doc) == 0:
                    doc.close()
                    return False, f"PDF file '{filename}' has no pages."
                doc.close()
            except Exception as e:
                return False, f"PDF file '{filename}' is corrupted and could not be rendered: {str(e)}"

    # Validate Image content integrity (PNG, JPG, JPEG, WEBP)
    elif ext in {'png', 'jpg', 'jpeg', 'webp'}:
        try:
            img = Image.open(io.BytesIO(file_bytes))
            img.verify()
        except Exception as e:
            return False, f"Image file '{filename}' is corrupted or not a valid image: {str(e)}"

    return True, None


@od_bp.route('/extract-documents', methods=['POST'])
@role_required('Student')
def extract_documents():
    """
    Smart Apply OD – Dual Document Extraction API
    Endpoint: POST /api/od/extract-documents

    Requires:
      - Multipart/form-data with:
        * 'od_letter': OD Permission Letter (PDF/Image)
        * 'event_poster': Event Poster / Brochure (PDF/Image)
      - Authenticated Student Bearer Token

    Returns:
      JSON payload conforming to the strict structured output schema containing:
      - documentValidation
      - sameEventValidation
      - extracted (eventName, eventType, dates, venue, organizer, timings, etc.)
      - fieldSources
      - conflicts
      - missingFields
      - requiresStudentReview
    """
    active_user = current_user

    # 1. Check for uploaded files
    od_file = request.files.get('od_letter') or request.files.get('odLetter') or request.files.get('file')
    poster_file = request.files.get('event_poster') or request.files.get('eventPoster') or request.files.get('poster')

    if not od_file and not poster_file:
        return jsonify({
            'success': False,
            'error': 'Both OD Letter and Event Poster are missing. Please upload both documents.'
        }), 400

    if not od_file:
        return jsonify({
            'success': False,
            'error': 'OD Letter is missing. Both OD Letter and Event Poster are required for extraction.'
        }), 400

    if not poster_file:
        return jsonify({
            'success': False,
            'error': 'Event Poster is missing. Both OD Letter and Event Poster are required for extraction.'
        }), 400

    # 2. Extract and validate file content
    od_bytes = od_file.read()
    poster_bytes = poster_file.read()

    od_valid, od_err = validate_file_content(od_bytes, od_file.filename)
    if not od_valid:
        return jsonify({
            'success': False,
            'error': f"OD Letter validation failed: {od_err}"
        }), 400

    poster_valid, poster_err = validate_file_content(poster_bytes, poster_file.filename)
    if not poster_valid:
        return jsonify({
            'success': False,
            'error': f"Event Poster validation failed: {poster_err}"
        }), 400

    # 3. Process via OpenAI Vision & Structured Extraction (with resilient fallback)
    try:
        extraction_result = OpenAIExtractionService.extract_with_fallback(
            od_file_bytes=od_bytes,
            od_filename=secure_filename(od_file.filename) or 'od_letter.pdf',
            poster_file_bytes=poster_bytes,
            poster_filename=secure_filename(poster_file.filename) or 'poster.png'
        )

        # Inject authenticated student identity metadata (read-only verification)
        extraction_result['authenticatedStudent'] = {
            'studentId': active_user.get('id') or active_user.get('userId'),
            'registerNumber': active_user.get('identifier'),
            'name': active_user.get('name'),
            'department': active_user.get('department'),
            'year': active_user.get('year') or 'III Year',
            'section': active_user.get('section') or 'A'
        }

        return jsonify(extraction_result), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'error': f"AI document extraction failed: {str(e)}"
        }), 500

