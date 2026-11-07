/** Where logged-out users are sent. */
export const LOGIN_PATH = '/login';

/** Where logged-in users land: the dashboard's Overview page. */
export const HOME_PATH = '/dashboard';

/**
 * Pages a logged-out user may open. Every other page requires a session.
 * Logged-in users who open one of these are sent to HOME_PATH instead.
 */
export const PUBLIC_PATHS: readonly string[] = ['/login', '/signup'];

/**
 * Route Handlers live under this prefix. Logged-out requests to them get a
 * JSON 401 from the proxy instead of a redirect to the login page.
 */
export const API_PREFIX = '/api/';
