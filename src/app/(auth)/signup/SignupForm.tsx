'use client';

import { useActionState } from 'react';

import { FormError, MaterialForm, SubmitButton } from '@/components/material/MaterialForm';
import { signup, type FormState } from '@/lib/auth/actions';
import { ROLE_LABELS, ROLES } from '@/lib/auth/roles';

import styles from '../auth.module.css';

const initialState: FormState = { error: null };

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  return (
    <MaterialForm action={formAction}>
      <md-outlined-text-field
        label="Email"
        name="email"
        type="email"
        autocomplete="email"
        required
      />
      {/* Keep minLength in line with Supabase → Authentication → Password settings (default 6). */}
      <md-outlined-text-field
        label="Password"
        name="password"
        type="password"
        autocomplete="new-password"
        supporting-text="At least 6 characters"
        minLength={6}
        required
      />

      <fieldset className={styles.roleGroup}>
        <legend className="md-typescale-body-medium">I am a…</legend>
        {ROLES.map((role) => (
          <div key={role} className={styles.roleOption}>
            <md-radio id={`role-${role}`} name="role" value={role} required />
            <label htmlFor={`role-${role}`} className="md-typescale-body-large">
              {ROLE_LABELS[role]}
            </label>
          </div>
        ))}
      </fieldset>

      <FormError message={state.error} />
      <SubmitButton pending={pending} pendingLabel="Creating account…">
        Create account
      </SubmitButton>
    </MaterialForm>
  );
}
