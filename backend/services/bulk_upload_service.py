import os
import io
import re
import csv
import uuid
import time
from datetime import datetime
from typing import Dict, List, Any, Tuple, Optional

import openpyxl
from openpyxl.worksheet.worksheet import Worksheet
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from backend.models.user import UserModel, validate_college_email
from backend.models.academic_record import AcademicRecordModel
from backend.database.mongodb import users_collection, academic_records_collection

# In-memory preview token storage with TTL
BULK_PREVIEW_CACHE: Dict[str, Dict[str, Any]] = {}
CACHE_TTL_SECONDS = 3600  # 1 hour


def _clean_expired_cache():
    now = time.time()
    expired = [k for k, v in BULK_PREVIEW_CACHE.items() if now - v.get('timestamp', 0) > CACHE_TTL_SECONDS]
    for k in expired:
        BULK_PREVIEW_CACHE.pop(k, None)


def _sanitize_formula(val: Any) -> str:
    """Protect against spreadsheet formula injection by prepending ' if string starts with dangerous chars."""
    if val is None:
        return ""
    text = str(val).strip()
    if text and text[0] in ('=', '+', '-', '@', '\t', '\r'):
        return f"'{text}"
    return text


# ─────────────────────────────────────────────────────────────────────────────
# 1. TEMPLATE GENERATORS
# ─────────────────────────────────────────────────────────────────────────────

STUDENT_HEADERS = [
    "Roll Number",
    "Student Name",
    "Username",
    "Email Address",
    "Department",
    "Class / Section",
    "Year of Study",
    "Semester",
    "Password (Optional)"
]

FACULTY_HEADERS = [
    "Faculty ID / Employee ID",
    "Faculty Name",
    "Username",
    "Email Address",
    "Department",
    "Designation",
    "Assigned Role",
    "Password (Optional)"
]

VALID_DEPARTMENTS = [
    "Computer Science and Design",
    "Computer Science and Engineering",
    "Information Technology",
    "Electronics and Communication Engineering",
    "Electrical and Electronics Engineering",
    "Mechanical Engineering",
    "Biomedical Engineering",
    "Artificial Intelligence and Machine Learning"
]

VALID_FACULTY_ROLES = ["Mentor", "Class Incharge", "HOD"]
VALID_FACULTY_DESIGNATIONS = [
    "Assistant Professor",
    "Associate Professor",
    "Professor",
    "Professor & HOD"
]


def generate_student_template_excel() -> io.BytesIO:
    """Generate an official, styled Excel template for student bulk uploads."""
    wb = openpyxl.Workbook()
    ws = wb.active
    if not isinstance(ws, Worksheet):
        ws = wb.create_sheet("Students Template")
    assert isinstance(ws, Worksheet)
    ws.title = "Students Template"

    ws.append(STUDENT_HEADERS)

    # Style header row (Teal / Slate Theme)
    header_fill = PatternFill(start_color="0F766E", end_color="0F766E", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    for col_idx in range(1, len(STUDENT_HEADERS) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border

    # Sample rows demonstrating formats
    sample_rows = [
        ["23CSD091", "Vignesh R", "23CSD091", "vignesh.23csd@rajalakshmi.edu.in", "Computer Science and Design", "A", "III Year", "Semester 5", ""],
        ["23CSD092", "Kavya M", "23CSD092", "kavya.23csd@rajalakshmi.edu.in", "Computer Science and Design", "A", "III Year", "Semester 5", "pass2026Secure"],
        ["23CSD093", "Arun Kumar S", "23CSD093", "arun.23csd@rajalakshmi.edu.in", "Computer Science and Engineering", "B", "II Year", "Semester 3", ""],
    ]

    for row_data in sample_rows:
        ws.append(row_data)

    for row in ws.iter_rows(min_row=2, max_row=len(sample_rows) + 1, min_col=1, max_col=len(STUDENT_HEADERS)):
        for cell in row:
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="left", vertical="center")

    # Column widths
    col_widths = {
        "A": 18, "B": 24, "C": 18, "D": 36, "E": 34,
        "F": 16, "G": 16, "H": 16, "I": 22
    }
    for col_letter, width in col_widths.items():
        ws.column_dimensions[col_letter].width = width

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


def generate_student_template_csv() -> io.BytesIO:
    """Generate CSV student template."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(STUDENT_HEADERS)
    writer.writerow(["23CSD091", "Vignesh R", "23CSD091", "vignesh.23csd@rajalakshmi.edu.in", "Computer Science and Design", "A", "III Year", "Semester 5", ""])
    writer.writerow(["23CSD092", "Kavya M", "23CSD092", "kavya.23csd@rajalakshmi.edu.in", "Computer Science and Design", "A", "III Year", "Semester 5", "pass2026Secure"])
    
    bytes_output = io.BytesIO(output.getvalue().encode('utf-8'))
    bytes_output.seek(0)
    return bytes_output


def generate_faculty_template_excel() -> io.BytesIO:
    """Generate an official, styled Excel template for faculty bulk uploads."""
    wb = openpyxl.Workbook()
    ws = wb.active
    if not isinstance(ws, Worksheet):
        ws = wb.create_sheet("Faculty Template")
    assert isinstance(ws, Worksheet)
    ws.title = "Faculty Template"

    ws.append(FACULTY_HEADERS)

    # Style header row (Navy / Slate Theme)
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    for col_idx in range(1, len(FACULTY_HEADERS) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border

    sample_rows = [
        ["EMP-CSD-109", "Dr. S. Meenakshi", "EMP-CSD-109", "meenakshi.s@rajalakshmi.edu.in", "Computer Science and Design", "Associate Professor", "Mentor", ""],
        ["EMP-CSD-110", "Mr. R. Balaji", "EMP-CSD-110", "balaji.r@rajalakshmi.edu.in", "Computer Science and Design", "Assistant Professor", "Class Incharge", ""],
        ["EMP-CSE-201", "Dr. P. Venkatesh", "EMP-CSE-201", "venkatesh.p@rajalakshmi.edu.in", "Computer Science and Engineering", "Professor", "HOD", "facPass2026!"],
    ]

    for row_data in sample_rows:
        ws.append(row_data)

    for row in ws.iter_rows(min_row=2, max_row=len(sample_rows) + 1, min_col=1, max_col=len(FACULTY_HEADERS)):
        for cell in row:
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="left", vertical="center")

    col_widths = {
        "A": 26, "B": 26, "C": 20, "D": 36, "E": 34,
        "F": 24, "G": 18, "H": 22
    }
    for col_letter, width in col_widths.items():
        ws.column_dimensions[col_letter].width = width

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


def generate_faculty_template_csv() -> io.BytesIO:
    """Generate CSV faculty template."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(FACULTY_HEADERS)
    writer.writerow(["EMP-CSD-109", "Dr. S. Meenakshi", "EMP-CSD-109", "meenakshi.s@rajalakshmi.edu.in", "Computer Science and Design", "Associate Professor", "Mentor", ""])
    writer.writerow(["EMP-CSD-110", "Mr. R. Balaji", "EMP-CSD-110", "balaji.r@rajalakshmi.edu.in", "Computer Science and Design", "Assistant Professor", "Class Incharge", ""])

    bytes_output = io.BytesIO(output.getvalue().encode('utf-8'))
    bytes_output.seek(0)
    return bytes_output


# ─────────────────────────────────────────────────────────────────────────────
# 2. RAW FILE PARSING & NORMALIZATION
# ─────────────────────────────────────────────────────────────────────────────

def _read_table_from_stream(file_stream: io.BytesIO, filename: str) -> Tuple[List[str], List[List[Any]], Optional[str]]:
    """
    Extract headers and rows from either .xlsx, .xls, or .csv file stream.
    Returns (headers, data_rows, error_message).
    """
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    
    if ext == 'csv':
        try:
            content = file_stream.read().decode('utf-8-sig', errors='replace')
            reader = csv.reader(io.StringIO(content))
            raw_rows = list(reader)
            if not raw_rows:
                return [], [], "CSV file is empty."
            headers = [h.strip() for h in raw_rows[0] if h is not None]
            rows = raw_rows[1:]
            return headers, rows, None
        except Exception as e:
            return [], [], f"Failed to read CSV file: {str(e)}"

    elif ext in ['xlsx', 'xls']:
        try:
            wb = openpyxl.load_workbook(file_stream, data_only=False)
            ws = wb.active
            if not isinstance(ws, Worksheet):
                return [], [], "No active worksheet found in Excel file."
            
            raw_rows = list(ws.iter_rows(values_only=True))
            if not raw_rows:
                return [], [], "Excel spreadsheet is empty."
            
            headers = [str(h).strip() if h is not None else "" for h in raw_rows[0]]
            # Remove trailing empty columns in headers
            while headers and not headers[-1]:
                headers.pop()
            
            rows = []
            for r in raw_rows[1:]:
                # Check if entire row is empty
                if not any(c is not None and str(c).strip() != "" for c in r):
                    continue
                rows.append(list(r[:len(headers)]))
            return headers, rows, None
        except Exception as e:
            return [], [], f"Failed to read Excel file: {str(e)}"
    else:
        return [], [], f"Unsupported file extension '{ext}'. Only .xlsx, .xls, and .csv are supported."


def _normalize_year(raw_val: Any) -> str:
    s = str(raw_val or '').strip().upper()
    if not s:
        return "III Year"
    if any(k in s for k in ["IV", "4", "FOURTH", "FINAL"]):
        return "IV Year"
    if any(k in s for k in ["III", "3", "THIRD"]):
        return "III Year"
    if any(k in s for k in ["II", "2", "SECOND"]):
        return "II Year"
    if any(k in s for k in ["I", "1", "FIRST"]):
        return "I Year"
    return str(raw_val).strip()


def _normalize_section(raw_val: Any) -> str:
    s = str(raw_val or '').strip().upper()
    s = s.replace("SECTION", "").replace("SEC", "").strip()
    return s if s else "A"


def _normalize_semester(raw_val: Any) -> str:
    s = str(raw_val or '').strip()
    if not s:
        return "Semester 5"
    if not s.lower().startswith("semester") and not s.lower().startswith("sem"):
        return f"Semester {s}"
    return s


# ─────────────────────────────────────────────────────────────────────────────
# 3. STUDENT BULK PARSER & VALIDATOR
# ─────────────────────────────────────────────────────────────────────────────

def parse_and_validate_student_file(file_stream: io.BytesIO, filename: str) -> Dict[str, Any]:
    """
    Parse student spreadsheet, validate every row against existing schema and MongoDB,
    and return preview rows with clear row-level error indicators.
    """
    headers, raw_rows, err = _read_table_from_stream(file_stream, filename)
    if err:
        return {'success': False, 'error': err}

    # Map column headers flexibly
    header_map = {}
    for idx, h in enumerate(headers):
        clean_h = re.sub(r'[^a-zA-Z0-9]', '', h.lower())
        if clean_h in ['rollnumber', 'registerno', 'registernumber', 'regno', 'rollno', 'identifier', 'studentid']:
            header_map['roll_number'] = idx
        elif clean_h in ['studentname', 'name', 'fullname', 'candidatename']:
            header_map['name'] = idx
        elif clean_h in ['username', 'uname']:
            header_map['username'] = idx
        elif clean_h in ['emailaddress', 'email', 'collegeemail', 'officialemail']:
            header_map['email'] = idx
        elif clean_h in ['department', 'dept', 'branch']:
            header_map['department'] = idx
        elif clean_h in ['classsection', 'section', 'class', 'sec']:
            header_map['section'] = idx
        elif clean_h in ['yearofstudy', 'year', 'studyyear']:
            header_map['year'] = idx
        elif clean_h in ['semester', 'sem']:
            header_map['semester'] = idx
        elif clean_h in ['password', 'passwordoptional', 'pwd']:
            header_map['password'] = idx

    # Check required columns
    missing_cols = []
    for req in ['roll_number', 'name', 'email']:
        if req not in header_map:
            missing_cols.append(req.replace('_', ' ').title())

    if missing_cols:
        return {
            'success': False,
            'error': f"Missing required column(s): {', '.join(missing_cols)}. Please use the official template."
        }

    # Track seen identifiers in file to flag intra-file duplicates
    seen_rolls = {}
    seen_emails = {}
    seen_usernames = {}

    parsed_rows = []
    errors_list = []

    valid_count = 0
    invalid_count = 0
    duplicate_count = 0

    for row_idx, r in enumerate(raw_rows, start=2):
        row_errors = []

        def get_val(key, default=""):
            pos = header_map.get(key)
            if pos is not None and pos < len(r) and r[pos] is not None:
                return str(r[pos]).strip()
            return default

        raw_roll = get_val('roll_number')
        raw_name = get_val('name')
        raw_email = get_val('email')
        raw_username = get_val('username') or raw_roll
        raw_dept = get_val('department', 'Computer Science and Design')
        raw_sec = _normalize_section(get_val('section', 'A'))
        raw_year = _normalize_year(get_val('year', 'III Year'))
        raw_sem = _normalize_semester(get_val('semester', 'Semester 5'))
        raw_pwd = get_val('password')

        # 1. Roll Number Validation
        clean_roll = raw_roll.upper()
        if not clean_roll:
            row_errors.append("Roll Number is required and cannot be empty.")
        else:
            if clean_roll in seen_rolls:
                row_errors.append(f"Duplicate Roll Number '{clean_roll}' in file (first seen at row {seen_rolls[clean_roll]}).")
            else:
                seen_rolls[clean_roll] = row_idx

        # 2. Name Validation
        if not raw_name:
            row_errors.append("Student Name is required.")

        # 3. Email Validation
        clean_email = raw_email.lower()
        if not clean_email:
            row_errors.append("College Email is required.")
        else:
            is_valid_email, norm_email = validate_college_email(clean_email)
            if not is_valid_email:
                row_errors.append(f"Invalid email '{clean_email}'. Student email must belong to @rajalakshmi.edu.in domain.")
            else:
                clean_email = norm_email
                if clean_email in seen_emails:
                    row_errors.append(f"Duplicate Email '{clean_email}' in file (first seen at row {seen_emails[clean_email]}).")
                else:
                    seen_emails[clean_email] = row_idx

        # 4. Username Validation
        clean_username = raw_username.upper()
        if clean_username in seen_usernames:
            row_errors.append(f"Duplicate Username '{clean_username}' in file (first seen at row {seen_usernames[clean_username]}).")
        else:
            seen_usernames[clean_username] = row_idx

        # 5. Password Validation
        if raw_pwd and len(raw_pwd) < 6:
            row_errors.append("Password must be at least 6 characters long if provided.")

        # 6. Database Collision / Duplicate Check
        is_db_duplicate = False
        db_dup_reason = ""
        if clean_roll:
            existing_user_roll = UserModel.get_by_identifier(clean_roll)
            if existing_user_roll:
                is_db_duplicate = True
                db_dup_reason = f"Roll Number '{clean_roll}' already exists in database ({existing_user_roll.get('name')})."

        if not is_db_duplicate and clean_email:
            existing_user_email = UserModel.get_by_email(clean_email)
            if existing_user_email:
                is_db_duplicate = True
                db_dup_reason = f"Email '{clean_email}' already registered to another user ({existing_user_email.get('identifier')})."

        if is_db_duplicate:
            row_errors.append(db_dup_reason)

        # Status categorization
        if is_db_duplicate:
            validation_status = "DUPLICATE"
            duplicate_count += 1
        elif row_errors:
            validation_status = "INVALID"
            invalid_count += 1
        else:
            validation_status = "VALID"
            valid_count += 1

        parsed_row = {
            'row_number': row_idx,
            'roll_number': clean_roll,
            'name': raw_name,
            'username': clean_username,
            'email': clean_email,
            'department': raw_dept,
            'section': raw_sec,
            'year': raw_year,
            'semester': raw_sem,
            'has_custom_password': bool(raw_pwd),
            'password_preview': "Custom (min 6 chars)" if raw_pwd else "Default (password123)",
            # Internal only (stripped before sending sensitive fields if needed)
            '_raw_password': raw_pwd or "password123",
            'validation_status': validation_status,
            'errors': row_errors
        }
        parsed_rows.append(parsed_row)

        if row_errors:
            errors_list.append({
                'row': row_idx,
                'identifier': clean_roll or f"Row {row_idx}",
                'name': raw_name or "N/A",
                'email': clean_email or "N/A",
                'reason': "; ".join(row_errors)
            })

    preview_token = f"PREV_STU_{uuid.uuid4().hex[:12].upper()}"
    _clean_expired_cache()
    BULK_PREVIEW_CACHE[preview_token] = {
        'entity_type': 'student',
        'filename': filename,
        'rows': parsed_rows,
        'errors': errors_list,
        'summary': {
            'total_rows': len(parsed_rows),
            'valid_rows': valid_count,
            'invalid_rows': invalid_count,
            'duplicate_rows': duplicate_count
        },
        'timestamp': time.time()
    }

    # Prepare safe response rows (do not expose internal _raw_password)
    safe_rows = []
    for pr in parsed_rows:
        copy_row = dict(pr)
        copy_row.pop('_raw_password', None)
        safe_rows.append(copy_row)

    return {
        'success': True,
        'preview_token': preview_token,
        'filename': filename,
        'summary': {
            'total_rows': len(parsed_rows),
            'valid_rows': valid_count,
            'invalid_rows': invalid_count,
            'duplicate_rows': duplicate_count
        },
        'rows': safe_rows,
        'errors': errors_list,
        'message': f"Parsed {len(parsed_rows)} student rows. {valid_count} valid, {invalid_count} invalid, {duplicate_count} duplicate(s)."
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. FACULTY BULK PARSER & VALIDATOR
# ─────────────────────────────────────────────────────────────────────────────

def parse_and_validate_faculty_file(file_stream: io.BytesIO, filename: str) -> Dict[str, Any]:
    """
    Parse faculty spreadsheet, validate every row, ensure role integrity,
    and prevent unauthorized privilege escalations.
    """
    headers, raw_rows, err = _read_table_from_stream(file_stream, filename)
    if err:
        return {'success': False, 'error': err}

    header_map = {}
    for idx, h in enumerate(headers):
        clean_h = re.sub(r'[^a-zA-Z0-9]', '', h.lower())
        if clean_h in ['facultyid', 'employeeid', 'empid', 'facultyidemployeeid', 'identifier']:
            header_map['faculty_id'] = idx
        elif clean_h in ['facultyname', 'name', 'fullname']:
            header_map['name'] = idx
        elif clean_h in ['username', 'uname']:
            header_map['username'] = idx
        elif clean_h in ['emailaddress', 'email', 'officialemail']:
            header_map['email'] = idx
        elif clean_h in ['department', 'dept']:
            header_map['department'] = idx
        elif clean_h in ['designation', 'desig', 'post']:
            header_map['designation'] = idx
        elif clean_h in ['assignedrole', 'role', 'facultyrole']:
            header_map['role'] = idx
        elif clean_h in ['password', 'passwordoptional', 'pwd']:
            header_map['password'] = idx

    missing_cols = []
    for req in ['faculty_id', 'name', 'email']:
        if req not in header_map:
            missing_cols.append(req.replace('_', ' ').title())

    if missing_cols:
        return {
            'success': False,
            'error': f"Missing required column(s): {', '.join(missing_cols)}. Please use the official template."
        }

    seen_ids = {}
    seen_emails = {}
    seen_usernames = {}

    parsed_rows = []
    errors_list = []

    valid_count = 0
    invalid_count = 0
    duplicate_count = 0

    for row_idx, r in enumerate(raw_rows, start=2):
        row_errors = []

        def get_val(key, default=""):
            pos = header_map.get(key)
            if pos is not None and pos < len(r) and r[pos] is not None:
                return str(r[pos]).strip()
            return default

        raw_id = get_val('faculty_id')
        raw_name = get_val('name')
        raw_email = get_val('email')
        raw_username = get_val('username') or raw_id
        raw_dept = get_val('department', 'Computer Science and Design')
        raw_desig = get_val('designation', 'Assistant Professor')
        raw_role = get_val('role', 'Mentor')
        raw_pwd = get_val('password')

        # 1. Faculty ID
        clean_id = raw_id.upper()
        if not clean_id:
            row_errors.append("Faculty ID / Employee ID is required.")
        else:
            if clean_id in seen_ids:
                row_errors.append(f"Duplicate Faculty ID '{clean_id}' in file (first seen at row {seen_ids[clean_id]}).")
            else:
                seen_ids[clean_id] = row_idx

        # 2. Name
        if not raw_name:
            row_errors.append("Faculty Name is required.")

        # 3. Email
        clean_email = raw_email.lower()
        if not clean_email:
            row_errors.append("Official Email is required.")
        else:
            is_valid_email, norm_email = validate_college_email(clean_email)
            if not is_valid_email:
                row_errors.append(f"Invalid email '{clean_email}'. Faculty email must belong to @rajalakshmi.edu.in domain.")
            else:
                clean_email = norm_email
                if clean_email in seen_emails:
                    row_errors.append(f"Duplicate Email '{clean_email}' in file (first seen at row {seen_emails[clean_email]}).")
                else:
                    seen_emails[clean_email] = row_idx

        # 4. Username
        clean_username = raw_username.upper()
        if clean_username in seen_usernames:
            row_errors.append(f"Duplicate Username '{clean_username}' in file (first seen at row {seen_usernames[clean_username]}).")
        else:
            seen_usernames[clean_username] = row_idx

        # 5. Role Security & Whitelist Check
        # Strictly forbid Admin escalation via bulk faculty upload
        role_normalized = raw_role.strip().title()
        if role_normalized.lower() in ['class incharge', 'classincharge', 'class-incharge']:
            role_normalized = 'Class Incharge'
        elif role_normalized.lower() == 'hod':
            role_normalized = 'HOD'
        elif role_normalized.lower() in ['mentor', 'faculty']:
            role_normalized = 'Mentor'

        if role_normalized not in VALID_FACULTY_ROLES:
            row_errors.append(
                f"Invalid Assigned Role '{raw_role}'. Must be one of: {', '.join(VALID_FACULTY_ROLES)}. (Admin accounts cannot be created via bulk upload)."
            )

        # 6. Password
        if raw_pwd and len(raw_pwd) < 6:
            row_errors.append("Password must be at least 6 characters long if provided.")

        # 7. Database Duplicate Check
        is_db_duplicate = False
        db_dup_reason = ""
        if clean_id:
            existing_user_id = UserModel.get_by_identifier(clean_id)
            if existing_user_id:
                is_db_duplicate = True
                db_dup_reason = f"Faculty ID '{clean_id}' already exists in database ({existing_user_id.get('name')})."

        if not is_db_duplicate and clean_email:
            existing_user_email = UserModel.get_by_email(clean_email)
            if existing_user_email:
                is_db_duplicate = True
                db_dup_reason = f"Email '{clean_email}' already registered to another user ({existing_user_email.get('identifier')})."

        if is_db_duplicate:
            row_errors.append(db_dup_reason)

        if is_db_duplicate:
            validation_status = "DUPLICATE"
            duplicate_count += 1
        elif row_errors:
            validation_status = "INVALID"
            invalid_count += 1
        else:
            validation_status = "VALID"
            valid_count += 1

        parsed_row = {
            'row_number': row_idx,
            'faculty_id': clean_id,
            'name': raw_name,
            'username': clean_username,
            'email': clean_email,
            'department': raw_dept,
            'designation': raw_desig,
            'role': role_normalized,
            'has_custom_password': bool(raw_pwd),
            'password_preview': "Custom (min 6 chars)" if raw_pwd else "Default (password123)",
            '_raw_password': raw_pwd or "password123",
            'validation_status': validation_status,
            'errors': row_errors
        }
        parsed_rows.append(parsed_row)

        if row_errors:
            errors_list.append({
                'row': row_idx,
                'identifier': clean_id or f"Row {row_idx}",
                'name': raw_name or "N/A",
                'email': clean_email or "N/A",
                'reason': "; ".join(row_errors)
            })

    preview_token = f"PREV_FAC_{uuid.uuid4().hex[:12].upper()}"
    _clean_expired_cache()
    BULK_PREVIEW_CACHE[preview_token] = {
        'entity_type': 'faculty',
        'filename': filename,
        'rows': parsed_rows,
        'errors': errors_list,
        'summary': {
            'total_rows': len(parsed_rows),
            'valid_rows': valid_count,
            'invalid_rows': invalid_count,
            'duplicate_rows': duplicate_count
        },
        'timestamp': time.time()
    }

    safe_rows = []
    for pr in parsed_rows:
        copy_row = dict(pr)
        copy_row.pop('_raw_password', None)
        safe_rows.append(copy_row)

    return {
        'success': True,
        'preview_token': preview_token,
        'filename': filename,
        'summary': {
            'total_rows': len(parsed_rows),
            'valid_rows': valid_count,
            'invalid_rows': invalid_count,
            'duplicate_rows': duplicate_count
        },
        'rows': safe_rows,
        'errors': errors_list,
        'message': f"Parsed {len(parsed_rows)} faculty rows. {valid_count} valid, {invalid_count} invalid, {duplicate_count} duplicate(s)."
    }


# ─────────────────────────────────────────────────────────────────────────────
# 5. IMPORT CONFIRMATION & SAFE RECORD CREATION
# ─────────────────────────────────────────────────────────────────────────────

def confirm_student_import(preview_token: str, admin_user: Any) -> Dict[str, Any]:
    """
    Atomically import valid, non-duplicate students from cached preview session.
    Skips duplicates, hashes passwords, connects academic records, and returns import tally.
    """
    cached = BULK_PREVIEW_CACHE.get(preview_token)
    if not cached or cached.get('entity_type') != 'student':
        return {'success': False, 'error': 'Preview session expired or invalid. Please re-upload your file.'}

    rows = cached.get('rows', [])
    valid_rows = [r for r in rows if r.get('validation_status') == 'VALID']

    if not valid_rows:
        return {'success': False, 'error': 'No valid student records found to import.'}

    admin_id = str(getattr(admin_user, 'get', lambda k, d=None: d)('id') or 'ADM001')
    admin_name = str(getattr(admin_user, 'get', lambda k, d=None: d)('name') or 'System Administrator')

    imported_records = []
    skipped_records = []
    failed_records = []

    for r in valid_rows:
        roll = r['roll_number']
        email = r['email']
        name = r['name']

        # Final safety check against race-condition duplicates
        if UserModel.get_by_identifier(roll) or UserModel.get_by_email(email):
            skipped_records.append({'roll': roll, 'reason': 'Account was already created in database.'})
            continue

        student_id = f"STUD_{roll}"
        user_payload = {
            'id': student_id,
            'identifier': roll,
            'username': r.get('username') or roll,
            'name': name,
            'email': email,
            'role': 'Student',
            'sub_role': 'Student',
            'department': r.get('department') or 'Computer Science and Design',
            'year': r.get('year') or 'III Year',
            'section': r.get('section') or 'A',
            'semester': r.get('semester') or 'Semester 5',
            'password': r.get('_raw_password') or 'password123',
            'email_verified': True,
            'account_status': 'ACTIVE',
            'mentor': 'Dr. A. Rajesh',
            'mentor_id': 'FAC001',
            'class_incharge': 'Mrs. K. Shanthi',
            'class_incharge_id': 'FAC002',
            'cgpa': 8.0,
            'attendance_percentage': 85.0
        }

        try:
            created = UserModel.create(user_payload)
            if not created:
                failed_records.append({'roll': roll, 'reason': 'Failed to insert student user account.'})
                continue

            # Initialize baseline academic record
            AcademicRecordModel.upsert_academic_record(
                student_id=student_id,
                register_number=roll,
                student_name=name,
                cat1=80.0,
                cat2=80.0,
                cat3=80.0,
                attendance=85.0,
                cgpa=8.0,
                updated_by_id=admin_id,
                updated_by_name=admin_name
            )
            imported_records.append(roll)
        except Exception as e:
            failed_records.append({'roll': roll, 'reason': str(e)})

    # Invalidate preview token
    BULK_PREVIEW_CACHE.pop(preview_token, None)

    return {
        'success': True,
        'message': f"Student bulk upload complete. Successfully imported {len(imported_records)} student(s).",
        'imported_count': len(imported_records),
        'skipped_count': len(skipped_records) + (cached.get('summary', {}).get('duplicate_rows', 0)),
        'failed_count': len(failed_records),
        'total_processed': len(rows),
        'imported_rolls': imported_records
    }


def confirm_faculty_import(preview_token: str, admin_user: Any) -> Dict[str, Any]:
    """
    Import valid, non-duplicate faculty members from cached preview session.
    """
    cached = BULK_PREVIEW_CACHE.get(preview_token)
    if not cached or cached.get('entity_type') != 'faculty':
        return {'success': False, 'error': 'Preview session expired or invalid. Please re-upload your file.'}

    rows = cached.get('rows', [])
    valid_rows = [r for r in rows if r.get('validation_status') == 'VALID']

    if not valid_rows:
        return {'success': False, 'error': 'No valid faculty records found to import.'}

    imported_records = []
    skipped_records = []
    failed_records = []

    for r in valid_rows:
        fac_id = r['faculty_id']
        email = r['email']
        name = r['name']
        role = r.get('role', 'Mentor')

        if UserModel.get_by_identifier(fac_id) or UserModel.get_by_email(email):
            skipped_records.append({'faculty_id': fac_id, 'reason': 'Account was already created in database.'})
            continue

        assigned_sec = "III Year - Section A" if role == "Class Incharge" else ""

        user_payload = {
            'id': f"FAC_{fac_id.replace('-', '_')}",
            'identifier': fac_id,
            'username': r.get('username') or fac_id,
            'name': name,
            'email': email,
            'role': role,
            'sub_role': role,
            'department': r.get('department') or 'Computer Science and Design',
            'designation': r.get('designation') or 'Assistant Professor',
            'section': assigned_sec,
            'password': r.get('_raw_password') or 'password123',
            'email_verified': True,
            'account_status': 'ACTIVE'
        }

        try:
            created = UserModel.create(user_payload)
            if not created:
                failed_records.append({'faculty_id': fac_id, 'reason': 'Failed to insert faculty user account.'})
                continue
            imported_records.append(fac_id)
        except Exception as e:
            failed_records.append({'faculty_id': fac_id, 'reason': str(e)})

    BULK_PREVIEW_CACHE.pop(preview_token, None)

    return {
        'success': True,
        'message': f"Faculty bulk upload complete. Successfully imported {len(imported_records)} faculty member(s).",
        'imported_count': len(imported_records),
        'skipped_count': len(skipped_records) + (cached.get('summary', {}).get('duplicate_rows', 0)),
        'failed_count': len(failed_records),
        'total_processed': len(rows),
        'imported_ids': imported_records
    }


# ─────────────────────────────────────────────────────────────────────────────
# 6. ERROR REPORT GENERATOR WITH FORMULA INJECTION SANITIZATION
# ─────────────────────────────────────────────────────────────────────────────

def generate_error_report(preview_token: str, format_type: str = 'xlsx') -> Tuple[Optional[io.BytesIO], Optional[str], Optional[str]]:
    """
    Generate downloadable error report spreadsheet (.xlsx or .csv) containing all row errors.
    All cell strings are sanitized against spreadsheet formula injection.
    Returns (bytes_stream, filename, error_message).
    """
    cached = BULK_PREVIEW_CACHE.get(preview_token)
    if not cached:
        return None, None, "Preview session expired. Please re-upload your spreadsheet."

    errors = cached.get('errors', [])
    entity_type = cached.get('entity_type', 'bulk_upload')
    date_str = datetime.now().strftime('%Y%m%d_%H%M%S')

    error_headers = ["Row Number", "Identifier", "Full Name", "Email Address", "Failure / Rejection Reason"]

    if format_type.lower() == 'csv':
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(error_headers)
        for e in errors:
            writer.writerow([
                _sanitize_formula(e.get('row')),
                _sanitize_formula(e.get('identifier')),
                _sanitize_formula(e.get('name')),
                _sanitize_formula(e.get('email')),
                _sanitize_formula(e.get('reason'))
            ])
        bytes_out = io.BytesIO(output.getvalue().encode('utf-8'))
        bytes_out.seek(0)
        filename = f"{entity_type}_upload_errors_{date_str}.csv"
        return bytes_out, filename, None

    else:
        wb = openpyxl.Workbook()
        ws = wb.active
        if not isinstance(ws, Worksheet):
            ws = wb.create_sheet("Validation Errors")
        assert isinstance(ws, Worksheet)
        ws.title = "Validation Errors"

        ws.append(error_headers)

        # Style error headers (Red / Rose theme)
        header_fill = PatternFill(start_color="991B1B", end_color="991B1B", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        thin_border = Border(
            left=Side(style='thin', color='FCA5A5'),
            right=Side(style='thin', color='FCA5A5'),
            top=Side(style='thin', color='FCA5A5'),
            bottom=Side(style='thin', color='FCA5A5')
        )

        for col_idx in range(1, len(error_headers) + 1):
            cell = ws.cell(row=1, column=col_idx)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = thin_border

        for e in errors:
            ws.append([
                _sanitize_formula(e.get('row')),
                _sanitize_formula(e.get('identifier')),
                _sanitize_formula(e.get('name')),
                _sanitize_formula(e.get('email')),
                _sanitize_formula(e.get('reason'))
            ])

        for row in ws.iter_rows(min_row=2, max_row=len(errors) + 1, min_col=1, max_col=len(error_headers)):
            for cell in row:
                cell.border = thin_border
                cell.alignment = Alignment(horizontal="left", vertical="center")

        ws.column_dimensions["A"].width = 14
        ws.column_dimensions["B"].width = 20
        ws.column_dimensions["C"].width = 24
        ws.column_dimensions["D"].width = 34
        ws.column_dimensions["E"].width = 50

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        filename = f"{entity_type}_upload_errors_{date_str}.xlsx"
        return output, filename, None
