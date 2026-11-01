import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, Clock, MapPin, Building, Upload, 
  AlertCircle, FileText, X, User, GraduationCap, ShieldCheck 
} from 'lucide-react';
import { saveODRequestAsync, getStudentProfile, getAuthSession } from '../data/mockData';
import { EventType } from '../types/types';
import { Card } from '../components/Card';
import { useToast } from '../components/Toast';

export const ApplyOD: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [student, setStudent] = useState(getStudentProfile());
  const [session, setSession] = useState(getAuthSession());

  useEffect(() => {
    setStudent(getStudentProfile());
    setSession(getAuthSession());
  }, []);

  const [formData, setFormData] = useState({
    eventName: '',
    eventType: '' as EventType | '',
    eventOrganizer: '',
    venue: '',
    fromDate: '',
    toDate: '',
    fromTime: '09:00',
    toTime: '17:00',
    reason: '',
    description: '',
  });

  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const eventTypes: EventType[] = [
    'Hackathon', 'Symposium', 'Workshop', 'Sports',
    'Cultural Event', 'Internship', 'Competition', 'Seminar', 'Other'
  ];

  const getMinAllowedDate = () => {
    const today = new Date();
    today.setDate(today.getDate() + 3);
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getMaxAllowedDate = () => {
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 1);
    const yyyy = maxDate.getFullYear();
    const mm = String(maxDate.getMonth() + 1).padStart(2, '0');
    const dd = String(maxDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.eventName.trim()) newErrors.eventName = 'Event / Program Name is required';
    if (!formData.eventType) newErrors.eventType = 'Event Type is required';
    if (!formData.eventOrganizer.trim()) newErrors.eventOrganizer = 'Organization / College Name is required';
    if (!formData.venue.trim()) newErrors.venue = 'Venue is required';
    if (!formData.fromDate) newErrors.fromDate = 'Event Start Date is required';
    if (!formData.toDate) newErrors.toDate = 'Event End Date is required';
    if (!formData.fromTime) newErrors.fromTime = 'From Time is required';
    if (!formData.toTime) newErrors.toTime = 'To Time is required';
    if (!formData.reason.trim()) newErrors.reason = 'Reason for OD is required';

    // Requirement: OD Letter / Supporting Document is strictly mandatory
    if (!file) {
      newErrors.file = 'OD Letter / Supporting document is mandatory. You cannot submit an OD request without uploading an event brochure, invitation letter, or registration proof.';
    }

    // Requirement 1: 3-day advance submission rule & 1-year future boundary
    if (formData.fromDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [y, m, d] = formData.fromDate.split('-').map(Number);
      const eventDate = new Date(y, m - 1, d);
      eventDate.setHours(0, 0, 0, 0);

      const diffTime = eventDate.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (eventDate < today) {
        newErrors.fromDate = 'Cannot apply for OD for past dates. OD requests must be submitted at least 3 days before the event date.';
      } else if (diffDays < 3) {
        newErrors.fromDate = 'OD requests must be submitted at least 3 days before the event date.';
      } else if (y > today.getFullYear() + 1) {
        newErrors.fromDate = 'Event date cannot be more than 1 academic year in advance.';
      }
    }

    // Validate date range and duration
    if (formData.fromDate && formData.toDate) {
      const dFrom = new Date(formData.fromDate);
      const dTo = new Date(formData.toDate);
      if (dTo < dFrom) {
        newErrors.toDate = 'Event end date cannot be earlier than start date';
      } else {
        const durationDays = Math.round((dTo.getTime() - dFrom.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        if (durationDays > 30) {
          newErrors.toDate = 'OD request duration cannot exceed 30 consecutive days.';
        }
      }
    }
    
    // Check if end time is after start time when on the same date
    if (formData.fromDate === formData.toDate && formData.fromTime && formData.toTime && formData.fromTime >= formData.toTime) {
      newErrors.toTime = 'To Time must be after From Time';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (validTypes.includes(droppedFile.type) || droppedFile.name.endsWith('.pdf')) {
        if (droppedFile.size > 16 * 1024 * 1024) {
          showToast("File size exceeds 16MB limit.", "error");
          return;
        }
        setFile(droppedFile);
        setErrors(prev => {
          const updated = { ...prev };
          delete updated.file;
          return updated;
        });
      } else {
        showToast("Please upload a PDF or Image file (PNG, JPG, WEBP) only", "error");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.size > 16 * 1024 * 1024) {
        showToast("File size exceeds 16MB limit.", "error");
        return;
      }
      setFile(selected);
      setErrors(prev => {
        const updated = { ...prev };
        delete updated.file;
        return updated;
      });
    }
  };

  const removeFile = () => {
    setFile(null);
    setErrors(prev => ({
      ...prev,
      file: 'OD Letter or Supporting Document is mandatory. You cannot submit an OD request without uploading an event brochure, invitation letter, or registration proof.'
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      if (!file) {
        showToast('OD Letter is mandatory! Please upload a supporting document before submitting.', 'error');
      } else {
        showToast('Please correct the validation errors in the form.', 'error');
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await saveODRequestAsync({
        eventName: formData.eventName,
        eventType: formData.eventType as EventType,
        eventOrganizer: formData.eventOrganizer,
        venue: formData.venue,
        eventDate: formData.fromDate,
        fromDate: formData.fromDate,
        toDate: formData.toDate,
        fromTime: formData.fromTime,
        toTime: formData.toTime,
        reason: formData.reason,
        description: formData.description,
        documentUrl: file ? file.name : null,
      }, file);

      setIsSubmitting(false);

      if (result.success && result.request) {
        showToast(`OD Request submitted successfully! ID: ${result.request.id}`, 'success');
        navigate('/student/requests');
      } else {
        const errorMsg = result.error || 'Failed to submit OD request. Please check inputs.';
        setServerError(errorMsg);
        showToast(errorMsg, 'error');
      }
    } catch {
      setIsSubmitting(false);
      setServerError('An unexpected error occurred while communicating with the backend.');
      showToast('Connection error during OD submission.', 'error');
    }
  };

  const studentName = session?.name || student.name || 'Naveen';
  const studentRegNo = session?.userId || student.registerNumber || '23CSD001';
  const studentDept = session?.department || student.department || 'Computer Science and Design';
  const studentClass = `${session?.year || student.year || 'III Year'} - Section ${session?.section || student.section || 'A'}`;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-primary-600 p-2.5 rounded-2xl text-white shadow-md shadow-primary-600/20">
          <FileText className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Apply for On-Duty (OD)</h1>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
            Submit OD request with proof for institutional 4-stage approval
          </p>
        </div>
      </div>

      {/* Auto-Populated Read-Only Student Profile Information */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 md:p-6 shadow-xl relative overflow-hidden border border-slate-800">
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary-400" />
            <span className="text-xs font-black uppercase tracking-widest text-primary-300">
              Authenticated Student Profile
            </span>
          </div>
          <span className="px-2.5 py-0.5 text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            Verified Profile
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Student Name</span>
            <p className="text-xs md:text-sm font-black text-white mt-0.5 truncate">{studentName}</p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Student ID / Reg No</span>
            <p className="text-xs md:text-sm font-black text-white mt-0.5 uppercase tracking-wider">{studentRegNo}</p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Department</span>
            <p className="text-xs md:text-sm font-black text-white mt-0.5 truncate">{studentDept}</p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Class & Section</span>
            <p className="text-xs md:text-sm font-black text-white mt-0.5">{studentClass}</p>
          </div>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {serverError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700 font-semibold leading-relaxed">{serverError}</p>
            </div>
          )}

          {/* Requirement 3: Mandatory Certificate Submission Policy Disclaimer */}
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Mandatory Certificate Submission Policy
              </h4>
              <p className="text-xs text-amber-800 font-medium leading-relaxed">
                <strong>Important:</strong> After the OD/event ends, the required certificate must be uploaded within 24 hours. Failure to upload the certificate within the deadline will result in automatic rejection of the OD.
              </p>
            </div>
          </div>

          {/* Section 1: Event Details */}
          <div className="space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
              1. Event & Program Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Event Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Event / Program Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.eventName}
                  onChange={(e) => setFormData({ ...formData, eventName: e.target.value })}
                  placeholder="e.g. Smart India Hackathon 2026"
                  className={`w-full bg-slate-50 border rounded-xl py-2.5 px-3.5 text-xs md:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                    errors.eventName ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500' : 'border-slate-200'
                  }`}
                />
                {errors.eventName && <p className="text-rose-500 text-[10px] font-bold mt-1">{errors.eventName}</p>}
              </div>

              {/* Event Type */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Event Type <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formData.eventType}
                  onChange={(e) => setFormData({ ...formData, eventType: e.target.value as EventType })}
                  className={`w-full bg-slate-50 border rounded-xl py-2.5 px-3.5 text-xs md:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                    errors.eventType ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500' : 'border-slate-200'
                  }`}
                >
                  <option value="">Select Event Type</option>
                  {eventTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                {errors.eventType && <p className="text-rose-500 text-[10px] font-bold mt-1">{errors.eventType}</p>}
              </div>

              {/* Event Organizer */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Organization / College Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Building className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={formData.eventOrganizer}
                    onChange={(e) => setFormData({ ...formData, eventOrganizer: e.target.value })}
                    placeholder="e.g. IIT Madras / AICTE"
                    className={`w-full bg-slate-50 border rounded-xl py-2.5 pl-10 pr-3.5 text-xs md:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                      errors.eventOrganizer ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500' : 'border-slate-200'
                    }`}
                  />
                </div>
                {errors.eventOrganizer && <p className="text-rose-500 text-[10px] font-bold mt-1">{errors.eventOrganizer}</p>}
              </div>

              {/* Venue */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Venue <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <MapPin className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                    placeholder="e.g. IC&SR Auditorium, Main Campus"
                    className={`w-full bg-slate-50 border rounded-xl py-2.5 pl-10 pr-3.5 text-xs md:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                      errors.venue ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500' : 'border-slate-200'
                    }`}
                  />
                </div>
                {errors.venue && <p className="text-rose-500 text-[10px] font-bold mt-1">{errors.venue}</p>}
              </div>
            </div>
          </div>

          {/* Section 2: Date & Time */}
          <div className="space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
              2. Event Schedule & Dates
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Event Start Date */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Event Start Date <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                    Min 3 Days in Advance
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <input
                    type="date"
                    required
                    min={getMinAllowedDate()}
                    max={getMaxAllowedDate()}
                    value={formData.fromDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({ 
                        ...formData, 
                        fromDate: val, 
                        toDate: formData.toDate && formData.toDate >= val ? formData.toDate : val 
                      });
                    }}
                    className={`w-full bg-slate-50 border rounded-xl py-2.5 pl-10 pr-3.5 text-xs md:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                      errors.fromDate ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500' : 'border-slate-200'
                    }`}
                  />
                </div>
                {errors.fromDate && <p className="text-rose-500 text-[10px] font-bold mt-1">{errors.fromDate}</p>}
                <p className="text-[10px] text-slate-400 font-medium">OD requests must be submitted at least 3 days before the event date.</p>
              </div>

              {/* Event End Date */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Event End Date <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <input
                    type="date"
                    required
                    min={formData.fromDate || getMinAllowedDate()}
                    max={getMaxAllowedDate()}
                    value={formData.toDate}
                    onChange={(e) => setFormData({ ...formData, toDate: e.target.value })}
                    className={`w-full bg-slate-50 border rounded-xl py-2.5 pl-10 pr-3.5 text-xs md:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                      errors.toDate ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500' : 'border-slate-200'
                    }`}
                  />
                </div>
                {errors.toDate && <p className="text-rose-500 text-[10px] font-bold mt-1">{errors.toDate}</p>}
              </div>

              {/* From Time */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">From Time</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Clock className="w-4 h-4" />
                  </span>
                  <input
                    type="time"
                    value={formData.fromTime}
                    onChange={(e) => setFormData({ ...formData, fromTime: e.target.value })}
                    className={`w-full bg-slate-50 border rounded-xl py-2.5 pl-10 pr-3.5 text-xs md:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                      errors.fromTime ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500' : 'border-slate-200'
                    }`}
                  />
                </div>
                {errors.fromTime && <p className="text-rose-500 text-[10px] font-bold mt-1">{errors.fromTime}</p>}
              </div>

              {/* To Time */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">To Time</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Clock className="w-4 h-4" />
                  </span>
                  <input
                    type="time"
                    value={formData.toTime}
                    onChange={(e) => setFormData({ ...formData, toTime: e.target.value })}
                    className={`w-full bg-slate-50 border rounded-xl py-2.5 pl-10 pr-3.5 text-xs md:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                      errors.toTime ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500' : 'border-slate-200'
                    }`}
                  />
                </div>
                {errors.toTime && <p className="text-rose-500 text-[10px] font-bold mt-1">{errors.toTime}</p>}
              </div>
            </div>
          </div>

          {/* Section 3: Justification */}
          <div className="space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
              3. Academic Justification & Reason
            </h3>
            
            <div className="space-y-4">
              {/* Reason */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Reason for OD <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="e.g. Selected for National Hackathon Finals / Paper Presentation"
                  className={`w-full bg-slate-50 border rounded-xl py-2.5 px-3.5 text-xs md:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                    errors.reason ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500' : 'border-slate-200'
                  }`}
                />
                {errors.reason && <p className="text-rose-500 text-[10px] font-bold mt-1">{errors.reason}</p>}
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Event Details / Brief Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Provide a brief summary of your role, team members, or specific objective of the event..."
                  rows={3}
                  className={`w-full bg-slate-50 border rounded-xl py-2.5 px-3.5 text-xs md:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                    errors.description ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500' : 'border-slate-200'
                  }`}
                />
                {errors.description && <p className="text-rose-500 text-[10px] font-bold mt-1">{errors.description}</p>}
              </div>
            </div>
          </div>

          {/* Section 4: Document Upload */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                4. OD Letter / Supporting Document <span className="text-rose-500 font-black">*</span>
              </h3>
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                file 
                  ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' 
                  : 'text-rose-700 bg-rose-50 border border-rose-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${file ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`}></span>
                {file ? 'File Attached' : 'Mandatory Requirement'}
              </span>
            </div>

            {/* Drag & Drop Box */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center transition-all ${
                errors.file 
                  ? 'border-rose-400 bg-rose-50/20 shadow-sm shadow-rose-100' 
                  : dragActive 
                  ? 'border-primary-500 bg-primary-50/30' 
                  : file 
                  ? 'border-emerald-300 bg-emerald-50/20' 
                  : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
              }`}
            >
              {file ? (
                <div className="flex items-center gap-3 bg-white p-3.5 rounded-xl border border-emerald-200 shadow-sm w-full max-w-md">
                  <div className="bg-emerald-50 p-2.5 rounded-lg text-emerald-600">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-800 truncate">{file.name}</p>
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded uppercase">Attached</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">{(file.size / 1024).toFixed(1)} KB • Ready for upload</p>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <div className={`mx-auto w-12 h-12 rounded-full border flex items-center justify-center shadow-sm ${
                    errors.file ? 'bg-rose-50 border-rose-200 text-rose-500' : 'bg-white border-slate-200 text-slate-400'
                  }`}>
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="text-xs text-slate-600 font-semibold">
                    <label className="text-primary-600 hover:text-primary-800 cursor-pointer font-bold underline">
                      Click to upload OD letter
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFileChange}
                        accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                      />
                    </label>{' '}
                    or drag & drop OD letter
                  </div>
                  <p className="text-[10px] text-slate-400">PDF, PNG, JPG, WEBP up to 16MB (Registration confirmation, official brochure, or permission letter)</p>
                  <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">
                    * Without uploading this document, you cannot submit the OD request
                  </p>
                </div>
              )}
            </div>

            {errors.file && (
              <div className="flex items-center gap-2 text-rose-600 text-xs font-bold bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errors.file}</span>
              </div>
            )}
            
            <div className={`flex items-start gap-2 p-3 rounded-xl text-[11px] leading-normal transition-all ${
              errors.file 
                ? 'bg-rose-50 border border-rose-200 text-rose-800' 
                : 'bg-amber-50 border border-amber-200 text-amber-800'
            }`}>
              <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${errors.file ? 'text-rose-600' : 'text-amber-600'}`} />
              <span>
                <strong>Mandatory Institutional Policy:</strong> Uploading the official event invitation, selection letter, or brochure is <strong>strictly required</strong>. Without uploading a file, you cannot submit the OD request.
              </span>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
            <button
              type="button"
              onClick={() => navigate('/student/dashboard')}
              className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-bold text-xs uppercase tracking-wider transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`bg-primary-600 hover:bg-primary-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider shadow-md hover:shadow-lg shadow-primary-200 transition-all flex items-center gap-2 ${
                isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Submitting to Database...</span>
                </>
              ) : (
                <span>Submit OD Request</span>
              )}
            </button>
          </div>

        </form>
      </Card>

    </div>
  );
};
