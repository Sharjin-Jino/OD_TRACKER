"""
Notification Domain Model powered by Microsoft SQL Server (SQLAlchemy ORM).
"""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import or_
from backend.database.sql_server import session_scope
from backend.models.db_models import Notification, User, parse_datetime, to_iso


class NotificationModel:
    @staticmethod
    def create(data: dict) -> Optional[dict]:
        notif_id = data.get('id') or f"NOTIF_{uuid.uuid4().hex[:8].upper()}"
        created_dt = parse_datetime(data.get('created_at')) or datetime.now()

        with session_scope() as session:
            raw_uid = data.get('user_id')
            resolved_uid = None
            if raw_uid:
                # Validate if it exists in users table
                u = session.query(User).filter(or_(User.id == str(raw_uid), User.email == str(raw_uid).lower())).first()
                if u:
                    resolved_uid = u.id

            recipient_email = data.get('recipient_email')
            if not recipient_email and raw_uid and '@' in str(raw_uid):
                recipient_email = str(raw_uid).strip().lower()

            record = Notification(
                id=notif_id,
                user_id=resolved_uid,
                title=data.get('title') or data.get('subject') or 'Notification',
                message=str(data.get('message') or ''),
                type=data.get('type') or data.get('notification_type') or 'system',
                link=data.get('link'),
                is_read=int(data.get('is_read', 0)),
                notification_type=data.get('notification_type'),
                subject=data.get('subject'),
                recipient_email=recipient_email,
                delivery_status=data.get('delivery_status', 'pending'),
                status=data.get('status', 'sent'),
                retry_count=int(data.get('retry_count', 0)),
                error_details=data.get('error_details'),
                provider_message_id=data.get('provider_message_id'),
                related_request_id=data.get('related_request_id') or data.get('request_id'),
                created_at=created_dt,
                updated_at=created_dt,
            )
            session.add(record)
            session.flush()
            return record.to_dict()

    @staticmethod
    def list_by_user(user_id: Any) -> List[dict]:
        clean_id = str(user_id).strip()
        with session_scope() as session:
            # Match either user_id or recipient_email
            records = (
                session.query(Notification)
                .filter(or_(Notification.user_id == clean_id, Notification.recipient_email == clean_id.lower()))
                .order_by(Notification.created_at.desc())
                .all()
            )
            return [r.to_dict() for r in records]

    @staticmethod
    def mark_as_read(notif_id: Any) -> bool:
        clean_id = str(notif_id).strip()
        with session_scope() as session:
            record = session.query(Notification).filter(Notification.id == clean_id).first()
            if record:
                record.is_read = 1
                record.updated_at = datetime.now()
                return True
        return False
