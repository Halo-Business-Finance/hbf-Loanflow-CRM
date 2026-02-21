/**
 * RPC Routes: Pipeline, Reports & Compliance
 * Implements: get_pipeline_analytics, get_dashboard_metrics,
 *             generate_compliance_report, get_accessible_leads
 */
const express = require('express');
const { query } = require('../db');

const router = express.Router();

// GET /leads/accessible
router.get('/accessible', async (req, res) => {
  try {
    // Return all leads the requesting user can access
    // In a full implementation, filter by user's team/role
    const rows = await query(
      `SELECT l.id, l.lead_number, l.created_at, l.updated_at, l.user_id, l.contact_entity_id
       FROM leads l
       ORDER BY l.created_at DESC
       LIMIT 500`
    );
    res.json(rows);
  } catch (err) {
    console.error('[pipeline] accessible-leads error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /pipeline/analytics
router.post('/analytics', async (req, res) => {
  try {
    const stages = await query(`
      SELECT ce.stage, COUNT(*) as count,
             COALESCE(SUM(ce.loan_amount), 0) as total_value,
             COALESCE(AVG(ce.loan_amount), 0) as avg_value
      FROM leads l
      JOIN contact_entities ce ON l.contact_entity_id = ce.id
      WHERE ce.stage IS NOT NULL
      GROUP BY ce.stage
      ORDER BY count DESC
    `);

    const conversionRate = await query(`
      SELECT
        COUNT(*) FILTER (WHERE ce.stage IN ('Funded', 'Closed')) as converted,
        COUNT(*) as total
      FROM leads l
      JOIN contact_entities ce ON l.contact_entity_id = ce.id
    `);

    res.json({
      stages,
      conversion_rate: conversionRate[0]?.total > 0
        ? (conversionRate[0].converted / conversionRate[0].total * 100).toFixed(2)
        : 0,
      total_leads: conversionRate[0]?.total || 0,
    });
  } catch (err) {
    console.error('[pipeline] analytics error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /reports/dashboard-metrics
router.post('/dashboard-metrics', async (req, res) => {
  try {
    const [leads, clients, documents] = await Promise.all([
      query(`SELECT COUNT(*) as count FROM leads`),
      query(`SELECT COUNT(*) as count FROM clients`),
      query(`SELECT COUNT(*) as count FROM lead_documents`),
    ]);

    const recentLeads = await query(`
      SELECT COUNT(*) as count FROM leads WHERE created_at > NOW() - INTERVAL '7 days'
    `);

    res.json({
      total_leads: parseInt(leads[0]?.count || 0),
      total_clients: parseInt(clients[0]?.count || 0),
      total_documents: parseInt(documents[0]?.count || 0),
      leads_this_week: parseInt(recentLeads[0]?.count || 0),
    });
  } catch (err) {
    console.error('[reports] dashboard-metrics error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /compliance/generate-report
router.post('/generate-report', async (req, res) => {
  try {
    const { p_report_type, p_date_range_start, p_date_range_end, p_generated_by } = req.body;
    if (!p_report_type || !p_generated_by) return res.status(400).json({ error: 'Missing required fields' });

    const startDate = p_date_range_start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = p_date_range_end || new Date().toISOString();

    // Gather report data based on type
    let reportData = {};

    if (p_report_type === 'audit') {
      const logs = await query(
        `SELECT action, COUNT(*) as count FROM audit_logs
         WHERE created_at BETWEEN $1 AND $2
         GROUP BY action ORDER BY count DESC`,
        [startDate, endDate]
      );
      reportData = { audit_summary: logs };
    } else if (p_report_type === 'security') {
      const events = await query(
        `SELECT event_type, severity, COUNT(*) as count FROM security_events
         WHERE created_at BETWEEN $1 AND $2
         GROUP BY event_type, severity ORDER BY count DESC`,
        [startDate, endDate]
      );
      reportData = { security_summary: events };
    } else {
      reportData = { message: `Report type '${p_report_type}' generated` };
    }

    // Store report
    const { uuidv4 } = require('../db');
    const id = uuidv4();
    await query(
      `INSERT INTO compliance_reports (id, report_type, date_range_start, date_range_end, generated_by, report_data, status, created_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'completed', NOW(), NOW())`,
      [id, p_report_type, startDate, endDate, p_generated_by, JSON.stringify(reportData)]
    );

    res.json({ id, report_type: p_report_type, report_data: reportData, status: 'completed' });
  } catch (err) {
    console.error('[compliance] generate-report error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /email/get-tokens-secure
router.post('/get-tokens-secure', async (req, res) => {
  try {
    const { p_email_account_id } = req.body;
    if (!p_email_account_id) return res.status(400).json({ error: 'Missing p_email_account_id' });
    const rows = await query(
      `SELECT id, access_token, refresh_token, expires_at FROM email_accounts WHERE id = $1 AND is_active = true`,
      [p_email_account_id]
    );
    res.json(rows.length ? rows[0] : null);
  } catch (err) {
    console.error('[email] get-tokens error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /email/store-tokens-secure
router.post('/store-tokens-secure', async (req, res) => {
  try {
    const { p_email_account_id, p_access_token, p_refresh_token, p_expires_at } = req.body;
    if (!p_email_account_id) return res.status(400).json({ error: 'Missing p_email_account_id' });
    await query(
      `UPDATE email_accounts SET access_token = $1, refresh_token = $2, expires_at = $3, updated_at = NOW() WHERE id = $4`,
      [p_access_token, p_refresh_token, p_expires_at, p_email_account_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[email] store-tokens error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
