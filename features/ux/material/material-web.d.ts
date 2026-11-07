/**
 * JSX types for Material Web elements.
 *
 * Every `md-*` element imported in ./MaterialWeb.tsx registers itself in
 * `HTMLElementTagNameMap`; this file turns each of those into a typed JSX tag,
 * so there is nothing to add here when a new component is imported.
 *
 * Element properties are accepted as optional camelCase props (e.g. `disabled`,
 * `type`), alongside the usual React HTML props (`className`, `onClick`, ...).
 * Hyphenated HTML attributes (e.g. `supporting-text`) are always allowed by TSX.
 */
import type { DetailedHTMLProps, HTMLAttributes } from 'react';
import type { LitElement } from 'lit';

/** Public, non-method fields of a Material Web element (excluding Lit/HTMLElement internals). */
type ElementProps<T> = {
  [K in keyof T as K extends keyof LitElement
    ? never
    : T[K] extends (...args: never[]) => unknown
      ? never
      : K]?: T[K];
};

type MdElementProps<T extends HTMLElement> = ElementProps<T> &
  DetailedHTMLProps<HTMLAttributes<T>, T> & {
    /**
     * HTML `for` attribute: id of the element an md-ripple / md-focus-ring
     * reacts to. Use this, not `htmlFor`: React renders `htmlFor` on custom
     * elements as a literal "htmlfor" attribute in server HTML.
     */
    for?: string;
  };

type MdIntrinsicElements = {
  [Tag in Extract<keyof HTMLElementTagNameMap, `md-${string}`>]: MdElementProps<
    HTMLElementTagNameMap[Tag]
  >;
};

declare module 'react' {
  namespace JSX {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface IntrinsicElements extends MdIntrinsicElements {}
  }
}
