import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Filter, Plus, Edit2, 
  UserCheck, UserX, Building2, ShieldCheck, 
  X, Check, AlertCircle, RefreshCw, Mail, Phone, Upload
} from 'lucide-react';
import { 
  apiGetAdminFaculty, apiCreateAdminFaculty, 
  apiUpdateAdminFaculty, apiToggleUserStatus 
} from '../../services/api';
import { useToast } from '../../components/Toast';
import { AdminBulkUpload } from '../../components/AdminBulkUpload';

export const AdminFaculty: React.FC = () => {
  const { showToast } = useToast();

  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [activeTab, setActiveTab] = useState<'roster' | 'bulk_upload'>('roster');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState<any | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    employee_id: '',
    email: '',
    phone: '',
    department: 'Computer Science and Design',
    designation: 'Assistant Professor',
    role: 'Mentor',
    assigned_section: 'III Year - Section A',
    password: ''
  });

  const loadFaculty = async () => {
    try {
      setLoading(true);
      const res = await apiGetAdminFaculty({
        search: search || undefined,
        role: role || undefined,
        department: department || undefined,
        status: status || undefined
      });
      if (res && res.success) {
        setFacultyList(res.data || []);
      }
    } catch {
      showToast('Failed to load faculty roster', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFaculty();
  }, [role, department, status]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadFaculty();
  };

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      employee_id: '',
      email: '',
      phone: '',
      department: 'Computer Science and Design',
      designation: 'Assistant Professor',
      role: 'Mentor',
      assigned_section: 'III Year - Section A',
      password: 'password123'
    });
    setIsAddOpen(true);
  };

  const handleOpenEdit = (fac: any) => {
    setSelectedFaculty(fac);
    setFormData({
      name: fac.name || '',
      employee_id: fac.employee_id || fac.identifier || '',
      email: fac.email || '',
      phone: fac.phone || '',
      department: fac.department || 'Computer Science and Design',
      designation: fac.designation || 'Assistant Professor',
      role: fac.role || 'Mentor',
      assigned_section: fac.assigned_section || fac.section || '',
      password: ''
    });
    setIsEditOpen(true);
  };

  const handleToggleStatus = async (fac: any) => {
    const newStatus = fac.status === 'Active' || fac.status === 'ACTIVE' ? 'Inactive' : 'Active';
    const conf = window.confirm(`Are you sure you want to change ${fac.name}'s status to ${newStatus}?`);
    if (!conf) return;

    try {
      const res = await apiToggleUserStatus(fac.id || fac._id || fac.faculty_id, newStatus);
      if (res && res.success) {
        showToast(`Faculty status updated to ${newStatus}`, 'success');
        loadFaculty();
      } else {
        showToast(res?.error || 'Failed to update faculty status', 'error');
      }
    } catch {
      showToast('Network error updating status', 'error');
    }
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiCreateAdminFaculty(formData);
      if (res && res.success) {
        showToast('Faculty created successfully', 'success');
        setIsAddOpen(false);
        loadFaculty();
      } else {
        showToast(res?.error || 'Failed to create faculty', 'error');
      }
    } catch {
      showToast('Error creating faculty', 'error');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFaculty) return;
    try {
      const res = await apiUpdateAdminFaculty(selectedFaculty.id || selectedFaculty._id || selectedFaculty.faculty_id, formData);
      if (res && res.success) {
        showToast('Faculty updated successfully', 'success');
        setIsEditOpen(false);
        loadFaculty();
      } else {
        showToast(res?.error || 'Failed to update faculty', 'error');
      }
    } catch {
      showToast('Error updating faculty', 'error');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Faculty Management</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Manage institutional faculty stakeholders: Mentors, Class Incharges, and HODs.
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
              Faculty Roster ({facultyList.length})
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
              <span>Bulk Upload Faculty</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-md shadow-amber-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Faculty</span>
          </button>
        </div>
      </div>

      {activeTab === 'bulk_upload' && (
        <AdminBulkUpload
          entityType="faculty"
          onSuccess={loadFaculty}
          onSwitchToRoster={() => setActiveTab('roster')}
        />
      )}

      {/* Tab 1: Faculty Roster */}
      {activeTab === 'roster' && (
        <div className="space-y-6">
          {/* Filter and Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search faculty by name, employee ID, or email..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
            >
              <option value="">All Faculty Roles</option>
              <option value="Mentor">Mentor</option>
              <option value="Class Incharge">Class Incharge</option>
              <option value="HOD">HOD Executive</option>
            </select>

            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
            >
              <option value="">All Departments</option>
              <option value="Computer Science and Design">Computer Science and Design</option>
              <option value="Computer Science and Engineering">Computer Science and Engineering</option>
              <option value="Information Technology">Information Technology</option>
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

      {/* Faculty Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Faculty Member</th>
                <th className="py-3 px-4">ID / Employee No</th>
                <th className="py-3 px-4">Department & Designation</th>
                <th className="py-3 px-4">Approval Role</th>
                <th className="py-3 px-4">Assigned Allocation</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading faculty roster...
                  </td>
                </tr>
              ) : facultyList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No faculty records matching filter criteria found.
                  </td>
                </tr>
              ) : (
                facultyList.map((fac) => {
                  const isActive = (fac.status || 'Active').toLowerCase() === 'active';
                  const roleBadgeColor = 
                    fac.role === 'HOD' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                    fac.role === 'Class Incharge' ? 'bg-teal-100 text-teal-800 border-teal-200' :
                    'bg-indigo-100 text-indigo-800 border-indigo-200';

                  return (
                    <tr key={fac.id || fac._id || fac.faculty_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-900 text-amber-400 font-black text-xs flex items-center justify-center shrink-0">
                            {fac.name?.[0] || 'F'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{fac.name}</p>
                            <p className="text-[11px] text-slate-400">{fac.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {fac.employee_id || fac.identifier || fac.faculty_id}
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-slate-800 font-semibold">{fac.department}</p>
                        <p className="text-[10px] text-slate-400">{fac.designation}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${roleBadgeColor}`}>
                          {fac.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-semibold">
                        {fac.assigned_section || fac.section || 'Department-wide'}
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
                            onClick={() => handleOpenEdit(fac)}
                            title="Edit Faculty Record"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(fac)}
                            title={isActive ? 'Deactivate Account' : 'Activate Account'}
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

      {/* Add / Edit Faculty Modal */}
      {(isAddOpen || isEditOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900">
                {isAddOpen ? 'Add Faculty Member' : `Edit Faculty: ${selectedFaculty?.name}`}
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
                <label className="block font-bold text-slate-700 mb-1">Faculty Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                  placeholder="e.g. Dr. K. Ramanathan"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Employee ID *</label>
                  <input
                    type="text"
                    required
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                    placeholder="EMP-CSD-105"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Approval Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                  >
                    <option value="Mentor">Mentor</option>
                    <option value="Class Incharge">Class Incharge</option>
                    <option value="HOD">HOD</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Designation</label>
                  <select
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                  >
                    <option value="Professor">Professor</option>
                    <option value="Associate Professor">Associate Professor</option>
                    <option value="Assistant Professor">Assistant Professor</option>
                    <option value="Professor & HOD">Professor & HOD</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Official Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                    placeholder="faculty@rajalakshmi.edu.in"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                    placeholder="+91 98401 23456"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Assigned Section / Class</label>
                <input
                  type="text"
                  value={formData.assigned_section}
                  onChange={(e) => setFormData({ ...formData, assigned_section: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                  placeholder="e.g. III Year - Section A (or leave blank if HOD)"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isAddOpen ? 'Account Password' : 'Change Password (Optional)'}
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
                  {isAddOpen ? 'Create Faculty' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
