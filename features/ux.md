# UI and design

The Material 3 theme, the components used, the layout, how navigation works and what each role sees. Read it together with [`logic.md`](./logic.md), which covers the app logic.

_Last updated: step 1 of 7 (project setup)._

---

## Current state

**Built and working**

- Material Design 3 theme with **light and dark** colour schemes (dark follows the OS setting).
- Roboto font and the official M3 **type scale** classes.
- Material Web components are registered and type-safe in JSX. Currently registered: `md-filled-button`, `md-outlined-button`.
- `/` is a **temporary** theme check page (heading, body text, a filled and an outlined button). Step 3 replaces it.

**Not built yet**

- Login page, dashboard layout, navigation, Overview page and role-specific content. See [Next steps](#next-steps).

---

## How it works

### Component library: Material Web (`@material/web`)

- **Why:** it is Google's official Material Design 3 implementation for the web, and it is driven entirely by the M3 design tokens (`--md-sys-*` CSS custom properties). MUI was ruled out because it still implements Material Design 2.
- Components are **web components** (custom elements built with Lit). React 19 supports custom elements natively, so they are used directly as tags: `<md-filled-button>`.
- Catalogue and API docs: https://material-web.dev/ (the component list is under "Components"). The examples there can be pasted into JSX almost as-is.

**Registering a component (one line):**

1. Add its import to `src/components/material/MaterialWeb.tsx`, e.g.
   `import '@material/web/textfield/outlined-text-field.js';`
2. Use the tag: `<md-outlined-text-field label="Email" />`.

`src/components/material/material-web.d.ts` reads Material Web's own `HTMLElementTagNameMap` declarations, so the new tag is typed for JSX automatically:

- element properties are typed props (e.g. `disabled` must be a boolean)
- standard React props (`className`, `style`, `onClick`, `ref`, …) work
- unregistered `md-*` tags are a type error

**How registration works:** `MaterialWeb.tsx` is a client component (`'use client'`) rendered once in the root layout. It renders nothing, but its imports define the custom elements in the browser before React hydrates. On the server the tags are rendered as plain HTML. Lit ships a Node build, so the imports don't crash during server rendering.

### Theme (design tokens)

All theme values live in **`src/theme/theme.css`**:

- **Colour:** the full set of M3 colour roles (`--md-sys-color-primary`, `-on-primary`, `-surface`, `-surface-container-*`, `-outline`, …) for light mode in `:root`, and for dark mode inside `@media (prefers-color-scheme: dark)`.
  - Generated from the M3 baseline seed colour **`#6750A4`** with the **Tonal Spot** scheme (the M3 default) from Google's `material-color-utilities`, the same library Material Theme Builder uses. The resulting primary is `#65558F` (light) / `#CFBDFE` (dark).
- **Typeface:** `--md-ref-typeface-brand` and `--md-ref-typeface-plain` point to Roboto, which `next/font/google` loads in `src/app/layout.tsx` (CSS variable `--font-roboto`).
- **Shape, elevation, motion:** Material Web's built-in M3 defaults. Nothing is overridden.

**To change the brand colour:** open [Material Theme Builder](https://material-foundation.github.io/material-theme-builder/), pick a seed colour, export **Web (CSS)**, and replace the `--md-sys-color-*` values in both blocks of `theme.css` (light → `:root`, dark → the media query). Keep the token names; every component reads them.

### Typography

- The M3 type scale comes from `@material/web/typography/md-typescale-styles.css` (imported in `layout.tsx`). Use its classes on regular HTML elements:
  `md-typescale-display-{large,medium,small}`, `-headline-*`, `-title-*`, `-body-*`, `-label-*`.
  Example: `<h1 className="md-typescale-headline-medium">`.
- These classes sit in a CSS cascade layer, so app styles override them without specificity fights.

### Styling rules for app code

- Use **CSS Modules** (`*.module.css`, built into Next) for layout and spacing.
- Use **tokens only** for colour and type: `var(--md-sys-color-…)` and the `md-typescale-*` classes. No hard-coded colours.
- Keep `src/app/globals.css` tiny: box-sizing, body surface/text colour and font, and the rule that hides undefined custom elements.
- To restyle one Material Web component, set its component tokens (e.g. `--md-filled-button-container-color`) in CSS rather than overriding internals. Each component's tokens are listed on its material-web.dev page.

### Layout

Not built yet. Step 5 adds the dashboard layout and navigation. This section will describe it.

### Navigation config

Not built yet. Step 5 adds a single config array (one entry per page, with the roles that can see it). This section will explain how to add a page.

### What each role sees

Not built yet (steps 4–6).

---

## Next steps

- [ ] **Step 2:** login page with M3 text fields (`md-outlined-text-field`) and a filled button.
- [ ] **Step 5:** dashboard layout with an M3 navigation rail or drawer built from the config array, plus logout. Material Symbols icons will be added then. `next/font` doesn't ship Material Symbols, so it will be a separate font import.
- [ ] **Step 6:** Overview page with different placeholder content for teachers and students.
- Remove the temporary theme check page at `/` (step 3).

---

## Gotchas

- **Material Web is in maintenance mode upstream** (stable releases, few new components). The navigation drawer/bar exist only under `@material/web/labs/` (unstable API), and there is no navigation rail component at all. The rail/drawer in step 5 may need to be composed from stable parts (list, ripple, focus ring, icon) styled with M3 tokens.
- **Use kebab-case attributes for string config** on Material Web tags, exactly as in the material-web.dev docs (e.g. `supporting-text="…"`). These are rendered into the server HTML, so the first paint is correct. camelCase props (e.g. `supportingText`) are only applied as properties after the browser loads the JS. TypeScript allows any hyphenated attribute without type checking, so double-check spelling.
- **Undefined custom elements are hidden** (`:not(:defined) { visibility: hidden }` in `globals.css`) to avoid a flash of unstyled text before the JS loads. If JavaScript fails to load, Material Web components stay invisible.
- **Some Material Web props are typed loosely by the library itself.** For example, `type` on buttons is `string`, so `type="nope"` is not caught by TypeScript.
- **"Lit is in dev mode" console message** appears only with `npm run dev`. It is expected and does not appear in production builds.
- **Dark mode follows the OS.** There is no in-app toggle (out of scope).
