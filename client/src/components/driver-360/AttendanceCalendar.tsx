/**
 * DRIVER 360: ATTENDANCE CALENDAR
 * Auto-calculated daily and monthly attendance from operational data
 *
 * Shows:
 * - Daily calendar with PRESENT/IDLE/LEAVE/ABSENT status
 * - Monthly summary
 * - Booking evidence for PRESENT days
 */

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, AlertCircle, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DailyAttendance {
  date: string;
  status: 'PRESENT' | 'IDLE' | 'LEAVE' | 'ABSENT' | 'WEEKLY_OFF';
  bookingsServed?: number;
  bookingIds?: string[];
  leaveType?: string;
  reason?: string;
}

interface MonthlyAttendanceSummary {
  driverId: string;
  year: number;
  month: number;
  calendarDays: number;
  employmentDays: number;
  presentDays: number;
  idleDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  weeklyOffDays: number;
  absentDays: number;
  bookingsServed: number;
  dailyBreakdown: DailyAttendance[];
}

interface Props {
  driverId: string;
}

export function AttendanceCalendar({ driverId }: Props) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const { data: summary, isLoading, error } = useQuery({
    queryKey: [`/api/driver-attendance/monthly/${driverId}`, year, month],
    queryFn: async () => {
      const res = await fetch(
        `/api/driver-attendance/monthly/${driverId}?year=${year}&month=${month}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Failed to fetch attendance');
      const data = await res.json();
      return data.data as MonthlyAttendanceSummary;
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'IDLE':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'LEAVE':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'ABSENT':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'WEEKLY_OFF':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'IDLE':
        return <Clock className="h-4 w-4" />;
      case 'LEAVE':
        return <AlertTriangle className="h-4 w-4" />;
      case 'ABSENT':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Attendance Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">Loading attendance data...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Attendance Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-500 text-sm">Failed to load attendance data</div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  const monthName = new Date(year, month - 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="space-y-4">
      {/* Monthly Summary Card */}
      <Card className="border-2 border-blue-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <CardTitle>Attendance Summary</CardTitle>
            </div>
            <span className="text-sm text-gray-600">{monthName}</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Present Days */}
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="text-sm text-green-700 font-medium">Present Days</div>
              <div className="text-3xl font-bold text-green-900">{summary.presentDays}</div>
              <div className="text-xs text-green-600 mt-1">Bookings served</div>
            </div>

            {/* Idle Days */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-700 font-medium">Idle Days</div>
              <div className="text-3xl font-bold text-gray-900">{summary.idleDays}</div>
              <div className="text-xs text-gray-600 mt-1">No booking assigned</div>
            </div>

            {/* Leave Days */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-700 font-medium">Leave Days</div>
              <div className="text-3xl font-bold text-blue-900">
                {summary.paidLeaveDays + summary.unpaidLeaveDays}
              </div>
              <div className="text-xs text-blue-600 mt-1">Paid + Unpaid</div>
            </div>

            {/* Absent Days */}
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="text-sm text-red-700 font-medium">Absent Days</div>
              <div className="text-3xl font-bold text-red-900">{summary.absentDays}</div>
              <div className="text-xs text-red-600 mt-1">Explicitly marked</div>
            </div>
          </div>

          {/* Additional Stats */}
          <div className="mt-6 pt-6 border-t grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-600 font-medium">Employment Days</div>
              <div className="text-xl font-bold text-gray-900">{summary.employmentDays}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600 font-medium">Bookings Served</div>
              <div className="text-xl font-bold text-blue-900">{summary.bookingsServed}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600 font-medium">Weekly Off</div>
              <div className="text-xl font-bold text-purple-900">{summary.weeklyOffDays}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Daily Breakdown</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrevMonth}>
                ← Prev
              </Button>
              <span className="text-sm font-medium min-w-40 text-center">{monthName}</span>
              <Button variant="outline" size="sm" onClick={handleNextMonth}>
                Next →
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 mb-4">
            {/* Header row */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-semibold text-gray-600">
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {summary.dailyBreakdown.map((attendance, idx) => (
              <div
                key={idx}
                className={`p-2 rounded-lg border text-center text-xs ${getStatusColor(attendance.status)}`}
                title={`${attendance.date}: ${attendance.reason || attendance.status}`}
              >
                <div className="flex items-center justify-center mb-1">
                  {getStatusIcon(attendance.status)}
                </div>
                <div className="font-medium">
                  {new Date(attendance.date).getDate()}
                </div>
                <div className="text-xs opacity-75">
                  {attendance.status === 'PRESENT' && attendance.bookingsServed && `${attendance.bookingsServed}B`}
                  {attendance.status === 'LEAVE' && 'L'}
                  {attendance.status === 'ABSENT' && 'A'}
                  {attendance.status === 'IDLE' && 'I'}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-6 pt-6 border-t grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-100 border border-green-300"></div>
              <span>Present</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-100 border border-gray-300"></div>
              <span>Idle</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-100 border border-blue-300"></div>
              <span>Leave</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-100 border border-red-300"></div>
              <span>Absent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-purple-100 border border-purple-300"></div>
              <span>Weekly Off</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AttendanceCalendar;
