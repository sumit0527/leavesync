import type { ReactNode } from 'react';

// Auth pages
import HomePage from './pages/HomePage';
import StaffLogin from './pages/auth/StaffLogin';
import StaffRegister from './pages/auth/StaffRegister';
import AdminLogin from './pages/auth/AdminLogin';
import AdminRegister from './pages/auth/AdminRegister';
import ForgotCredentials from './pages/auth/ForgotCredentials';
import ForgotUsername from './pages/auth/ForgotUsername';

// Staff pages
import StaffDashboard from './pages/staff/StaffDashboard';
import ApplyLeave from './pages/staff/ApplyLeave';
import LeaveHistory from './pages/staff/LeaveHistory';
import LeaveCalendar from './pages/staff/LeaveCalendar';
import StaffProfile from './pages/staff/Profile';
import StaffNotifications from './pages/staff/Notifications';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import PendingApplications from './pages/admin/PendingApplications';
import AllApplications from './pages/admin/AllApplications';
import Analytics from './pages/admin/Analytics';
import EmployeeApproval from './pages/admin/EmployeeApproval';
import Departments from './pages/admin/Departments';
import LeaveTypes from './pages/admin/LeaveTypes';
import AdminCalendar from './pages/admin/AdminCalendar';
import AdminNotifications from './pages/admin/AdminNotifications';
import AdminProfile from './pages/admin/AdminProfile';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  public?: boolean;
}

export const routes: RouteConfig[] = [
  // Home
  { name: 'Home', path: '/', element: <HomePage />, public: true },

  // Staff auth
  { name: 'Staff Login', path: '/staff/login', element: <StaffLogin />, public: true },
  { name: 'Staff Register', path: '/staff/register', element: <StaffRegister />, public: true },
  { name: 'Staff Forgot Password', path: '/staff/forgot-password', element: <ForgotCredentials role="staff" />, public: true },
  { name: 'Staff Forgot Username', path: '/staff/forgot-username', element: <ForgotUsername role="staff" />, public: true },

  // Admin auth
  { name: 'Admin Login', path: '/admin/login', element: <AdminLogin />, public: true },
  { name: 'Admin Register', path: '/admin/register', element: <AdminRegister />, public: true },
  { name: 'Admin Forgot Password', path: '/admin/forgot-password', element: <ForgotCredentials role="admin" />, public: true },
  { name: 'Admin Forgot Username', path: '/admin/forgot-username', element: <ForgotUsername role="admin" />, public: true },

  // Staff portal
  { name: 'Staff Dashboard', path: '/staff/dashboard', element: <StaffDashboard /> },
  { name: 'Apply Leave', path: '/staff/apply-leave', element: <ApplyLeave /> },
  { name: 'Leave History', path: '/staff/leave-history', element: <LeaveHistory /> },
  { name: 'Leave Calendar', path: '/staff/calendar', element: <LeaveCalendar /> },
  { name: 'Staff Profile', path: '/staff/profile', element: <StaffProfile /> },
  { name: 'Staff Notifications', path: '/staff/notifications', element: <StaffNotifications /> },

  // Admin portal
  { name: 'Admin Dashboard', path: '/admin/dashboard', element: <AdminDashboard /> },
  { name: 'Pending Applications', path: '/admin/pending', element: <PendingApplications /> },
  { name: 'All Applications', path: '/admin/applications', element: <AllApplications /> },
  { name: 'Analytics', path: '/admin/analytics', element: <Analytics /> },
  { name: 'Employee Approval', path: '/admin/employees', element: <EmployeeApproval /> },
  { name: 'Departments', path: '/admin/departments', element: <Departments /> },
  { name: 'Leave Types', path: '/admin/leave-types', element: <LeaveTypes /> },
  { name: 'Admin Calendar', path: '/admin/calendar', element: <AdminCalendar /> },
  { name: 'Admin Notifications', path: '/admin/notifications', element: <AdminNotifications /> },
  { name: 'Admin Profile', path: '/admin/profile', element: <AdminProfile /> },
];
