'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useLogout } from '@/components/auth/LogoutButton';
import type { NavItem } from '@/config/navigation';

import styles from './NavigationRail.module.css';

/**
 * M3 navigation rail (https://m3.material.io/components/navigation-rail).
 *
 * Material Web has no rail component, so this is composed from stable parts
 * (md-icon, md-ripple, md-focus-ring) styled with M3 tokens. Destinations come
 * from the server, already filtered by role; the active one is derived from
 * the URL. "Log out" sits at the bottom.
 */
export function NavigationRail({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();
  const activeHref = findActiveHref(items, pathname);
  const { pending, logOut } = useLogout();

  return (
    <nav className={styles.rail} aria-label="Main">
      <ul className={styles.destinations}>
        {items.map((item) => {
          const active = item.href === activeHref;
          const id = controlId(item.href);
          return (
            <li key={item.href}>
              <Link
                id={id}
                href={item.href}
                className={styles.item}
                aria-current={active ? 'page' : undefined}
              >
                <ItemVisual controlId={id} icon={item.icon} label={item.label} active={active} />
              </Link>
            </li>
          );
        })}
      </ul>

      <button
        id="nav-logout"
        type="button"
        className={`${styles.item} ${styles.logout}`}
        onClick={logOut}
        disabled={pending}
      >
        <ItemVisual controlId="nav-logout" icon="logout" label="Log out" active={false} />
      </button>
    </nav>
  );
}

/**
 * Empty rail with the same size and colour, shown while the real one streams
 * in. It has no controls or ids on purpose: during streaming both exist in
 * the DOM for a moment, and duplicate ids would confuse `for` lookups.
 */
export function NavigationRailSkeleton() {
  return <div className={styles.rail} aria-hidden="true" />;
}

/** Active indicator (pill) with icon, ripple and focus ring, plus the label. */
function ItemVisual({
  controlId,
  icon,
  label,
  active,
}: {
  controlId: string;
  icon: string;
  label: string;
  active: boolean;
}) {
  return (
    <>
      <span className={styles.indicator} data-active={active || undefined}>
        {/* `for`: react to the whole item (link/button), but draw on the pill.
            suppressHydrationWarning: both add aria-hidden on startup (see MaterialWeb.tsx). */}
        <md-ripple for={controlId} suppressHydrationWarning />
        <md-focus-ring for={controlId} suppressHydrationWarning />
        <md-icon aria-hidden="true">{icon}</md-icon>
      </span>
      <span className="md-typescale-label-medium">{label}</span>
    </>
  );
}

/**
 * The item whose href best matches the current path (longest prefix wins), so
 * a nested page like /dashboard/classes highlights its own item, not Overview.
 */
function findActiveHref(items: readonly NavItem[], pathname: string): string | undefined {
  return items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

/** CSS-safe element id (Material Web finds `htmlFor` targets with querySelector('#id')). */
function controlId(href: string): string {
  return `nav${href.replace(/[^a-zA-Z0-9]+/g, '-')}`;
}
