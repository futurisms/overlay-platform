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

  async updateSession(sessionId: string, data: {
    name?: string;
    description?: string;
    status?: string;
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
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
