import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getODRequests, syncODRequestsFromBackend
} from '../data/mockData';
import { ODRequest, EventType } from '../types/types';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { 
  Search, History, Filter, FileSpreadsheet, Eye, FileDown, 
  Calendar, Award, SlidersHorizontal, ArrowUpDown
} from 'lucide-react';
import { useToast } from '../components/Toast';

export const ODHistory: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [requests, setRequests] = useState<ODRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [dateRange, setDateRange] = useState<string>('All');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const loadData = () => {
    setRequests(getODRequests());
  };

  useEffect(() => {
    loadData();
    syncODRequestsFromBackend().then((backendReqs) => {
      if (backendReqs) setRequests(backendReqs);
    });
    window.addEventListener('odStateUpdated', loadData);
    return () => window.removeEventListener('odStateUpdated', loadData);
  }, []);

  const eventTypes: EventType[] = [
    'Hackathon', 'Symposium', 'Workshop', 'Sports',
    'Cultural Event', 'Internship', 'Competition', 'Seminar', 'Other'
  ];

  const filteredRequests = requests.filter((req) => {
    const matchesSearch = 
      req.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.eventName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.eventOrganizer.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || req.status === statusFilter;
    const matchesType = typeFilter === 'All' || req.eventType === typeFilter;
    
    let matchesDate = true;
    if (dateRange !== 'All') {
      const reqDate = new Date(req.eventDate);
      const today = new Date();
      if (dateRange === '30') {
        const diffTime = Math.abs(today.getTime() - reqDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        matchesDate = diffDays <= 30;
      } else if (dateRange === '90') {
        const diffTime = Math.abs(today.getTime() - reqDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        matchesDate = diffDays <= 90;
      }
    }

    return matchesSearch && matchesStatus && matchesType && matchesDate;
  }).sort((a, b) => {
    const timeA = new Date(a.eventDate).getTime();
    const timeB = new Date(b.eventDate).getTime();
    return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });

  const handleExport = () => {
    showToast('Exporting OD History as Excel/CSV spreadsheet initialized.', 'success');
  };

  const toggleSort = () => {
    setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    showToast(`Sorted by date in ${sortOrder === 'desc' ? 'ascending' : 'descending'} order.`, 'info');
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary-600 p-2 rounded-xl text-white">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">OD History Log</h1>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">Academic records of previous OD submissions</p>
          </div>
        </div>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>Export History</span>
        </button>
      </div>

      {/* Filter Options Panel */}
      <Card className="p-4 md:p-5 space-y-4">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
          <SlidersHorizontal className="w-4 h-4 text-slate-500" />
          <span>Search & Advanced Filters</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Search Box */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Search</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Event, ID, Organizer..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Approved">Approved</option>
              <option value="Pending">Pending</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Event Type Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Event Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all cursor-pointer"
            >
              <option value="All">All Types</option>
              {eventTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Time Window</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all cursor-pointer"
            >
              <option value="All">All Time</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
          </div>
        </div>
      </Card>

      {/* OD Logs Table */}
      <Card>
        {filteredRequests.length === 0 ? (
          <div className="text-center py-16 text-slate-400 font-semibold">
            No OD logs match your selected filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider select-none">
                  <th className="pb-3">Request ID</th>
                  <th className="pb-3">Event Name</th>
                  <th 
                    onClick={toggleSort}
                    className="pb-3 cursor-pointer hover:text-slate-600 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Event Date</span>
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </div>
                  </th>
                  <th className="pb-3 hidden sm:table-cell">Type</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 hidden md:table-cell text-center">Certificate</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/40">
                    <td className="py-3.5 text-primary-600 font-bold">{req.id}</td>
                    <td className="py-3.5 pr-2">
                      <div>
                        <p className="font-bold text-slate-800 line-clamp-1">{req.eventName}</p>
                        <p className="text-[10px] text-slate-400 font-medium md:hidden">{req.eventType}</p>
                      </div>
                    </td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
                        <span>
                          {new Date(req.eventDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 hidden sm:table-cell">
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">
                        {req.eventType}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <StatusBadge status={req.status} size="sm" />
                    </td>
                    <td className="py-3.5 hidden md:table-cell text-center">
                      {req.documentUrl ? (
                        <span 
                          className="inline-flex p-1 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100"
                          title={`Document: ${req.documentUrl}`}
                        >
                          <Award className="w-4 h-4" />
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs font-normal">-</span>
                      )}
                    </td>
                    <td className="py-3.5 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => navigate(`/student/requests/${req.id}`)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 shadow-sm"
                          title="Track Progress"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {req.documentUrl && (
                          <button
                            onClick={() => showToast(`Downloading certificate ${req.documentUrl}...`, 'success')}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 shadow-sm"
                            title="Download PDF File"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </div>
  );
};
