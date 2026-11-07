import { NAV_ITEMS } from '@/config/navigation';

/**
 * Icons used outside the navigation config. When you use <md-icon>name</md-icon>
 * anywhere else, add the name here, or it renders as plain text.
 */
const OTHER_ICONS = ['logout'];

const iconNames = [...new Set([...NAV_ITEMS.map((item) => item.icon), ...OTHER_ICONS])].sort();

/**
 * Google Fonts stylesheet for Material Symbols Outlined (the font <md-icon>
 * uses), limited to the icons the app needs via `icon_names` so the download
 * stays tiny. Supports the FILL axis (0..1) for active navigation icons.
 * `next/font` doesn't support Material Symbols, hence a plain stylesheet link.
 */
export const MATERIAL_SYMBOLS_URL =
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0' +
  `&icon_names=${iconNames.join(',')}&display=block`;
