/** Where logged-out users are sent. */
export const LOGIN_PATH = '/login';

/** Where logged-in users land: the dashboard's Overview page. */
export const HOME_PATH = '/dashboard';

/**
 * Pages a logged-out user may open. Every other page requires a session.
 * Logged-in users who open one of these are sent to HOME_PATH instead.
 */
export const PUBLIC_PATHS: readonly string[] = ['/login', '/signup'];
