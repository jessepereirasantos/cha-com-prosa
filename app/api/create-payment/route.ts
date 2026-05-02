import { NextResponse } from 'next/server';
import { addTicket } from '../../../lib/db';
import { createPixPayment, createCardPayment } from '../../../lib/mercadopago';
import { query } from '../../../lib/mysql';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, phone, document, paymentMethod, couponCode } = body;

    if (!name || !email || !phone) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
    }

    // --- INÍCIO DO PORTEIRO DE VALIDAÇÃO DE CPF ---
    if (!document) {
      return NextResponse.json({ error: 'CPF é obrigatório' }, { status: 400 });
    }
    
    const cleanDocument = document.replace(/\D/g, '');
    
    if (cleanDocument.length !== 11) {
      return NextResponse.json({ error: 'CPF inválido. Certifique-se de digitar 11 números.' }, { status: 400 });
    }

    const existingTickets = await query(
      "SELECT id FROM tickets WHERE document = ? AND status IN ('paid', 'used')",
      [cleanDocument]
    ) as any[];

    if (existingTickets && existingTickets.length > 0) {
      return NextResponse.json({ error: 'Já existe um ingresso confirmado vinculado a este CPF.' }, { status: 400 });
    }
    // --- FIM DO PORTEIRO ---

    // 1. Calcula o valor (único ponto de cálculo)
    let amount = 57;
    if (couponCode) {
      const couponRows = await query('SELECT discount FROM coupons WHERE code = ?', [couponCode.toUpperCase()]) as any[];
      if (couponRows && couponRows.length > 0) {
        amount = Math.max(0, 57 - parseFloat(couponRows[0].discount.toString()));
      }
    }

    // 2. Salva o ingresso no banco com status 'pending' (Garante o registro inicial)
    const ticket = await addTicket({
      name,
      email,
      phone,
      document: cleanDocument,
      paymentMethod
    });

    // 3. Cria pagamento no Mercado Pago (Criador Único)
    let mpPayment;
    try {
      if (paymentMethod === 'card') {
        const { cardToken, paymentMethodId, installments, issuerId } = body;
        mpPayment = await createCardPayment({
          id: ticket.id,
          name,
          email,
          document: cleanDocument,
          cardToken,
          paymentMethodId,
          issuerId,
          installments: parseInt(installments) || 1,
          amount
        });
      } else {
        mpPayment = await createPixPayment({
          id: ticket.id,
          name,
          email,
          document: cleanDocument,
          amount
        });
      }
    } catch (mpError: any) {
      // Falha antes da criacao do pagamento (ex: erro de validacao do Mercado Pago)
      await query("UPDATE tickets SET status = 'rejected' WHERE id = ?", [ticket.id]);
      const errorMessage = mpError?.cause?.[0]?.description || mpError?.message || 'Erro ao processar no Mercado Pago';
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const paymentId = mpPayment.id?.toString();

    // 4. Apenas vincula o ID do pagamento ao ticket e salva o valor final
    if (paymentId) {
      await query('UPDATE tickets SET paymentIdMP = ?, amount = ? WHERE id = ?', [paymentId, amount, ticket.id]);

      // Aplica as regras de negocio restritas ao cartao
      if (paymentMethod === 'card') {
        if (mpPayment.status === 'rejected') {
          await query("UPDATE tickets SET status = 'rejected' WHERE id = ?", [ticket.id]);
          return NextResponse.json({ error: 'Pagamento recusado pela operadora. Verifique os dados ou tente outro cartão.' }, { status: 400 });
        } else if (mpPayment.status === 'approved') {
          await query("UPDATE tickets SET status = 'paid' WHERE id = ?", [ticket.id]);
        }
      }
    }

    // Retorna os dados necessários para o frontend (sem tentar processar status aqui)
    return NextResponse.json({
      success: true,
      paymentId: paymentId,
      ticketId: ticket.id,
      qr_code: mpPayment.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: mpPayment.point_of_interaction?.transaction_data?.qr_code_base64,
      status: mpPayment.status
    });

  } catch (error: any) {
    console.error('Create Payment Error:', error);
    return NextResponse.json({ error: 'Erro técnico ao gerar cobrança' }, { status: 500 });
  }
}
