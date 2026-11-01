import React, { useState, useEffect } from 'react';
import { 
  Users, CheckCircle2, XCircle, Hourglass, 
  Eye, Check, X, Search, Filter, Calendar, 
  FileText, TrendingUp, AlertTriangle, ArrowRight,
  ShieldCheck, Award, Sparkles, BookOpen, ExternalLink,
  Upload, Clock, CheckCircle, ShieldAlert, Download
} from 'lucide-react';
import { 
  getFacultyODRequests, approveODRequestByFaculty, 
  rejectODRequestByFaculty, getCurrentFaculty, 
  getClassStudents, getAuthSession, getCertificates,
  verifyCertificateByFaculty
} from '../../data/mockData';
import { 
  apiGetClassInchargeODRequests, 
  apiApproveODRequestByClassIncharge, 
  apiRejectODRequestByClassIncharge,
  apiGetAcademicStudents,
  apiGetClassInchargeCertificates,
  apiVerifyClassInchargeCertificate
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

  // Actions
  const [actionReq, setActionReq] = useState<ODRequest | null>(null);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

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
      const backendRes = await apiGetClassInchargeODRequests(session?.token);
      if (backendRes.success && Array.isArray(backendRes.requests)) {
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Certificates</span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">{certificates.length}</span>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-xs">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Pending Review</span>
                <span className="text-2xl font-black text-amber-900 mt-1 block">{pendingCertCount}</span>
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
                onClick={() => setCertFilter('pending')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  certFilter === 'pending'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-200'
                }`}
              >
                <span>Pending Verification</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-black">
                  {pendingCertCount}
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

            {/* Certificate List Cards */}
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
          </div>
        )}

        {/* Tab 2: Dedicated Student Management Module (Students, Attendance, Marks) */}
        {activeTab === 'student-management' && (
          <StudentManagement />
        )}

        {/* Tab 3: History */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-black text-base text-slate-900">Class Incharge OD History Archive</h3>
              <p className="text-xs text-slate-500">Record of all previous applications reviewed and endorsed by Class Incharge.</p>
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
                  {data.all.map((r) => (
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
                  ))}
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

    </PortalLayout>
  );
};
