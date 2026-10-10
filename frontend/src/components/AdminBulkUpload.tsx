import React, { useState, useRef } from 'react';
import { 
  Upload, FileSpreadsheet, Download, CheckCircle2, 
  AlertTriangle, XCircle, Info, RefreshCw, Eye, 
  FileText, ArrowRight, ShieldCheck, Check, X,
  GraduationCap, Users, AlertCircle, FileDown
} from 'lucide-react';
import { 
  apiDownloadStudentBulkTemplate,
  apiUploadStudentBulkFile,
  apiConfirmStudentBulkUpload,
  apiDownloadStudentBulkErrorReport,
  apiDownloadFacultyBulkTemplate,
  apiUploadFacultyBulkFile,
  apiConfirmFacultyBulkUpload,
  apiDownloadFacultyBulkErrorReport,
  BulkUploadSummary,
  BulkUploadRowPreview,
  BulkValidationError
} from '../services/api';
import { useToast } from './Toast';

interface AdminBulkUploadProps {
  entityType: 'student' | 'faculty';
  onSuccess: () => void;
  onSwitchToRoster?: () => void;
}

export const AdminBulkUpload: React.FC<AdminBulkUploadProps> = ({
  entityType,
  onSuccess,
  onSwitchToRoster
}) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isStudent = entityType === 'student';
  const entityTitle = isStudent ? 'Student' : 'Faculty';
  const entityTitlePlural = isStudent ? 'Students' : 'Faculty Members';

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isDownloadingErrors, setIsDownloadingErrors] = useState(false);

  // Preview state
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [summary, setSummary] = useState<BulkUploadSummary | null>(null);
  const [rows, setRows] = useState<BulkUploadRowPreview[]>([]);
  const [errors, setErrors] = useState<BulkValidationError[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'valid' | 'duplicate' | 'invalid'>('all');
  const [tableSearch, setTableSearch] = useState('');

  // Confirmation state
  const [isConfirming, setIsConfirming] = useState(false);
  const [importResult, setImportResult] = useState<{
    importedCount: number;
    skippedCount: number;
    failedCount: number;
    totalProcessed: number;
  } | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Download Templates
  const handleDownloadTemplate = async (format: 'xlsx' | 'csv' = 'xlsx') => {
    setIsDownloadingTemplate(true);
    const res = isStudent
      ? await apiDownloadStudentBulkTemplate(format)
      : await apiDownloadFacultyBulkTemplate(format);
    setIsDownloadingTemplate(false);

    if (res.success) {
      showToast(`${entityTitle} bulk upload template (${format.toUpperCase()}) downloaded successfully.`, 'success');
    } else {
      showToast(res.error || 'Failed to download template.', 'error');
    }
  };

  // Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
      showToast('Invalid file format. Please upload a .xlsx, .xls, or .csv spreadsheet.', 'error');
      return;
    }
    setSelectedFile(file);
    setPreviewToken(null);
    setSummary(null);
    setRows([]);
    setErrors([]);
    setImportResult(null);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setPreviewToken(null);
    setSummary(null);
    setRows([]);
    setErrors([]);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload & Validate
  const handleUploadAndValidate = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setImportResult(null);

    const res = isStudent
      ? await apiUploadStudentBulkFile(selectedFile)
      : await apiUploadFacultyBulkFile(selectedFile);
    setIsUploading(false);

    if (res.success && res.summary) {
      setPreviewToken(res.preview_token || null);
      setSummary(res.summary);
      setRows(res.rows || []);
      setErrors(res.errors || []);

      if (res.summary.invalid_rows > 0 || res.summary.duplicate_rows > 0) {
        showToast(
          `Validation finished: ${res.summary.valid_rows} valid, ${res.summary.invalid_rows} invalid, ${res.summary.duplicate_rows} duplicate.`,
          'info'
        );
      } else {
        showToast(`All ${res.summary.valid_rows} record(s) are valid and ready to import!`, 'success');
      }
    } else {
      showToast(res.error || 'Failed to validate spreadsheet.', 'error');
      setErrors(res.errors || []);
    }
  };

  // Confirm Import
  const handleConfirmImport = async () => {
    if (!previewToken) return;
    setIsConfirming(true);

    const res = isStudent
      ? await apiConfirmStudentBulkUpload(previewToken)
      : await apiConfirmFacultyBulkUpload(previewToken);
    setIsConfirming(false);

    if (res.success) {
      const imported = res.imported_count || 0;
      const skipped = res.skipped_count || 0;
      const failed = res.failed_count || 0;
      const total = res.total_processed || imported + skipped + failed;

      setImportResult({
        importedCount: imported,
        skippedCount: skipped,
        failedCount: failed,
        totalProcessed: total
      });

      showToast(
        res.message || `Import successful! ${imported} ${entityTitlePlural.toLowerCase()} enrolled.`,
        'success'
      );
      onSuccess();
    } else {
      showToast(res.error || 'Import operation failed.', 'error');
    }
  };

  // Download Error Report
  const handleDownloadErrorReport = async (format: 'xlsx' | 'csv' = 'xlsx') => {
    if (!previewToken) return;
    setIsDownloadingErrors(true);
    const res = isStudent
      ? await apiDownloadStudentBulkErrorReport(previewToken, format)
      : await apiDownloadFacultyBulkErrorReport(previewToken, format);
    setIsDownloadingErrors(false);

    if (res.success) {
      showToast(`Error report (${format.toUpperCase()}) downloaded successfully.`, 'success');
    } else {
      showToast(res.error || 'Failed to download error report.', 'error');
    }
  };

  // Filtered rows for preview table
  const filteredRows = rows.filter((r) => {
    if (activeFilter === 'valid' && r.validation_status !== 'VALID') return false;
    if (activeFilter === 'duplicate' && r.validation_status !== 'DUPLICATE') return false;
    if (activeFilter === 'invalid' && r.validation_status !== 'INVALID') return false;

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase();
      const idMatch = (r.roll_number || r.faculty_id || '').toLowerCase().includes(q);
      const nameMatch = (r.name || '').toLowerCase().includes(q);
      const emailMatch = (r.email || '').toLowerCase().includes(q);
      const deptMatch = (r.department || '').toLowerCase().includes(q);
      return idMatch || nameMatch || emailMatch || deptMatch;
    }
    return true;
  });

  return (
    <div className="space-y-6">

      {/* ─── 1. Header Banner & Instructions ──────────────────────────────── */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {isStudent ? <GraduationCap className="w-5 h-5" /> : <Users className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight">Bulk Upload {entityTitlePlural}</h2>
                <p className="text-xs text-slate-300 font-medium">
                  Batch enroll {entityTitlePlural.toLowerCase()} via Excel (.xlsx) or CSV with automated validation and duplicate prevention.
                </p>
              </div>
            </div>
          </div>

          {/* Template Download Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isDownloadingTemplate}
              onClick={() => handleDownloadTemplate('xlsx')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>{isDownloadingTemplate ? 'Downloading...' : 'Excel Template (.xlsx)'}</span>
            </button>
            <button
              type="button"
              disabled={isDownloadingTemplate}
              onClick={() => handleDownloadTemplate('csv')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              title="Download plain CSV template"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Column Specs Pills */}
        <div className="mt-4 pt-4 border-t border-slate-700/60 flex flex-wrap items-center gap-2 text-[11px] text-slate-300 font-medium">
          <span className="font-bold text-amber-400 uppercase tracking-wider text-[10px]">Expected Columns:</span>
          {isStudent ? (
            <>
              <span className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700">Roll Number *</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700">Student Name *</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700">Username</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700">Email Address (@rajalakshmi.edu.in) *</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700">Department</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700">Class / Section</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700">Year of Study</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700">Semester</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700">Password (Optional)</span>
            </>
          ) : (
            <>
              <span className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700">Faculty ID *</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700">Faculty Name *</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700">Username</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700">Email Address (@rajalakshmi.edu.in) *</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700">Department</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700">Designation</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700">Assigned Role (Mentor / Class Incharge / HOD) *</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700">Password (Optional)</span>
            </>
          )}
        </div>
      </div>

      {/* ─── 2. Success Banner (After Confirmation) ───────────────────────── */}
      {importResult && (
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-3xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 mt-0.5">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-emerald-950">Bulk Import Successfully Completed</h3>
                <p className="text-xs text-emerald-800 mt-0.5">
                  <strong>{importResult.importedCount}</strong> new account(s) established. 
                  {importResult.skippedCount > 0 && ` ${importResult.skippedCount} duplicate(s) safely skipped.`}
                  {importResult.failedCount > 0 && ` ${importResult.failedCount} record(s) failed.`}
                </p>
                <p className="text-[11px] text-emerald-700 mt-1">
                  All imported accounts have been securely hashed, registered in MongoDB, and are ready for immediate authentication.
                </p>
              </div>
            </div>

            {onSwitchToRoster && (
              <button
                type="button"
                onClick={onSwitchToRoster}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-md shadow-emerald-700/20 cursor-pointer self-start sm:self-auto"
              >
                <span>View in Roster</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── 3. Upload Zone & File Selector ────────────────────────────────── */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          className="hidden"
        />

        {!selectedFile ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-amber-500 bg-amber-50/50 scale-[0.99]'
                : 'border-slate-300 hover:border-amber-500/80 hover:bg-slate-50/60'
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-black text-slate-800">
              Drag and drop your Excel (.xlsx) or CSV file here
            </p>
            <p className="text-xs text-slate-500 mt-1">
              or <span className="text-amber-600 font-bold hover:underline">browse from your computer</span> (Maximum file size: 10 MB)
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-100 text-emerald-700">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">{selectedFile.name}</p>
                <p className="text-[11px] text-slate-500 font-mono">
                  {formatFileSize(selectedFile.size)} • {selectedFile.name.split('.').pop()?.toUpperCase()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={handleClearFile}
                disabled={isUploading || isConfirming}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-white text-slate-600 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Change File
              </button>
              <button
                type="button"
                onClick={handleUploadAndValidate}
                disabled={isUploading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-md shadow-amber-600/20 cursor-pointer disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Validating...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{previewToken ? 'Re-validate Records' : 'Validate & Preview'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── 4. Validation Summary & Action Bar ────────────────────────────── */}
      {summary && (
        <div className="space-y-4">
          
          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Rows</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{summary.total_rows}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Parsed from spreadsheet</p>
            </div>

            <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Valid</p>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-emerald-700 mt-1">{summary.valid_rows}</p>
              <p className="text-[10px] text-emerald-600/90 font-medium mt-0.5">Ready for safe import</p>
            </div>

            <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Duplicates</p>
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-black text-amber-700 mt-1">{summary.duplicate_rows}</p>
              <p className="text-[10px] text-amber-600/90 font-medium mt-0.5">Existing accounts (will skip)</p>
            </div>

            <div className="p-4 bg-rose-50/70 rounded-2xl border border-rose-200 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Invalid</p>
                <XCircle className="w-4 h-4 text-rose-600" />
              </div>
              <p className="text-2xl font-black text-rose-700 mt-1">{summary.invalid_rows}</p>
              <p className="text-[10px] text-rose-600/90 font-medium mt-0.5">Failed validation checks</p>
            </div>
          </div>

          {/* Action Ribbon: Confirm Import & Download Error Report */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Filter Preview:</span>
              <div className="flex items-center p-0.5 bg-slate-100 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    activeFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  All ({rows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('valid')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    activeFilter === 'valid' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Valid ({summary.valid_rows})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('duplicate')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    activeFilter === 'duplicate' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Duplicates ({summary.duplicate_rows})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('invalid')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    activeFilter === 'invalid' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Errors ({summary.invalid_rows})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {/* Download Error Report Button */}
              {(summary.invalid_rows > 0 || summary.duplicate_rows > 0) && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={isDownloadingErrors}
                    onClick={() => handleDownloadErrorReport('xlsx')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    title="Download Excel error report"
                  >
                    <FileDown className="w-4 h-4 text-rose-600" />
                    <span>{isDownloadingErrors ? 'Downloading...' : 'Download Error Report (.xlsx)'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isDownloadingErrors}
                    onClick={() => handleDownloadErrorReport('csv')}
                    className="px-2.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer"
                    title="Download CSV error report"
                  >
                    CSV
                  </button>
                </div>
              )}

              {/* Confirm Import Button */}
              <button
                type="button"
                disabled={isConfirming || summary.valid_rows === 0}
                onClick={handleConfirmImport}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isConfirming ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Importing Accounts...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Confirm Import ({summary.valid_rows} Records)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ─── 5. Preview Table ─────────────────────────────────────────── */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Spreadsheet Preview ({filteredRows.length} of {rows.length})
                </h4>
                <p className="text-[11px] text-slate-500">
                  Review verified rows before finalizing permanent database registration.
                </p>
              </div>

              <input
                type="text"
                placeholder="Search identifier, name, or email in preview..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-72 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">Row</th>
                    <th className="py-2.5 px-3">{isStudent ? 'Roll Number' : 'Faculty ID'}</th>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">College Email</th>
                    <th className="py-2.5 px-3">Department</th>
                    {isStudent ? (
                      <>
                        <th className="py-2.5 px-3">Year & Sec</th>
                        <th className="py-2.5 px-3">Semester</th>
                      </>
                    ) : (
                      <>
                        <th className="py-2.5 px-3">Designation</th>
                        <th className="py-2.5 px-3">Assigned Role</th>
                      </>
                    )}
                    <th className="py-2.5 px-3">Password</th>
                    <th className="py-2.5 px-3">Validation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No rows match the active filter or search query.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((r) => {
                      const isValid = r.validation_status === 'VALID';
                      const isDup = r.validation_status === 'DUPLICATE';
                      const isInv = r.validation_status === 'INVALID';

                      return (
                        <tr 
                          key={r.row_number} 
                          className={`hover:bg-slate-50/90 transition-colors ${
                            isInv ? 'bg-rose-50/20' : isDup ? 'bg-amber-50/20' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {r.row_number}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                            {r.roll_number || r.faculty_id || '—'}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {r.name || '—'}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                            {r.email || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {r.department || '—'}
                          </td>

                          {isStudent ? (
                            <>
                              <td className="py-2.5 px-3 text-slate-700">
                                {r.year} • {r.section}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700">
                                {r.semester}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-2.5 px-3 text-slate-700">
                                {r.designation}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="inline-flex px-2 py-0.5 rounded-md font-bold text-[10px] bg-blue-50 text-blue-700 border border-blue-200">
                                  {r.role}
                                </span>
                              </td>
                            </>
                          )}

                          <td className="py-2.5 px-3">
                            <span className="text-[11px] font-semibold text-slate-500">
                              {r.password_preview}
                            </span>
                          </td>

                          <td className="py-2.5 px-3">
                            {isValid && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Valid
                              </span>
                            )}
                            {isDup && (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  Duplicate
                                </span>
                                {r.errors.length > 0 && (
                                  <p className="text-[10px] text-amber-700 leading-tight">
                                    {r.errors.join('; ')}
                                  </p>
                                )}
                              </div>
                            )}
                            {isInv && (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                  <XCircle className="w-3 h-3 text-rose-600" />
                                  Invalid
                                </span>
                                {r.errors.length > 0 && (
                                  <p className="text-[10px] text-rose-600 font-semibold leading-tight">
                                    {r.errors.join('; ')}
                                  </p>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
