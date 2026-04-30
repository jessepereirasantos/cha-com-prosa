const authMiddleware = require('./auth');

const adminMiddleware = async (req, res, next) => {
  await authMiddleware(req, res, async () => {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }
    return next();
  });
};

module.exports = adminMiddleware;
