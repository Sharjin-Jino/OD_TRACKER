"""
OD Request Domain Model powered by Microsoft SQL Server (SQLAlchemy ORM).
Preserves the complete 4-tier approval workflow (Student -> Mentor -> Class Incharge -> HOD),
24-hour certificate submission deadline enforcement, and email notification integration.
"""
import os
import sys
import uuid
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import or_, and_, func

# Ensure project root is in sys.path
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from backend.database.sql_server import session_scope
from backend.models.db_models import (
    ODRequest,
    Approval,
    ODHistory,
    Certificate,
    User,
    Notification,
    parse_datetime,
    to_iso,
)
from backend.models.user import UserModel
from backend.models.notification import NotificationModel

try:
    from backend.services.email_service import (
        get_student_info,
        get_mentors_for_department,
        get_class_incharges_for_department,
        get_hods_for_department,
        send_od_submitted_student_notification,
        send_new_od_mentor_notification,
        send_od_mentor_approved_student_notification,
        send_od_forwarded_class_incharge_notification,
        send_od_mentor_rejected_student_notification,
        send_od_ci_approved_student_notification,
        send_od_forwarded_hod_notification,
        send_od_ci_rejected_student_notification,
        send_od_hod_approved_student_notification,
        send_od_hod_rejected_student_notification,
        send_certificate_reminder_student_notification,
        send_certificate_uploaded_student_notification,
        send_certificate_submitted_faculty_notification,
        send_certificate_verified_student_notification,
        send_certificate_rejected_student_notification,
        send_od_expired_student_notification,
    )
except ImportError:
    from services.email_service import (
        get_student_info,
        get_mentors_for_department,
        get_class_incharges_for_department,
        get_hods_for_department,
        send_od_submitted_student_notification,
        send_new_od_mentor_notification,
        send_od_mentor_approved_student_notification,
        send_od_forwarded_class_incharge_notification,
        send_od_mentor_rejected_student_notification,
        send_od_ci_approved_student_notification,
        send_od_forwarded_hod_notification,
        send_od_ci_rejected_student_notification,
        send_od_hod_approved_student_notification,
        send_od_hod_rejected_student_notification,
        send_certificate_reminder_student_notification,
        send_certificate_uploaded_student_notification,
        send_certificate_submitted_faculty_notification,
        send_certificate_verified_student_notification,
        send_certificate_rejected_student_notification,
        send_od_expired_student_notification,
    )


class ODRequestModel:
    @staticmethod
    def calculate_days(from_date: str, to_date: str) -> float:
        try:
            d1 = datetime.strptime(from_date, "%Y-%m-%d")
            d2 = datetime.strptime(to_date, "%Y-%m-%d")
            diff = (d2 - d1).days + 1
            return max(1.0, float(diff))
        except Exception:
            return 1.0

    @staticmethod
    def parse_datetime(dt_val: Any) -> Optional[datetime]:
        return parse_datetime(dt_val)

    @staticmethod
    def get_event_end_and_deadline(item: dict) -> Tuple[Optional[datetime], Optional[datetime]]:
        """
        Calculate (end_datetime, certificate_deadline_datetime).
        The certificate deadline is ALWAYS exactly 24 hours from event_end_datetime.
        """
        if not item:
            return None, None

        end_dt = parse_datetime(item.get('event_end_datetime'))
        if not end_dt:
            to_date = item.get('to_date') or item.get('toDate') or item.get('from_date') or item.get('fromDate')
            to_time = item.get('to_time') or item.get('toTime') or '17:00'
            t_str = to_time[:5] if len(str(to_time)) >= 5 else '17:00'
            if to_date:
                try:
                    end_dt = datetime.strptime(f"{to_date} {t_str}", "%Y-%m-%d %H:%M")
                except Exception:
                    try:
                        end_dt = datetime.strptime(f"{to_date} 17:00", "%Y-%m-%d %H:%M")
                    except Exception:
                        end_dt = None

        if not end_dt:
            return None, None

        deadline_dt = parse_datetime(item.get('certificate_deadline'))
        if not deadline_dt:
            deadline_dt = end_dt + timedelta(hours=24)

        return end_dt, deadline_dt

    @staticmethod
    def expire_single_request(request_id: str) -> bool:
        """
        Atomic auto-expiration of an overdue OD request when 24h post-event certificate deadline expires.
        """
        req_id = str(request_id)
        now = datetime.now()

        with session_scope() as session:
            record = session.query(ODRequest).filter(ODRequest.id == req_id).first()
            if not record:
                return False

            # If certificate was already submitted or verified, do not expire
            if record.certificate_status in ('Verified', 'Pending Verification') or (record.certificate_url and record.certificate_url.strip()):
                return False

            record.status = 'Rejected'
            record.current_stage = 'Rejected'
            record.certificate_status = 'Deadline Expired'
            record.rejection_reason = "Participation certificate not submitted within 24 hours of event date. OD request has been automatically rejected."
            record.remarks = "Auto-rejected: 24-hour post-event certificate submission deadline exceeded."
            record.updated_at = now

            # Log auto-rejection in approvals
            session.add(
                Approval(
                    id=f"APPR_EXPIRE_{uuid.uuid4().hex[:6].upper()}",
                    request_id=req_id,
                    reviewer_id=None,
                    reviewer_name="Automated Compliance Engine",
                    reviewer_role="System Daemon",
                    action="Rejected",
                    comments="Auto-rejected: Participation certificate was not uploaded within 24 hours of the event end date.",
                    created_at=now,
                )
            )

            # Log in od_history
            session.add(
                ODHistory(
                    id=f"HIST_EXPIRE_{uuid.uuid4().hex[:6].upper()}",
                    request_id=req_id,
                    student_id=record.student_id,
                    action="Rejected",
                    performed_by_id="SYSTEM",
                    performed_by_name="Automated Compliance System",
                    role="System",
                    stage="Certificate Deadline",
                    remarks="OD application automatically rejected as participation certificate was not uploaded within 24 hours of event date.",
                    created_at=now,
                )
            )

            # In-app notification
            session.add(
                Notification(
                    id=f"NOTIF_EXPIRE_{uuid.uuid4().hex[:6].upper()}",
                    user_id=record.student_id,
                    title="OD Application Rejected (Certificate Deadline Expired)",
                    message=f"Your OD application for '{record.event_name}' was automatically rejected because the participation certificate was not submitted within 24 hours of the event date.",
                    type="error",
                    link="/student/requests",
                    is_read=0,
                    created_at=now,
                    updated_at=now,
                )
            )

            # Send email
            try:
                s_email, s_name = get_student_info(record.to_dict())
                if s_email:
                    send_od_expired_student_notification(s_email, s_name, record.event_name, req_id)
            except Exception as e:
                print(f"[-] Email error during expire: {e}")

            return True

    @staticmethod
    def check_and_expire_deadlines() -> int:
        """Scan and automatically reject all HOD-approved requests where the student failed to submit certificate within 24 hours of event date."""
        now = datetime.now()
        expired_count = 0

        try:
            with session_scope() as session:
                candidates = (
                    session.query(ODRequest)
                    .filter(
                        or_(
                            ODRequest.status.in_([
                                'HOD Approved - Certificate Pending',
                                'HOD Approved',
                                'Certificate Pending',
                                'Approved',
                            ]),
                            ODRequest.current_stage == 'Certificate Pending'
                        ),
                        or_(
                            ODRequest.certificate_url.is_(None),
                            ODRequest.certificate_url == ''
                        ),
                        ODRequest.certificate_submitted_at.is_(None),
                        or_(
                            ODRequest.certificate_status.in_(['Not Uploaded', 'Pending Upload', 'Deadline Expired', '']),
                            ODRequest.certificate_status.is_(None)
                        )
                    )
                    .all()
                )
                candidate_ids = [c.id for c in candidates]

            for req_id in candidate_ids:
                req = ODRequestModel.get_by_id(req_id)
                if not req:
                    continue
                end_dt, deadline_dt = ODRequestModel.get_event_end_and_deadline(req)
                if deadline_dt and now > deadline_dt:
                    if ODRequestModel.expire_single_request(req_id):
                        expired_count += 1
        except Exception as e:
            print(f"[-] [check_and_expire_deadlines] Error during scan: {e}")

        return expired_count

    @staticmethod
    def to_dict(doc: Optional[dict]) -> Optional[dict]:
        """Convert document dictionary to complete rich API contract for frontend."""
        if not doc:
            return None
        item = dict(doc)

        item['requestId'] = item.get('id')
        item['studentId'] = item.get('student_id')
        item['studentRegisterNo'] = item.get('student_reg_no')
        item['studentName'] = item.get('student_name')
        item['studentDepartment'] = item.get('department')
        item['studentYear'] = item.get('year')
        item['studentSection'] = item.get('section')
        item['eventName'] = item.get('event_name')
        item['eventType'] = item.get('event_type')
        item['eventOrganizer'] = item.get('event_organizer')
        item['venue'] = item.get('venue')
        item['fromDate'] = item.get('from_date')
        item['toDate'] = item.get('to_date')
        item['eventDate'] = item.get('from_date')
        item['fromTime'] = item.get('from_time') or '09:00'
        item['toTime'] = item.get('to_time') or '17:00'
        item['numberOfDays'] = item.get('number_of_days') or 1.0
        item['reason'] = item.get('reason')
        item['description'] = item.get('description')
        item['documentUrl'] = item.get('od_letter_url')
        item['odLetterUrl'] = item.get('od_letter_url')
        item['status'] = item.get('status') or 'Pending'
        item['currentStage'] = item.get('current_stage') or 'Mentor'
        item['approvalStage'] = item.get('current_stage') or 'Mentor'
        item['certificateStatus'] = item.get('certificate_status') or 'Not Uploaded'
        item['certificateUrl'] = item.get('certificate_url')
        item['rejectionReason'] = item.get('rejection_reason')
        item['remarks'] = item.get('remarks')
        item['createdAt'] = item.get('created_at')
        item['updatedAt'] = item.get('updated_at')

        # Deadline computation
        end_dt, deadline_dt = ODRequestModel.get_event_end_and_deadline(item)
        from_d = item.get('fromDate') or item.get('from_date') or ''
        from_t = item.get('fromTime') or item.get('from_time') or '09:00'
        t_from = from_t[:5] if len(str(from_t)) >= 5 else '09:00'

        item['eventStartDatetime'] = item.get('event_start_datetime') or (f"{from_d} {t_from}:00" if from_d else None)
        item['eventEndDatetime'] = (end_dt.strftime('%Y-%m-%d %H:%M:%S') if end_dt else item.get('event_end_datetime'))
        item['certificateDeadline'] = (deadline_dt.strftime('%Y-%m-%d %H:%M:%S') if deadline_dt else item.get('certificate_deadline'))
        item['certificateSubmittedAt'] = item.get('certificate_submitted_at')
        item['hodApprovedAt'] = item.get('hod_approved_at')

        # 4-tier stages for timeline visualization
        created_dt = item.get('created_at', '')
        c_date = str(created_dt).split(' ')[0] if ' ' in str(created_dt) else str(created_dt)[:10]
        c_time = str(created_dt).split(' ')[1][:5] if ' ' in str(created_dt) else '09:30'

        status = item['status']
        curr_stage = item['currentStage']
        remarks = item.get('remarks')
        rejection_reason = item.get('rejection_reason')

        # Mentor stage status
        mentor_status = 'Pending'
        mentor_feedback = 'Under Mentor evaluation' if status == 'Pending' and curr_stage == 'Mentor' else None
        if status in ['Mentor Approved', 'Class Incharge Approved', 'Class Incharge Rejected', 'HOD Approved', 'HOD Approved - Certificate Pending', 'Certificate Submitted', 'Approved', 'HOD Rejected'] or curr_stage in ['Class Incharge', 'HOD', 'Certificate Pending', 'Certificate Verification', 'Approved', 'Completed']:
            mentor_status = 'Approved'
            mentor_feedback = (remarks if status == 'Mentor Approved' else None) or 'Recommended and forwarded by Mentor'
        elif status == 'Mentor Rejected' or (status == 'Rejected' and curr_stage == 'Mentor'):
            mentor_status = 'Rejected'
            mentor_feedback = rejection_reason or remarks or 'Application declined by Mentor'

        # Class Incharge stage status
        ci_status = 'Unreached'
        ci_feedback = None
        if status in ['Class Incharge Approved', 'HOD Approved', 'HOD Approved - Certificate Pending', 'Certificate Submitted', 'Approved', 'HOD Rejected'] or curr_stage in ['HOD', 'Certificate Pending', 'Certificate Verification', 'Approved', 'Completed']:
            ci_status = 'Approved'
            ci_feedback = (remarks if status == 'Class Incharge Approved' else None) or 'Endorsed and forwarded to HOD by Class Incharge'
        elif status == 'Class Incharge Rejected' or (status == 'Rejected' and curr_stage == 'Class Incharge'):
            ci_status = 'Rejected'
            ci_feedback = rejection_reason or remarks or 'Application declined by Class Incharge'
        elif status == 'Mentor Approved' and curr_stage == 'Class Incharge':
            ci_status = 'Pending'
            ci_feedback = 'Awaiting Class Incharge endorsement'

        # HOD stage status
        hod_status = 'Unreached'
        hod_feedback = None
        if status in ['Approved', 'HOD Approved', 'HOD Approved - Certificate Pending', 'Certificate Submitted'] or curr_stage in ['Approved', 'Certificate Pending', 'Certificate Verification', 'Completed']:
            hod_status = 'Approved'
            hod_feedback = remarks or 'Executive approval granted by HOD. Participation certificate mandatory after event.'
        elif status in ['HOD Rejected'] or (status == 'Rejected' and curr_stage == 'HOD'):
            hod_status = 'Rejected'
            hod_feedback = rejection_reason or remarks or 'Application declined by HOD'
        elif status == 'Class Incharge Approved' and curr_stage == 'HOD':
            hod_status = 'Pending'
            hod_feedback = 'Awaiting executive sanction from HOD'
        elif status == 'Rejected' and 'within 24 hours' in (rejection_reason or '').lower():
            hod_status = 'Approved'
            hod_feedback = 'Executive approval was granted by HOD (Certificate deadline later expired).'

        stages = {
            'submitted': {
                'status': 'Approved',
                'date': c_date,
                'time': c_time,
                'faculty_name': item['studentName'],
                'faculty_role': 'Student',
                'feedback': 'OD application submitted for review'
            },
            'mentor': {
                'status': mentor_status,
                'faculty_name': 'Dr. A. Rajesh',
                'faculty_role': 'Mentor',
                'faculty_designation': 'Associate Professor',
                'feedback': mentor_feedback or ('Recommended and forwarded by Mentor' if mentor_status == 'Approved' else mentor_feedback)
            },
            'classIncharge': {
                'status': ci_status,
                'faculty_name': 'Mrs. K. Shanthi',
                'faculty_role': 'Class Incharge',
                'faculty_designation': 'Assistant Professor',
                'feedback': ci_feedback
            },
            'hod': {
                'status': hod_status,
                'faculty_name': 'Dr. V. Karpagam',
                'faculty_role': 'HOD',
                'faculty_designation': 'Professor & HOD',
                'feedback': hod_feedback
            }
        }
        item['stages'] = stages
        return item

    @staticmethod
    def populate_student_info(item: Optional[dict]) -> Optional[dict]:
        """Hydrate missing student fields from User database record."""
        if not item:
            return None
        sid = item.get('studentId') or item.get('student_id')
        if not sid:
            return item

        user = UserModel.get_by_id(sid)
        if user:
            item['studentRegisterNo'] = item.get('studentRegisterNo') or user.get('identifier')
            item['studentName'] = item.get('studentName') or user.get('name')
            item['studentDepartment'] = item.get('studentDepartment') or user.get('department')
            item['studentYear'] = item.get('studentYear') or user.get('year')
            item['studentSection'] = item.get('studentSection') or user.get('section')
            item['studentPhone'] = item.get('studentPhone') or user.get('phone')
            item['studentEmail'] = item.get('studentEmail') or user.get('email')
        return item

    @staticmethod
    def create(data: dict) -> Optional[dict]:
        """
        Submit a new student OD application:
        - 3-day advance notice rule enforcement
        - Transactional save into od_requests and od_history
        - Notification and email dispatch
        """
        from_date = data.get('from_date') or data.get('fromDate') or data.get('eventDate')
        if not from_date:
            raise ValueError("Event Start Date is required.")

        server_today = datetime.now().date()
        try:
            d_from_dt = datetime.strptime(from_date, "%Y-%m-%d").date()
        except Exception:
            raise ValueError("Invalid Event Start Date format. Please use YYYY-MM-DD.")

        if d_from_dt < server_today:
            raise ValueError("Event start date cannot be in the past. OD requests must be submitted at least 3 days before the event date.")

        if (d_from_dt - server_today).days < 3:
            raise ValueError("OD requests must be submitted at least 3 days before the event date.")

        req_id = data.get('id') or f"REQ_{datetime.now().strftime('%Y%m%d')}_{uuid.uuid4().hex[:6].upper()}"
        to_date = data.get('to_date') or data.get('toDate') or from_date
        num_days = float(data.get('number_of_days') or ODRequestModel.calculate_days(from_date, to_date))
        from_time = data.get('from_time') or data.get('fromTime') or '09:00'
        to_time = data.get('to_time') or data.get('toTime') or '17:00'
        now = datetime.now()

        t_from = from_time[:5] if len(str(from_time)) >= 5 else '09:00'
        t_to = to_time[:5] if len(str(to_time)) >= 5 else '17:00'

        try:
            start_dt = datetime.strptime(f"{from_date} {t_from}", "%Y-%m-%d %H:%M")
        except Exception:
            start_dt = datetime.strptime(f"{from_date} 09:00", "%Y-%m-%d %H:%M")

        try:
            end_dt = datetime.strptime(f"{to_date} {t_to}", "%Y-%m-%d %H:%M")
            deadline_dt = end_dt + timedelta(hours=24)
        except Exception:
            end_dt = datetime.strptime(f"{to_date} 17:00", "%Y-%m-%d %H:%M")
            deadline_dt = end_dt + timedelta(hours=24)

        student_id = str(data.get('student_id') or data.get('studentId'))
        student_reg_no = data.get('student_reg_no') or data.get('studentRegisterNo')
        student_name = data.get('student_name') or data.get('studentName')
        department = data.get('department') or data.get('studentDepartment')
        year = str(data.get('year') or data.get('studentYear') or 'III Year')
        section = data.get('section') or data.get('studentSection') or 'A'
        event_name = str(data.get('event_name') or data.get('eventName'))

        od_letter = data.get('od_letter_url') or data.get('documentUrl') or data.get('odLetterUrl')
        if not od_letter or not str(od_letter).strip():
            raise ValueError("OD Letter or Supporting Document is mandatory. You cannot submit an OD request without uploading an event brochure, invitation letter, or registration proof.")

        with session_scope() as session:
            record = ODRequest(
                id=req_id,
                student_id=student_id,
                student_reg_no=student_reg_no,
                student_name=student_name,
                department=department,
                year=year,
                section=section,
                event_name=event_name,
                event_type=data.get('event_type') or data.get('eventType'),
                event_organizer=data.get('event_organizer') or data.get('eventOrganizer'),
                venue=data.get('venue'),
                from_date=from_date,
                to_date=to_date,
                from_time=from_time,
                to_time=to_time,
                event_start_datetime=start_dt,
                event_end_datetime=end_dt,
                certificate_deadline=deadline_dt,
                number_of_days=num_days,
                reason=data.get('reason'),
                description=data.get('description'),
                od_letter_url=od_letter,
                status='Pending',
                current_stage='Mentor',
                certificate_status='Not Uploaded',
                remarks=data.get('remarks'),
                created_at=now,
                updated_at=now,
            )
            session.add(record)

            # History entry
            session.add(
                ODHistory(
                    id=f"HIST_{uuid.uuid4().hex[:8].upper()}",
                    request_id=req_id,
                    student_id=student_id,
                    action='Submitted',
                    performed_by_id=student_id,
                    performed_by_name=student_name,
                    role='Student',
                    stage='OD Submitted',
                    remarks='OD request successfully initiated by student',
                    created_at=now,
                )
            )

        # Dispatch email notifications
        try:
            req_dict = ODRequestModel.get_by_id(req_id)
            if req_dict:
                s_email, s_name = get_student_info(req_dict)
                dates_str = f"{from_date} to {to_date}" if to_date and to_date != from_date else from_date
                if s_email:
                    send_od_submitted_student_notification(s_email, s_name, event_name, dates_str, req_id)

                mentors = get_mentors_for_department(department)
                for m_email, m_name in mentors:
                    send_new_od_mentor_notification(m_email, m_name, s_name, event_name, dates_str, req_id)
        except Exception as e:
            print(f"[-] Email notification dispatch error on create: {e}")

        return ODRequestModel.get_by_id(req_id)

    @staticmethod
    def get_by_id(request_id: Any) -> Optional[dict]:
        clean_id = str(request_id).strip()
        with session_scope() as session:
            record = session.query(ODRequest).filter(ODRequest.id == clean_id).first()
            if not record:
                return None
            res = ODRequestModel.to_dict(record.to_dict())
            return ODRequestModel.populate_student_info(res)

    @staticmethod
    def list_all() -> List[dict]:
        ODRequestModel.check_and_expire_deadlines()
        with session_scope() as session:
            records = session.query(ODRequest).order_by(ODRequest.created_at.desc()).all()
            result = []
            for r in records:
                d = ODRequestModel.to_dict(r.to_dict())
                result.append(ODRequestModel.populate_student_info(d))
            return result

    @staticmethod
    def list_by_student(student_id: Any) -> List[dict]:
        ODRequestModel.check_and_expire_deadlines()
        clean_id = str(student_id).strip()
        with session_scope() as session:
            user = session.query(User).filter(
                or_(User.id == clean_id, func.lower(User.identifier) == clean_id.lower())
            ).first()
            uid = user.id if user else clean_id
            uident = user.identifier if user else clean_id

            records = (
                session.query(ODRequest)
                .filter(
                    or_(
                        ODRequest.student_id == uid,
                        ODRequest.student_id == uident,
                        func.lower(ODRequest.student_reg_no) == uident.lower(),
                        func.lower(ODRequest.student_reg_no) == uid.lower()
                    )
                )
                .order_by(ODRequest.created_at.desc())
                .all()
            )
            if len(records) == 0 and user and str(user.role).lower() == 'student':
                try:
                    from backend.scripts.sync_data_registry import seed_starter_requests_for_student
                    seed_starter_requests_for_student(user.id)
                    records = (
                        session.query(ODRequest)
                        .filter(
                            or_(
                                ODRequest.student_id == uid,
                                ODRequest.student_id == uident,
                                func.lower(ODRequest.student_reg_no) == uident.lower(),
                                func.lower(ODRequest.student_reg_no) == uid.lower()
                            )
                        )
                        .order_by(ODRequest.created_at.desc())
                        .all()
                    )
                except Exception as seed_err:
                    print(f"[!] Auto-seed notice for student {uident}: {seed_err}")

            result = []
            for r in records:
                d = ODRequestModel.to_dict(r.to_dict())
                result.append(ODRequestModel.populate_student_info(d))
            return result

    @staticmethod
    def list_for_mentor(mentor_user: dict) -> List[dict]:
        ODRequestModel.check_and_expire_deadlines()
        dept = (mentor_user.get('department') or '').strip().lower()
        with session_scope() as session:
            query = session.query(ODRequest)
            if dept and dept != 'all':
                query = query.filter(func.lower(ODRequest.department) == dept)
            records = query.order_by(ODRequest.created_at.desc()).all()
            result = []
            for r in records:
                d = ODRequestModel.to_dict(r.to_dict())
                result.append(ODRequestModel.populate_student_info(d))
            return result

    @staticmethod
    def approve_by_mentor(request_id: str, mentor_user: dict, remarks: str = '') -> Tuple[Optional[dict], Optional[str]]:
        req_id = str(request_id)
        now = datetime.now()
        reviewer_id = mentor_user.get('id') or mentor_user.get('userId') or 'FAC001'
        reviewer_name = mentor_user.get('name') or 'Dr. A. Rajesh'
        reviewer_role = 'Mentor'

        with session_scope() as session:
            record = session.query(ODRequest).filter(ODRequest.id == req_id).first()
            if not record:
                return None, "OD Request not found."

            if record.status != 'Pending' or record.current_stage != 'Mentor':
                return None, f"Cannot approve request currently in '{record.status}' state."

            record.status = 'Mentor Approved'
            record.current_stage = 'Class Incharge'
            record.remarks = remarks or 'Recommended by Faculty Mentor'
            record.updated_at = now

            session.add(
                Approval(
                    id=f"APPR_{uuid.uuid4().hex[:8].upper()}",
                    request_id=req_id,
                    reviewer_id=reviewer_id,
                    reviewer_name=reviewer_name,
                    reviewer_role=reviewer_role,
                    action='Approved',
                    comments=remarks or 'Recommended and forwarded to Class Incharge',
                    created_at=now,
                )
            )

            session.add(
                ODHistory(
                    id=f"HIST_{uuid.uuid4().hex[:8].upper()}",
                    request_id=req_id,
                    student_id=record.student_id,
                    action='Recommended',
                    performed_by_id=reviewer_id,
                    performed_by_name=reviewer_name,
                    role=reviewer_role,
                    stage='Mentor',
                    remarks=remarks or 'Recommended by Mentor',
                    created_at=now,
                )
            )

        updated = ODRequestModel.get_by_id(req_id)
        try:
            s_email, s_name = get_student_info(updated)
            if s_email:
                send_od_mentor_approved_student_notification(s_email, s_name, updated.get('eventName'), remarks)
            cis = get_class_incharges_for_department(updated.get('department'))
            for ci_email, ci_name in cis:
                send_od_forwarded_class_incharge_notification(ci_email, ci_name, s_name, updated.get('eventName'), req_id)
        except Exception as e:
            print(f"[-] Email error on mentor approve: {e}")

        return updated, None

    @staticmethod
    def reject_by_mentor(request_id: str, mentor_user: dict, rejection_reason: str) -> Tuple[Optional[dict], Optional[str]]:
        req_id = str(request_id)
        now = datetime.now()
        reviewer_id = mentor_user.get('id') or mentor_user.get('userId') or 'FAC001'
        reviewer_name = mentor_user.get('name') or 'Dr. A. Rajesh'
        reviewer_role = 'Mentor'

        with session_scope() as session:
            record = session.query(ODRequest).filter(ODRequest.id == req_id).first()
            if not record:
                return None, "OD Request not found."

            record.status = 'Mentor Rejected'
            record.current_stage = 'Rejected'
            record.rejection_reason = rejection_reason
            record.updated_at = now

            session.add(
                Approval(
                    id=f"APPR_{uuid.uuid4().hex[:8].upper()}",
                    request_id=req_id,
                    reviewer_id=reviewer_id,
                    reviewer_name=reviewer_name,
                    reviewer_role=reviewer_role,
                    action='Rejected',
                    comments=rejection_reason,
                    created_at=now,
                )
            )

            session.add(
                ODHistory(
                    id=f"HIST_{uuid.uuid4().hex[:8].upper()}",
                    request_id=req_id,
                    student_id=record.student_id,
                    action='Rejected',
                    performed_by_id=reviewer_id,
                    performed_by_name=reviewer_name,
                    role=reviewer_role,
                    stage='Mentor',
                    remarks=rejection_reason,
                    created_at=now,
                )
            )

        updated = ODRequestModel.get_by_id(req_id)
        try:
            s_email, s_name = get_student_info(updated)
            if s_email:
                send_od_mentor_rejected_student_notification(s_email, s_name, updated.get('eventName'), rejection_reason, req_id, updated.get('fromDate'))
        except Exception as e:
            print(f"[-] Email error on mentor reject: {e}")

        return updated, None

    @staticmethod
    def list_for_class_incharge(ci_user: dict) -> List[dict]:
        ODRequestModel.check_and_expire_deadlines()
        dept = (ci_user.get('department') or '').strip().lower()
        with session_scope() as session:
            query = session.query(ODRequest)
            if dept and dept != 'all':
                query = query.filter(func.lower(ODRequest.department) == dept)
            records = query.order_by(ODRequest.created_at.desc()).all()
            result = []
            for r in records:
                d = ODRequestModel.to_dict(r.to_dict())
                result.append(ODRequestModel.populate_student_info(d))
            return result

    @staticmethod
    def approve_by_class_incharge(request_id: str, ci_user: dict, remarks: str = '') -> Tuple[Optional[dict], Optional[str]]:
        req_id = str(request_id)
        now = datetime.now()
        reviewer_id = ci_user.get('id') or ci_user.get('userId') or 'FAC002'
        reviewer_name = ci_user.get('name') or 'Mrs. K. Shanthi'
        reviewer_role = 'Class Incharge'

        with session_scope() as session:
            record = session.query(ODRequest).filter(ODRequest.id == req_id).first()
            if not record:
                return None, "OD Request not found."

            if record.status != 'Mentor Approved' or record.current_stage != 'Class Incharge':
                return None, f"Cannot approve request currently in '{record.status}' state."

            record.status = 'Class Incharge Approved'
            record.current_stage = 'HOD'
            record.remarks = remarks or 'Endorsed by Class Incharge'
            record.updated_at = now

            session.add(
                Approval(
                    id=f"APPR_{uuid.uuid4().hex[:8].upper()}",
                    request_id=req_id,
                    reviewer_id=reviewer_id,
                    reviewer_name=reviewer_name,
                    reviewer_role=reviewer_role,
                    action='Approved',
                    comments=remarks or 'Endorsed and forwarded to HOD',
                    created_at=now,
                )
            )

            session.add(
                ODHistory(
                    id=f"HIST_{uuid.uuid4().hex[:8].upper()}",
                    request_id=req_id,
                    student_id=record.student_id,
                    action='Endorsed',
                    performed_by_id=reviewer_id,
                    performed_by_name=reviewer_name,
                    role=reviewer_role,
                    stage='Class Incharge',
                    remarks=remarks or 'Endorsed by Class Incharge',
                    created_at=now,
                )
            )

        updated = ODRequestModel.get_by_id(req_id)
        try:
            s_email, s_name = get_student_info(updated)
            if s_email:
                send_od_ci_approved_student_notification(s_email, s_name, updated.get('eventName'), remarks)
            hods = get_hods_for_department(updated.get('department'))
            for h_email, h_name in hods:
                send_od_forwarded_hod_notification(h_email, h_name, s_name, updated.get('eventName'), req_id)
        except Exception as e:
            print(f"[-] Email error on CI approve: {e}")

        return updated, None

    @staticmethod
    def reject_by_class_incharge(request_id: str, ci_user: dict, rejection_reason: str) -> Tuple[Optional[dict], Optional[str]]:
        req_id = str(request_id)
        now = datetime.now()
        reviewer_id = ci_user.get('id') or ci_user.get('userId') or 'FAC002'
        reviewer_name = ci_user.get('name') or 'Mrs. K. Shanthi'
        reviewer_role = 'Class Incharge'

        with session_scope() as session:
            record = session.query(ODRequest).filter(ODRequest.id == req_id).first()
            if not record:
                return None, "OD Request not found."

            record.status = 'Class Incharge Rejected'
            record.current_stage = 'Rejected'
            record.rejection_reason = rejection_reason
            record.updated_at = now

            session.add(
                Approval(
                    id=f"APPR_{uuid.uuid4().hex[:8].upper()}",
                    request_id=req_id,
                    reviewer_id=reviewer_id,
                    reviewer_name=reviewer_name,
                    reviewer_role=reviewer_role,
                    action='Rejected',
                    comments=rejection_reason,
                    created_at=now,
                )
            )

            session.add(
                ODHistory(
                    id=f"HIST_{uuid.uuid4().hex[:8].upper()}",
                    request_id=req_id,
                    student_id=record.student_id,
                    action='Rejected',
                    performed_by_id=reviewer_id,
                    performed_by_name=reviewer_name,
                    role=reviewer_role,
                    stage='Class Incharge',
                    remarks=rejection_reason,
                    created_at=now,
                )
            )

        updated = ODRequestModel.get_by_id(req_id)
        try:
            s_email, s_name = get_student_info(updated)
            if s_email:
                send_od_ci_rejected_student_notification(s_email, s_name, updated.get('eventName'), rejection_reason, req_id)
        except Exception as e:
            print(f"[-] Email error on CI reject: {e}")

        return updated, None

    @staticmethod
    def list_for_hod(hod_user: dict) -> List[dict]:
        ODRequestModel.check_and_expire_deadlines()
        dept = (hod_user.get('department') or '').strip().lower()
        with session_scope() as session:
            query = session.query(ODRequest)
            if dept and dept != 'all':
                query = query.filter(func.lower(ODRequest.department) == dept)
            records = query.order_by(ODRequest.created_at.desc()).all()
            result = []
            for r in records:
                d = ODRequestModel.to_dict(r.to_dict())
                result.append(ODRequestModel.populate_student_info(d))
            return result

    @staticmethod
    def approve_by_hod(request_id: str, hod_user: dict, remarks: str = '') -> Tuple[Optional[dict], Optional[str]]:
        req_id = str(request_id)
        now = datetime.now()
        reviewer_id = hod_user.get('id') or hod_user.get('userId') or 'FAC004'
        reviewer_name = hod_user.get('name') or 'Dr. V. Karpagam'
        reviewer_role = 'HOD'

        with session_scope() as session:
            record = session.query(ODRequest).filter(ODRequest.id == req_id).first()
            if not record:
                return None, "OD Request not found."

            if record.status != 'Class Incharge Approved' or record.current_stage != 'HOD':
                return None, f"Cannot approve request currently in '{record.status}' state."

            record.status = 'HOD Approved - Certificate Pending'
            record.current_stage = 'Certificate Pending'
            record.hod_approved_at = now
            record.remarks = remarks or 'Sanctioned by HOD'
            record.updated_at = now

            session.add(
                Approval(
                    id=f"APPR_{uuid.uuid4().hex[:8].upper()}",
                    request_id=req_id,
                    reviewer_id=reviewer_id,
                    reviewer_name=reviewer_name,
                    reviewer_role=reviewer_role,
                    action='Approved',
                    comments=remarks or 'Executive sanction granted by HOD',
                    created_at=now,
                )
            )

            session.add(
                ODHistory(
                    id=f"HIST_{uuid.uuid4().hex[:8].upper()}",
                    request_id=req_id,
                    student_id=record.student_id,
                    action='Approved',
                    performed_by_id=reviewer_id,
                    performed_by_name=reviewer_name,
                    role=reviewer_role,
                    stage='HOD',
                    remarks=remarks or 'Sanctioned by HOD',
                    created_at=now,
                )
            )

        updated = ODRequestModel.get_by_id(req_id)
        try:
            s_email, s_name = get_student_info(updated)
            if s_email:
                send_od_hod_approved_student_notification(
                    s_email,
                    s_name,
                    updated.get('eventName'),
                    remarks,
                    req_id,
                    updated.get('fromDate') or 'N/A',
                    str(updated.get('certificateDeadline') or 'within 24 hours of event end')
                )
        except Exception as e:
            print(f"[-] Email error on HOD approve: {e}")

        return updated, None

    @staticmethod
    def reject_by_hod(request_id: str, hod_user: dict, rejection_reason: str) -> Tuple[Optional[dict], Optional[str]]:
        req_id = str(request_id)
        now = datetime.now()
        reviewer_id = hod_user.get('id') or hod_user.get('userId') or 'FAC004'
        reviewer_name = hod_user.get('name') or 'Dr. V. Karpagam'
        reviewer_role = 'HOD'

        with session_scope() as session:
            record = session.query(ODRequest).filter(ODRequest.id == req_id).first()
            if not record:
                return None, "OD Request not found."

            record.status = 'HOD Rejected'
            record.current_stage = 'Rejected'
            record.rejection_reason = rejection_reason
            record.updated_at = now

            session.add(
                Approval(
                    id=f"APPR_{uuid.uuid4().hex[:8].upper()}",
                    request_id=req_id,
                    reviewer_id=reviewer_id,
                    reviewer_name=reviewer_name,
                    reviewer_role=reviewer_role,
                    action='Rejected',
                    comments=rejection_reason,
                    created_at=now,
                )
            )

            session.add(
                ODHistory(
                    id=f"HIST_{uuid.uuid4().hex[:8].upper()}",
                    request_id=req_id,
                    student_id=record.student_id,
                    action='Rejected',
                    performed_by_id=reviewer_id,
                    performed_by_name=reviewer_name,
                    role=reviewer_role,
                    stage='HOD',
                    remarks=rejection_reason,
                    created_at=now,
                )
            )

        updated = ODRequestModel.get_by_id(req_id)
        try:
            s_email, s_name = get_student_info(updated)
            if s_email:
                send_od_hod_rejected_student_notification(s_email, s_name, updated.get('eventName'), rejection_reason, req_id)
        except Exception as e:
            print(f"[-] Email error on HOD reject: {e}")

        return updated, None

    @staticmethod
    def upload_certificate(request_id: str, student_user: dict, file_url: str) -> Tuple[Optional[dict], Optional[str]]:
        req_id = str(request_id)
        now = datetime.now()
        sid = student_user.get('id') or student_user.get('userId')
        sname = student_user.get('name')

        with session_scope() as session:
            record = session.query(ODRequest).filter(ODRequest.id == req_id).first()
            if not record:
                return None, "OD Request not found."

            # Ensure student is authorized to upload for this request
            rec_sid = str(record.student_id or '').lower()
            rec_sreg = str(record.student_reg_no or '').lower()
            user_sid = str(sid or '').lower()
            user_sreg = str(student_user.get('identifier') or '').lower()
            if user_sid not in (rec_sid, rec_sreg) and user_sreg not in (rec_sid, rec_sreg):
                return None, "Access denied: You can only upload certificates for your own OD requests."

            # Verify request status: Must be approved by HOD
            if 'Rejected' in (record.status or '') or record.current_stage == 'Rejected':
                return None, f"Cannot upload certificate: This OD request has been rejected ({record.rejection_reason or 'No certificate upload permitted'})."

            if record.current_stage != 'Certificate Pending' and not (record.status or '').startswith('HOD Approved') and record.status != 'Certificate Submitted':
                return None, f"Cannot upload certificate: OD request must be approved by HOD before submitting certificate (current status: '{record.status}')."

            # Check 24-hour deadline from event completion date
            end_dt, deadline_dt = ODRequestModel.get_event_end_and_deadline(record.to_dict())
            if deadline_dt and now > deadline_dt:
                # Immediately auto-reject due to deadline expired
                record.status = 'Rejected'
                record.current_stage = 'Rejected'
                record.certificate_status = 'Deadline Expired'
                record.rejection_reason = "Participation certificate was not submitted within 24 hours of event date. OD request has been automatically rejected."
                record.remarks = "Auto-rejected: 24-hour post-event certificate submission deadline exceeded."
                record.updated_at = now
                session.add(
                    Approval(
                        id=f"APPR_EXPIRE_{uuid.uuid4().hex[:6].upper()}",
                        request_id=req_id,
                        reviewer_id=None,
                        reviewer_name="Automated Compliance Engine",
                        reviewer_role="System Daemon",
                        action="Rejected",
                        comments="Auto-rejected: Participation certificate was not uploaded within 24 hours of the event end date.",
                        created_at=now,
                    )
                )
                session.add(
                    ODHistory(
                        id=f"HIST_EXPIRE_{uuid.uuid4().hex[:6].upper()}",
                        request_id=req_id,
                        student_id=record.student_id,
                        action="Rejected",
                        performed_by_id="SYSTEM",
                        performed_by_name="Automated Compliance System",
                        role="System",
                        stage="Certificate Deadline",
                        remarks="OD application rejected as participation certificate was not uploaded within 24 hours of event date.",
                        created_at=now,
                    )
                )
                return None, "Certificate submission deadline has expired. This OD request has been rejected because the certificate was not uploaded within 24 hours of the event date."

            record.certificate_url = file_url
            record.certificate_status = 'Pending Verification'
            record.certificate_submitted_at = now
            record.status = 'Certificate Submitted'
            record.updated_at = now

            # Insert or update Certificate record
            cert = session.query(Certificate).filter(Certificate.request_id == req_id).first()
            if not cert:
                cert = Certificate(
                    id=f"CERT_{uuid.uuid4().hex[:8].upper()}",
                    request_id=req_id,
                    student_id=record.student_id,
                    student_reg_no=record.student_reg_no,
                    event_name=record.event_name,
                    created_at=now,
                )
                session.add(cert)

            cert.certificate_file_url = file_url
            cert.upload_date = now
            cert.status = 'Pending Verification'

            # History entry
            session.add(
                ODHistory(
                    id=f"HIST_{uuid.uuid4().hex[:8].upper()}",
                    request_id=req_id,
                    student_id=record.student_id,
                    action='Certificate Uploaded',
                    performed_by_id=sid,
                    performed_by_name=sname,
                    role='Student',
                    stage='Certificate Upload',
                    remarks='Participation certificate successfully uploaded for verification.',
                    created_at=now,
                )
            )

        updated = ODRequestModel.get_by_id(req_id)
        try:
            s_email, s_name = get_student_info(updated)
            if s_email:
                send_certificate_uploaded_student_notification(s_email, s_name, updated.get('eventName'), req_id)
            mentors = get_mentors_for_department(updated.get('department'))
            for m_email, m_name in mentors:
                send_certificate_submitted_faculty_notification(m_email, m_name, s_name, updated.get('eventName'), req_id)
        except Exception as e:
            print(f"[-] Email error on certificate upload: {e}")

        return updated, None

    @staticmethod
    def verify_certificate(request_id: str, faculty_user: dict, status: str = 'Verified', remarks: str = '') -> Tuple[Optional[dict], Optional[str]]:
        req_id = str(request_id)
        now = datetime.now()
        fid = faculty_user.get('id') or faculty_user.get('userId')
        fname = faculty_user.get('name')
        frole = faculty_user.get('role', 'Faculty')

        with session_scope() as session:
            record = session.query(ODRequest).filter(ODRequest.id == req_id).first()
            if not record:
                return None, "OD Request not found."

            if status == 'Verified':
                record.certificate_status = 'Verified'
                record.status = 'Approved'
                record.current_stage = 'Approved'
            else:
                record.certificate_status = 'Rejected'
                record.status = 'Rejected'
                record.current_stage = 'Rejected'
                record.rejection_reason = remarks or f"Certificate rejected during verification by {frole} ({fname})"

            record.remarks = remarks
            record.updated_at = now

            # Update Certificate table
            certs = session.query(Certificate).filter(Certificate.request_id == req_id).all()
            for c in certs:
                c.status = status
                c.verified_by_id = fid
                c.verified_by_name = fname
                c.verified_at = now
                c.remarks = remarks

            # History entry
            session.add(
                ODHistory(
                    id=f"HIST_{uuid.uuid4().hex[:8].upper()}",
                    request_id=req_id,
                    student_id=record.student_id,
                    action=f"Certificate {status}",
                    performed_by_id=fid,
                    performed_by_name=fname,
                    role=frole,
                    stage='Certificate Verification',
                    remarks=remarks or f"Certificate {status} by {frole}",
                    created_at=now,
                )
            )

        updated = ODRequestModel.get_by_id(req_id)
        try:
            s_email, s_name = get_student_info(updated)
            if s_email:
                if status == 'Verified':
                    send_certificate_verified_student_notification(s_email, s_name, updated.get('eventName'), req_id)
                else:
                    send_certificate_rejected_student_notification(s_email, s_name, updated.get('eventName'), remarks, req_id)
        except Exception as e:
            print(f"[-] Email error on certificate verify: {e}")

        return updated, None
