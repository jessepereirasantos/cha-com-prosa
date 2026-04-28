import { getTicket } from '@/lib/db';
import { notFound } from 'next/navigation';
import TicketClient from './TicketClient';

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ticket = await getTicket(id);
  
  if (!ticket) {
    notFound();
  }

  return <TicketClient ticket={ticket} />;
}
