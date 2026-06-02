import { useAuth } from '@/contexts/AuthContext';
import StaffLayout from '@/components/layouts/StaffLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLeaveApplications } from '@/hooks/use-leave-applications';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Clock, Download, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { jsPDF } from 'jspdf';

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
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('G.D. Sawant College — Leave History Report', pageW / 2, y, { align: 'center' });
    y += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${format(new Date(), 'PPP HH:mm')} | Records: ${filteredApplications.length}`, pageW / 2, y, { align: 'center' });
    y += 10;

    // Table header
    const headers = ['#', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Status', 'Reason', 'Admin Response'];
    const colX = [14, 24, 62, 88, 114, 126, 148, 186];
    const colW = [10, 36, 24, 24, 12, 20, 36, 36];

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(30, 20, 10);
    doc.rect(14, y - 4, pageW - 28, 7, 'F');
    doc.setTextColor(212, 175, 55);
    headers.forEach((h, i) => doc.text(h, colX[i], y));
    y += 7;
    doc.setTextColor(30, 30, 30);

    filteredApplications.forEach((app, idx) => {
      if (y > 270) { doc.addPage(); y = 20; }
      const isEven = idx % 2 === 0;
      if (isEven) {
        doc.setFillColor(250, 248, 240);
        doc.rect(14, y - 3.5, pageW - 28, 6.5, 'F');
      }
      doc.setFont('helvetica', 'normal');
      const row = [
        String(idx + 1),
        app.leave_type?.name || 'N/A',
        format(new Date(app.start_date), 'dd/MM/yy'),
        format(new Date(app.end_date), 'dd/MM/yy'),
        String(app.leave_days),
        app.status,
        app.reason || '',
        app.admin_response || 'N/A',
      ];
      row.forEach((cell, i) => {
        const lines = doc.splitTextToSize(cell, colW[i] - 1);
        doc.text(lines[0], colX[i], y);
      });
      y += 7;
    });

    doc.save(`leave_history_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

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
            <Button onClick={downloadReport} variant="secondary">
              <Download className="mr-2 h-4 w-4" />
              Download Report
            </Button>
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
                      <CardDescription>{app.leave_days} days</CardDescription>
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
