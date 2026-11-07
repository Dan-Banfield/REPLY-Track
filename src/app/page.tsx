import styles from './page.module.css';

// Temporary page to check the M3 theme. Step 3 replaces it with a redirect
// (to /login or the dashboard, depending on the session).
export default function Home() {
  return (
    <main className={styles.main}>
      <h1 className="md-typescale-headline-medium">REPLY Track</h1>
      <p className="md-typescale-body-large">
        The Material 3 theme is set up. This placeholder page is replaced in a later step.
      </p>
      <div className={styles.actions}>
        <md-filled-button>Filled button</md-filled-button>
        <md-outlined-button>Outlined button</md-outlined-button>
      </div>
    </main>
  );
}
