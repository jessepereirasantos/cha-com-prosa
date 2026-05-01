import { NextResponse } from 'next/server';
import { getPaymentStatus } from '../../../lib/mercadopago';

/**
 * ENDPOINT DE POLLING (UX IMEDIATA)
 * Este endpoint consulta DIRETAMENTE a API do Mercado Pago.
 * Ele NÃO atualiza o banco de dados e NÃO dispara WhatsApp.
 * Sua única função é informar o frontend se o pagamento foi aprovado.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get('id');

    if (!paymentId) {
      return NextResponse.json({ error: 'ID do pagamento não fornecido' }, { status: 400 });
    }

    // Consulta DIRETAMENTE a API oficial (Fonte da Verdade para UX)
    const mpPayment = await getPaymentStatus(paymentId);
    const status = mpPayment.status;

    // Retorna apenas o veredito para o frontend.
    // O banco de dados e as comunicações ficam por conta exclusiva do WEBHOOK.
    return NextResponse.json({
      status: (status === 'approved' || status === 'authorized') ? 'approved' : 'pending'
    });

  } catch (error: any) {
    // Em caso de erro na API do MP, retorna pending para o frontend continuar tentando
    console.error('[POLLING] Erro na consulta direta:', error.message);
    return NextResponse.json({ status: 'pending' });
  }
}
