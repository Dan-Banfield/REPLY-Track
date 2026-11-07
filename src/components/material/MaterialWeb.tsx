'use client';

/**
 * Registers the Material Web (M3) custom elements used by the app.
 *
 * To use another M3 component, add its import below. Its tag (e.g.
 * <md-outlined-text-field>) is then typed for JSX automatically; see
 * ./material-web.d.ts. Component catalogue: https://material-web.dev/
 *
 * This module runs in the browser, which defines the elements before React
 * hydrates. It is rendered once in the root layout.
 *
 * Hydration: some elements add attributes to themselves when they start up,
 * before React hydrates, which React reports as a mismatch in dev. Give these
 * the `suppressHydrationWarning` prop wherever they are used:
 *   - md-outlined-text-field (adds inputmode="")
 *   - md-radio               (adds tabindex)
 *   - md-ripple              (adds aria-hidden)
 *   - md-focus-ring          (adds aria-hidden)
 * When registering a new component, check the dev console for
 * "A tree hydrated but some attributes ... didn't match" and extend this list.
 */
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';
import '@material/web/focus/md-focus-ring.js';
import '@material/web/icon/icon.js';
import '@material/web/radio/radio.js';
import '@material/web/ripple/ripple.js';
import '@material/web/textfield/outlined-text-field.js';

export function MaterialWeb() {
  return null;
}
