'use client';

import { startTransition, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';

import styles from './MaterialForm.module.css';

/**
 * A <form> that works with Material Web fields and a Server Action from
 * `useActionState`. Use it (with <SubmitButton>) for every form in the app.
 *
 *   const [state, formAction, pending] = useActionState(myAction, initialState);
 *   <MaterialForm action={formAction}>
 *     <md-outlined-text-field name="email" label="Email" />
 *     <FormError message={state.error} />
 *     <SubmitButton pending={pending} pendingLabel="Saving…">Save</SubmitButton>
 *   </MaterialForm>
 *
 * Why not a plain <form action={formAction}>? See features/ux/ux.md ("Forms"):
 * - React resets a form after its action, which clears Material Web fields.
 * - Enter in a Material Web text field doesn't submit natively (shadow DOM).
 * - A Material Web button with type="submit" makes React throw (see SubmitButton).
 */
export function MaterialForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => void;
  className?: string;
  children: ReactNode;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }

  // Every submit goes through form.requestSubmit(), which also runs validation.
  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    const target = event.target as Element;
    if (
      event.key === 'Enter' &&
      !event.nativeEvent.isComposing &&
      target.localName.endsWith('-text-field')
    ) {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  }

  return (
    <form
      className={className ? `${styles.form} ${className}` : styles.form}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
    >
      {children}
    </form>
  );
}

/**
 * Full-width M3 filled button that submits the surrounding <MaterialForm>.
 *
 * It is type="button" on purpose: a Material Web button with type="submit"
 * reports itself as the form's `submitter`, and React 19 then calls
 * `new FormData(form, submitter)`, which throws for custom elements.
 */
export function SubmitButton({
  pending,
  pendingLabel,
  children,
}: {
  pending: boolean;
  pendingLabel: string;
  children: ReactNode;
}) {
  return (
    <md-filled-button
      type="button"
      disabled={pending}
      onClick={(event) => event.currentTarget.closest('form')?.requestSubmit()}
    >
      {pending ? pendingLabel : children}
    </md-filled-button>
  );
}

/** Form-level error line (error colour, announced by screen readers). Renders nothing without a message. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className={`md-typescale-body-medium ${styles.error}`}>
      {message}
    </p>
  );
}
