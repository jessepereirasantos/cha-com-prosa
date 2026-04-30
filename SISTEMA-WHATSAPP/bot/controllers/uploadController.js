const fs = require('fs');
const path = require('path');
const multer = require('multer');
const pool = require('../config/database');

const uploadBaseDir = path.join(__dirname, '..', 'uploads', 'flows');
fs.mkdirSync(uploadBaseDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadBaseDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext && ext.length <= 8 ? ext : '';
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${safeExt}`);
  }
});

const allowedMime = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'video/mp4',
  'video/webm'
]);

const uploader = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedMime.has(String(file.mimetype || '').toLowerCase())) {
      cb(null, true);
      return;
    }
    cb(new Error('Tipo de arquivo não suportado'));
  }
}).single('file');

function uploadMiddleware(req, res, next) {
  uploader(req, res, (err) => {
    if (!err) return next();
    const message = err.message || 'Falha no upload';
    return res.status(400).json({ error: message });
  });
}

async function uploadFlowMedia(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo não enviado' });
    }

    const flowId = Number(req.body?.flow_id || 0);
    if (!flowId) {
      return res.status(400).json({ error: 'flow_id é obrigatório' });
    }

    const clientId = req.clientId;
    const [flows] = await pool.query(
      'SELECT id FROM flows WHERE id = ? AND client_id = ? LIMIT 1',
      [flowId, clientId]
    );

    if (flows.length === 0) {
      return res.status(404).json({ error: 'Fluxo não encontrado' });
    }

    const relativePath = `/uploads/flows/${req.file.filename}`;
    const mediaType = String(req.body?.media_type || req.file.mimetype || '').toLowerCase();

    await pool.query(
      `INSERT INTO flow_media_uploads (flow_id, client_id, media_type, file_path, original_name, mime_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        flowId,
        clientId,
        mediaType,
        relativePath,
        String(req.file.originalname || ''),
        String(req.file.mimetype || '')
      ]
    );

    return res.status(201).json({
      message: 'Upload realizado com sucesso',
      file: {
        url: relativePath,
        media_type: mediaType,
        name: req.file.originalname,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('Erro no upload de mídia de fluxo:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

module.exports = {
  uploadMiddleware,
  uploadFlowMedia
};
