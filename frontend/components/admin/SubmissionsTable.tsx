'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Submission {
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
  total_tokens: number; // Protected by COALESCE in SQL
  input_tokens: number; // Protected by COALESCE in SQL
  output_tokens: number; // Protected by COALESCE in SQL
  agent_calls: number; // Protected by COALESCE in SQL
  agents_used: string[] | null; // NULL if no token usage yet
  cost_usd: string; // PostgreSQL NUMERIC returns as string
}

// Defensive helper functions for safe data access
function formatCost(cost: string | number | null | undefined): string {
  const numericCost = typeof cost === 'string' ? parseFloat(cost) : (cost ?? 0);
  return numericCost.toFixed(4);
}

function getCostNumeric(cost: string | number | null | undefined): number {
  return typeof cost === 'string' ? parseFloat(cost) : (cost ?? 0);
}

function getAgentsList(agents: string[] | null | undefined): string[] {
  return agents ?? [];
}

function safeString(value: string | null | undefined, fallback: string = 'N/A'): string {
  return value ?? fallback;
}

interface SubmissionsTableProps {
  submissions: Submission[];
  total: number;
  limit: number;
  offset: number;
  onSort: (sortBy: 'cost' | 'date' | 'tokens', sortOrder: 'asc' | 'desc') => void;
  onPageChange: (newOffset: number) => void;
  currentSortBy?: 'cost' | 'date' | 'tokens';
  currentSortOrder?: 'asc' | 'desc';
}

export function SubmissionsTable({
  submissions,
  total,
  limit,
  offset,
  onSort,
  onPageChange,
  currentSortBy = 'date',
  currentSortOrder = 'desc',
}: SubmissionsTableProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // Color-coding for costs (uses defensive helper)
  const getCostColor = (cost: string | number | null | undefined) => {
    const numericCost = getCostNumeric(cost);
    if (numericCost < 0.10) return 'text-green-600';
    if (numericCost <= 0.20) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Status badge variant
  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'in_progress':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  // Handle sort click
  const handleSortClick = (sortBy: 'cost' | 'date' | 'tokens') => {
    if (currentSortBy === sortBy) {
      // Toggle sort order
      onSort(sortBy, currentSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New sort column, default to desc
      onSort(sortBy, 'desc');
    }
  };

  // Pagination
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = offset + limit < total;
  const hasPrevPage = offset > 0;

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Session</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSortClick('date')}
              >
                <div className="flex items-center gap-1">
                  Date
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSortClick('tokens')}
              >
                <div className="flex items-center gap-1">
                  Tokens
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSortClick('cost')}
              >
                <div className="flex items-center gap-1">
                  Cost
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No submissions found
                </TableCell>
              </TableRow>
            ) : (
              submissions.map((submission) => (
                <TableRow
                  key={submission.submission_id}
                  className="cursor-pointer hover:bg-muted/50"
                  onMouseEnter={() => setHoveredRow(submission.submission_id)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <TableCell>
                    <Link
                      href={`/submission/${submission.submission_id}`}
                      className="hover:underline font-medium"
                    >
                      {submission.document_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">{safeString(submission.submitted_by_name, 'Unknown User')}</span>
                      <span className="text-xs text-muted-foreground">
                        {safeString(submission.submitted_by_email, 'No email')}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">{safeString(submission.session_name, 'Unknown Session')}</span>
                      <span className="text-xs text-muted-foreground">
                        {safeString(submission.overlay_name, 'No overlay')}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(submission.submitted_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(submission.ai_analysis_status)}>
                      {submission.ai_analysis_status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="relative">
                    <div className="font-mono text-sm">
                      {submission.total_tokens.toLocaleString()}
                    </div>
                    {hoveredRow === submission.submission_id && getAgentsList(submission.agents_used).length > 0 && (
                      <div className="absolute z-10 mt-1 p-2 bg-popover border rounded-md shadow-md text-xs space-y-1 min-w-[200px]">
                        <div className="font-semibold mb-1">Agent Breakdown:</div>
                        {getAgentsList(submission.agents_used).map((agent) => (
                          <div key={agent} className="text-muted-foreground">
                            • {agent}
                          </div>
                        ))}
                        <div className="border-t pt-1 mt-1">
                          <div className="text-muted-foreground">
                            {submission.agent_calls} agent calls
                          </div>
                          <div className="text-muted-foreground">
                            {submission.input_tokens.toLocaleString()} input
                          </div>
                          <div className="text-muted-foreground">
                            {submission.output_tokens.toLocaleString()} output
                          </div>
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`font-mono font-semibold ${getCostColor(submission.cost_usd)}`}>
                      ${formatCost(submission.cost_usd)}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {offset + 1}-{Math.min(offset + limit, total)} of {total.toLocaleString()} submissions
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(offset - limit)}
              disabled={!hasPrevPage}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(offset + limit)}
              disabled={!hasNextPage}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
