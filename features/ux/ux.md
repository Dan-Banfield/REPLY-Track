# UI and design

The Material 3 theme, the components used, the layout, how navigation works and what each role sees. Read it together with [`logic.md`](../logic/logic.md), which covers the app logic.

_Last updated: after step 7. The UI code now lives in this folder (`features/ux/`)._

---

## Current state

**Built and working**

- Material Design 3 theme with **light and dark** colour schemes (dark follows the OS setting).
- Roboto font and the official M3 **type scale** classes.
- Material Web components are registered and type-safe in JSX. Currently registered: `md-filled-button`, `md-outlined-button`, `md-text-button`, `md-radio`, `md-outlined-text-field`, `md-icon`, `md-ripple`, `md-focus-ring`.
- **Material Symbols** icons (Outlined), loaded from Google Fonts and limited to the icons the app uses.
- **Login page** (`/login`) and **sign-up page** (`/signup`), sharing one M3 outlined-card layout. Each links to the other.
- **Dashboard layout** (`/dashboard/**`): an M3 **navigation rail** on the left, page content on the right. The rail is built from one config array (`features/ux/navigation/navigation.ts`), filtered by role, with **Log out** at the bottom. It currently has one destination: **Overview** (`/dashboard`).
- **Overview page** (`/dashboard`): a welcome line and three placeholder cards (M3 filled cards). The cards are different for teachers and students.
- **Error page** for every route: "Something went wrong" with **Try again** (filled) and **Log out** (outlined).
- Users never see a page at `/`. They are redirected to `/login` or `/dashboard`.
- Reusable form building blocks: `MaterialForm`, `SubmitButton`, `FormError` (`features/ux/material/MaterialForm.tsx`).
- Page titles use the template `<Page> · REPLY Track` (e.g. "Sign in · REPLY Track", "Overview · REPLY Track").
- No hydration warnings in the dev console (see the [hydration rule](#hydration-rule-for-material-web-elements)).

**Not built yet**

- Real content behind the Overview cards (they are placeholders). See [Next steps](#next-steps).

---

## How it works

### Where the UI code lives

Everything this document describes lives next to it in **`features/ux/`**:

| Folder | Contents |
| --- | --- |
| `theme/` | `theme.css` (M3 design tokens, light + dark), `globals.css` (tiny base styles) |
| `material/` | `MaterialWeb.tsx` (component registration), `material-web.d.ts` (JSX types), `MaterialForm.tsx` (+ `.module.css`), `material-symbols.ts` (icon font URL) |
| `navigation/` | `navigation.ts` (`NAV_ITEMS` config), `NavigationRail.tsx` (+ `.module.css`) |
| `root/` | `RootLayout.tsx` (fonts, theme CSS, Material Web), `ErrorPage.tsx` |
| `auth/` | `AuthLayout.tsx`, `AuthHeader.tsx`, `auth.module.css`, `LoginPage.tsx`, `LoginForm.tsx`, `SignupPage.tsx`, `SignupForm.tsx`, `LogoutButton.tsx` |
| `dashboard/` | `DashboardLayout.tsx` (+ `.module.css`), `OverviewPage.tsx` (+ `.module.css`), `overview/` (`TeacherOverview`, `StudentOverview`, `PlaceholderCard`, `overview.module.css`) |

Next.js only picks up routes from `src/app/`, so each screen also has a **one-line route entry** there that re-exports it. For example, `src/app/(auth)/login/page.tsx` contains `export { default, metadata } from '@features/ux/auth/LoginPage';`. Behaviour and data (Server Actions, `getCurrentUser()`, roles, Supabase) come from `features/logic/` (see [`logic.md`](../logic/logic.md), "Folder structure").

### Component library: Material Web (`@material/web`)

- **Why:** it is Google's official Material Design 3 implementation for the web, and it is driven entirely by the M3 design tokens (`--md-sys-*` CSS custom properties). MUI was ruled out because it still implements Material Design 2.
- Components are **web components** (custom elements built with Lit). React 19 supports custom elements natively, so they are used directly as tags: `<md-filled-button>`.
- Catalogue and API docs: https://material-web.dev/ (the component list is under "Components"). The examples there can be pasted into JSX almost as-is.

**Registering a component (one line):**

1. Add its import to `features/ux/material/MaterialWeb.tsx`, e.g.
   `import '@material/web/checkbox/checkbox.js';`
2. Use the tag: `<md-checkbox />`.

Keep the list to components that are actually used. Remove an import when its last usage goes away.

`features/ux/material/material-web.d.ts` reads Material Web's own `HTMLElementTagNameMap` declarations, so the new tag is typed for JSX automatically:

- element properties are typed props (e.g. `disabled` must be a boolean)
- standard React props (`className`, `style`, `onClick`, `ref`, …) work
- unregistered `md-*` tags are a type error

**How registration works:** `MaterialWeb.tsx` is a client component (`'use client'`) rendered once in the root layout. It renders nothing, but its imports define the custom elements in the browser before React hydrates. On the server the tags are rendered as plain HTML. Lit ships a Node build, so the imports don't crash during server rendering.

#### Hydration rule for Material Web elements

Because the elements start up *before* React hydrates, some of them add attributes to themselves that React never rendered. React then logs "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties" in the dev console. Give these elements the **`suppressHydrationWarning`** prop wherever they are used:

| Element | Attribute it adds itself |
| --- | --- |
| `md-outlined-text-field` | `inputmode=""` |
| `md-radio` | `tabindex` (managed by the radio group for keyboard focus) |
| `md-ripple` | `aria-hidden="true"` |
| `md-focus-ring` | `aria-hidden="true"` |

Buttons (`md-filled-button`, `md-outlined-button`, `md-text-button`) and `md-icon` (when you pass `aria-hidden="true"` yourself) don't need it. When you register a new component, load a page that uses it with `npm run dev` and check the console for that message. If it appears, add the element to this table and to the comment in `MaterialWeb.tsx`. The warning only affects that one element's attributes, so it doesn't hide problems elsewhere.

### Theme (design tokens)

All theme values live in **`features/ux/theme/theme.css`**:

- **Colour:** the full set of M3 colour roles (`--md-sys-color-primary`, `-on-primary`, `-surface`, `-surface-container-*`, `-outline`, …) for light mode in `:root`, and for dark mode inside `@media (prefers-color-scheme: dark)`.
  - Generated from the M3 baseline seed colour **`#6750A4`** with the **Tonal Spot** scheme (the M3 default) from Google's `material-color-utilities`, the same library Material Theme Builder uses. The resulting primary is `#65558F` (light) / `#CFBDFE` (dark).
- **Typeface:** `--md-ref-typeface-brand` and `--md-ref-typeface-plain` point to Roboto, which `next/font/google` loads in `features/ux/root/RootLayout.tsx` (CSS variable `--font-roboto`).
- **Shape, elevation, motion:** Material Web's built-in M3 defaults. Nothing is overridden. App CSS may read shape tokens with a fallback, e.g. `var(--md-sys-shape-corner-medium, 12px)`.

**To change the brand colour:** open [Material Theme Builder](https://material-foundation.github.io/material-theme-builder/), pick a seed colour, export **Web (CSS)**, and replace the `--md-sys-color-*` values in both blocks of `theme.css` (light → `:root`, dark → the media query). Keep the token names; every component reads them.

### Icons (Material Symbols)

- `<md-icon>name</md-icon>` renders a [Material Symbols](https://fonts.google.com/icons) icon by name (Outlined style, 24px).
- The font is a stylesheet `<link>` in `features/ux/root/RootLayout.tsx`. Its URL is built in `features/ux/material/material-symbols.ts` and asks Google Fonts for **only the icons the app uses** (`&icon_names=…`), so the download stays a few KB. The list is made automatically from:
  - every `icon` in `NAV_ITEMS` (`features/ux/navigation/navigation.ts`), and
  - `OTHER_ICONS` in `material-symbols.ts` (currently `logout`).
- **Using an icon anywhere outside the nav config? Add its name to `OTHER_ICONS`**, or it shows up as plain text (e.g. the word "settings").
- The FILL axis is included: `font-variation-settings: 'FILL' 1` gives the filled version (used for the active rail item).
- `next/font` doesn't support Material Symbols, which is why this one font comes straight from Google Fonts.

### Typography

- The M3 type scale comes from `@material/web/typography/md-typescale-styles.css` (imported in `root/RootLayout.tsx`). Use its classes on regular HTML elements:
  `md-typescale-display-{large,medium,small}`, `-headline-*`, `-title-*`, `-body-*`, `-label-*`.
  Example: `<h1 className="md-typescale-headline-medium">`.
- These classes sit in a CSS cascade layer, so app styles override them without specificity fights.

### Styling rules for app code

- Use **CSS Modules** (`*.module.css`, built into Next) for layout and spacing. They sit next to the component that uses them, in the same feature folder, and are imported relatively (`./auth.module.css`).
- Use **tokens only** for colour and type: `var(--md-sys-color-…)` and the `md-typescale-*` classes. No hard-coded colours.
- Keep `features/ux/theme/globals.css` tiny: box-sizing, body surface/text colour and font, and the rule that hides undefined custom elements.
- To restyle one Material Web component, set its component tokens (e.g. `--md-filled-button-container-color`) in CSS rather than overriding internals. Each component's tokens are listed on its material-web.dev page.
- Cards: Material Web's card is still in `labs/`, so cards are plain elements styled with tokens. The auth card follows the **outlined card** spec: `surface` background, 1px `outline-variant` border, medium corners.
- Notices (non-error messages) use a tonal container: `secondary-container` background with `on-secondary-container` text and small corners (`.notice` in `auth.module.css`).

### Auth pages (`/login`, `/signup`)

Their code is in `features/ux/auth/`; the route entries are in the `src/app/(auth)/` route group (the group name isn't part of the URL). They share:

- `features/ux/auth/AuthLayout.tsx`: the centred outlined card (max 400px wide). Its `<section>` is labelled by the page's `<h1 id="auth-title">`.
- `features/ux/auth/AuthHeader.tsx`: app name (title-medium, primary colour) above the page title (headline-small, the `<h1>`).
- `features/ux/auth/auth.module.css`: card, header, notice, the "switch" line at the bottom, and the role radio group.

**Login (`/login`)**

```
┌──────────────── outlined card (max 400px, centred) ────────────────┐
│ REPLY Track                                                         │
│ Sign in                                                             │
│ [ Account created. Check your email… ]  ← notice, only after sign-up │
│ ┌ Email* ───────────────────────────┐  md-outlined-text-field       │
│ ┌ Password* ────────────────────────┐  md-outlined-text-field       │
│ Incorrect email or password.          ← FormError (error colour)    │
│ (          Sign in          )         ← SubmitButton (filled)       │
│        Don't have an account? [Sign up] ← md-text-button → /signup   │
└─────────────────────────────────────────────────────────────────────┘
```

- The notice appears for `/login?signup=confirm` ("Account created. Check your email to confirm your address, then sign in.") or `?signup=done` ("Account created. You can now sign in."). It has `role="status"`.

**Sign-up (`/signup`)**

```
┌──────────────────────────────────────────────┐
│ REPLY Track                                  │
│ Create an account                            │
│ ┌ Email* ─────────────────────┐              │
│ ┌ Password* ──────────────────┐              │
│   At least 6 characters  ← supporting text   │
│ I am a…                  ← <legend>          │
│ (○) Teacher   (○) Student  ← md-radio + <label> │
│ (       Create account       )               │
│   Already have an account? [Sign in] → /login │
└──────────────────────────────────────────────┘
```

- The role is a native `<fieldset>`/`<legend>` group of `md-radio` elements (`name="role"`, `required`, no default). Clicking the label selects the radio. The options come from `ROLES` / `ROLE_LABELS` in `features/logic/auth/roles.ts`, so a new role appears automatically.
- After a successful sign-up the user is sent to `/login` with the notice above.

**Shared behaviour**

- **Validation:** empty fields, a malformed email or a short password are caught by the fields themselves (`required`, `type="email"`, `minLength`) and shown with M3 error styling. A missing role choice shows the browser's validation bubble on the first radio. Nothing is sent until the form is valid.
- **Server errors** (wrong password, existing account, Supabase unreachable, …) appear as one line in the error colour above the button, with `role="alert"`.
- **Pending state:** the button is disabled and reads "Signing in…" / "Creating account…".
- **After a failed attempt** all fields keep their values (including the selected role).
- **Keyboard:** Enter in any text field submits; Tab reaches the button, and Enter/Space on it submits.
- The "Sign up" / "Sign in" switch links are `md-text-button href=…`, which is a full page load. That's fine for these small static pages, and it starts each form fresh.

### Forms with Material Web (use the shared components)

Every form should be built from `features/ux/material/MaterialForm.tsx`:

```tsx
const [state, formAction, pending] = useActionState(myAction, { error: null });

<MaterialForm action={formAction}>
  <md-outlined-text-field label="Name" name="name" required />
  <FormError message={state.error} />
  <SubmitButton pending={pending} pendingLabel="Saving…">Save</SubmitButton>
</MaterialForm>
```

- `MaterialForm` is a column layout with a 16px gap, and text fields inside it are full width.
- `FormError` renders the error line, or nothing when there's no error.
- `SubmitButton` is the full-width filled button.

They exist because three things break with a plain `<form action>` and Material Web:

1. **A Material Web button with `type="submit"` makes React throw.** It reports itself as the form's `submitter`, and React 19 then calls `new FormData(form, submitter)`, which throws for custom elements ("The specified element is not a submit button"). In dev that triggers Next's error overlay. `SubmitButton` is therefore `type="button"` and calls `form.requestSubmit()`.
2. **Enter in a text field doesn't submit.** The real `<input>` is in shadow DOM, so the browser's built-in behaviour doesn't apply. `MaterialForm`'s `onKeyDown` calls `requestSubmit()` for Enter in any `md-*-text-field`.
3. **React resets a form after its action finishes**, and Material Web fields clear themselves on reset, which would wipe the fields after a failed submit. `MaterialForm` submits via `onSubmit` + `startTransition(() => action(formData))` instead of `<form action>`.

Material Web fields and radios are form-associated, so `new FormData(form)` picks up their values by `name`, like native inputs.

### Dashboard layout (`features/ux/dashboard/DashboardLayout.tsx`)

Every page under `/dashboard` gets this shell:

```
┌──────┬─────────────────────────────────────────────┐
│ ▣    │ Overview                  ← page <h1>        │
│Overv.│ Welcome, you@x.com. …     ← page content     │
│      │                                              │
│      │   <main>: the page, 24px padding             │
│      │                                              │
│ ⇥    │                                              │
│Log out│                                             │
└──────┴─────────────────────────────────────────────┘
 80px rail (surface-container), sticky, full height
```

- `<div class="shell">` is a flex row: the rail, then `<main class="content">` (flex: 1, padding 24px).
- The rail depends on the user's role, so it streams in behind `<Suspense>`. The fallback is `NavigationRailSkeleton`, an empty rail of the same size and colour, so the content never shifts.
- The rail stays visible at all widths (it takes 80px on a 360px phone; tested without horizontal scrolling).

### Navigation rail (`features/ux/navigation/NavigationRail.tsx`)

M3 spec: https://m3.material.io/components/navigation-rail. Material Web has no rail component, so it is composed from stable parts and styled with tokens (`NavigationRail.module.css`):

| Part | Implementation | Tokens |
| --- | --- | --- |
| Container | `<nav aria-label="Main">`, 80px wide, `position: sticky`, full height, destinations from 44px down, 12px apart | `surface-container` |
| Destination | Next `<Link>` (client-side navigation), a column of indicator + label | label `on-surface-variant`, active label `on-surface` |
| Active indicator | 56×32 pill (`corner-full`) around the icon | `secondary-container`; icon `on-secondary-container`, filled (`'FILL' 1`) |
| Icon | `<md-icon aria-hidden="true">` | inactive `on-surface-variant`, outlined |
| Label | `md-typescale-label-medium` | |
| Hover / press | `<md-ripple for={id}>` inside the pill: reacts to the whole item, draws on the pill | on-surface (active: on-secondary-container) |
| Keyboard focus | `<md-focus-ring for={id}>` inside the pill | `secondary` |
| Log out | Same visual as a destination (`logout` icon), a `<button>` pinned to the bottom (`margin-top: auto`). Disabled at 38% opacity while signing out | |

- **Active item:** the destination whose `href` is the longest prefix of the current URL. `/dashboard/classes` highlights "Classes", not "Overview". It gets `aria-current="page"`.
- **Accessibility:** a real `<nav>` with a `<ul>` of links; icons are hidden from screen readers because the label names the item. Tab order: destinations top to bottom, then Log out.
- **Log out** in the rail uses `useLogout()` from `features/ux/auth/LogoutButton.tsx`, the same behaviour as the standalone `LogoutButton` (full page load to `/login`).

### Overview page (`/dashboard`)

```
Overview                                                       ← headline-medium (static)
Welcome, you@example.com. Here's what's happening in your classes.   ← body-large, on-surface-variant
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ My classes       │ │ Student progress │ │ Recent activity  │  ← title-medium
│ Your classes will│ │ A summary of …   │ │ The latest …     │  ← body-medium
└──────────────────┘ └──────────────────┘ └──────────────────┘
   M3 filled cards, grid: as many 240px+ columns as fit (3 on desktop, 1 on phones)
```

- The heading is static. Everything under it depends on the role, so it streams in behind `<Suspense>` ("Loading…" first).
- **Cards** (`features/ux/dashboard/overview/PlaceholderCard.tsx`) follow the M3 **filled card** spec: `surface-container-highest` background, medium corners (12px), 16px padding, title-medium heading (`<h2>`), body-medium text in `on-surface-variant`. Material Web's card is still in `labs/`, so this is a plain `<section>` styled with tokens. If cards are needed on other pages, move it to `features/ux/material/` (shared UI building blocks).
- **Per-role content** lives in `features/ux/dashboard/overview/`:

  | | Teacher (`TeacherOverview.tsx`) | Student (`StudentOverview.tsx`) |
  | --- | --- | --- |
  | Welcome line | "Here's what's happening in your classes." | "Here's an overview of your learning." |
  | Cards | My classes · Student progress · Recent activity | My progress · Coming up · Recent feedback |

- **To change what a role sees:** edit that role's component. Each receives the `user` (`id`, `email`, `role`) as a prop and is a Server Component, so it can fetch data directly. The mapping from role to component is `OVERVIEW_BY_ROLE` in `features/ux/dashboard/OverviewPage.tsx`.

### Error page (`features/ux/root/ErrorPage.tsx`)

```
Something went wrong                                                     ← headline-medium
This page couldn't be loaded. Try again, or log out and sign in again.   ← body-large, on-surface-variant
( Try again )  ( Log out )                         ← md-filled-button + md-outlined-button
```

- Shown in place of any page below the root layout that throws while loading. That includes the dashboard and its future layout, e.g. when a user has no profile row because the SQL wasn't run.
- **Try again** re-fetches and re-renders the page (Next's `retry()`). **Log out** is the same `LogoutButton`, so a signed-in user can always get back to `/login`.
- A simple column (max 640px). It replaces the whole page including the dashboard rail, which is why it has its own Log out button. It uses inline styles instead of a CSS Module on purpose (see [Gotchas](#gotchas)).

### Navigation config (`features/ux/navigation/navigation.ts`)

The rail is built from one array. Each entry:

```ts
{
  label: 'Overview',            // text under the icon (keep it to one short word)
  href: '/dashboard',           // page URL (keep pages under /dashboard to get the layout)
  icon: 'dashboard',            // Material Symbols name: https://fonts.google.com/icons
  roles: ['teacher', 'student'] // who sees it in the rail
}
```

Order in the array = order in the rail. `navItemsFor(role)` returns the entries a role may see. The dashboard layout calls it with the user's role (from `getCurrentUser()`) and passes the result to the rail.

**How to add a page (example: a teacher-only "Classes" page)**

1. Create the page component in a feature folder, e.g. `features/<feature>/ClassesPage.tsx`, with `export const metadata = { title: 'Classes' }` and a default export.
2. Add the one-line route entry `src/app/dashboard/classes/page.tsx`:
   ```ts
   export { default, metadata } from '@features/<feature>/ClassesPage';
   ```
   Being under `src/app/dashboard/`, it automatically gets the dashboard layout and is login-protected by the proxy.
3. Add one entry to `NAV_ITEMS`:
   ```ts
   { label: 'Classes', href: '/dashboard/classes', icon: 'school', roles: ['teacher'] },
   ```
   The icon is added to the icon font automatically.
4. **If the page is not for every role, also check the role in the page itself.** `roles` only hides the rail item; a student could still type the URL. See logic.md, "Role-restricted pages".

This exact example was tried during step 5 (in a throwaway copy): teachers saw Overview + Classes, students only Overview, the `school` icon loaded, and opening Classes highlighted it.

### What each role sees

| Visitor | Can open | Redirected |
| --- | --- | --- |
| Logged out | `/login`, `/signup` | everything else → `/login` |
| Logged in (teacher or student) | `/dashboard` (Overview) | `/`, `/login`, `/signup` → `/dashboard` |

| | Teacher | Student |
| --- | --- | --- |
| Navigation rail | Overview, Log out | Overview, Log out |
| Overview page | Welcome line + My classes, Student progress, Recent activity | Welcome line + My progress, Coming up, Recent feedback |

The rail is filtered by role, but its only entry (Overview) is for both roles. Teacher-only or student-only pages can be added through the [navigation config](#navigation-config-featuresuxnavigationnavigationts).

---

## Next steps

- [x] **Step 2:** login page and sign-up page (with role choice), using M3 text fields, radios and buttons.
- [x] **Step 3:** removed the temporary page at `/` (it now redirects), added the dashboard placeholder and the Log out button.
- [x] **Step 4:** the role is shown on the dashboard placeholder; error page with Try again / Log out.
- [x] **Step 5:** dashboard layout with an M3 navigation rail built from the config array (role-filtered), Log out in the rail, Material Symbols icons.
- [x] **Step 6:** Overview page with different placeholder content (cards) for teachers and students.
- Replace the placeholder cards with real content as features are built.
- Possible later additions (not requested):
  - a "confirm password" field on sign-up and a password-reset flow
  - on phones (< 600px wide), M3 recommends a bottom *navigation bar* instead of a rail; it could be rendered from the same `NAV_ITEMS`
  - a top app bar showing the page title or user

---

## Gotchas

- **Material Web is in maintenance mode upstream** (stable releases, few new components). The navigation drawer/bar exist only under `@material/web/labs/` (unstable API), and there is no navigation rail component at all. That's why the rail is composed from stable parts (`md-icon`, `md-ripple`, `md-focus-ring`) in `NavigationRail.tsx`. Prefer the same approach over `labs/` components.
- **Use `for`, not `htmlFor`, on `md-ripple` / `md-focus-ring`.** React renders `htmlFor` on custom elements as a literal `htmlfor` attribute in the server HTML, so after a full page load the ripple/focus ring silently attach to their parent instead of the intended element. `for` is typed in `material-web.d.ts`. Its value must be a CSS-safe id (letters, digits, `-`), because Material Web looks it up with `querySelector('#id')`. Don't use React's `useId()` for it.
- **No ids or controls in Suspense fallbacks that mirror the real UI.** While streaming, React keeps the finished content in a hidden container next to the visible fallback, so duplicate ids exist for a moment. That's why the rail fallback is an empty `NavigationRailSkeleton`.
- **Icons outside the nav config must be listed in `OTHER_ICONS`** (`features/ux/material/material-symbols.ts`), otherwise the icon name shows as text.
- **The icon font is an external request to Google Fonts** (fonts.googleapis.com / fonts.gstatic.com). If a Content Security Policy is added later, allow those hosts. Offline, icons show as their names.
- **Text fields, radios, ripples and focus rings need `suppressHydrationWarning`** ([hydration rule](#hydration-rule-for-material-web-elements)). Without it, the dev console shows a hydration error on every page with a form.
- **Build forms with `MaterialForm` / `SubmitButton`** ([see above](#forms-with-material-web-use-the-shared-components)). Plain `type="submit"` on an `md-*-button` or `<form action>` breaks in subtle ways.
- **Radios have no M3 error styling.** An unselected required radio group is reported with the browser's native validation bubble, not with red M3 text.
- **Use kebab-case attributes for string config** on Material Web tags, exactly as in the material-web.dev docs (e.g. `supporting-text="…"`). These are rendered into the server HTML, so the first paint is correct. camelCase props (e.g. `supportingText`) are only applied as properties after the browser loads the JS. TypeScript allows any hyphenated attribute without type checking, so double-check spelling. Exception: properties whose attribute is just the lowercased name (e.g. `minLength` → `minlength`) work either way.
- **Undefined custom elements are hidden** (`:not(:defined) { visibility: hidden }` in `globals.css`) to avoid a flash of unstyled text before the JS loads. If JavaScript fails to load, Material Web components stay invisible.
- **Some Material Web props are typed loosely by the library itself.** For example, `type` on buttons is `string`, so `type="nope"` is not caught by TypeScript.
- **`md-*-button href="…"` renders a plain link** inside its shadow DOM, so navigation is a full page load, not a Next.js client-side transition. That's fine for the auth pages. For in-app navigation use Next's `<Link>` (as the rail does) or `router.push`.
- **`RootLayout.tsx` has an `eslint-disable` for `@next/next/no-head-element`.** That rule targets the old Pages Router and fires only because the root layout now lives outside `src/app/`. `<head>` is correct in an App Router root layout, so keep the disable comment.
- **Error boundaries (`error.tsx`) must not import a CSS file.** Next preloads an error boundary's CSS on every page, and since the error page is normally not shown, the browser logs "…was preloaded using link preload but not used". `features/ux/root/ErrorPage.tsx` therefore uses inline styles (still token-based). Do the same for any future `error.tsx`.
- **`.next/dev/logs/next-development.log` is full of `true "unexpected parse state B"` ASSERT lines.** These are *passing* `console.assert` calls in Lit's development build, which Next copies into its dev log file. They don't appear in the browser console or terminal and can be ignored.
- **"Lit is in dev mode" console message** appears only with `npm run dev`. It is expected and does not appear in production builds.
- **Dark mode follows the OS.** There is no in-app toggle (out of scope).
