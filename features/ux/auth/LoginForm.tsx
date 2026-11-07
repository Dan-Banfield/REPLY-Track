'use client';

import { useActionState } from 'react';

import { FormError, MaterialForm, SubmitButton } from '@features/ux/material/MaterialForm';
import { login, type FormState } from '@features/logic/auth/actions';

const initialState: FormState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <MaterialForm action={formAction}>
      {/* suppressHydrationWarning: these elements add their own attributes on startup (see MaterialWeb.tsx). */}
      <md-outlined-text-field
        label="Email"
        name="email"
        type="email"
        autocomplete="email"
        required
        suppressHydrationWarning
      />
      <md-outlined-text-field
        label="Password"
        name="password"
        type="password"
        autocomplete="current-password"
        required
        suppressHydrationWarning
      />
      <FormError message={state.error} />
      <SubmitButton pending={pending} pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </MaterialForm>
  );
}
