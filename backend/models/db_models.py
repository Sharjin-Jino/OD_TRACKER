"""
SQLAlchemy ORM Models for the OD Tracking Application.
Maps all MongoDB collections to Microsoft SQL Server relational tables.
Preserves exact fields, identifiers, relationships, constraints, and audit capabilities.
"""
import os
import sys
import uuid
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    Column,
    String,
    Float,
    Integer,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
    Index,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

# Ensure project root is in sys.path
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

try:
    from backend.database.sql_server import Base
except ImportError:
    from database.sql_server import Base


def utc_now() -> datetime:
    """Return timezone-naive UTC timestamp."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def parse_datetime(dt_val: Any) -> Optional[datetime]:
    """Parse string or datetime object safely into timezone-naive datetime."""
    if dt_val is None:
        return None
    if isinstance(dt_val, datetime):
        return dt_val.replace(tzinfo=None)
    dt_str = str(dt_val).strip()
    if not dt_str:
        return None
    for fmt in (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%d",
    ):
        try:
            return datetime.strptime(dt_str, fmt)
        except ValueError:
            continue
def to_iso(dt_val: Optional[datetime]) -> Optional[str]:
    """Helper to convert datetime to ISO string format."""
    if dt_val is None:
        return None
    if isinstance(dt_val, str):
        return dt_val
    return dt_val.strftime('%Y-%m-%d %H:%M:%S')


# ─── 1. Users Table ────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = 'users'

    id = Column(String(50), primary_key=True)
    identifier = Column(String(100), unique=True, nullable=False)   # Register No / Employee ID
    name = Column(String(200), nullable=False)
    email = Column(String(200), unique=True, nullable=False)
    password_hash = Column(String(512), nullable=False)
    role = Column(String(50), nullable=False)                        # Student, Mentor, Class Incharge, HOD, Admin
    sub_role = Column(String(50))
    department = Column(String(200))
    year = Column(String(50))
    section = Column(String(100))
    designation = Column(String(200))
    phone = Column(String(30))
    avatar = Column(Text)
    status = Column(String(20), default='active')
    email_verified = Column(Boolean, default=False, nullable=False)
    account_status = Column(String(20), default='ACTIVE', nullable=False)  # ACTIVE, UNVERIFIED, DISABLED
    verification_token_hash = Column(String(256), nullable=True)
    reset_token_hash = Column(String(256), nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)
    password_changed_at = Column(DateTime, nullable=True)
    last_login = Column(DateTime, nullable=True)

    # OTP Authentication Fields
    otp_hash = Column(String(256), nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)
    otp_attempts = Column(Integer, default=0)
    otp_last_sent_at = Column(DateTime, nullable=True)
    otp_purpose = Column(String(100), nullable=True)
    otp_verified_at = Column(DateTime, nullable=True)
    email_otp_json = Column(Text, nullable=True)

    # Student Academic Cached Attributes
    attendance_percentage = Column(Float, nullable=True)
    cgpa = Column(Float, nullable=True)
    cat1_marks = Column(Float, nullable=True)
    cat2_marks = Column(Float, nullable=True)
    cat3_marks = Column(Float, nullable=True)
    last_academic_update = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    od_requests = relationship('ODRequest', foreign_keys='ODRequest.student_id', back_populates='student', cascade='all, delete-orphan')
    approvals = relationship('Approval', foreign_keys='Approval.reviewer_id', back_populates='reviewer')
    notifications = relationship('Notification', foreign_keys='Notification.user_id', back_populates='user', cascade='all, delete-orphan')
    academic_record = relationship('StudentAcademicRecord', foreign_keys='StudentAcademicRecord.student_id', back_populates='student', uselist=False, cascade='all, delete-orphan')

    __table_args__ = (
        Index('ix_users_email', 'email'),
        Index('ix_users_identifier', 'identifier'),
        Index('ix_users_role', 'role'),
    )

    def get_email_otp_dict(self) -> dict:
        if not self.email_otp_json:
            return {}
        try:
            return json.loads(self.email_otp_json)
        except Exception:
            return {}

    def set_email_otp_dict(self, data: dict):
        self.email_otp_json = json.dumps(data) if data else None

    def to_safe_dict(self) -> dict:
        """Return dict without sensitive hashes for API responses."""
        acad = self.academic_record
        cgpa_val = self.cgpa if self.cgpa is not None else (acad.cgpa if acad and acad.cgpa is not None else 8.5)
        att_val = self.attendance_percentage if self.attendance_percentage is not None else (acad.attendance_percentage if acad and acad.attendance_percentage is not None else 85.0)
        c1 = self.cat1_marks if self.cat1_marks is not None else (acad.cat1_marks if acad else None)
        c2 = self.cat2_marks if self.cat2_marks is not None else (acad.cat2_marks if acad else None)
        c3 = self.cat3_marks if self.cat3_marks is not None else (acad.cat3_marks if acad else None)
        return {
            'id': self.id,
            'identifier': self.identifier,
            'name': self.name,
            'email': self.email,
            'role': self.role,
            'sub_role': self.sub_role or self.role,
            'department': self.department,
            'year': self.year,
            'section': self.section,
            'designation': self.designation,
            'phone': self.phone,
            'avatar': self.avatar,
            'status': self.status,
            'email_verified': self.email_verified,
            'account_status': self.account_status,
            'cgpa': float(cgpa_val) if cgpa_val is not None else 8.5,
            'attendance_percentage': float(att_val) if att_val is not None else 85.0,
            'attendancePercent': float(att_val) if att_val is not None else 85.0,
            'register_number': self.identifier,
            'registerNumber': self.identifier,
            'rollNo': self.identifier,
            'mentor': 'Dr. A. Rajesh',
            'mentor_id': 'FAC001',
            'mentorId': 'FAC001',
            'mentorName': 'Dr. A. Rajesh',
            'class_incharge': 'Mrs. K. Shanthi',
            'class_incharge_id': 'FAC002',
            'classIncharge': 'Mrs. K. Shanthi',
            'classInchargeId': 'FAC002',
            'classInchargeName': 'Mrs. K. Shanthi',
            'cat1_marks': c1,
            'cat2_marks': c2,
            'cat3_marks': c3,
            'last_academic_update': to_iso(self.last_academic_update or (acad.updated_at if acad else None)),
            'password_changed_at': to_iso(self.password_changed_at),
            'last_login': to_iso(self.last_login),
            'created_at': to_iso(self.created_at),
            'updated_at': to_iso(self.updated_at),
        }

    def to_dict(self) -> dict:
        """Full representation including hashes for internal model services."""
        d = self.to_safe_dict()
        d['password_hash'] = self.password_hash
        d['reset_token_hash'] = self.reset_token_hash
        d['reset_token_expires'] = to_iso(self.reset_token_expires)
        d['otp_hash'] = self.otp_hash
        d['otp_expires_at'] = to_iso(self.otp_expires_at)
        d['otp_attempts'] = self.otp_attempts
        d['otp_last_sent_at'] = to_iso(self.otp_last_sent_at)
        d['otp_purpose'] = self.otp_purpose
        d['otp_verified_at'] = to_iso(self.otp_verified_at)
        d['email_otp'] = self.get_email_otp_dict()
        d['verification_token_hash'] = self.verification_token_hash
        return d


# ─── 2. OD Requests Table ──────────────────────────────────────────────────────

class ODRequest(Base):
    __tablename__ = 'od_requests'

    id = Column(String(60), primary_key=True)
    student_id = Column(String(50), ForeignKey('users.id'), nullable=False)
    student_reg_no = Column(String(50))
    student_name = Column(String(200))
    department = Column(String(200))
    year = Column(String(50))
    section = Column(String(50))

    # Event details
    event_name = Column(String(300), nullable=False)
    event_type = Column(String(100))
    event_organizer = Column(String(300))
    venue = Column(String(300))
    from_date = Column(String(20))
    to_date = Column(String(20))
    from_time = Column(String(10), default='09:00')
    to_time = Column(String(10), default='17:00')
    number_of_days = Column(Float, default=1.0)
    reason = Column(Text)
    description = Column(Text)
    od_letter_url = Column(Text)

    # Status tracking
    status = Column(String(60), default='Pending')
    current_stage = Column(String(50), default='Mentor')
    certificate_status = Column(String(50), default='Not Uploaded')
    certificate_url = Column(Text)
    rejection_reason = Column(Text)
    remarks = Column(Text)

    # Event & Certificate Timestamps
    event_start_datetime = Column(DateTime, nullable=True)
    event_end_datetime = Column(DateTime, nullable=True)
    hod_approved_at = Column(DateTime, nullable=True)
    certificate_deadline = Column(DateTime, nullable=True)
    certificate_submitted_at = Column(DateTime, nullable=True)

    # OD eligibility snapshot
    attendance_at_request = Column(Float, nullable=True)
    od_used_at_request = Column(Float, nullable=True)
    od_percentage_requested = Column(Float, nullable=True)
    max_od_allowed_percent = Column(Float, nullable=True)

    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    student = relationship('User', foreign_keys=[student_id], back_populates='od_requests')
    approvals = relationship('Approval', back_populates='od_request', cascade='all, delete-orphan', order_by='Approval.created_at')
    certificates = relationship('Certificate', back_populates='od_request', cascade='all, delete-orphan')
    history = relationship('ODHistory', back_populates='od_request', cascade='all, delete-orphan', order_by='ODHistory.created_at')

    __table_args__ = (
        Index('ix_od_requests_student_id', 'student_id'),
        Index('ix_od_requests_status', 'status'),
        Index('ix_od_requests_created_at', 'created_at'),
        Index('ix_od_requests_department', 'department'),
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'student_id': self.student_id,
            'student_reg_no': self.student_reg_no,
            'student_name': self.student_name,
            'department': self.department,
            'year': self.year,
            'section': self.section,
            'event_name': self.event_name,
            'event_type': self.event_type,
            'event_organizer': self.event_organizer,
            'venue': self.venue,
            'from_date': self.from_date,
            'to_date': self.to_date,
            'from_time': self.from_time,
            'to_time': self.to_time,
            'number_of_days': self.number_of_days,
            'reason': self.reason,
            'description': self.description,
            'od_letter_url': self.od_letter_url,
            'status': self.status,
            'current_stage': self.current_stage,
            'certificate_status': self.certificate_status,
            'certificate_url': self.certificate_url,
            'rejection_reason': self.rejection_reason,
            'remarks': self.remarks,
            'event_start_datetime': to_iso(self.event_start_datetime),
            'event_end_datetime': to_iso(self.event_end_datetime),
            'hod_approved_at': to_iso(self.hod_approved_at),
            'certificate_deadline': to_iso(self.certificate_deadline),
            'certificate_submitted_at': to_iso(self.certificate_submitted_at),
            'attendance_at_request': self.attendance_at_request,
            'od_used_at_request': self.od_used_at_request,
            'created_at': to_iso(self.created_at),
            'updated_at': to_iso(self.updated_at),
        }


# ─── 3. Approvals Table ────────────────────────────────────────────────────────

class Approval(Base):
    __tablename__ = 'approvals'

    id = Column(String(60), primary_key=True)
    request_id = Column(String(60), ForeignKey('od_requests.id'), nullable=False)
    reviewer_id = Column(String(50), ForeignKey('users.id'), nullable=True)
    reviewer_name = Column(String(200))
    reviewer_role = Column(String(50))
    action = Column(String(50))     # Approved / Rejected / Auto Rejected
    comments = Column(Text)
    created_at = Column(DateTime, default=utc_now)

    od_request = relationship('ODRequest', back_populates='approvals')
    reviewer = relationship('User', back_populates='approvals')

    __table_args__ = (
        Index('ix_approvals_request_id', 'request_id'),
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'request_id': self.request_id,
            'reviewer_id': self.reviewer_id,
            'reviewer_name': self.reviewer_name,
            'reviewer_role': self.reviewer_role,
            'action': self.action,
            'comments': self.comments,
            'created_at': to_iso(self.created_at),
        }


# ─── 4. OD History Table ───────────────────────────────────────────────────────

class ODHistory(Base):
    __tablename__ = 'od_history'

    id = Column(String(60), primary_key=True)
    request_id = Column(String(60), ForeignKey('od_requests.id'), nullable=False)
    student_id = Column(String(50))
    action = Column(String(100))
    performed_by_id = Column(String(50))
    performed_by_name = Column(String(200))
    role = Column(String(50))
    stage = Column(String(100))
    remarks = Column(Text)
    created_at = Column(DateTime, default=utc_now)

    od_request = relationship('ODRequest', back_populates='history')

    __table_args__ = (
        Index('ix_od_history_request_id', 'request_id'),
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'request_id': self.request_id,
            'student_id': self.student_id,
            'action': self.action,
            'performed_by_id': self.performed_by_id,
            'performed_by_name': self.performed_by_name,
            'role': self.role,
            'stage': self.stage,
            'remarks': self.remarks,
            'created_at': to_iso(self.created_at),
        }


# ─── 5. Certificates Table ─────────────────────────────────────────────────────

class Certificate(Base):
    __tablename__ = 'certificates'

    id = Column(String(60), primary_key=True)
    request_id = Column(String(60), ForeignKey('od_requests.id'), nullable=False)
    student_id = Column(String(50), ForeignKey('users.id'), nullable=False)
    student_reg_no = Column(String(50))
    event_name = Column(String(300))
    certificate_file_url = Column(Text)
    upload_date = Column(DateTime, default=utc_now)
    status = Column(String(50), default='Pending Verification')
    verified_by_id = Column(String(50))
    verified_by_name = Column(String(200))
    verified_at = Column(DateTime, nullable=True)
    remarks = Column(Text)
    created_at = Column(DateTime, default=utc_now)

    od_request = relationship('ODRequest', back_populates='certificates')
    student = relationship('User', foreign_keys=[student_id])

    __table_args__ = (
        Index('ix_certificates_request_id', 'request_id'),
    )

    def to_dict(self) -> dict:
        fname = os.path.basename(self.certificate_file_url or 'Certificate.pdf')
        s_name = self.student.name if self.student else None
        s_dept = self.student.department if self.student else (self.od_request.department if self.od_request else None)
        return {
            'id': self.id,
            'requestId': self.request_id,
            'request_id': self.request_id,
            'studentId': self.student_id,
            'student_id': self.student_id,
            'studentRegNo': self.student_reg_no,
            'studentRegisterNo': self.student_reg_no,
            'student_reg_no': self.student_reg_no,
            'studentName': s_name,
            'student_name': s_name,
            'department': s_dept,
            'eventName': self.event_name,
            'event_name': self.event_name,
            'certificateName': fname,
            'certificate_file_url': self.certificate_file_url,
            'certificateUrl': self.certificate_file_url,
            'fileUrl': self.certificate_file_url,
            'uploadDate': to_iso(self.upload_date),
            'upload_date': to_iso(self.upload_date),
            'submittedAt': to_iso(self.upload_date),
            'status': self.status,
            'verifiedById': self.verified_by_id,
            'verified_by_id': self.verified_by_id,
            'verifiedByName': self.verified_by_name,
            'verified_by_name': self.verified_by_name,
            'verifiedAt': to_iso(self.verified_at),
            'verified_at': to_iso(self.verified_at),
            'remarks': self.remarks,
            'createdAt': to_iso(self.created_at),
            'created_at': to_iso(self.created_at),
        }


# ─── 6. Notifications Table ───────────────────────────────────────────────────

class Notification(Base):
    __tablename__ = 'notifications'

    id = Column(String(60), primary_key=True)
    user_id = Column(String(50), ForeignKey('users.id'), nullable=True)
    title = Column(String(300))
    message = Column(Text, nullable=False)
    type = Column(String(50), default='system')
    link = Column(String(500))
    is_read = Column(Integer, default=0)
    notification_type = Column(String(100))
    subject = Column(String(300))
    recipient_email = Column(String(200))
    delivery_status = Column(String(50), default='pending')
    status = Column(String(50), default='sent')
    retry_count = Column(Integer, default=0)
    error_details = Column(Text, nullable=True)
    provider_message_id = Column(String(200), nullable=True)
    related_request_id = Column(String(60), nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    user = relationship('User', foreign_keys=[user_id], back_populates='notifications')

    __table_args__ = (
        Index('ix_notifications_user_id', 'user_id'),
        Index('ix_notifications_created_at', 'created_at'),
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'message': self.message,
            'type': self.type,
            'link': self.link,
            'is_read': self.is_read,
            'notification_type': self.notification_type,
            'subject': self.subject,
            'recipient_email': self.recipient_email,
            'delivery_status': self.delivery_status,
            'status': self.status,
            'retry_count': self.retry_count,
            'error_details': self.error_details,
            'provider_message_id': self.provider_message_id,
            'related_request_id': self.related_request_id,
            'created_at': to_iso(self.created_at),
            'updated_at': to_iso(self.updated_at),
        }


# ─── 7. Student Academic Records Table ─────────────────────────────────────────

class StudentAcademicRecord(Base):
    __tablename__ = 'student_academic_records'

    id = Column(String(60), primary_key=True)
    student_id = Column(String(50), ForeignKey('users.id'), unique=True, nullable=False)
    register_number = Column(String(50), unique=True, nullable=False)
    student_name = Column(String(200))
    cat1_marks = Column(Float, nullable=True)
    cat2_marks = Column(Float, nullable=True)
    cat3_marks = Column(Float, nullable=True)
    attendance_percentage = Column(Float, default=0.0)
    cgpa = Column(Float, nullable=True, default=8.0)
    total_working_days = Column(Integer, default=120)
    updated_by = Column(String(50), nullable=True)
    updated_by_name = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    student = relationship('User', foreign_keys=[student_id], back_populates='academic_record')

    __table_args__ = (
        Index('ix_student_academic_student_id', 'student_id'),
        Index('ix_student_academic_reg_no', 'register_number'),
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'student_id': self.student_id,
            'register_number': self.register_number,
            'student_name': self.student_name,
            'cat1_marks': self.cat1_marks,
            'cat2_marks': self.cat2_marks,
            'cat3_marks': self.cat3_marks,
            'attendance_percentage': self.attendance_percentage,
            'cgpa': float(self.cgpa) if self.cgpa is not None else 8.0,
            'total_working_days': self.total_working_days,
            'updated_by': self.updated_by,
            'updated_by_name': self.updated_by_name,
            'created_at': to_iso(self.created_at),
            'updated_at': to_iso(self.updated_at),
        }


# ─── 8. System Settings Table ──────────────────────────────────────────────────

class SystemSetting(Base):
    __tablename__ = 'system_settings'

    id = Column(String(50), primary_key=True)  # 'SYSTEM_CONFIG'
    attendance_threshold_percent = Column(Float, default=75.0)
    cgpa_high_performer_threshold = Column(Float, default=8.5)
    max_od_limit_percent = Column(Float, default=10.0)
    academic_year = Column(String(50), default='2025-2026')
    semester_name = Column(String(50), default='Even Semester')
    total_working_days = Column(Integer, default=120)
    allow_student_self_registration = Column(Boolean, default=True)
    email_notifications_enabled = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    updated_by = Column(String(200), default='System Administrator')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'attendance_threshold_percent': self.attendance_threshold_percent,
            'cgpa_high_performer_threshold': self.cgpa_high_performer_threshold,
            'max_od_limit_percent': self.max_od_limit_percent,
            'academic_year': self.academic_year,
            'semester_name': self.semester_name,
            'total_working_days': self.total_working_days,
            'allow_student_self_registration': self.allow_student_self_registration,
            'email_notifications_enabled': self.email_notifications_enabled,
            'updated_at': to_iso(self.updated_at),
            'updated_by': self.updated_by,
        }


# ─── 9. System Locks Table ─────────────────────────────────────────────────────

class SystemLock(Base):
    __tablename__ = 'system_locks'

    id = Column(String(100), primary_key=True)  # Lock identifier (e.g. 'deadline_checker_lease')
    holder = Column(String(200), nullable=True)
    expires_at = Column(DateTime, nullable=True)
    last_heartbeat = Column(DateTime, nullable=True)

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'holder': self.holder,
            'expires_at': to_iso(self.expires_at),
            'last_heartbeat': to_iso(self.last_heartbeat),
        }


# ─── 10. Academic Upload History Table ─────────────────────────────────────────

class AcademicUploadHistory(Base):
    __tablename__ = 'academic_upload_history'

    id = Column(String(60), primary_key=True)
    upload_date = Column(DateTime, default=utc_now)
    uploaded_by_id = Column(String(50))
    uploaded_by_name = Column(String(200))
    file_name = Column(String(300))
    total_rows = Column(Integer, default=0)
    successful_updates = Column(Integer, default=0)
    unmatched_count = Column(Integer, default=0)
    invalid_count = Column(Integer, default=0)
    status = Column(String(50), default='Completed')
    details_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    def get_details(self) -> list:
        if not self.details_json:
            return []
        try:
            return json.loads(self.details_json)
        except Exception:
            return []

    def set_details(self, details: list):
        self.details_json = json.dumps(details) if details else None

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'upload_date': to_iso(self.upload_date),
            'uploaded_by_id': self.uploaded_by_id,
            'uploaded_by_name': self.uploaded_by_name,
            'file_name': self.file_name,
            'total_rows': self.total_rows,
            'successful_updates': self.successful_updates,
            'unmatched_count': self.unmatched_count,
            'invalid_count': self.invalid_count,
            'unmatched_students': self.unmatched_count,
            'invalid_rows': self.invalid_count,
            'status': self.status,
            'details': self.get_details(),
            'created_at': to_iso(self.created_at),
        }


# ─── 11. Student Imports History Table ─────────────────────────────────────────

class StudentImportHistory(Base):
    __tablename__ = 'student_imports_history'

    id = Column(String(60), primary_key=True)
    imported_by_id = Column(String(50))
    imported_by_name = Column(String(200))
    file_name = Column(String(300))
    total_records = Column(Integer, default=0)
    successful_records = Column(Integer, default=0)
    failed_records = Column(Integer, default=0)
    status = Column(String(50), default='Completed')
    created_at = Column(DateTime, default=utc_now)

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'imported_by_id': self.imported_by_id,
            'imported_by_name': self.imported_by_name,
            'file_name': self.file_name,
            'total_records': self.total_records,
            'successful_records': self.successful_records,
            'failed_records': self.failed_records,
            'status': self.status,
            'created_at': to_iso(self.created_at),
        }


# ─── 12. Attendance Upload History Table ───────────────────────────────────────

class AttendanceUploadHistory(Base):
    __tablename__ = 'attendance_upload_history'

    id = Column(String(60), primary_key=True)
    uploaded_by_id = Column(String(50))
    uploaded_by_name = Column(String(200))
    file_name = Column(String(300))
    total_records = Column(Integer, default=0)
    successful_records = Column(Integer, default=0)
    failed_records = Column(Integer, default=0)
    status = Column(String(50), default='Completed')
    created_at = Column(DateTime, default=utc_now)

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'uploaded_by_id': self.uploaded_by_id,
            'uploaded_by_name': self.uploaded_by_name,
            'file_name': self.file_name,
            'total_records': self.total_records,
            'successful_records': self.successful_records,
            'failed_records': self.failed_records,
            'status': self.status,
            'created_at': to_iso(self.created_at),
        }


# ─── 13. Marks Upload History Table ───────────────────────────────────────────

class MarksUploadHistory(Base):
    __tablename__ = 'marks_upload_history'

    id = Column(String(60), primary_key=True)
    uploaded_by_id = Column(String(50))
    uploaded_by_name = Column(String(200))
    file_name = Column(String(300))
    total_records = Column(Integer, default=0)
    successful_records = Column(Integer, default=0)
    failed_records = Column(Integer, default=0)
    status = Column(String(50), default='Completed')
    created_at = Column(DateTime, default=utc_now)

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'uploaded_by_id': self.uploaded_by_id,
            'uploaded_by_name': self.uploaded_by_name,
            'file_name': self.file_name,
            'total_records': self.total_records,
            'successful_records': self.successful_records,
            'failed_records': self.failed_records,
            'status': self.status,
            'created_at': to_iso(self.created_at),
        }


# ─── 14. Audit Logs Table ─────────────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = 'audit_logs'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(50), ForeignKey('users.id'), nullable=True)
    user_email = Column(String(200))
    user_role = Column(String(50))
    action = Column(String(100), nullable=False)
    entity_type = Column(String(100))
    entity_id = Column(String(100))
    description = Column(Text)
    ip_address = Column(String(50))
    created_at = Column(DateTime, default=utc_now)

    user = relationship('User')

    __table_args__ = (
        Index('ix_audit_logs_user_id', 'user_id'),
        Index('ix_audit_logs_action', 'action'),
        Index('ix_audit_logs_created_at', 'created_at'),
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_email': self.user_email,
            'user_role': self.user_role,
            'action': self.action,
            'entity_type': self.entity_type,
            'entity_id': self.entity_id,
            'description': self.description,
            'ip_address': self.ip_address,
            'created_at': to_iso(self.created_at),
        }


# ─── 15. Extended Academic Profiles (Backward-compatible support) ─────────────

class Student(Base):
    __tablename__ = 'students'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(50), ForeignKey('users.id'), unique=True, nullable=False)
    register_number = Column(String(50), unique=True, nullable=False)
    mentor_id = Column(String(50), ForeignKey('users.id'), nullable=True)
    class_incharge_id = Column(String(50), ForeignKey('users.id'), nullable=True)
    semester = Column(Integer, default=1)
    overall_attendance = Column(Float, default=0.0)
    od_used_days = Column(Float, default=0.0)
    total_working_days = Column(Integer, default=120)
    cgpa = Column(Float, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    user = relationship('User', foreign_keys=[user_id])
    mentor = relationship('User', foreign_keys=[mentor_id])
    class_incharge = relationship('User', foreign_keys=[class_incharge_id])

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'user_id': self.user_id,
            'register_number': self.register_number,
            'mentor_id': self.mentor_id,
            'class_incharge_id': self.class_incharge_id,
            'semester': self.semester,
            'overall_attendance': self.overall_attendance,
            'od_used_days': self.od_used_days,
            'total_working_days': self.total_working_days,
            'cgpa': self.cgpa,
            'mentor_name': self.mentor.name if self.mentor else None,
            'class_incharge_name': self.class_incharge.name if self.class_incharge else None,
            'created_at': to_iso(self.created_at),
            'updated_at': to_iso(self.updated_at),
        }


class Subject(Base):
    __tablename__ = 'subjects'

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(20), nullable=False)
    name = Column(String(300), nullable=False)
    faculty_name = Column(String(200))
    department = Column(String(200))
    semester = Column(Integer)
    total_classes = Column(Integer, default=0)

    __table_args__ = (UniqueConstraint('code', 'department', 'semester', name='uq_subject_code_dept_sem'),)


class Attendance(Base):
    __tablename__ = 'attendance'

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(50), ForeignKey('users.id'), nullable=False)
    subject_id = Column(Integer, ForeignKey('subjects.id'), nullable=False)
    total_classes = Column(Integer, default=0)
    attended = Column(Integer, default=0)
    absent = Column(Integer, default=0)
    od_approved = Column(Integer, default=0)
    attendance_percent = Column(Float, default=0.0)
    semester = Column(Integer)
    academic_year = Column(String(20))
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    student = relationship('User', foreign_keys=[student_id])
    subject = relationship('Subject', foreign_keys=[subject_id])

    __table_args__ = (
        UniqueConstraint('student_id', 'subject_id', 'semester', 'academic_year', name='uq_attendance_student_subject'),
        Index('ix_attendance_student_id', 'student_id'),
    )


class CATMarks(Base):
    __tablename__ = 'cat_marks'

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(50), ForeignKey('users.id'), nullable=False)
    subject_id = Column(Integer, ForeignKey('subjects.id'), nullable=False)
    cat1 = Column(Float)
    cat2 = Column(Float)
    cat3 = Column(Float)
    max_marks = Column(Float, default=50.0)
    semester = Column(Integer)
    academic_year = Column(String(20))
    created_at = Column(DateTime, default=utc_now)

    student = relationship('User', foreign_keys=[student_id])
    subject = relationship('Subject', foreign_keys=[subject_id])

    __table_args__ = (
        UniqueConstraint('student_id', 'subject_id', 'semester', 'academic_year', name='uq_marks_student_subject'),
        Index('ix_cat_marks_student_id', 'student_id'),
    )
