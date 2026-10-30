import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteHeader } from '@/shared/ui/SiteHeader';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ratenwerk: Leasingangebote vergleichen',
  description: 'Leasingangebote nach Leasingfaktor vergleichen und die Rate für die eigene Laufzeit berechnen.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>
        <a className="visually-hidden" href="#main">
          Zum Inhalt springen
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
