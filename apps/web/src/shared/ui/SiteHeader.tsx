import Link from 'next/link';
import styles from './ui.module.css';

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" className={styles.brand}>
          Ratenwerk
        </Link>
        <nav aria-label="Hauptnavigation" className={styles.nav}>
          <Link href="/">Angebote</Link>
          <Link href="/enablement" lang="en">
            Enablement desk
          </Link>
        </nav>
      </div>
    </header>
  );
}
