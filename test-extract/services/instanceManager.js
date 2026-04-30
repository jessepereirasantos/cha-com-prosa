const pool = require('../config/database');

async function getInstanceContext(instanceId) {
  const [rows] = await pool.query(
    `SELECT i.id, i.client_id, i.tenant_id, i.instance_name, i.status, i.flow_id,
            f.id AS linked_flow_id, f.name AS linked_flow_name, f.flow_data, f.structure_json, f.version, f.is_active
     FROM instances i
     LEFT JOIN flows f ON f.id = i.flow_id AND f.client_id = i.client_id
     WHERE i.id = ?
     LIMIT 1`,
    [instanceId]
  );

  return rows[0] || null;
}

async function upsertInstanceFlow(instanceId, flowId) {
  await pool.query('UPDATE instances SET flow_id = ? WHERE id = ?', [flowId, instanceId]);

  if (!flowId) {
    await pool.query('DELETE FROM instance_flows WHERE instance_id = ?', [instanceId]);
    return;
  }

  await pool.query(
    `INSERT INTO instance_flows (instance_id, flow_id, is_active)
     VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE flow_id = VALUES(flow_id), is_active = 1`,
    [instanceId, flowId]
  );
}

module.exports = {
  getInstanceContext,
  upsertInstanceFlow
};
