const jwt = require('jsonwebtoken');
const pool = require('../config/database');

let io = null;

function initRealtime(httpServer) {
  const { Server } = require('socket.io');

  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL,
      credentials: true
    }
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('unauthorized'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.clientId = decoded.id;
      return next();
    } catch (e) {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('instance:subscribe', async ({ instanceId }) => {
      try {
        const id = parseInt(instanceId, 10);
        if (!id) return;

        const [rows] = await pool.query(
          'SELECT id FROM instances WHERE id = ? AND client_id = ? LIMIT 1',
          [id, socket.data.clientId]
        );

        if (rows.length === 0) return;

        socket.join(`instance:${id}`);
      } catch (e) {
      }
    });

    socket.on('instance:unsubscribe', ({ instanceId }) => {
      const id = parseInt(instanceId, 10);
      if (!id) return;
      socket.leave(`instance:${id}`);
    });
  });

  return io;
}

function emitInstanceEvent(instanceId, event, payload = {}) {
  if (!io) return;
  io.to(`instance:${instanceId}`).emit('instance:event', {
    event,
    instanceId,
    timestamp: new Date().toISOString(),
    ...payload
  });
}

module.exports = {
  initRealtime,
  emitInstanceEvent
};
