import AdminLayout from '@/components/layouts/AdminLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLeaveApplications } from '@/hooks/use-leave-applications';
import { useDepartments } from '@/hooks/use-departments';
import { useLeaveTypes } from '@/hooks/use-leave-types';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Clock, Download, FileText, Search, ExternalLink, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { generateAllApplicationsReport, downloadWorkbook } from '@/lib/excel-report';
import { downloadTablePdf } from '@/lib/pdf-report';
import { COLLEGE_UNITS, formatCollegeUnit, type CollegeUnit } from '@/lib/college-units';

const formatLeaveDuration = (app: any) => {
  if (app.leave_duration === 'half_day') {
    return app.half_day_period === 'second_half' ? 'Half Day — Second Half' : 'Half Day — First Half';
  }
  return 'Full Day';
};

export default function AllApplications() {
  const { applications, loading } = useLeaveApplications();
  const { profile, isMainAdmin, isPrincipal, isViewer } = useAuth();
  const isDirectorView = isMainAdmin || isViewer;
  const { departments } = useDepartments();
  const { leaveTypes } = useLeaveTypes();
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const [filter, setFilter] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [searchName, setSearchName] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterLeaveType, setFilterLeaveType] = useState('all');
  const [filterUnit, setFilterUnit] = useState<'all' | CollegeUnit>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');


  const visibleApplications = applications.filter(app => {
    const staffRole = String((app.staff as any)?.role ?? '').toLowerCase();

    if (isDirectorView) {
      // Director and Viewer can see all leave applications across Junior, Senior, and Pharmacy.
      return true;
    }

    if (isPrincipal && !isViewer) {
      // Principal/UH sees staff leave applications from their own college unit only.
      return staffRole === 'staff' && (app.staff as any)?.college_unit === (profile as any)?.college_unit;
    }

    return true;
  });

  const filteredApplications = visibleApplications.filter(app => {
    if (filter !== 'all' && app.status !== filter) return false;
    if (filterUnit !== 'all' && (app.staff as any)?.college_unit !== filterUnit) return false;
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

  const getFilterLabel = () => {
    const parts: string[] = [];
    if (filter !== 'all') parts.push(filter.charAt(0).toUpperCase() + filter.slice(1));
    if (filterUnit !== 'all') parts.push(formatCollegeUnit(filterUnit));
    if (filterYear !== 'all') parts.push(filterYear);
    if (filterDepartment !== 'all') {
      const dept = departments.find(d => d.id === filterDepartment);
      if (dept) parts.push(dept.name);
    }
    if (filterLeaveType !== 'all') {
      const type = leaveTypes.find(t => t.id === filterLeaveType);
      if (type) parts.push(type.name);
    }
    if (startDate || endDate) parts.push(`${startDate || 'Start'} to ${endDate || 'End'}`);
    return parts.length > 0 ? parts.join(', ') : 'All Records';
  };

  const getReportRows = () => filteredApplications.map((app, idx) => ({
    serial: idx + 1,
    staff_name: app.staff?.full_name || 'N/A',
    unit: formatCollegeUnit((app.staff as any)?.college_unit),
    department: app.staff?.department?.name || 'N/A',
    leave_type: app.leave_type?.name || 'N/A',
    start_date: format(new Date(app.start_date), 'dd/MM/yyyy'),
    end_date: format(new Date(app.end_date), 'dd/MM/yyyy'),
    duration: formatLeaveDuration(app),
    days: app.leave_days,
    status: app.status,
    reason: app.reason || '',
    admin_response: app.admin_response || 'N/A',
  }));

  const exportToExcel = () => {
    const wb = generateAllApplicationsReport(getReportRows(), getFilterLabel());
    downloadWorkbook(wb, `all_applications_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const exportToPDF = () => {
    const rows = getReportRows();
    downloadTablePdf({
      title: isDirectorView ? 'Principal / UH Leave Applications Report' : 'All Leave Applications Report',
      subtitle: `Filter: ${getFilterLabel()}`,
      headers: ['#', 'Applicant', 'Unit', 'Department', 'Leave Type', 'Start Date', 'End Date', 'Duration', 'Days', 'Status', 'Reason', 'Response'],
      rows: rows.map((row) => [
        row.serial,
        row.staff_name,
        row.unit,
        row.department,
        row.leave_type,
        row.start_date,
        row.end_date,
        row.duration || 'Full Day',
        row.days,
        row.status.charAt(0).toUpperCase() + row.status.slice(1),
        row.reason || '-',
        row.admin_response || 'N/A',
      ]),
      filename: `all_applications_${format(new Date(), 'yyyy-MM-dd')}.pdf`,
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-playfair-display font-bold gradient-text">{isDirectorView ? 'Principal Applications' : 'All Applications'}</h1>
            <p className="mt-2 text-muted-foreground">{isDirectorView ? 'View Principal leave applications' : isPrincipal && !isViewer ? 'View staff leave applications' : 'View leave applications'}</p>
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

        <Card>
          <CardHeader>
            <CardTitle className="font-playfair-display">Search & Filter</CardTitle>
            <CardDescription>Find specific applications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
              {isDirectorView && (
                <div className="space-y-2">
                  <Label htmlFor="filterUnit">College Unit</Label>
                  <Select value={filterUnit} onValueChange={(value) => setFilterUnit(value as 'all' | CollegeUnit)}>
                    <SelectTrigger id="filterUnit" className="px-3"><SelectValue placeholder="All units" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Units</SelectItem>
                      {COLLEGE_UNITS.map((unit) => (
                        <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
                {searchName || filterDepartment !== 'all' || filterLeaveType !== 'all' || filter !== 'all' || filterUnit !== 'all' || startDate || endDate || filterYear !== 'all'
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
                        @{app.staff?.username} • {formatCollegeUnit((app.staff as any)?.college_unit)} • {app.staff?.department?.name || 'No Department'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {format(new Date(app.start_date), 'MMM dd')} - {format(new Date(app.end_date), 'MMM dd, yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatLeaveDuration(app)} • {app.leave_days} day{app.leave_days !== 1 ? 's' : ''}</p>
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
                      <p className="text-sm font-semibold">{formatCollegeUnit((app.staff as any)?.college_unit)} • {app.staff?.department?.name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Duration</p>
                      <p className="text-sm font-semibold">{formatLeaveDuration(app)}</p>
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
