'use client';

import { useEffect, useRef, type KeyboardEvent } from 'react';

import styles from './chatbot.module.css';

/**
 * The message box. It grows with the text. Enter sends and Shift+Enter starts a
 * new line. It is a plain <textarea> because Material Web's text field can't
 * hold a button inside it.
 */
export function Composer({
  value,
  busy,
  onChange,
  onSend,
}: {
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onSend: (value: string) => void;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  const ready = value.trim() !== '' && !busy;

  useEffect(() => {
    field.current?.focus();
  }, []);

  useEffect(() => {
    if (!field.current) return;
    field.current.style.height = 'auto';
    field.current.style.height = `${field.current.scrollHeight}px`;
  }, [value]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (ready) onSend(value);
    }
  }

  return (
    <div className={styles.composer}>
      <textarea
        ref={field}
        className="md-typescale-body-large"
        rows={1}
        aria-label="Message the tutor"
        placeholder="Ask a maths question"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      {/* suppressHydrationWarning: it moves aria-label to data-aria-label on startup (see MaterialWeb.tsx). */}
      <md-filled-icon-button
        aria-label="Send"
        disabled={!ready}
        onClick={() => onSend(value)}
        suppressHydrationWarning
      >
        <md-icon aria-hidden="true">arrow_upward</md-icon>
      </md-filled-icon-button>
    </div>
  );
}
