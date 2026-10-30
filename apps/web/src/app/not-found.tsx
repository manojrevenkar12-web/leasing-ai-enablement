import Link from 'next/link';
import { EmptyState } from '@/shared/ui/States';
import ui from '@/shared/ui/ui.module.css';

export default function NotFound() {
  return (
    <div style={{ maxWidth: 'var(--page-max)', margin: '0 auto', padding: 'var(--space-6) var(--gutter)' }}>
      <EmptyState
        title="Diese Seite gibt es nicht"
        message="Vielleicht wurde das Angebot entfernt. In der Suche finden Sie alle aktuellen Angebote."
        action={
          <Link href="/" className={ui.button}>
            Zur Angebotssuche
          </Link>
        }
      />
    </div>
  );
}
