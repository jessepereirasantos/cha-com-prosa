const pool = require('../config/database');

async function getAnalyticsSummary(req, res) {
  try {
    const clientId = req.user?.client_id || req.user?.id;
    if (!clientId) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const [instancesResult] = await pool.query(
      'SELECT COUNT(*) as total FROM instances WHERE client_id = ?',
      [clientId]
    );

    const [flowsResult] = await pool.query(
      'SELECT COUNT(*) as total FROM flows WHERE client_id = ?',
      [clientId]
    );

    const [instanceIds] = await pool.query(
      'SELECT id FROM instances WHERE client_id = ?',
      [clientId]
    );
    const ids = instanceIds.map(i => i.id);

    let conversationsStats = {
      total: 0,
      active: 0,
      finished: 0,
      abandoned: 0,
      bySource: { flow: 0, api_event: 0, keyword: 0 }
    };

    if (ids.length > 0) {
      const [convTotal] = await pool.query(
        `SELECT COUNT(*) as total FROM conversations WHERE instance_id IN (?)`,
        [ids]
      );
      conversationsStats.total = convTotal[0]?.total || 0;

      const [convByStatus] = await pool.query(
        `SELECT status, COUNT(*) as count FROM conversations WHERE instance_id IN (?) GROUP BY status`,
        [ids]
      );
      convByStatus.forEach(row => {
        if (row.status === 'active') conversationsStats.active = row.count;
        if (row.status === 'finished') conversationsStats.finished = row.count;
        if (row.status === 'abandoned') conversationsStats.abandoned = row.count;
      });

      const [convBySource] = await pool.query(
        `SELECT source, COUNT(*) as count FROM conversations WHERE instance_id IN (?) GROUP BY source`,
        [ids]
      );
      convBySource.forEach(row => {
        const src = String(row.source || 'flow').toLowerCase();
        if (conversationsStats.bySource.hasOwnProperty(src)) {
          conversationsStats.bySource[src] = row.count;
        }
      });
    }

    const [recentConversations] = ids.length > 0
      ? await pool.query(
          `SELECT DATE(created_at) as date, COUNT(*) as count 
           FROM conversations 
           WHERE instance_id IN (?) AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
           GROUP BY DATE(created_at) 
           ORDER BY date DESC 
           LIMIT 30`,
          [ids]
        )
      : [[]];

    res.json({
      success: true,
      data: {
        instances: {
          total: instancesResult[0]?.total || 0
        },
        flows: {
          total: flowsResult[0]?.total || 0
        },
        conversations: conversationsStats,
        recentActivity: recentConversations.reverse()
      }
    });
  } catch (error) {
    console.error('[Analytics] Erro ao buscar métricas:', error);
    res.status(500).json({ error: 'Erro ao buscar métricas' });
  }
}

module.exports = {
  getAnalyticsSummary
};
