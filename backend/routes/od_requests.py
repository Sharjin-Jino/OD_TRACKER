import os
import sys
import uuid
from datetime import datetime

# Ensure project root is in sys.path so 'backend.*' imports succeed in all environments
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

import io
from werkzeug.utils import secure_filename
from flask import Blueprint, request, jsonify, send_from_directory, send_file
try:
    from backend.models.od_request import ODRequestModel
    from backend.models.od_history import ODHistoryModel
    from backend.models.approval import ApprovalModel
    from backend.models.certificate import CertificateModel
    from backend.routes.auth import login_required, role_required, current_user
    from backend.config import Config
except ImportError:
    from models.od_request import ODRequestModel
    from models.od_history import ODHistoryModel
    from models.approval import ApprovalModel
    from models.certificate import CertificateModel
    from routes.auth import login_required, role_required, current_user
    from config import Config

od_requests_bp = Blueprint('od_requests', __name__)

ALLOWED_EVENT_TYPES = {
    'Hackathon', 'Symposium', 'Workshop', 'Sports',
    'Cultural Event', 'Internship', 'Competition', 'Seminar', 'Other'
}

def is_allowed_file(filename):
    """Check if the uploaded file has an allowed extension."""
    if '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    return ext in Config.ALLOWED_EXTENSIONS

@od_requests_bp.route('', methods=['POST'], strict_slashes=False)
@od_requests_bp.route('/', methods=['POST'], strict_slashes=False)
@role_required('Student')
def create_od_request():
    """
    Submit a new student OD application:
    1. Authenticate student session / Bearer token
    2. Validate required event fields & dates
    3. Safely save uploaded OD letter / brochure
    4. Store record in MongoDB Atlas od_requests collection with status 'Pending'
    """
    active_user = current_user

    # Handle both multipart/form-data and JSON
    if request.is_json:
        data = request.get_json() or {}
        uploaded_file = None
        uploaded_poster = None
    else:
        data = request.form.to_dict()
        uploaded_file = request.files.get('od_letter') or request.files.get('file') or request.files.get('document')
        uploaded_poster = request.files.get('event_poster') or request.files.get('poster') or request.files.get('brochure')

    # Extract fields
    event_name = (data.get('eventName') or data.get('event_name') or '').strip()
    event_type = (data.get('eventType') or data.get('event_type') or '').strip()
    event_organizer = (data.get('eventOrganizer') or data.get('event_organizer') or '').strip()
    venue = (data.get('venue') or '').strip()
    from_date = (data.get('fromDate') or data.get('from_date') or data.get('eventDate') or '').strip()
    to_date = (data.get('toDate') or data.get('to_date') or from_date).strip()
    from_time = (data.get('fromTime') or data.get('from_time') or '09:00').strip()
    to_time = (data.get('toTime') or data.get('to_time') or '17:00').strip()
    reason = (data.get('reason') or '').strip()
    description = (data.get('description') or '').strip()

    # 1. Required field validation
    missing_fields = []
    if not event_name:
        missing_fields.append('Event Name')
    if not event_type:
        missing_fields.append('Event Type')
    if not event_organizer:
        missing_fields.append('Event Organizer / College Name')
    if not venue:
        missing_fields.append('Venue')
    if not from_date:
        missing_fields.append('Event Start Date')
    if not reason:
        missing_fields.append('Reason for OD')

    if missing_fields:
        return jsonify({
            'success': False,
            'error': f"Missing required fields: {', '.join(missing_fields)}."
        }), 400

    # 1.1 Mandatory Student Review Confirmation Check
    is_reviewed_val = data.get('isReviewed') or data.get('is_reviewed') or data.get('reviewed')
    if is_reviewed_val is not None and str(is_reviewed_val).lower() in ('false', '0', 'no', ''):
        return jsonify({
            'success': False,
            'error': "Student Review Confirmation is mandatory. You must review and confirm the extracted event details before submitting."
        }), 400

    # 2. Event Type Validation
    normalized_types = {t.lower(): t for t in ALLOWED_EVENT_TYPES}
    matched_type = normalized_types.get(event_type.lower(), event_type)

    # 3. Date Validation
    try:
        d_from = datetime.strptime(from_date, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({
            'success': False,
            'error': "Invalid Event Start Date format. Please use YYYY-MM-DD."
        }), 400

    try:
        d_to = datetime.strptime(to_date, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({
            'success': False,
            'error': "Invalid Event End Date format. Please use YYYY-MM-DD."
        }), 400

    if d_to < d_from:
        return jsonify({
            'success': False,
            'error': "Event end date cannot be earlier than event start date."
        }), 400

    server_today = datetime.now().date()
    if d_from < server_today:
        return jsonify({
            'success': False,
            'error': "Cannot apply for OD for past dates. OD requests must be submitted at least 3 days before the event date."
        }), 400

    days_diff = (d_from - server_today).days
    if days_diff < 3:
        return jsonify({
            'success': False,
            'error': "OD requests must be submitted at least 3 days before the event date."
        }), 400

    # Ensure dates do not exceed 1 academic year in advance (prevents impossible dates like 2222/2661)
    if d_from.year > server_today.year + 1 or d_to.year > server_today.year + 1:
        return jsonify({
            'success': False,
            'error': "Event date cannot be more than 1 academic year in advance."
        }), 400

    # Ensure duration does not exceed maximum allowable consecutive OD limit (30 days)
    total_days = (d_to - d_from).days + 1
    if total_days > 30:
        return jsonify({
            'success': False,
            'error': "OD request duration cannot exceed 30 consecutive days."
        }), 400

    # 4. Mandatory OD Letter & Event Poster Validation & Handling (Dual Document Requirement)
    has_uploaded_file = bool(uploaded_file and getattr(uploaded_file, 'filename', None) and uploaded_file.filename.strip())
    doc_url = (data.get('od_letter_url') or data.get('documentUrl') or data.get('odLetterUrl') or '').strip()

    has_uploaded_poster = bool(uploaded_poster and getattr(uploaded_poster, 'filename', None) and uploaded_poster.filename.strip())
    poster_url = (data.get('event_poster_url') or data.get('eventPosterUrl') or data.get('posterUrl') or '').strip()

    if not has_uploaded_file and not doc_url and not has_uploaded_poster and not poster_url:
        return jsonify({
            'success': False,
            'error': "Both OD Letter and Event Poster are missing. Please upload both documents."
        }), 400

    if not has_uploaded_file and not doc_url:
        return jsonify({
            'success': False,
            'error': "OD Letter is mandatory. Please upload an official OD request or permission letter."
        }), 400

    if not has_uploaded_poster and not poster_url:
        return jsonify({
            'success': False,
            'error': "Event Poster is mandatory. Students must upload both the OD Letter and the Event Poster."
        }), 400

    document_url = None
    if has_uploaded_file:
        if not is_allowed_file(uploaded_file.filename):
            return jsonify({
                'success': False,
                'error': f"Invalid file type for OD letter. Allowed formats are: {', '.join(Config.ALLOWED_EXTENSIONS)}."
            }), 400

        orig_name = secure_filename(uploaded_file.filename) or 'document.pdf'
        ext = orig_name.rsplit('.', 1)[1].lower() if '.' in orig_name else 'pdf'
        safe_filename = f"od_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}.{ext}"
        save_path = os.path.join(Config.OD_LETTERS_FOLDER, safe_filename)
        
        os.makedirs(Config.OD_LETTERS_FOLDER, exist_ok=True)
        uploaded_file.save(save_path)

        # Upload to Azure Blob Storage container 'odletters'
        try:
            try:
                from backend.services.blob_storage_service import blob_storage
            except ImportError:
                from services.blob_storage_service import blob_storage
            blob_storage.upload_file('odletters', safe_filename, save_path)
        except Exception as blob_err:
            print(f"[!] Azure blob upload notice for OD letter {safe_filename}: {blob_err}")

        document_url = f"/api/od-requests/uploads/od_letters/{safe_filename}"
    elif doc_url:
        document_url = doc_url

    event_poster_url = None
    if has_uploaded_poster:
        if not is_allowed_file(uploaded_poster.filename):
            return jsonify({
                'success': False,
                'error': f"Invalid file type for Event Poster. Allowed formats are: {', '.join(Config.ALLOWED_EXTENSIONS)}."
            }), 400

        orig_poster = secure_filename(uploaded_poster.filename) or 'poster.png'
        poster_ext = orig_poster.rsplit('.', 1)[1].lower() if '.' in orig_poster else 'png'
        safe_poster_name = f"poster_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}.{poster_ext}"
        poster_save_path = os.path.join(Config.EVENT_POSTERS_FOLDER, safe_poster_name)

        os.makedirs(Config.EVENT_POSTERS_FOLDER, exist_ok=True)
        uploaded_poster.save(poster_save_path)

        try:
            try:
                from backend.services.blob_storage_service import blob_storage
            except ImportError:
                from services.blob_storage_service import blob_storage
            blob_storage.upload_file('odletters', safe_poster_name, poster_save_path)
        except Exception as blob_err:
            pass

        event_poster_url = f"/api/od-requests/uploads/event_posters/{safe_poster_name}"
    elif poster_url:
        event_poster_url = poster_url

    # 5. Insert into Database using Authenticated Student Profile
    req_payload = {
        'student_id': active_user.get('id') or active_user.get('userId'),
        'student_reg_no': active_user.get('identifier'),
        'student_name': active_user.get('name'),
        'department': active_user.get('department'),
        'year': active_user.get('year') or 'III Year',
        'section': active_user.get('section') or 'A',
        'event_name': event_name,
        'event_type': matched_type,
        'event_organizer': event_organizer,
        'venue': venue,
        'from_date': from_date,
        'to_date': to_date,
        'from_time': from_time,
        'to_time': to_time,
        'reason': reason,
        'description': description,
        'od_letter_url': document_url,
        'event_poster_url': event_poster_url,
    }

    try:
        created_req = ODRequestModel.create(req_payload)
    except ValueError as ve:
        return jsonify({
            'success': False,
            'error': str(ve)
        }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f"Failed to record OD request in database: {str(e)}"
        }), 500

    if not created_req:
        return jsonify({
            'success': False,
            'error': "Failed to record OD request in database."
        }), 500

    req_id = created_req.get('id', '')
    return jsonify({
        'success': True,
        'message': f"OD Request submitted successfully with ID: {req_id}.",
        'requestId': req_id,
        'request': created_req
    }), 201

@od_requests_bp.route('/my', methods=['GET'])
@role_required('Student')
def get_my_od_requests():
    """Retrieve all OD requests filed by the currently authenticated student from MongoDB."""
    active_user = current_user
    student_id = active_user.get('id') or active_user.get('identifier')
    
    requests_list = ODRequestModel.list_by_student(student_id)
    if not requests_list and active_user.get('identifier'):
        requests_list = ODRequestModel.list_by_student(active_user.get('identifier'))

    return jsonify({
        'success': True,
        'requests': requests_list,
        'count': len(requests_list)
    }), 200

@od_requests_bp.route('/check-deadlines', methods=['POST'])
@login_required
def trigger_deadline_check():
    """Trigger explicit 24-hour certificate submission deadline evaluation for all HOD-approved applications."""
    expired_count = ODRequestModel.check_and_expire_deadlines()
    return jsonify({
        'success': True,
        'message': f"Evaluated certificate deadlines. Auto-rejected {expired_count} overdue request(s).",
        'expired_count': expired_count
    }), 200

@od_requests_bp.route('/<request_id>', methods=['GET'])
@login_required
def get_od_request_by_id(request_id):
    """Retrieve details for a single OD request by ID with strict ownership validation."""
    active_user = current_user
    req = ODRequestModel.get_by_id(request_id)

    if not req:
        return jsonify({
            'success': False,
            'error': f"OD Request with ID '{request_id}' was not found."
        }), 404

    # If the requester is a student, ensure they can only view their own requests
    if active_user.get('role') == 'Student':
        req_student_id = str(req.get('student_id', '')).lower()
        req_student_reg = str(req.get('student_reg_no', '')).lower()
        user_id = str(active_user.get('id', '')).lower()
        user_reg = str(active_user.get('identifier', '')).lower()

        if user_id != req_student_id and user_reg != req_student_reg and user_id != req_student_reg:
            return jsonify({
                'success': False,
                'error': "Access denied: You do not have permission to view another student's OD request."
            }), 403

    return jsonify({
        'success': True,
        'request': req
    }), 200

@od_requests_bp.route('/<request_id>/certificate', methods=['POST'])
@role_required('Student')
def upload_request_certificate(request_id):
    """
    Student uploads participation certificate after receiving official OD approval:
    - Stores file in uploads/certificates/
    - Updates certificate status to 'Pending Verification'
    - Creates record in MongoDB certificates collection
    """
    active_user = current_user
    uploaded_file = request.files.get('certificate') or request.files.get('file') or request.files.get('document')

    if not uploaded_file or not uploaded_file.filename:
        return jsonify({'success': False, 'error': 'No certificate file uploaded.'}), 400

    if not is_allowed_file(uploaded_file.filename):
        return jsonify({
            'success': False,
            'error': f"Invalid certificate format. Allowed types: {', '.join(Config.ALLOWED_EXTENSIONS)}"
        }), 400

    orig_name = secure_filename(uploaded_file.filename) or 'certificate.pdf'
    ext = orig_name.rsplit('.', 1)[1] if '.' in orig_name else 'pdf'
    safe_filename = f"cert_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}.{ext}"
    save_path = os.path.join(Config.CERTIFICATES_FOLDER, safe_filename)

    os.makedirs(Config.CERTIFICATES_FOLDER, exist_ok=True)
    uploaded_file.save(save_path)

    # Upload to Azure Blob Storage container 'certificates'
    try:
        try:
            from backend.services.blob_storage_service import blob_storage
        except ImportError:
            from services.blob_storage_service import blob_storage
        blob_storage.upload_file('certificates', safe_filename, save_path)
    except Exception as blob_err:
        print(f"[!] Azure blob upload notice for certificate {safe_filename}: {blob_err}")

    cert_url = f"/api/od-requests/uploads/certificates/{safe_filename}"

    updated_req, err = ODRequestModel.upload_certificate(request_id, active_user, cert_url)
    if err:
        return jsonify({'success': False, 'error': err}), 400

    return jsonify({
        'success': True,
        'message': 'Certificate uploaded successfully and submitted for faculty verification.',
        'certificateUrl': cert_url,
        'request': updated_req
    }), 200

@od_requests_bp.route('/<request_id>/history', methods=['GET'])
@login_required
def get_od_request_history(request_id):
    """Retrieve the full chronological audit history for an OD request."""
    history = ODHistoryModel.list_by_request(request_id)
    return jsonify({
        'success': True,
        'history': history,
        'count': len(history)
    }), 200

@od_requests_bp.route('/<request_id>/approvals', methods=['GET'])
@login_required
def get_od_request_approvals(request_id):
    """Retrieve recorded stakeholder approval sign-offs for an OD request."""
    approvals = ApprovalModel.list_by_request(request_id)
    return jsonify({
        'success': True,
        'approvals': approvals,
        'count': len(approvals)
    }), 200

@od_requests_bp.route('/uploads/od_letters/<filename>', methods=['GET'])
def serve_od_letter(filename):
    """Safely serve or download uploaded OD letters and participation documents."""
    safe_name = secure_filename(filename)
    as_attachment = request.args.get('download', '').lower() in ['true', '1', 'yes']

    # 1. Try Azure Blob Storage container 'odletters' first
    try:
        try:
            from backend.services.blob_storage_service import blob_storage
        except ImportError:
            from services.blob_storage_service import blob_storage

        blob_data, content_type = blob_storage.download_file('odletters', safe_name)
        if blob_data:
            return send_file(
                io.BytesIO(blob_data),
                mimetype=content_type or 'application/octet-stream',
                as_attachment=as_attachment,
                download_name=safe_name
            )
    except Exception as e:
        print(f"[Azure Blob] Serve OD letter error for {safe_name}: {e}")

    # 2. Local disk fallback
    file_path = os.path.join(Config.OD_LETTERS_FOLDER, safe_name)
    folder = Config.OD_LETTERS_FOLDER

    if not os.path.exists(file_path):
        legacy_path = os.path.join(Config.BASE_DIR, 'uploads', 'od_letters', safe_name)
        if os.path.exists(legacy_path):
            folder = os.path.join(Config.BASE_DIR, 'uploads', 'od_letters')
            file_path = legacy_path
        else:
            try:
                from backend.services.pdf_service import generate_od_letter_pdf
            except ImportError:
                from services.pdf_service import generate_od_letter_pdf
            generate_od_letter_pdf(file_path, req_id=safe_name.replace('.pdf', ''))
            # Auto-sync generated PDF back to Azure Blob container
            try:
                blob_storage.upload_file('odletters', safe_name, file_path)
            except Exception:
                pass
    
    return send_from_directory(folder, safe_name, as_attachment=as_attachment, download_name=safe_name)


@od_requests_bp.route('/<request_id>/view-certificate', methods=['GET'])
@login_required
def view_verified_certificate(request_id):
    """
    Securely view/download the verified participation certificate for an OD request.
    - Role and Ownership: Student can only view their own certificate; Faculty/Admin can view any.
    - Strict Approval Verification: Certificate MUST be 'Verified' or 'Approved'.
      An OD request being Approved does NOT automatically mean its certificate is approved.
    - Streams the actual uploaded certificate file (PDF, PNG, JPG, JPEG, WEBP).
    """
    active_user = current_user
    user_id = str(active_user.get('id') or active_user.get('identifier') or '')
    user_ident = str(active_user.get('identifier') or '').lower()
    user_role = str(active_user.get('role') or '').lower()

    req = ODRequestModel.get_by_id(request_id)
    if not req:
        return jsonify({'success': False, 'error': 'OD request not found.'}), 404

    # Ownership check for students
    if user_role == 'student':
        req_student_id = str(req.get('studentId') or req.get('student_id') or '')
        req_student_reg = str(req.get('studentRegisterNo') or req.get('student_reg_no') or '').lower()
        if req_student_id != user_id and req_student_reg != user_ident and req_student_reg != user_id.lower():
            return jsonify({'success': False, 'error': 'Access denied: You can only view certificates for your own OD requests.'}), 403

    # Strict Certificate Approval Check
    cert_status = str(req.get('certificateStatus') or req.get('certificate_status') or '').strip().lower()
    if cert_status not in ('verified', 'approved'):
        if cert_status in ('pending verification', 'pending upload', 'submitted') or req.get('status') == 'Certificate Submitted':
            return jsonify({
                'success': False,
                'error': 'Certificate is pending verification. It can only be viewed after verification by faculty.',
                'certificateStatus': req.get('certificateStatus')
            }), 403
        elif cert_status in ('rejected', 'deadline expired'):
            return jsonify({
                'success': False,
                'error': 'Certificate was rejected and cannot be viewed as an approved certificate.',
                'certificateStatus': req.get('certificateStatus')
            }), 403
        else:
            return jsonify({
                'success': False,
                'error': 'No certificate has been uploaded or verified for this OD request.',
                'certificateStatus': req.get('certificateStatus')
            }), 404

    cert_url = req.get('certificateUrl') or req.get('certificate_url')
    if not cert_url or not str(cert_url).strip():
        return jsonify({'success': False, 'error': 'Certificate file record not found.'}), 404

    filename = os.path.basename(str(cert_url).strip())
    return serve_certificate(filename)

@od_requests_bp.route('/uploads/certificates/<filename>', methods=['GET'])
def serve_certificate(filename):
    """Safely serve or download uploaded student participation certificates."""
    safe_name = secure_filename(filename)
    as_attachment = request.args.get('download', '').lower() in ['true', '1', 'yes']

    # 1. Try Azure Blob Storage container 'certificates' first
    try:
        try:
            from backend.services.blob_storage_service import blob_storage
        except ImportError:
            from services.blob_storage_service import blob_storage

        blob_data, content_type = blob_storage.download_file('certificates', safe_name)
        if blob_data:
            return send_file(
                io.BytesIO(blob_data),
                mimetype=content_type or 'application/octet-stream',
                as_attachment=as_attachment,
                download_name=safe_name
            )
    except Exception as e:
        print(f"[Azure Blob] Serve certificate error for {safe_name}: {e}")

    # 2. Local disk fallback
    file_path = os.path.join(Config.CERTIFICATES_FOLDER, safe_name)
    folder = Config.CERTIFICATES_FOLDER

    if not os.path.exists(file_path):
        legacy_path = os.path.join(Config.BASE_DIR, 'uploads', 'certificates', safe_name)
        if os.path.exists(legacy_path):
            folder = os.path.join(Config.BASE_DIR, 'uploads', 'certificates')
            file_path = legacy_path
        else:
            try:
                from backend.services.pdf_service import generate_certificate_pdf
            except ImportError:
                from services.pdf_service import generate_certificate_pdf
            generate_certificate_pdf(file_path, cert_id=safe_name.replace('.pdf', ''))
            # Auto-sync generated PDF back to Azure Blob container
            try:
                blob_storage.upload_file('certificates', safe_name, file_path)
            except Exception:
                pass
    
    return send_from_directory(folder, safe_name, as_attachment=as_attachment, download_name=safe_name)

@od_requests_bp.route('/smart-extract', methods=['POST'])
@role_required('Student')
def smart_extract_documents():
    """
    Smart OD Application - Dual Document OCR & Extraction Endpoint:
    Receives OD Letter and Event Poster files.
    Performs OCR and text extraction, classifies documents, extracts structured event details,
    cross-validates for date/venue/title conflicts, and computes extraction confidence scores.
    """
    od_file = request.files.get('od_letter') or request.files.get('file')
    poster_file = request.files.get('event_poster') or request.files.get('poster')

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

    if not is_allowed_file(od_file.filename):
        return jsonify({
            'success': False,
            'error': f"Invalid file format for OD Letter. Allowed formats: {', '.join(Config.ALLOWED_EXTENSIONS)}."
        }), 400

    if not is_allowed_file(poster_file.filename):
        return jsonify({
            'success': False,
            'error': f"Invalid file format for Event Poster. Allowed formats: {', '.join(Config.ALLOWED_EXTENSIONS)}."
        }), 400

    try:
        try:
            from backend.services.openai_extraction_service import OpenAIExtractionService
        except ImportError:
            from services.openai_extraction_service import OpenAIExtractionService

        od_bytes = od_file.read()
        poster_bytes = poster_file.read()

        result = OpenAIExtractionService.extract_with_fallback(
            od_file_bytes=od_bytes,
            od_filename=secure_filename(od_file.filename) or 'od_letter.pdf',
            poster_file_bytes=poster_bytes,
            poster_filename=secure_filename(poster_file.filename) or 'poster.png'
        )

        return jsonify(result), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'error': f"Document extraction failed: {str(e)}"
        }), 500


@od_requests_bp.route('/uploads/event_posters/<filename>', methods=['GET'])
def serve_event_poster(filename):
    """Safely serve or download uploaded event posters and brochures."""
    safe_name = secure_filename(filename)
    as_attachment = request.args.get('download', '').lower() in ['true', '1', 'yes']

    # 1. Try Azure Blob Storage container 'odletters' first
    try:
        try:
            from backend.services.blob_storage_service import blob_storage
        except ImportError:
            from services.blob_storage_service import blob_storage

        blob_data, content_type = blob_storage.download_file('odletters', safe_name)
        if blob_data:
            return send_file(
                io.BytesIO(blob_data),
                mimetype=content_type or 'application/octet-stream',
                as_attachment=as_attachment,
                download_name=safe_name
            )
    except Exception:
        pass

    # 2. Local disk fallback
    os.makedirs(Config.EVENT_POSTERS_FOLDER, exist_ok=True)
    file_path = os.path.join(Config.EVENT_POSTERS_FOLDER, safe_name)
    folder = Config.EVENT_POSTERS_FOLDER

    if not os.path.exists(file_path):
        legacy_path = os.path.join(Config.BASE_DIR, 'uploads', 'event_posters', safe_name)
        if os.path.exists(legacy_path):
            folder = os.path.join(Config.BASE_DIR, 'uploads', 'event_posters')
        else:
            return jsonify({'success': False, 'error': 'Event poster file not found.'}), 404

    return send_from_directory(folder, safe_name, as_attachment=as_attachment, download_name=safe_name)
