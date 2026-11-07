/**
 * The two user roles. Single source of truth for role names in the app.
 * The database has the same values in the `public.user_role` enum
 * (features/logic/migrations/20261107000000_create_profiles.sql); keep them in sync.
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
