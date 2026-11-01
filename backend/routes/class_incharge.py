import os
import io
import uuid
import re
from datetime import datetime
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash
from flask import Blueprint, request, jsonify, send_from_directory, send_file
from sqlalchemy import or_, and_, func
from backend.database.sql_server import session_scope
from backend.models.db_models import (
    User,
    StudentAcademicRecord,
    ODRequest,
    Certificate,
    StudentImportHistory,
    AttendanceUploadHistory,
    MarksUploadHistory,
    to_iso
)
from backend.models.academic_record import AcademicRecordModel
from backend.models.od_request import ODRequestModel
from backend.models.user import UserModel
from backend.routes.auth import role_required, current_user
from backend.services.od_eligibility import calculate_od_eligibility
from backend.services.excel_ci_service import (
    parse_tabular_file,
    validate_and_preview_students,
    import_students_confirmed,
    validate_and_preview_attendance,
    update_attendance_confirmed,
    validate_and_preview_marks,
    update_marks_confirmed,
    generate_student_account_template,
    generate_attendance_template,
    generate_marks_template,
    generate_failed_rows_report
)

class_incharge_bp = Blueprint('class_incharge', __name__)

def is_class_incharge_authorized_for_request(ci_user, req):
    """Verify that the request belongs to the Class Incharge's assigned department / class / section."""
    if not req or not ci_user:
        return False
    ci_dept = (ci_user.get('department') or '').strip().lower()
    req_dept = (req.get('department') or req.get('studentDepartment') or '').strip().lower()
    if ci_dept and req_dept and ci_dept != req_dept:
        return False
    return True

@class_incharge_bp.route('/od-requests', methods=['GET'])
@role_required('Class Incharge')
def get_class_incharge_od_requests():
    """
    Retrieve all OD requests assigned to the authenticated Class Incharge from MongoDB.
    Only requests with status 'Mentor Approved' appear as pending for Class Incharge.
    """
    ci_user = current_user
    all_requests = ODRequestModel.list_for_class_incharge(ci_user)

    pending_requests = [
        r for r in all_requests 
        if r.get('status') == 'Mentor Approved' and r.get('currentStage') == 'Class Incharge'
    ]
    reviewed_requests = [
        r for r in all_requests 
        if not (r.get('status') == 'Mentor Approved' and r.get('currentStage') == 'Class Incharge')
    ]
    approved_requests = [
        r for r in all_requests 
        if r.get('status') in ['Class Incharge Approved', 'Approved', 'HOD Approved']
    ]
    rejected_requests = [
        r for r in all_requests 
        if r.get('status') in ['Class Incharge Rejected', 'Rejected']
    ]

    status_filter = request.args.get('status', '').lower().strip()
    if status_filter == 'pending':
        return jsonify({
            'success': True,
            'requests': pending_requests,
            'count': len(pending_requests)
        }), 200
    elif status_filter in ['history', 'reviewed']:
        return jsonify({
            'success': True,
            'requests': reviewed_requests,
            'count': len(reviewed_requests)
        }), 200

    return jsonify({
        'success': True,
        'requests': all_requests,
        'pending': pending_requests,
        'history': reviewed_requests,
        'approved': approved_requests,
        'rejected': rejected_requests,
        'count': len(all_requests),
        'pendingCount': len(pending_requests)
    }), 200

@class_incharge_bp.route('/od-requests/<request_id>', methods=['GET'])
@role_required('Class Incharge')
def get_class_incharge_od_request_detail(request_id):
    """Retrieve full details of a specific OD request for Class Incharge review from MongoDB."""
    ci_user = current_user
    req = ODRequestModel.get_by_id(request_id)

    if not req:
        return jsonify({
            'success': False,
            'error': f"OD Request with ID '{request_id}' not found."
        }), 404

    if not is_class_incharge_authorized_for_request(ci_user, req):
        return jsonify({
            'success': False,
            'error': "Access denied: This OD request belongs to another department/class section."
        }), 403

    return jsonify({
        'success': True,
        'request': req
    }), 200

@class_incharge_bp.route('/od-requests/<request_id>/approve', methods=['POST'])
@role_required('Class Incharge')
def approve_od_request_by_class_incharge(request_id):
    """
    Approve/endorse an assigned OD request as Class Incharge:
    - Validates request state is 'Mentor Approved'
    - Updates status to 'Class Incharge Approved' in MongoDB
    - Advances stage to 'HOD'
    - Logs decision in approvals and od_history collections
    """
    ci_user = current_user
    data = request.get_json(silent=True) or {}
    remarks = (data.get('remarks') or data.get('comments') or '').strip()

    req = ODRequestModel.get_by_id(request_id)
    if not req:
        return jsonify({
            'success': False,
            'error': f"OD Request with ID '{request_id}' not found."
        }), 404

    if not is_class_incharge_authorized_for_request(ci_user, req):
        return jsonify({
            'success': False,
            'error': "Access denied: You cannot approve OD requests belonging to another class/section."
        }), 403

    updated_req, err = ODRequestModel.approve_by_class_incharge(request_id, ci_user, remarks)
    if err:
        return jsonify({
            'success': False,
            'error': err
        }), 400

    return jsonify({
        'success': True,
        'message': f"OD Request {request_id} has been endorsed and approved by Class Incharge.",
        'request': updated_req,
        'status': updated_req.get('status') if updated_req else None,
        'currentStage': updated_req.get('currentStage') if updated_req else None
    }), 200

@class_incharge_bp.route('/od-requests/<request_id>/reject', methods=['POST'])
@role_required('Class Incharge')
def reject_od_request_by_class_incharge(request_id):
    """
    Reject an assigned OD request as Class Incharge:
    - Requires mandatory rejection reason
    - Validates request state is 'Mentor Approved'
    - Updates status to 'Class Incharge Rejected' in MongoDB
    - Logs decision in approvals and od_history collections
    """
    ci_user = current_user
    data = request.get_json(silent=True) or {}
    reason = (data.get('reason') or data.get('remarks') or data.get('comments') or '').strip()

    if not reason:
        return jsonify({
            'success': False,
            'error': "Rejection reason / remark is mandatory when rejecting an OD request."
        }), 400

    req = ODRequestModel.get_by_id(request_id)
    if not req:
        return jsonify({
            'success': False,
            'error': f"OD Request with ID '{request_id}' not found."
        }), 404

    if not is_class_incharge_authorized_for_request(ci_user, req):
        return jsonify({
            'success': False,
            'error': "Access denied: You cannot reject OD requests belonging to another class/section."
        }), 403

    updated_req, err = ODRequestModel.reject_by_class_incharge(request_id, ci_user, reason)
    if err:
        return jsonify({
            'success': False,
            'error': err
        }), 400

    return jsonify({
        'success': True,
        'message': f"OD Request {request_id} has been rejected by Class Incharge.",
        'request': updated_req,
        'status': updated_req.get('status') if updated_req else None,
        'rejectionReason': updated_req.get('rejectionReason') if updated_req else None
    }), 200

@class_incharge_bp.route('/od-requests/<request_id>/letter', methods=['GET'])
@role_required('Class Incharge')
def view_class_incharge_od_letter(request_id):
    """
    Securely download/view the uploaded OD letter for an assigned request.
    Prevents unauthorized access and directory traversal.
    """
    ci_user = current_user
    req = ODRequestModel.get_by_id(request_id)

    if not req:
        return jsonify({'success': False, 'error': 'OD Request not found.'}), 404

    if not is_class_incharge_authorized_for_request(ci_user, req):
        return jsonify({'success': False, 'error': 'Access denied.'}), 403

    doc_url = req.get('od_letter_url') or req.get('documentUrl')
    filename = os.path.basename(doc_url) if doc_url else f"od_letter_{request_id}.pdf"
    safe_filename = secure_filename(filename)
    as_attachment = request.args.get('download', '').lower() in ['true', '1', 'yes']
    download_name = f"OD_Letter_{request_id}.pdf" if as_attachment else safe_filename

    # 1. Try Azure Blob Storage container 'odletters' first
    try:
        try:
            from backend.services.blob_storage_service import blob_storage
        except ImportError:
            from services.blob_storage_service import blob_storage

        blob_data, content_type = blob_storage.download_file('odletters', safe_filename)
        if blob_data:
            return send_file(
                io.BytesIO(blob_data),
                mimetype=content_type or 'application/pdf',
                as_attachment=as_attachment,
                download_name=download_name
            )
    except Exception:
        pass

    # 2. Local disk fallback
    file_path = os.path.join(Config.OD_LETTERS_FOLDER, safe_filename)
    if not os.path.exists(file_path):
        from services.pdf_service import generate_od_letter_pdf
        generate_od_letter_pdf(
            file_path,
            student_name=req.get('studentName', 'Student'),
            reg_no=req.get('studentRegisterNo', req.get('studentId', '23CSD001')),
            event_name=req.get('eventName', 'Event Requisition'),
            organizer=req.get('eventOrganizer', 'Institutional Organizer'),
            event_date=req.get('eventDate', req.get('fromDate', '2026-10-18')),
            dept=req.get('department', req.get('studentDepartment', 'Computer Science and Design')),
            req_id=request_id
        )

    return send_from_directory(
        Config.OD_LETTERS_FOLDER, 
        safe_filename, 
        as_attachment=as_attachment, 
        download_name=download_name
    )


# ═════════════════════════════════════════════════════════════════════════════
# STUDENT MANAGEMENT MODULE (Class Incharge Profile / Dashboard)
# ═════════════════════════════════════════════════════════════════════════════

# ─── 1. SAMPLE TEMPLATE DOWNLOADS ─────────────────────────────────────────────

@class_incharge_bp.route('/student-management/templates/<template_type>', methods=['GET'])
@role_required('Class Incharge', 'Admin')
def download_ci_template(template_type):
    """Download official sample templates matching backend import schemas."""
    try:
        t_type = (template_type or '').lower().strip()
        if t_type in ['students', 'student', 'accounts']:
            stream = generate_student_account_template()
            filename = 'student_accounts_template.xlsx'
        elif t_type in ['attendance', 'weekly_attendance']:
            stream = generate_attendance_template()
            filename = 'weekly_attendance_template.xlsx'
        elif t_type in ['marks', 'cat_marks']:
            stream = generate_marks_template()
            filename = 'student_cat_marks_template.xlsx'
        else:
            return jsonify({'success': False, 'error': f"Unknown template type '{template_type}'."}), 400

        return send_file(
            stream,
            as_attachment=True,
            download_name=filename,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        return jsonify({'success': False, 'error': f"Failed to generate template: {str(e)}"}), 500


# ─── 2. STUDENT ACCOUNTS: LIST & SEARCH/FILTER ─────────────────────────────────

@class_incharge_bp.route('/student-management/students', methods=['GET'])
@role_required('Class Incharge', 'Admin')
def list_students():
    """
    List students for the Class Incharge with multi-factor search and filtering:
    - Search: Register No or Student Name
    - Filter: Department, Class/Section, Year, Status (ACTIVE/DISABLED)
    - Filter: Attendance thresholds, CGPA thresholds
    """
    ci_user = current_user
    ci_role = (ci_user.get('role') or '').lower()
    ci_dept = (ci_user.get('department') or '').strip()

    search = request.args.get('search', '').strip()
    section = request.args.get('section', '').strip()
    year = request.args.get('year', '').strip()
    status = request.args.get('status', '').strip().upper()
    dept = request.args.get('department', '').strip()

    target_dept = dept if (ci_role == 'admin' and dept) else ci_dept

    with session_scope() as session:
        query = session.query(User).filter(
            or_(
                func.lower(User.role) == 'student',
                func.lower(User.sub_role) == 'student'
            )
        )

        if target_dept:
            t_clean = target_dept.strip().lower()
            if t_clean in ('computer science and design', 'csd'):
                query = query.filter(func.lower(User.department).in_(['computer science and design', 'csd']))
            else:
                query = query.filter(func.lower(User.department) == t_clean)
        if section:
            query = query.filter(func.lower(User.section) == section.lower())
        if year:
            query = query.filter(func.lower(User.year) == year.lower())
        if status in ['ACTIVE', 'DISABLED', 'UNVERIFIED']:
            query = query.filter(func.lower(User.account_status) == status.lower())
        if search:
            s = f"%{search.lower()}%"
            query = query.filter(
                or_(
                    func.lower(User.identifier).like(s),
                    func.lower(User.name).like(s),
                    func.lower(User.email).like(s)
                )
            )

        users = query.order_by(User.identifier.asc()).all()

        att_min = request.args.get('attendance_min')
        att_max = request.args.get('attendance_max')
        cgpa_min = request.args.get('cgpa_min')
        cgpa_max = request.args.get('cgpa_max')

        student_list = []
        for u in users:
            d = u.to_safe_dict()
            att_val = d.get('attendance_percentage', 0.0) or 0.0
            cgpa_val = d.get('cgpa', 0.0) or 0.0

            if att_min is not None and att_min != '':
                try:
                    if float(att_val) < float(att_min):
                        continue
                except ValueError:
                    pass
            if att_max is not None and att_max != '':
                try:
                    if float(att_val) > float(att_max):
                        continue
                except ValueError:
                    pass
            if cgpa_min is not None and cgpa_min != '':
                try:
                    if float(cgpa_val) < float(cgpa_min):
                        continue
                except ValueError:
                    pass
            if cgpa_max is not None and cgpa_max != '':
                try:
                    if float(cgpa_val) > float(cgpa_max):
                        continue
                except ValueError:
                    pass

            student_list.append({
                'id': d.get('id'),
                'register_number': d.get('identifier') or d.get('id'),
                'name': d.get('name'),
                'email': d.get('email'),
                'department': d.get('department'),
                'section': d.get('section', 'A'),
                'class': f"{d.get('department', '')} - {d.get('section', 'A')}",
                'year': d.get('year', 'III Year'),
                'phone': d.get('phone', ''),
                'cgpa': cgpa_val,
                'attendance': att_val,
                'cat1': d.get('cat1_marks'),
                'cat2': d.get('cat2_marks'),
                'cat3': d.get('cat3_marks'),
                'status': d.get('account_status', 'ACTIVE'),
                'avatar': d.get('avatar'),
                'created_at': d.get('created_at')
            })

        return jsonify({
            'success': True,
            'count': len(student_list),
            'students': student_list
        }), 200


# ─── 3. SINGLE STUDENT: CREATE, EDIT, STATUS, PASSWORD RESET & PROFILE ────────

@class_incharge_bp.route('/student-management/students', methods=['POST'])
@role_required('Class Incharge', 'Admin')
def create_single_student():
    """Create a single student account manually."""
    ci_user = current_user
    data = request.get_json(silent=True) or {}

    reg_no = (data.get('register_number') or data.get('identifier') or '').strip().upper()
    name = (data.get('name') or data.get('student_name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    dept = (data.get('department') or ci_user.get('department') or 'Computer Science and Design').strip()
    sec = (data.get('section') or ci_user.get('section') or 'A').strip().upper()
    year = (data.get('year') or ci_user.get('year') or 'III Year').strip()
    phone = (data.get('phone') or '').strip()
    password = (data.get('password') or 'password123').strip()

    if not reg_no:
        return jsonify({'success': False, 'error': 'Register Number is required.'}), 400
    if not name:
        return jsonify({'success': False, 'error': 'Student Name is required.'}), 400
    if not email:
        return jsonify({'success': False, 'error': 'Email address is required.'}), 400
    if '@' not in email or '.' not in email:
        return jsonify({'success': False, 'error': 'Invalid email address format.'}), 400

    try:
        cgpa = float(data.get('cgpa', 0.0) or 0.0)
    except ValueError:
        return jsonify({'success': False, 'error': 'CGPA must be a valid number between 0 and 10.'}), 400

    try:
        att = float(data.get('attendance', 85.0) or 85.0)
    except ValueError:
        return jsonify({'success': False, 'error': 'Attendance must be a valid number between 0 and 100.'}), 400

    existing_ident = UserModel.get_by_identifier(reg_no)
    if existing_ident:
        return jsonify({'success': False, 'error': f"Student with Register Number '{reg_no}' already exists in database."}), 409

    existing_email = UserModel.get_by_email(email)
    if existing_email:
        return jsonify({'success': False, 'error': f"Student with Email '{email}' already exists in database."}), 409

    user_id = f"STUD_{uuid.uuid4().hex[:8].upper()}"

    doc = {
        'id': user_id,
        'identifier': reg_no,
        'name': name,
        'email': email,
        'role': 'Student',
        'sub_role': 'Student',
        'department': dept,
        'year': year,
        'section': sec,
        'designation': 'Student',
        'phone': phone,
        'password': password,
        'avatar': f"https://api.dicebear.com/7.x/initials/svg?seed={name}&backgroundColor=0d9488",
        'email_verified': True,
        'account_status': 'ACTIVE',
        'cgpa': cgpa,
        'attendance_percentage': att,
        'cat1_marks': None,
        'cat2_marks': None,
        'cat3_marks': None,
    }
    created_user = UserModel.create_user(doc)

    AcademicRecordModel.create_or_update({
        'student_id': user_id,
        'register_number': reg_no,
        'student_name': name,
        'department': dept,
        'attendance_percentage': att,
        'cgpa': cgpa,
        'total_working_days': 120,
        'updated_by': ci_user.get('id', 'CLASS_INCHARGE'),
        'updated_by_name': ci_user.get('name', 'Class Incharge'),
    })

    return jsonify({
        'success': True,
        'message': f"Student account for '{name}' ({reg_no}) created successfully.",
        'student': created_user
    }), 201


@class_incharge_bp.route('/student-management/students/<student_id>', methods=['PUT'])
@role_required('Class Incharge', 'Admin')
def update_student(student_id):
    """Edit student academic and demographic details."""
    ci_user = current_user
    data = request.get_json(silent=True) or {}

    target = UserModel.get_by_id(student_id) or UserModel.get_by_identifier(student_id)
    if not target:
        return jsonify({'success': False, 'error': f"Student with ID '{student_id}' not found."}), 404

    updates = {}

    # 1. Email Update & Uniqueness
    if 'email' in data and data['email'] is not None:
        raw_email = str(data['email']).strip().lower()
        if raw_email and raw_email != target.get('email'):
            existing_with_email = UserModel.get_by_email(raw_email)
            if existing_with_email and existing_with_email.get('id') != target.get('id'):
                return jsonify({
                    'success': False,
                    'error': f"The email address '{raw_email}' is already registered to another user."
                }), 409
            updates['email'] = raw_email

    # 2. Identifier Update & Uniqueness
    raw_ident = data.get('identifier') or data.get('register_number') or data.get('registerNumber')
    if raw_ident is not None and str(raw_ident).strip():
        new_ident = str(raw_ident).strip().upper()
        if new_ident != (target.get('identifier') or '').upper():
            existing_with_ident = UserModel.get_by_identifier(new_ident)
            if existing_with_ident and existing_with_ident.get('id') != target.get('id'):
                return jsonify({
                    'success': False,
                    'error': f"The Register Number '{new_ident}' is already taken by another user."
                }), 409
            updates['identifier'] = new_ident

    # 3. Password Update
    if 'password' in data and data['password'] is not None:
        new_pwd = str(data['password']).strip()
        if new_pwd:
            if len(new_pwd) < 6:
                return jsonify({'success': False, 'error': 'Password must be at least 6 characters long.'}), 400
            updates['password'] = new_pwd

    if 'name' in data and str(data['name']).strip():
        updates['name'] = str(data['name']).strip()
    if 'phone' in data:
        updates['phone'] = str(data['phone']).strip()
    if 'department' in data and str(data['department']).strip():
        updates['department'] = str(data['department']).strip()
    if 'section' in data and str(data['section']).strip():
        updates['section'] = str(data['section']).strip().upper()
    if 'year' in data and str(data['year']).strip():
        updates['year'] = str(data['year']).strip()

    if 'cgpa' in data and data['cgpa'] is not None and str(data['cgpa']).strip() != '':
        try:
            updates['cgpa'] = float(data['cgpa'])
        except ValueError:
            return jsonify({'success': False, 'error': 'CGPA must be numeric.'}), 400

    if 'attendance' in data and data['attendance'] is not None and str(data['attendance']).strip() != '':
        try:
            att_val = float(str(data['attendance']).replace('%', '').strip())
            updates['attendance_percentage'] = att_val
            updates['last_academic_update'] = datetime.now()
        except ValueError:
            return jsonify({'success': False, 'error': 'Attendance must be numeric.'}), 400

    if 'cat1' in data:
        updates['cat1_marks'] = float(data['cat1']) if data['cat1'] is not None and str(data['cat1']).strip() != '' else None
    if 'cat2' in data:
        updates['cat2_marks'] = float(data['cat2']) if data['cat2'] is not None and str(data['cat2']).strip() != '' else None
    if 'cat3' in data:
        updates['cat3_marks'] = float(data['cat3']) if data['cat3'] is not None and str(data['cat3']).strip() != '' else None

    updated_user = UserModel.update_user(target['id'], updates)

    # Sync AcademicRecordModel
    acad_sync = {
        'updated_by': ci_user.get('id'),
        'updated_by_name': ci_user.get('name')
    }
    if 'name' in updates:
        acad_sync['student_name'] = updates['name']
    if 'attendance_percentage' in updates:
        acad_sync['attendance_percentage'] = updates['attendance_percentage']
    if 'cgpa' in updates:
        acad_sync['cgpa'] = updates['cgpa']
    if 'cat1_marks' in updates:
        acad_sync['cat1_marks'] = updates['cat1_marks']
    if 'cat2_marks' in updates:
        acad_sync['cat2_marks'] = updates['cat2_marks']
    if 'cat3_marks' in updates:
        acad_sync['cat3_marks'] = updates['cat3_marks']

    AcademicRecordModel.update_student_academics(target['id'], acad_sync)

    return jsonify({
        'success': True,
        'message': f"Student details for '{target.get('identifier')}' updated successfully.",
        'student': UserModel.to_safe_dict(updated_user)
    }), 200


@class_incharge_bp.route('/student-management/students/<student_id>/status', methods=['PATCH'])
@role_required('Class Incharge', 'Admin')
def toggle_student_status(student_id):
    """Activate or deactivate student account."""
    data = request.get_json(silent=True) or {}
    new_status = data.get('status', '').strip().upper()
    if new_status not in ['ACTIVE', 'DISABLED']:
        return jsonify({'success': False, 'error': "Invalid status. Must be 'ACTIVE' or 'DISABLED'."}), 400

    target = UserModel.get_by_id(student_id) or UserModel.get_by_identifier(student_id)
    if not target:
        return jsonify({'success': False, 'error': 'Student not found.'}), 404

    success = UserModel.set_account_status(target['id'], new_status)
    if not success:
        return jsonify({'success': False, 'error': 'Failed to update student status.'}), 500

    return jsonify({
        'success': True,
        'message': f"Student account '{target.get('identifier')}' status set to {new_status}.",
        'status': new_status
    }), 200


@class_incharge_bp.route('/student-management/students/<student_id>/reset-password', methods=['POST'])
@role_required('Class Incharge', 'Admin')
def reset_student_password(student_id):
    """Reset a student's password to default 'password123' or custom password."""
    data = request.get_json(silent=True) or {}
    new_password = (data.get('password') or 'password123').strip()

    if len(new_password) < 6:
        return jsonify({'success': False, 'error': 'Password must be at least 6 characters long.'}), 400

    target = UserModel.get_by_id(student_id) or UserModel.get_by_identifier(student_id)
    if not target:
        return jsonify({'success': False, 'error': 'Student not found.'}), 404

    success, msg = UserModel.change_password(target['id'], new_password)
    if not success:
        return jsonify({'success': False, 'error': msg}), 400

    return jsonify({
        'success': True,
        'message': f"Password for '{target.get('name')}' ({target.get('identifier')}) reset successfully."
    }), 200


@class_incharge_bp.route('/student-management/students/<student_id>/profile', methods=['GET'])
@role_required('Class Incharge', 'Admin')
def get_student_full_profile(student_id):
    """
    Retrieve complete academic and OD profile for View Profile modal:
    - Basic demographics
    - Academic marks & attendance
    - OD statistics (total, approved, rejected, pending)
    - OD requests history
    """
    user_doc = UserModel.get_by_id(student_id) or UserModel.get_by_identifier(student_id)
    if not user_doc:
        return jsonify({'success': False, 'error': 'Student not found.'}), 404

    sid = user_doc.get('id')
    reg_no = user_doc.get('identifier') or sid

    acad_doc = AcademicRecordModel.get_by_student_id(sid) or AcademicRecordModel.get_by_register_number(reg_no)
    att = acad_doc.get('attendance_percentage') if acad_doc else user_doc.get('attendance_percentage', 0.0)
    c1 = acad_doc.get('cat1_marks') if acad_doc else user_doc.get('cat1_marks')
    c2 = acad_doc.get('cat2_marks') if acad_doc else user_doc.get('cat2_marks')
    c3 = acad_doc.get('cat3_marks') if acad_doc else user_doc.get('cat3_marks')
    cgpa = user_doc.get('cgpa', 0.0)

    eligibility = calculate_od_eligibility(sid, requested_od_days=0.0)
    od_requests = ODRequestModel.list_by_student(sid)

    total_od = len(od_requests)
    approved_od = len([r for r in od_requests if 'Approved' in str(r.get('status', ''))])
    rejected_od = len([r for r in od_requests if 'Rejected' in str(r.get('status', ''))])
    pending_od = total_od - approved_od - rejected_od

    profile_data = {
        'basic_info': {
            'id': sid,
            'name': user_doc.get('name'),
            'register_number': reg_no,
            'email': user_doc.get('email'),
            'department': user_doc.get('department'),
            'section': user_doc.get('section', 'A'),
            'class': f"{user_doc.get('department', '')} - {user_doc.get('section', 'A')}",
            'year': user_doc.get('year', 'III Year'),
            'phone': user_doc.get('phone', ''),
            'avatar': user_doc.get('avatar'),
            'status': user_doc.get('account_status', 'ACTIVE'),
            'created_at': user_doc.get('created_at')
        },
        'academics': {
            'cgpa': cgpa,
            'attendance_percentage': att,
            'cat1_marks': c1,
            'cat2_marks': c2,
            'cat3_marks': c3,
            'last_updated': acad_doc.get('updated_at') if acad_doc else user_doc.get('updated_at'),
            'eligibility': eligibility
        },
        'od_summary': {
            'total_requests': total_od,
            'approved_requests': approved_od,
            'rejected_requests': rejected_od,
            'pending_requests': pending_od,
            'history': od_requests
        }
    }

    return jsonify({
        'success': True,
        'profile': profile_data
    }), 200


# ─── 4. BULK STUDENT ACCOUNT CREATION VIA EXCEL/CSV ───────────────────────────

@class_incharge_bp.route('/student-management/students/preview-upload', methods=['POST'])
@role_required('Class Incharge', 'Admin')
def preview_students_upload():
    """
    Parse Excel/CSV for bulk student account creation.
    Performs duplicate detection:
    - In-file duplicate Register Numbers & Emails
    - Existing database Register Numbers & Emails
    - Validates email syntax, CGPA, attendance ranges
    Returns detailed summary and row-by-row status with failure reasons.
    """
    ci_user = current_user
    file = request.files.get('file') or request.files.get('excel')
    if not file or not file.filename:
        return jsonify({'success': False, 'error': 'Please select an Excel or CSV file to upload.'}), 400

    filename = secure_filename(file.filename) or 'students.xlsx'
    rows, err = parse_tabular_file(file.stream, filename)
    if err:
        return jsonify({'success': False, 'error': err}), 400

    preview = validate_and_preview_students(rows, ci_user)
    if not preview.get('success'):
        return jsonify(preview), 400

    preview['filename'] = filename
    return jsonify(preview), 200


@class_incharge_bp.route('/student-management/students/confirm-upload', methods=['POST'])
@role_required('Class Incharge', 'Admin')
def confirm_students_upload():
    """
    Confirm and commit validated student rows into database.
    Creates accounts in users collection, initial academic records,
    and logs an audit trail in student_imports_history collection.
    """
    ci_user = current_user
    data = request.get_json(silent=True) or {}
    rows = data.get('rows') or []
    filename = data.get('filename') or 'students_import.xlsx'

    if not rows:
        return jsonify({'success': False, 'error': 'No student rows provided for import.'}), 400

    # Only process rows that have status 'valid'
    valid_rows = [r for r in rows if r.get('status') == 'valid']
    if not valid_rows:
        return jsonify({'success': False, 'error': 'No valid records ready for import.'}), 400

    result = import_students_confirmed(valid_rows, ci_user, filename)
    return jsonify(result), (200 if result.get('success') else 400)


# ─── 5. WEEKLY ATTENDANCE MANAGEMENT VIA EXCEL ────────────────────────────────

@class_incharge_bp.route('/student-management/attendance/preview-upload', methods=['POST'])
@role_required('Class Incharge', 'Admin')
def preview_attendance_upload():
    """
    Parse weekly attendance Excel.
    Matches student using Register Number as primary key.
    Validates numeric percentage (0-100).
    Returns preview summary with previous vs new attendance and error reasons.
    """
    ci_user = current_user
    file = request.files.get('file') or request.files.get('excel')
    if not file or not file.filename:
        return jsonify({'success': False, 'error': 'Please select an attendance Excel or CSV file to upload.'}), 400

    filename = secure_filename(file.filename) or 'weekly_attendance.xlsx'
    rows, err = parse_tabular_file(file.stream, filename)
    if err:
        return jsonify({'success': False, 'error': err}), 400

    preview = validate_and_preview_attendance(rows, ci_user)
    if not preview.get('success'):
        return jsonify(preview), 400

    preview['filename'] = filename
    return jsonify(preview), 200


@class_incharge_bp.route('/student-management/attendance/confirm-upload', methods=['POST'])
@role_required('Class Incharge', 'Admin')
def confirm_attendance_upload():
    """
    Commit weekly attendance updates.
    Updates attendance_percentage in both users and academic_records.
    OD eligibility rules immediately reflect the new values.
    Logs upload audit in attendance_upload_history collection.
    """
    ci_user = current_user
    data = request.get_json(silent=True) or {}
    rows = data.get('rows') or []
    filename = data.get('filename') or 'weekly_attendance.xlsx'
    week_date = data.get('week_date', '')

    if not rows:
        return jsonify({'success': False, 'error': 'No attendance rows provided for update.'}), 400

    matched_rows = [r for r in rows if r.get('status') == 'matched']
    if not matched_rows:
        return jsonify({'success': False, 'error': 'No matched student records ready to update.'}), 400

    result = update_attendance_confirmed(matched_rows, ci_user, filename, week_date=week_date)
    return jsonify(result), (200 if result.get('success') else 400)


# ─── 6. STUDENT CAT MARKS MANAGEMENT VIA EXCEL ────────────────────────────────

@class_incharge_bp.route('/student-management/marks/preview-upload', methods=['POST'])
@role_required('Class Incharge', 'Admin')
def preview_marks_upload():
    """
    Parse CAT Marks Excel file.
    Matches student using Register Number.
    Validates CAT 1, CAT 2, CAT 3 scores (0-100).
    Returns preview summary with previous vs new marks.
    """
    ci_user = current_user
    file = request.files.get('file') or request.files.get('excel')
    if not file or not file.filename:
        return jsonify({'success': False, 'error': 'Please select a marks Excel or CSV file to upload.'}), 400

    filename = secure_filename(file.filename) or 'student_marks.xlsx'
    rows, err = parse_tabular_file(file.stream, filename)
    if err:
        return jsonify({'success': False, 'error': err}), 400

    preview = validate_and_preview_marks(rows, ci_user)
    if not preview.get('success'):
        return jsonify(preview), 400

    preview['filename'] = filename
    return jsonify(preview), 200


@class_incharge_bp.route('/student-management/marks/confirm-upload', methods=['POST'])
@role_required('Class Incharge', 'Admin')
def confirm_marks_upload():
    """
    Commit CAT marks updates.
    Updates cat1_marks, cat2_marks, cat3_marks in users and academic_records.
    Reflects instantly in Student Dashboard, CAT Marks, and Student Profile.
    Logs audit trail in marks_upload_history collection.
    """
    ci_user = current_user
    data = request.get_json(silent=True) or {}
    rows = data.get('rows') or []
    filename = data.get('filename') or 'student_marks.xlsx'

    if not rows:
        return jsonify({'success': False, 'error': 'No marks rows provided for update.'}), 400

    matched_rows = [r for r in rows if r.get('status') == 'matched']
    if not matched_rows:
        return jsonify({'success': False, 'error': 'No matched student records ready to update.'}), 400

    result = update_marks_confirmed(matched_rows, ci_user, filename)
    return jsonify(result), (200 if result.get('success') else 400)


# ─── 7. UPLOAD HISTORIES ──────────────────────────────────────────────────────

@class_incharge_bp.route('/student-management/history/<history_type>', methods=['GET'])
@role_required('Class Incharge', 'Admin')
def get_ci_upload_history(history_type):
    """Retrieve audit history logs for students, attendance, or marks uploads from SQL Server."""
    h_type = (history_type or '').lower().strip()
    limit = int(request.args.get('limit', 50))

    with session_scope() as session:
        if h_type in ['students', 'student']:
            records = session.query(StudentImportHistory).order_by(StudentImportHistory.created_at.desc()).limit(limit).all()
        elif h_type in ['attendance', 'weekly_attendance']:
            records = session.query(AttendanceUploadHistory).order_by(AttendanceUploadHistory.created_at.desc()).limit(limit).all()
        elif h_type in ['marks', 'cat_marks']:
            records = session.query(MarksUploadHistory).order_by(MarksUploadHistory.created_at.desc()).limit(limit).all()
        else:
            return jsonify({'success': False, 'error': f"Unknown history type '{history_type}'."}), 400

        history_items = [r.to_dict() for r in records]

    return jsonify({
        'success': True,
        'type': h_type,
        'count': len(history_items),
        'history': history_items
    }), 200


# ─── 7b. CLASS INCHARGE DASHBOARD STATS ───────────────────────────────────────

@class_incharge_bp.route('/stats', methods=['GET'])
@role_required('Class Incharge', 'Admin')
def get_class_incharge_stats():
    """Live statistics calculated directly from SQL Server records."""
    ci_user = current_user
    all_requests = ODRequestModel.list_for_class_incharge(ci_user)

    pending_count = len([
        r for r in all_requests
        if r.get('status') == 'Mentor Approved' and r.get('currentStage') == 'Class Incharge'
    ])
    approved_count = len([r for r in all_requests if 'Approved' in str(r.get('status', ''))])
    rejected_count = len([r for r in all_requests if 'Rejected' in str(r.get('status', ''))])

    ci_dept = (ci_user.get('department') or '').strip()
    ci_sec = (ci_user.get('section') or '').strip()
    with session_scope() as session:
        q = session.query(User).filter(
            or_(
                func.lower(User.role) == 'student',
                func.lower(User.sub_role) == 'student'
            )
        )
        if ci_dept and ci_dept != 'all':
            if ci_dept.lower() in ('computer science and design', 'csd'):
                q = q.filter(func.lower(User.department).in_(['computer science and design', 'csd']))
            else:
                q = q.filter(func.lower(User.department) == ci_dept.lower())
        total_students = q.count()

        # Check attendance alerts (< 75%)
        low_att_count = session.query(User).filter(
            or_(
                func.lower(User.role) == 'student',
                func.lower(User.sub_role) == 'student'
            ),
            User.attendance_percentage < 75.0
        ).count()

    return jsonify({
        'success': True,
        'stats': {
            'totalStudents': total_students,
            'pendingApprovals': pending_count,
            'approvedCount': approved_count,
            'rejectedCount': rejected_count,
            'totalRequests': len(all_requests),
            'attendanceAlerts': low_att_count
        }
    }), 200


# ─── 8. EXPORT FAILED ROWS REPORT ─────────────────────────────────────────────

@class_incharge_bp.route('/student-management/export-failed-report', methods=['POST'])
@role_required('Class Incharge', 'Admin')
def export_failed_report():
    """Download an Excel report of failed rows containing row number and failure reason."""
    try:
        data = request.get_json(silent=True) or {}
        failed_rows = data.get('failed_rows') or []
        upload_type = data.get('upload_type') or 'Upload'

        if not failed_rows:
            return jsonify({'success': False, 'error': 'No failed rows provided for report generation.'}), 400

        stream = generate_failed_rows_report(failed_rows, upload_type=upload_type)
        filename = f"failed_records_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

        return send_file(
            stream,
            as_attachment=True,
            download_name=filename,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        return jsonify({'success': False, 'error': f"Failed to generate report: {str(e)}"}), 500


# ─── 9. CLASS INCHARGE CERTIFICATES & VERIFICATION ───────────────────────────

@class_incharge_bp.route('/certificates', methods=['GET'])
@role_required('Class Incharge', 'Admin')
def get_class_incharge_certificates():
    """Retrieve certificates awaiting or completed verification within Class Incharge's department/ward."""
    ci_user = current_user
    ci_dept = (ci_user.get('department') or '').strip().lower()

    with session_scope() as session:
        cert_query = session.query(Certificate).join(ODRequest, Certificate.request_id == ODRequest.id)
        if ci_dept and ci_dept != 'all':
            if ci_dept in ('computer science and design', 'csd'):
                cert_query = cert_query.filter(func.lower(ODRequest.department).in_(['computer science and design', 'csd']))
            else:
                cert_query = cert_query.filter(func.lower(ODRequest.department) == ci_dept)
        certs = cert_query.order_by(Certificate.created_at.desc()).all()
        cert_list = [c.to_dict() for c in certs]

        # Also include OD requests that have certificate_url but no entry in certificates table yet
        od_reqs = session.query(ODRequest).filter(
            ODRequest.certificate_url.isnot(None),
            ODRequest.certificate_url != ''
        )
        if ci_dept and ci_dept != 'all':
            if ci_dept in ('computer science and design', 'csd'):
                od_reqs = od_reqs.filter(func.lower(ODRequest.department).in_(['computer science and design', 'csd']))
            else:
                od_reqs = od_reqs.filter(func.lower(ODRequest.department) == ci_dept)

        existing_req_ids = {c.get('request_id') for c in cert_list}
        for req in od_reqs.all():
            if req.id not in existing_req_ids:
                fname = os.path.basename(req.certificate_url or 'certificate.pdf')
                cert_list.append({
                    'id': f"CERT_{req.id}",
                    'requestId': req.id,
                    'request_id': req.id,
                    'studentId': req.student_id,
                    'student_id': req.student_id,
                    'studentRegNo': req.student_reg_no,
                    'student_reg_no': req.student_reg_no,
                    'studentName': req.student_name,
                    'student_name': req.student_name,
                    'eventName': req.event_name,
                    'event_name': req.event_name,
                    'certificateName': fname,
                    'certificate_file_url': req.certificate_url,
                    'certificateUrl': req.certificate_url,
                    'status': req.certificate_status or 'Pending Verification',
                    'uploadDate': to_iso(req.certificate_submitted_at or req.updated_at),
                    'upload_date': to_iso(req.certificate_submitted_at or req.updated_at),
                })

    return jsonify({'success': True, 'certificates': cert_list, 'count': len(cert_list)}), 200


@class_incharge_bp.route('/od-requests/<request_id>/verify-certificate', methods=['POST'])
@role_required('Class Incharge', 'Admin')
def verify_student_certificate_ci(request_id):
    """
    Verify student participation certificate as Class Incharge.
    Status can be 'Verified' or 'Rejected'.
    """
    ci_user = current_user
    data = request.get_json(silent=True) or {}
    status = (data.get('status') or 'Verified').strip()
    remarks = (data.get('remarks') or '').strip()

    updated_req, err = ODRequestModel.verify_certificate(request_id, ci_user, status, remarks)
    if err:
        return jsonify({'success': False, 'error': err}), 400

    return jsonify({
        'success': True,
        'message': f"Certificate successfully {status.lower()} by {ci_user.get('name')}.",
        'request': updated_req
    }), 200

