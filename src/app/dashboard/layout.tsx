import { Suspense } from 'react';

import { NavigationRail, NavigationRailSkeleton } from '@/components/navigation/NavigationRail';
import { navItemsFor } from '@/config/navigation';
import { getCurrentUser } from '@/lib/auth/session';

import styles from './layout.module.css';

/**
 * Shell for every page under /dashboard: navigation rail on the left, page
 * content on the right.
 *
 * Which items the rail shows depends on the user's role (request data), so
 * the rail streams in behind Suspense. The fallback is an empty rail of the
 * same size, so the page content doesn't shift when the rail arrives.
 */
export default function DashboardLayout({ children }: LayoutProps<'/dashboard'>) {
  return (
    <div className={styles.shell}>
      <Suspense fallback={<NavigationRailSkeleton />}>
        <RoleNavigation />
      </Suspense>
      <main className={styles.content}>{children}</main>
    </div>
  );
}

async function RoleNavigation() {
  const { role } = await getCurrentUser();
  return <NavigationRail items={navItemsFor(role)} />;
}
