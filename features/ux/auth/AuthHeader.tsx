import styles from './auth.module.css';

/** App name + page title at the top of the auth card. */
export function AuthHeader({ title }: { title: string }) {
  return (
    <header className={styles.header}>
      <p className={`md-typescale-title-medium ${styles.appName}`}>REPLY Track</p>
      <h1 id="auth-title" className="md-typescale-headline-small">
        {title}
      </h1>
    </header>
  );
}
