import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';

import { MaterialWeb } from '@/components/material/MaterialWeb';

// Order matters: M3 tokens first, then the M3 type scale classes, then app globals.
import '@/theme/theme.css';
import '@material/web/typography/md-typescale-styles.css';
import './globals.css';

const roboto = Roboto({
  subsets: ['latin'],
  variable: '--font-roboto',
});

export const metadata: Metadata = {
  // Pages set `title: 'Sign in'` etc. and get "Sign in · REPLY Track".
  title: { default: 'REPLY Track', template: '%s · REPLY Track' },
  description: 'Dashboard for teachers and students',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={roboto.variable}>
      <body>
        <MaterialWeb />
        {children}
      </body>
    </html>
  );
}
