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
