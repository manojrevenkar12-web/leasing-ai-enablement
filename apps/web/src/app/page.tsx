import { Suspense } from 'react';
import { OfferSearch } from '@/features/offers/OfferSearch';

export default function Home() {
  // useSearchParams needs a Suspense boundary for static rendering
  return (
    <Suspense>
      <OfferSearch />
    </Suspense>
  );
}
