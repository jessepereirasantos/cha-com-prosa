const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    const [existing] = await pool.query('SELECT id FROM clients WHERE email = ?', [email]);
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      'INSERT INTO clients (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, password_hash]
    );

    const token = jwt.sign(
      { id: result.insertId, email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Usuário criado com sucesso',
      client: {
        id: result.insertId,
        name,
        email
      },
      token
    });
  } catch (error) {
    console.error('Erro no registro:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const [clients] = await pool.query('SELECT * FROM clients WHERE email = ?', [email]);

    if (clients.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const client = clients[0];

    const validPassword = await bcrypt.compare(password, client.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = jwt.sign(
      { id: client.id, email: client.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      message: 'Login realizado com sucesso',
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        role: client.role || 'client'
      },
      user: {
        id: client.id,
        name: client.name,
        email: client.email,
        role: client.role || 'client'
      },
      token
    });
  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const clientId = req.clientId;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    await pool.query('UPDATE clients SET name = ? WHERE id = ?', [name, clientId]);

    return res.json({ success: true, message: 'Perfil atualizado' });
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const changePassword = async (req, res) => {
  try {
    const clientId = req.clientId;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });
    }

    const [clients] = await pool.query('SELECT password_hash FROM clients WHERE id = ?', [clientId]);
    
    if (clients.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const validPassword = await bcrypt.compare(current_password, clients[0].password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE clients SET password_hash = ? WHERE id = ?', [newHash, clientId]);

    return res.json({ success: true, message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = {
  register,
  login,
  updateProfile,
  changePassword
};
