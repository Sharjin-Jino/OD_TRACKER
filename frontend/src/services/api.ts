import { AuthSession, UserRole } from '../types/types';

function getValidBackendOrigin(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
  if (!raw) return '';
  try {
    const formatted = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `http://${raw}`;
    const url = new URL(formatted);
    if (url.hostname && url.hostname !== 'http' && url.hostname.includes('.')) {
      return url.origin;
    }
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return url.origin;
    }
  } catch {}
  return '';
}

const _backendOrigin = getValidBackendOrigin();
const API_BASE = _backendOrigin ? `${_backendOrigin}/api` : '/api';

export function resolveStoredToken(token?: string): string | undefined {
  if (token && token.trim()) return token.trim();
  try {
    const rawAuth = localStorage.getItem('od_track_auth_session_v2') || 
                    localStorage.getItem('od_auth_session') || 
                    localStorage.getItem('od_current_user');
    if (rawAuth) {
      const parsed = JSON.parse(rawAuth);
      if (parsed.token) return parsed.token;
    }
  } catch {}
  return undefined;
}

export interface LoginApiResponse {
  success: boolean;
  message?: string;
  user?: {
    userId: string;
    identifier: string;
    name: string;
    email: string;
    role: UserRole;
    sub_role?: string;
    department: string;
    year?: string;
    section?: string;
    designation?: string;
    phone?: string;
    avatar?: string;
    token?: string;
  };
  role?: UserRole;
  dashboardUrl?: string;
  redirectUrl?: string;
  error?: string;
  token?: string;
}

export interface MeApiResponse {
  authenticated: boolean;
  user?: {
    userId: string;
    identifier: string;
    name: string;
    email: string;
    role: UserRole;
    sub_role?: string;
    department: string;
    year?: string;
    section?: string;
    designation?: string;
    phone?: string;
    avatar?: string;
  };
  role?: UserRole;
  dashboardUrl?: string;
  error?: string;
}

/**
 * Call Flask backend /api/auth/login
 * Validates credentials against SQLite database, detects user role, and returns target dashboard URL.
 */
export async function apiLogin(
  identifier: string,
  password: string,
  role?: UserRole
): Promise<LoginApiResponse> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: identifier.trim(),
        password: password.trim(),
        role: role,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Authentication failed. Invalid ID or Password.',
      };
    }

    return data as LoginApiResponse;
  } catch (err) {
    console.warn('Backend API connection failed:', err);
    return {
      success: false,
      error: 'Unable to reach backend server. Please ensure Flask backend is running on port 5000.',
    };
  }
}

/**
 * Call Flask backend /api/auth/logout
 */
export async function apiLogout(): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return (await res.json()) || { success: true };
  } catch (err) {
    console.warn('Logout API error:', err);
    return { success: true };
  }
}

/**
 * Call Flask backend /api/auth/me to verify active session / token
 */
export async function apiGetMe(token?: string): Promise<MeApiResponse> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: 'GET',
      headers,
    });
    const data = await res.json();
    return data as MeApiResponse;
  } catch {
    return { authenticated: false, error: 'Network error' };
  }
}

/**
 * Change password using Current Password (Method A)
 */
export async function apiChangePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
  token?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const storedToken = resolveStoredToken(token);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (storedToken) {
      headers['Authorization'] = `Bearer ${storedToken}`;
    }

    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        currentPassword,
        newPassword,
        confirmPassword,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || data.message || 'Failed to update password.',
      };
    }
    return {
      success: true,
      message: data.message || 'Password updated successfully.',
    };
  } catch (err) {
    return {
      success: false,
      error: 'Unable to reach backend server. Please check your connection.',
    };
  }
}

/**
 * Dispatch 6-digit OTP to user's registered email (Method B & Forgot Password)
 */
export async function apiSendOtp(
  email?: string,
  token?: string
): Promise<{ success: boolean; message?: string; error?: string; email?: string }> {
  try {
    const storedToken = resolveStoredToken(token);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (storedToken) {
      headers['Authorization'] = `Bearer ${storedToken}`;
    }

    const res = await fetch(`${API_BASE}/auth/otp/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: email ? email.trim() : undefined,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || data.message || 'Failed to send OTP code.',
      };
    }
    return {
      success: true,
      message: data.message || 'Verification OTP dispatched to registered email.',
      email: data.email,
    };
  } catch (err) {
    return {
      success: false,
      error: 'Unable to reach backend server. Please check your connection.',
    };
  }
}

/**
 * Verify 6-digit OTP code
 */
export async function apiVerifyOtp(
  otp: string,
  email?: string,
  token?: string
): Promise<{ success: boolean; message?: string; resetToken?: string; error?: string }> {
  try {
    const storedToken = resolveStoredToken(token);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (storedToken) {
      headers['Authorization'] = `Bearer ${storedToken}`;
    }

    const res = await fetch(`${API_BASE}/auth/otp/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        otp: otp.trim(),
        email: email ? email.trim() : undefined,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || data.message || 'Invalid or expired OTP code.',
      };
    }
    return {
      success: true,
      message: data.message || 'OTP successfully verified.',
      resetToken: data.resetToken,
    };
  } catch (err) {
    return {
      success: false,
      error: 'Unable to reach backend server. Please check your connection.',
    };
  }
}

/**
 * Reset password via OTP or Reset Token (Method B)
 */
export async function apiResetPasswordOtp(payload: {
  otp?: string;
  resetToken?: string;
  newPassword: string;
  confirmPassword: string;
  email?: string;
  token?: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const storedToken = resolveStoredToken(payload.token);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (storedToken) {
      headers['Authorization'] = `Bearer ${storedToken}`;
    }

    const res = await fetch(`${API_BASE}/auth/otp/reset-password`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        otp: payload.otp ? payload.otp.trim() : undefined,
        resetToken: payload.resetToken,
        newPassword: payload.newPassword,
        confirmPassword: payload.confirmPassword,
        email: payload.email ? payload.email.trim() : undefined,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || data.message || 'Failed to update password.',
      };
    }
    return {
      success: true,
      message: data.message || 'Password successfully updated.',
    };
  } catch (err) {
    return {
      success: false,
      error: 'Unable to reach backend server. Please check your connection.',
    };
  }
}


/**
 * Create a new OD Request via Flask backend POST /api/od-requests
 */
export async function apiCreateODRequest(
  payload: FormData | Record<string, any>,
  token?: string
): Promise<{ success: boolean; message?: string; requestId?: string; request?: any; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let body: any;
    if (payload instanceof FormData) {
      body = payload;
      // Do not set Content-Type header so browser sets multipart boundary automatically
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(payload);
    }

    const res = await fetch(`${API_BASE}/od-requests`, {
      method: 'POST',
      headers,
      body,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to submit OD request. Please check form inputs.',
      };
    }

    return data;
  } catch (err) {
    console.warn('apiCreateODRequest network error:', err);
    return {
      success: false,
      error: 'Unable to reach backend server. Please verify Flask backend is running on port 5000.',
    };
  }
}

/**
 * Retrieve all OD requests for the logged-in student via GET /api/od-requests/my
 */
export async function apiGetMyODRequests(
  token?: string
): Promise<{ success: boolean; requests: any[]; count?: number; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/od-requests/my`, {
      method: 'GET',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        requests: [],
        error: data.error || 'Failed to fetch OD requests.',
      };
    }

    return data;
  } catch (err) {
    console.warn('apiGetMyODRequests network error:', err);
    return {
      success: false,
      requests: [],
      error: 'Unable to reach backend server.',
    };
  }
}

/**
 * Retrieve a specific OD request by ID via GET /api/od-requests/<id>
 */
export async function apiGetODRequestById(
  requestId: string,
  token?: string
): Promise<{ success: boolean; request?: any; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/od-requests/${requestId}`, {
      method: 'GET',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || `Request ${requestId} not found.`,
      };
    }

    return data;
  } catch (err) {
    console.warn('apiGetODRequestById network error:', err);
    return {
      success: false,
      error: 'Unable to reach backend server.',
    };
  }
}

/**
 * Health check to verify Flask backend connection
 */
export async function apiCheckHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (res.ok) {
      const data = await res.json();
      return data.status === 'healthy';
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Retrieve all OD requests assigned to the logged-in mentor via GET /api/mentor/od-requests
 */
export async function apiGetMentorODRequests(
  token?: string
): Promise<{
  success: boolean;
  requests: any[];
  pending: any[];
  history: any[];
  approved: any[];
  rejected: any[];
  count?: number;
  pendingCount?: number;
  error?: string;
}> {
  try {
    const headers: Record<string, string> = {};
    const activeToken = resolveStoredToken(token);
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    const res = await fetch(`${API_BASE}/mentor/od-requests`, {
      method: 'GET',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        requests: [],
        pending: [],
        history: [],
        approved: [],
        rejected: [],
        error: data.error || 'Failed to fetch mentor OD requests.',
      };
    }

    return {
      success: true,
      requests: data.requests || [],
      pending: data.pending || [],
      history: data.history || [],
      approved: data.approved || [],
      rejected: data.rejected || [],
      count: data.count || 0,
      pendingCount: data.pendingCount || 0,
    };
  } catch (err) {
    console.warn('apiGetMentorODRequests network error:', err);
    return {
      success: false,
      requests: [],
      pending: [],
      history: [],
      approved: [],
      rejected: [],
      error: 'Unable to reach backend server.',
    };
  }
}

/**
 * Retrieve specific request details for mentor review via GET /api/mentor/od-requests/<id>
 */
export async function apiGetMentorODRequestById(
  requestId: string,
  token?: string
): Promise<{ success: boolean; request?: any; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/mentor/od-requests/${requestId}`, {
      method: 'GET',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || `Request ${requestId} not found.`,
      };
    }

    return data;
  } catch (err) {
    console.warn('apiGetMentorODRequestById network error:', err);
    return {
      success: false,
      error: 'Unable to reach backend server.',
    };
  }
}

/**
 * Approve an OD request as mentor via POST /api/mentor/od-requests/<id>/approve
 */
export async function apiApproveODRequestByMentor(
  requestId: string,
  remarks?: string,
  token?: string
): Promise<{ success: boolean; message?: string; request?: any; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/mentor/od-requests/${requestId}/approve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ remarks: remarks || '' }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to approve OD request.',
      };
    }

    return data;
  } catch (err) {
    console.warn('apiApproveODRequestByMentor network error:', err);
    return {
      success: false,
      error: 'Unable to reach backend server. Please verify Flask backend is running on port 5000.',
    };
  }
}

/**
 * Reject an OD request as mentor via POST /api/mentor/od-requests/<id>/reject
 */
export async function apiRejectODRequestByMentor(
  requestId: string,
  reason: string,
  token?: string
): Promise<{ success: boolean; message?: string; request?: any; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/mentor/od-requests/${requestId}/reject`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason: reason.trim() }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to reject OD request.',
      };
    }

    return data;
  } catch (err) {
    console.warn('apiRejectODRequestByMentor network error:', err);
    return {
      success: false,
      error: 'Unable to reach backend server. Please verify Flask backend is running on port 5000.',
    };
  }
}
/**
 * Retrieve all OD requests assigned to the logged-in Class Incharge via GET /api/class-incharge/od-requests
 */
export async function apiGetClassInchargeODRequests(
  token?: string
): Promise<{
  success: boolean;
  requests: any[];
  pending: any[];
  history: any[];
  approved: any[];
  rejected: any[];
  count?: number;
  pendingCount?: number;
  error?: string;
}> {
  try {
    const headers: Record<string, string> = {};
    const activeToken = resolveStoredToken(token);
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    const res = await fetch(`${API_BASE}/class-incharge/od-requests`, {
      method: 'GET',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        requests: [],
        pending: [],
        history: [],
        approved: [],
        rejected: [],
        error: data.error || 'Failed to fetch Class Incharge OD requests.',
      };
    }

    return {
      success: true,
      requests: data.requests || [],
      pending: data.pending || [],
      history: data.history || [],
      approved: data.approved || [],
      rejected: data.rejected || [],
      count: data.count || 0,
      pendingCount: data.pendingCount || 0,
    };
  } catch (err) {
    console.warn('apiGetClassInchargeODRequests network error:', err);
    return {
      success: false,
      requests: [],
      pending: [],
      history: [],
      approved: [],
      rejected: [],
      error: 'Unable to reach backend server.',
    };
  }
}

/**
 * Retrieve specific request details for Class Incharge review via GET /api/class-incharge/od-requests/<id>
 */
export async function apiGetClassInchargeODRequestById(
  requestId: string,
  token?: string
): Promise<{ success: boolean; request?: any; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/class-incharge/od-requests/${requestId}`, {
      method: 'GET',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || `Request ${requestId} not found.`,
      };
    }

    return data;
  } catch (err) {
    console.warn('apiGetClassInchargeODRequestById network error:', err);
    return {
      success: false,
      error: 'Unable to reach backend server.',
    };
  }
}

/**
 * Approve/endorse an OD request as Class Incharge via POST /api/class-incharge/od-requests/<id>/approve
 */
export async function apiApproveODRequestByClassIncharge(
  requestId: string,
  remarks?: string,
  token?: string
): Promise<{ success: boolean; message?: string; request?: any; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/class-incharge/od-requests/${requestId}/approve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ remarks: remarks || '' }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to approve OD request.',
      };
    }

    return data;
  } catch (err) {
    console.warn('apiApproveODRequestByClassIncharge network error:', err);
    return {
      success: false,
      error: 'Unable to reach backend server. Please verify Flask backend is running on port 5000.',
    };
  }
}

/**
 * Reject an OD request as Class Incharge via POST /api/class-incharge/od-requests/<id>/reject
 */
export async function apiRejectODRequestByClassIncharge(
  requestId: string,
  reason: string,
  token?: string
): Promise<{ success: boolean; message?: string; request?: any; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/class-incharge/od-requests/${requestId}/reject`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason: reason.trim() }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to reject OD request.',
      };
    }

    return data;
  } catch (err) {
    console.warn('apiRejectODRequestByClassIncharge network error:', err);
    return {
      success: false,
      error: 'Unable to reach backend server. Please verify Flask backend is running on port 5000.',
    };
  }
}

export interface HODExportFilters {
  eventName?: string;
  eventType?: string;
  status?: string;
  certificateStatus?: string;
  studentName?: string;
  studentRegisterNo?: string;
  year?: string;
  section?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
}

/**
 * Retrieve all OD requests assigned to the logged-in HOD via GET /api/hod/od-requests
 */
export async function apiGetHODODRequests(
  token?: string,
  filters?: HODExportFilters
): Promise<{
  success: boolean;
  requests: any[];
  all: any[];
  pending: any[];
  history: any[];
  approved: any[];
  rejected: any[];
  count?: number;
  pendingCount?: number;
  error?: string;
}> {
  try {
    const headers: Record<string, string> = {};
    const activeToken = resolveStoredToken(token);
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    const params = new URLSearchParams();
    if (filters) {
      if (filters.eventName) params.append('event_name', filters.eventName);
      if (filters.eventType && filters.eventType !== 'all') params.append('event_type', filters.eventType);
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.certificateStatus && filters.certificateStatus !== 'all') params.append('certificate_status', filters.certificateStatus);
      if (filters.studentName) params.append('student_name', filters.studentName);
      if (filters.studentRegisterNo) params.append('student_reg_no', filters.studentRegisterNo);
      if (filters.year && filters.year !== 'all') params.append('year', filters.year);
      if (filters.section && filters.section !== 'all') params.append('section', filters.section);
      if (filters.fromDate) params.append('from_date', filters.fromDate);
      if (filters.toDate) params.append('to_date', filters.toDate);
      if (filters.search) params.append('search', filters.search);
    }

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/hod/od-requests${queryStr}`, {
      method: 'GET',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        requests: [],
        all: [],
        pending: [],
        history: [],
        approved: [],
        rejected: [],
        error: data.error || 'Failed to fetch HOD OD requests.',
      };
    }

    return {
      success: true,
      requests: data.requests || [],
      all: data.all || data.requests || [],
      pending: data.pending || [],
      history: data.history || [],
      approved: data.approved || [],
      rejected: data.rejected || [],
      count: data.count || 0,
      pendingCount: data.pendingCount || 0,
    };
  } catch (err) {
    console.warn('apiGetHODODRequests network error:', err);
    return {
      success: false,
      requests: [],
      all: [],
      pending: [],
      history: [],
      approved: [],
      rejected: [],
      error: 'Unable to reach backend server.',
    };
  }
}

/**
 * Approve an OD request as HOD via POST /api/hod/od-requests/<id>/approve
 */
export async function apiApproveODRequestByHOD(
  requestId: string,
  remarks?: string,
  token?: string
): Promise<{ success: boolean; message?: string; request?: any; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/hod/od-requests/${requestId}/approve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ remarks: remarks || '' }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to approve OD request.',
      };
    }

    return data;
  } catch (err) {
    console.warn('apiApproveODRequestByHOD network error:', err);
    return {
      success: false,
      error: 'Unable to reach backend server. Please verify Flask backend is running on port 5000.',
    };
  }
}

/**
 * Reject an OD request as HOD via POST /api/hod/od-requests/<id>/reject
 */
export async function apiRejectODRequestByHOD(
  requestId: string,
  reason: string,
  token?: string
): Promise<{ success: boolean; message?: string; request?: any; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/hod/od-requests/${requestId}/reject`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason: reason.trim() }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to reject OD request.',
      };
    }

    return data;
  } catch (err) {
    console.warn('apiRejectODRequestByHOD network error:', err);
    return {
      success: false,
      error: 'Unable to reach backend server. Please verify Flask backend is running on port 5000.',
    };
  }
}

/**
 * Retrieve live department analytics for HOD via GET /api/hod/stats
 */
export async function apiGetHODStats(
  token?: string
): Promise<{ success: boolean; stats?: any; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    const activeToken = resolveStoredToken(token);
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    const res = await fetch(`${API_BASE}/hod/stats`, {
      method: 'GET',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to fetch HOD stats.' };
    }

    return data;
  } catch (err) {
    console.warn('apiGetHODStats network error:', err);
    return { success: false, error: 'Unable to reach backend server.' };
  }
}

/**
 * Download professionally styled Excel OD Report from backend GET /api/hod/od/export
 */
export async function apiExportHODODExcel(
  filters: HODExportFilters = {},
  token?: string
): Promise<{ success: boolean; filename?: string; error?: string }> {
  try {
    const params = new URLSearchParams();
    if (filters.eventName) params.append('event_name', filters.eventName);
    if (filters.eventType && filters.eventType !== 'all') params.append('event_type', filters.eventType);
    if (filters.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters.certificateStatus && filters.certificateStatus !== 'all') params.append('certificate_status', filters.certificateStatus);
    if (filters.studentName) params.append('student_name', filters.studentName);
    if (filters.studentRegisterNo) params.append('student_reg_no', filters.studentRegisterNo);
    if (filters.year && filters.year !== 'all') params.append('year', filters.year);
    if (filters.section && filters.section !== 'all') params.append('section', filters.section);
    if (filters.fromDate) params.append('from_date', filters.fromDate);
    if (filters.toDate) params.append('to_date', filters.toDate);
    if (filters.search) params.append('search', filters.search);

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/hod/od/export?${params.toString()}`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errJson.error || `Export failed with HTTP status ${res.status}`,
      };
    }

    // Extract filename from Content-Disposition header
    let filename = 'OD_Report.xlsx';
    const disposition = res.headers.get('Content-Disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, '');
      }
    }

    // Create a blob and trigger download in browser
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    return { success: true, filename };
  } catch (err: any) {
    console.error('Export Excel error:', err);
    return { success: false, error: err.message || 'Network error during Excel download.' };
  }
}

// ============================================================================
// ACADEMIC DATA UPLOAD & ATTENDANCE APIS (FOR CLASS INCHARGE)
// ============================================================================

export interface AcademicRowPreview {
  row_number: number;
  register_number: string;
  student_name: string;
  student_id: string | null;
  cat1: number | null;
  cat2: number | null;
  cat3: number | null;
  attendance: number | null;
  match_status: 'Matched' | 'Not Found';
  validation_status: 'Valid' | 'Error';
  errors?: string[];
  department?: string;
}

export interface AcademicUploadSummary {
  total_rows: number;
  matched_count: number;
  unmatched_count: number;
  invalid_count: number;
  can_confirm: boolean;
}

export interface AcademicValidationError {
  row: number;
  register_number: string;
  student_name: string;
  problem: string;
  correction: string;
}

export interface AcademicUploadPreviewResponse {
  success: boolean;
  preview_token?: string;
  file_name?: string;
  summary?: AcademicUploadSummary;
  rows?: AcademicRowPreview[];
  errors?: AcademicValidationError[];
  error?: string;
}

export interface AcademicConfirmResponse {
  success: boolean;
  message?: string;
  updated_count?: number;
  unmatched_count?: number;
  invalid_count?: number;
  history_id?: string;
  status?: string;
  error?: string;
}

export interface AcademicUploadHistoryItem {
  id: string;
  upload_date: string;
  uploaded_by_id: string;
  uploaded_by_name: string;
  file_name: string;
  total_rows: number;
  successful_updates: number;
  unmatched_count: number;
  invalid_count: number;
  status: 'Completed' | 'Completed with warnings' | 'Failed';
  details?: AcademicRowPreview[];
  created_at: string;
}

export interface AcademicStudentItem {
  id: string;
  studentId?: string;
  student_id?: string;
  registerNumber: string;
  register_number?: string;
  rollNo?: string;
  name?: string;
  studentName?: string;
  student_name?: string;
  department: string;
  year?: string;
  section?: string;
  avatar?: string;
  attendancePercent?: number;
  attendancePercentage?: number;
  attendance_percentage?: number;
  cat1Average?: number | null;
  cat1Marks?: number | null;
  cat1_marks?: number | null;
  cat2Average?: number | null;
  cat2Marks?: number | null;
  cat2_marks?: number | null;
  cat3Average?: number | null;
  cat3Marks?: number | null;
  cat3_marks?: number | null;
  has_academic_data?: boolean;
  hasAcademicData?: boolean;
  remainingODDays?: number;
  remaining_od_days?: number;
  isEligible?: boolean;
  is_eligible?: boolean;
  eligibility?: {
    eligible?: boolean;
    is_eligible?: boolean;
    max_od_allowed_days?: number;
    max_od_allowed_percent?: number;
    od_used_days?: number;
    consumed_od_days?: number;
    remaining_od_days?: number;
    rejection_reason?: string | null;
  };
  lastUpdated?: string;
  last_updated?: string;
  updatedBy?: string;
  updated_by?: string;
}

/**
 * Download sample Excel template (.xlsx) for Academic Data Upload
 */
export async function apiDownloadAcademicTemplate(token?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/class-incharge/academic/template`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || `Download failed with HTTP ${res.status}` };
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_academic_data_template.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to download Excel template.' };
  }
}

/**
 * Upload academic Excel spreadsheet and receive parsed preview with validation & student matching
 */
export async function apiUploadAcademicExcel(file: File, token?: string): Promise<AcademicUploadPreviewResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/class-incharge/academic/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || `Upload failed with HTTP ${res.status}`,
        summary: data.summary,
        rows: data.rows,
        errors: data.errors,
      };
    }

    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error during file upload.' };
  }
}

/**
 * Confirm previewed academic records and update database transactionally
 */
export async function apiConfirmAcademicUpdate(
  previewToken?: string,
  rows?: AcademicRowPreview[],
  token?: string
): Promise<AcademicConfirmResponse> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/class-incharge/academic/confirm`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        preview_token: previewToken,
        rows: rows,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || `Confirmation failed with HTTP ${res.status}`,
      };
    }

    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error during database update.' };
  }
}

/**
 * Retrieve past academic Excel upload audit history logs
 */
export async function apiGetAcademicUploadHistory(
  token?: string
): Promise<{ success: boolean; history?: AcademicUploadHistoryItem[]; count?: number; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/class-incharge/academic/upload-history`, {
      method: 'GET',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to fetch upload history.' };
    }

    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error fetching upload history.' };
  }
}

/**
 * Retrieve section students with latest academic marks & attendance
 */
export async function apiGetAcademicStudents(
  token?: string
): Promise<{ success: boolean; students?: AcademicStudentItem[]; count?: number; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/class-incharge/academic/students`, {
      method: 'GET',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to fetch academic students.' };
    }

    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error fetching students roster.' };
  }
}

/**
 * Retrieve currently authenticated student's academic record
 */
export async function apiGetMyAcademic(
  token?: string
): Promise<{
  success: boolean;
  academic?: any;
  attendance_percentage?: number;
  cat1_marks?: number | null;
  cat2_marks?: number | null;
  cat3_marks?: number | null;
  eligibility?: any;
  last_updated?: string;
  error?: string;
}> {
  try {
    const headers: Record<string, string> = {};
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/academic/me`, {
      method: 'GET',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to fetch academic details.' };
    }

    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error fetching academic details.' };
  }
}

/**
 * Retrieve academic details for a specific student (Faculty / Class Incharge / HOD)
 * GET /api/students/<student_id>/academic
 */
export async function apiGetStudentAcademic(
  studentId: string,
  token?: string
): Promise<{
  success: boolean;
  academic?: {
    id: string;
    student_id: string;
    register_number: string;
    student_name: string;
    department: string;
    year: string;
    section: string;
    cat1_marks: number | null;
    cat2_marks: number | null;
    cat3_marks: number | null;
    attendance_percentage: number;
    updated_by: string;
    updated_at: string;
    eligibility?: {
      attendance_percentage: number;
      is_eligible: boolean;
      max_od_allowed_percent: number;
      max_od_allowed_days: number;
      consumed_od_days: number;
      remaining_od_days: number;
    };
  };
  error?: string;
}> {
  try {
    const headers: Record<string, string> = {};
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/students/${encodeURIComponent(studentId)}/academic`, {
      method: 'GET',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to fetch student academic details.' };
    }

    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error fetching student academic details.' };
  }
}

/**
 * Upload student OD participation certificate.
 * Enforces:
 * - Block if event has not ended yet
 * - Block if 24-hour certificate window expired
 */
export async function apiUploadCertificate(
  requestId: string,
  file: File,
  token?: string
): Promise<{ success: boolean; message?: string; certificateUrl?: string; request?: any; error?: string }> {
  try {
    const formData = new FormData();
    formData.append('certificate', file);
    const headers: Record<string, string> = {};
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/od-requests/${encodeURIComponent(requestId)}/certificate`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to upload certificate.' };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error uploading certificate.' };
  }
}

/**
 * Verify or decline uploaded OD certificate by Mentor / Faculty.
 */
export async function apiVerifyCertificate(
  requestId: string,
  status: 'Verified' | 'Rejected',
  remarks?: string,
  token?: string
): Promise<{ success: boolean; message?: string; request?: any; error?: string }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/mentor/od-requests/${encodeURIComponent(requestId)}/verify-certificate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ status, remarks: remarks || '' }),
      credentials: 'include',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to verify certificate.' };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error verifying certificate.' };
  }
}

// ==========================================
// ADMIN DASHBOARD & SYSTEM MANAGEMENT APIS
// ==========================================

export async function apiGetAdminStats(token?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/admin/stats`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error fetching admin stats.' };
  }
}

export async function apiGetAdminStudents(
  params?: { search?: string; department?: string; year?: string; section?: string; status?: string },
  token?: string
) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const url = new URL(`${API_BASE}/admin/students`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v) url.searchParams.set(k, v);
      });
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch students.' };
  }
}

export async function apiCreateAdminStudent(payload: any, token?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/admin/students`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create student.' };
  }
}

export async function apiUpdateAdminStudent(studentId: string, payload: any, token?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/admin/students/${encodeURIComponent(studentId)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update student.' };
  }
}

export async function apiToggleUserStatus(userId: string, status: string, token?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status }),
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update user status.' };
  }
}

export async function apiGetAdminStudentDetails(studentId: string, token?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/admin/students/${encodeURIComponent(studentId)}/details`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch student details.' };
  }
}

export async function apiGetAdminFaculty(
  params?: { search?: string; role?: string; department?: string; status?: string },
  token?: string
) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const url = new URL(`${API_BASE}/admin/faculty`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v) url.searchParams.set(k, v);
      });
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch faculty.' };
  }
}

export async function apiCreateAdminFaculty(payload: any, token?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/admin/faculty`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create faculty.' };
  }
}

export async function apiUpdateAdminFaculty(facultyId: string, payload: any, token?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/admin/faculty/${encodeURIComponent(facultyId)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update faculty.' };
  }
}

export async function apiGetAdminODRequests(
  params?: {
    status?: string;
    stage?: string;
    department?: string;
    student_id?: string;
    from_date?: string;
    to_date?: string;
    certificate_status?: string;
    search?: string;
  },
  token?: string
) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const url = new URL(`${API_BASE}/admin/od-requests`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v) url.searchParams.set(k, v);
      });
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch OD requests.' };
  }
}

export async function apiGetAdminODRequestDetail(requestId: string, token?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/admin/od-requests/${encodeURIComponent(requestId)}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch OD request detail.' };
  }
}

export async function apiGetAdminAcademic(
  params?: { search?: string; department?: string; year?: string; section?: string },
  token?: string
) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const url = new URL(`${API_BASE}/admin/academic`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v) url.searchParams.set(k, v);
      });
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch academic records.' };
  }
}

export async function apiUpdateAdminStudentAcademic(studentId: string, payload: any, token?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/admin/academic/student/${encodeURIComponent(studentId)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update academic record.' };
  }
}

export async function apiUploadAdminAcademicExcel(file: File, token?: string) {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/admin/academic/upload`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to upload academic Excel file.' };
  }
}

export async function apiConfirmAdminAcademicExcel(records: any[], academicYear?: string, token?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/admin/academic/confirm`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ records, academic_year: academicYear }),
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to confirm academic records.' };
  }
}

export async function apiGetAdminCertificates(
  params?: { status?: string; search?: string; department?: string },
  token?: string
) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const url = new URL(`${API_BASE}/admin/certificates`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v) url.searchParams.set(k, v);
      });
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch certificates.' };
  }
}

export async function apiGetAdminReportsSummary(token?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/admin/reports/summary`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch reports summary.' };
  }
}

export function getAdminReportExportUrl(params?: Record<string, string>): string {
  const url = new URL(`${API_BASE}/admin/reports/export`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
  }
  return url.toString();
}

export async function apiDownloadAdminReportExcel(params?: Record<string, string>, token?: string) {
  try {
    const activeToken = resolveStoredToken(token);
    const url = new URL(`${API_BASE}/admin/reports/export`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v) url.searchParams.set(k, v);
      });
    }
    const headers: Record<string, string> = {};
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(url.toString(), {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error(`Export failed with HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `OD_System_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to export Excel report.' };
  }
}

export async function apiGetAdminAuditLogs(limit = 100, token?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/admin/audit-logs?limit=${limit}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch audit logs.' };
  }
}

export async function apiGetAdminSettings(token?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/admin/settings`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch settings.' };
  }
}

export async function apiUpdateAdminSettings(settings: any, token?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/admin/settings`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(settings),
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update settings.' };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// CLASS INCHARGE: STUDENT MANAGEMENT MODULE APIS
// ═════════════════════════════════════════════════════════════════════════════

export async function apiCIListStudents(params?: Record<string, any>, token?: string) {
  try {
    const headers: Record<string, string> = {};
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const url = new URL(`${API_BASE}/class-incharge/student-management/students`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          url.searchParams.set(k, String(v));
        }
      });
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false, error: 'Malformed response' }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch students roster.' };
  }
}

export async function apiCICreateStudent(payload: any, token?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/class-incharge/student-management/students`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false, error: 'Malformed response' }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create student account.' };
  }
}

export async function apiCIUpdateStudent(studentId: string, payload: any, token?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/class-incharge/student-management/students/${encodeURIComponent(studentId)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false, error: 'Malformed response' }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update student account.' };
  }
}

export async function apiCIToggleStudentStatus(studentId: string, status: 'ACTIVE' | 'DISABLED', token?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/class-incharge/student-management/students/${encodeURIComponent(studentId)}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status }),
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false, error: 'Malformed response' }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to change student status.' };
  }
}

export async function apiCIResetStudentPassword(studentId: string, password?: string, token?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/class-incharge/student-management/students/${encodeURIComponent(studentId)}/reset-password`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ password: password || 'password123' }),
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false, error: 'Malformed response' }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to reset student password.' };
  }
}

export async function apiCIGetStudentProfile(studentId: string, token?: string) {
  try {
    const headers: Record<string, string> = {};
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/class-incharge/student-management/students/${encodeURIComponent(studentId)}/profile`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false, error: 'Malformed response' }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch student profile.' };
  }
}

export async function apiCIPreviewStudentsUpload(file: File, token?: string) {
  try {
    const headers: Record<string, string> = {};
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/class-incharge/student-management/students/preview-upload`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false, error: 'Malformed response' }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to parse student Excel file.' };
  }
}

export async function apiCIConfirmStudentsUpload(rows: any[], filename?: string, token?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/class-incharge/student-management/students/confirm-upload`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rows, filename }),
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false, error: 'Malformed response' }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to confirm student import.' };
  }
}

export async function apiCIPreviewAttendanceUpload(file: File, token?: string) {
  try {
    const headers: Record<string, string> = {};
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/class-incharge/student-management/attendance/preview-upload`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false, error: 'Malformed response' }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to parse attendance Excel file.' };
  }
}

export async function apiCIConfirmAttendanceUpload(rows: any[], filename?: string, week_date?: string, token?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/class-incharge/student-management/attendance/confirm-upload`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rows, filename, week_date }),
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false, error: 'Malformed response' }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update attendance.' };
  }
}

export async function apiCIPreviewMarksUpload(file: File, token?: string) {
  try {
    const headers: Record<string, string> = {};
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/class-incharge/student-management/marks/preview-upload`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false, error: 'Malformed response' }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to parse marks Excel file.' };
  }
}

export async function apiCIConfirmMarksUpload(rows: any[], filename?: string, token?: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/class-incharge/student-management/marks/confirm-upload`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rows, filename }),
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false, error: 'Malformed response' }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update student marks.' };
  }
}

export async function apiCIGetHistory(historyType: 'students' | 'attendance' | 'marks', limit = 50, token?: string) {
  try {
    const headers: Record<string, string> = {};
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/class-incharge/student-management/history/${historyType}?limit=${limit}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    return await res.json().catch(() => ({ success: false, error: 'Malformed response' }));
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch upload history.' };
  }
}

export function apiCIDownloadTemplate(templateType: 'students' | 'attendance' | 'marks', token?: string) {
  const activeToken = resolveStoredToken(token);
  const url = `${API_BASE}/class-incharge/student-management/templates/${templateType}`;
  // Use fetch to handle authorization and trigger blob download
  fetch(url, {
    method: 'GET',
    headers: activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {},
    credentials: 'include'
  })
    .then(async (res) => {
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const filenameMap: Record<string, string> = {
        students: 'student_accounts_template.xlsx',
        attendance: 'weekly_attendance_template.xlsx',
        marks: 'student_cat_marks_template.xlsx'
      };
      const downloadName = filenameMap[templateType] || `${templateType}_template.xlsx`;
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    })
    .catch((err) => {
      console.error('Template download error:', err);
      window.open(url, '_blank');
    });
}

export async function apiCIExportFailedReport(failed_rows: any[], upload_type = 'Upload', token?: string) {
  try {
    const activeToken = resolveStoredToken(token);
    const res = await fetch(`${API_BASE}/class-incharge/student-management/export-failed-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {})
      },
      body: JSON.stringify({ failed_rows, upload_type }),
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to generate export file');
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `failed_records_${upload_type.toLowerCase()}_report.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to download failed rows report.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Student & Faculty Bulk Upload APIs
// ─────────────────────────────────────────────────────────────────────────────

export interface BulkUploadRowPreview {
  row_number: number;
  roll_number?: string;
  faculty_id?: string;
  name: string;
  username: string;
  email: string;
  department: string;
  section?: string;
  year?: string;
  semester?: string;
  designation?: string;
  role?: string;
  has_custom_password: boolean;
  password_preview: string;
  validation_status: 'VALID' | 'INVALID' | 'DUPLICATE';
  errors: string[];
}

export interface BulkUploadSummary {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
}

export interface BulkValidationError {
  row: number;
  identifier: string;
  name: string;
  email: string;
  reason: string;
}

export interface BulkUploadPreviewResponse {
  success: boolean;
  preview_token?: string;
  filename?: string;
  summary?: BulkUploadSummary;
  rows?: BulkUploadRowPreview[];
  errors?: BulkValidationError[];
  error?: string;
  message?: string;
}

export interface BulkUploadConfirmResponse {
  success: boolean;
  message?: string;
  imported_count?: number;
  skipped_count?: number;
  failed_count?: number;
  total_processed?: number;
  imported_rolls?: string[];
  imported_ids?: string[];
  error?: string;
}

export async function apiDownloadStudentBulkTemplate(format: 'xlsx' | 'csv' = 'xlsx', token?: string) {
  try {
    const activeToken = resolveStoredToken(token);
    const headers: Record<string, string> = {};
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/admin/students/template?format=${format}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || 'Failed to download student template.' };
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student_bulk_upload_template.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error downloading template.' };
  }
}

export async function apiUploadStudentBulkFile(file: File, token?: string): Promise<BulkUploadPreviewResponse> {
  try {
    const activeToken = resolveStoredToken(token);
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/admin/students/bulk-upload/preview`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });

    const data = await res.json().catch(() => ({ success: false, error: 'Failed to parse response.' }));
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to upload student spreadsheet.' };
  }
}

export async function apiConfirmStudentBulkUpload(previewToken: string, token?: string): Promise<BulkUploadConfirmResponse> {
  try {
    const activeToken = resolveStoredToken(token);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/admin/students/bulk-upload/confirm`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ preview_token: previewToken }),
      credentials: 'include',
    });

    const data = await res.json().catch(() => ({ success: false, error: 'Failed to parse response.' }));
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to confirm student import.' };
  }
}

export async function apiDownloadStudentBulkErrorReport(previewToken: string, format: 'xlsx' | 'csv' = 'xlsx', token?: string) {
  try {
    const activeToken = resolveStoredToken(token);
    const headers: Record<string, string> = {};
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/admin/students/bulk-upload/error-report/${encodeURIComponent(previewToken)}?format=${format}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || 'Failed to download error report.' };
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student_upload_errors.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error downloading error report.' };
  }
}

export async function apiDownloadFacultyBulkTemplate(format: 'xlsx' | 'csv' = 'xlsx', token?: string) {
  try {
    const activeToken = resolveStoredToken(token);
    const headers: Record<string, string> = {};
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/admin/faculty/template?format=${format}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || 'Failed to download faculty template.' };
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `faculty_bulk_upload_template.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error downloading template.' };
  }
}

export async function apiUploadFacultyBulkFile(file: File, token?: string): Promise<BulkUploadPreviewResponse> {
  try {
    const activeToken = resolveStoredToken(token);
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/admin/faculty/bulk-upload/preview`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });

    const data = await res.json().catch(() => ({ success: false, error: 'Failed to parse response.' }));
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to upload faculty spreadsheet.' };
  }
}

export async function apiConfirmFacultyBulkUpload(previewToken: string, token?: string): Promise<BulkUploadConfirmResponse> {
  try {
    const activeToken = resolveStoredToken(token);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/admin/faculty/bulk-upload/confirm`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ preview_token: previewToken }),
      credentials: 'include',
    });

    const data = await res.json().catch(() => ({ success: false, error: 'Failed to parse response.' }));
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to confirm faculty import.' };
  }
}

export async function apiDownloadFacultyBulkErrorReport(previewToken: string, format: 'xlsx' | 'csv' = 'xlsx', token?: string) {
  try {
    const activeToken = resolveStoredToken(token);
    const headers: Record<string, string> = {};
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/admin/faculty/bulk-upload/error-report/${encodeURIComponent(previewToken)}?format=${format}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || 'Failed to download error report.' };
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `faculty_upload_errors.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error downloading error report.' };
  }
}

