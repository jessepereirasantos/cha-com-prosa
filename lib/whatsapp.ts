import axios from 'axios';
import { query } from './mysql';

export async function sendWhatsAppNotification(ticket: any) {
  const baseUrl = process.env.WHATSAPP_BOT_URL;
  const token = process.env.WHATSAPP_BOT_TOKEN;

  // Verificar lock para evitar envios duplicados (últimos 10 segundos)
  const recentAttempts = await query(
    'SELECT COUNT(*) as count FROM audit_logs WHERE ticket_id = ? AND action = ? AND created_at > DATE_SUB(NOW(), INTERVAL 10 SECOND)',
    [ticket.id, 'whatsapp_notification']
  ) as any[];
  
  if (recentAttempts[0]?.count > 0) {
    console.log(`[WHATSAPP] Ignorando envio duplicado para ticket ${ticket.id} (tentativa recente)`);
    return null;
  }

  const logAudit = async (status: string, response?: any, error?: any) => {
    try {
      await query(
        'INSERT INTO audit_logs (ticket_id, action, status, payload, response, error) VALUES (?, ?, ?, ?, ?, ?)',
        [
          ticket.id,
          'whatsapp_notification',
          status,
          JSON.stringify({ phone: ticket.phone, amount: ticket.amount }),
          response ? JSON.stringify(response) : null,
          error ? JSON.stringify(error) : null
        ]
      );
    } catch (e) {
      console.error('[AUDIT] Failed to save log:', e);
    }
  };

  if (!baseUrl || !token) {
    console.warn('[WHATSAPP] Configuração ausente no .env');
    await logAudit('failed', null, 'Missing environment variables (URL or Token)');
    return null;
  }

  if (!ticket || !ticket.phone) {
    console.warn('[WHATSAPP] Ticket ou telefone ausente');
    await logAudit('failed', null, 'Ticket or phone missing');
    return null;
  }

  const phone = ticket.phone.replace(/\D/g, '');
  const phoneFormatted = phone.startsWith('55') ? phone : `55${phone}`;

  try {
    console.log(`[WHATSAPP] Enviando mensagem para: ${phoneFormatted}`);
    const response = await axios.post(
      `${baseUrl}/api/events/purchase`,
      {
        name: ticket.name,
        phone: phoneFormatted,
        product: "Ingresso Chá com Prosa",
        value: ticket.amount || 57.00,
        data: {
          ticket_id: ticket.id,
          ticket_code: ticket.id.slice(-6).toUpperCase(),
          email: ticket.email,
          ticket_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://chacomprosa.iadeeloha.com.br'}/api/generate-ticket?id=${ticket.id}`
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000 // Aumentado para 15s devido aos logs de timeout do Baileys
      }
    );
    
    await logAudit('success', response.data);
    console.log('[WHATSAPP] Sucesso no envio');
    return response.data;
  } catch (error: any) {
    const errorMsg = error?.response?.data?.message || error.message;
    const errorData = error?.response?.data || null;
    
    console.error(`[WHATSAPP] Erro ao enviar: ${errorMsg}`);
    await logAudit('error', errorData, errorMsg);
    return null;
  }
}
