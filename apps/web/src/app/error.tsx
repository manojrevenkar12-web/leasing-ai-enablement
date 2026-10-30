'use client';

import { ErrorState } from '@/shared/ui/States';

export default function RouteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ maxWidth: 'var(--page-max)', margin: '0 auto', padding: 'var(--space-6) var(--gutter)' }}>
      <ErrorState title="Diese Seite konnte nicht angezeigt werden" message="Ein unerwarteter Fehler ist aufgetreten. Ihre Eingaben sind nicht verloren." onRetry={reset} />
    </div>
  );
}
