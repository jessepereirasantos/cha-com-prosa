const pool = require('../config/database');
const baileysManager = require('../services/baileysManager');

// Garantir que a tabela external_triggers existe
async function ensureTriggersTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS external_triggers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        instance_id INT NOT NULL,
        phone VARCHAR(20) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        event_data JSON,
        status ENUM('pending', 'sent', 'failed', 'skipped') DEFAULT 'pending',
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME,
        INDEX idx_instance (instance_id),
        INDEX idx_status (status),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } catch (error) {
    console.error('Erro ao criar tabela external_triggers:', error.message);
  }
}

// Criar tabela na inicialização
ensureTriggersTable();

/**
 * Criar trigger de evento externo (plataforma de cursos)
 * POST /api/triggers/create
 */
async function createTrigger(req, res) {
  try {
    const { instance_id, phone, event, data } = req.body;

    console.log('Trigger recebido:', { instance_id, phone, event });

    if (!instance_id || !phone || !event) {
      return res.status(400).json({ error: 'instance_id, phone e event são obrigatórios' });
    }

    // Verificar se instância existe e pertence ao cliente
    const [instances] = await pool.query(
      'SELECT * FROM instances WHERE id = ? AND is_active = 1',
      [instance_id]
    );

    if (instances.length === 0) {
      console.log('Instância não encontrada:', instance_id);
      return res.status(404).json({ error: 'Instância não encontrada ou inativa' });
    }

    const instance = instances[0];

    // Formatar telefone
    let formattedPhone = String(phone).replace(/\D/g, '');
    if (!formattedPhone.startsWith('55') && formattedPhone.length <= 11) {
      formattedPhone = '55' + formattedPhone;
    }

    console.log('Telefone formatado:', formattedPhone);

    // Salvar trigger no banco
    let triggerId = null;
    try {
      const [result] = await pool.query(
        `INSERT INTO external_triggers (instance_id, phone, event_type, event_data, status, created_at)
         VALUES (?, ?, ?, ?, 'pending', NOW())`,
        [instance_id, formattedPhone, event, JSON.stringify(data || {})]
      );
      triggerId = result.insertId;
    } catch (dbError) {
      console.error('Erro ao inserir trigger:', dbError.message);
      // Tentar criar tabela e inserir novamente
      await ensureTriggersTable();
      const [result] = await pool.query(
        `INSERT INTO external_triggers (instance_id, phone, event_type, event_data, status, created_at)
         VALUES (?, ?, ?, ?, 'pending', NOW())`,
        [instance_id, formattedPhone, event, JSON.stringify(data || {})]
      );
      triggerId = result.insertId;
    }

    // Processar trigger imediatamente
    await processTrigger(triggerId, instance, formattedPhone, event, data);

    res.json({
      success: true,
      trigger_id: triggerId,
      message: 'Trigger criado e processado'
    });

  } catch (error) {
    console.error('Erro ao criar trigger:', error);
    res.status(500).json({ error: 'Erro interno ao criar trigger', details: error.message });
  }
}

/**
 * Processar trigger e enviar mensagem WhatsApp
 */
async function processTrigger(triggerId, instance, phone, event, data) {
  try {
    let message = '';

    // Montar mensagem baseada no tipo de evento
    switch (event) {
      case 'purchase_completed':
        message = formatPurchaseMessage(data);
        break;
      case 'course_access_granted':
        message = formatAccessGrantedMessage(data);
        break;
      default:
        message = formatGenericMessage(event, data);
    }

    if (!message) {
      await updateTriggerStatus(triggerId, 'skipped', 'Mensagem vazia');
      return;
    }

    // Enviar mensagem via Baileys
    const jid = phone + '@s.whatsapp.net';
    const sent = await baileysManager.sendTextMessage(instance.id, jid, message);

    if (sent) {
      await updateTriggerStatus(triggerId, 'sent', 'Mensagem enviada com sucesso');
    } else {
      await updateTriggerStatus(triggerId, 'failed', 'Falha ao enviar mensagem');
    }

  } catch (error) {
    console.error('Erro ao processar trigger:', error);
    await updateTriggerStatus(triggerId, 'error', error.message);
  }
}

/**
 * Atualizar status do trigger
 */
async function updateTriggerStatus(triggerId, status, message) {
  await pool.query(
    'UPDATE external_triggers SET status = ?, status_message = ?, processed_at = NOW() WHERE id = ?',
    [status, message, triggerId]
  );
}

/**
 * Formatar mensagem de compra confirmada
 */
function formatPurchaseMessage(data) {
  const customerName = data.customer_name || 'Aluno';
  const courseName = data.course_name || 'Curso';
  const amount = data.amount ? `R$ ${parseFloat(data.amount).toFixed(2).replace('.', ',')}` : '';

  return `🎉 *Compra Confirmada!*

Olá ${customerName}!

Sua compra do curso *${courseName}* foi confirmada com sucesso!
${amount ? `\n💰 Valor: ${amount}` : ''}

✅ Seu acesso já está liberado!

Acesse agora sua área de aluno e comece seus estudos:
👉 https://cursoseloha.com.br/minha-conta/

Qualquer dúvida, estamos à disposição!

🙏 Bons estudos!
_Equipe Cursos Eloha_`;
}

/**
 * Formatar mensagem de acesso liberado
 */
function formatAccessGrantedMessage(data) {
  const userName = data.user_name || 'Aluno';
  const courseName = data.course_name || 'Curso';
  const accessUrl = data.access_url || 'https://cursoseloha.com.br/minha-conta/';

  return `📚 *Acesso Liberado!*

Olá ${userName}!

Seu acesso ao curso *${courseName}* foi liberado!

🎓 Comece agora mesmo seus estudos:
👉 ${accessUrl}

Aproveite todo o conteúdo disponível!

🙏 Bons estudos!
_Equipe Cursos Eloha_`;
}

/**
 * Formatar mensagem genérica
 */
function formatGenericMessage(event, data) {
  const customerName = data.customer_name || data.user_name || 'Cliente';
  
  return `📢 *Notificação*

Olá ${customerName}!

Evento: ${event}

_Equipe Cursos Eloha_`;
}

/**
 * Listar triggers (para debug/admin)
 * GET /api/triggers
 */
async function listTriggers(req, res) {
  try {
    const { instance_id, status, limit = 50 } = req.query;

    let query = 'SELECT * FROM external_triggers WHERE 1=1';
    const params = [];

    if (instance_id) {
      query += ' AND instance_id = ?';
      params.push(instance_id);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const [triggers] = await pool.query(query, params);

    res.json({ triggers });

  } catch (error) {
    console.error('Erro ao listar triggers:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
}

/**
 * Health check da API
 * GET /api/health
 */
async function healthCheck(req, res) {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'EAD SaaS WhatsApp API'
  });
}

module.exports = {
  createTrigger,
  listTriggers,
  healthCheck
};
