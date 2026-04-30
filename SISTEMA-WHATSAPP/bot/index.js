require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const pool = require('./config/database');
const baileysManager = require('./services/baileysManager');
const flowEngine = require('./services/flowEngine');
const { initRealtime } = require('./services/realtimeGateway');
const { ensureSchema } = require('./services/schemaManager');
const authMiddleware = require('./middlewares/auth');
const instanceController = require('./controllers/instanceController');

const requiredPaths = [
  path.join(__dirname, 'routes', 'api.js'),
  path.join(__dirname, 'controllers'),
  path.join(__dirname, 'services'),
  path.join(__dirname, 'config', 'database.js')
];

for (const p of requiredPaths) {
  if (!fs.existsSync(p)) {
    console.error('Estrutura do deploy invalida. Caminho ausente:', p);
    console.error('Dica: o ZIP precisa conter as pastas routes/, controllers/, services/, config/ no mesmo nivel do index.js.');
    process.exit(1);
  }
}

const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'Bot Eloha ativo', db: 'Conectado' });
  } catch (error) {
    res.status(500).json({ error: 'Erro no banco', details: error.message });
  }
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      database: 'connected',
      sessions: baileysManager.sockets.size,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: error.message });
  }
});

app.get('/instances', authMiddleware, instanceController.listInstances);
app.post('/instances', authMiddleware, instanceController.createInstance);
app.post('/instances/:id/start', authMiddleware, instanceController.connectInstance);
app.post('/instances/:id/connect', authMiddleware, instanceController.connectInstance);
app.get('/instances/:id/qrcode', authMiddleware, instanceController.getQRCode);
app.post('/instances/:id/disconnect', authMiddleware, instanceController.disconnectInstance);
app.delete('/instances/:id', authMiddleware, instanceController.deleteInstance);

app.use('/api', apiRoutes);

app.use((err, req, res, next) => {
  console.error('Erro nao tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 8080;

const startServer = async () => {
  try {
    await pool.query('SELECT 1');
    console.log('Conexao com banco de dados estabelecida');

    await ensureSchema();
    initRealtime(server);
    flowEngine.registerOutboundSender(async (instanceId, userPhone, message) => {
      await baileysManager.sendMessage(instanceId, userPhone, message);
    });

    try {
      const [instances] = await pool.query(
        'SELECT id, instance_name FROM instances WHERE status = ?',
        ['connected']
      );

      for (const i of instances) {
        try {
          await baileysManager.startSession(i.id, i.instance_name);
        } catch (e) {
          console.error(`Erro ao restaurar sessao Baileys ${i.id}:`, e);
        }
      }
    } catch (e) {
      console.error('Erro ao restaurar sessoes Baileys:', e);
    }

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
};

startServer();
