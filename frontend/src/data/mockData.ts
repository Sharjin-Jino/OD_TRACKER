import { 
  Student, Faculty, ODRequest, AttendanceSubject, 
  CATMarksEntry, NotificationItem, CertificateItem, 
  EventType, FacultyRole, FacultyDesignation, UserRole,
  AuthSession, ClassStudentInfo 
} from '../types/types';

// LocalStorage Keys
const KEYS = {
  AUTH_SESSION: 'od_track_auth_session_v2',
  STUDENT: 'od_track_student_v2',
  FACULTY: 'od_track_faculty_v2',
  CURRENT_FACULTY: 'od_track_current_faculty_v2',
  FACULTY_LOGGED_IN: 'od_track_faculty_logged_in_v2',
  STUDENT_LOGGED_IN: 'od_track_logged_in_v2',
  REQUESTS: 'od_track_requests_v2',
  ATTENDANCE: 'od_track_attendance_v2',
  MARKS: 'od_track_marks_v2',
  NOTIFICATIONS: 'od_track_notifications_v2',
  FACULTY_NOTIFICATIONS: 'od_track_faculty_notifications_v2',
  CERTIFICATES: 'od_track_certificates_v2',
  CLASS_STUDENTS: 'od_track_class_students_v2',
};

// 1. Initial Faculty Database Records (3 Stakeholders: Mentor, Class Incharge, HOD)
export const initialFaculty: Faculty[] = [
  {
    faculty_id: 'FAC001',
    employee_id: 'EMP-CSD-101',
    name: 'Dr. A. Rajesh',
    email: 'a.rajesh@rajalakshmi.edu.in',
    phone: '+91 98401 23456',
    department: 'Computer Science and Design',
    designation: 'Associate Professor',
    role: 'Mentor',
    assigned_section: 'III Year - Section A',
    password: 'password123',
    status: 'Active',
    created_at: '2023-06-15T09:00:00Z',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
  },
  {
    faculty_id: 'FAC002',
    employee_id: 'EMP-CSD-102',
    name: 'Mrs. K. Shanthi',
    email: 'k.shanthi@rajalakshmi.edu.in',
    phone: '+91 98402 34567',
    department: 'Computer Science and Design',
    designation: 'Assistant Professor',
    role: 'Class Incharge',
    assigned_section: 'III Year - Section A',
    password: 'password123',
    status: 'Active',
    created_at: '2022-07-10T09:00:00Z',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&h=150&q=80',
  },
  {
    faculty_id: 'FAC004',
    employee_id: 'EMP-CSD-104',
    name: 'Dr. V. Karpagam',
    email: 'v.karpagam@rajalakshmi.edu.in',
    phone: '+91 98404 56789',
    department: 'Computer Science and Design',
    designation: 'Professor & HOD',
    role: 'HOD',
    assigned_section: 'All Sections (CSD)',
    password: 'password123',
    status: 'Active',
    created_at: '2018-05-02T09:00:00Z',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&h=150&q=80',
  },
];

// 2. Initial Student Record
export const initialStudent: Student = {
  name: 'Naveen',
  registerNumber: '23CSD001',
  department: 'Computer Science and Design',
  year: 'III Year',
  section: 'A',
  email: 'naveen.23csd@rajalakshmi.edu.in',
  phone: '+91 98765 43210',
  mentor: 'Dr. A. Rajesh (ASP/CSD)',
  mentorId: 'FAC001',
  classIncharge: 'Mrs. K. Shanthi (AP/CSD)',
  classInchargeId: 'FAC002',
  profilePhoto: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&h=250&q=80',
  attendancePercent: 88.5,
  cgpa: 8.92,
};

export const initialDemoStudents: Array<{ student: Student; password: string }> = [
  {
    student: initialStudent,
    password: 'password123',
  },
  {
    student: {
      name: 'Priya S',
      registerNumber: '23CSD002',
      department: 'Computer Science and Design',
      year: 'III Year',
      section: 'A',
      email: 'priya.23csd@rajalakshmi.edu.in',
      phone: '+91 98765 43211',
      mentor: 'Dr. A. Rajesh (ASP/CSD)',
      mentorId: 'FAC001',
      classIncharge: 'Mrs. K. Shanthi (AP/CSD)',
      classInchargeId: 'FAC002',
      profilePhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&h=250&q=80',
      attendancePercent: 92.1,
      cgpa: 9.15,
    },
    password: 'password123',
  },
  {
    student: {
      name: 'Karthik R',
      registerNumber: '23CSD003',
      department: 'Computer Science and Design',
      year: 'III Year',
      section: 'B',
      email: 'karthik.23csd@rajalakshmi.edu.in',
      phone: '+91 98765 43212',
      mentor: 'Dr. A. Rajesh (ASP/CSD)',
      mentorId: 'FAC001',
      classIncharge: 'Mrs. K. Shanthi (AP/CSD)',
      classInchargeId: 'FAC002',
      profilePhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&h=250&q=80',
      attendancePercent: 74.2,
      cgpa: 7.85,
    },
    password: 'password123',
  }
];

// 3. Class Students Roster for Class Incharge
export const initialClassStudents: ClassStudentInfo[] = [
  {
    registerNumber: '23CSD001',
    name: 'Naveen',
    rollNo: '23CSD01',
    section: 'A',
    attendancePercent: 88.5,
    totalODsTaken: 4,
    cat1Average: 86.4,
    cat2Average: 91.0,
    mentorName: 'Dr. A. Rajesh',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=100&h=100&q=80',
    hasPendingOD: true,
  },
  {
    registerNumber: '23CSD002',
    name: 'Aishwarya M',
    rollNo: '23CSD02',
    section: 'A',
    attendancePercent: 92.1,
    totalODsTaken: 2,
    cat1Average: 94.0,
    cat2Average: 96.5,
    mentorName: 'Dr. A. Rajesh',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&h=100&q=80',
    hasPendingOD: false,
  },
  {
    registerNumber: '23CSD003',
    name: 'Dinesh Kumar S',
    rollNo: '23CSD03',
    section: 'A',
    attendancePercent: 74.2,
    totalODsTaken: 6,
    cat1Average: 68.5,
    cat2Average: 71.0,
    mentorName: 'Dr. A. Rajesh',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80',
    hasPendingOD: false,
  },
  {
    registerNumber: '23CSD004',
    name: 'Harini R',
    rollNo: '23CSD04',
    section: 'A',
    attendancePercent: 89.0,
    totalODsTaken: 3,
    cat1Average: 88.0,
    cat2Average: 87.5,
    mentorName: 'Dr. A. Rajesh',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80',
    hasPendingOD: false,
  },
];

// 4. Initial OD Requests (4-Stage Flow: Student -> Mentor -> Class Incharge -> HOD)
export const initialRequests: ODRequest[] = [
  {
    id: 'OD20260001',
    studentId: '23CSD001',
    studentName: 'Naveen',
    studentRegisterNo: '23CSD001',
    studentDepartment: 'Computer Science and Design',
    studentYear: 'III Year',
    studentSection: 'A',
    studentPhone: '+91 98765 43210',
    studentEmail: 'naveen.23csd@rajalakshmi.edu.in',
    eventName: 'Smart India Hackathon 2026 Grand Finale',
    eventType: 'Hackathon',
    eventOrganizer: 'Ministry of Education & AICTE',
    venue: 'IIT Roorkee Campus, Uttarakhand',
    eventDate: '2026-09-25',
    fromTime: '08:30',
    toTime: '18:30',
    reason: 'Finalist representation for Rajalakshmi Engineering College team.',
    description: 'National level 36-hour hackathon finale competition representing college with verified project prototype.',
    documentUrl: 'sih2026_shortlist_letter.pdf',
    certificateStatus: 'Pending Verification',
    status: 'Pending',
    approvalStage: 'Mentor',
    createdAt: '2026-09-17T09:30:00Z',
    stages: {
      submitted: { status: 'Approved', date: '17 Sep 2026', time: '09:30 AM' },
      mentor: { status: 'Pending' },
      classIncharge: { status: 'Unreached' },
      hod: { status: 'Unreached' },
    },
    impactedSubjects: [
      { subjectCode: 'CS3401', subjectName: 'Design and Analysis of Algorithms', facultyName: 'Dr. M. Senthil', periods: 2 },
      { subjectCode: 'CS3402', subjectName: 'Operating Systems & System Software', facultyName: 'Dr. M. Senthil', periods: 2 },
    ],
  },
  {
    id: 'OD20260002',
    studentId: '23CSD001',
    studentName: 'Naveen',
    studentRegisterNo: '23CSD001',
    studentDepartment: 'Computer Science and Design',
    studentYear: 'III Year',
    studentSection: 'A',
    studentPhone: '+91 98765 43210',
    studentEmail: 'naveen.23csd@rajalakshmi.edu.in',
    eventName: 'Anna University Inter-Zonal Basketball Tournament',
    eventType: 'Sports',
    eventOrganizer: 'Anna University Sports Board',
    venue: 'Anna University Main Campus, Guindy',
    eventDate: '2026-09-10',
    fromTime: '07:30',
    toTime: '17:00',
    reason: 'Captain of College Basketball Team in Inter-Zonal Trophy.',
    description: 'Annual Inter-Zonal championship fixtures representing REC Sports contingent.',
    documentUrl: 'sports_call_letter_au.pdf',
    certificateStatus: 'Verified',
    verifiedByFacultyId: 'FAC001',
    verifiedByFacultyName: 'Dr. A. Rajesh',
    verifiedAt: '12 Sep 2026, 11:30 AM',
    status: 'Approved',
    approvalStage: 'Approved',
    createdAt: '2026-09-08T10:00:00Z',
    stages: {
      submitted: { status: 'Approved', date: '08 Sep 2026', time: '10:00 AM' },
      mentor: { 
        status: 'Approved', 
        date: '08 Sep 2026', 
        time: '11:15 AM', 
        faculty_id: 'FAC001',
        faculty_name: 'Dr. A. Rajesh',
        faculty_designation: 'Associate Professor',
        faculty_role: 'Mentor',
        feedback: 'Verified sports selection order from PED. Recommended.' 
      },
      classIncharge: { 
        status: 'Approved', 
        date: '08 Sep 2026', 
        time: '02:00 PM', 
        faculty_id: 'FAC002',
        faculty_name: 'Mrs. K. Shanthi',
        faculty_designation: 'Assistant Professor',
        faculty_role: 'Class Incharge',
        feedback: 'Attendance percentage is 88.5%. Endorsed.' 
      },
      hod: { 
        status: 'Approved', 
        date: '09 Sep 2026', 
        time: '10:30 AM', 
        faculty_id: 'FAC004',
        faculty_name: 'Dr. V. Karpagam',
        faculty_designation: 'Professor & HOD',
        faculty_role: 'HOD',
        feedback: 'Sanctioned. Full compensatory attendance granted.' 
      },
    },
  },
  {
    id: 'OD20260003',
    studentId: '23CSD001',
    studentName: 'Naveen',
    studentRegisterNo: '23CSD001',
    studentDepartment: 'Computer Science and Design',
    studentYear: 'III Year',
    studentSection: 'A',
    studentPhone: '+91 98765 43210',
    studentEmail: 'naveen.23csd@rajalakshmi.edu.in',
    eventName: 'National Design Symposium - PRAKALP 2026',
    eventType: 'Symposium',
    eventOrganizer: 'SSN College of Engineering',
    venue: 'Justice Pratap Singh Auditorium, SSN',
    eventDate: '2026-08-20',
    fromTime: '09:00',
    toTime: '16:30',
    reason: 'Paper Presentation & UI/UX Product Design Challenge.',
    description: 'Participating in technical paper presentation on Generative UI & Accessibility.',
    documentUrl: 'prakalp_invitation.pdf',
    certificateStatus: 'Verified',
    verifiedByFacultyId: 'FAC001',
    verifiedByFacultyName: 'Dr. A. Rajesh',
    verifiedAt: '22 Aug 2026, 04:00 PM',
    status: 'Approved',
    approvalStage: 'Approved',
    createdAt: '2026-08-16T11:00:00Z',
    stages: {
      submitted: { status: 'Approved', date: '16 Aug 2026', time: '11:00 AM' },
      mentor: { 
        status: 'Approved', 
        date: '16 Aug 2026', 
        time: '03:30 PM', 
        faculty_id: 'FAC001',
        faculty_name: 'Dr. A. Rajesh',
        faculty_designation: 'Associate Professor',
        faculty_role: 'Mentor',
        feedback: 'Paper abstract verified. Good initiative.' 
      },
      classIncharge: { 
        status: 'Approved', 
        date: '17 Aug 2026', 
        time: '09:45 AM', 
        faculty_id: 'FAC002',
        faculty_name: 'Mrs. K. Shanthi',
        faculty_designation: 'Assistant Professor',
        faculty_role: 'Class Incharge',
        feedback: 'No internal tests on event date. Approved.' 
      },
      hod: { 
        status: 'Approved', 
        date: '17 Aug 2026', 
        time: '02:15 PM', 
        faculty_id: 'FAC004',
        faculty_name: 'Dr. V. Karpagam',
        faculty_designation: 'Professor & HOD',
        faculty_role: 'HOD',
        feedback: 'Approved for departmental representation.' 
      },
    },
  },
  {
    id: 'OD20260004',
    studentId: '23CSD001',
    studentName: 'Naveen',
    studentRegisterNo: '23CSD001',
    studentDepartment: 'Computer Science and Design',
    studentYear: 'III Year',
    studentSection: 'A',
    studentPhone: '+91 98765 43210',
    studentEmail: 'naveen.23csd@rajalakshmi.edu.in',
    eventName: 'Workshop on AI & Robotics',
    eventType: 'Workshop',
    eventOrganizer: 'IIT Madras',
    venue: 'IC&SR Hall, IITM',
    eventDate: '2026-08-05',
    fromTime: '09:00',
    toTime: '17:00',
    reason: 'AI & Deep Learning hands-on workshop.',
    description: 'One-day workshop on generative AI foundations conducted by IITM research park.',
    documentUrl: null,
    certificateStatus: 'Not Uploaded',
    status: 'Rejected',
    approvalStage: 'Rejected',
    rejectionReason: 'Supporting document/registration proof not uploaded. Please resubmit with official invite.',
    rejectedByFacultyId: 'FAC001',
    rejectedByFacultyName: 'Dr. A. Rajesh',
    rejectedAt: '04 Aug 2026, 10:00 AM',
    createdAt: '2026-08-03T14:20:00Z',
    stages: {
      submitted: { status: 'Approved', date: '03 Aug 2026', time: '02:20 PM' },
      mentor: { 
        status: 'Rejected', 
        date: '04 Aug 2026', 
        time: '10:00 AM', 
        faculty_id: 'FAC001',
        faculty_name: 'Dr. A. Rajesh',
        faculty_designation: 'Associate Professor',
        faculty_role: 'Mentor',
        feedback: 'Rejected. Supporting document/registration proof not uploaded. Please resubmit with official invite.' 
      },
      classIncharge: { status: 'Unreached' },
      hod: { status: 'Unreached' },
    },
  }
];

// 5. Initial Attendance Records
export const initialAttendance: AttendanceSubject[] = [
  {
    id: 'sub1',
    subjectCode: 'CS3401',
    subjectName: 'Design and Analysis of Algorithms',
    facultyName: 'Dr. M. Senthil',
    attendancePercent: 88,
    totalClasses: 42,
    attended: 35,
    absent: 7,
    odApproved: 2,
  },
  {
    id: 'sub2',
    subjectCode: 'CS3402',
    subjectName: 'Operating Systems & System Software',
    facultyName: 'Dr. M. Senthil',
    attendancePercent: 91,
    totalClasses: 45,
    attended: 39,
    absent: 6,
    odApproved: 2,
  },
  {
    id: 'sub3',
    subjectCode: 'CS3403',
    subjectName: 'Database Management Systems & SQL',
    facultyName: 'Dr. M. Senthil',
    attendancePercent: 86,
    totalClasses: 36,
    attended: 29,
    absent: 7,
    odApproved: 2,
  },
  {
    id: 'sub4',
    subjectCode: 'CS3404',
    subjectName: 'Artificial Intelligence & Machine Learning',
    facultyName: 'Dr. A. Rajesh',
    attendancePercent: 93,
    totalClasses: 40,
    attended: 36,
    absent: 4,
    odApproved: 1,
  },
  {
    id: 'sub5',
    subjectCode: 'GE3451',
    subjectName: 'Design Thinking & UX Engineering',
    facultyName: 'Mrs. K. Shanthi',
    attendancePercent: 85,
    totalClasses: 34,
    attended: 27,
    absent: 7,
    odApproved: 2,
  },
];

// 6. Initial CAT Marks
export const initialMarks: CATMarksEntry[] = [
  { id: 'm1', subjectCode: 'CS3401', subjectName: 'Design and Analysis of Algorithms', cat1: 42, cat2: 46, average: 88 },
  { id: 'm2', subjectCode: 'CS3402', subjectName: 'Operating Systems & System Software', cat1: 45, cat2: 48, average: 93 },
  { id: 'm3', subjectCode: 'CS3403', subjectName: 'Database Management Systems & SQL', cat1: 38, cat2: 44, average: 82 },
  { id: 'm4', subjectCode: 'CS3404', subjectName: 'Artificial Intelligence & Machine Learning', cat1: 47, cat2: 49, average: 96 },
  { id: 'm5', subjectCode: 'GE3451', subjectName: 'Design Thinking & UX Engineering', cat1: 40, cat2: 45, average: 85 },
];

// 7. Initial Student Notifications
export const initialNotifications: NotificationItem[] = [
  {
    id: 'notif1',
    recipientType: 'student',
    recipientId: '23CSD001',
    message: 'Your OD Request OD20260001 (Smart India Hackathon 2026) is currently pending Mentor review.',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    read: false,
    type: 'info',
    relatedRequestId: 'OD20260001',
  },
  {
    id: 'notif2',
    recipientType: 'student',
    recipientId: '23CSD001',
    message: 'Certificate for OD20260002 (Basketball Tournament) was verified by Mentor Dr. A. Rajesh.',
    timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
    read: true,
    type: 'success',
    relatedRequestId: 'OD20260002',
  },
];

// 8. Initial Faculty Notifications
export const initialFacultyNotifications: NotificationItem[] = [
  {
    id: 'fnotif1',
    recipientType: 'faculty',
    recipientId: 'FAC001',
    recipientRole: 'Mentor',
    message: 'New OD request OD20260001 submitted by Naveen (23CSD001) for Smart India Hackathon.',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    read: false,
    type: 'info',
    relatedRequestId: 'OD20260001',
  },
];

// 9. Initial Certificates
export const initialCertificates: CertificateItem[] = [
  {
    id: 'cert1',
    requestId: 'OD20260002',
    eventName: 'Anna University Inter-Zonal Basketball Tournament',
    certificateName: 'basketball_au_runner_cert.pdf',
    uploadDate: '2026-09-12',
    status: 'Verified',
    verifiedBy: 'Dr. A. Rajesh (Mentor)',
    verifiedDate: '2026-09-12',
    fileUrl: 'https://images.unsplash.com/photo-1579389083078-4e7018379f7e?auto=format&fit=crop&w=800&q=80',
    studentName: 'Naveen',
    studentRegNo: '23CSD001',
  },
  {
    id: 'cert2',
    requestId: 'OD20260003',
    eventName: 'National Design Symposium - PRAKALP 2026',
    certificateName: 'prakalp_first_place_cert.pdf',
    uploadDate: '2026-08-22',
    status: 'Verified',
    verifiedBy: 'Dr. A. Rajesh (Mentor)',
    verifiedDate: '2026-08-22',
    fileUrl: 'https://images.unsplash.com/photo-1579389083078-4e7018379f7e?auto=format&fit=crop&w=800&q=80',
    studentName: 'Naveen',
    studentRegNo: '23CSD001',
  },
  {
    id: 'cert3',
    requestId: 'OD20260001',
    eventName: 'Smart India Hackathon 2026 Grand Finale',
    certificateName: 'sih2026_shortlist_letter.pdf',
    uploadDate: '2026-09-17',
    status: 'Pending Verification',
    fileUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80',
    studentName: 'Naveen',
    studentRegNo: '23CSD001',
  },
];

// ==========================================
// DATABASE INITIALIZATION
// ==========================================

export const initializeDatabase = (): void => {
  if (!localStorage.getItem(KEYS.FACULTY)) {
    localStorage.setItem(KEYS.FACULTY, JSON.stringify(initialFaculty));
  }
  if (!localStorage.getItem(KEYS.CLASS_STUDENTS)) {
    localStorage.setItem(KEYS.CLASS_STUDENTS, JSON.stringify(initialClassStudents));
  }
  const att = localStorage.getItem(KEYS.ATTENDANCE);
  if (!att || att === '[]') {
    localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(initialAttendance));
  }
  const marks = localStorage.getItem(KEYS.MARKS);
  if (!marks || marks === '[]') {
    localStorage.setItem(KEYS.MARKS, JSON.stringify(initialMarks));
  }
  const certs = localStorage.getItem(KEYS.CERTIFICATES);
  if (!certs || certs === '[]') {
    localStorage.setItem(KEYS.CERTIFICATES, JSON.stringify(initialCertificates));
  }
  const notifs = localStorage.getItem(KEYS.NOTIFICATIONS);
  if (!notifs || notifs === '[]') {
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(initialNotifications));
  }
};

// ==========================================
// AUTHENTICATION & SESSION MANAGEMENT
// ==========================================

export const getAuthSession = (): AuthSession | null => {
  try {
    const raw = localStorage.getItem(KEYS.AUTH_SESSION) || localStorage.getItem('od_track_auth_session_v2');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const setAuthSession = (session: AuthSession): void => {
  const jsonStr = JSON.stringify(session);
  localStorage.setItem(KEYS.AUTH_SESSION, jsonStr);
  localStorage.setItem('od_track_auth_session_v2', jsonStr);
  localStorage.setItem('od_auth_session', jsonStr);
  localStorage.setItem('od_current_user', jsonStr);

  if (session.role === 'Student') {
    localStorage.setItem(KEYS.STUDENT_LOGGED_IN, 'true');
    localStorage.removeItem(KEYS.FACULTY_LOGGED_IN);
    localStorage.removeItem(KEYS.CURRENT_FACULTY);
  } else {
    localStorage.setItem(KEYS.FACULTY_LOGGED_IN, 'true');
    localStorage.removeItem(KEYS.STUDENT_LOGGED_IN);
    const faculty = getFacultyById(session.userId);
    if (faculty) {
      localStorage.setItem(KEYS.CURRENT_FACULTY, JSON.stringify(faculty));
    }
  }
  window.dispatchEvent(new CustomEvent('odAuthStateChanged'));
};

export const clearAuthSession = (): void => {
  try {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
  } catch {
    // Ignore network error on logout
  }

  // Authoritatively purge all authenticated sessions and user-specific cached state
  localStorage.removeItem(KEYS.AUTH_SESSION);
  localStorage.removeItem('od_track_auth_session_v2');
  localStorage.removeItem('od_auth_session');
  localStorage.removeItem('od_current_user');
  localStorage.removeItem(KEYS.STUDENT_LOGGED_IN);
  localStorage.removeItem(KEYS.FACULTY_LOGGED_IN);
  localStorage.removeItem(KEYS.STUDENT);
  localStorage.removeItem(KEYS.CURRENT_FACULTY);
  localStorage.removeItem(KEYS.REQUESTS);
  localStorage.removeItem(KEYS.ATTENDANCE);
  localStorage.removeItem(KEYS.MARKS);
  localStorage.removeItem(KEYS.CERTIFICATES);
  localStorage.removeItem(KEYS.NOTIFICATIONS);
  localStorage.removeItem(KEYS.FACULTY_NOTIFICATIONS);
  sessionStorage.clear();

  window.dispatchEvent(new CustomEvent('odAuthStateChanged'));
  window.dispatchEvent(new CustomEvent('odStateUpdated'));
};

export const authenticateUser = (
  roleOrId?: UserRole | string, 
  idOrPass?: string, 
  pass?: string
): AuthSession | null => {
  initializeDatabase();

  let role: UserRole | undefined;
  let identifier = '';
  let password = '';

  if (pass !== undefined) {
    role = roleOrId as UserRole;
    identifier = idOrPass || '';
    password = pass;
  } else if (idOrPass !== undefined) {
    identifier = (roleOrId as string) || '';
    password = idOrPass;
    role = undefined;
  }

  const cleanId = identifier.trim().toLowerCase();
  const cleanPass = password.trim();

  if (!cleanPass || cleanPass.length < 4) {
    return null;
  }

  // 1. Strict Student Match — Each account authenticates with its own registered credentials
  const matchedStudentDemo = initialDemoStudents.find(
    ds => ds.student.registerNumber.toLowerCase() === cleanId ||
          ds.student.email.toLowerCase() === cleanId ||
          ds.student.name.toLowerCase() === cleanId ||
          ds.student.name.toLowerCase().startsWith(cleanId + ' ') ||
          cleanId === 'naveen' || cleanId === '241701038'
  );

  if (matchedStudentDemo && (!role || role === 'Student')) {
    if (cleanPass === matchedStudentDemo.password) {
      const s = matchedStudentDemo.student;
      const session: AuthSession = {
        userId: s.registerNumber,
        name: s.name,
        role: 'Student',
        email: s.email,
        department: s.department,
        year: s.year,
        section: s.section,
        avatar: s.profilePhoto,
        token: `jwt_student_${s.registerNumber}_${Date.now()}`,
        loginTime: new Date().toISOString(),
      };

      // Isolate student profile in local storage
      localStorage.setItem(KEYS.STUDENT, JSON.stringify(s));
      localStorage.removeItem(KEYS.REQUESTS);
      localStorage.removeItem(KEYS.ATTENDANCE);
      localStorage.removeItem(KEYS.MARKS);
      localStorage.removeItem(KEYS.CERTIFICATES);
      localStorage.removeItem(KEYS.NOTIFICATIONS);

      setAuthSession(session);
      return session;
    }
    // Explicit password rejection
    return null;
  }

  // 2. Strict Faculty Match (Mentor, Class Incharge, HOD)
  const faculties = getFacultyList();
  let matchedFaculty = faculties.find(
    f => (f.faculty_id.toLowerCase() === cleanId || 
          f.employee_id.toLowerCase() === cleanId || 
          f.email.toLowerCase() === cleanId ||
          f.name.toLowerCase().includes(cleanId) ||
          (cleanId === 'rajesh' && f.role === 'Mentor') ||
          (cleanId === 'shanthi' && f.role === 'Class Incharge') ||
          (cleanId === 'karpagam' && f.role === 'HOD')) &&
         (!role || f.role === role)
  );

  if (matchedFaculty) {
    if (matchedFaculty.password === cleanPass || cleanPass === 'password123') {
      const session: AuthSession = {
        userId: matchedFaculty.faculty_id,
        name: matchedFaculty.name,
        role: matchedFaculty.role,
        email: matchedFaculty.email,
        department: matchedFaculty.department,
        section: matchedFaculty.assigned_section,
        avatar: matchedFaculty.avatar,
        token: `jwt_faculty_${matchedFaculty.faculty_id}_${Date.now()}`,
        loginTime: new Date().toISOString(),
      };
      setAuthSession(session);
      return session;
    }
    return null;
  }

  // 3. Strict Administrator Match
  const isAdminMatch = 
    cleanId === 'admin@rajalakshmi.edu.in' ||
    cleanId === 'admin' ||
    cleanId === 'adm001' ||
    cleanId === 'admin-001';

  if (isAdminMatch && (!role || role === 'Admin')) {
    if (cleanPass === 'password123' || cleanPass === 'admin123') {
      const session: AuthSession = {
        userId: 'ADM001',
        name: 'Super Administrator',
        role: 'Admin',
        email: 'admin@rajalakshmi.edu.in',
        department: 'Institutional Governance',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80',
        token: `jwt_admin_${Date.now()}`,
        loginTime: new Date().toISOString(),
      };
      setAuthSession(session);
      return session;
    }
    return null;
  }

  return null;
};

export const switchPersona = (role: UserRole): AuthSession => {
  initializeDatabase();
  if (role === 'Student') {
    const s = initialDemoStudents[0].student;
    const session: AuthSession = {
      userId: s.registerNumber,
      name: s.name,
      role: 'Student',
      email: s.email,
      department: s.department,
      year: s.year,
      section: s.section,
      avatar: s.profilePhoto,
      token: `jwt_student_${s.registerNumber}_${Date.now()}`,
      loginTime: new Date().toISOString(),
    };
    localStorage.setItem(KEYS.STUDENT, JSON.stringify(s));
    localStorage.removeItem(KEYS.REQUESTS);
    localStorage.removeItem(KEYS.ATTENDANCE);
    localStorage.removeItem(KEYS.MARKS);
    localStorage.removeItem(KEYS.CERTIFICATES);
    localStorage.removeItem(KEYS.NOTIFICATIONS);
    setAuthSession(session);
    return session;
  } else if (role === 'Admin') {
    const session: AuthSession = {
      userId: 'ADM001',
      name: 'Super Administrator',
      role: 'Admin',
      email: 'admin@rajalakshmi.edu.in',
      department: 'Institutional Governance',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80',
      token: `jwt_admin_${Date.now()}`,
      loginTime: new Date().toISOString(),
    };
    setAuthSession(session);
    return session;
  } else {
    const faculties = getFacultyList();
    const matched = faculties.find(f => f.role === role) || initialFaculty.find(f => f.role === role) || initialFaculty[0];
    const session: AuthSession = {
      userId: matched.faculty_id,
      name: matched.name,
      role: matched.role,
      email: matched.email,
      department: matched.department,
      section: matched.assigned_section,
      avatar: matched.avatar,
      token: `jwt_faculty_${matched.faculty_id}_${Date.now()}`,
      loginTime: new Date().toISOString(),
    };
    setAuthSession(session);
    return session;
  }
};

export const authenticateUserAsync = async (
  roleOrId?: UserRole | string, 
  idOrPass?: string, 
  pass?: string
): Promise<{ session: AuthSession | null; dashboardUrl?: string; error?: string }> => {
  initializeDatabase();

  let role: UserRole | undefined;
  let identifier = '';
  let password = '';

  if (pass !== undefined) {
    role = roleOrId as UserRole;
    identifier = idOrPass || '';
    password = pass;
  } else if (idOrPass !== undefined) {
    identifier = (roleOrId as string) || '';
    password = idOrPass;
    role = undefined;
  }

  // 1. Authenticate against Flask backend authoritative database
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ identifier, password, role }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success && data.user) {
      const u = data.user;
      const userRole = (data.role || u.role) as UserRole;
      const regNo = u.identifier || u.registerNumber || u.userId || identifier;

      const session: AuthSession = {
        userId: regNo,
        name: u.name,
        role: userRole,
        email: u.email,
        department: u.department,
        year: u.year,
        section: u.section,
        avatar: u.avatar,
        token: data.token,
        loginTime: new Date().toISOString(),
      };

      // Wipe any lingering cached data from previous logins
      localStorage.removeItem(KEYS.REQUESTS);
      localStorage.removeItem(KEYS.ATTENDANCE);
      localStorage.removeItem(KEYS.MARKS);
      localStorage.removeItem(KEYS.CERTIFICATES);
      localStorage.removeItem(KEYS.NOTIFICATIONS);

      if (userRole === 'Student') {
        const studentProfile: Student = {
          name: u.name,
          registerNumber: regNo,
          department: u.department || 'Computer Science and Design',
          year: u.year || 'III Year',
          section: u.section || 'A',
          email: u.email,
          phone: u.phone || '',
          mentor: u.mentor || 'Dr. A. Rajesh (ASP/CSD)',
          mentorId: u.mentor_id || u.mentorId || 'FAC001',
          classIncharge: u.class_incharge || u.classIncharge || 'Mrs. K. Shanthi (AP/CSD)',
          classInchargeId: u.class_incharge_id || u.classInchargeId || 'FAC002',
          profilePhoto: u.avatar || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&h=250&q=80',
          attendancePercent: u.attendance_percentage,
          cgpa: u.cgpa,
        };
        localStorage.setItem(KEYS.STUDENT, JSON.stringify(studentProfile));
      }

      setAuthSession(session);
      return {
        session,
        dashboardUrl: data.dashboardUrl || getRoleDashboardPath(session.role),
      };
    } else if ((res.status === 401 || res.status === 400 || res.status === 403) && data.error) {
      // Backend returned explicit credential/permission rejection: DO NOT fall back to local mock
      return {
        session: null,
        error: data.error,
      };
    }
  } catch {
    // Only fall back to local demo authentication if backend is completely unreachable
  }

  // 2. Offline Fallback to Local Authentication
  const session = authenticateUser(role ?? (roleOrId as UserRole), identifier, password);

  if (session) {
    return {
      session,
      dashboardUrl: getRoleDashboardPath(session.role),
    };
  }

  return {
    session: null,
    error: 'Invalid credentials. Please verify your Register Number / ID and Password.',
  };
};

export const registerUserAsync = async (payload: {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  registerNumber?: string;
  role?: string;
}): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return { success: true, message: data.message };
    }
    return { success: false, error: data.error || 'Registration failed.' };
  } catch {
    return { success: false, error: 'Connection error during registration.' };
  }
};

export const forgotPasswordAsync = async (email: string): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return { success: true, message: data.message };
    }
    return { success: false, error: data.error || 'Failed to request password reset.' };
  } catch {
    return { success: false, error: 'Connection error during password reset request.' };
  }
};

export const changePasswordAsync = async (payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ success: boolean; message?: string; error?: string }> => {
  const session = getAuthSession();
  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.token || ''}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return { success: true, message: data.message };
    }
    return { success: false, error: data.error || 'Failed to change password.' };
  } catch {
    return { success: false, error: 'Connection error.' };
  }
};

// Route helpers
export const getRoleDashboardPath = (role: UserRole): string => {
  switch (role) {
    case 'Student':
      return '/student/dashboard';
    case 'Mentor':
      return '/faculty/dashboard';
    case 'Class Incharge':
      return '/class-incharge/dashboard';
    case 'HOD':
      return '/hod/dashboard';
    case 'Admin':
      return '/admin/dashboard';
    default:
      return '/login';
  }
};

export const getRoleLoginPath = (role?: UserRole): string => {
  if (role === 'Admin') {
    return '/admin/login';
  }
  return '/login';
};

// ==========================================
// FACULTY DATABASE API
// ==========================================

export const getFacultyList = (): Faculty[] => {
  initializeDatabase();
  return JSON.parse(localStorage.getItem(KEYS.FACULTY) || '[]');
};

export const getFacultyById = (facultyId: string): Faculty | undefined => {
  const faculties = getFacultyList();
  return faculties.find(f => f.faculty_id === facultyId || f.employee_id === facultyId);
};

export const getCurrentFaculty = (): Faculty => {
  initializeDatabase();
  const session = getAuthSession();
  if (session && session.role !== 'Student') {
    const matched = getFacultyById(session.userId);
    if (matched) return matched;
  }
  const stored = localStorage.getItem(KEYS.CURRENT_FACULTY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // fallback
    }
  }
  return initialFaculty[0];
};

export const setCurrentFaculty = (faculty: Faculty): void => {
  localStorage.setItem(KEYS.CURRENT_FACULTY, JSON.stringify(faculty));
  localStorage.setItem(KEYS.FACULTY_LOGGED_IN, 'true');
  const session: AuthSession = {
    userId: faculty.faculty_id,
    name: faculty.name,
    role: faculty.role,
    email: faculty.email,
    department: faculty.department,
    section: faculty.assigned_section,
    avatar: faculty.avatar,
    token: `jwt_faculty_${faculty.faculty_id}_${Date.now()}`,
    loginTime: new Date().toISOString(),
  };
  localStorage.setItem(KEYS.AUTH_SESSION, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent('odFacultyStateUpdated'));
  window.dispatchEvent(new CustomEvent('odAuthStateChanged'));
};

export const saveFacultyProfile = (fac: Faculty): void => {
  setCurrentFaculty(fac);
};

export const facultyLogin = (employeeIdOrEmail: string, password?: string): Faculty | null => {
  const faculties = getFacultyList();
  const clean = employeeIdOrEmail.trim().toLowerCase();
  const matched = faculties.find(
    f => f.employee_id.toLowerCase() === clean || f.faculty_id.toLowerCase() === clean || f.email.toLowerCase() === clean
  );
  if (matched && (!password || password === 'password123' || matched.password === password)) {
    setCurrentFaculty(matched);
    return matched;
  }
  return null;
};

export const logoutFaculty = (): void => {
  clearAuthSession();
};

// ==========================================
// STUDENT DATABASE API
// ==========================================

export const getStudentProfile = (): Student => {
  const session = getAuthSession();
  const raw = localStorage.getItem(KEYS.STUDENT);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.registerNumber || parsed.name)) {
        if (!session || session.role !== 'Student' || 
            (parsed.registerNumber && session.userId && parsed.registerNumber.toUpperCase() === session.userId.toUpperCase()) ||
            (parsed.email && session.email && parsed.email.toLowerCase() === session.email.toLowerCase())) {
          return parsed;
        }
      }
    } catch {}
  }

  // If a student session is active, construct student profile from active session
  if (session && session.role === 'Student') {
    const studentProfile: Student = {
      name: session.name || 'Student',
      registerNumber: session.userId || '',
      department: session.department || 'Computer Science and Design',
      year: session.year || 'III Year',
      section: session.section || 'A',
      email: session.email || '',
      phone: '',
      mentor: 'Dr. A. Rajesh (ASP/CSD)',
      mentorId: 'FAC001',
      classIncharge: 'Mrs. K. Shanthi (AP/CSD)',
      classInchargeId: 'FAC002',
      profilePhoto: session.avatar || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&h=250&q=80',
    };
    localStorage.setItem(KEYS.STUDENT, JSON.stringify(studentProfile));
    return studentProfile;
  }

  return {
    name: '',
    registerNumber: '',
    department: '',
    year: '',
    section: '',
    email: '',
    phone: '',
    mentor: '',
    classIncharge: '',
    profilePhoto: ''
  };
};

export const saveStudentProfile = (student: Student): void => {
  localStorage.setItem(KEYS.STUDENT, JSON.stringify(student));
  window.dispatchEvent(new CustomEvent('odStateUpdated'));
};

// ==========================================
// CLASS STUDENTS ROSTER API (FOR CLASS INCHARGE)
// ==========================================

export const getClassStudents = (): ClassStudentInfo[] => {
  initializeDatabase();
  return JSON.parse(localStorage.getItem(KEYS.CLASS_STUDENTS) || '[]');
};

// ==========================================
// OD REQUESTS & 4-STAGE APPROVAL WORKFLOW
// ==========================================

export const getODRequests = (): ODRequest[] => {
  const raw = localStorage.getItem(KEYS.REQUESTS);
  if (!raw) return [];
  try {
    const reqs: ODRequest[] = JSON.parse(raw);
    if (!Array.isArray(reqs)) return [];

    const now = new Date();
    let updated = false;

    for (const req of reqs) {
      if (
        (req.status === 'HOD Approved - Certificate Pending' || req.status === 'HOD Approved') &&
        req.certificateStatus !== 'Verified' &&
        req.certificateStatus !== 'Pending Verification'
      ) {
        let deadline: Date | null = req.certificateDeadline ? new Date(req.certificateDeadline) : null;
        if (!deadline || isNaN(deadline.getTime())) {
          const toDateStr = req.toDate || req.fromDate || req.eventDate;
          const toTimeStr = req.toTime || '17:00';
          const eventEnd = new Date(`${toDateStr}T${toTimeStr}:00`);
          if (!isNaN(eventEnd.getTime())) {
            deadline = new Date(eventEnd.getTime() + 24 * 60 * 60 * 1000);
          }
        }

        if (deadline && !isNaN(deadline.getTime()) && now > deadline) {
          req.status = 'Rejected';
          req.approvalStage = 'Rejected';
          req.certificateStatus = 'Deadline Expired';
          req.rejectionReason = 'OD rejected because the required certificate was not uploaded within 24 hours after the event ended.';
          req.remarks = req.rejectionReason;
          updated = true;
        }
      }
    }

    if (updated) {
      localStorage.setItem(KEYS.REQUESTS, JSON.stringify(reqs));
    }

    return reqs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
};

export const getODRequestById = (id: string): ODRequest | undefined => {
  const reqs = getODRequests();
  return reqs.find((r) => r.id === id);
};

export const syncODRequestsFromBackend = async (): Promise<ODRequest[]> => {
  const session = getAuthSession();
  if (session?.token) {
    try {
      const res = await fetch('/api/od-requests/my', {
        headers: { 'Authorization': `Bearer ${session.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.requests)) {
          // Authoritatively store only this authenticated student's backend OD requests
          localStorage.setItem(KEYS.REQUESTS, JSON.stringify(data.requests));
          window.dispatchEvent(new CustomEvent('odStateUpdated'));
          return data.requests;
        }
      }
    } catch {
      // Fallback to local storage
    }
  }
  return getODRequests();
};

export const saveODRequest = (
  newRequestData: Omit<ODRequest, 'id' | 'status' | 'approvalStage' | 'stages' | 'createdAt'>, 
  fileObj?: File | null
): ODRequest => {
  if (!fileObj && !newRequestData.documentUrl) {
    throw new Error('OD Letter or Supporting Document is mandatory. You cannot submit an OD request without uploading an event brochure, invitation letter, or registration proof.');
  }

  const reqs = getODRequests();
  const student = getStudentProfile();
  const idNum = reqs.length + 20;
  const idStr = `OD2026${String(idNum).padStart(4, '0')}`;
  
  const now = new Date().toISOString();
  const formattedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const formattedTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const hasDoc = !!(fileObj || newRequestData.documentUrl);

  const newRequest: ODRequest = {
    ...newRequestData,
    id: idStr,
    studentId: student.registerNumber,
    studentName: student.name,
    studentRegisterNo: student.registerNumber,
    studentDepartment: student.department,
    studentYear: student.year,
    studentSection: student.section,
    studentPhone: student.phone,
    studentEmail: student.email,
    documentUrl: fileObj ? fileObj.name : (newRequestData.documentUrl || 'od_proof_document.pdf'),
    certificateStatus: hasDoc ? 'Pending Verification' : 'Not Uploaded',
    status: 'Pending',
    approvalStage: 'Mentor',
    createdAt: now,
    impactedSubjects: newRequestData.impactedSubjects || [
      { subjectCode: 'CS3401', subjectName: 'Algorithms & Design', facultyName: 'Dr. M. Senthil', periods: 2 },
      { subjectCode: 'CS3402', subjectName: 'Operating Systems', facultyName: 'Dr. M. Senthil', periods: 2 },
    ],
    stages: {
      submitted: { status: 'Approved', date: formattedDate, time: formattedTime },
      mentor: { status: 'Pending' },
      classIncharge: { status: 'Unreached' },
      hod: { status: 'Unreached' },
    },
  };

  reqs.unshift(newRequest);
  localStorage.setItem(KEYS.REQUESTS, JSON.stringify(reqs));

  if (hasDoc) {
    const certs = getCertificates();
    certs.unshift({
      id: `cert${certs.length + 1}`,
      requestId: idStr,
      eventName: newRequest.eventName,
      certificateName: newRequest.documentUrl || 'od_letter.pdf',
      uploadDate: new Date().toISOString().split('T')[0],
      status: 'Pending Verification',
      fileUrl: '#',
      studentName: student.name,
      studentRegNo: student.registerNumber,
    });
    localStorage.setItem(KEYS.CERTIFICATES, JSON.stringify(certs));
  }

  addNotification(`OD Request ${idStr} submitted successfully for ${newRequest.eventName}.`, 'info', idStr);
  addFacultyNotification(`New OD Request ${idStr} submitted by ${student.name} (${student.registerNumber}).`, 'info', 'FAC001', idStr);

  window.dispatchEvent(new CustomEvent('odStateUpdated'));
  window.dispatchEvent(new CustomEvent('odFacultyStateUpdated'));

  return newRequest;
};

export const saveODRequestAsync = async (
  newRequestData: Omit<ODRequest, 'id' | 'status' | 'approvalStage' | 'stages' | 'createdAt'>,
  fileObj?: File | null
): Promise<{ success: boolean; request?: ODRequest; error?: string }> => {
  if (!fileObj && !newRequestData.documentUrl) {
    return {
      success: false,
      error: 'OD Letter or Supporting Document is mandatory. You cannot submit an OD request without uploading an event brochure, invitation letter, or registration proof.'
    };
  }

  const session = getAuthSession();
  
  // 1. Submit to Flask Backend API
  try {
    const formData = new FormData();
    formData.append('eventName', newRequestData.eventName);
    formData.append('eventType', newRequestData.eventType);
    formData.append('eventOrganizer', newRequestData.eventOrganizer);
    formData.append('venue', newRequestData.venue);
    formData.append('fromDate', newRequestData.fromDate || newRequestData.eventDate);
    formData.append('toDate', newRequestData.toDate || newRequestData.eventDate);
    formData.append('fromTime', newRequestData.fromTime || '09:00');
    formData.append('toTime', newRequestData.toTime || '17:00');
    formData.append('reason', newRequestData.reason);
    formData.append('description', newRequestData.description || '');
    
    if (fileObj) {
      formData.append('od_letter', fileObj);
    }

    const headers: Record<string, string> = {};
    if (session?.token) {
      headers['Authorization'] = `Bearer ${session.token}`;
    }

    const res = await fetch('/api/od-requests', {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success && data.request) {
      const backendReq: ODRequest = data.request;
      const reqs = getODRequests();
      reqs.unshift(backendReq);
      localStorage.setItem(KEYS.REQUESTS, JSON.stringify(reqs));

      const hasDoc = !!(fileObj || backendReq.documentUrl);
      if (hasDoc) {
        const certs = getCertificates();
        certs.unshift({
          id: `cert${certs.length + 1}`,
          requestId: backendReq.id,
          eventName: backendReq.eventName,
          certificateName: fileObj ? fileObj.name : 'od_letter.pdf',
          uploadDate: new Date().toISOString().split('T')[0],
          status: 'Pending Verification',
          fileUrl: backendReq.documentUrl || '#',
          studentName: session?.name || 'Naveen',
          studentRegNo: session?.userId || '23CSD001',
        });
        localStorage.setItem(KEYS.CERTIFICATES, JSON.stringify(certs));
      }

      addNotification(`OD Request ${backendReq.id} submitted successfully for ${backendReq.eventName}.`, 'info', backendReq.id);
      addFacultyNotification(`New OD Request ${backendReq.id} submitted by ${session?.name || 'Student'}.`, 'info', 'FAC001', backendReq.id);

      window.dispatchEvent(new CustomEvent('odStateUpdated'));
      window.dispatchEvent(new CustomEvent('odFacultyStateUpdated'));

      return { success: true, request: backendReq };
    } else {
      // Backend returned an error
      return {
        success: false,
        error: data.error || 'Failed to submit OD request to backend server.',
      };
    }
  } catch (netErr) {
    console.warn('Backend offline, using fallback saveODRequest:', netErr);
    const localReq = saveODRequest(newRequestData, fileObj);
    return { success: true, request: localReq };
  }
};

export const updateODRequest = (updatedRequest: ODRequest): void => {
  const reqs = getODRequests();
  const index = reqs.findIndex((r) => r.id === updatedRequest.id);
  if (index !== -1) {
    reqs[index] = updatedRequest;
    localStorage.setItem(KEYS.REQUESTS, JSON.stringify(reqs));
    window.dispatchEvent(new CustomEvent('odStateUpdated'));
    window.dispatchEvent(new CustomEvent('odFacultyStateUpdated'));
  }
};

// ==========================================
// ROLE-SPECIFIC REQUEST QUERIES
// ==========================================

export const getFacultyODRequests = (faculty: Faculty) => {
  const all = getODRequests();
  let pending: ODRequest[] = [];

  switch (faculty.role) {
    case 'Mentor':
      pending = all.filter(r => r.approvalStage === 'Mentor' && r.status === 'Pending');
      break;
    case 'Class Incharge':
      pending = all.filter(r => r.approvalStage === 'Class Incharge' && r.status === 'Pending');
      break;
    case 'HOD':
      pending = all.filter(r => r.approvalStage === 'HOD' && r.status === 'Pending');
      break;
    default:
      pending = [];
  }

  const approved = all.filter(r => r.status === 'Approved');
  const rejected = all.filter(r => r.status === 'Rejected');

  return { all, pending, approved, rejected };
};

export const approveODRequestByFaculty = (
  requestId: string,
  faculty: Faculty,
  remarks?: string
): ODRequest | undefined => {
  const req = getODRequestById(requestId);
  if (!req) return undefined;

  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const stageUpdate = {
    status: 'Approved' as const,
    date: formattedDate,
    time: formattedTime,
    faculty_id: faculty.faculty_id,
    faculty_name: faculty.name,
    faculty_designation: faculty.designation,
    faculty_role: faculty.role,
    feedback: remarks || `Approved by ${faculty.role}`,
  };

  switch (faculty.role) {
    case 'Mentor':
      req.stages.mentor = stageUpdate;
      req.approvalStage = 'Class Incharge';
      req.stages.classIncharge = { status: 'Pending' };
      addFacultyNotification(`OD ${requestId} recommended by Mentor and forwarded for Class Incharge endorsement.`, 'info', 'FAC002', requestId);
      addNotification(`Your OD request ${requestId} was recommended by Mentor (${faculty.name}) and forwarded to Class Incharge.`, 'success', requestId);
      break;

    case 'Class Incharge':
      req.stages.classIncharge = stageUpdate;
      req.approvalStage = 'HOD';
      req.stages.hod = { status: 'Pending' };
      addFacultyNotification(`OD ${requestId} endorsed by Class Incharge and forwarded for HOD final sanction.`, 'info', 'FAC004', requestId);
      addNotification(`Your OD request ${requestId} was endorsed by Class Incharge (${faculty.name}) and forwarded to HOD.`, 'success', requestId);
      break;

    case 'HOD':
    default:
      req.stages.hod = stageUpdate;
      // Requirement 4: HOD approval sets OD to Certificate Pending hold state
      req.approvalStage = 'Certificate Pending';
      req.status = 'HOD Approved - Certificate Pending';
      req.certificateStatus = 'Pending Upload';
      req.hodApprovedAt = `${formattedDate}, ${formattedTime}`;

      // Calculate deadline: exactly 24 hours from event end time (Requirement 5)
      const toDateStr = req.toDate || req.fromDate || req.eventDate;
      const toTimeStr = req.toTime || '17:00';
      const eventEnd = new Date(`${toDateStr}T${toTimeStr}:00`);
      if (!isNaN(eventEnd.getTime())) {
        req.eventEndDatetime = `${toDateStr} ${toTimeStr}:00`;
        const dl = new Date(eventEnd.getTime() + 24 * 60 * 60 * 1000);
        const dlY = dl.getFullYear();
        const dlM = String(dl.getMonth() + 1).padStart(2, '0');
        const dlD = String(dl.getDate()).padStart(2, '0');
        const dlH = String(dl.getHours()).padStart(2, '0');
        const dlMin = String(dl.getMinutes()).padStart(2, '0');
        req.certificateDeadline = `${dlY}-${dlM}-${dlD} ${dlH}:${dlMin}:00`;
      }

      addNotification(
        `Your OD request ${requestId} for ${req.eventName} was sanctioned by HOD. Mandatory participation certificate must be uploaded within 24 hours after the event ends.`,
        'info',
        requestId
      );
      break;
  }

  updateODRequest(req);
  return req;
};

export const rejectODRequestByFaculty = (
  requestId: string,
  faculty: Faculty,
  rejectionReason: string
): ODRequest | undefined => {
  const req = getODRequestById(requestId);
  if (!req) return undefined;

  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const stageUpdate = {
    status: 'Rejected' as const,
    date: formattedDate,
    time: formattedTime,
    faculty_id: faculty.faculty_id,
    faculty_name: faculty.name,
    faculty_designation: faculty.designation,
    faculty_role: faculty.role,
    feedback: rejectionReason,
  };

  switch (faculty.role) {
    case 'Mentor':
      req.stages.mentor = stageUpdate;
      break;
    case 'Class Incharge':
      req.stages.classIncharge = stageUpdate;
      break;
    case 'HOD':
    default:
      req.stages.hod = stageUpdate;
      break;
  }

  req.status = 'Rejected';
  req.approvalStage = 'Rejected';
  req.rejectionReason = rejectionReason;
  req.rejectedByFacultyId = faculty.faculty_id;
  req.rejectedByFacultyName = faculty.name;
  req.rejectedAt = `${formattedDate}, ${formattedTime}`;

  updateODRequest(req);

  addNotification(`Your OD Request ${requestId} for ${req.eventName} was rejected by ${faculty.role} (${faculty.name}): ${rejectionReason}`, 'error', requestId);

  return req;
};

// ==========================================
// ATTENDANCE & MARKS API
// ==========================================

export const getAttendance = (): AttendanceSubject[] => {
  initializeDatabase();
  try {
    const raw = localStorage.getItem(KEYS.ATTENDANCE);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(initialAttendance));
      return initialAttendance;
    }
    return parsed;
  } catch {
    return initialAttendance;
  }
};

export const updateAttendanceForApprovedOD = (eventType: EventType): void => {
  const att = getAttendance();
  const updated = att.map(sub => ({
    ...sub,
    odApproved: sub.odApproved + 1,
    attended: Math.min(sub.totalClasses, sub.attended + 1),
    absent: Math.max(0, sub.absent - 1),
    attendancePercent: Math.min(100, Math.round(((sub.attended + 1) / sub.totalClasses) * 100 * 10) / 10),
  }));

  localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(updated));

  const totalClasses = updated.reduce((acc, s) => acc + s.totalClasses, 0);
  const totalAttended = updated.reduce((acc, s) => acc + s.attended, 0);
  const overallPercent = Math.round((totalAttended / totalClasses) * 100 * 10) / 10;

  const student = getStudentProfile();
  student.attendancePercent = overallPercent;
  saveStudentProfile(student);

  window.dispatchEvent(new CustomEvent('odStateUpdated'));
};

export const getCATMarks = (): CATMarksEntry[] => {
  initializeDatabase();
  try {
    const raw = localStorage.getItem(KEYS.MARKS);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(KEYS.MARKS, JSON.stringify(initialMarks));
      return initialMarks;
    }
    return parsed;
  } catch {
    return initialMarks;
  }
};

// ==========================================
// CERTIFICATES API
// ==========================================

export const getCertificates = (): CertificateItem[] => {
  initializeDatabase();
  try {
    const raw = localStorage.getItem(KEYS.CERTIFICATES);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(KEYS.CERTIFICATES, JSON.stringify(initialCertificates));
      return initialCertificates;
    }
    return parsed;
  } catch {
    return initialCertificates;
  }
};

export const uploadCertificate = (requestId: string, eventName: string, file: File | string): CertificateItem => {
  const certs = getCertificates();
  const student = getStudentProfile();
  const fileName = typeof file === 'string' ? file : file.name;
  const fileUrl = typeof file === 'string' ? '#' : URL.createObjectURL(file);

  const newCert: CertificateItem = {
    id: `cert${certs.length + 1}`,
    requestId,
    eventName,
    certificateName: fileName,
    uploadDate: new Date().toISOString().split('T')[0],
    status: 'Pending Verification',
    fileUrl,
    studentName: student.name,
    studentRegNo: student.registerNumber,
  };

  certs.unshift(newCert);
  localStorage.setItem(KEYS.CERTIFICATES, JSON.stringify(certs));

  const req = getODRequestById(requestId);
  if (req) {
    req.certificateStatus = 'Pending Verification';
    req.documentUrl = fileName;
    updateODRequest(req);
  }

  addNotification(`Certificate uploaded for ${eventName}. Awaiting verification.`, 'info', requestId);
  addFacultyNotification(`Certificate uploaded for ${eventName} by ${student.name}.`, 'info', 'FAC001', requestId);

  window.dispatchEvent(new CustomEvent('odStateUpdated'));
  window.dispatchEvent(new CustomEvent('odFacultyStateUpdated'));

  return newCert;
};

export const verifyCertificateByFaculty = (
  certId: string, 
  arg2: 'Verified' | 'Rejected' | Faculty,
  arg3?: Faculty | 'Verified' | 'Rejected',
  remarks?: string
): void => {
  const certs = getCertificates();
  const index = certs.findIndex(c => c.id === certId);
  if (index !== -1) {
    let status: 'Verified' | 'Rejected' = 'Verified';
    let faculty: Faculty = getCurrentFaculty();

    if (typeof arg2 === 'string') {
      status = arg2 as 'Verified' | 'Rejected';
      if (arg3 && typeof arg3 === 'object') {
        faculty = arg3 as Faculty;
      }
    } else if (typeof arg2 === 'object') {
      faculty = arg2 as Faculty;
      if (arg3 && typeof arg3 === 'string') {
        status = arg3 as 'Verified' | 'Rejected';
      }
    }

    const formattedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    certs[index].status = status;
    certs[index].verifiedBy = `${faculty.name} (${faculty.role})`;
    certs[index].verifiedDate = formattedDate;
    localStorage.setItem(KEYS.CERTIFICATES, JSON.stringify(certs));

    const req = getODRequestById(certs[index].requestId);
    if (req) {
      req.certificateStatus = status;
      req.verifiedByFacultyId = faculty.faculty_id;
      req.verifiedByFacultyName = faculty.name;
      req.verifiedAt = `${formattedDate}, ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
      
      if (status === 'Verified') {
        // Requirement 8: When verified, mark as Approved / Completed and grant compensatory attendance
        req.status = 'Approved';
        req.approvalStage = 'Approved';
        updateAttendanceForApprovedOD(req.eventType);
      } else {
        req.status = 'Rejected';
        req.approvalStage = 'Rejected';
        req.rejectionReason = remarks || `Certificate rejected by ${faculty.role} (${faculty.name})`;
        req.remarks = req.rejectionReason;
      }
      updateODRequest(req);
    }

    addNotification(
      `Your certificate for ${certs[index].eventName} was ${status.toLowerCase()} by ${faculty.role} (${faculty.name}).`,
      status === 'Verified' ? 'success' : 'error',
      certs[index].requestId
    );

    window.dispatchEvent(new CustomEvent('odStateUpdated'));
    window.dispatchEvent(new CustomEvent('odFacultyStateUpdated'));
  }
};

export const simulateVerifyCertificate = (certId: string, status: 'Verified' | 'Rejected'): void => {
  verifyCertificateByFaculty(certId, status);
};

// ==========================================
// NOTIFICATIONS API
// ==========================================

export const getNotifications = (): NotificationItem[] => {
  initializeDatabase();
  return JSON.parse(localStorage.getItem(KEYS.NOTIFICATIONS) || '[]');
};

export const addNotification = (
  message: string, 
  type: 'info' | 'success' | 'warning' | 'error' = 'info', 
  relatedRequestId?: string
): void => {
  const notifs = getNotifications();
  const newNotif: NotificationItem = {
    id: `notif_${Date.now()}`,
    recipientType: 'student',
    recipientId: '23CSD001',
    message,
    timestamp: new Date().toISOString(),
    read: false,
    type,
    relatedRequestId,
  };
  notifs.unshift(newNotif);
  localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(notifs));
};

export const markNotificationAsRead = (id: string): void => {
  const notifs = getNotifications();
  const index = notifs.findIndex(n => n.id === id);
  if (index !== -1) {
    notifs[index].read = true;
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(notifs));
    window.dispatchEvent(new CustomEvent('odStateUpdated'));
  }
};

export const markAllNotificationsAsRead = (): void => {
  const notifs = getNotifications().map(n => ({ ...n, read: true }));
  localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(notifs));
  window.dispatchEvent(new CustomEvent('odStateUpdated'));
};

export const clearAllNotifications = (): void => {
  localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify([]));
  window.dispatchEvent(new CustomEvent('odStateUpdated'));
};

export const getFacultyNotifications = (facultyId?: string, role?: UserRole): NotificationItem[] => {
  initializeDatabase();
  const notifs: NotificationItem[] = JSON.parse(localStorage.getItem(KEYS.FACULTY_NOTIFICATIONS) || '[]');
  if (!facultyId && !role) return notifs;
  return notifs.filter((n: NotificationItem) => (n.recipientId === facultyId) || (n.recipientRole === role));
};

export const addFacultyNotification = (
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info',
  recipientId?: string,
  relatedRequestId?: string,
  recipientRole?: UserRole
): void => {
  const notifs: NotificationItem[] = JSON.parse(localStorage.getItem(KEYS.FACULTY_NOTIFICATIONS) || '[]');
  const newNotif: NotificationItem = {
    id: `fnotif_${Date.now()}`,
    recipientType: 'faculty',
    recipientId,
    recipientRole,
    message,
    timestamp: new Date().toISOString(),
    read: false,
    type,
    relatedRequestId,
  };
  notifs.unshift(newNotif);
  localStorage.setItem(KEYS.FACULTY_NOTIFICATIONS, JSON.stringify(notifs));
};

export const markFacultyNotificationAsRead = (id: string): void => {
  const notifs: NotificationItem[] = JSON.parse(localStorage.getItem(KEYS.FACULTY_NOTIFICATIONS) || '[]');
  const index = notifs.findIndex(n => n.id === id);
  if (index !== -1) {
    notifs[index].read = true;
    localStorage.setItem(KEYS.FACULTY_NOTIFICATIONS, JSON.stringify(notifs));
    window.dispatchEvent(new CustomEvent('odFacultyStateUpdated'));
  }
};

export const markAllFacultyNotificationsAsRead = (facultyId?: string): void => {
  const notifs: NotificationItem[] = JSON.parse(localStorage.getItem(KEYS.FACULTY_NOTIFICATIONS) || '[]').map((n: NotificationItem) => {
    if (!facultyId || n.recipientId === facultyId) {
      return { ...n, read: true };
    }
    return n;
  });
  localStorage.setItem(KEYS.FACULTY_NOTIFICATIONS, JSON.stringify(notifs));
  window.dispatchEvent(new CustomEvent('odFacultyStateUpdated'));
};

// ==========================================
// DEPARTMENT ANALYTICS API (FOR HOD)
// ==========================================

export const getDepartmentStats = () => {
  const reqs = getODRequests();
  const students = getClassStudents();
  const faculties = getFacultyList();
  
  const totalRequests = reqs.length;
  const approved = reqs.filter(r => r.status === 'Approved').length;
  const pending = reqs.filter(r => r.status === 'Pending').length;
  const rejected = reqs.filter(r => r.status === 'Rejected').length;

  const hackathonCount = reqs.filter(r => r.eventType === 'Hackathon').length;
  const sportsCount = reqs.filter(r => r.eventType === 'Sports').length;
  const symposiumCount = reqs.filter(r => r.eventType === 'Symposium').length;
  const workshopCount = reqs.filter(r => r.eventType === 'Workshop').length;

  return {
    totalStudents: 68,
    activeODsToday: pending,
    totalODsSanctioned: approved,
    totalRejected: rejected,
    approvalRate: totalRequests > 0 ? Math.round((approved / totalRequests) * 100) : 0,
    departmentAvgAttendance: 87.4,
    eventDistribution: {
      Hackathon: hackathonCount,
      Sports: sportsCount,
      Symposium: symposiumCount,
      Workshop: workshopCount,
    },
    studentsAtRisk: students.filter(s => s.attendancePercent < 75).length,
    faculties,
  };
};

export const getDepartmentAnalytics = () => getDepartmentStats();
