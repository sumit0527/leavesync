export type CollegeUnit = 'junior' | 'senior' | 'pharmacy';
export type AdminDesignation = 'principal' | 'uh';

export const COLLEGE_UNITS: { value: CollegeUnit; label: string; shortLabel: string }[] = [
  { value: 'junior', label: 'Junior College', shortLabel: 'Junior' },
  { value: 'senior', label: 'Senior College', shortLabel: 'Senior' },
  { value: 'pharmacy', label: 'Pharmacy College', shortLabel: 'Pharmacy' },
];

export const ADMIN_DESIGNATIONS: { value: AdminDesignation; label: string }[] = [
  { value: 'principal', label: 'Principal' },
  { value: 'uh', label: 'UH' },
];

export function formatCollegeUnit(unit?: string | null) {
  return COLLEGE_UNITS.find((item) => item.value === unit)?.label ?? 'Unit Not Assigned';
}

export function formatAdminDesignation(designation?: string | null) {
  if (designation === 'uh') return 'UH';
  if (designation === 'principal') return 'Principal';
  return 'Principal / UH';
}

export function formatManagementScope(profile?: { role?: string | null; college_unit?: string | null; admin_designation?: string | null } | null) {
  const role = String(profile?.role ?? '').toLowerCase();
  if (role === 'main_admin' || role === 'director') return 'Director';
  if (role === 'viewer') return 'Viewer';
  if (role === 'admin' || role === 'principal') {
    const unit = formatCollegeUnit(profile?.college_unit);
    const designation = formatAdminDesignation(profile?.admin_designation);
    return `${unit} ${designation}`;
  }
  return formatCollegeUnit(profile?.college_unit);
}

export function sameCollegeUnit(a?: string | null, b?: string | null) {
  return Boolean(a && b && a === b);
}


export type ManagementSectionValue = 'all' | `${CollegeUnit}-staff` | `${CollegeUnit}-admin`;

export const MANAGEMENT_SECTIONS: { value: ManagementSectionValue; label: string; unit?: CollegeUnit; group?: 'staff' | 'admin' }[] = [
  { value: 'all', label: 'All Current Records' },
  { value: 'senior-staff', label: 'Senior Staff', unit: 'senior', group: 'staff' },
  { value: 'senior-admin', label: 'Senior Principal / UH', unit: 'senior', group: 'admin' },
  { value: 'junior-staff', label: 'Junior Staff', unit: 'junior', group: 'staff' },
  { value: 'junior-admin', label: 'Junior Principal / UH', unit: 'junior', group: 'admin' },
  { value: 'pharmacy-staff', label: 'Pharmacy Staff', unit: 'pharmacy', group: 'staff' },
  { value: 'pharmacy-admin', label: 'Pharmacy Principal / UH', unit: 'pharmacy', group: 'admin' },
];

export function formatRoleForManagement(role?: string | null, designation?: string | null) {
  const normalized = String(role ?? '').toLowerCase();
  if (normalized === 'staff') return 'Staff';
  if (normalized === 'admin' || normalized === 'principal') return formatAdminDesignation(designation);
  if (normalized === 'main_admin' || normalized === 'director') return 'Director';
  if (normalized === 'viewer') return 'Viewer';
  return 'User';
}
