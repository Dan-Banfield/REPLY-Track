# UI and design

The Material 3 theme, the components used, the layout, how navigation works and what each role sees. Read it together with [`logic.md`](./logic.md), which covers the app logic.

_Last updated: step 3 of 7 (route protection and logout)._

---

## Current state

**Built and working**

- Material Design 3 theme with **light and dark** colour schemes (dark follows the OS setting).
- Roboto font and the official M3 **type scale** classes.
- Material Web components are registered and type-safe in JSX. Currently registered: `md-filled-button`, `md-outlined-button`, `md-text-button`, `md-radio`, `md-outlined-text-field`.
- **Login page** (`/login`) and **sign-up page** (`/signup`), sharing one M3 outlined-card layout. Each links to the other.
- **Dashboard placeholder** (`/dashboard`): "Dashboard" heading, "Signed in as …" and an M3 outlined **Log out** button. Steps 5–6 replace it.
- Users never see a page at `/`. They are redirected to `/login` or `/dashboard`.
- Reusable form building blocks: `MaterialForm`, `SubmitButton`, `FormError` (`src/components/material/MaterialForm.tsx`).
- Page titles use the template `<Page> · REPLY Track` (e.g. "Sign in · REPLY Track", "Dashboard · REPLY Track").
- No hydration warnings in the dev console (see the [hydration rule](#hydration-rule-for-material-web-elements)).

**Not built yet**

- Dashboard layout, navigation, Overview page and role-specific content. See [Next steps](#next-steps).

---

## How it works

### Component library: Material Web (`@material/web`)

- **Why:** it is Google's official Material Design 3 implementation for the web, and it is driven entirely by the M3 design tokens (`--md-sys-*` CSS custom properties). MUI was ruled out because it still implements Material Design 2.
- Components are **web components** (custom elements built with Lit). React 19 supports custom elements natively, so they are used directly as tags: `<md-filled-button>`.
- Catalogue and API docs: https://material-web.dev/ (the component list is under "Components"). The examples there can be pasted into JSX almost as-is.

**Registering a component (one line):**

1. Add its import to `src/components/material/MaterialWeb.tsx`, e.g.
   `import '@material/web/checkbox/checkbox.js';`
2. Use the tag: `<md-checkbox />`.

Keep the list to components that are actually used. Remove an import when its last usage goes away.

`src/components/material/material-web.d.ts` reads Material Web's own `HTMLElementTagNameMap` declarations, so the new tag is typed for JSX automatically:

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

Buttons (`md-filled-button`, `md-outlined-button`, `md-text-button`) don't need it. When you register a new component, load a page that uses it with `npm run dev` and check the console for that message. If it appears, add the element to this table and to the comment in `MaterialWeb.tsx`. The warning only affects that one element's attributes, so it doesn't hide problems elsewhere.

### Theme (design tokens)

All theme values live in **`src/theme/theme.css`**:

- **Colour:** the full set of M3 colour roles (`--md-sys-color-primary`, `-on-primary`, `-surface`, `-surface-container-*`, `-outline`, …) for light mode in `:root`, and for dark mode inside `@media (prefers-color-scheme: dark)`.
  - Generated from the M3 baseline seed colour **`#6750A4`** with the **Tonal Spot** scheme (the M3 default) from Google's `material-color-utilities`, the same library Material Theme Builder uses. The resulting primary is `#65558F` (light) / `#CFBDFE` (dark).
- **Typeface:** `--md-ref-typeface-brand` and `--md-ref-typeface-plain` point to Roboto, which `next/font/google` loads in `src/app/layout.tsx` (CSS variable `--font-roboto`).
- **Shape, elevation, motion:** Material Web's built-in M3 defaults. Nothing is overridden. App CSS may read shape tokens with a fallback, e.g. `var(--md-sys-shape-corner-medium, 12px)`.

**To change the brand colour:** open [Material Theme Builder](https://material-foundation.github.io/material-theme-builder/), pick a seed colour, export **Web (CSS)**, and replace the `--md-sys-color-*` values in both blocks of `theme.css` (light → `:root`, dark → the media query). Keep the token names; every component reads them.

### Typography

- The M3 type scale comes from `@material/web/typography/md-typescale-styles.css` (imported in `layout.tsx`). Use its classes on regular HTML elements:
  `md-typescale-display-{large,medium,small}`, `-headline-*`, `-title-*`, `-body-*`, `-label-*`.
  Example: `<h1 className="md-typescale-headline-medium">`.
- These classes sit in a CSS cascade layer, so app styles override them without specificity fights.

### Styling rules for app code

- Use **CSS Modules** (`*.module.css`, built into Next) for layout and spacing. They sit next to the route or component that uses them.
- Use **tokens only** for colour and type: `var(--md-sys-color-…)` and the `md-typescale-*` classes. No hard-coded colours.
- Keep `src/app/globals.css` tiny: box-sizing, body surface/text colour and font, and the rule that hides undefined custom elements.
- To restyle one Material Web component, set its component tokens (e.g. `--md-filled-button-container-color`) in CSS rather than overriding internals. Each component's tokens are listed on its material-web.dev page.
- Cards: Material Web's card is still in `labs/`, so cards are plain elements styled with tokens. The auth card follows the **outlined card** spec: `surface` background, 1px `outline-variant` border, medium corners.
- Notices (non-error messages) use a tonal container: `secondary-container` background with `on-secondary-container` text and small corners (`.notice` in `auth.module.css`).

### Auth pages (`/login`, `/signup`)

Both live in the `src/app/(auth)/` route group (the group name isn't part of the URL). They share:

- `(auth)/layout.tsx`: the centred outlined card (max 400px wide). Its `<section>` is labelled by the page's `<h1 id="auth-title">`.
- `(auth)/AuthHeader.tsx`: app name (title-medium, primary colour) above the page title (headline-small, the `<h1>`).
- `(auth)/auth.module.css`: card, header, notice, the "switch" line at the bottom, and the role radio group.

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

- The role is a native `<fieldset>`/`<legend>` group of `md-radio` elements (`name="role"`, `required`, no default). Clicking the label selects the radio. The options come from `ROLES` / `ROLE_LABELS` in `src/lib/auth/roles.ts`, so a new role appears automatically.
- After a successful sign-up the user is sent to `/login` with the notice above.

**Shared behaviour**

- **Validation:** empty fields, a malformed email or a short password are caught by the fields themselves (`required`, `type="email"`, `minLength`) and shown with M3 error styling. A missing role choice shows the browser's validation bubble on the first radio. Nothing is sent until the form is valid.
- **Server errors** (wrong password, existing account, Supabase unreachable, …) appear as one line in the error colour above the button, with `role="alert"`.
- **Pending state:** the button is disabled and reads "Signing in…" / "Creating account…".
- **After a failed attempt** all fields keep their values (including the selected role).
- **Keyboard:** Enter in any text field submits; Tab reaches the button, and Enter/Space on it submits.
- The "Sign up" / "Sign in" switch links are `md-text-button href=…`, which is a full page load. That's fine for these small static pages, and it starts each form fresh.

### Forms with Material Web (use the shared components)

Every form should be built from `src/components/material/MaterialForm.tsx`:

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

### Dashboard placeholder (`/dashboard`)

```
Dashboard                      ← headline-medium
Signed in as you@example.com   ← body-large, streams in ("Loading…" first)
( Log out )                    ← md-outlined-button (LogoutButton)
```

- A simple centred column (max 640px). It exists only so login, route protection and logout can be checked. Step 5 wraps `/dashboard` in the real layout and moves the logout button into the navigation; step 6 replaces the content with the Overview page.
- **Log out** shows "Logging out…" (disabled) while it works, then does a full page load to `/login`, which comes up empty.

### Layout

Not built yet. Step 5 adds the dashboard layout and navigation. This section will describe it.

### Navigation config

Not built yet. Step 5 adds a single config array (one entry per page, with the roles that can see it). This section will explain how to add a page.

### What each role sees

Roles don't change the UI yet (steps 4–6). Today:

| Visitor | Can open | Redirected |
| --- | --- | --- |
| Logged out | `/login`, `/signup` | everything else → `/login` |
| Logged in (teacher or student) | `/dashboard` (placeholder) | `/`, `/login`, `/signup` → `/dashboard` |

The role is chosen at sign-up and stored, but nothing reads it yet.

---

## Next steps

- [x] **Step 2:** login page and sign-up page (with role choice), using M3 text fields, radios and buttons.
- [x] **Step 3:** removed the temporary page at `/` (it now redirects), added the dashboard placeholder and the Log out button.
- [ ] **Step 5:** dashboard layout with an M3 navigation rail or drawer built from the config array, plus logout. Material Symbols icons will be added then. `next/font` doesn't ship Material Symbols, so it will be a separate font import.
- [ ] **Step 6:** Overview page with different placeholder content for teachers and students.
- Possible later additions (not requested): a "confirm password" field on sign-up, and a password-reset flow.

---

## Gotchas

- **Material Web is in maintenance mode upstream** (stable releases, few new components). The navigation drawer/bar exist only under `@material/web/labs/` (unstable API), and there is no navigation rail component at all. The rail/drawer in step 5 may need to be composed from stable parts (list, ripple, focus ring, icon) styled with M3 tokens.
- **Text fields and radios need `suppressHydrationWarning`** ([hydration rule](#hydration-rule-for-material-web-elements)). Without it, the dev console shows a hydration error on every page with a form.
- **Build forms with `MaterialForm` / `SubmitButton`** ([see above](#forms-with-material-web-use-the-shared-components)). Plain `type="submit"` on an `md-*-button` or `<form action>` breaks in subtle ways.
- **Radios have no M3 error styling.** An unselected required radio group is reported with the browser's native validation bubble, not with red M3 text.
- **Use kebab-case attributes for string config** on Material Web tags, exactly as in the material-web.dev docs (e.g. `supporting-text="…"`). These are rendered into the server HTML, so the first paint is correct. camelCase props (e.g. `supportingText`) are only applied as properties after the browser loads the JS. TypeScript allows any hyphenated attribute without type checking, so double-check spelling. Exception: properties whose attribute is just the lowercased name (e.g. `minLength` → `minlength`) work either way.
- **Undefined custom elements are hidden** (`:not(:defined) { visibility: hidden }` in `globals.css`) to avoid a flash of unstyled text before the JS loads. If JavaScript fails to load, Material Web components stay invisible.
- **Some Material Web props are typed loosely by the library itself.** For example, `type` on buttons is `string`, so `type="nope"` is not caught by TypeScript.
- **`md-*-button href="…"` renders a plain link** inside its shadow DOM, so navigation is a full page load, not a Next.js client-side transition. That's fine for the auth pages. For app navigation (step 5), use Next's `<Link>` or `router.push`.
- **"Lit is in dev mode" console message** appears only with `npm run dev`. It is expected and does not appear in production builds.
- **Dark mode follows the OS.** There is no in-app toggle (out of scope).
