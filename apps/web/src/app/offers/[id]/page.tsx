import { notFound } from 'next/navigation';
import { OfferDetail } from '@/features/quote/OfferDetail';

export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) notFound();
  return <OfferDetail id={n} />;
}
