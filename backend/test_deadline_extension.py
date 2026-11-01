import os
import sys
import unittest
from datetime import datetime, timedelta, timezone

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.app import create_app
from backend.database import init_db, session_scope
from backend.models.db_models import ODRequest, ODHistory, Student, User
from backend.models.od_request import ODRequestModel

class TestBulkDeadlineExtension(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.client = self.app.test_client()
        with self.app.app_context():
            init_db()

    def get_token_for_user(self, identifier, password, role):
        res = self.client.post('/api/auth/login', json={
            'identifier': identifier,
            'password': password,
            'role': role
        })
        self.assertEqual(res.status_code, 200, f"Login failed for {identifier} as {role}: {res.get_json()}")
        data = res.get_json()
        return data['token']

    def test_01_unauthenticated_access_denied(self):
        """Unauthenticated requests must be denied with 401."""
        res = self.client.get('/api/class-incharge/certificates/pending-upload')
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data.get('success', True))

        future_dt = (datetime.now(timezone.utc) + timedelta(days=3)).strftime('%Y-%m-%d %H:%M:%S')
        res = self.client.post('/api/class-incharge/certificates/extend-deadline', json={
            'request_ids': ['OD-REQ-0001'],
            'new_deadline': future_dt
        })
        self.assertEqual(res.status_code, 401)

    def test_02_forbidden_for_unauthorized_roles(self):
        """Students and Mentors must be rejected with 403 Forbidden."""
        # 1. Student attempting access
        student_token = self.get_token_for_user('STUD001', 'password123', 'Student')
        headers_stu = {'Authorization': f'Bearer {student_token}'}

        res = self.client.get('/api/class-incharge/certificates/pending-upload', headers=headers_stu)
        self.assertEqual(res.status_code, 403)

        future_dt = (datetime.now(timezone.utc) + timedelta(days=3)).strftime('%Y-%m-%d %H:%M:%S')
        res = self.client.post('/api/class-incharge/certificates/extend-deadline', headers=headers_stu, json={
            'request_ids': ['OD-REQ-0001'],
            'new_deadline': future_dt
        })
        self.assertEqual(res.status_code, 403)

        # 2. Mentor attempting access
        mentor_token = self.get_token_for_user('FAC001', 'password123', 'Mentor')
        headers_men = {'Authorization': f'Bearer {mentor_token}'}

        res = self.client.get('/api/class-incharge/certificates/pending-upload', headers=headers_men)
        self.assertEqual(res.status_code, 403)

        res = self.client.post('/api/class-incharge/certificates/extend-deadline', headers=headers_men, json={
            'request_ids': ['OD-REQ-0001'],
            'new_deadline': future_dt
        })
        self.assertEqual(res.status_code, 403)

    def test_03_authorized_class_incharge_can_view_pending_uploads(self):
        """Class Incharge can access pending-upload endpoint and receive assigned students list."""
        ci_token = self.get_token_for_user('FAC002', 'password123', 'Class Incharge')
        headers = {'Authorization': f'Bearer {ci_token}'}

        res = self.client.get('/api/class-incharge/certificates/pending-upload', headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get('success'))
        self.assertIn('requests', data)
        self.assertIn('count', data)
        self.assertIsInstance(data['requests'], list)

        # Also check the enhanced /certificates endpoint
        res_certs = self.client.get('/api/class-incharge/certificates', headers=headers)
        self.assertEqual(res_certs.status_code, 200)
        data_certs = res_certs.get_json()
        self.assertIn('pending_uploads', data_certs)
        self.assertIn('pending_upload_count', data_certs)

    def test_04_validation_of_deadline_input(self):
        """Validate rejection of missing parameters, empty list, and past dates."""
        ci_token = self.get_token_for_user('FAC002', 'password123', 'Class Incharge')
        headers = {'Authorization': f'Bearer {ci_token}'}

        # 1. Missing request_ids
        res = self.client.post('/api/class-incharge/certificates/extend-deadline', headers=headers, json={
            'new_deadline': '2026-12-31 23:59:59'
        })
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.get_json().get('success'))

        # 2. Empty request_ids
        res = self.client.post('/api/class-incharge/certificates/extend-deadline', headers=headers, json={
            'request_ids': [],
            'new_deadline': '2026-12-31 23:59:59'
        })
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.get_json().get('success'))

        # 3. Missing new_deadline
        res = self.client.post('/api/class-incharge/certificates/extend-deadline', headers=headers, json={
            'request_ids': ['OD-REQ-0001']
        })
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.get_json().get('success'))

        # 4. Past deadline date
        past_dt = (datetime.now() - timedelta(days=2)).strftime('%Y-%m-%d %H:%M:%S')
        res = self.client.post('/api/class-incharge/certificates/extend-deadline', headers=headers, json={
            'request_ids': ['OD-REQ-0001'],
            'new_deadline': past_dt
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn('future', res.get_json().get('error', '').lower())

    def test_05_successful_bulk_deadline_extension_and_audit(self):
        """Verify bulk extension updates selected records in DB, logs audit trail, and does not alter unselected records."""
        ci_token = self.get_token_for_user('FAC002', 'password123', 'Class Incharge')
        headers = {'Authorization': f'Bearer {ci_token}'}

        with session_scope() as session:
            # Create two test OD requests belonging to students in CSD department
            req1 = ODRequest(
                id='OD-TEST-BULK-01',
                student_id='STUD001',
                student_reg_no='23CSD001',
                student_name='Naveen',
                department='Computer Science and Design',
                year='III Year',
                section='A',
                event_name='National Hackathon 2026',
                event_type='Hackathon',
                event_organizer='IIT Madras',
                from_date='2026-10-10',
                to_date='2026-10-12',
                number_of_days=3.0,
                reason='Participation in Finals',
                status='Approved',
                current_stage='Certificate Pending',
                certificate_url=None,
                certificate_status='Not Uploaded',
                certificate_deadline=datetime(2026, 10, 13, 18, 0, 0)
            )
            req2 = ODRequest(
                id='OD-TEST-BULK-02',
                student_id='STUD002',
                student_reg_no='23CSD002',
                student_name='Priya R',
                department='Computer Science and Design',
                year='III Year',
                section='A',
                event_name='National Hackathon 2026',
                event_type='Hackathon',
                event_organizer='IIT Madras',
                from_date='2026-10-10',
                to_date='2026-10-12',
                number_of_days=3.0,
                reason='Participation in Finals',
                status='Approved',
                current_stage='Certificate Pending',
                certificate_url=None,
                certificate_status='Not Uploaded',
                certificate_deadline=datetime(2026, 10, 13, 18, 0, 0)
            )
            # Unselected request
            req3 = ODRequest(
                id='OD-TEST-BULK-03',
                student_id='STUD003',
                student_reg_no='23CSD003',
                student_name='Rahul Kumar',
                department='Computer Science and Design',
                year='III Year',
                section='A',
                event_name='Web 3.0 Workshop',
                event_type='Workshop',
                event_organizer='REC',
                from_date='2026-10-15',
                to_date='2026-10-15',
                number_of_days=1.0,
                reason='Learning',
                status='Approved',
                current_stage='Certificate Pending',
                certificate_url=None,
                certificate_status='Not Uploaded',
                certificate_deadline=datetime(2026, 10, 16, 18, 0, 0)
            )
            session.merge(req1)
            session.merge(req2)
            session.merge(req3)
            session.commit()

        # Target future deadline: 7 days in the future
        target_deadline = datetime.now() + timedelta(days=7)
        target_deadline_str = target_deadline.strftime('%Y-%m-%d %H:%M:%S')

        # Execute bulk extension for req1 and req2 only
        res = self.client.post('/api/class-incharge/certificates/extend-deadline', headers=headers, json={
            'request_ids': ['OD-TEST-BULK-01', 'OD-TEST-BULK-02'],
            'new_deadline': target_deadline_str,
            'reason': 'Organizer certificate distribution delay'
        })
        self.assertEqual(res.status_code, 200, f"Error: {res.get_json()}")
        data = res.get_json()
        self.assertTrue(data.get('success'))
        self.assertEqual(data.get('updated_count'), 2)
        self.assertIn('OD-TEST-BULK-01', data.get('updated_ids', []))
        self.assertIn('OD-TEST-BULK-02', data.get('updated_ids', []))

        # Verify DB persistence
        with session_scope() as session:
            db_req1 = session.query(ODRequest).filter_by(id='OD-TEST-BULK-01').first()
            db_req2 = session.query(ODRequest).filter_by(id='OD-TEST-BULK-02').first()
            db_req3 = session.query(ODRequest).filter_by(id='OD-TEST-BULK-03').first()

            self.assertIsNotNone(db_req1.certificate_deadline)
            self.assertEqual(
                db_req1.certificate_deadline.strftime('%Y-%m-%d %H:%M'),
                target_deadline.strftime('%Y-%m-%d %H:%M')
            )
            self.assertIsNotNone(db_req2.certificate_deadline)
            self.assertEqual(
                db_req2.certificate_deadline.strftime('%Y-%m-%d %H:%M'),
                target_deadline.strftime('%Y-%m-%d %H:%M')
            )

            # Requirement 9: Unselected students' deadline must remain unchanged
            self.assertEqual(
                db_req3.certificate_deadline.strftime('%Y-%m-%d %H:%M'),
                '2026-10-16 18:00'
            )

            # Requirement 12: Audit history entry in ODHistory
            histories = session.query(ODHistory).filter(
                ODHistory.action == 'Certificate Deadline Extended',
                ODHistory.request_id.in_(['OD-TEST-BULK-01', 'OD-TEST-BULK-02'])
            ).all()
            self.assertGreaterEqual(len(histories), 2)
            for h in histories:
                self.assertEqual(h.performed_by_id, 'FAC002')
                self.assertIn('extended from', h.remarks.lower())
                self.assertIn('extended by class incharge', h.remarks.lower())

    def test_06_cannot_extend_already_uploaded_or_verified_certificates(self):
        """Requirement 10: Do not change the status or workflow of certificates that have already been uploaded or verified."""
        ci_token = self.get_token_for_user('FAC002', 'password123', 'Class Incharge')
        headers = {'Authorization': f'Bearer {ci_token}'}

        with session_scope() as session:
            # Create a request with an already-uploaded and verified certificate
            verified_req = ODRequest(
                id='OD-TEST-ALREADY-VERIFIED',
                student_id='STUD001',
                student_reg_no='23CSD001',
                student_name='Naveen',
                department='Computer Science and Design',
                year='III Year',
                section='A',
                event_name='Cyber Security Summit',
                event_type='Conference',
                event_organizer='NIT',
                from_date='2026-09-01',
                to_date='2026-09-02',
                number_of_days=2.0,
                reason='Presentation',
                status='OD Sanctioned',
                current_stage='Completed',
                certificate_url='/uploads/certificates/cert_test.pdf',
                certificate_status='Verified',
                certificate_deadline=datetime(2026, 9, 5, 18, 0, 0)
            )
            session.merge(verified_req)
            session.commit()

        target_deadline = datetime.now() + timedelta(days=10)
        res = self.client.post('/api/class-incharge/certificates/extend-deadline', headers=headers, json={
            'request_ids': ['OD-TEST-ALREADY-VERIFIED'],
            'new_deadline': target_deadline.strftime('%Y-%m-%d %H:%M:%S'),
            'reason': 'Testing already verified'
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data.get('success'))
        self.assertIn('already been uploaded or verified', data.get('error', '').lower())

        # Verify DB record is untouched
        with session_scope() as session:
            db_req = session.query(ODRequest).filter_by(id='OD-TEST-ALREADY-VERIFIED').first()
            self.assertEqual(db_req.status, 'OD Sanctioned')
            self.assertEqual(db_req.certificate_status, 'Verified')
            self.assertEqual(db_req.current_stage, 'Completed')
            self.assertEqual(db_req.certificate_deadline.strftime('%Y-%m-%d %H:%M'), '2026-09-05 18:00')

if __name__ == '__main__':
    unittest.main()
