const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
const pool = require('../config/database');
const { emitInstanceEvent } = require('./realtimeGateway');
const flowEngine = require('./flowEngine');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser
} = require('@whiskeysockets/baileys');

const sockets = new Map();
const qrCodes = new Map();
const lastErrors = new Map();
const manualDisconnects = new Set();
const reconnectAttempts = new Map();

const sessionsPath = path.join(__dirname, '..', 'sessions');
if (!fs.existsSync(sessionsPath)) {
  fs.mkdirSync(sessionsPath, { recursive: true });
}

async function updateInstanceStatus(instanceId, status) {
  try {
    await pool.query('UPDATE instances SET status = ? WHERE id = ?', [status, instanceId]);
    console.log(`[Baileys ${instanceId}] Status atualizado: ${status}`);

    if (status === 'connecting') {
      emitInstanceEvent(instanceId, 'INSTANCE_CONNECTING', { status });
    }
    if (status === 'connected') {
      emitInstanceEvent(instanceId, 'INSTANCE_CONNECTED', { status });
    }
    if (status === 'disconnected') {
      emitInstanceEvent(instanceId, 'INSTANCE_DISCONNECTED', { status });
    }
  } catch (e) {
    console.error(`[Baileys ${instanceId}] Falha ao atualizar status:`, e);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function resolveMediaUrl(rawUrl) {
  const url = String(rawUrl || '').trim();
  if (!url) return '';

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (url.startsWith('/uploads/')) {
    const localPath = path.join(__dirname, '..', url.replace(/^\//, ''));
    if (fs.existsSync(localPath)) {
      return localPath;
    }

    const publicBase = String(process.env.BACKEND_PUBLIC_URL || '').trim().replace(/\/$/, '');
    if (publicBase) {
      return `${publicBase}${url}`;
    }
  }

  return url;
}

async function startSession(instanceId, instanceName) {
  if (sockets.has(instanceId)) return sockets.get(instanceId);

  manualDisconnects.delete(instanceId);

  const instanceDir = path.join(sessionsPath, `baileys_${instanceId}`);
  if (!fs.existsSync(instanceDir)) fs.mkdirSync(instanceDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(instanceDir);
  const { version } = await fetchLatestBaileysVersion();

  lastErrors.delete(instanceId);
  qrCodes.delete(instanceId);

  const sock = makeWASocket({
    version,
    printQRInTerminal: false,
    auth: state,
    syncFullHistory: false,
    browser: ['ElohaBots', 'Chrome', '1.0.0']
  });

  sockets.set(instanceId, sock);
  await updateInstanceStatus(instanceId, 'connecting');

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    try {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const dataUrl = await qrcode.toDataURL(qr);
          qrCodes.set(instanceId, dataUrl);
          await updateInstanceStatus(instanceId, 'connecting');
          emitInstanceEvent(instanceId, 'INSTANCE_QR_UPDATED', { qrcode: dataUrl, status: 'connecting' });
          console.log(`[Baileys ${instanceId}] QR atualizado`);
        } catch (e) {
          lastErrors.set(instanceId, e.message || String(e));
          emitInstanceEvent(instanceId, 'INSTANCE_ERROR', { error: e.message || String(e) });
          console.error(`[Baileys ${instanceId}] Falha ao gerar QR:`, e);
        }
      }

      if (connection === 'open') {
        qrCodes.delete(instanceId);
        reconnectAttempts.set(instanceId, 0);
        await updateInstanceStatus(instanceId, 'connected');
        console.log(`[Baileys ${instanceId}] Conectado (${instanceName})`);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = statusCode || lastDisconnect?.error?.message || 'unknown';
        lastErrors.set(instanceId, String(reason));

        sockets.delete(instanceId);
        qrCodes.delete(instanceId);

        const isManual = manualDisconnects.has(instanceId);
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const attempt = (reconnectAttempts.get(instanceId) || 0) + 1;

        if (isLoggedOut) {
          await wipeSessionFiles(instanceId);
          emitInstanceEvent(instanceId, 'INSTANCE_LOGGED_OUT', { status: 'disconnected', reason: String(reason) });
        }

        if (!isManual && !isLoggedOut && attempt <= 3) {
          reconnectAttempts.set(instanceId, attempt);
          await updateInstanceStatus(instanceId, 'connecting');
          console.log(`[Baileys ${instanceId}] Conexão fechada. reason=${reason} tentativa=${attempt}/3 reconnect=true`);
          await sleep(1000 * attempt);
          startSession(instanceId, instanceName).catch((e) => {
            lastErrors.set(instanceId, e.message || String(e));
            emitInstanceEvent(instanceId, 'INSTANCE_ERROR', { error: e.message || String(e) });
          });
        } else {
          reconnectAttempts.set(instanceId, 0);
          await updateInstanceStatus(instanceId, 'disconnected');
          console.log(`[Baileys ${instanceId}] Conexão fechada. reason=${reason} reconnect=false manual=${isManual} loggedOut=${isLoggedOut}`);
        }
      }
    } catch (e) {
      lastErrors.set(instanceId, e.message || String(e));
      emitInstanceEvent(instanceId, 'INSTANCE_ERROR', { error: e.message || String(e) });
      console.error(`[Baileys ${instanceId}] Erro no connection.update:`, e);
    }
  });

  sock.ev.on('messages.upsert', async (event) => {
    try {
      const messages = event?.messages || [];
      for (const message of messages) {
        if (!message?.key?.remoteJid) continue;
        if (message.key.fromMe) continue;

        const remoteJid = String(message.key.remoteJid);
        if (remoteJid.endsWith('@g.us')) continue;
        if (remoteJid.endsWith('@newsletter')) continue;
        if (remoteJid.endsWith('@broadcast')) continue;
        if (remoteJid.includes('status@')) continue;

        const text =
          message.message?.conversation ||
          message.message?.extendedTextMessage?.text ||
          message.message?.imageMessage?.caption ||
          message.message?.videoMessage?.caption ||
          '';

        if (!text) continue;

        await flowEngine.processIncomingMessage({
          instanceId,
          fromJid: remoteJid,
          text,
          sendText: async (jid, reply) => {
            const normalizedJid = jidNormalizedUser(String(jid || remoteJid));
            await sock.sendMessage(normalizedJid, { text: String(reply) });
          },
          sendMedia: async (jid, media) => {
            const normalizedJid = jidNormalizedUser(String(jid || remoteJid));
            const type = String(media?.type || '').toLowerCase();
            const source = resolveMediaUrl(media?.url);
            if (!source) return false;

            const payload = {};
            if (type === 'image') payload.image = { url: source };
            if (type === 'audio') payload.audio = { url: source };
            if (type === 'video') payload.video = { url: source };
            if (!payload.image && !payload.audio && !payload.video) return false;

            const caption = String(media?.caption || '').trim();
            if ((type === 'image' || type === 'video') && caption) {
              payload.caption = caption;
            }

            await sock.sendMessage(normalizedJid, payload);
            return true;
          },
          sendPresence: async (jid, presenceType) => {
            try {
              const targetJid = String(jid || remoteJid);
              await sock.presenceSubscribe(targetJid);
              await sock.sendPresenceUpdate(String(presenceType || 'paused'), targetJid);
            } catch (e) {
              console.error(`[Baileys ${instanceId}] Erro ao enviar presença:`, e?.message || e);
            }
          }
        });
      }
    } catch (e) {
      emitInstanceEvent(instanceId, 'INSTANCE_ERROR', { error: e.message || String(e) });
      console.error(`[Baileys ${instanceId}] Erro em messages.upsert:`, e);
    }
  });

  return sock;
}

function getQRCode(instanceId) {
  return qrCodes.get(instanceId) || null;
}

function getLastError(instanceId) {
  return lastErrors.get(instanceId) || null;
}

function getSession(instanceId) {
  return sockets.get(instanceId) || null;
}

async function disconnectSession(instanceId) {
  const sock = sockets.get(instanceId);

  manualDisconnects.add(instanceId);
  reconnectAttempts.set(instanceId, 0);

  if (sock) {
    try {
      sock.end(new Error('manual_disconnect'));
    } catch (e) {
    }
  }

  sockets.delete(instanceId);
  qrCodes.delete(instanceId);
  lastErrors.delete(instanceId);
  await updateInstanceStatus(instanceId, 'disconnected');
  emitInstanceEvent(instanceId, 'INSTANCE_DISCONNECTED', { status: 'disconnected' });
}

async function wipeSessionFiles(instanceId) {
  const instanceDir = path.join(sessionsPath, `baileys_${instanceId}`);
  try {
    if (fs.existsSync(instanceDir)) {
      fs.rmSync(instanceDir, { recursive: true, force: true });
    }
  } catch (e) {
    console.error(`[Baileys ${instanceId}] Falha ao remover arquivos de sessão:`, e);
  }
}

async function sendMessage(instanceId, to, message) {
  const sock = sockets.get(instanceId);
  if (!sock) throw new Error('Sessão não encontrada');

  const phone = String(to).replace('@c.us', '').replace(/\D/g, '');
  const jid = jidNormalizedUser(`${phone}@s.whatsapp.net`);

  await sock.sendMessage(jid, { text: String(message) });
  return { to: phone };
}

module.exports = {
  startSession,
  getQRCode,
  getLastError,
  getSession,
  disconnectSession,
  wipeSessionFiles,
  sendMessage,
  sockets,
  qrCodes
};
