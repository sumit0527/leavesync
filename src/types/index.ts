export interface Option {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  withCount?: boolean;
}

export type UserRole = 'staff' | 'admin' | 'principal' | 'main_admin' | 'director' | 'viewer';
export type CollegeUnit = 'junior' | 'senior' | 'pharmacy';
export type AdminDesignation = 'principal' | 'uh';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type EmploymentStatus = 'active' | 'past';
export type LeaveDuration = 'full_day' | 'half_day';
export type HalfDayPeriod = 'first_half' | 'second_half';

export interface Department {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveType {
  id: string;
  name: string;
  description: string | null;
  annual_allocation: number;
  requires_document: boolean;
  created_at: string;
  updated_at: string;
}

export interface StaffLeaveAllocation {
  id: string;
  staff_id: string;
  leave_type_id: string;
  total_allocated: number;
  used: number;
  remaining: number;
  year: number;
  created_at: string;
  updated_at: string;
  leave_type?: LeaveType;
}

export interface Profile {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  full_name: string;
  role: UserRole;
  department_id: string | null;
  approval_status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  leave_balance: number;
  employment_status?: EmploymentStatus;
  college_unit?: CollegeUnit | null;
  admin_designation?: AdminDesignation | null;
  exited_at?: string | null;
  exited_by?: string | null;
  created_at: string;
  updated_at: string;
  department?: Department;
}

export interface LeaveApplication {
  id: string;
  staff_id: string;
  leave_type_id: string | null;
  start_date: string;
  end_date: string;
  leave_days: number;
  leave_duration?: LeaveDuration | null;
  half_day_period?: HalfDayPeriod | null;
  reason: string;
  document_url: string | null;
  status: LeaveStatus;
  admin_response: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  staff?: Profile;
  reviewer?: Profile;
  leave_type?: LeaveType;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  related_application_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  created_at: string;
}

export interface LeaveStats {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
}

export interface DashboardStats {
  leaveBalance: number;
  pendingApplications: number;
  approvedLeaves: number;
  rejectedLeaves: number;
  totalApplications: number;
}
