'use client';

import { FileText, DollarSign, TrendingUp, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CostSummaryCardsProps {
  summary: {
    total_submissions: number;
    total_cost_usd: string;
    total_tokens: number;
    avg_cost_per_submission: string;
    completed_submissions: number;
    pending_submissions: number;
  };
}

export function CostSummaryCards({ summary }: CostSummaryCardsProps) {
  // Parse average cost for color-coding
  const avgCost = parseFloat(summary.avg_cost_per_submission);

  // Color-coding: Green (<$0.10), Yellow ($0.10-$0.20), Red (>$0.20)
  const getAvgCostColor = () => {
    if (avgCost < 0.10) return 'text-green-600';
    if (avgCost <= 0.20) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAvgCostBgColor = () => {
    if (avgCost < 0.10) return 'bg-green-50';
    if (avgCost <= 0.20) return 'bg-yellow-50';
    return 'bg-red-50';
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Submissions Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.total_submissions.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {summary.completed_submissions} completed, {summary.pending_submissions} pending
          </p>
        </CardContent>
      </Card>

      {/* Total Cost Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${parseFloat(summary.total_cost_usd).toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Claude API usage costs
          </p>
        </CardContent>
      </Card>

      {/* Average Cost Per Submission Card (Color-coded) */}
      <Card className={getAvgCostBgColor()}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Cost/Submission</CardTitle>
          <TrendingUp className={`h-4 w-4 ${getAvgCostColor()}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getAvgCostColor()}`}>
            ${avgCost.toFixed(4)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {avgCost < 0.10 && '✓ Within budget'}
            {avgCost >= 0.10 && avgCost <= 0.20 && '⚠ Monitor usage'}
            {avgCost > 0.20 && '⚠ High cost alert'}
          </p>
        </CardContent>
      </Card>

      {/* Total Tokens Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
          <Zap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {summary.total_tokens.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Input + output tokens
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
