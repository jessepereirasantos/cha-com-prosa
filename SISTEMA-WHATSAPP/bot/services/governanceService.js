const pool = require('../config/database');

function nowPlusHours(hours) {
  return new Date(Date.now() + Math.max(0, Number(hours || 0)) * 60 * 60 * 1000);
}

function nowPlusMinutes(minutes) {
  return new Date(Date.now() + Math.max(0, Number(minutes || 0)) * 60 * 1000);
}

function normalizeWeekday(v) {
  const map = {
    sunday: 0,
    domingo: 0,
    monday: 1,
    segunda: 1,
    tuesday: 2,
    terca: 2,
    terça: 2,
    wednesday: 3,
    quarta: 3,
    thursday: 4,
    quinta: 4,
    friday: 5,
    sexta: 5,
    saturday: 6,
    sabado: 6,
    sábado: 6
  };
  const key = String(v || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : Number(v);
}

function parseTimeToMinutes(raw) {
  const text = String(raw || '').trim();
  const m = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

async function getActiveBlock(instanceId, phone) {
  const [rows] = await pool.query(
    'SELECT * FROM blocked_users WHERE instance_id = ? AND phone = ? AND blocked_until > NOW() LIMIT 1',
    [instanceId, phone]
  );
  return rows[0] || null;
}

async function upsertUserBlock(instanceId, phone, hours, reason, blockMessage) {
  const until = nowPlusHours(hours || 0);
  await pool.query(
    `INSERT INTO blocked_users (instance_id, phone, blocked_until, reason, block_message)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE blocked_until = VALUES(blocked_until), reason = VALUES(reason), block_message = VALUES(block_message)`,
    [instanceId, phone, until, reason || null, blockMessage || null]
  );
  return until;
}

async function setHumanTakeover(instanceId, phone, hours) {
  const until = nowPlusHours(hours || 24);
  await pool.query(
    `UPDATE conversations
     SET is_human_active = 1,
         human_until = ?,
         inactivity_due_at = NULL,
         inactivity_payload_json = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE instance_id = ? AND user_phone = ?`,
    [until, instanceId, phone]
  );
  return until;
}

async function clearExpiredHumanTakeover(instanceId, phone) {
  await pool.query(
    `UPDATE conversations
     SET is_human_active = 0,
         human_until = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE instance_id = ? AND user_phone = ?
       AND is_human_active = 1
       AND (human_until IS NULL OR human_until <= NOW())`,
    [instanceId, phone]
  );
}

async function checkAndConsumeLimit({ instanceId, phone, ruleId, max, periodHours }) {
  const parsedMax = Number(max || 0);
  if (!parsedMax || parsedMax < 1) {
    return { allowed: true, counter: 0, max: parsedMax };
  }

  const hours = Math.max(1, Number(periodHours || 24));
  const [rows] = await pool.query(
    'SELECT * FROM user_limits WHERE instance_id = ? AND phone = ? AND rule_id = ? LIMIT 1',
    [instanceId, phone, ruleId]
  );

  if (rows.length === 0) {
    const expiresAt = nowPlusHours(hours);
    await pool.query(
      'INSERT INTO user_limits (instance_id, phone, rule_id, counter, expires_at) VALUES (?, ?, ?, ?, ?)',
      [instanceId, phone, ruleId, 1, expiresAt]
    );
    return { allowed: true, counter: 1, max: parsedMax };
  }

  const row = rows[0];
  const expired = row.expires_at ? new Date(row.expires_at).getTime() <= Date.now() : true;
  if (expired) {
    const expiresAt = nowPlusHours(hours);
    await pool.query(
      'UPDATE user_limits SET counter = 1, expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [expiresAt, row.id]
    );
    return { allowed: true, counter: 1, max: parsedMax };
  }

  if (Number(row.counter || 0) >= parsedMax) {
    return { allowed: false, counter: Number(row.counter || 0), max: parsedMax };
  }

  await pool.query(
    'UPDATE user_limits SET counter = counter + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [row.id]
  );
  return { allowed: true, counter: Number(row.counter || 0) + 1, max: parsedMax };
}

async function setConversationInactivity(instanceId, phone, config) {
  const minutes = Math.max(1, Number(config?.minutes || config?.inactivity_minutes || 10));
  const dueAt = nowPlusMinutes(minutes);
  const payload = {
    message: config?.message || 'Conversa encerrada por inatividade.',
    action: config?.action || 'end',
    ruleType: 'rule_inactivity'
  };

  await pool.query(
    `UPDATE conversations
     SET inactivity_due_at = ?,
         inactivity_payload_json = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE instance_id = ? AND user_phone = ?`,
    [dueAt, JSON.stringify(payload), instanceId, phone]
  );
}

async function clearConversationInactivity(instanceId, phone) {
  await pool.query(
    `UPDATE conversations
     SET inactivity_due_at = NULL,
         inactivity_payload_json = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE instance_id = ? AND user_phone = ?`,
    [instanceId, phone]
  );
}

async function applyResetConversation(instanceId, phone) {
  await pool.query(
    `UPDATE conversations
     SET current_node = 'start',
         variables_json = ?,
         is_human_active = 0,
         human_until = NULL,
         inactivity_due_at = NULL,
         inactivity_payload_json = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE instance_id = ? AND user_phone = ?`,
    [JSON.stringify({}), instanceId, phone]
  );
}

function isWithinBusinessHours(config, date = new Date()) {
  const startMin = parseTimeToMinutes(config?.start || config?.start_time || '08:00');
  const endMin = parseTimeToMinutes(config?.end || config?.end_time || '18:00');
  if (startMin === null || endMin === null) return true;

  const rawDays = Array.isArray(config?.days) ? config.days : [1, 2, 3, 4, 5];
  const allowedDays = rawDays
    .map(normalizeWeekday)
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);

  const currentDay = date.getDay();
  if (allowedDays.length > 0 && !allowedDays.includes(currentDay)) return false;

  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  if (startMin <= endMin) {
    return currentMinutes >= startMin && currentMinutes <= endMin;
  }

  return currentMinutes >= startMin || currentMinutes <= endMin;
}

module.exports = {
  getActiveBlock,
  upsertUserBlock,
  setHumanTakeover,
  clearExpiredHumanTakeover,
  checkAndConsumeLimit,
  setConversationInactivity,
  clearConversationInactivity,
  applyResetConversation,
  isWithinBusinessHours
};
