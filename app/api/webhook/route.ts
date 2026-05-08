import { NextResponse } from 'next/server';
import { getPaymentStatus } from '../../../lib/mercadopago';
import { query } from '../../../lib/mysql';
import { sendWhatsAppNotification } from '../../../lib/whatsapp';

export async function POST(req: Request) {
  // 1. EXTRAÇÃO RELÂMPAGO
  const { searchParams } = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const paymentId = searchParams.get('data.id') || searchParams.get('id') || body.data?.id || body.id;

  if (!paymentId) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // 2. PROCESSA O PAGAMENTO (await garante a execução no cPanel/HostGator)
  // O servidor será obrigado a esperar o WhatsApp ser disparado ANTES de fechar a conexão
  await processPaymentInBackground(paymentId.toString());

  // 3. RESPONDE 200 OK AO MERCADO PAGO
  return NextResponse.json({ ok: true }, { status: 200 });
}

// FUNÇÃO DE PROCESSAMENTO DESACOPLADA
async function processPaymentInBackground(paymentId: string) {
  try {
    console.log(`[WEBHOOK] Iniciando processamento background para ID: ${paymentId}`);
    
    // Busca status no Mercado Pago
    const mpPayment = await getPaymentStatus(paymentId);
    if (!mpPayment || (mpPayment.status !== 'approved' && mpPayment.status !== 'authorized')) {
      console.log(`[WEBHOOK] Pagamento ${paymentId} ainda não aprovado: ${mpPayment?.status}`);
      return;
    }

    // ─── PASSO 1: Busca por paymentIdMP ───────────────────────────────────────
    let tickets = await query(
      'SELECT * FROM tickets WHERE paymentIdMP = ?',
      [paymentId]
    ) as any[];

    // ─── PASSO 2: Fallback por external_reference (id do ticket) ──────────────
    if (tickets.length === 0) {
      const externalRef = mpPayment.external_reference;
      console.log(`[WEBHOOK] Não encontrado por paymentIdMP. Tentando external_reference: ${externalRef}`);

      if (externalRef) {
        tickets = await query(
          'SELECT * FROM tickets WHERE id = ?',
          [externalRef]
        ) as any[];

        // Atualização de segurança: vincula o paymentIdMP ao ticket encontrado
        if (tickets.length > 0) {
          await query(
            'UPDATE tickets SET paymentIdMP = ? WHERE id = ?',
            [paymentId, tickets[0].id]
          );
          console.log(`[DB] paymentIdMP vinculado ao ticket ${tickets[0].id} via external_reference`);
        }
      }
    }

    if (tickets.length === 0) {
      console.error(`[WEBHOOK] CRÍTICO: Ticket não encontrado por paymentIdMP nem por external_reference. paymentId=${paymentId}`);
      return;
    }

    const ticket = tickets[0];
    console.log(`[WEBHOOK] Ticket encontrado! Cliente: ${ticket.name} | Código: ${ticket.code}`);

    // ─── ATUALIZA STATUS NO BANCO ──────────────────────────────────────────────
    if (ticket.status !== 'paid') {
      await query('UPDATE tickets SET status = "paid" WHERE id = ?', [ticket.id]);
      console.log(`[DB] Status do Ticket ${ticket.id} atualizado para 'paid'`);
    }

    // ─── DISPARO DO WHATSAPP com LOCK ATÔMICO ───────────────────────────────
    // Tenta obter lock atômico para este ticket
    const lockResult = await query(
      'UPDATE tickets SET whatsapp_sent = 1 WHERE id = ? AND whatsapp_sent = 0',
      [ticket.id]
    ) as any;

    // Verifica se conseguiu o lock (afetou alguma linha)
    if (lockResult.affectedRows > 0) {
      console.log(`[WHATSAPP] Lock obtido para ticket ${ticket.id}. Enviando WhatsApp...`);

      try {
        const result = await sendWhatsAppNotification({
          ...ticket,
          amount: mpPayment.transaction_amount || 57.00
        });
        
        if (result) {
          console.log(`[WHATSAPP] Sucesso no envio para ${ticket.name}`);
        } else {
          // Se falhou, libera o lock para tentativas futuras
          await query('UPDATE tickets SET whatsapp_sent = 0 WHERE id = ?', [ticket.id]);
          console.error(`[WHATSAPP] Falha no envio, lock liberado para ${ticket.name}`);
        }
      } catch (waErr: any) {
        // Se deu erro, libera o lock para tentativas futuras
        await query('UPDATE tickets SET whatsapp_sent = 0 WHERE id = ?', [ticket.id]);
        console.error(`[WHATSAPP] Erro crítico no envio, lock liberado: ${waErr.message}`);
      }
    } else {
      console.log(`[WHATSAPP] Outro processo já está tratando do ticket ${ticket.id}`);
    }

  } catch (error: any) {
    console.error(`[WEBHOOK ERROR] Falha no processamento background: ${error.message}`);
  }
}
