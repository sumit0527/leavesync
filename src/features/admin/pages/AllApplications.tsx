import AdminLayout from '@/components/layouts/AdminLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLeaveApplications } from '@/hooks/use-leave-applications';
import { useDepartments } from '@/hooks/use-departments';
import { useLeaveTypes } from '@/hooks/use-leave-types';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Clock, Download, FileText, Search, ExternalLink, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { jsPDF } from 'jspdf';

export default function AllApplications() {
  const { applications, loading } = useLeaveApplications();
  const { isMainAdmin, isPrincipal, isViewer } = useAuth();
  const { departments } = useDepartments();
  const { leaveTypes } = useLeaveTypes();
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const [filter, setFilter] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [searchName, setSearchName] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterLeaveType, setFilterLeaveType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const visibleApplications = applications.filter(app => {
    const staffRole = String((app.staff as any)?.role ?? '').toLowerCase();

    if (isMainAdmin) {
      // Director's All Applications section shows Principal leave applications only.
      return staffRole === 'principal' || staffRole === 'admin';
    }

    if (isPrincipal && !isViewer) {
      // Principal's All Applications section shows staff leave applications only.
      return staffRole === 'staff';
    }

    return true;
  });

  const filteredApplications = visibleApplications.filter(app => {
    if (filter !== 'all' && app.status !== filter) return false;
    if (searchName && !app.staff?.full_name?.toLowerCase().includes(searchName.toLowerCase())) return false;
    if (filterDepartment !== 'all' && app.staff?.department_id !== filterDepartment) return false;
    if (filterLeaveType !== 'all' && app.leave_type_id !== filterLeaveType) return false;
    // Year filter
    if (filterYear !== 'all') {
      const appYear = new Date(app.start_date).getFullYear();
      if (appYear !== Number(filterYear)) return false;
    }
    // Date range
    if (startDate) {
      const appDate = new Date(app.start_date);
      const filterStart = new Date(startDate);
      if (appDate < filterStart) return false;
    }
    if (endDate) {
      const appDate = new Date(app.start_date);
      const filterEnd = new Date(endDate);
      if (appDate > filterEnd) return false;
    }
    return true;
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
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 18;

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('G.D. Sawant College — All Applications Report', pageW / 2, y, { align: 'center' });
    y += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${format(new Date(), 'PPP HH:mm')} | Total records: ${filteredApplications.length}`, pageW / 2, y, { align: 'center' });
    y += 8;

    // Table header
    const headers = ['#', 'Staff Name', 'Department', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Status', 'Reason', 'Admin Response'];
    const colWidths = [8, 36, 32, 28, 24, 24, 12, 20, 50, 50];
    const colX: number[] = [];
    let xCursor = 10;
    colWidths.forEach((w) => { colX.push(xCursor); xCursor += w; });

    const drawRow = (row: string[], isHeader: boolean, rowY: number) => {
      if (isHeader) {
        doc.setFillColor(30, 20, 10);
        doc.rect(10, rowY - 4, pageW - 20, 7, 'F');
        doc.setTextColor(212, 175, 55);
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setTextColor(30, 30, 30);
        doc.setFont('helvetica', 'normal');
      }
      row.forEach((cell, i) => {
        const maxW = colWidths[i] - 1;
        const lines = doc.splitTextToSize(String(cell), maxW);
        doc.text(lines[0], colX[i], rowY);
      });
    };

    doc.setFontSize(8);
    drawRow(headers, true, y);
    y += 7;

    doc.setDrawColor(200, 175, 100);
    doc.line(10, y - 1, pageW - 10, y - 1);

    filteredApplications.forEach((app, idx) => {
      if (y > 185) { doc.addPage(); y = 18; doc.setFontSize(8); drawRow(headers, true, y); y += 7; }
      const row = [
        String(idx + 1),
        app.staff?.full_name || '',
        app.staff?.department?.name || 'N/A',
        app.leave_type?.name || 'N/A',
        format(new Date(app.start_date), 'dd/MM/yy'),
        format(new Date(app.end_date), 'dd/MM/yy'),
        String(app.leave_days),
        app.status,
        app.reason || '',
        app.admin_response || 'N/A',
      ];
      const isEven = idx % 2 === 0;
      if (isEven) {
        doc.setFillColor(250, 248, 240);
        doc.rect(10, y - 3.5, pageW - 20, 6.5, 'F');
      }
      drawRow(row, false, y);
      y += 7;
    });

    doc.save(`all_applications_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-playfair-display font-bold gradient-text">{isMainAdmin ? 'Principal Applications' : 'All Applications'}</h1>
            <p className="mt-2 text-muted-foreground">{isMainAdmin ? 'View Principal leave applications' : isPrincipal && !isViewer ? 'View staff leave applications' : 'View leave applications'}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

        <Card>
          <CardHeader>
            <CardTitle className="font-playfair-display">Search & Filter</CardTitle>
            <CardDescription>Find specific applications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-7">
              <div className="space-y-2">
                <Label htmlFor="filterYear">Year</Label>
                <Select value={filterYear} onValueChange={setFilterYear}>
                  <SelectTrigger id="filterYear" className="px-3">
                    <SelectValue placeholder="All years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="searchName">Employee Name</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    id="searchName"
                    placeholder="Search..."
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    className="pl-9 px-3"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filterStatus">Status</Label>
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger id="filterStatus" className="px-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filterDepartment">Department</Label>
                <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                  <SelectTrigger id="filterDepartment" className="px-3">
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filterLeaveType">Leave Type</Label>
                <Select value={filterLeaveType} onValueChange={setFilterLeaveType}>
                  <SelectTrigger id="filterLeaveType" className="px-3">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Leave Types</SelectItem>
                    {leaveTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={downloadReport} variant="secondary">
            <Download className="mr-2 h-4 w-4" />
            Download Report
          </Button>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Loading applications...</p>
            </CardContent>
          </Card>
        ) : filteredApplications.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">
                {searchName || filterDepartment !== 'all' || filterLeaveType !== 'all' || filter !== 'all' || startDate || endDate || filterYear !== 'all'
                  ? 'No applications match your filters'
                  : 'No applications found'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredApplications.map((app) => (
              <Card key={app.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{app.staff?.full_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        @{app.staff?.username} • {app.staff?.department?.name || 'No Department'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {format(new Date(app.start_date), 'MMM dd')} - {format(new Date(app.end_date), 'MMM dd, yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground">{app.leave_days} days</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Leave Type</p>
                      <p className="text-sm font-semibold">{app.leave_type?.name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Department</p>
                      <p className="text-sm font-semibold">{app.staff?.department?.name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Status</p>
                      {getStatusBadge(app.status)}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Reason:</p>
                    <p className="text-sm text-muted-foreground">{app.reason}</p>
                  </div>
                  {app.document_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={app.document_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View Document
                      </a>
                    </Button>
                  )}
                  {app.admin_response && (
                    <div>
                      <p className="text-sm font-medium">Admin Response:</p>
                      <p className="text-sm text-muted-foreground">{app.admin_response}</p>
                    </div>
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
    </AdminLayout>
  );
}
