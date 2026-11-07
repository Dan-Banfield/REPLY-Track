import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';

import { MATERIAL_SYMBOLS_URL } from '@features/ux/material/material-symbols';
import { MaterialWeb } from '@features/ux/material/MaterialWeb';

// Order matters: M3 tokens first, then the M3 type scale classes, then app globals.
import '@features/ux/theme/theme.css';
import '@material/web/typography/md-typescale-styles.css';
import '@features/ux/theme/globals.css';

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
      {/* <head> is correct in an App Router root layout. The lint rule targets the
          Pages Router and fires only because this file lives outside src/app. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        {/* Icon font for <md-icon>, limited to the icons the app uses. */}
        <link rel="stylesheet" href={MATERIAL_SYMBOLS_URL} />
      </head>
      <body>
        <MaterialWeb />
        {children}
      </body>
    </html>
  );
}
