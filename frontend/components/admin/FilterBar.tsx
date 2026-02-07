'use client';

import { useState } from 'react';
import { CalendarIcon, RefreshCw, Download, X } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  sessions: Array<{ session_id: string; name: string }>;
  users: Array<{ user_id: string; name: string; email: string }>;
  onFilterChange: (filters: {
    date_from?: string;
    date_to?: string;
    session_id?: string;
    user_id?: string;
  }) => void;
  onRefresh: () => void;
  onExport: () => void;
}

export function FilterBar({
  sessions,
  users,
  onFilterChange,
  onRefresh,
  onExport,
}: FilterBarProps) {
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedSession, setSelectedSession] = useState<string | undefined>(undefined);
  const [selectedUser, setSelectedUser] = useState<string | undefined>(undefined);
  const [quickFilter, setQuickFilter] = useState<'24h' | '7d' | '30d' | 'custom'>('30d');

  // Handle quick filter buttons
  const handleQuickFilter = (filter: '24h' | '7d' | '30d' | 'custom') => {
    setQuickFilter(filter);

    const now = new Date();
    let fromDate: Date | undefined;

    if (filter === '24h') {
      fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      setDateFrom(fromDate);
      setDateTo(now);
      applyFilters(fromDate, now, selectedSession, selectedUser);
    } else if (filter === '7d') {
      fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setDateFrom(fromDate);
      setDateTo(now);
      applyFilters(fromDate, now, selectedSession, selectedUser);
    } else if (filter === '30d') {
      fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setDateFrom(fromDate);
      setDateTo(now);
      applyFilters(fromDate, now, selectedSession, selectedUser);
    }
    // For 'custom', do nothing - user will set dates manually
  };

  // Apply filters
  const applyFilters = (
    from?: Date,
    to?: Date,
    sessionId?: string,
    userId?: string
  ) => {
    const filters: any = {};

    if (from) {
      filters.date_from = from.toISOString().split('T')[0];
    }
    if (to) {
      filters.date_to = to.toISOString().split('T')[0];
    }
    if (sessionId && sessionId !== 'all') {
      filters.session_id = sessionId;
    }
    if (userId && userId !== 'all') {
      filters.user_id = userId;
    }

    onFilterChange(filters);
  };

  // Handle date changes
  const handleDateFromChange = (date: Date | undefined) => {
    setDateFrom(date);
    setQuickFilter('custom');
    applyFilters(date, dateTo, selectedSession, selectedUser);
  };

  const handleDateToChange = (date: Date | undefined) => {
    setDateTo(date);
    setQuickFilter('custom');
    applyFilters(dateFrom, date, selectedSession, selectedUser);
  };

  // Handle session change
  const handleSessionChange = (sessionId: string) => {
    const newSession = sessionId === 'all' ? undefined : sessionId;
    setSelectedSession(newSession);
    applyFilters(dateFrom, dateTo, newSession, selectedUser);
  };

  // Handle user change
  const handleUserChange = (userId: string) => {
    const newUser = userId === 'all' ? undefined : userId;
    setSelectedUser(newUser);
    applyFilters(dateFrom, dateTo, selectedSession, newUser);
  };

  // Clear all filters
  const handleClearFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setSelectedSession(undefined);
    setSelectedUser(undefined);
    setQuickFilter('30d');

    // Apply default 30d filter
    const now = new Date();
    const fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    applyFilters(fromDate, now, undefined, undefined);
  };

  return (
    <div className="space-y-4">
      {/* Quick Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Period:</span>
        <Button
          variant={quickFilter === '24h' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleQuickFilter('24h')}
        >
          Last 24h
        </Button>
        <Button
          variant={quickFilter === '7d' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleQuickFilter('7d')}
        >
          Last 7d
        </Button>
        <Button
          variant={quickFilter === '30d' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleQuickFilter('30d')}
        >
          Last 30d
        </Button>
        <Button
          variant={quickFilter === 'custom' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleQuickFilter('custom')}
        >
          Custom
        </Button>
      </div>

      {/* Advanced Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Date From */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">From:</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'w-[160px] justify-start text-left font-normal',
                  !dateFrom && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, 'MMM dd, yyyy') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={handleDateFromChange}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Date To */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">To:</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'w-[160px] justify-start text-left font-normal',
                  !dateTo && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, 'MMM dd, yyyy') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={handleDateToChange}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Session Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Session:</span>
          <Select value={selectedSession || 'all'} onValueChange={handleSessionChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All sessions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sessions</SelectItem>
              {sessions.map((session) => (
                <SelectItem key={session.session_id} value={session.session_id}>
                  {session.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* User Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">User:</span>
          <Select value={selectedUser || 'all'} onValueChange={handleUserChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.user_id} value={user.user_id}>
                  {user.name} ({user.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Clear Filters */}
        <Button variant="ghost" size="sm" onClick={handleClearFilters}>
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Refresh Button */}
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>

        {/* Export Button */}
        <Button variant="default" size="sm" onClick={onExport}>
          <Download className="h-4 w-4 mr-1" />
          Export CSV
        </Button>
      </div>
    </div>
  );
}
