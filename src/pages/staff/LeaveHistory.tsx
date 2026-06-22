import { useAuth } from '@/contexts/AuthContext';
import StaffLayout from '@/components/layouts/StaffLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLeaveApplications } from '@/hooks/use-leave-applications';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
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

const formatLeaveDuration = (app: any) => {
  if (app.leave_duration === 'half_day') {
    return app.half_day_period === 'second_half' ? 'Half Day — Second Half' : 'Half Day — First Half';
  }
  return 'Full Day';
};

export default function LeaveHistory() {
  const { profile } = useAuth();
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
    const staffName = profile?.full_name || 'Staff';
    const wb = generateLeaveHistoryReport(rows, staffName, filterLabel);
    downloadWorkbook(wb, `leave_history_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const exportToPDF = () => {
    const filterLabel = filter === 'all' ? 'All Status' : filter.charAt(0).toUpperCase() + filter.slice(1);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const margin = 36;
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 42;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('LeaveSync - Leave History Report', margin, y);
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Staff: ${profile?.full_name || 'Staff'} | Filter: ${filterLabel}`, margin, y);
    doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth - margin - 160, y);
    y += 22;

    const headers = ['#', 'Leave Type', 'Start', 'End', 'Duration', 'Days', 'Status', 'Reason', 'Admin Response'];
    const widths = [28, 92, 64, 64, 96, 38, 64, 190, 180];
    const drawHeader = () => {
      let x = margin;
      doc.setFillColor(44, 31, 8);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      headers.forEach((h, i) => { doc.rect(x, y, widths[i], 20, 'F'); doc.text(h, x + 4, y + 13); x += widths[i]; });
      y += 20;
      doc.setTextColor(0, 0, 0);
    };
    drawHeader();

    if (filteredApplications.length === 0) {
      doc.setFontSize(10);
      doc.text('No applications found for selected filter.', margin, y + 18);
    } else {
      filteredApplications.forEach((app, idx) => {
        if (y > 530) { doc.addPage(); y = 42; drawHeader(); }
        const values = [idx + 1, app.leave_type?.name || 'N/A', format(new Date(app.start_date), 'dd/MM/yyyy'), format(new Date(app.end_date), 'dd/MM/yyyy'), formatLeaveDuration(app), app.leave_days, app.status, app.reason || '', app.admin_response || 'N/A'];
        let x = margin;
        doc.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 248 : 255);
        doc.rect(margin, y, widths.reduce((a,b)=>a+b,0), 28, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        values.forEach((v, i) => { doc.text(doc.splitTextToSize(String(v), widths[i] - 8).slice(0, 2), x + 4, y + 10); x += widths[i]; });
        y += 28;
      });
    }
    doc.save(`leave_history_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
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
                      <p className="text-sm font-medium">Admin Response:</p>
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
