import * as XLSX from 'xlsx';
import { format } from 'date-fns';

// Local style type (xlsx@0.18.5 doesn't export CellStyle in typings)
interface CellStyle {
  font?: {
    bold?: boolean;
    italic?: boolean;
    sz?: number;
    color?: { rgb: string };
  };
  fill?: {
    fgColor?: { rgb: string };
    patternType?: string;
  };
  alignment?: {
    horizontal?: string;
    vertical?: string;
    wrapText?: boolean;
  };
  border?: {
    top?: { style: string; color?: { rgb: string } };
    bottom?: { style: string; color?: { rgb: string } };
    left?: { style: string; color?: { rgb: string } };
    right?: { style: string; color?: { rgb: string } };
  };
}

// ─── Color constants (ARGB hex for xlsx) ──────────────────────────────────────
const COLOR_HEADER_BG = 'FF1E140A';   // dark brown/black
const COLOR_HEADER_FG = 'FFD4AF37';   // gold
const COLOR_ROW_ODD   = 'FFFAF8F0';   // warm white
const COLOR_ROW_EVEN  = 'FFFFFFFF';   // white
const COLOR_SUMMARY_BG= 'FFF5F0E0';   // light gold tint
const COLOR_DEPT_BG   = 'FF2C1F08';   // darker header for dept rows
const COLOR_DEPT_FG   = 'FFD4AF37';   // gold

// ─── Cell style helpers ───────────────────────────────────────────────────────
function fullBorder(rgb = 'D8D8D8'): CellStyle['border'] {
  return {
    top: { style: 'thin', color: { rgb } },
    bottom: { style: 'thin', color: { rgb } },
    left: { style: 'thin', color: { rgb } },
    right: { style: 'thin', color: { rgb } },
  };
}

function headerStyle(): CellStyle {
  return {
    font: { bold: true, color: { rgb: 'D4AF37' }, sz: 11 },
    fill: { fgColor: { rgb: '1E140A' }, patternType: 'solid' },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: fullBorder('D4AF37'),
  };
}

function rowStyle(rowIndex: number): CellStyle {
  return {
    font: { sz: 10 },
    fill: {
      fgColor: { rgb: rowIndex % 2 === 0 ? 'FAF8F0' : 'FFFFFF' },
      patternType: 'solid',
    },
    alignment: { vertical: 'center', wrapText: true },
    border: fullBorder('E8E0D0'),
  };
}

function deptHeaderStyle(): CellStyle {
  return {
    font: { bold: true, color: { rgb: 'D4AF37' }, sz: 11 },
    fill: { fgColor: { rgb: '2C1F08' }, patternType: 'solid' },
    alignment: { horizontal: 'left', vertical: 'center' },
  };
}

function summaryStyle(): CellStyle {
  return {
    font: { bold: true, sz: 10 },
    fill: { fgColor: { rgb: 'F5F0E0' }, patternType: 'solid' },
    alignment: { vertical: 'center' },
    border: {
      top: { style: 'medium', color: { rgb: 'D4AF37' } },
      bottom: { style: 'medium', color: { rgb: 'D4AF37' } },
      left: { style: 'thin', color: { rgb: 'D4AF37' } },
      right: { style: 'thin', color: { rgb: 'D4AF37' } },
    },
  };
}

function titleStyle(): CellStyle {
  return {
    font: { bold: true, sz: 14, color: { rgb: 'D4AF37' } },
    fill: { fgColor: { rgb: '1E140A' }, patternType: 'solid' },
    alignment: { horizontal: 'center', vertical: 'center' },
  };
}

function subtitleStyle(): CellStyle {
  return {
    font: { italic: true, sz: 10, color: { rgb: '666666' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  };
}

// ─── Apply styles to a range in a worksheet ──────────────────────────────────
function applyStyleToRange(ws: XLSX.WorkSheet, range: string, style: CellStyle) {
  const decoded = XLSX.utils.decode_range(range);
  for (let r = decoded.s.r; r <= decoded.e.r; r++) {
    for (let c = decoded.s.c; c <= decoded.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { v: '', t: 's' };
      ws[addr].s = style;
    }
  }
}

// ─── Set column widths ────────────────────────────────────────────────────────
function setColWidths(ws: XLSX.WorkSheet, widths: number[]) {
  ws['!cols'] = widths.map(w => ({ wch: w }));
}

function setAutoFilter(ws: XLSX.WorkSheet, fromRow: number, colCount: number, lastRow: number) {
  const endCol = XLSX.utils.encode_col(colCount - 1);
  ws['!autofilter'] = { ref: `A${fromRow}:${endCol}${lastRow}` };
}

// ─── Merge cells helper ───────────────────────────────────────────────────────
function mergeCells(ws: XLSX.WorkSheet, merges: string[]) {
  if (!ws['!merges']) ws['!merges'] = [];
  merges.forEach(m => {
    ws['!merges']!.push(XLSX.utils.decode_range(m));
  });
}

// ─── Add company header rows ─────────────────────────────────────────────────
function addCompanyHeader(ws: XLSX.WorkSheet, colCount: number, reportTitle: string): number {
  const lastCol = XLSX.utils.encode_col(colCount - 1);
  const generatedAt = format(new Date(), 'dd MMM yyyy, hh:mm a');

  // Row 0: Company name
  ws['A1'] = { v: 'G.D. Sawant College of Technology — LeaveSync', t: 's', s: titleStyle() };
  mergeCells(ws, [`A1:${lastCol}1`]);

  // Row 1: Report title
  ws['A2'] = { v: reportTitle, t: 's', s: { ...subtitleStyle(), font: { bold: true, sz: 12 } } };
  mergeCells(ws, [`A2:${lastCol}2`]);

  // Row 2: Generated date
  ws['A3'] = { v: `Report Generated: ${generatedAt}`, t: 's', s: subtitleStyle() };
  mergeCells(ws, [`A3:${lastCol}3`]);

  // Row 3: blank spacer
  ws['A4'] = { v: '', t: 's' };

  return 4; // next available row index (0-based)
}

// ─── Write a styled cell ──────────────────────────────────────────────────────
function writeCell(ws: XLSX.WorkSheet, row: number, col: number, value: string | number, style?: CellStyle) {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const t = typeof value === 'number' ? 'n' : 's';
  ws[addr] = { v: value, t, s: style };
}

// ─── Employee Management Report ───────────────────────────────────────────────
export interface LeaveAllocationRow {
  leave_type_name: string;
  used: number;
  total_allocated: number;
  remaining: number;
}

export interface StaffReportRow {
  id: string;
  full_name: string;
  username: string;
  department_name: string;
  phone: string | null;
  email: string | null;
  approval_status: string;
  leave_balance: number;
  allocations: LeaveAllocationRow[];
}

export function generateEmployeeReport(
  staffRows: StaffReportRow[],
  leaveTypeNames: string[],
  year: number
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Department-wise Detail ──────────────────────────────────────
  const ws1: XLSX.WorkSheet = {};

  const fixedCols = ['Department', 'Full Name', 'Username', 'Phone', 'Email', 'Status', 'Leave Balance', 'Total Taken'];
  const allCols = [...fixedCols, ...leaveTypeNames];
  const colCount = allCols.length;

  let rowIdx = addCompanyHeader(ws1, colCount, `Employee Leave Report — ${year}`);

  // Column headers
  allCols.forEach((col, c) => {
    writeCell(ws1, rowIdx, c, col, headerStyle());
  });
  rowIdx++;

  // Group staff by department
  const deptMap = new Map<string, StaffReportRow[]>();
  staffRows.forEach(s => {
    const dept = s.department_name || 'No Department';
    if (!deptMap.has(dept)) deptMap.set(dept, []);
    deptMap.get(dept)!.push(s);
  });

  // Sort departments
  const sortedDepts = Array.from(deptMap.keys()).sort();

  // Grand totals for summary
  const grandTotalByLeaveType = new Map<string, number>();
  leaveTypeNames.forEach(lt => grandTotalByLeaveType.set(lt, 0));
  let grandTotalStaff = 0;
  let grandTotalTaken = 0;

  sortedDepts.forEach(deptName => {
    const staff = deptMap.get(deptName)!;

    // Department header row
    const lastCol = XLSX.utils.encode_col(colCount - 1);
    const deptCellAddr = XLSX.utils.encode_cell({ r: rowIdx, c: 0 });
    ws1[deptCellAddr] = { v: `📁  ${deptName}  (${staff.length} employee${staff.length !== 1 ? 's' : ''})`, t: 's', s: deptHeaderStyle() };
    for (let c = 1; c < colCount; c++) {
      writeCell(ws1, rowIdx, c, '', deptHeaderStyle());
    }
    if (!ws1['!merges']) ws1['!merges'] = [];
    ws1['!merges'].push(XLSX.utils.decode_range(`A${rowIdx + 1}:${lastCol}${rowIdx + 1}`));
    rowIdx++;

    // Staff rows
    let deptTotalTaken = 0;
    const deptTotalByLeaveType = new Map<string, number>();
    leaveTypeNames.forEach(lt => deptTotalByLeaveType.set(lt, 0));

    staff.forEach((s, staffIdx) => {
      const totalTaken = s.allocations.reduce((sum, a) => sum + a.used, 0);
      deptTotalTaken += totalTaken;
      grandTotalTaken += totalTaken;
      grandTotalStaff++;

      const style = rowStyle(staffIdx);
      writeCell(ws1, rowIdx, 0, deptName, style);
      writeCell(ws1, rowIdx, 1, s.full_name, style);
      writeCell(ws1, rowIdx, 2, `@${s.username}`, style);
      writeCell(ws1, rowIdx, 3, s.phone || '-', style);
      writeCell(ws1, rowIdx, 4, s.email || '-', style);
      writeCell(ws1, rowIdx, 5, s.approval_status.charAt(0).toUpperCase() + s.approval_status.slice(1), style);
      writeCell(ws1, rowIdx, 6, s.leave_balance, style);
      writeCell(ws1, rowIdx, 7, totalTaken, style);

      leaveTypeNames.forEach((ltName, ltIdx) => {
        const alloc = s.allocations.find(a => a.leave_type_name === ltName);
        const used = alloc?.used ?? 0;
        deptTotalByLeaveType.set(ltName, (deptTotalByLeaveType.get(ltName) ?? 0) + used);
        grandTotalByLeaveType.set(ltName, (grandTotalByLeaveType.get(ltName) ?? 0) + used);
        writeCell(ws1, rowIdx, 8 + ltIdx, used, style);
      });

      rowIdx++;
    });

    // Department summary row
    const sumStyle = summaryStyle();
    writeCell(ws1, rowIdx, 0, `${deptName} Total`, sumStyle);
    writeCell(ws1, rowIdx, 1, '', sumStyle);
    writeCell(ws1, rowIdx, 2, `${staff.length} staff`, sumStyle);
    writeCell(ws1, rowIdx, 3, '', sumStyle);
    writeCell(ws1, rowIdx, 4, '', sumStyle);
    writeCell(ws1, rowIdx, 5, '', sumStyle);
    writeCell(ws1, rowIdx, 6, '', sumStyle);
    writeCell(ws1, rowIdx, 7, deptTotalTaken, sumStyle);
    leaveTypeNames.forEach((ltName, ltIdx) => {
      writeCell(ws1, rowIdx, 8 + ltIdx, deptTotalByLeaveType.get(ltName) ?? 0, sumStyle);
    });
    rowIdx++;

    // Blank spacer between departments
    rowIdx++;
  });

  // Grand total row
  const grandStyle = {
    ...summaryStyle(),
    font: { bold: true, sz: 11, color: { rgb: 'D4AF37' } },
    fill: { fgColor: { rgb: '1E140A' }, patternType: 'solid' },
  };

  writeCell(ws1, rowIdx, 0, 'GRAND TOTAL', grandStyle);
  writeCell(ws1, rowIdx, 1, '', grandStyle);
  writeCell(ws1, rowIdx, 2, `${grandTotalStaff} staff`, grandStyle);
  writeCell(ws1, rowIdx, 3, '', grandStyle);
  writeCell(ws1, rowIdx, 4, '', grandStyle);
  writeCell(ws1, rowIdx, 5, '', grandStyle);
  writeCell(ws1, rowIdx, 6, '', grandStyle);
  writeCell(ws1, rowIdx, 7, grandTotalTaken, grandStyle);
  leaveTypeNames.forEach((ltName, ltIdx) => {
    writeCell(ws1, rowIdx, 8 + ltIdx, grandTotalByLeaveType.get(ltName) ?? 0, grandStyle);
  });
  rowIdx++;

  // Set ref and column widths
  ws1['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rowIdx, c: colCount - 1 } });
  ws1['!rows'] = [{ hpt: 28 }, { hpt: 20 }, { hpt: 16 }, { hpt: 6 }];
  const colWidths = [20, 22, 18, 16, 28, 12, 14, 12, ...leaveTypeNames.map(() => 16)];
  setColWidths(ws1, colWidths);

  XLSX.utils.book_append_sheet(wb, ws1, 'Department Report');

  // ── Sheet 2: Overall Summary ──────────────────────────────────────────────
  const ws2: XLSX.WorkSheet = {};
  let r2 = addCompanyHeader(ws2, 5, `Overall Summary — ${year}`);

  // Section: Totals
  writeCell(ws2, r2, 0, 'Metric', headerStyle());
  writeCell(ws2, r2, 1, 'Value', headerStyle());
  for (let c = 2; c < 5; c++) writeCell(ws2, r2, c, '', headerStyle());
  r2++;

  const summaryData: [string, string | number][] = [
    ['Total Employees', grandTotalStaff],
    ['Total Leave Days Taken', grandTotalTaken],
    ['Report Year', year],
    ['Departments Count', sortedDepts.length],
    ['Generated On', format(new Date(), 'dd MMM yyyy, hh:mm a')],
  ];

  summaryData.forEach(([label, value], idx) => {
    const sStyle = rowStyle(idx);
    writeCell(ws2, r2, 0, label, sStyle);
    writeCell(ws2, r2, 1, value, sStyle);
    r2++;
  });

  r2++;

  // Section: Leave type totals
  writeCell(ws2, r2, 0, 'Leave Type', headerStyle());
  writeCell(ws2, r2, 1, 'Total Used (All Staff)', headerStyle());
  writeCell(ws2, r2, 2, '% of Total Leaves', headerStyle());
  for (let c = 3; c < 5; c++) writeCell(ws2, r2, c, '', headerStyle());
  r2++;

  leaveTypeNames.forEach((ltName, idx) => {
    const used = grandTotalByLeaveType.get(ltName) ?? 0;
    const pct = grandTotalTaken > 0 ? `${((used / grandTotalTaken) * 100).toFixed(1)}%` : '0%';
    const sStyle = rowStyle(idx);
    writeCell(ws2, r2, 0, ltName, sStyle);
    writeCell(ws2, r2, 1, used, sStyle);
    writeCell(ws2, r2, 2, pct, sStyle);
    r2++;
  });

  r2++;

  // Section: Department summary
  writeCell(ws2, r2, 0, 'Department', headerStyle());
  writeCell(ws2, r2, 1, 'Staff Count', headerStyle());
  writeCell(ws2, r2, 2, 'Total Leaves Taken', headerStyle());
  writeCell(ws2, r2, 3, 'Avg per Employee', headerStyle());
  writeCell(ws2, r2, 4, '', headerStyle());
  r2++;

  sortedDepts.forEach((deptName, idx) => {
    const staff = deptMap.get(deptName)!;
    const taken = staff.reduce((sum, s) => sum + s.allocations.reduce((a, al) => a + al.used, 0), 0);
    const avg = staff.length > 0 ? (taken / staff.length).toFixed(1) : '0';
    const sStyle = rowStyle(idx);
    writeCell(ws2, r2, 0, deptName, sStyle);
    writeCell(ws2, r2, 1, staff.length, sStyle);
    writeCell(ws2, r2, 2, taken, sStyle);
    writeCell(ws2, r2, 3, avg, sStyle);
    writeCell(ws2, r2, 4, '', sStyle);
    r2++;
  });

  ws2['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r2, c: 4 } });
  setColWidths(ws2, [30, 20, 24, 20, 10]);

  XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

  return wb;
}

// ─── Leave History Report (Staff) ────────────────────────────────────────────
export interface LeaveHistoryRow {
  serial: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  duration?: string;
  days: number;
  status: string;
  reason: string;
  admin_response: string;
}

export function generateLeaveHistoryReport(
  rows: LeaveHistoryRow[],
  staffName: string,
  filterLabel: string
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};

  const cols = ['#', 'Leave Type', 'Start Date', 'End Date', 'Duration', 'Days', 'Status', 'Reason', 'Admin Response'];
  const colWidths = [6, 20, 14, 14, 18, 8, 12, 40, 36];
  let rowIdx = addCompanyHeader(ws, cols.length, `Leave History — ${staffName} (${filterLabel})`);

  cols.forEach((col, c) => writeCell(ws, rowIdx, c, col, headerStyle()));
  rowIdx++;

  rows.forEach((row, i) => {
    const s = rowStyle(i);
    writeCell(ws, rowIdx, 0, row.serial, s);
    writeCell(ws, rowIdx, 1, row.leave_type, s);
    writeCell(ws, rowIdx, 2, row.start_date, s);
    writeCell(ws, rowIdx, 3, row.end_date, s);
    writeCell(ws, rowIdx, 4, row.duration || 'Full Day', s);
    writeCell(ws, rowIdx, 5, row.days, s);
    writeCell(ws, rowIdx, 6, row.status.charAt(0).toUpperCase() + row.status.slice(1), s);
    writeCell(ws, rowIdx, 7, row.reason, s);
    writeCell(ws, rowIdx, 8, row.admin_response || 'N/A', s);
    rowIdx++;
  });

  // Totals row
  const ts = summaryStyle();
  writeCell(ws, rowIdx, 0, 'TOTAL', ts);
  writeCell(ws, rowIdx, 1, `${rows.length} records`, ts);
  writeCell(ws, rowIdx, 2, '', ts);
  writeCell(ws, rowIdx, 3, '', ts);
  writeCell(ws, rowIdx, 4, '', ts);
  writeCell(ws, rowIdx, 5, rows.reduce((s, r) => s + r.days, 0), ts);
  for (let c = 6; c < cols.length; c++) writeCell(ws, rowIdx, c, '', ts);

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rowIdx, c: cols.length - 1 } });
  setColWidths(ws, colWidths);
  XLSX.utils.book_append_sheet(wb, ws, 'Leave History');
  return wb;
}

// ─── All Applications Report (Admin) ─────────────────────────────────────────
export interface AllApplicationsRow {
  serial: number;
  staff_name: string;
  unit?: string;
  designation?: string;
  department: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  duration?: string;
  days: number;
  status: string;
  reason: string;
  admin_response: string;
}

export function generateAllApplicationsReport(
  rows: AllApplicationsRow[],
  filterLabel: string
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};

  const cols = ['#', 'Applicant Name', 'Unit', 'Designation', 'Department', 'Leave Type', 'Start Date', 'End Date', 'Duration', 'Days', 'Status', 'Reason', 'Admin Response'];
  const colWidths = [6, 24, 18, 16, 20, 18, 14, 14, 22, 8, 12, 36, 32];
  let rowIdx = addCompanyHeader(ws, cols.length, `All Leave Applications (${filterLabel})`);

  cols.forEach((col, c) => writeCell(ws, rowIdx, c, col, headerStyle()));
  rowIdx++;

  rows.forEach((row, i) => {
    const s = rowStyle(i);
    writeCell(ws, rowIdx, 0, row.serial, s);
    writeCell(ws, rowIdx, 1, row.staff_name, s);
    writeCell(ws, rowIdx, 2, row.unit || 'Unit Not Assigned', s);
    writeCell(ws, rowIdx, 3, row.designation || 'Staff', s);
    writeCell(ws, rowIdx, 4, row.department, s);
    writeCell(ws, rowIdx, 5, row.leave_type, s);
    writeCell(ws, rowIdx, 6, row.start_date, s);
    writeCell(ws, rowIdx, 7, row.end_date, s);
    writeCell(ws, rowIdx, 8, row.duration || 'Full Day', s);
    writeCell(ws, rowIdx, 9, row.days, s);
    writeCell(ws, rowIdx, 10, row.status.charAt(0).toUpperCase() + row.status.slice(1), s);
    writeCell(ws, rowIdx, 11, row.reason, s);
    writeCell(ws, rowIdx, 12, row.admin_response || 'N/A', s);
    rowIdx++;
  });

  const ts = summaryStyle();
  writeCell(ws, rowIdx, 0, 'TOTAL', ts);
  writeCell(ws, rowIdx, 1, `${rows.length} records`, ts);
  for (let c = 2; c < cols.length - 1; c++) writeCell(ws, rowIdx, c, '', ts);
  writeCell(ws, rowIdx, 9, rows.reduce((s, r) => s + r.days, 0), ts);
  writeCell(ws, rowIdx, cols.length - 1, '', ts);

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rowIdx, c: cols.length - 1 } });
  setColWidths(ws, colWidths);
  XLSX.utils.book_append_sheet(wb, ws, 'All Applications');
  return wb;
}

// ─── Analytics Report (Admin) ─────────────────────────────────────────────────
export interface AnalyticsDeptRow {
  unit?: string;
  department: string;
  total: number;
  approved: number;
  rejected: number;
  pending: number;
}
export interface AnalyticsLeaveTypeRow {
  leave_type: string;
  count: number;
  percentage: number;
}
export interface AnalyticsStats {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
}

export function generateAnalyticsReport(
  stats: AnalyticsStats,
  deptStats: AnalyticsDeptRow[],
  leaveTypeStats: AnalyticsLeaveTypeRow[],
  year: number,
  scopeLabel = 'All Units'
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};

  let rowIdx = addCompanyHeader(ws, 7, `Leave Analytics Report — ${year} (${scopeLabel})`);

  // Overall stats
  writeCell(ws, rowIdx, 0, 'Overall Statistics', {
    font: { bold: true, sz: 12, color: { rgb: 'D4AF37' } },
    fill: { fgColor: { rgb: '2C1F08' }, patternType: 'solid' },
  });
  for (let c = 1; c < 7; c++) writeCell(ws, rowIdx, c, '', deptHeaderStyle());
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push(XLSX.utils.decode_range(`A${rowIdx + 1}:G${rowIdx + 1}`));
  rowIdx++;

  const overallCols = ['Metric', 'Count', 'Percentage'];
  overallCols.forEach((col, c) => writeCell(ws, rowIdx, c, col, headerStyle()));
  for (let c = 3; c < 7; c++) writeCell(ws, rowIdx, c, '', headerStyle());
  rowIdx++;

  const overallRows: [string, number, string][] = [
    ['Total Applications', stats.total, '100%'],
    ['Approved', stats.approved, stats.total > 0 ? `${((stats.approved / stats.total) * 100).toFixed(1)}%` : '0%'],
    ['Rejected', stats.rejected, stats.total > 0 ? `${((stats.rejected / stats.total) * 100).toFixed(1)}%` : '0%'],
    ['Pending', stats.pending, stats.total > 0 ? `${((stats.pending / stats.total) * 100).toFixed(1)}%` : '0%'],
  ];

  overallRows.forEach((row, i) => {
    const s = rowStyle(i);
    writeCell(ws, rowIdx, 0, row[0], s);
    writeCell(ws, rowIdx, 1, row[1], s);
    writeCell(ws, rowIdx, 2, row[2], s);
    for (let c = 3; c < 7; c++) writeCell(ws, rowIdx, c, '', s);
    rowIdx++;
  });

  rowIdx++;

  // Department breakdown
  writeCell(ws, rowIdx, 0, 'Department-wise Breakdown', {
    font: { bold: true, sz: 12, color: { rgb: 'D4AF37' } },
    fill: { fgColor: { rgb: '2C1F08' }, patternType: 'solid' },
  });
  for (let c = 1; c < 7; c++) writeCell(ws, rowIdx, c, '', deptHeaderStyle());
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push(XLSX.utils.decode_range(`A${rowIdx + 1}:G${rowIdx + 1}`));
  rowIdx++;

  ['Unit', 'Department', 'Total', 'Approved', 'Rejected', 'Pending', 'Approval %'].forEach((col, c) => {
    writeCell(ws, rowIdx, c, col, headerStyle());
  });
  rowIdx++;

  deptStats.forEach((d, i) => {
    const s = rowStyle(i);
    const pct = d.total > 0 ? `${((d.approved / d.total) * 100).toFixed(1)}%` : '0%';
    writeCell(ws, rowIdx, 0, d.unit || scopeLabel, s);
    writeCell(ws, rowIdx, 1, d.department, s);
    writeCell(ws, rowIdx, 2, d.total, s);
    writeCell(ws, rowIdx, 3, d.approved, s);
    writeCell(ws, rowIdx, 4, d.rejected, s);
    writeCell(ws, rowIdx, 5, d.pending, s);
    writeCell(ws, rowIdx, 6, pct, s);
    rowIdx++;
  });

  rowIdx++;

  // Leave type breakdown
  writeCell(ws, rowIdx, 0, 'Leave Type Breakdown', {
    font: { bold: true, sz: 12, color: { rgb: 'D4AF37' } },
    fill: { fgColor: { rgb: '2C1F08' }, patternType: 'solid' },
  });
  for (let c = 1; c < 7; c++) writeCell(ws, rowIdx, c, '', deptHeaderStyle());
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push(XLSX.utils.decode_range(`A${rowIdx + 1}:G${rowIdx + 1}`));
  rowIdx++;

  ['Leave Type', 'Applications Count', '% of Total', '', '', '', ''].forEach((col, c) => {
    writeCell(ws, rowIdx, c, col, headerStyle());
  });
  rowIdx++;

  leaveTypeStats.forEach((lt, i) => {
    const s = rowStyle(i);
    writeCell(ws, rowIdx, 0, lt.leave_type, s);
    writeCell(ws, rowIdx, 1, lt.count, s);
    writeCell(ws, rowIdx, 2, `${lt.percentage}%`, s);
    for (let c = 3; c < 7; c++) writeCell(ws, rowIdx, c, '', s);
    rowIdx++;
  });

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rowIdx, c: 6 } });
  setColWidths(ws, [18, 30, 16, 16, 14, 14, 14]);
  XLSX.utils.book_append_sheet(wb, ws, 'Analytics');
  return wb;
}

// ─── Save workbook ────────────────────────────────────────────────────────────
export function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename, { bookType: 'xlsx', type: 'binary', cellStyles: true });
}

// ─── Staff profile report ─────────────────────────────────────────────────────
export interface ProfileReportData {
  full_name: string;
  username: string;
  email: string;
  phone: string;
  address: string;
  role: string;
  college_unit?: string;
  admin_designation?: string;
  department?: string;
  stats: { total: number; approved: number; rejected: number; pending: number };
  allocations: Array<{ leave_type: string; total_allocated: number; used: number; remaining: number }>;
}

export function generateProfileReport(data: ProfileReportData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const now = new Date();

  // ── Sheet 1: Personal Info ──────────────────────────────────────────────────
  const infoWs: XLSX.WorkSheet = {};
  let rowIdx = addCompanyHeader(infoWs, 2, 'Staff Profile Report');
  writeCell(infoWs, rowIdx, 0, 'Field', headerStyle());
  writeCell(infoWs, rowIdx, 1, 'Value', headerStyle());
  rowIdx++;
  const infoFields: [string, string][] = [
    ['Full Name', data.full_name || 'N/A'],
    ['Username', `@${data.username || 'N/A'}`],
    ['Email', data.email || 'N/A'],
    ['Phone', data.phone || 'N/A'],
    ['Address', data.address || 'N/A'],
    ['Role', data.role || 'Staff'],
    ['College Unit', data.college_unit || 'Unit Not Assigned'],
    ['Designation', data.admin_designation || data.role || 'Staff'],
    ['Department', data.department || 'N/A'],
    ['Report Date', format(now, 'dd/MM/yyyy HH:mm')],
  ];
  infoFields.forEach(([f, v], i) => {
    const s = rowStyle(i);
    writeCell(infoWs, rowIdx, 0, f, s);
    writeCell(infoWs, rowIdx, 1, v, s);
    rowIdx++;
  });
  infoWs['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rowIdx - 1, c: 1 } });
  setColWidths(infoWs, [24, 40]);
  XLSX.utils.book_append_sheet(wb, infoWs, 'Personal Info');

  // ── Sheet 2: Leave Statistics ───────────────────────────────────────────────
  const statWs: XLSX.WorkSheet = {};
  let statIdx = addCompanyHeader(statWs, 2, 'Leave Statistics');
  writeCell(statWs, statIdx, 0, 'Metric', headerStyle());
  writeCell(statWs, statIdx, 1, 'Count', headerStyle());
  statIdx++;
  const metrics: [string, number][] = [
    ['Total Applications', data.stats.total],
    ['Approved', data.stats.approved],
    ['Rejected', data.stats.rejected],
    ['Pending', data.stats.pending],
  ];
  metrics.forEach(([m, v], i) => {
    const s = rowStyle(i);
    writeCell(statWs, statIdx, 0, m, s);
    writeCell(statWs, statIdx, 1, v, s);
    statIdx++;
  });
  statWs['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: statIdx - 1, c: 1 } });
  setColWidths(statWs, [28, 14]);
  XLSX.utils.book_append_sheet(wb, statWs, 'Leave Stats');

  // ── Sheet 3: Leave Allocations ──────────────────────────────────────────────
  const allocWs: XLSX.WorkSheet = {};
  let allocIdx = addCompanyHeader(allocWs, 4, `Leave Allocations — ${now.getFullYear()}`);
  ['Leave Type', 'Total Allocated', 'Used', 'Remaining'].forEach((h, c) =>
    writeCell(allocWs, allocIdx, c, h, headerStyle())
  );
  allocIdx++;
  if (data.allocations.length === 0) {
    writeCell(allocWs, allocIdx, 0, 'No allocations found', rowStyle(0));
    allocIdx++;
  } else {
    data.allocations.forEach((a, i) => {
      const s = rowStyle(i);
      writeCell(allocWs, allocIdx, 0, a.leave_type, s);
      writeCell(allocWs, allocIdx, 1, a.total_allocated, s);
      writeCell(allocWs, allocIdx, 2, a.used, s);
      writeCell(allocWs, allocIdx, 3, a.remaining, s);
      allocIdx++;
    });
  }
  allocWs['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: allocIdx - 1, c: 3 } });
  setColWidths(allocWs, [28, 18, 14, 14]);
  XLSX.utils.book_append_sheet(wb, allocWs, 'Allocations');

  return wb;
}
