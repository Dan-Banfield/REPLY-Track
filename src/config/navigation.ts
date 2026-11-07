import type { Role } from '@/lib/auth/roles';

export type NavItem = {
  /** Text under the icon in the navigation rail. Keep it short (one word). */
  label: string;
  /** Page URL. Pages live under /dashboard so they get the dashboard layout. */
  href: string;
  /** Material Symbols icon name, e.g. 'dashboard'. Browse: https://fonts.google.com/icons */
  icon: string;
  /** Roles that see this item in the navigation. */
  roles: readonly Role[];
};

/**
 * The dashboard navigation. Adding a page = adding one entry here (plus the
 * page file). Items appear in this order. See features/ux.md, "Navigation config".
 *
 * `roles` only controls who SEES the item. A page meant for some roles must
 * also check the role itself (see features/logic.md, "Role-restricted pages").
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: 'dashboard', roles: ['teacher', 'student'] },
];

/** The navigation items a user with this role may see. */
export function navItemsFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
