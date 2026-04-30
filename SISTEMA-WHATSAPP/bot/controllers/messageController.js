const pool = require('../config/database');
const baileysManager = require('../services/baileysManager');

const sendMessage = async (req, res) => {
  try {
    const clientId = req.clientId;
    const { instance_id, to, message } = req.body;

    if (!instance_id || !to || !message) {
      return res.status(400).json({ error: 'instance_id, to e message são obrigatórios' });
    }

    const [instances] = await pool.query(
      'SELECT * FROM instances WHERE id = ? AND client_id = ?',
      [instance_id, clientId]
    );

    if (instances.length === 0) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }

    if (instances[0].status !== 'connected') {
      return res.status(400).json({ error: 'Instância não está conectada' });
    }

    const result = await baileysManager.sendMessage(instance_id, to, message);

    const phone = to.replace('@c.us', '').replace(/\D/g, '');
    
    let [contacts] = await pool.query(
      'SELECT id FROM contacts WHERE client_id = ? AND phone = ?',
      [clientId, phone]
    );

    let contactId;
    if (contacts.length === 0) {
      const [insertResult] = await pool.query(
        'INSERT INTO contacts (client_id, phone) VALUES (?, ?)',
        [clientId, phone]
      );
      contactId = insertResult.insertId;
    } else {
      contactId = contacts[0].id;
    }

    await pool.query(
      'INSERT INTO messages (client_id, contact_id, direction, content) VALUES (?, ?, ?, ?)',
      [clientId, contactId, 'outbound', message]
    );

    return res.json({
      message: 'Mensagem enviada com sucesso',
      to: phone
    });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    return res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
};

const listMessages = async (req, res) => {
  try {
    const clientId = req.clientId;
    const { contact_id, limit = 50 } = req.query;

    let query = 'SELECT m.*, c.phone FROM messages m JOIN contacts c ON m.contact_id = c.id WHERE m.client_id = ?';
    const params = [clientId];

    if (contact_id) {
      query += ' AND m.contact_id = ?';
      params.push(contact_id);
    }

    query += ' ORDER BY m.created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const [messages] = await pool.query(query, params);

    return res.json({ messages });
  } catch (error) {
    console.error('Erro ao listar mensagens:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const listContacts = async (req, res) => {
  try {
    const clientId = req.clientId;

    const [contacts] = await pool.query(
      'SELECT * FROM contacts WHERE client_id = ? ORDER BY created_at DESC',
      [clientId]
    );

    return res.json({ contacts });
  } catch (error) {
    console.error('Erro ao listar contatos:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = {
  sendMessage,
  listMessages,
  listContacts
};
