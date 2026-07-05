import { useAuth } from '@/contexts/AuthContext';
import StaffLayout from '@/components/layouts/StaffLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLeaveApplications } from '@/hooks/use-leave-applications';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Clock, Download, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState } from 'react';

import { generateLeaveHistoryReport, downloadWorkbook } from '@/lib/excel-report';
import { downloadTablePdf } from '@/lib/pdf-report';
import { formatAdminDesignation, formatCollegeUnit } from '@/lib/college-units';

const formatLeaveDuration = (app: any) => {
  if (app.leave_duration === 'half_day') {
    return app.half_day_period === 'second_half' ? 'Half Day — Second Half' : 'Half Day — First Half';
  }
  return 'Full Day';
};

export default function LeaveHistory() {
  const { profile, isPrincipal } = useAuth();
  const { applications, loading } = useLeaveApplications(profile?.id);
  const [filter, setFilter] = useState('all');

  const filteredApplications = applications.filter(app => {
    if (filter === 'all') return true;
    return app.status === filter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-600"><CheckCircle className="mr-1 h-3 w-3" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
    }
  };

  const downloadReport = () => {
    const filterLabel = filter === 'all' ? 'All Status' : filter.charAt(0).toUpperCase() + filter.slice(1);
    const rows = filteredApplications.map((app, idx) => ({
      serial: idx + 1,
      leave_type: app.leave_type?.name || 'N/A',
      start_date: format(new Date(app.start_date), 'dd/MM/yyyy'),
      end_date: format(new Date(app.end_date), 'dd/MM/yyyy'),
      duration: formatLeaveDuration(app),
      days: app.leave_days,
      status: app.status,
      reason: app.reason || '',
      admin_response: app.admin_response || 'N/A',
    }));
    const staffName = `${profile?.full_name || 'Staff'} (${formatCollegeUnit((profile as any)?.college_unit)} • ${isPrincipal ? formatAdminDesignation((profile as any)?.admin_designation) : 'Staff'})`;
    const wb = generateLeaveHistoryReport(rows, staffName, filterLabel);
    downloadWorkbook(wb, `leave_history_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const exportToPDF = () => {
    const filterLabel = filter === 'all' ? 'All Status' : filter.charAt(0).toUpperCase() + filter.slice(1);
    const reviewerLabel = isPrincipal ? 'Director Response' : 'Principal Response';
    downloadTablePdf({
      title: 'Leave History Report',
      subtitle: `${isPrincipal ? 'Principal / UH' : 'Staff'}: ${profile?.full_name || (isPrincipal ? 'Principal / UH' : 'Staff')} | Unit: ${formatCollegeUnit((profile as any)?.college_unit)} | Designation: ${isPrincipal ? formatAdminDesignation((profile as any)?.admin_designation) : 'Staff'} | Filter: ${filterLabel}`,
      headers: ['#', 'Leave Type', 'Start Date', 'End Date', 'Duration', 'Days', 'Status', 'Reason', reviewerLabel],
      rows: filteredApplications.map((app, idx) => [
        idx + 1,
        app.leave_type?.name || 'N/A',
        format(new Date(app.start_date), 'dd/MM/yyyy'),
        format(new Date(app.end_date), 'dd/MM/yyyy'),
        formatLeaveDuration(app),
        app.leave_days,
        app.status.charAt(0).toUpperCase() + app.status.slice(1),
        app.reason || '-',
        app.admin_response || 'N/A',
      ]),
      filename: `leave_history_${format(new Date(), 'yyyy-MM-dd')}.pdf`,
    });
  };

  const exportToExcel = downloadReport;

  return (
    <StaffLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-playfair-display font-bold gradient-text">Leave History</h1>
            <p className="mt-2 text-muted-foreground">View all your leave applications</p>
          </div>
          <div className="flex gap-3">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Download Report
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToPDF}>
                  <FileText className="mr-2 h-4 w-4" />
                  Download as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToExcel}>
                  <Download className="mr-2 h-4 w-4" />
                  Download as Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        ) : filteredApplications.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">No applications found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredApplications.map((app) => (
              <Card key={app.id} className="hover:shadow-hover transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {format(new Date(app.start_date), 'MMM dd')} - {format(new Date(app.end_date), 'MMM dd, yyyy')}
                      </CardTitle>
                      <CardDescription>{formatLeaveDuration(app)} • {app.leave_days} day{app.leave_days !== 1 ? 's' : ''}</CardDescription>
                    </div>
                    {getStatusBadge(app.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Reason:</p>
                    <p className="text-sm text-muted-foreground">{app.reason}</p>
                  </div>
                  {app.admin_response && (
                    <div>
                      <p className="text-sm font-medium">{isPrincipal ? 'Director Response:' : 'Principal Response:'}</p>
                      <p className="text-sm text-muted-foreground">{app.admin_response}</p>
                    </div>
                  )}
                  {app.document_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={app.document_url} target="_blank" rel="noopener noreferrer">
                        View Document
                      </a>
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Applied on {format(new Date(app.created_at), 'MMM dd, yyyy HH:mm')}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </StaffLayout>
  );
}
