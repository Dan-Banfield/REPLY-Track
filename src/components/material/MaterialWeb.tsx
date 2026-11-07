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
 */
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';

export function MaterialWeb() {
  return null;
}
