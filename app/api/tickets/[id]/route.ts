import { NextResponse } from 'next/server';
import { query } from '../../../../lib/mysql';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'ID não fornecido' }, { status: 400 });
    }

    const rows = await query('SELECT name, code, status FROM tickets WHERE id = ?', [id]) as any[];

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('API Ticket Error:', error);
    return NextResponse.json({ error: 'Erro ao buscar ticket' }, { status: 500 });
  }
}
