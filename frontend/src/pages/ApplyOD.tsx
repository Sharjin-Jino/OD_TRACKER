import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, Clock, MapPin, Building, Upload, 
  AlertCircle, FileText, X, GraduationCap, ShieldCheck,
  Sparkles, CheckCircle2, AlertTriangle, RefreshCw, Check,
  Image as ImageIcon, Layers, FileCheck, HelpCircle,
  Lock, Unlock, ArrowRight
} from 'lucide-react';
import { saveODRequestAsync, getStudentProfile, getAuthSession } from '../data/mockData';
import { EventType } from '../types/types';
import { Card } from '../components/Card';
import { useToast } from '../components/Toast';
import { apiSmartExtractDocuments, SmartExtractionResult } from '../services/api';

// Strict State Management Workflow:
// INITIAL -> DOCUMENTS_UPLOADED -> EXTRACTING -> AUTOFILL_COMPLETED -> EDITING_ENABLED -> READY_TO_SUBMIT
export type WorkflowState = 
  | 'INITIAL' 
  | 'DOCUMENTS_UPLOADED' 
  | 'EXTRACTING' 
  | 'AUTOFILL_COMPLETED' 
  | 'EDITING_ENABLED' 
  | 'READY_TO_SUBMIT';

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

  // Dual Mandatory Document Uploads
  const [odLetterFile, setOdLetterFile] = useState<File | null>(null);
  const [eventPosterFile, setEventPosterFile] = useState<File | null>(null);
  const [odDragActive, setOdDragActive] = useState(false);
  const [posterDragActive, setPosterDragActive] = useState(false);

  // Strict Workflow State: Form fields are locked until Auto-Fill completes successfully
  const [workflowState, setWorkflowState] = useState<WorkflowState>('INITIAL');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<SmartExtractionResult | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [missingFieldsDetected, setMissingFieldsDetected] = useState<string[]>([]);

  const [conflicts, setConflicts] = useState<Array<{
    field: string;
    label: string;
    odLetterValue: string;
    posterValue: string;
    message: string;
  }>>([]);
  const [fieldConfidence, setFieldConfidence] = useState<Record<string, 'high' | 'medium' | 'low'>>({});
  const [classification, setClassification] = useState<any>(null);
  const [sameEventValidation, setSameEventValidation] = useState<{ isSameEvent: boolean; confidence: number; explanation: string } | null>(null);
  const [fieldSources, setFieldSources] = useState<Record<string, { source: string; confidence: string }>>({});
  const [extractionEngine, setExtractionEngine] = useState<string>('');

  // Manual Edit Protection - Do not silently overwrite student's manual corrections on re-extract
  const [manuallyEditedFields, setManuallyEditedFields] = useState<Set<string>>(new Set());

  // Student Review & Confirmation Checkbox
  const [isReviewed, setIsReviewed] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const eventTypes: EventType[] = [
    'Hackathon', 'Symposium', 'Workshop', 'Sports',
    'Cultural Event', 'Internship', 'Competition', 'Seminar', 'Other'
  ];

  // Derived: Editing is permitted ONLY after extraction and auto-fill have completed
  const isEditingAllowed = workflowState === 'EDITING_ENABLED' || workflowState === 'READY_TO_SUBMIT';

  // Check if all mandatory fields are filled to transition to READY_TO_SUBMIT
  const checkReadyToSubmit = (currentData = formData, reviewed = isReviewed) => {
    const hasRequired = Boolean(
      currentData.eventName.trim() &&
      currentData.eventType &&
      currentData.eventOrganizer.trim() &&
      currentData.venue.trim() &&
      currentData.fromDate &&
      currentData.toDate &&
      currentData.fromTime &&
      currentData.toTime &&
      currentData.reason.trim() &&
      odLetterFile &&
      eventPosterFile
    );
    return hasRequired && reviewed;
  };

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

  const handleFieldChange = (field: string, value: string) => {
    if (!isEditingAllowed) {
      showToast('Form editing is locked. Upload both documents and extract information first.', 'error');
      return;
    }

    const nextData = { ...formData, [field]: value };
    setFormData(nextData);
    setManuallyEditedFields(prev => new Set(prev).add(field));

    // Remove conflict highlight if student manually edited
    setConflicts(prev => prev.filter(c => c.field !== field));
    setFieldConfidence(prev => ({ ...prev, [field]: 'high' }));

    // Remove from missing fields detected
    setMissingFieldsDetected(prev => prev.filter(f => f.toLowerCase() !== field.toLowerCase()));

    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }

    // Update ready state
    if (checkReadyToSubmit(nextData, isReviewed)) {
      setWorkflowState('READY_TO_SUBMIT');
    } else if (workflowState === 'READY_TO_SUBMIT') {
      setWorkflowState('EDITING_ENABLED');
    }
  };

  // Drag and Drop handlers for OD Letter
  const handleOdDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setOdDragActive(true);
    else if (e.type === "dragleave") setOdDragActive(false);
  };

  const handleOdDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOdDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleOdFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleOdFileSelect = (selectedFile: File) => {
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.pdf')) {
      showToast("Please upload a PDF or Image file (PNG, JPG, WEBP) only.", "error");
      return;
    }
    if (selectedFile.size > 16 * 1024 * 1024) {
      showToast("File size exceeds 16MB limit.", "error");
      return;
    }

    setOdLetterFile(selectedFile);
    setExtractionError(null);

    // If documents were previously extracted and one is replaced, re-lock the form until re-extracted
    if (isEditingAllowed) {
      setWorkflowState('DOCUMENTS_UPLOADED');
      setIsReviewed(false);
      showToast('OD Letter updated. Please click "Extract & Auto-Fill Form" to process and re-enable form editing.', 'info');
    } else if (eventPosterFile) {
      setWorkflowState('DOCUMENTS_UPLOADED');
    } else {
      setWorkflowState('INITIAL');
    }

    setErrors(prev => {
      const next = { ...prev };
      delete next.odLetter;
      return next;
    });
  };

  // Drag and Drop handlers for Event Poster
  const handlePosterDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setPosterDragActive(true);
    else if (e.type === "dragleave") setPosterDragActive(false);
  };

  const handlePosterDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPosterDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handlePosterFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handlePosterFileSelect = (selectedFile: File) => {
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.pdf')) {
      showToast("Please upload a PDF or Image file (PNG, JPG, WEBP) only.", "error");
      return;
    }
    if (selectedFile.size > 16 * 1024 * 1024) {
      showToast("File size exceeds 16MB limit.", "error");
      return;
    }

    setEventPosterFile(selectedFile);
    setExtractionError(null);

    // If documents were previously extracted and one is replaced, re-lock the form until re-extracted
    if (isEditingAllowed) {
      setWorkflowState('DOCUMENTS_UPLOADED');
      setIsReviewed(false);
      showToast('Event Poster updated. Please click "Extract & Auto-Fill Form" to process and re-enable form editing.', 'info');
    } else if (odLetterFile) {
      setWorkflowState('DOCUMENTS_UPLOADED');
    } else {
      setWorkflowState('INITIAL');
    }

    setErrors(prev => {
      const next = { ...prev };
      delete next.eventPoster;
      return next;
    });
  };

  const removeOdLetter = () => {
    setOdLetterFile(null);
    setWorkflowState('INITIAL');
    setIsReviewed(false);
    setExtractionError(null);
    showToast('OD Letter removed. Upload both documents and extract information to enable form editing.', 'info');
  };

  const removeEventPoster = () => {
    setEventPosterFile(null);
    setWorkflowState('INITIAL');
    setIsReviewed(false);
    setExtractionError(null);
    showToast('Event Poster removed. Upload both documents and extract information to enable form editing.', 'info');
  };

  // Smart Information Extraction & Intelligent Comparison
  // Enables Form Editing ONLY after Auto-Fill finishes successfully
  const handleSmartExtract = async () => {
    if (isExtracting) return; // Prevent multiple simultaneous extraction requests

    if (!odLetterFile && !eventPosterFile) {
      showToast('Please upload BOTH the OD Letter and Event Poster to run Smart Extraction.', 'error');
      setErrors(prev => ({
        ...prev,
        odLetter: 'OD Letter is required',
        eventPoster: 'Event Poster is required'
      }));
      return;
    }

    if (!odLetterFile) {
      showToast('OD Letter is missing! Please upload the OD Letter.', 'error');
      setErrors(prev => ({ ...prev, odLetter: 'OD Letter is required for dual document processing' }));
      return;
    }

    if (!eventPosterFile) {
      showToast('Event Poster is missing! Please upload the Event Poster.', 'error');
      setErrors(prev => ({ ...prev, eventPoster: 'Event Poster is required for dual document processing' }));
      return;
    }

    setIsExtracting(true);
    setWorkflowState('EXTRACTING');
    setServerError(null);
    setExtractionError(null);

    try {
      const res = await apiSmartExtractDocuments(odLetterFile, eventPosterFile, session?.token);

      if (res.success && res.extracted) {
        setExtractionResult(res);
        setConflicts(res.conflicts || []);
        setFieldConfidence(res.fieldConfidence || {});
        setClassification(res.documentClassification || null);
        setSameEventValidation(res.sameEventValidation || null);
        setFieldSources(res.fieldSources || {});
        setExtractionEngine(res.engine === 'openai' ? `OpenAI Vision (${res.model || 'GPT-4o'})` : 'Document Intelligence');

        // Populate fields with extracted data without inventing missing values
        const nextData = { ...formData };
        const ext = res.extracted;

        const fieldsToFill: Array<keyof typeof formData> = [
          'eventName', 'eventType', 'eventOrganizer', 'venue',
          'fromDate', 'toDate', 'fromTime', 'toTime', 'reason', 'description'
        ];

        fieldsToFill.forEach(f => {
          if (!manuallyEditedFields.has(f) && ext[f]) {
            if (f === 'eventType') {
              if (eventTypes.includes(ext[f] as EventType)) {
                nextData.eventType = ext[f] as EventType;
              } else {
                nextData.eventType = 'Other';
              }
            } else {
              nextData[f] = ext[f] as any;
            }
          }
        });

        setFormData(nextData);

        // Detect missing required fields that student must fill manually
        const missing: string[] = [];
        if (!nextData.eventName) missing.push('Event Name');
        if (!nextData.eventType) missing.push('Event Type');
        if (!nextData.eventOrganizer) missing.push('Organizer / College');
        if (!nextData.venue) missing.push('Venue');
        if (!nextData.fromDate) missing.push('Start Date');
        if (!nextData.toDate) missing.push('End Date');
        if (!nextData.reason) missing.push('Reason for OD');
        setMissingFieldsDetected(missing);

        // Clean up errors for successfully populated fields
        setErrors(prev => {
          const next = { ...prev };
          delete next.odLetter;
          delete next.eventPoster;
          if (nextData.eventName) delete next.eventName;
          if (nextData.eventType) delete next.eventType;
          if (nextData.eventOrganizer) delete next.eventOrganizer;
          if (nextData.venue) delete next.venue;
          if (nextData.fromDate) delete next.fromDate;
          if (nextData.toDate) delete next.toDate;
          if (nextData.reason) delete next.reason;
          return next;
        });

        // SUCCESS: Transition state to AUTOFILL_COMPLETED then EDITING_ENABLED
        setWorkflowState('EDITING_ENABLED');
        showToast('Information extracted successfully. Please review and correct the details before submitting.', 'success');

        if (res.conflicts && res.conflicts.length > 0) {
          showToast(`Extracted with ${res.conflicts.length} conflict(s). Please review highlighted options.`, 'info');
        }
      } else {
        // EXTRACTION FAILURE: Keep form editing strictly disabled
        setWorkflowState('DOCUMENTS_UPLOADED');
        const err = res.error || 'Failed to extract event information. Please check your documents and retry.';
        setExtractionError(err);
        showToast(err, 'error');
      }
    } catch {
      // CONNECTION FAILURE: Keep form editing strictly disabled
      setWorkflowState('DOCUMENTS_UPLOADED');
      const err = 'Error communicating with OCR extraction service. Please verify server connection and retry.';
      setExtractionError(err);
      showToast(err, 'error');
    } finally {
      setIsExtracting(false);
    }
  };

  const resolveConflict = (fieldKey: string, chosenValue: string) => {
    if (!isEditingAllowed) return;
    const nextData = { ...formData, [fieldKey]: chosenValue };
    setFormData(nextData);
    setManuallyEditedFields(prev => new Set(prev).add(fieldKey));
    setFieldConfidence(prev => ({ ...prev, [fieldKey]: 'high' }));
    setConflicts(prev => prev.filter(c => c.field !== fieldKey));
    setMissingFieldsDetected(prev => prev.filter(f => f.toLowerCase() !== fieldKey.toLowerCase()));
    showToast(`Updated ${fieldKey} to selected value.`, 'success');

    if (checkReadyToSubmit(nextData, isReviewed)) {
      setWorkflowState('READY_TO_SUBMIT');
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    // Strict Auto-Fill Enforced
    if (!isEditingAllowed) {
      newErrors.general = 'Upload both documents and extract information to enable form editing.';
      setErrors(newErrors);
      return false;
    }

    if (!formData.eventName.trim()) newErrors.eventName = 'Event / Program Name is required';
    if (!formData.eventType) newErrors.eventType = 'Event Type is required';
    if (!formData.eventOrganizer.trim()) newErrors.eventOrganizer = 'Organization / College Name is required';
    if (!formData.venue.trim()) newErrors.venue = 'Venue is required';
    if (!formData.fromDate) newErrors.fromDate = 'Event Start Date is required';
    if (!formData.toDate) newErrors.toDate = 'Event End Date is required';
    if (!formData.fromTime) newErrors.fromTime = 'From Time is required';
    if (!formData.toTime) newErrors.toTime = 'To Time is required';
    if (!formData.reason.trim()) newErrors.reason = 'Reason for OD is required';

    // Mandatory Dual Document Upload Validation
    if (!odLetterFile) {
      newErrors.odLetter = 'OD Letter is mandatory. You must upload an official OD request or permission letter.';
    }
    if (!eventPosterFile) {
      newErrors.eventPoster = 'Event Poster is mandatory. You must upload the event brochure or poster.';
    }

    // Student Review Confirmation
    if (!isReviewed) {
      newErrors.reviewed = 'You must review and verify the extracted event details before submission.';
    }

    // Date range rules: 3-day advance policy
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
    
    if (formData.fromDate === formData.toDate && formData.fromTime && formData.toTime && formData.fromTime >= formData.toTime) {
      newErrors.toTime = 'To Time must be after From Time';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!isEditingAllowed) {
      showToast('Upload both documents and extract information to enable form editing.', 'error');
      return;
    }

    if (!validate()) {
      if (!odLetterFile || !eventPosterFile) {
        showToast('Both OD Letter and Event Poster are strictly mandatory!', 'error');
      } else if (!isReviewed) {
        showToast('Please check the confirmation box to confirm you reviewed the extracted information.', 'error');
      } else {
        showToast('Please complete all required fields in the form.', 'error');
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
        documentUrl: odLetterFile ? odLetterFile.name : null,
        eventPosterUrl: eventPosterFile ? eventPosterFile.name : null,
      }, odLetterFile, eventPosterFile);

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

  // Helper for rendering confidence badges
  const renderConfidenceBadge = (fieldKey: string) => {
    if (!isEditingAllowed) return null;
    const conf = fieldConfidence[fieldKey];
    if (!conf) return null;

    const src = fieldSources[fieldKey]?.source;
    if (src === 'both' || conf === 'high') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
          <Check className="w-2.5 h-2.5 stroke-[3]" />
          Verified in Both
        </span>
      );
    }
    if (src === 'poster') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
          From Poster
        </span>
      );
    }
    if (src === 'od_letter') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
          From OD Letter
        </span>
      );
    }
    if (conf === 'medium') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
          Extracted
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 animate-pulse">
        Needs Review
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-teal-700 to-teal-500 p-3 rounded-2xl text-white shadow-lg shadow-teal-500/25">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Smart Apply OD</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 border border-teal-200">
                Auto-Fill First Workflow
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Upload your OD Letter & Event Poster to auto-fill event details. Editing unlocks after verification.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditingAllowed && (
            <button
              type="button"
              onClick={() => {
                setFormData({
                  eventName: '',
                  eventType: '',
                  eventOrganizer: '',
                  venue: '',
                  fromDate: '',
                  toDate: '',
                  fromTime: '09:00',
                  toTime: '17:00',
                  reason: '',
                  description: '',
                });
                setManuallyEditedFields(new Set());
                setFieldConfidence({});
                setConflicts([]);
                setMissingFieldsDetected([]);
                setWorkflowState('EDITING_ENABLED');
                setIsReviewed(false);
                showToast('Cleared form fields. You may now enter details manually.', 'info');
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Clear Form</span>
            </button>
          )}
        </div>
      </div>

      {/* 4-Step Visual Workflow Stepper */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          
          {/* Step 1: Upload Documents */}
          <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
            odLetterFile && eventPosterFile
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
              : 'bg-teal-50/50 border-teal-200 text-teal-900'
          }`}>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
              odLetterFile && eventPosterFile ? 'bg-emerald-600 text-white' : 'bg-teal-600 text-white'
            }`}>
              {odLetterFile && eventPosterFile ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : '1'}
            </div>
            <div className="min-w-0">
              <p className="font-black text-xs truncate">1. Upload Documents</p>
              <p className="text-[10px] text-slate-500 truncate">
                {odLetterFile && eventPosterFile ? '2/2 Uploaded' : 'OD Letter & Poster'}
              </p>
            </div>
          </div>

          {/* Step 2: Auto-Fill via OCR */}
          <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
            isExtracting
              ? 'bg-teal-100/70 border-teal-300 text-teal-900 ring-2 ring-teal-400/30'
              : isEditingAllowed
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
              : odLetterFile && eventPosterFile
              ? 'bg-amber-50/80 border-amber-200 text-amber-900'
              : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
          }`}>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
              isExtracting
                ? 'bg-teal-600 text-white animate-spin'
                : isEditingAllowed
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-200 text-slate-600'
            }`}>
              {isExtracting ? (
                <RefreshCw className="w-3 h-3" />
              ) : isEditingAllowed ? (
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              ) : (
                '2'
              )}
            </div>
            <div className="min-w-0">
              <p className="font-black text-xs truncate">2. Auto-Fill via OCR</p>
              <p className="text-[10px] text-slate-500 truncate">
                {isExtracting ? 'Extracting...' : isEditingAllowed ? 'Completed' : 'Click Extract'}
              </p>
            </div>
          </div>

          {/* Step 3: Review & Edit */}
          <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
            workflowState === 'READY_TO_SUBMIT'
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
              : isEditingAllowed
              ? 'bg-teal-50 border-teal-200 text-teal-900 ring-2 ring-teal-400/20'
              : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
          }`}>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
              workflowState === 'READY_TO_SUBMIT'
                ? 'bg-emerald-600 text-white'
                : isEditingAllowed
                ? 'bg-teal-600 text-white'
                : 'bg-slate-200 text-slate-600'
            }`}>
              {workflowState === 'READY_TO_SUBMIT' ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : '3'}
            </div>
            <div className="min-w-0">
              <p className="font-black text-xs truncate">3. Review & Edit</p>
              <p className="text-[10px] text-slate-500 truncate">
                {isEditingAllowed ? (isReviewed ? 'Confirmed' : 'Editing Unlocked') : 'Locked'}
              </p>
            </div>
          </div>

          {/* Step 4: Submit OD */}
          <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
            workflowState === 'READY_TO_SUBMIT'
              ? 'bg-teal-50 border-teal-300 text-teal-900 ring-2 ring-teal-400/30'
              : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
          }`}>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
              workflowState === 'READY_TO_SUBMIT' ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              4
            </div>
            <div className="min-w-0">
              <p className="font-black text-xs truncate">4. Submit OD</p>
              <p className="text-[10px] text-slate-500 truncate">
                {workflowState === 'READY_TO_SUBMIT' ? 'Ready to Submit' : 'Locked'}
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Auto-Populated Read-Only Student Profile Information */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 md:p-6 shadow-xl relative overflow-hidden border border-slate-800">
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-black uppercase tracking-widest text-teal-300">
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

      {/* SECTION 1: Dual Document Upload Dropzones */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-600" />
              <span>Step 1: Mandatory Dual Document Upload</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Both documents are required. Form editing remains locked until both are uploaded and extracted.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
              odLetterFile && eventPosterFile
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              {odLetterFile && eventPosterFile ? '2 of 2 Uploaded' : `${Number(!!odLetterFile) + Number(!!eventPosterFile)} of 2 Uploaded`}
            </span>
          </div>
        </div>

        {/* Dual Upload Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Dropzone 1: OD Letter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-teal-600" />
                <span>1. OD Permission Letter <strong className="text-rose-500">*</strong></span>
              </label>
              <span className="text-[10px] font-bold text-slate-400">PDF, PNG, JPG (16MB)</span>
            </div>

            <div
              onDragEnter={handleOdDrag}
              onDragOver={handleOdDrag}
              onDragLeave={handleOdDrag}
              onDrop={handleOdDrop}
              className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center transition-all min-h-[170px] ${
                errors.odLetter 
                  ? 'border-rose-400 bg-rose-50/30' 
                  : odDragActive 
                  ? 'border-teal-500 bg-teal-50/40' 
                  : odLetterFile 
                  ? 'border-emerald-300 bg-emerald-50/20' 
                  : 'border-slate-300 hover:border-teal-400 bg-slate-50/60'
              }`}
            >
              {odLetterFile ? (
                <div className="flex flex-col items-center text-center space-y-2 w-full">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div className="w-full px-2">
                    <p className="text-xs font-black text-slate-800 truncate" title={odLetterFile.name}>
                      {odLetterFile.name}
                    </p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      {(odLetterFile.size / 1024).toFixed(1)} KB • OD Letter Attached
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full uppercase">
                      Ready
                    </span>
                    <button
                      type="button"
                      onClick={removeOdLetter}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 underline"
                    >
                      Replace
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center mx-auto shadow-xs">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div className="text-xs text-slate-700 font-bold">
                    <label className="text-teal-600 hover:text-teal-700 cursor-pointer underline">
                      Choose OD Letter
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleOdFileSelect(e.target.files[0])}
                        accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                      />
                    </label>
                    <span className="text-slate-400 font-normal"> or drag & drop</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Official permission letter, requisition, or approval form</p>
                </div>
              )}
            </div>

            {errors.odLetter && (
              <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errors.odLetter}</span>
              </p>
            )}
          </div>

          {/* Dropzone 2: Event Poster */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-teal-600" />
                <span>2. Event Poster / Brochure <strong className="text-rose-500">*</strong></span>
              </label>
              <span className="text-[10px] font-bold text-slate-400">PDF, PNG, JPG (16MB)</span>
            </div>

            <div
              onDragEnter={handlePosterDrag}
              onDragOver={handlePosterDrag}
              onDragLeave={handlePosterDrag}
              onDrop={handlePosterDrop}
              className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center transition-all min-h-[170px] ${
                errors.eventPoster 
                  ? 'border-rose-400 bg-rose-50/30' 
                  : posterDragActive 
                  ? 'border-teal-500 bg-teal-50/40' 
                  : eventPosterFile 
                  ? 'border-emerald-300 bg-emerald-50/20' 
                  : 'border-slate-300 hover:border-teal-400 bg-slate-50/60'
              }`}
            >
              {eventPosterFile ? (
                <div className="flex flex-col items-center text-center space-y-2 w-full">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div className="w-full px-2">
                    <p className="text-xs font-black text-slate-800 truncate" title={eventPosterFile.name}>
                      {eventPosterFile.name}
                    </p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      {(eventPosterFile.size / 1024).toFixed(1)} KB • Poster Attached
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full uppercase">
                      Ready
                    </span>
                    <button
                      type="button"
                      onClick={removeEventPoster}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 underline"
                    >
                      Replace
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center mx-auto shadow-xs">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div className="text-xs text-slate-700 font-bold">
                    <label className="text-teal-600 hover:text-teal-700 cursor-pointer underline">
                      Choose Event Poster
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handlePosterFileSelect(e.target.files[0])}
                        accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                      />
                    </label>
                    <span className="text-slate-400 font-normal"> or drag & drop</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Official promotional banner, announcement flyer, or schedule</p>
                </div>
              )}
            </div>

            {errors.eventPoster && (
              <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errors.eventPoster}</span>
              </p>
            )}
          </div>

        </div>

        {/* Step 2 CTA Box: Extract & Auto-Fill Form */}
        <div className="bg-gradient-to-r from-teal-50 via-slate-50 to-emerald-50 rounded-2xl p-4 border border-teal-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-600"></span>
              </span>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Step 2: Automated OCR Extraction & Auto-Fill
              </h3>
            </div>
            <p className="text-xs text-slate-600 font-medium">
              {!odLetterFile || !eventPosterFile 
                ? 'Upload both documents above to enable extraction and form editing.'
                : 'Both documents ready. Click below to run dual OCR, auto-fill the form, and unlock editing.'
              }
            </p>
          </div>

          <button
            type="button"
            disabled={isExtracting || !odLetterFile || !eventPosterFile}
            onClick={handleSmartExtract}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md flex items-center justify-center gap-2 transition-all shrink-0 ${
              isExtracting
                ? 'bg-teal-700 text-white cursor-wait opacity-80'
                : !odLetterFile || !eventPosterFile
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-200 hover:shadow-lg'
            }`}
          >
            {isExtracting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Extracting via OCR...</span>
              </>
            ) : isEditingAllowed ? (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Re-Extract Documents</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-teal-200" />
                <span>Extract & Auto-Fill Form</span>
              </>
            )}
          </button>
        </div>

        {/* Extraction Error Notice (Failure State) */}
        {extractionError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 animate-fadeIn">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase tracking-wider text-rose-900">
                Extraction Failed — Form Editing Remains Disabled
              </h4>
              <p className="text-xs text-rose-700 font-medium">
                {extractionError}
              </p>
              <p className="text-[11px] text-rose-600 font-bold">
                Form inputs remain locked. Please replace the uploaded documents or retry extraction above.
              </p>
            </div>
          </div>
        )}

        {/* Discrepancy: Different Events Detected */}
        {sameEventValidation && !sameEventValidation.isSameEvent && isEditingAllowed && (
          <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl flex items-start gap-3 animate-shake">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase tracking-wider text-rose-900">
                Discrepancy: Different Events Detected Between Documents
              </h4>
              <p className="text-xs text-rose-800 font-medium">
                {sameEventValidation.explanation || 'The OD Letter and Event Poster appear to describe different events. Please review both documents carefully before proceeding.'}
              </p>
              <p className="text-[11px] text-rose-600 font-bold">
                Please ensure both documents pertain to the exact same event, or correct the details below before submitting.
              </p>
            </div>
          </div>
        )}

        {/* Document Classification Summary */}
        {classification && (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                Document Classification & Verification
              </span>
              <span className="text-slate-400 font-semibold text-[11px]">
                Analyzed via PyMuPDF + Native Windows OCR
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">OD Letter Document</span>
                  <p className="font-bold text-slate-800">{classification.odLetter?.detectedType || 'OD Permission Letter'}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {Math.round((classification.odLetter?.confidence || 0.95) * 100)}% Match
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Event Poster Document</span>
                  <p className="font-bold text-slate-800">{classification.eventPoster?.detectedType || 'Event Brochure / Poster'}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {Math.round((classification.eventPoster?.confidence || 0.92) * 100)}% Match
                </span>
              </div>
            </div>

            {classification.isSwapped && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Notice: Document classifier detected that the OD Letter and Event Poster may have been uploaded in swapped slots. The system has automatically aligned them for you.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Intelligent Conflict Resolution Card */}
        {conflicts.length > 0 && isEditingAllowed && (
          <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-3 animate-fadeIn">
            <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Conflicting Information Detected Between Documents</span>
            </div>
            <p className="text-xs text-rose-700">
              The OD Letter and Event Poster contain differing information for the fields below. Click a button to select your preferred value, or edit manually in the form:
            </p>

            <div className="space-y-2.5">
              {conflicts.map((conf, idx) => (
                <div key={idx} className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900">{conf.label}</span>
                    <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                      Conflict
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{conf.message}</p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => resolveConflict(conf.field, conf.odLetterValue)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-teal-50 hover:text-teal-700 border border-slate-200 transition-colors flex items-center gap-1.5"
                    >
                      <FileText className="w-3 h-3 text-teal-600" />
                      <span>Use OD Letter: <strong>{conf.odLetterValue}</strong></span>
                    </button>
                    <button
                      type="button"
                      onClick={() => resolveConflict(conf.field, conf.posterValue)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-teal-50 hover:text-teal-700 border border-slate-200 transition-colors flex items-center gap-1.5"
                    >
                      <ImageIcon className="w-3 h-3 text-teal-600" />
                      <span>Use Event Poster: <strong>{conf.posterValue}</strong></span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* SECTION 2: Apply OD Form with Strict Auto-Fill Enforced */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {serverError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700 font-semibold leading-relaxed">{serverError}</p>
            </div>
          )}

          {/* Institutional 24-Hour Certificate Policy Disclaimer */}
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Mandatory Certificate Submission Policy
              </h4>
              <p className="text-xs text-amber-800 font-medium leading-relaxed">
                <strong>Important:</strong> After the OD/event ends, the required participation certificate must be uploaded within 24 hours. Failure to upload the certificate within the deadline will result in automatic rejection of the OD.
              </p>
            </div>
          </div>

          {/* STRICT AUTO-FILL STATUS BANNER */}
          {!isEditingAllowed ? (
            <div className="p-4 bg-slate-100/90 border border-slate-300 rounded-2xl flex items-center gap-3.5 text-slate-700 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-slate-200/90 text-slate-600 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Form Editing Disabled (Auto-Fill First Workflow)
                  </h4>
                  <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-slate-200 text-slate-700 rounded-full">
                    {workflowState === 'EXTRACTING' ? 'Processing...' : 'Locked'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-semibold mt-0.5">
                  Upload both documents and extract information to enable form editing.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-emerald-800 animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-xs">
                  <Unlock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900">
                      Form Editing Unlocked
                    </h4>
                    <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                      Auto-Fill Completed
                    </span>
                  </div>
                  <p className="text-xs text-emerald-700 font-medium mt-0.5">
                    Information extracted successfully. Please review and correct the details before submitting.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Missing Required Fields Notice */}
          {missingFieldsDetected.length > 0 && isEditingAllowed && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 font-medium leading-relaxed">
                <strong>Attention:</strong> Some event details were not detected in the uploaded documents ({missingFieldsDetected.join(', ')}). They have been left blank. Please complete all required fields manually before submitting.
              </p>
            </div>
          )}

          {/* Section 2.1: Event Details */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                {!isEditingAllowed ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : <Unlock className="w-3.5 h-3.5 text-emerald-600" />}
                <span>1. Event & Program Information</span>
              </h3>
              <span className={`text-[10px] font-bold ${!isEditingAllowed ? 'text-slate-400' : 'text-emerald-700'}`}>
                {!isEditingAllowed ? 'Locked until extraction' : 'Editing enabled'}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Event Name */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Event / Program Name <span className="text-rose-500">*</span>
                  </label>
                  {!isEditingAllowed ? (
                    <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Locked
                    </span>
                  ) : renderConfidenceBadge('eventName')}
                </div>
                <input
                  type="text"
                  required
                  disabled={!isEditingAllowed}
                  readOnly={!isEditingAllowed}
                  value={formData.eventName}
                  onChange={(e) => handleFieldChange('eventName', e.target.value)}
                  placeholder={!isEditingAllowed ? 'Locked — Auto-fill will populate from documents' : 'e.g. Smart India AI Hackathon 2026'}
                  className={`w-full border rounded-xl py-2.5 px-3.5 text-xs md:text-sm font-semibold transition-all ${
                    !isEditingAllowed
                      ? 'bg-slate-100/80 text-slate-500 border-slate-200 cursor-not-allowed select-none'
                      : errors.eventName
                      ? 'bg-white border-rose-400 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800'
                      : !formData.eventName
                      ? 'bg-amber-50/40 border-amber-300 focus:border-teal-500 text-slate-800'
                      : 'bg-white border-slate-200 focus:ring-teal-500/20 focus:border-teal-500 text-slate-800'
                  }`}
                />
                {errors.eventName && <p className="text-rose-500 text-[10px] font-bold mt-1">{errors.eventName}</p>}
              </div>

              {/* Event Type */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Event Type <span className="text-rose-500">*</span>
                  </label>
                  {!isEditingAllowed ? (
                    <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Locked
                    </span>
                  ) : renderConfidenceBadge('eventType')}
                </div>
                <select
                  required
                  disabled={!isEditingAllowed}
                  value={formData.eventType}
                  onChange={(e) => handleFieldChange('eventType', e.target.value)}
                  className={`w-full border rounded-xl py-2.5 px-3.5 text-xs md:text-sm font-semibold transition-all ${
                    !isEditingAllowed
                      ? 'bg-slate-100/80 text-slate-500 border-slate-200 cursor-not-allowed select-none'
                      : errors.eventType
                      ? 'bg-white border-rose-400 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800'
                      : !formData.eventType
                      ? 'bg-amber-50/40 border-amber-300 focus:border-teal-500 text-slate-800'
                      : 'bg-white border-slate-200 focus:ring-teal-500/20 focus:border-teal-500 text-slate-800'
                  }`}
                >
                  <option value="">Select Event Type</option>
                  {eventTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {errors.eventType && <p className="text-rose-500 text-[10px] font-bold mt-1">{errors.eventType}</p>}
              </div>

              {/* Event Organizer */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Organization / College Name <span className="text-rose-500">*</span>
                  </label>
                  {!isEditingAllowed ? (
                    <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Locked
                    </span>
                  ) : renderConfidenceBadge('eventOrganizer')}
                </div>
                <div className="relative">
                  <Building className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    disabled={!isEditingAllowed}
                    readOnly={!isEditingAllowed}
                    value={formData.eventOrganizer}
                    onChange={(e) => handleFieldChange('eventOrganizer', e.target.value)}
                    placeholder={!isEditingAllowed ? 'Locked — Auto-fill will populate from documents' : 'e.g. Indian Institute of Technology Madras'}
                    className={`w-full border rounded-xl py-2.5 pl-10 pr-3.5 text-xs md:text-sm font-semibold transition-all ${
                      !isEditingAllowed
                        ? 'bg-slate-100/80 text-slate-500 border-slate-200 cursor-not-allowed select-none'
                        : errors.eventOrganizer
                        ? 'bg-white border-rose-400 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800'
                        : !formData.eventOrganizer
                        ? 'bg-amber-50/40 border-amber-300 focus:border-teal-500 text-slate-800'
                        : 'bg-white border-slate-200 focus:ring-teal-500/20 focus:border-teal-500 text-slate-800'
                    }`}
                  />
                </div>
                {errors.eventOrganizer && <p className="text-rose-500 text-[10px] font-bold mt-1">{errors.eventOrganizer}</p>}
              </div>

              {/* Venue */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Venue <span className="text-rose-500">*</span>
                  </label>
                  {!isEditingAllowed ? (
                    <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Locked
                    </span>
                  ) : renderConfidenceBadge('venue')}
                </div>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    disabled={!isEditingAllowed}
                    readOnly={!isEditingAllowed}
                    value={formData.venue}
                    onChange={(e) => handleFieldChange('venue', e.target.value)}
                    placeholder={!isEditingAllowed ? 'Locked — Auto-fill will populate from documents' : 'e.g. IC&SR Auditorium, IIT Madras Campus, Chennai'}
                    className={`w-full border rounded-xl py-2.5 pl-10 pr-3.5 text-xs md:text-sm font-semibold transition-all ${
                      !isEditingAllowed
                        ? 'bg-slate-100/80 text-slate-500 border-slate-200 cursor-not-allowed select-none'
                        : errors.venue
                        ? 'bg-white border-rose-400 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800'
                        : !formData.venue
                        ? 'bg-amber-50/40 border-amber-300 focus:border-teal-500 text-slate-800'
                        : 'bg-white border-slate-200 focus:ring-teal-500/20 focus:border-teal-500 text-slate-800'
                    }`}
                  />
                </div>
                {errors.venue && <p className="text-rose-500 text-[10px] font-bold mt-1">{errors.venue}</p>}
              </div>
            </div>
          </div>

          {/* Section 2.2: Event Schedule & Timings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                {!isEditingAllowed ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : <Unlock className="w-3.5 h-3.5 text-emerald-600" />}
                <span>2. Event Schedule & Timings</span>
              </h3>
              <span className="text-[10px] font-bold text-slate-400">3-Day Advance Rule Enforced</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Start Date */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Event Start Date <span className="text-rose-500">*</span>
                  </label>
                  {!isEditingAllowed ? (
                    <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Locked
                    </span>
                  ) : renderConfidenceBadge('fromDate')}
                </div>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    required
                    disabled={!isEditingAllowed}
                    readOnly={!isEditingAllowed}
                    min={getMinAllowedDate()}
                    max={getMaxAllowedDate()}
                    value={formData.fromDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleFieldChange('fromDate', val);
                      if (!formData.toDate || formData.toDate < val) {
                        handleFieldChange('toDate', val);
                      }
                    }}
                    className={`w-full border rounded-xl py-2.5 pl-10 pr-3.5 text-xs md:text-sm font-semibold transition-all ${
                      !isEditingAllowed
                        ? 'bg-slate-100/80 text-slate-500 border-slate-200 cursor-not-allowed select-none'
                        : errors.fromDate
                        ? 'bg-white border-rose-400 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800'
                        : !formData.fromDate
                        ? 'bg-amber-50/40 border-amber-300 focus:border-teal-500 text-slate-800'
                        : 'bg-white border-slate-200 focus:ring-teal-500/20 focus:border-teal-500 text-slate-800'
                    }`}
                  />
                </div>
                {errors.fromDate && <p className="text-rose-500 text-[10px] font-bold mt-1">{errors.fromDate}</p>}
              </div>

              {/* End Date */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Event End Date <span className="text-rose-500">*</span>
                  </label>
                  {!isEditingAllowed ? (
                    <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Locked
                    </span>
                  ) : renderConfidenceBadge('toDate')}
                </div>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    required
                    disabled={!isEditingAllowed}
                    readOnly={!isEditingAllowed}
                    min={formData.fromDate || getMinAllowedDate()}
                    max={getMaxAllowedDate()}
                    value={formData.toDate}
                    onChange={(e) => handleFieldChange('toDate', e.target.value)}
                    className={`w-full border rounded-xl py-2.5 pl-10 pr-3.5 text-xs md:text-sm font-semibold transition-all ${
                      !isEditingAllowed
                        ? 'bg-slate-100/80 text-slate-500 border-slate-200 cursor-not-allowed select-none'
                        : errors.toDate
                        ? 'bg-white border-rose-400 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800'
                        : !formData.toDate
                        ? 'bg-amber-50/40 border-amber-300 focus:border-teal-500 text-slate-800'
                        : 'bg-white border-slate-200 focus:ring-teal-500/20 focus:border-teal-500 text-slate-800'
                    }`}
                  />
                </div>
                {errors.toDate && <p className="text-rose-500 text-[10px] font-bold mt-1">{errors.toDate}</p>}
              </div>

              {/* From Time */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    From Time <span className="text-rose-500">*</span>
                  </label>
                  {!isEditingAllowed && (
                    <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Locked
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Clock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="time"
                    disabled={!isEditingAllowed}
                    readOnly={!isEditingAllowed}
                    value={formData.fromTime}
                    onChange={(e) => handleFieldChange('fromTime', e.target.value)}
                    className={`w-full border rounded-xl py-2.5 pl-10 pr-3.5 text-xs md:text-sm font-semibold transition-all ${
                      !isEditingAllowed
                        ? 'bg-slate-100/80 text-slate-500 border-slate-200 cursor-not-allowed select-none'
                        : errors.fromTime
                        ? 'bg-white border-rose-400 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800'
                        : 'bg-white border-slate-200 focus:ring-teal-500/20 focus:border-teal-500 text-slate-800'
                    }`}
                  />
                </div>
                {errors.fromTime && <p className="text-rose-500 text-[10px] font-bold mt-1">{errors.fromTime}</p>}
              </div>

              {/* To Time */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    To Time <span className="text-rose-500">*</span>
                  </label>
                  {!isEditingAllowed && (
                    <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Locked
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Clock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="time"
                    disabled={!isEditingAllowed}
                    readOnly={!isEditingAllowed}
                    value={formData.toTime}
                    onChange={(e) => handleFieldChange('toTime', e.target.value)}
                    className={`w-full border rounded-xl py-2.5 pl-10 pr-3.5 text-xs md:text-sm font-semibold transition-all ${
                      !isEditingAllowed
                        ? 'bg-slate-100/80 text-slate-500 border-slate-200 cursor-not-allowed select-none'
                        : errors.toTime
                        ? 'bg-white border-rose-400 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800'
                        : 'bg-white border-slate-200 focus:ring-teal-500/20 focus:border-teal-500 text-slate-800'
                    }`}
                  />
                </div>
                {errors.toTime && <p className="text-rose-500 text-[10px] font-bold mt-1">{errors.toTime}</p>}
              </div>
            </div>
          </div>

          {/* Section 2.3: Academic Justification & Reason */}
          <div className="space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2 flex items-center gap-1.5">
              {!isEditingAllowed ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : <Unlock className="w-3.5 h-3.5 text-emerald-600" />}
              <span>3. Academic Justification & Reason</span>
            </h3>
            
            <div className="space-y-4">
              {/* Reason */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Reason for OD <span className="text-rose-500">*</span>
                  </label>
                  {!isEditingAllowed ? (
                    <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Locked
                    </span>
                  ) : renderConfidenceBadge('reason')}
                </div>
                <input
                  type="text"
                  required
                  disabled={!isEditingAllowed}
                  readOnly={!isEditingAllowed}
                  value={formData.reason}
                  onChange={(e) => handleFieldChange('reason', e.target.value)}
                  placeholder={!isEditingAllowed ? 'Locked — Auto-fill will populate from documents' : 'e.g. Selected for National Hackathon Finals / Paper Presentation'}
                  className={`w-full border rounded-xl py-2.5 px-3.5 text-xs md:text-sm font-semibold transition-all ${
                    !isEditingAllowed
                      ? 'bg-slate-100/80 text-slate-500 border-slate-200 cursor-not-allowed select-none'
                      : errors.reason
                      ? 'bg-white border-rose-400 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800'
                      : !formData.reason
                      ? 'bg-amber-50/40 border-amber-300 focus:border-teal-500 text-slate-800'
                      : 'bg-white border-slate-200 focus:ring-teal-500/20 focus:border-teal-500 text-slate-800'
                  }`}
                />
                {errors.reason && <p className="text-rose-500 text-[10px] font-bold mt-1">{errors.reason}</p>}
              </div>

              {/* Description */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Event Details / Brief Description
                  </label>
                  {!isEditingAllowed ? (
                    <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Locked
                    </span>
                  ) : renderConfidenceBadge('description')}
                </div>
                <textarea
                  disabled={!isEditingAllowed}
                  readOnly={!isEditingAllowed}
                  value={formData.description}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  placeholder={!isEditingAllowed ? 'Locked — Auto-fill will populate from documents' : 'Provide a brief summary of your role, team members, or specific objective of the event...'}
                  rows={3}
                  className={`w-full border rounded-xl py-2.5 px-3.5 text-xs md:text-sm font-semibold transition-all ${
                    !isEditingAllowed
                      ? 'bg-slate-100/80 text-slate-500 border-slate-200 cursor-not-allowed select-none'
                      : errors.description
                      ? 'bg-white border-rose-400 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800'
                      : 'bg-white border-slate-200 focus:ring-teal-500/20 focus:border-teal-500 text-slate-800'
                  }`}
                />
                {errors.description && <p className="text-rose-500 text-[10px] font-bold mt-1">{errors.description}</p>}
              </div>
            </div>
          </div>

          {/* Section 2.4: Student Review Confirmation (Mandatory) */}
          <div className={`p-4 md:p-5 rounded-2xl border space-y-3 transition-all ${
            !isEditingAllowed 
              ? 'bg-slate-50 border-slate-200 opacity-60' 
              : isReviewed 
              ? 'bg-emerald-50/80 border-emerald-300 shadow-xs ring-1 ring-emerald-300/40' 
              : errors.reviewed
              ? 'bg-rose-50/80 border-rose-300 shadow-xs ring-1 ring-rose-300/40'
              : 'bg-amber-50/50 border-amber-300 shadow-xs ring-1 ring-amber-300/30'
          }`}>
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5 mb-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className={`w-4 h-4 ${isReviewed ? 'text-emerald-600' : 'text-amber-600'}`} />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Mandatory Verification Checkpoint
                </h4>
              </div>
              <span className={`px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full border ${
                isReviewed 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 flex items-center gap-1' 
                  : 'bg-rose-100 text-rose-700 border-rose-200'
              }`}>
                {isReviewed ? (
                  <>
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                    <span>Confirmed</span>
                  </>
                ) : (
                  <span>Mandatory *</span>
                )}
              </span>
            </div>

            <div className="flex items-start gap-3 pt-1">
              <input
                type="checkbox"
                id="reviewConfirmation"
                required
                disabled={!isEditingAllowed}
                checked={isReviewed}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsReviewed(checked);
                  if (errors.reviewed) {
                    setErrors(prev => {
                      const next = { ...prev };
                      delete next.reviewed;
                      return next;
                    });
                  }
                  if (checkReadyToSubmit(formData, checked)) {
                    setWorkflowState('READY_TO_SUBMIT');
                  } else {
                    setWorkflowState('EDITING_ENABLED');
                  }
                }}
                className={`mt-1 w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500 transition-all ${
                  !isEditingAllowed ? 'cursor-not-allowed' : 'cursor-pointer'
                }`}
              />
              <label 
                htmlFor="reviewConfirmation" 
                className={`text-xs font-semibold select-none leading-relaxed ${
                  !isEditingAllowed ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700 cursor-pointer'
                }`}
              >
                <strong className={!isEditingAllowed ? 'text-slate-500' : 'text-slate-900'}>
                  Student Review Confirmation <span className="text-rose-500 font-black">*</span>:
                </strong> I have reviewed and verified all extracted and entered event details (Event Name, Venue, Dates, and Timings). I confirm that both uploaded documents (OD Letter and Event Poster) are authentic and match this application.
              </label>
            </div>
            {errors.reviewed && (
              <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1 pl-7 animate-shake">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errors.reviewed}</span>
              </p>
            )}
            {!isReviewed && isEditingAllowed && !errors.reviewed && (
              <p className="text-[10px] text-amber-700 font-semibold pl-7 flex items-center gap-1">
                <span>Action required: You must review the details above and check this confirmation box before submission is permitted.</span>
              </p>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-6">
            <div>
              {!isEditingAllowed ? (
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Auto-fill required before submission</span>
                </span>
              ) : !isReviewed ? (
                <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1.5 animate-pulse">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Mandatory review confirmation required</span>
                </span>
              ) : (
                <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Verified & ready for submission</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/student/requests')}
                className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-bold text-xs uppercase tracking-wider transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isEditingAllowed || isSubmitting || !isReviewed}
                className={`font-black px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                  !isEditingAllowed || !isReviewed
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                    : isSubmitting
                    ? 'bg-teal-700 text-white opacity-70 cursor-wait'
                    : 'bg-teal-600 hover:bg-teal-700 text-white shadow-md hover:shadow-lg shadow-teal-200 cursor-pointer'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Submitting to Approval Queue...</span>
                  </>
                ) : !isEditingAllowed ? (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Submit OD Request (Locked — Auto-Fill First)</span>
                  </>
                ) : !isReviewed ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-slate-400" />
                    <span>Confirm Review to Submit (Mandatory)</span>
                  </>
                ) : (
                  <span>Submit OD Request (4-Stage Approval)</span>
                )}
              </button>
            </div>
          </div>

        </form>
      </Card>

    </div>
  );
};
