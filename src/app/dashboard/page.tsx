import type { Metadata } from 'next';
import { Suspense, type ComponentType } from 'react';

import type { Role } from '@/lib/auth/roles';
import { getCurrentUser, type CurrentUser } from '@/lib/auth/session';

import { StudentOverview } from './_overview/StudentOverview';
import { TeacherOverview } from './_overview/TeacherOverview';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Overview',
};

/**
 * The Overview content for each role. TypeScript requires an entry for every
 * role in ROLES, so adding a role means adding its Overview here.
 */
const OVERVIEW_BY_ROLE: Record<Role, ComponentType<{ user: CurrentUser }>> = {
  teacher: TeacherOverview,
  student: StudentOverview,
};

export default function OverviewPage() {
  return (
    <div className={styles.page}>
      <h1 className="md-typescale-headline-medium">Overview</h1>
      {/* Depends on the user's role (request data), so it streams in behind Suspense. */}
      <Suspense fallback={<p className="md-typescale-body-large">Loading…</p>}>
        <RoleOverview />
      </Suspense>
    </div>
  );
}

async function RoleOverview() {
  const user = await getCurrentUser();
  const Overview = OVERVIEW_BY_ROLE[user.role];
  return <Overview user={user} />;
}
