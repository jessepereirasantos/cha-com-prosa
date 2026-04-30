const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2) {
    return res.status(401).json({ error: 'Token mal formatado' });
  }

  const [scheme, token] = parts;

  if (!/^Bearer$/i.test(scheme)) {
    return res.status(401).json({ error: 'Token mal formatado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.clientId = decoded.id;
    req.clientEmail = decoded.email;

    const [clients] = await pool.query(
      'SELECT id, tenant_id, name, email, role FROM clients WHERE id = ? LIMIT 1',
      [decoded.id]
    );

    if (clients.length > 0) {
      const client = clients[0];
      req.user = {
        id: client.id,
        client_id: client.id,
        tenant_id: client.tenant_id || null,
        name: client.name,
        email: client.email,
        role: client.role || 'client',
        isAdmin: client.role === 'admin'
      };
    } else {
      req.user = {
        id: decoded.id,
        client_id: decoded.id,
        tenant_id: decoded.tenant_id || null,
        email: decoded.email,
        role: decoded.role || 'client',
        isAdmin: decoded.role === 'admin'
      };
    }

    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};

module.exports = authMiddleware;
