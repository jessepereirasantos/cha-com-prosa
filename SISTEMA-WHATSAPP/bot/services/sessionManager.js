const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');
const flowEngine = require('./flowEngine');

const sessions = new Map();
const qrCodes = new Map();
const lastErrors = new Map();

const sessionsPath = path.join(__dirname, '..', 'sessions');

if (!fs.existsSync(sessionsPath)) {
  fs.mkdirSync(sessionsPath, { recursive: true });
}

const updateInstanceStatus = async (instanceId, status) => {
  try {
    await pool.query(
      'UPDATE instances SET status = ? WHERE id = ?',
      [status, instanceId]
    );
    console.log(`[Instance ${instanceId}] Status atualizado: ${status}`);
  } catch (error) {
    console.error(`[Instance ${instanceId}] Erro ao atualizar status:`, error);
  }
};

const resolveChromeExecutablePath = () => {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable'
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (e) {
    }
  }

  return null;
};

const createSession = async (instanceId, instanceName) => {
  if (sessions.has(instanceId)) {
    console.log(`[Instance ${instanceId}] Sessão já existe`);
    return sessions.get(instanceId);
  }

  console.log(`[Instance ${instanceId}] Criando nova sessão: ${instanceName}`);

  const executablePath = resolveChromeExecutablePath();
  console.log(`[Instance ${instanceId}] Chromium executablePath: ${executablePath || 'auto'}`);

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: `instance_${instanceId}`,
      dataPath: sessionsPath
    }),
    puppeteer: {
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    }
  });

  client.on('qr', async (qr) => {
    console.log(`[Instance ${instanceId}] QR Code recebido`);
    try {
      const qrDataUrl = await qrcode.toDataURL(qr);
      qrCodes.set(instanceId, qrDataUrl);
      await updateInstanceStatus(instanceId, 'connecting');
    } catch (error) {
      console.error(`[Instance ${instanceId}] Erro ao gerar QR Code:`, error);
    }
  });

  client.on('ready', async () => {
    console.log(`[Instance ${instanceId}] Cliente pronto!`);
    qrCodes.delete(instanceId);
    await updateInstanceStatus(instanceId, 'connected');
  });

  client.on('authenticated', () => {
    console.log(`[Instance ${instanceId}] Autenticado com sucesso`);
    qrCodes.delete(instanceId);
  });

  client.on('auth_failure', async (msg) => {
    console.error(`[Instance ${instanceId}] Falha na autenticação:`, msg);
    lastErrors.set(instanceId, msg || 'auth_failure');
    qrCodes.delete(instanceId);
    await updateInstanceStatus(instanceId, 'disconnected');
  });

  client.on('disconnected', async (reason) => {
    console.log(`[Instance ${instanceId}] Desconectado:`, reason);
    if (reason) lastErrors.set(instanceId, reason);
    sessions.delete(instanceId);
    qrCodes.delete(instanceId);
    await updateInstanceStatus(instanceId, 'disconnected');
  });

  client.on('message', async (message) => {
    console.log(`[Instance ${instanceId}] Mensagem recebida de ${message.from}: ${message.body}`);
    
    if (message.from.endsWith('@c.us') && !message.fromMe) {
      try {
        const [instances] = await pool.query(
          'SELECT client_id FROM instances WHERE id = ?',
          [instanceId]
        );
        
        if (instances.length > 0) {
          const clientId = instances[0].client_id;
          const response = await flowEngine.processMessage(instanceId, clientId, message.from, message.body);
          
          if (response) {
            await client.sendMessage(message.from, response);
            console.log(`[Instance ${instanceId}] Resposta enviada: ${response}`);
          }
        }
      } catch (error) {
        console.error(`[Instance ${instanceId}] Erro ao processar mensagem:`, error);
      }
    }
  });

  sessions.set(instanceId, client);
  lastErrors.delete(instanceId);

  try {
    await client.initialize();
  } catch (error) {
    console.error(`[Instance ${instanceId}] Erro ao inicializar:`, error);
    lastErrors.set(instanceId, error && error.message ? error.message : String(error));
    sessions.delete(instanceId);
    await updateInstanceStatus(instanceId, 'disconnected');
    throw error;
  }

  return client;
};

const getSession = (instanceId) => {
  return sessions.get(instanceId) || null;
};

const getQRCode = (instanceId) => {
  return qrCodes.get(instanceId) || null;
};

const getLastError = (instanceId) => {
  return lastErrors.get(instanceId) || null;
};

const destroySession = async (instanceId) => {
  const client = sessions.get(instanceId);
  
  if (client) {
    try {
      await client.destroy();
      console.log(`[Instance ${instanceId}] Sessão destruída`);
    } catch (error) {
      console.error(`[Instance ${instanceId}] Erro ao destruir sessão:`, error);
    }
    sessions.delete(instanceId);
  }
  
  qrCodes.delete(instanceId);
  lastErrors.delete(instanceId);
};

const restoreSessions = async () => {
  try {
    const [instances] = await pool.query(
      'SELECT id, instance_name FROM instances WHERE status = ?',
      ['connected']
    );

    console.log(`Restaurando ${instances.length} sessões...`);

    for (const instance of instances) {
      const sessionDir = path.join(sessionsPath, `session-instance_${instance.id}`);
      
      if (fs.existsSync(sessionDir)) {
        console.log(`Restaurando sessão: ${instance.instance_name}`);
        try {
          await createSession(instance.id, instance.instance_name);
        } catch (error) {
          console.error(`Erro ao restaurar sessão ${instance.id}:`, error);
          await updateInstanceStatus(instance.id, 'disconnected');
        }
      } else {
        await updateInstanceStatus(instance.id, 'disconnected');
      }
    }
  } catch (error) {
    console.error('Erro ao restaurar sessões:', error);
  }
};

const sendMessage = async (instanceId, to, message) => {
  const client = sessions.get(instanceId);
  
  if (!client) {
    throw new Error('Sessão não encontrada');
  }

  const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
  
  try {
    const result = await client.sendMessage(chatId, message);
    return result;
  } catch (error) {
    console.error(`[Instance ${instanceId}] Erro ao enviar mensagem:`, error);
    throw error;
  }
};

module.exports = {
  createSession,
  getSession,
  getQRCode,
  getLastError,
  destroySession,
  restoreSessions,
  sendMessage,
  sessions,
  qrCodes
};
