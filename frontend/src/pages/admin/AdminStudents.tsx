import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, Search, Filter, Plus, Edit2, 
  UserCheck, UserX, Eye, BookOpen, Clock, 
  Award, X, Check, AlertCircle, RefreshCw, Layers, Upload
} from 'lucide-react';
import { 
  apiGetAdminStudents, apiCreateAdminStudent, 
  apiUpdateAdminStudent, apiToggleUserStatus, 
  apiGetAdminStudentDetails, apiGetAdminFaculty 
} from '../../services/api';
import { useToast } from '../../components/Toast';
import { StatusBadge } from '../../components/StatusBadge';
import { AdminBulkUpload } from '../../components/AdminBulkUpload';

export const AdminStudents: React.FC = () => {
  const { showToast } = useToast();

  const [students, setStudents] = useState<any[]>([]);
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [status, setStatus] = useState('');
  const [activeTab, setActiveTab] = useState<'roster' | 'bulk_upload'>('roster');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [studentDetails, setStudentDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    registerNumber: '',
    department: 'Computer Science and Design',
    year: 'III Year',
    section: 'A',
    email: '',
    phone: '',
    mentorId: '',
    classInchargeId: '',
    password: ''
  });

  const loadStudents = async () => {
    try {
      setLoading(true);
      const res = await apiGetAdminStudents({
        search: search || undefined,
        department: department || undefined,
        year: year || undefined,
        status: status || undefined
      });
      if (res && res.success) {
        setStudents(res.data || []);
      }
    } catch {
      showToast('Failed to load students roster', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadFaculty = async () => {
    const res = await apiGetAdminFaculty();
    if (res && res.success) {
      setFacultyList(res.data || []);
    }
  };

  useEffect(() => {
    loadStudents();
    loadFaculty();
  }, [department, year, status]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadStudents();
  };

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      registerNumber: '',
      department: 'Computer Science and Design',
      year: 'III Year',
      section: 'A',
      email: '',
      phone: '',
      mentorId: '',
      classInchargeId: '',
      password: 'password123'
    });
    setIsAddOpen(true);
  };

  const handleOpenEdit = (stu: any) => {
    setSelectedStudent(stu);
    setFormData({
      name: stu.name || '',
      registerNumber: stu.registerNumber || stu.identifier || '',
      department: stu.department || '',
      year: stu.year || 'III Year',
      section: stu.section || 'A',
      email: stu.email || '',
      phone: stu.phone || '',
      mentorId: stu.mentorId || '',
      classInchargeId: stu.classInchargeId || '',
      password: ''
    });
    setIsEditOpen(true);
  };

  const handleViewDetails = async (stu: any) => {
    setSelectedStudent(stu);
    setIsDetailsOpen(true);
    setDetailsLoading(true);
    try {
      const res = await apiGetAdminStudentDetails(stu.id || stu._id || stu.student_id);
      if (res && res.success) {
        setStudentDetails(res.data);
      } else {
        showToast('Failed to fetch full student record', 'error');
      }
    } catch {
      showToast('Error loading details', 'error');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleToggleStatus = async (stu: any) => {
    const newStatus = stu.status === 'Active' || stu.status === 'ACTIVE' ? 'Inactive' : 'Active';
    const conf = window.confirm(`Are you sure you want to change ${stu.name}'s status to ${newStatus}?`);
    if (!conf) return;

    try {
      const res = await apiToggleUserStatus(stu.id || stu._id, newStatus);
      if (res && res.success) {
        showToast(`Student status updated to ${newStatus}`, 'success');
        loadStudents();
      } else {
        showToast(res?.error || 'Failed to update student status', 'error');
      }
    } catch {
      showToast('Network error updating status', 'error');
    }
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiCreateAdminStudent(formData);
      if (res && res.success) {
        showToast('Student enrolled successfully', 'success');
        setIsAddOpen(false);
        loadStudents();
      } else {
        showToast(res?.error || 'Failed to create student', 'error');
      }
    } catch {
      showToast('Error creating student', 'error');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    try {
      const res = await apiUpdateAdminStudent(selectedStudent.id || selectedStudent._id, formData);
      if (res && res.success) {
        showToast('Student profile updated', 'success');
        setIsEditOpen(false);
        loadStudents();
      } else {
        showToast(res?.error || 'Failed to update student', 'error');
      }
    } catch {
      showToast('Error updating student', 'error');
    }
  };

  const mentors = facultyList.filter(f => f.role === 'Mentor');
  const classIncharges = facultyList.filter(f => f.role === 'Class Incharge');

  return (
    <div className="space-y-6">
      
      {/* Header & Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <GraduationCap className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Student Management</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Manage student registrations, academic allocations, account status, and full profile dossiers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tab Switcher */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setActiveTab('roster')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'roster'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Students Roster ({students.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('bulk_upload')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'bulk_upload'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-amber-600" />
              <span>Bulk Upload Students</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-md shadow-amber-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {activeTab === 'bulk_upload' && (
        <AdminBulkUpload
          entityType="student"
          onSuccess={loadStudents}
          onSwitchToRoster={() => setActiveTab('roster')}
        />
      )}

      {/* Tab 1: Students Roster */}
      {activeTab === 'roster' && (
        <div className="space-y-6">
          {/* Filter and Search Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, register number, or email..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
            >
              <option value="">All Departments</option>
              <option value="Computer Science and Design">Computer Science and Design</option>
              <option value="Computer Science and Engineering">Computer Science and Engineering</option>
              <option value="Information Technology">Information Technology</option>
              <option value="Artificial Intelligence and Machine Learning">AI & ML</option>
            </select>

            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
            >
              <option value="">All Years</option>
              <option value="I Year">I Year</option>
              <option value="II Year">II Year</option>
              <option value="III Year">III Year</option>
              <option value="IV Year">IV Year</option>
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
            >
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* Students Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Register No</th>
                <th className="py-3 px-4">Department & Class</th>
                <th className="py-3 px-4">Assigned Mentor</th>
                <th className="py-3 px-4">Class Incharge</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading student records...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No student records matching criteria found.
                  </td>
                </tr>
              ) : (
                students.map((stu) => {
                  const isActive = (stu.status || 'Active').toLowerCase() === 'active';
                  return (
                    <tr key={stu.id || stu._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center shrink-0">
                            {stu.name?.[0] || 'S'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{stu.name}</p>
                            <p className="text-[11px] text-slate-400">{stu.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {stu.registerNumber || stu.identifier}
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-slate-800 font-semibold">{stu.department}</p>
                        <p className="text-[10px] text-slate-400">{stu.year} • Sec {stu.section}</p>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {stu.mentor || 'Not Assigned'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {stu.classIncharge || 'Not Assigned'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleViewDetails(stu)}
                            title="View Complete Student Dossier"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(stu)}
                            title="Edit Student Profile"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(stu)}
                            title={isActive ? 'Deactivate Student' : 'Activate Student'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isActive 
                                ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50' 
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>
                        </div>
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

      {/* Add / Edit Student Modal */}
      {(isAddOpen || isEditOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900">
                {isAddOpen ? 'Add New Student Record' : `Edit Student: ${selectedStudent?.name}`}
              </h3>
              <button
                type="button"
                onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={isAddOpen ? handleSaveAdd : handleSaveEdit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Student Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                  placeholder="e.g. Ramesh K"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Register Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.registerNumber}
                    onChange={(e) => setFormData({ ...formData, registerNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                    placeholder="e.g. 23CSD099"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                  >
                    <option value="Computer Science and Design">Computer Science and Design</option>
                    <option value="Computer Science and Engineering">Computer Science and Engineering</option>
                    <option value="Information Technology">Information Technology</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Year</label>
                  <select
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                  >
                    <option value="I Year">I Year</option>
                    <option value="II Year">II Year</option>
                    <option value="III Year">III Year</option>
                    <option value="IV Year">IV Year</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Section</label>
                  <input
                    type="text"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                    placeholder="e.g. A"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">College Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                    placeholder="student@rajalakshmi.edu.in"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assign Mentor</label>
                  <select
                    value={formData.mentorId}
                    onChange={(e) => setFormData({ ...formData, mentorId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Select Mentor</option>
                    {mentors.map((m) => (
                      <option key={m.id || m._id} value={m.id || m._id}>
                        {m.name} ({m.department})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assign Class Incharge</label>
                  <select
                    value={formData.classInchargeId}
                    onChange={(e) => setFormData({ ...formData, classInchargeId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Select Class Incharge</option>
                    {classIncharges.map((ci) => (
                      <option key={ci.id || ci._id} value={ci.id || ci._id}>
                        {ci.name} ({ci.assigned_section || ci.section})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isAddOpen ? 'Initial Password' : 'Change Password (Optional)'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                  placeholder={isAddOpen ? "Leave default (password123)" : "Leave blank to keep unchanged (min 6 characters)"}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 shadow-md shadow-amber-600/20"
                >
                  {isAddOpen ? 'Save Student' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Profile & Complete Dossier Modal */}
      {isDetailsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 font-black text-sm flex items-center justify-center">
                  {selectedStudent?.name?.[0] || 'S'}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">{selectedStudent?.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {selectedStudent?.registerNumber || selectedStudent?.identifier} • {selectedStudent?.department}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailsLoading ? (
              <div className="py-16 text-center text-slate-400">
                <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Aggregating student academic metrics & OD records...
              </div>
            ) : !studentDetails ? (
              <div className="py-12 text-center text-slate-400">
                No detail record found for student.
              </div>
            ) : (
              <div className="mt-5 space-y-6 text-xs">
                
                {/* Academic Highlights Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-100">
                    <p className="text-[10px] font-bold text-blue-700 uppercase">CGPA Score</p>
                    <p className="text-lg font-black text-blue-950 mt-0.5">
                      {studentDetails.academic?.cgpa || 'N/A'}
                    </p>
                    <span className="text-[10px] text-blue-600 font-medium">Out of 10.0</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-100">
                    <p className="text-[10px] font-bold text-teal-700 uppercase">Attendance</p>
                    <p className="text-lg font-black text-teal-950 mt-0.5">
                      {studentDetails.academic?.overall_attendance || 0}%
                    </p>
                    <span className="text-[10px] text-teal-600 font-medium">
                      Threshold: 75%
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-100">
                    <p className="text-[10px] font-bold text-amber-700 uppercase">OD Days Used</p>
                    <p className="text-lg font-black text-amber-950 mt-0.5">
                      {studentDetails.academic?.od_days_used || 0} Days
                    </p>
                    <span className="text-[10px] text-amber-700 font-medium">
                      Allowance: {studentDetails.academic?.max_od_days || 12}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-100">
                    <p className="text-[10px] font-bold text-purple-700 uppercase">OD Eligibility</p>
                    <p className="text-xs font-black text-purple-950 mt-1 truncate">
                      {studentDetails.academic?.eligibility_label || 'Eligible'}
                    </p>
                    <span className="text-[10px] text-purple-600 font-medium">
                      Automated Policy Check
                    </span>
                  </div>
                </div>

                {/* Assigned Faculty Section */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Institutional Mentorship & Class Incharge Allocation
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] text-slate-500 font-medium">Designated Mentor:</p>
                      <p className="text-xs font-bold text-slate-800 mt-0.5">
                        {studentDetails.student?.mentor || 'Not Assigned'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500 font-medium">Class Incharge:</p>
                      <p className="text-xs font-bold text-slate-800 mt-0.5">
                        {studentDetails.student?.classIncharge || 'Not Assigned'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* CAT Marks Roster */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Continuous Assessment Test (CAT) Marks
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-500 font-bold text-[10px] uppercase">
                          <th className="p-2.5">Subject</th>
                          <th className="p-2.5">CAT 1</th>
                          <th className="p-2.5">CAT 2</th>
                          <th className="p-2.5">CAT 3</th>
                          <th className="p-2.5">Average</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(studentDetails.academic?.cat_marks || []).length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-slate-400">
                              No CAT marks registered in database.
                            </td>
                          </tr>
                        ) : (
                          studentDetails.academic?.cat_marks.map((cat: any, i: number) => (
                            <tr key={i}>
                              <td className="p-2.5 font-semibold text-slate-800">{cat.subjectName || cat.subject}</td>
                              <td className="p-2.5 font-bold text-slate-700">{cat.cat1 ?? '-'}</td>
                              <td className="p-2.5 font-bold text-slate-700">{cat.cat2 ?? '-'}</td>
                              <td className="p-2.5 font-bold text-slate-700">{cat.cat3 ?? '-'}</td>
                              <td className="p-2.5 font-bold text-blue-600">{cat.average ?? '-'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Student OD History */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    OD Request Application History ({studentDetails.od_history?.length || 0})
                  </h4>
                  <div className="space-y-2">
                    {(studentDetails.od_history || []).length === 0 ? (
                      <p className="p-4 bg-slate-50 rounded-xl text-center text-slate-400">
                        No OD applications submitted yet by this student.
                      </p>
                    ) : (
                      studentDetails.od_history.map((od: any) => (
                        <div key={od.id} className="p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                          <div>
                            <p className="font-bold text-slate-800">{od.eventName}</p>
                            <p className="text-[11px] text-slate-500">
                              {od.fromDate} to {od.toDate} • {od.numberOfDays} days
                            </p>
                          </div>
                          <div className="text-right">
                            <StatusBadge status={od.status} />
                            <p className="text-[10px] text-slate-400 mt-1">Stage: {od.approvalStage}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            )}

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
