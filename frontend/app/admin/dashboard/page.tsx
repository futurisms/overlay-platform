'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { CostSummaryCards } from '@/components/admin/CostSummaryCards';
import { FilterBar } from '@/components/admin/FilterBar';
import { SubmissionsTable } from '@/components/admin/SubmissionsTable';
import { toast } from 'sonner';
import { getCurrentUser } from '@/lib/auth';

interface AnalyticsData {
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
}

interface SubmissionsData {
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
}

export default function AdminDashboardPage() {
  const router = useRouter();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [submissionsData, setSubmissionsData] = useState<SubmissionsData | null>(null);

  // Filter state
  const [filters, setFilters] = useState<{
    date_from?: string;
    date_to?: string;
    session_id?: string;
    user_id?: string;
    sort_by?: 'cost' | 'date' | 'tokens';
    sort_order?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }>({
    sort_by: 'date',
    sort_order: 'desc',
    limit: 50,
    offset: 0,
  });

  // Sessions and users for filter dropdowns
  const [sessions, setSessions] = useState<Array<{ session_id: string; name: string }>>([]);
  const [users, setUsers] = useState<Array<{ user_id: string; name: string; email: string }>>([]);

  // Check admin permission using same pattern as regular dashboard
  useEffect(() => {
    // Check authentication
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push('/login');
      return;
    }

    // Check if user is admin (has system_admin group)
    const userIsAdmin = currentUser.groups?.includes('system_admin') || false;
    if (!userIsAdmin) {
      toast.error('Access Denied', {
        description: 'This page is only accessible to system administrators',
      });
      router.push('/dashboard');
      return;
    }

    setIsAdmin(true);
  }, [router]);

  // Fetch analytics data
  const fetchAnalytics = async (period: '7d' | '30d' | '90d' | 'all' = '30d') => {
    try {
      const response = await apiClient.getAdminAnalytics(period);
      if (response.data) {
        setAnalyticsData(response.data);
      } else {
        toast.error('Failed to load analytics', {
          description: response.error,
        });
      }
    } catch (error) {
      console.error('Analytics fetch error:', error);
      toast.error('Failed to load analytics data');
    }
  };

  // Fetch submissions data
  const fetchSubmissions = async (currentFilters = filters) => {
    try {
      const response = await apiClient.getAdminSubmissions(currentFilters);
      if (response.data) {
        setSubmissionsData(response.data);

        // Extract unique sessions and users for filter dropdowns
        const uniqueSessions = new Map<string, string>();
        const uniqueUsers = new Map<string, { name: string; email: string }>();

        response.data.submissions.forEach((submission) => {
          uniqueSessions.set(submission.session_id || 'N/A', submission.session_name || 'Unknown Session');
          uniqueUsers.set(submission.submitted_by, {
            name: submission.submitted_by_name || 'Unknown User',
            email: submission.submitted_by_email || 'N/A',
          });
        });

        setSessions(
          Array.from(uniqueSessions.entries()).map(([id, name]) => ({
            session_id: id,
            name,
          }))
        );

        setUsers(
          Array.from(uniqueUsers.entries()).map(([id, { name, email }]) => ({
            user_id: id,
            name,
            email,
          }))
        );
      } else {
        toast.error('Failed to load submissions', {
          description: response.error,
        });
      }
    } catch (error) {
      console.error('Submissions fetch error:', error);
      toast.error('Failed to load submissions data');
    }
  };

  // Initial load
  useEffect(() => {
    if (isAdmin) {
      const loadData = async () => {
        setIsLoading(true);
        await Promise.all([fetchAnalytics('30d'), fetchSubmissions()]);
        setIsLoading(false);
      };
      loadData();
    }
  }, [isAdmin]);

  // Handle filter changes
  const handleFilterChange = (newFilters: {
    date_from?: string;
    date_to?: string;
    session_id?: string;
    user_id?: string;
  }) => {
    const updatedFilters = {
      ...filters,
      ...newFilters,
      offset: 0, // Reset to first page
    };
    setFilters(updatedFilters);
    fetchSubmissions(updatedFilters);
  };

  // Handle sort changes
  const handleSort = (sortBy: 'cost' | 'date' | 'tokens', sortOrder: 'asc' | 'desc') => {
    const updatedFilters = {
      ...filters,
      sort_by: sortBy,
      sort_order: sortOrder,
      offset: 0, // Reset to first page
    };
    setFilters(updatedFilters);
    fetchSubmissions(updatedFilters);
  };

  // Handle pagination
  const handlePageChange = (newOffset: number) => {
    const updatedFilters = {
      ...filters,
      offset: newOffset,
    };
    setFilters(updatedFilters);
    fetchSubmissions(updatedFilters);
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchAnalytics('30d');
    fetchSubmissions();
    toast.success('Dashboard data has been refreshed');
  };

  // Handle CSV export
  const handleExport = () => {
    if (!submissionsData) return;

    // Convert submissions to CSV
    const headers = [
      'Document Name',
      'User Name',
      'User Email',
      'Session Name',
      'Overlay Name',
      'Submitted At',
      'Status',
      'Total Tokens',
      'Input Tokens',
      'Output Tokens',
      'Agent Calls',
      'Agents Used',
      'Cost (USD)',
    ];

    const rows = submissionsData.submissions.map((s) => [
      s.document_name,
      s.submitted_by_name ?? 'Unknown User',
      s.submitted_by_email ?? 'No email',
      s.session_name ?? 'Unknown Session',
      s.overlay_name ?? 'No overlay',
      s.submitted_at,
      s.ai_analysis_status,
      s.total_tokens,
      s.input_tokens,
      s.output_tokens,
      s.agent_calls,
      s.agents_used ? s.agents_used.join('; ') : 'No agents',
      parseFloat(s.cost_usd || '0').toFixed(4),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `submissions_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Submissions data exported to CSV');
  };

  // Loading state
  if (!isAdmin || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Monitor all submissions, token usage, and costs across the platform
          </p>
        </div>
      </div>

      {/* Cost Summary Cards */}
      {analyticsData && <CostSummaryCards summary={analyticsData.summary} />}

      {/* Filter Bar */}
      <FilterBar
        sessions={sessions}
        users={users}
        onFilterChange={handleFilterChange}
        onRefresh={handleRefresh}
        onExport={handleExport}
      />

      {/* Submissions Table */}
      {submissionsData && (
        <SubmissionsTable
          submissions={submissionsData.submissions}
          total={submissionsData.total}
          limit={submissionsData.limit}
          offset={submissionsData.offset}
          onSort={handleSort}
          onPageChange={handlePageChange}
          currentSortBy={filters.sort_by}
          currentSortOrder={filters.sort_order}
        />
      )}
    </div>
  );
}
