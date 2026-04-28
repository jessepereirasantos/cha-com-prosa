import { NextResponse } from 'next/server';
import { getTicket } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ticket = await getTicket(id);
    if (!ticket) {
      return NextResponse.json({ error: 'Ingresso não encontrado' }, { status: 404 });
    }
    return NextResponse.json(ticket);
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
