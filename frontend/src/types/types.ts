export type UserRole = 'Student' | 'Mentor' | 'Class Incharge' | 'HOD' | 'Admin';

export type FacultyRole = 'Mentor' | 'Class Incharge' | 'HOD';

export type FacultyDesignation = 'Professor' | 'Associate Professor' | 'Assistant Professor' | 'Professor & HOD' | 'HOD';

export interface AuthSession {
  userId: string;
  name: string;
  role: UserRole;
  email: string;
  department: string;
  token?: string;
  avatar?: string;
  section?: string;
  year?: string;
  loginTime: string;
}

export interface Faculty {
  faculty_id: string;
  employee_id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: FacultyDesignation;
  role: FacultyRole;
  assigned_section: string;
  password?: string;
  status: 'Active' | 'Inactive';
  created_at: string;
  avatar?: string;
}

export interface Student {
  name: string;
  registerNumber: string;
  department: string;
  year: string;
  section: string;
  email: string;
  phone: string;
  mentor: string;
  mentorId?: string;
  classIncharge: string;
  classInchargeId?: string;
  profilePhoto: string;
  attendancePercent?: number;
  cgpa?: number;
}

export interface ClassStudentInfo {
  id?: string;
  registerNumber: string;
  name: string;
  rollNo: string;
  section: string;
  department?: string;
  year?: string;
  attendancePercent: number;
  totalODsTaken: number;
  cat1Average: number;
  cat2Average: number;
  cat3Average?: number;
  mentorId?: string;
  mentorName: string;
  avatar?: string;
  hasPendingOD?: boolean;
}

export type EventType = 'Hackathon' | 'Symposium' | 'Workshop' | 'Sports' | 'Cultural Event' | 'Internship' | 'Competition' | 'Seminar' | 'Other';

export type ApprovalStatus = 'Approved' | 'Pending' | 'Rejected' | 'Unreached';

export interface ApprovalStageDetail {
  status: ApprovalStatus;
  date?: string;
  time?: string;
  faculty_id?: string;
  faculty_name?: string;
  faculty_designation?: string;
  faculty_role?: string;
  feedback?: string;
}

export interface ODRequestStages {
  submitted: ApprovalStageDetail;
  mentor: ApprovalStageDetail;
  classIncharge: ApprovalStageDetail;
  hod: ApprovalStageDetail;
}

export type CertificateVerificationStatus = 'Not Uploaded' | 'Pending Upload' | 'Pending Verification' | 'Verified' | 'Rejected' | 'Deadline Expired';

export type ODStatus = 
  | 'Pending' 
  | 'Mentor Approved' 
  | 'Mentor Rejected' 
  | 'Class Incharge Approved' 
  | 'Class Incharge Rejected' 
  | 'HOD Approved' 
  | 'HOD Approved - Certificate Pending'
  | 'Certificate Submitted'
  | 'Certificate Deadline Expired'
  | 'HOD Rejected' 
  | 'Approved' 
  | 'Completed'
  | 'Rejected';

export interface ODRequest {
  id: string;
  studentId?: string;
  studentName?: string;
  studentRegisterNo?: string;
  studentDepartment?: string;
  department?: string;
  studentYear?: string;
  year?: string;
  studentSection?: string;
  section?: string;
  studentPhone?: string;
  studentEmail?: string;
  eventName: string;
  eventType: EventType;
  eventOrganizer: string;
  venue: string;
  eventDate: string;
  fromDate?: string;
  toDate?: string;
  numberOfDays?: number;
  fromTime: string;
  toTime: string;
  reason: string;
  description: string;
  documentUrl: string | null;
  odLetterUrl?: string | null;
  certificateStatus?: CertificateVerificationStatus;
  certificateUrl?: string | null;
  eventStartDatetime?: string;
  eventEndDatetime?: string;
  hodApprovedAt?: string;
  certificateDeadline?: string;
  certificateSubmittedAt?: string;
  verifiedByFacultyId?: string;
  verifiedByFacultyName?: string;
  verifiedAt?: string;
  status: ODStatus;
  approvalStage: 'OD Submitted' | 'Mentor' | 'Class Incharge' | 'HOD' | 'Approved' | 'Rejected' | 'Certificate Pending' | string;
  currentStage?: 'Mentor' | 'Class Incharge' | 'HOD' | 'Approved' | 'Rejected' | 'Certificate Pending' | string;
  stages: ODRequestStages;
  rejectionReason?: string;
  remarks?: string;
  rejectedByFacultyId?: string;
  rejectedByFacultyName?: string;
  rejectedAt?: string;
  createdAt: string;
  impactedSubjects?: {
    subjectCode: string;
    subjectName: string;
    facultyName: string;
    periods: number;
  }[];
}

export interface CertificateItem {
  id: string;
  requestId: string;
  eventName: string;
  certificateName: string;
  uploadDate: string;
  status: 'Pending Verification' | 'Verified' | 'Rejected';
  verifiedBy?: string;
  verifiedDate?: string;
  fileUrl: string;
  studentName?: string;
  studentRegNo?: string;
}

export interface AttendanceSubject {
  id: string;
  subjectCode?: string;
  subjectName: string;
  facultyName?: string;
  attendancePercent: number;
  totalClasses: number;
  attended: number;
  absent: number;
  odApproved: number;
}

export interface CATMarksEntry {
  id: string;
  subjectCode?: string;
  subjectName: string;
  cat1: number | null;
  cat2: number | null;
  cat3?: number | null;
  average: number;
}

export interface NotificationItem {
  id: string;
  recipientType?: 'student' | 'faculty';
  recipientId?: string;
  recipientRole?: UserRole;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
  relatedRequestId?: string;
}

export interface AdminStats {
  totalStudents: number;
  totalMentors: number;
  totalClassIncharges: number;
  totalHODs: number;
  totalODRequests: number;
  pendingODRequests: number;
  approvedODRequests: number;
  rejectedODRequests: number;
  pendingCertificates: number;
  statusDistribution: Record<string, number>;
  monthlyDistribution: Record<string, number>;
  departmentDistribution: Record<string, number>;
  recentActivities: {
    id: string;
    action: string;
    details: string;
    timestamp: string;
    status: string;
  }[];
  recentODRequests: ODRequest[];
}

export interface AdminSystemSettings {
  id: string;
  min_attendance_percent: number;
  cgpa_exemption_threshold: number;
  max_od_allowance_percent: number;
  academic_year: string;
  semester_working_days: number;
  email_notifications_enabled: boolean;
  sms_notifications_enabled: boolean;
  auto_escalate_hours: number;
  updated_at?: string;
  updated_by?: string;
}

export interface AdminAuditLog {
  id: string;
  user_id?: string;
  action: string;
  details?: string;
  changes?: Record<string, any>;
  ip_address?: string;
  created_at: string;
}
