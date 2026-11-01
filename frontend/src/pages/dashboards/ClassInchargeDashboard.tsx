import React, { useState, useEffect } from 'react';
import { 
  Users, CheckCircle2, XCircle, Hourglass, 
  Eye, Check, X, Search, Filter, Calendar, 
  FileText, TrendingUp, AlertTriangle, ArrowRight,
  ShieldCheck, Award, Sparkles, BookOpen, ExternalLink,
  Upload, Clock, CheckCircle, ShieldAlert, Download,
  CalendarPlus, CheckSquare, Square, Layers, AlertCircle
} from 'lucide-react';
import { 
  getFacultyODRequests, approveODRequestByFaculty, 
  rejectODRequestByFaculty, getCurrentFaculty, 
  getClassStudents, getAuthSession, getCertificates,
  verifyCertificateByFaculty, getODRequests,
  extendCertificateDeadlinesMock
} from '../../data/mockData';
import { 
  apiGetClassInchargeODRequests, 
  apiApproveODRequestByClassIncharge, 
  apiRejectODRequestByClassIncharge,
  apiGetAcademicStudents,
  apiGetClassInchargeCertificates,
  apiVerifyClassInchargeCertificate,
  apiExtendCertificateDeadline,
  apiGetClassInchargePendingUploads
} from '../../services/api';
import { ODRequest, Faculty, ClassStudentInfo, CertificateItem } from '../../types/types';
import { PortalLayout } from '../../layouts/PortalLayout';
import { StatusBadge } from '../../components/StatusBadge';
import { ODDetailModal } from '../../components/ODDetailModal';
import { ApproveModal, RejectModal } from '../../components/ConfirmationModal';
import { AcademicDataUpload } from '../../components/AcademicDataUpload';
import { StudentManagement } from '../../components/class-incharge/StudentManagement';
import { CertificatePreviewModal } from '../../components/CertificatePreviewModal';
import { useToast } from '../../components/Toast';
import { downloadODLetter, downloadCertificateFile } from '../../utils/downloadHelper';

export type HistoryStatusFilter = 'All Statuses' | 'Approved' | 'Rejected' | 'Pending' | 'OD Sanctioned';

export const ClassInchargeDashboard: React.FC = () => {
  const { showToast } = useToast();
  const [faculty, setFaculty] = useState<Faculty>(getCurrentFaculty());
  const [activeTab, setActiveTab] = useState<'pending' | 'certificates' | 'student-management' | 'history' | 'upload'>('pending');
  const [data, setData] = useState<{
    all: ODRequest[];
    pending: ODRequest[];
    approved: ODRequest[];
    rejected: ODRequest[];
  }>({ all: [], pending: [], approved: [], rejected: [] });

  const [students, setStudents] = useState<ClassStudentInfo[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ODRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Certificates queue state
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [certFilter, setCertFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [previewCert, setPreviewCert] = useState<CertificateItem | null>(null);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [rejectCertTarget, setRejectCertTarget] = useState<CertificateItem | null>(null);
  const [rejectCertRemarks, setRejectCertRemarks] = useState('');
  const [isRejectCertModalOpen, setIsRejectCertModalOpen] = useState(false);

  // Bulk Deadline Extension state inside Pending Verification
  const [pendingUploads, setPendingUploads] = useState<any[]>([]);
  const [pendingSection, setPendingSection] = useState<'uploaded' | 'pending_upload'>('uploaded');
  const [selectedReqIds, setSelectedReqIds] = useState<string[]>([]);
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>('all');
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [newDeadlineInput, setNewDeadlineInput] = useState('');
  const [extendReasonInput, setExtendReasonInput] = useState('');
  const [isExtending, setIsExtending] = useState(false);

  // Actions
  const [actionReq, setActionReq] = useState<ODRequest | null>(null);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>('All Statuses');

  const loadData = async () => {
    const curr = getCurrentFaculty();
    setFaculty(curr);
    const session = getAuthSession();
    
    // First set local state as fallback
    const localReqs = getFacultyODRequests(curr);
    setData(localReqs);
    setStudents(getClassStudents());

    // Sync from Flask Backend API
    try {
      let activeRequests: ODRequest[] = localReqs.all;
      const backendRes = await apiGetClassInchargeODRequests(session?.token);
      if (backendRes.success && Array.isArray(backendRes.requests)) {
        activeRequests = backendRes.requests;
        setData({
          all: backendRes.requests,
          pending: backendRes.pending || backendRes.requests.filter(r => r.status === 'Mentor Approved'),
          approved: backendRes.approved || backendRes.requests.filter(r => (r.status || '').includes('Approved')),
          rejected: backendRes.rejected || backendRes.requests.filter(r => (r.status || '').includes('Rejected')),
        });
      }

      // Sync academic students roster directly from central database
      const acadRes = await apiGetAcademicStudents(session?.token);
      if (acadRes.success && Array.isArray(acadRes.students) && acadRes.students.length > 0) {
        setStudents(prev => {
          return acadRes.students!.map(s => {
            const existing = prev.find(u => u.registerNumber.toUpperCase() === s.registerNumber.toUpperCase());
            return {
              id: (s as any).studentId || s.id || (existing ? existing.id : 'STUD'),
              rollNo: s.rollNo || s.registerNumber,
              name: (s as any).studentName || s.name || (existing ? existing.name : 'Unknown'),
              registerNumber: s.registerNumber,
              department: s.department || (existing ? existing.department : 'Computer Science and Design'),
              year: s.year || (existing ? existing.year : 'III Year'),
              section: s.section || (existing ? existing.section : 'A'),
              mentorId: existing?.mentorId || 'FAC001',
              mentorName: existing?.mentorName || 'Dr. A. Rajesh',
              attendancePercent: s.attendancePercentage != null ? s.attendancePercentage : (s.attendancePercent != null ? s.attendancePercent : (existing?.attendancePercent || 85)),
              totalODsTaken: existing?.totalODsTaken || 0,
              cat1Average: s.cat1Marks != null ? s.cat1Marks : ((s as any).cat1_marks != null ? (s as any).cat1_marks : (s.cat1Average != null ? s.cat1Average : (existing?.cat1Average ?? null))),
              cat2Average: s.cat2Marks != null ? s.cat2Marks : ((s as any).cat2_marks != null ? (s as any).cat2_marks : (s.cat2Average != null ? s.cat2Average : (existing?.cat2Average ?? null))),
              cat3Average: s.cat3Marks != null ? s.cat3Marks : ((s as any).cat3_marks != null ? (s as any).cat3_marks : (s.cat3Average != null ? s.cat3Average : (existing?.cat3Average ?? null))),
              avatar: s.avatar || existing?.avatar,
            };
          });
        });
      }

      // Sync certificates for Class Incharge verification queue
      const certRes = await apiGetClassInchargeCertificates(session?.token);
      if (certRes.success && Array.isArray(certRes.certificates) && certRes.certificates.length > 0) {
        setCertificates(certRes.certificates.map(c => {
          const cName = c.certificateName || (c.certificateUrl ? c.certificateUrl.split('/').pop() : 'certificate.pdf');
          const fileUrl = c.fileUrl || c.certificateUrl || c.certificate_file_url || (cName ? `/api/od-requests/uploads/certificates/${cName}` : '');
          let status: 'Verified' | 'Pending Verification' | 'Rejected' = 'Pending Verification';
          if (c.status === 'Verified') status = 'Verified';
          else if (c.status === 'Rejected') status = 'Rejected';

          return {
            id: c.id || `CERT_${c.requestId || c.request_id}`,
            requestId: c.requestId || c.request_id,
            eventName: c.eventName || c.event_name,
            studentName: c.studentName || c.student_name,
            studentRegNo: c.studentRegNo || c.student_reg_no || c.studentRegisterNo,
            certificateName: cName,
            fileUrl,
            uploadDate: c.uploadDate || c.upload_date || c.createdAt || new Date().toISOString(),
            status,
            verifiedBy: c.verified_by_name || c.verifiedBy,
            verifiedDate: c.verified_at || c.verifiedDate,
          };
        }));
      } else {
        setCertificates(getCertificates());
      }

      // Sync or derive pending certificate uploads for deadline extension
      if (certRes.success && Array.isArray(certRes.pending_uploads) && certRes.pending_uploads.length > 0) {
        setPendingUploads(certRes.pending_uploads);
      } else {
        // Fallback calculation from assigned OD requests
        const now = new Date();
        const derivedPending = activeRequests.filter(r => {
          const isHodAppr = (r.status || '').includes('HOD Approved') || r.approvalStage === 'Certificate Pending' || r.currentStage === 'Certificate Pending';
          const notUploaded = !r.certificateUrl && r.certificateStatus !== 'Verified' && r.certificateStatus !== 'Pending Verification';
          const isExpired = r.certificateStatus === 'Deadline Expired' || (r.status === 'Rejected' && (r.rejectionReason || '').includes('24'));
          return (isHodAppr && notUploaded) || isExpired;
        }).map(r => {
          const toDateStr = r.toDate || r.fromDate || r.eventDate;
          const toTimeStr = r.toTime || '17:00';
          const endDt = r.eventEndDatetime ? new Date(r.eventEndDatetime) : new Date(`${toDateStr}T${toTimeStr}:00`);
          let deadlineDt = r.certificateDeadline ? new Date(r.certificateDeadline) : null;
          if (!deadlineDt || isNaN(deadlineDt.getTime())) {
            if (!isNaN(endDt.getTime())) {
              deadlineDt = new Date(endDt.getTime() + 24 * 60 * 60 * 1000);
            }
          }
          const isOverdue = deadlineDt ? now > deadlineDt : false;
          let remainingText = '';
          if (deadlineDt && !isNaN(deadlineDt.getTime())) {
            if (isOverdue) {
              const diffMs = now.getTime() - deadlineDt.getTime();
              const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
              const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
              remainingText = diffHrs > 0 ? `Overdue by ${diffHrs}h ${diffMins}m` : `Overdue by ${diffMins}m`;
            } else {
              const diffMs = deadlineDt.getTime() - now.getTime();
              const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
              const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
              remainingText = `${diffHrs}h ${diffMins}m left`;
            }
          }
          return {
            ...r,
            requestId: r.id,
            certificateDeadline: deadlineDt ? deadlineDt.toISOString().replace('T', ' ').substring(0, 19) : '',
            isOverdue,
            remainingText
          };
        });
        setPendingUploads(derivedPending);
      }
    } catch (err) {
      console.warn('Could not sync Class Incharge data from backend:', err);
      setCertificates(getCertificates());
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('odFacultyStateUpdated', handleUpdate);
    window.addEventListener('odStateUpdated', handleUpdate);
    return () => {
      window.removeEventListener('odFacultyStateUpdated', handleUpdate);
      window.removeEventListener('odStateUpdated', handleUpdate);
    };
  }, []);

  const handleVerifyCertificateAction = async (certId: string, status: 'Verified' | 'Rejected', remarks?: string) => {
    const session = getAuthSession();
    const cert = certificates.find(c => c.id === certId || c.requestId === certId);
    const targetReqId = cert?.requestId || certId;

    try {
      const res = await apiVerifyClassInchargeCertificate(targetReqId, status, remarks, session?.token);
      verifyCertificateByFaculty(cert?.id || certId, status, faculty, remarks);
      
      if (status === 'Verified') {
        showToast(res?.message || `Certificate verified! OD request ${targetReqId} officially sanctioned.`, 'success');
      } else {
        showToast(res?.message || `Certificate rejected. OD request ${targetReqId} marked as rejected.`, 'error');
      }
    } catch (err: any) {
      verifyCertificateByFaculty(cert?.id || certId, status, faculty, remarks);
      showToast(`Certificate status updated to ${status}.`, status === 'Verified' ? 'success' : 'error');
    }

    setIsCertModalOpen(false);
    setPreviewCert(null);
    setIsRejectCertModalOpen(false);
    setRejectCertTarget(null);
    setRejectCertRemarks('');
    loadData();
  };

  const handleApproveConfirm = async (remarks: string) => {
    if (!actionReq) return;
    const session = getAuthSession();

    const res = await apiApproveODRequestByClassIncharge(actionReq.id, remarks, session?.token);
    if (res.success) {
      showToast(res.message || `OD request ${actionReq.id} endorsed and forwarded to HOD for final sanction!`, 'success');
      approveODRequestByFaculty(actionReq.id, faculty, remarks);
    } else {
      showToast(res.error || `Failed to endorse OD request ${actionReq.id}.`, 'error');
    }

    setIsApproveOpen(false);
    setActionReq(null);
    loadData();
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!actionReq) return;
    if (!reason || !reason.trim()) {
      showToast('Rejection reason / remark is mandatory.', 'error');
      return;
    }
    const session = getAuthSession();

    const res = await apiRejectODRequestByClassIncharge(actionReq.id, reason, session?.token);
    if (res.success) {
      showToast(res.message || `OD request ${actionReq.id} rejected. Reason logged.`, 'error');
      rejectODRequestByFaculty(actionReq.id, faculty, reason);
    } else {
      showToast(res.error || `Failed to reject OD request ${actionReq.id}.`, 'error');
    }

    setIsRejectOpen(false);
    setActionReq(null);
    loadData();
  };

  const handleViewODLetter = (req: ODRequest) => {
    const letterUrl = req.documentUrl || (req as any).odLetterUrl;
    if (letterUrl && letterUrl.startsWith('/api/')) {
      window.open(letterUrl, '_blank');
    } else {
      window.open(`/api/class-incharge/od-requests/${req.id}/letter`, '_blank');
    }
  };

  const handleDownloadODLetter = async (req: ODRequest) => {
    const session = getAuthSession();
    showToast(`Downloading OD letter for ${req.id}...`, 'info');
    try {
      await downloadODLetter(req, 'Class Incharge', session?.token);
      showToast(`OD letter downloaded successfully`, 'success');
    } catch {
      showToast(`Error downloading OD letter`, 'error');
    }
  };

  const handleDownloadCert = async (cert: CertificateItem) => {
    const session = getAuthSession();
    showToast(`Downloading certificate for ${cert.studentName}...`, 'info');
    try {
      await downloadCertificateFile(cert, session?.token);
      showToast(`Certificate downloaded successfully`, 'success');
    } catch {
      showToast(`Error downloading certificate`, 'error');
    }
  };

  // Deadline extension helpers
  const handleToggleSelectReq = (reqId: string) => {
    setSelectedReqIds(prev => 
      prev.includes(reqId) ? prev.filter(id => id !== reqId) : [...prev, reqId]
    );
  };

  const handleToggleSelectAll = (targetItems: any[]) => {
    const targetIds = targetItems.map(item => item.id || item.requestId);
    const allSelected = targetIds.length > 0 && targetIds.every(id => selectedReqIds.includes(id));
    if (allSelected) {
      setSelectedReqIds(prev => prev.filter(id => !targetIds.includes(id)));
    } else {
      setSelectedReqIds(prev => Array.from(new Set([...prev, ...targetIds])));
    }
  };

  const handleOpenExtendModal = () => {
    if (selectedReqIds.length === 0) {
      showToast('Please select at least one student whose certificate deadline you wish to extend.', 'error');
      return;
    }
    const defDate = new Date();
    defDate.setDate(defDate.getDate() + 3);
    defDate.setHours(17, 0, 0, 0);
    const localIso = new Date(defDate.getTime() - defDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setNewDeadlineInput(localIso);
    setExtendReasonInput('');
    setIsExtendModalOpen(true);
  };

  const handleQuickPreset = (daysToAdd: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysToAdd);
    d.setHours(17, 0, 0, 0);
    const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setNewDeadlineInput(localIso);
  };

  const handleConfirmExtendDeadline = async () => {
    if (!newDeadlineInput) {
      showToast('Please select a valid new submission deadline date and time.', 'error');
      return;
    }

    const parsedDate = new Date(newDeadlineInput);
    if (isNaN(parsedDate.getTime()) || parsedDate <= new Date()) {
      showToast('New deadline must be a future date and time.', 'error');
      return;
    }

    const session = getAuthSession();
    setIsExtending(true);

    try {
      const res = await apiExtendCertificateDeadline(
        selectedReqIds,
        newDeadlineInput,
        extendReasonInput,
        session?.token
      );

      // Also sync local mock state
      extendCertificateDeadlinesMock(
        selectedReqIds,
        parsedDate.toISOString().replace('T', ' ').substring(0, 19),
        faculty,
        extendReasonInput
      );

      if (res.success) {
        showToast(
          res.message || `Successfully extended deadline for ${selectedReqIds.length} student(s) to ${parsedDate.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}!`,
          'success'
        );
        setSelectedReqIds([]);
        setIsExtendModalOpen(false);
        loadData();
      } else {
        showToast(res.error || 'Failed to extend deadline.', 'error');
      }
    } catch (err: any) {
      extendCertificateDeadlinesMock(
        selectedReqIds,
        parsedDate.toISOString().replace('T', ' ').substring(0, 19),
        faculty,
        extendReasonInput
      );
      showToast(`Certificate deadline extended for ${selectedReqIds.length} student(s).`, 'success');
      setSelectedReqIds([]);
      setIsExtendModalOpen(false);
      loadData();
    } finally {
      setIsExtending(false);
    }
  };

  const uniqueEvents = Array.from(
    new Set(pendingUploads.map(p => p.eventName || p.event_name).filter(Boolean))
  );

  const filteredPendingUploads = pendingUploads.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchesQuery = 
      (p.studentName || '').toLowerCase().includes(q) ||
      (p.studentRegNo || p.studentRegisterNo || '').toLowerCase().includes(q) ||
      (p.eventName || '').toLowerCase().includes(q) ||
      (p.id || p.requestId || '').toLowerCase().includes(q);

    if (!matchesQuery) return false;
    if (selectedEventFilter !== 'all' && (p.eventName || p.event_name) !== selectedEventFilter) {
      return false;
    }
    return true;
  });

  const pendingCertCount = certificates.filter(c => c.status === 'Pending Verification').length;

  const filteredCertificates = certificates.filter(c => {
    const q = searchQuery.toLowerCase();
    const matchesQuery = 
      (c.studentName || '').toLowerCase().includes(q) ||
      (c.studentRegNo || '').toLowerCase().includes(q) ||
      (c.eventName || '').toLowerCase().includes(q) ||
      (c.requestId || '').toLowerCase().includes(q) ||
      (c.certificateName || '').toLowerCase().includes(q);

    if (!matchesQuery) return false;
    if (certFilter === 'pending') return c.status === 'Pending Verification';
    if (certFilter === 'verified') return c.status === 'Verified';
    if (certFilter === 'rejected') return c.status === 'Rejected';
    return true;
  });

  const filteredPending = data.pending.filter(r =>
    r.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.studentRegisterNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.eventName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.registerNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredHistory = data.all.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (r.studentName || '').toLowerCase().includes(q) ||
      (r.studentRegisterNo || (r as any).studentRegNo || '').toLowerCase().includes(q) ||
      (r.eventName || '').toLowerCase().includes(q) ||
      (r.id || '').toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (statusFilter === 'All Statuses') return true;

    const s = (r.status || '').toLowerCase().trim();
    if (statusFilter === 'OD Sanctioned') {
      return s === 'od sanctioned' || s === 'sanctioned' || s === 'completed';
    }
    if (statusFilter === 'Approved') {
      return (
        (s === 'approved' || s.includes('approved')) &&
        s !== 'od sanctioned' &&
        s !== 'completed' &&
        !s.includes('mentor') &&
        !s.includes('rejected')
      );
    }
    if (statusFilter === 'Rejected') {
      return s === 'rejected' || s.includes('rejected') || s.includes('expired');
    }
    if (statusFilter === 'Pending') {
      return (
        s === 'pending' ||
        s.includes('pending') ||
        s === 'mentor approved' ||
        s === 'submitted'
      ) && !s.includes('rejected');
    }
    return true;
  });

  return (
    <PortalLayout role="Class Incharge">
      <div className="space-y-6">
        
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-teal-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-4">
            <img 
              src={faculty.avatar || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&h=150&q=80'} 
              alt={faculty.name} 
              className="w-14 h-14 rounded-2xl object-cover border-2 border-teal-400/40 shadow-md"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30">
                  {faculty.role}
                </span>
                <span className="text-xs text-slate-300 font-semibold">{faculty.department}</span>
              </div>
              <h2 className="text-xl font-black text-white mt-0.5">{faculty.name}</h2>
              <p className="text-xs text-slate-300 font-medium">Assigned: <strong className="text-teal-200">{faculty.assigned_section}</strong></p>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur-xs px-4 py-2.5 rounded-2xl border border-white/10 text-center">
              <span className="text-xs text-slate-300 font-bold uppercase tracking-wider block">Class Strength</span>
              <span className="text-lg font-black text-white">{students.length} Students</span>
            </div>
            <div className="bg-teal-500/20 backdrop-blur-xs px-4 py-2.5 rounded-2xl border border-teal-400/30 text-center">
              <span className="text-xs text-teal-300 font-bold uppercase tracking-wider block">Forwarded ODs</span>
              <span className="text-lg font-black text-teal-200">{data.pending.length} Pending</span>
            </div>
            <div className="bg-amber-500/20 backdrop-blur-xs px-4 py-2.5 rounded-2xl border border-amber-400/30 text-center">
              <span className="text-xs text-amber-300 font-bold uppercase tracking-wider block">Certificates</span>
              <span className="text-lg font-black text-amber-200">{pendingCertCount} To Verify</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs & Search Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'pending'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-200'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Hourglass className="w-3.5 h-3.5" />
              <span>Pending Endorsements ({data.pending.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('certificates')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'certificates'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-200'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Certificate Verification</span>
              {pendingCertCount > 0 && (
                <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] rounded-full font-black animate-pulse">
                  {pendingCertCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('student-management')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'student-management'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-200'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Student Management</span>
              <span className="ml-1 px-1.5 py-0.2 bg-teal-100 text-teal-800 text-[10px] rounded-full font-extrabold">
                New
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-200'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>OD History & Records ({data.all.length})</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            {activeTab === 'history' && (
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as HistoryStatusFilter)}
                  className="w-full sm:w-auto bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold text-slate-800 focus:outline-none focus:border-teal-500 cursor-pointer shadow-xs hover:border-slate-300 transition-colors"
                  aria-label="Filter by Status"
                >
                  <option value="All Statuses">All Statuses</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Pending">Pending</option>
                  <option value="OD Sanctioned">OD Sanctioned</option>
                </select>
              </div>
            )}

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search student or request..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs font-semibold text-slate-800 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>
        </div>

        {/* Tab 1: Pending OD Requests */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            {filteredPending.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h3 className="text-base font-bold text-slate-800">All caught up!</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No pending OD requests waiting for Class Incharge endorsement right now.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredPending.map((req) => (
                  <div 
                    key={req.id}
                    className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md p-6 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 max-w-xl">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900">{req.id}</span>
                        <StatusBadge status={req.status} size="sm" />
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200">
                          {req.eventType}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-slate-900">{req.eventName}</h4>
                      
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span><strong>Student:</strong> {req.studentName} ({req.studentRegisterNo})</span>
                        <span>&bull;</span>
                        <span><strong>Organizer:</strong> {req.eventOrganizer}</span>
                        <span>&bull;</span>
                        <span><strong>Date:</strong> {req.eventDate} ({req.fromTime} - {req.toTime})</span>
                      </div>

                      {/* Mentor Recommendation Remarks */}
                      {(req.stages?.mentor?.feedback || (req as any).mentorRemarks) && (
                        <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900">
                          <strong>Mentor Remarks {req.stages?.mentor?.faculty_name ? `(${req.stages.mentor.faculty_name})` : ''}:</strong> "{req.stages?.mentor?.feedback || (req as any).mentorRemarks}"
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleViewODLetter(req)}
                        className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
                        title="Inspect uploaded OD Request Letter"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Letter</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadODLetter(req)}
                        className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                        title="Download uploaded OD Request Letter"
                      >
                        <Download className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Download Letter</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRequest(req);
                          setIsDetailOpen(true);
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Details</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActionReq(req);
                          setIsRejectOpen(true);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActionReq(req);
                          setIsApproveOpen(true);
                        }}
                        className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-sm text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Endorse & Forward to HOD</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Certificate Verification */}
        {activeTab === 'certificates' && (
          <div className="space-y-6">
            
            {/* Policy & Authority Header Banner */}
            <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-teal-950 via-slate-900 to-indigo-950 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-teal-500/20">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-teal-500/20 text-teal-300 border border-teal-400/30">
                    <Award className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white">Event Certificate Verification & Final OD Sanction</h3>
                </div>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  As Class Incharge, inspect genuine PDF or image participation proofs submitted by students after their event. 
                  Verifying the certificate <strong className="text-teal-300">officially sanctions the OD request</strong> and grants compensatory attendance. 
                  Rejecting marks the application as <strong className="text-rose-300">rejected</strong>.
                </p>
              </div>

              {pendingCertCount > 0 ? (
                <div className="px-4 py-3 rounded-2xl bg-amber-500/20 border border-amber-400/30 text-amber-300 flex items-center gap-2.5 self-start md:self-auto shrink-0">
                  <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span className="text-xs font-black">{pendingCertCount} Certificate{pendingCertCount > 1 ? 's' : ''} Pending Verification</span>
                </div>
              ) : (
                <div className="px-4 py-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 flex items-center gap-2.5 self-start md:self-auto shrink-0">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-black">All Uploaded Certificates Verified</span>
                </div>
              )}
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Certificates</span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">{certificates.length}</span>
              </div>
              <div 
                onClick={() => {
                  setCertFilter('pending');
                  setPendingSection('uploaded');
                }}
                className={`p-4 rounded-2xl border shadow-xs cursor-pointer transition-all ${
                  certFilter === 'pending' && pendingSection === 'uploaded'
                    ? 'bg-amber-100/80 border-amber-300 ring-2 ring-amber-400/20'
                    : 'bg-amber-50 border-amber-200 hover:bg-amber-100/60'
                }`}
                title="View uploaded participation proofs awaiting verification"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Pending Review</span>
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <span className="text-2xl font-black text-amber-900 mt-1 block">{pendingCertCount}</span>
              </div>
              <div 
                onClick={() => {
                  setCertFilter('pending');
                  setPendingSection('pending_upload');
                }}
                className={`p-4 rounded-2xl border shadow-xs cursor-pointer transition-all ${
                  certFilter === 'pending' && pendingSection === 'pending_upload'
                    ? 'bg-teal-100/80 border-teal-300 ring-2 ring-teal-500/20'
                    : 'bg-teal-50 border-teal-200 hover:bg-teal-100/60'
                }`}
                title="Click to view pending certificate uploads and batch extend deadlines"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider block">Awaiting Upload</span>
                  <CalendarPlus className="w-3.5 h-3.5 text-teal-600" />
                </div>
                <span className="text-2xl font-black text-teal-950 mt-1 block">{pendingUploads.length}</span>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-xs">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">OD Sanctioned</span>
                <span className="text-2xl font-black text-emerald-900 mt-1 block">
                  {certificates.filter(c => c.status === 'Verified').length}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 shadow-xs">
                <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Rejected</span>
                <span className="text-2xl font-black text-rose-900 mt-1 block">
                  {certificates.filter(c => c.status === 'Rejected').length}
                </span>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3 overflow-x-auto">
              <button
                type="button"
                onClick={() => setCertFilter('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  certFilter === 'all'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                All Certificates ({certificates.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setCertFilter('pending');
                  setPendingSection('uploaded');
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  certFilter === 'pending'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-200'
                }`}
              >
                <span>Pending Verification</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-black">
                  {pendingCertCount + pendingUploads.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setCertFilter('verified')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  certFilter === 'verified'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
                }`}
              >
                Verified & Sanctioned ({certificates.filter(c => c.status === 'Verified').length})
              </button>
              <button
                type="button"
                onClick={() => setCertFilter('rejected')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  certFilter === 'rejected'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white text-rose-800 hover:bg-rose-50 border border-rose-200'
                }`}
              >
                Rejected ({certificates.filter(c => c.status === 'Rejected').length})
              </button>
            </div>

            {/* Sub-tabs directly inside Pending Verification */}
            {certFilter === 'pending' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-slate-100/80 rounded-2xl border border-slate-200/80">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingSection('uploaded')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                      pendingSection === 'uploaded'
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Award className="w-3.5 h-3.5 text-amber-600" />
                    <span>Uploaded Proofs Pending Review</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                      {pendingCertCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPendingSection('pending_upload')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                      pendingSection === 'pending_upload'
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                    <span>Awaiting Upload & Extend Deadline</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                      pendingSection === 'pending_upload' ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {pendingUploads.length}
                    </span>
                  </button>
                </div>

                {pendingSection === 'pending_upload' && (
                  <div className="text-[11px] font-medium text-slate-500 px-2">
                    Class Incharge bulk deadline manager &bull; Select students to extend upload deadline
                  </div>
                )}
              </div>
            )}

            {/* Branch 1: Awaiting Upload & Extend Deadline */}
            {certFilter === 'pending' && pendingSection === 'pending_upload' ? (
              <div className="space-y-4">
                {/* Action Bar: Event Group Filter, Select All, and Extend Deadline Action */}
                <div className="p-4 bg-white rounded-3xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Event Filter dropdown */}
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-xs font-bold text-slate-600">Event Filter:</span>
                      <select
                        value={selectedEventFilter}
                        onChange={(e) => setSelectedEventFilter(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-semibold text-slate-800 focus:outline-none focus:border-teal-500"
                      >
                        <option value="all">All Events ({pendingUploads.length})</option>
                        {uniqueEvents.map(evt => {
                          const count = pendingUploads.filter(p => (p.eventName || p.event_name) === evt).length;
                          return (
                            <option key={evt} value={evt}>
                              {evt} ({count})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Select All Toggle */}
                    {filteredPendingUploads.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleToggleSelectAll(filteredPendingUploads)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all"
                      >
                        {filteredPendingUploads.length > 0 && filteredPendingUploads.every(p => selectedReqIds.includes(p.id || p.requestId)) ? (
                          <>
                            <CheckSquare className="w-3.5 h-3.5 text-teal-600" />
                            <span>Deselect All</span>
                          </>
                        ) : (
                          <>
                            <Square className="w-3.5 h-3.5 text-slate-400" />
                            <span>Select All ({filteredPendingUploads.length})</span>
                          </>
                        )}
                      </button>
                    )}

                    {selectedReqIds.length > 0 && (
                      <span className="px-2.5 py-1 bg-teal-50 text-teal-800 border border-teal-200 text-xs font-black rounded-xl">
                        {selectedReqIds.length} Selected
                      </span>
                    )}
                  </div>

                  {/* Extend Deadline Button */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={selectedReqIds.length === 0}
                      onClick={handleOpenExtendModal}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                        selectedReqIds.length > 0
                          ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-200 cursor-pointer'
                          : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      }`}
                      title={
                        selectedReqIds.length > 0
                          ? `Extend deadline for ${selectedReqIds.length} selected student(s)`
                          : 'Select eligible students to enable deadline extension'
                      }
                    >
                      <CalendarPlus className="w-4 h-4" />
                      <span>Extend Deadline</span>
                      {selectedReqIds.length > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-white/25 text-white text-[10px] font-black">
                          {selectedReqIds.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Eligible Students Cards */}
                {filteredPendingUploads.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                    <h3 className="text-base font-bold text-slate-800">No Pending Certificate Uploads</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      All approved OD students in your class have either submitted their certificates or are fully verified.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredPendingUploads.map((req) => {
                      const reqId = req.id || req.requestId;
                      const isSelected = selectedReqIds.includes(reqId);
                      const isOverdue = req.isOverdue || req.status === 'Deadline Expired';

                      return (
                        <div
                          key={reqId}
                          onClick={() => handleToggleSelectReq(reqId)}
                          className={`bg-white rounded-3xl p-5 border transition-all flex flex-col justify-between space-y-4 cursor-pointer select-none ${
                            isSelected
                              ? 'border-teal-500 ring-2 ring-teal-500/20 shadow-md bg-teal-50/20'
                              : 'border-slate-200/90 shadow-sm hover:shadow-md hover:border-slate-300'
                          }`}
                        >
                          <div className="space-y-3">
                            {/* Card Top: Checkbox + OD Request ID + Status */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                                    isSelected
                                      ? 'bg-teal-600 border-teal-600 text-white'
                                      : 'border-slate-300 bg-white hover:border-teal-400'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </div>
                                <span className="text-[10px] font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                                  {reqId}
                                </span>
                              </div>
                              <StatusBadge status={req.status} size="sm" />
                            </div>

                            {/* Student and Event info */}
                            <div>
                              <h4 className="font-extrabold text-sm text-slate-900 line-clamp-1">
                                {req.eventName || req.event_name}
                              </h4>
                              <p className="text-xs text-slate-600 mt-1">
                                Student: <strong className="text-slate-900">{req.studentName || req.student_name}</strong>
                                {(req.studentRegisterNo || req.student_reg_no) && (
                                  <span className="text-slate-400"> ({req.studentRegisterNo || req.student_reg_no})</span>
                                )}
                              </p>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                <span>{req.eventDate || req.event_date}</span>
                                {req.eventType && <span>&bull; {req.eventType}</span>}
                              </div>
                            </div>

                            {/* Deadline Display Box */}
                            <div className={`p-3 rounded-2xl border flex flex-col gap-1 ${
                              isOverdue
                                ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                                : 'bg-amber-50/70 border-amber-200 text-amber-900'
                            }`}>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider">
                                  Certificate Deadline
                                </span>
                                <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                                  isOverdue ? 'bg-rose-200 text-rose-800' : 'bg-amber-200 text-amber-900'
                                }`}>
                                  {isOverdue ? 'Overdue' : 'Approaching'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs font-bold">
                                <Clock className="w-3.5 h-3.5 shrink-0" />
                                <span>
                                  {req.certificateDeadline
                                    ? new Date(req.certificateDeadline).toLocaleString('en-GB', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })
                                    : 'Within 24 hours of event end'}
                                </span>
                              </div>
                              {req.remainingText && (
                                <span className="text-[10px] opacity-80">
                                  {req.remainingText}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Individual Card Quick Action */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[11px] text-slate-400">
                              {isSelected ? '✓ Selected for extension' : 'Click card to select'}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedReqIds([reqId]);
                                handleOpenExtendModal();
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors flex items-center gap-1"
                            >
                              <CalendarPlus className="w-3 h-3" />
                              <span>Extend</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Branch 2: Standard Uploaded Certificates List */
              <>
                {filteredCertificates.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
                    <CheckCircle2 className="w-12 h-12 text-teal-600 mx-auto" />
                    <h3 className="text-base font-bold text-slate-800">No certificates found</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      {certFilter === 'pending'
                        ? 'No participation certificates currently awaiting Class Incharge verification.'
                        : 'No certificates match the selected criteria.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredCertificates.map((cert) => (
                      <div
                        key={cert.id}
                        className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-mono font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-md border border-teal-200">
                              {cert.requestId}
                            </span>
                            <StatusBadge status={cert.status} size="sm" />
                          </div>

                          <div>
                            <h4 className="font-extrabold text-sm text-slate-900 line-clamp-1">{cert.eventName}</h4>
                            <p className="text-xs text-slate-600 mt-1">
                              Student: <strong className="text-slate-900">{cert.studentName}</strong>
                              {cert.studentRegNo && <span className="text-slate-400"> ({cert.studentRegNo})</span>}
                            </p>
                          </div>

                          {/* File Box */}
                          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                              <span className="text-xs font-semibold text-slate-700 truncate">{cert.certificateName}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium shrink-0">
                              {new Date(cert.uploadDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>

                          {cert.status === 'Verified' && (
                            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100 text-[11px] text-emerald-800 font-medium flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>Sanctioned by {cert.verifiedBy || faculty.name}</span>
                            </div>
                          )}

                          {cert.status === 'Rejected' && (
                            <div className="p-2 rounded-xl bg-rose-50 border border-rose-100 text-[11px] text-rose-800 font-medium flex items-center gap-1.5">
                              <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span>Rejected: Participation proof declined</span>
                            </div>
                          )}
                        </div>

                        {/* Card Actions */}
                        <div className="pt-3 border-t border-slate-100 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewCert(cert);
                                setIsCertModalOpen(true);
                              }}
                              className="flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl py-2 text-xs font-bold transition-all shadow-xs"
                            >
                              <Eye className="w-3.5 h-3.5 text-teal-600" />
                              <span>Inspect</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDownloadCert(cert)}
                              className="flex items-center justify-center gap-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl py-2 text-xs font-bold transition-all shadow-xs"
                              title="Download student participation certificate"
                            >
                              <Download className="w-3.5 h-3.5 text-teal-600" />
                              <span>Download</span>
                            </button>
                          </div>

                          {cert.status === 'Pending Verification' && (
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectCertTarget(cert);
                                  setRejectCertRemarks('');
                                  setIsRejectCertModalOpen(true);
                                }}
                                className="flex items-center justify-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl py-2 text-xs font-bold transition-all"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleVerifyCertificateAction(cert.id, 'Verified')}
                                className="flex items-center justify-center gap-1 bg-teal-600 hover:bg-teal-700 text-white shadow-xs rounded-xl py-2 text-xs font-bold transition-all"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Verify & Sanction</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab 2: Dedicated Student Management Module (Students, Attendance, Marks) */}
        {activeTab === 'student-management' && (
          <StudentManagement />
        )}

        {/* Tab 3: History */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-base text-slate-900">Class Incharge OD History Archive</h3>
                <p className="text-xs text-slate-500">Record of all previous applications reviewed and endorsed by Class Incharge.</p>
              </div>
              <div className="text-xs font-bold text-slate-500">
                Showing <span className="text-teal-700 font-extrabold">{filteredHistory.length}</span> of {data.all.length} records
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-4">OD Request ID</th>
                    <th className="p-4">Student</th>
                    <th className="p-4">Event Name</th>
                    <th className="p-4">Event Date</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 font-semibold">
                        No OD records match the selected status and search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-bold text-teal-700">{r.id}</td>
                      <td className="p-4 font-bold text-slate-800">{r.studentName} ({r.studentRegisterNo})</td>
                      <td className="p-4">{r.eventName}</td>
                      <td className="p-4 text-slate-600">{r.eventDate}</td>
                      <td className="p-4"><StatusBadge status={r.status} size="sm" /></td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDownloadODLetter(r)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-teal-700 font-bold text-xs transition-colors"
                            title="Download OD Letter"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRequest(r);
                              setIsDetailOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs"
                          >
                            View Record
                          </button>
                        </div>
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Academic Data Upload */}
        {activeTab === 'upload' && (
          <AcademicDataUpload onUpdateSuccess={loadData} />
        )}

      </div>

      {/* Detail Modal */}
      {selectedRequest && (
        <ODDetailModal
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedRequest(null);
          }}
          request={selectedRequest}
          faculty={faculty}
          onActionComplete={loadData}
        />
      )}

      {/* Confirmation Modals */}
      {actionReq && (
        <>
          <ApproveModal
            isOpen={isApproveOpen}
            onClose={() => {
              setIsApproveOpen(false);
              setActionReq(null);
            }}
            onConfirm={handleApproveConfirm}
            requestId={actionReq.id}
            eventName={actionReq.eventName}
            studentName={actionReq.studentName}
            role="Class Incharge"
          />

          <RejectModal
            isOpen={isRejectOpen}
            onClose={() => {
              setIsRejectOpen(false);
              setActionReq(null);
            }}
            onConfirm={handleRejectConfirm}
            requestId={actionReq.id}
            eventName={actionReq.eventName}
            studentName={actionReq.studentName}
            role="Class Incharge"
          />
        </>
      )}

      {/* Reject Certificate Reason Modal */}
      {isRejectCertModalOpen && rejectCertTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setIsRejectCertModalOpen(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 p-6 z-10 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-2xl border border-rose-200">
                <ShieldAlert className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Reject Certificate & OD</h4>
                <p className="text-xs text-slate-500">{rejectCertTarget.studentName} &bull; {rejectCertTarget.requestId}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                Rejection Reason *
              </label>
              <textarea
                value={rejectCertRemarks}
                onChange={(e) => setRejectCertRemarks(e.target.value)}
                placeholder="State clearly why this certificate is rejected (e.g., student name mismatch, wrong event certificate, illegible document)..."
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsRejectCertModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleVerifyCertificateAction(rejectCertTarget.id, 'Rejected', rejectCertRemarks)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-200 flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real Document Inspection & Verification Modal */}
      {previewCert && (
        <CertificatePreviewModal
          isOpen={isCertModalOpen}
          onClose={() => {
            setIsCertModalOpen(false);
            setPreviewCert(null);
          }}
          certificate={previewCert}
          faculty={faculty}
          onVerify={(certId, status, remarks) => handleVerifyCertificateAction(certId, status, remarks)}
          readOnly={false}
        />
      )}

      {/* Bulk Extend Deadline Modal */}
      {isExtendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => !isExtending && setIsExtendModalOpen(false)}
          />
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 p-6 z-10 space-y-5 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-teal-50 rounded-2xl border border-teal-200 text-teal-700">
                <CalendarPlus className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900">Extend Certificate Deadline</h4>
                <p className="text-xs text-slate-500">
                  Class Incharge Authority &bull; Updating <strong>{selectedReqIds.length}</strong> student record{selectedReqIds.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Selected Students Preview */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                Selected Students ({selectedReqIds.length})
              </label>
              <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-200">
                {selectedReqIds.map(id => {
                  const item = pendingUploads.find(p => (p.id || p.requestId) === id);
                  return (
                    <div key={id} className="flex items-center justify-between text-xs py-1.5 px-2.5 bg-white rounded-xl border border-slate-100 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 text-[10px]">
                          {id}
                        </span>
                        <span className="font-semibold text-slate-800">
                          {item?.studentName || item?.student_name || 'Student'}
                        </span>
                        {(item?.studentRegisterNo || item?.student_reg_no) && (
                          <span className="text-slate-400 text-[11px]">
                            ({item.studentRegisterNo || item.student_reg_no})
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 truncate max-w-[140px]">
                        {item?.eventName || item?.event_name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Common Date Time Picker */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                New Common Submission Deadline *
              </label>
              <input
                type="datetime-local"
                value={newDeadlineInput}
                onChange={(e) => setNewDeadlineInput(e.target.value)}
                min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-teal-500"
              />

              {/* Quick Presets */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400">Quick Presets:</span>
                <button
                  type="button"
                  onClick={() => handleQuickPreset(1)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-teal-50 hover:text-teal-700 border border-slate-200 transition-colors"
                >
                  +24 Hours
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset(3)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-teal-50 hover:text-teal-700 border border-slate-200 transition-colors"
                >
                  +3 Days
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset(7)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-teal-50 hover:text-teal-700 border border-slate-200 transition-colors"
                >
                  +7 Days
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset(14)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-teal-50 hover:text-teal-700 border border-slate-200 transition-colors"
                >
                  +14 Days
                </button>
              </div>
            </div>

            {/* Optional Reason / Remarks */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                Reason / Remarks (Recorded in Audit Trail)
              </label>
              <input
                type="text"
                value={extendReasonInput}
                onChange={(e) => setExtendReasonInput(e.target.value)}
                placeholder="e.g., Organizer delayed distribution of participation certificates"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Policy & Safety Notice */}
            <div className="p-3 bg-teal-50/70 rounded-2xl border border-teal-100 text-xs text-teal-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <span>
                This will update the certificate submission deadline for the <strong>{selectedReqIds.length}</strong> selected student(s) only. Unselected students and already verified certificates will remain untouched. An audit entry will be preserved.
              </span>
            </div>

            {/* Dialog Footer Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isExtending}
                onClick={() => setIsExtendModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isExtending}
                onClick={handleConfirmExtendDeadline}
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black shadow-md shadow-teal-200 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isExtending ? (
                  <>
                    <Hourglass className="w-4 h-4 animate-spin" />
                    <span>Updating Deadlines...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Confirm Deadline Extension</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </PortalLayout>
  );
};
