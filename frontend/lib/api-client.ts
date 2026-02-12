/**
 * API Client for Overlay Platform Backend
 * Base URL: https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Load token from localStorage if available
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = this.token;
    }

    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      return {
        data: response.ok ? data : undefined,
        error: response.ok ? undefined : (data.error || data.message || 'Request failed'),
        status: response.status,
      };
    } catch (error) {
      console.error('API request error:', error);
      return {
        error: error instanceof Error ? error.message : 'Network error',
        status: 0,
      };
    }
  }

  // Sessions endpoints
  async getSessions() {
    return this.request<{ sessions: any[]; total: number }>('/sessions');
  }

  async getAvailableSessions() {
    return this.request<{ sessions: any[] }>('/sessions/available');
  }

  async getSession(sessionId: string) {
    return this.request<any>(`/sessions/${sessionId}`);
  }

  async getSessionSubmissions(sessionId: string) {
    return this.request<{ submissions: any[] }>(`/sessions/${sessionId}/submissions`);
  }

  async getSessionReport(sessionId: string) {
    return this.request<any>(`/sessions/${sessionId}/report`);
  }

  async getSessionExport(sessionId: string) {
    return this.request<string>(`/sessions/${sessionId}/export`);
  }

  async createSession(data: {
    name: string;
    description?: string;
    overlay_id: string;
    start_date: string;
    end_date: string;
    status?: string;
    project_name?: string;
  }) {
    return this.request<any>('/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteSession(sessionId: string) {
    return this.request<any>(`/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }

  async revokeSessionAccess(sessionId: string, userId: string) {
    return this.request<{ success: boolean; message: string }>(`/sessions/${sessionId}/participants/${userId}`, {
      method: 'DELETE',
    });
  }

  async updateSession(sessionId: string, data: {
    name?: string;
    description?: string;
    status?: string;
    project_name?: string;
  }) {
    return this.request<any>(`/sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Submissions endpoints
  async getSubmissions() {
    return this.request<{ submissions: any[]; total: number }>('/submissions');
  }

  async getSubmission(submissionId: string) {
    return this.request<any>(`/submissions/${submissionId}`);
  }

  async createSubmission(data: {
    session_id: string;
    overlay_id: string;
    document_name: string;
    document_content: string;
    file_size?: number;
    is_pasted_text?: boolean;
    appendices?: Array<{
      file_name: string;
      file_content: string;
      file_size: number;
      upload_order: number;
    }>;
  }) {
    return this.request<any>('/submissions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSubmissionFeedback(submissionId: string) {
    return this.request<any>(`/submissions/${submissionId}/feedback`);
  }

  async getSubmissionDownload(submissionId: string) {
    return this.request<any>(`/submissions/${submissionId}/download`);
  }

  async downloadSubmissionFile(submissionId: string) {
    return this.request<{ download_url: string; file_name: string; expires_in: number }>(`/submissions/${submissionId}/download-file`);
  }

  async downloadAppendix(submissionId: string, appendixOrder: number) {
    return this.request<{ download_url: string; file_name: string; expires_in: number }>(`/submissions/${submissionId}/download-appendix/${appendixOrder}`);
  }

  async getSubmissionContent(submissionId: string) {
    return this.request<{
      submission_id: string;
      main_document: { name: string; text: string };
      appendices: Array<{ fileName: string; text: string; uploadOrder: number }>;
    }>(`/submissions/${submissionId}/content`);
  }

  async getSubmissionAnnotation(submissionId: string) {
    return this.request<{
      annotation_id: string;
      submission_id: string;
      annotated_json: {
        sections: Array<{
          type: 'text' | 'annotations';
          content?: string;
          items?: Array<{
            priority: 'high' | 'medium' | 'low';
            type: 'recommendation' | 'weakness' | 'strength';
            text: string;
          }>;
        }>;
      };
      model_used: string;
      input_tokens: number;
      output_tokens: number;
      generation_time_ms: number;
      created_at: string;
      cached: boolean;
    }>(`/submissions/${submissionId}/annotate`);
  }

  async deleteSubmission(submissionId: string) {
    return this.request<{ message: string }>(`/submissions/${submissionId}`, {
      method: 'DELETE',
    });
  }

  // Answers endpoints
  async getAnswers(submissionId: string) {
    return this.request<{ questions: any[]; total: number }>(`/submissions/${submissionId}/answers`);
  }

  async submitAnswer(submissionId: string, data: {
    question_id: string;
    answer_text: string;
  }) {
    return this.request<any>(`/submissions/${submissionId}/answers`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Organizations endpoints
  async getOrganizations() {
    return this.request<{ organizations: any[]; total: number }>('/organizations');
  }

  // Overlays endpoints
  async getOverlays() {
    return this.request<{ overlays: any[]; total: number }>('/overlays');
  }

  async getOverlay(overlayId: string) {
    return this.request<any>(`/overlays/${overlayId}`);
  }

  async createOverlay(data: {
    name: string;
    description?: string;
    document_type?: string | null;
    document_purpose?: string | null;
    when_used?: string | null;
    process_context?: string | null;
    target_audience?: string | null;
    is_active?: boolean;
    criteria?: any[];
  }) {
    return this.request<any>('/overlays', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateOverlay(overlayId: string, data: {
    name?: string;
    description?: string;
    document_type?: string | null;
    document_purpose?: string | null;
    when_used?: string | null;
    process_context?: string | null;
    target_audience?: string | null;
    is_active?: boolean;
    criteria?: any[];
  }) {
    return this.request<any>(`/overlays/${overlayId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteOverlay(overlayId: string) {
    return this.request<any>(`/overlays/${overlayId}`, {
      method: 'DELETE',
    });
  }

  // LLM Config endpoints (admin only)
  async getLLMConfigs() {
    return this.request<{ configs: any[]; total: number }>('/llm-config');
  }

  async getLLMConfig(agentName: string) {
    return this.request<any>(`/llm-config/${agentName}`);
  }

  async updateLLMConfig(agentName: string, data: any) {
    return this.request<any>(`/llm-config/${agentName}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Admin endpoints (system_admin only)
  async getAdminSubmissions(params?: {
    date_from?: string;
    date_to?: string;
    session_id?: string;
    user_id?: string;
    sort_by?: 'cost' | 'date' | 'tokens';
    sort_order?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      if (params.date_from) queryParams.append('date_from', params.date_from);
      if (params.date_to) queryParams.append('date_to', params.date_to);
      if (params.session_id) queryParams.append('session_id', params.session_id);
      if (params.user_id) queryParams.append('user_id', params.user_id);
      if (params.sort_by) queryParams.append('sort_by', params.sort_by);
      if (params.sort_order) queryParams.append('sort_order', params.sort_order);
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.offset) queryParams.append('offset', params.offset.toString());
    }

    const queryString = queryParams.toString();
    const endpoint = `/admin/submissions${queryString ? `?${queryString}` : ''}`;

    return this.request<{
      submissions: Array<{
        submission_id: string;
        document_name: string;
        submitted_by: string;
        submitted_by_name: string | null; // NULL if user deleted
        submitted_by_email: string | null; // NULL if user deleted
        session_id: string;
        session_name: string | null; // NULL if session deleted
        overlay_name: string | null; // NULL if overlay deleted
        submitted_at: string;
        ai_analysis_status: string;
        total_tokens: number;
        input_tokens: number;
        output_tokens: number;
        agent_calls: number;
        agents_used: string[] | null; // NULL if no token usage yet
        cost_usd: string; // PostgreSQL NUMERIC returns as string
      }>;
      total: number;
      limit: number;
      offset: number;
      summary: {
        total_submissions: number;
        total_tokens: number;
        total_cost_usd: string; // PostgreSQL NUMERIC returns as string
        avg_tokens_per_submission: number;
        avg_cost_per_submission: string; // PostgreSQL NUMERIC returns as string
      };
    }>(endpoint);
  }

  async getAdminAnalytics(period: '7d' | '30d' | '90d' | 'all' = '30d') {
    return this.request<{
      summary: {
        total_submissions: number;
        total_cost_usd: string;
        total_tokens: number;
        avg_cost_per_submission: string;
        completed_submissions: number;
        pending_submissions: number;
      };
      daily_stats: Array<{
        date: string;
        submissions: number;
        total_tokens: number;
        cost_usd: string; // PostgreSQL NUMERIC returns as string
      }>;
      top_users: Array<{
        user_id: string;
        email: string;
        name: string;
        submissions: number;
        total_cost_usd: string; // PostgreSQL NUMERIC returns as string
      }>;
      top_sessions: Array<{
        session_id: string;
        name: string;
        submissions: number;
        total_cost_usd: string; // PostgreSQL NUMERIC returns as string
      }>;
      agent_breakdown: Array<{
        agent_name: string;
        calls: number;
        avg_tokens: number;
        total_cost_usd: string; // PostgreSQL NUMERIC returns as string
      }>;
    }>(`/admin/analytics?period=${period}`);
  }

  // Notes endpoints
  async createNote(title: string, content: string, sessionId?: string) {
    const body: any = { title, content };
    if (sessionId) body.session_id = sessionId;

    return this.request<{ note_id: string; created_at: string }>('/notes', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getNotes() {
    return this.request<{ notes: Array<{
      note_id: string;
      title: string;
      content_preview: string;
      created_at: string;
      session_id?: string;
    }>; total: number }>('/notes');
  }

  async getNote(noteId: string) {
    return this.request<{
      note_id: string;
      title: string;
      content: string;
      ai_summary?: string;
      created_at: string;
      updated_at: string;
      session_id?: string;
    }>(`/notes/${noteId}`);
  }

  async updateNote(noteId: string, data: { title?: string; content?: string; ai_summary?: string }) {
    return this.request<{ note_id: string; updated_at: string }>(`/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteNote(noteId: string) {
    return this.request<{ success: boolean; note_id: string }>(`/notes/${noteId}`, {
      method: 'DELETE',
    });
  }

  // Users endpoints
  async getCurrentUserInfo() {
    return this.request<{
      user: {
        user_id: string;
        email: string;
        name: string;
        role: string;
        created_at: string;
      };
    }>('/users/me');
  }

  // Invitations endpoints
  async createInvitation(sessionId: string, email: string) {
    return this.request<{
      message: string;
      invitation?: {
        invitation_id: string;
        email: string;
        token: string;
        session_id: string;
        expires_at: string;
        created_at: string;
      };
      inviteLink?: string;
      user?: {
        user_id: string;
        email: string;
        role: string;
      };
    }>(`/sessions/${sessionId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async getInvitation(token: string) {
    return this.request<{
      invitation: {
        email: string;
        session_name: string;
        invited_by_name: string;
        expires_at: string;
      };
    }>(`/invitations/${token}`);
  }

  async acceptInvitation(token: string, name: string, password: string) {
    // Split name into firstName and lastName for backend
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || nameParts[0] || ''; // If only one name, use it for both

    return this.request<{
      message: string;
      user: {
        user_id: string;
        email: string;
        name: string;
        role: string;
        created_at: string;
      };
    }>(`/invitations/${token}/accept`, {
      method: 'POST',
      body: JSON.stringify({ firstName, lastName, password }),
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
