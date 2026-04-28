import { NextResponse } from 'next/server';
import { updateTicketStatus } from '@/lib/db';
import { TicketStatus } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID ausente' }, { status: 400 });
    
    const ticket = await updateTicketStatus(id, TicketStatus.USED);
    if (!ticket) return NextResponse.json({ error: 'Ingresso não encontrado' }, { status: 404 });
    
    return NextResponse.json(ticket);
  } catch (error) {
    return NextResponse.json({ error: 'Erro no check-in' }, { status: 500 });
  }
}
