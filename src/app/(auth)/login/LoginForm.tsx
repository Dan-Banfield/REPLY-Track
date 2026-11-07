'use client';

import { useActionState } from 'react';

import { FormError, MaterialForm, SubmitButton } from '@/components/material/MaterialForm';
import { login, type FormState } from '@/lib/auth/actions';

const initialState: FormState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <MaterialForm action={formAction}>
      <md-outlined-text-field
        label="Email"
        name="email"
        type="email"
        autocomplete="email"
        required
      />
      <md-outlined-text-field
        label="Password"
        name="password"
        type="password"
        autocomplete="current-password"
        required
      />
      <FormError message={state.error} />
      <SubmitButton pending={pending} pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </MaterialForm>
  );
}
