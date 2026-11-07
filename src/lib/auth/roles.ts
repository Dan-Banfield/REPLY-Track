/**
 * The two user roles. Single source of truth for role names in the app.
 * The database enforces the same values (see features/logic.md, "Roles").
 */
export const ROLES = ['teacher', 'student'] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  teacher: 'Teacher',
  student: 'Student',
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
