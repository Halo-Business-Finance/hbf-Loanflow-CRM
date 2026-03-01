/**
 * Document management functions — ported from:
 *   supabase/functions/scan-document
 *   supabase/functions/secure-document-manager
 *   supabase/functions/secure-profile-access
 */
const express = require('express');
const router = express.Router();
const { query } = require('../../db');
const { checkRateLimit, RATE_LIMITS } = require('../../middleware/rate-limit');

// ── scan-document ────────────────────────────────────────────
router.post('/scan-document', async (req, res) => {
  try {
    const userId = req.jwtPayload?.sub;
    if (!userId) return res.status(401).json({ error: 'Authorization required' });

    const rl = await checkRateLimit(userId, RATE_LIMITS.SCAN_DOCUMENT);
    if (!rl.allowed) return res.status(429).json({ error: rl.error });

    const { file_hash, file_name, file_size, document_id } = req.body;
    if (!file_hash) return res.status(400).json({ error: 'File hash is required' });

    // Check cache
    const cached = await query(
      `SELECT * FROM document_scan_results WHERE file_hash = $1 AND scanned_at > NOW() - INTERVAL '24 hours' LIMIT 1`,
      [file_hash]
    );
    if (cached.length) {
      return res.json({ is_safe: cached[0].is_safe, scan_id: cached[0].scan_id, threats_found: cached[0].threats_found || [], scan_date: cached[0].scanned_at, confidence: cached[0].confidence, cached: true });
    }

    // VirusTotal check if configured
    const VT_KEY = process.env.VIRUSTOTAL_API_KEY;
    let scanResult;
    if (VT_KEY) {
      const vtRes = await fetch(`https://www.virustotal.com/api/v3/files/${file_hash}`, { headers: { 'x-apikey': VT_KEY } });
      if (vtRes.ok) {
        const vtData = await vtRes.json();
        const stats = vtData.data?.attributes?.last_analysis_stats || {};
        const threatCount = (stats.malicious || 0) + (stats.suspicious || 0);
        scanResult = { is_safe: threatCount === 0, scan_id: vtData.data?.id || file_hash, threats_found: [], scan_date: new Date().toISOString(), confidence: 85 };
      } else {
        scanResult = { is_safe: true, scan_id: `unknown-${file_hash.substring(0, 16)}`, threats_found: [], scan_date: new Date().toISOString(), confidence: 30 };
      }
    } else {
      // Basic heuristic scan
      const dangerous = ['.exe', '.dll', '.bat', '.cmd', '.ps1', '.vbs', '.jar', '.msi'];
      const hasDangerous = dangerous.some(ext => (file_name || '').toLowerCase().endsWith(ext));
      scanResult = { is_safe: !hasDangerous, scan_id: `basic-${file_hash.substring(0, 16)}`, threats_found: hasDangerous ? ['Potentially dangerous file extension'] : [], scan_date: new Date().toISOString(), confidence: 40 };
    }

    // Cache result
    await query(
      `INSERT INTO document_scan_results (file_hash, file_name, file_size, is_safe, scan_id, threats_found, confidence, scanned_at, scanned_by, document_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (file_hash) DO UPDATE SET is_safe = EXCLUDED.is_safe, threats_found = EXCLUDED.threats_found, confidence = EXCLUDED.confidence, scanned_at = EXCLUDED.scanned_at`,
      [file_hash, (file_name || '').substring(0, 255), file_size, scanResult.is_safe, scanResult.scan_id, scanResult.threats_found, scanResult.confidence, scanResult.scan_date, userId, document_id || null]
    ).catch(() => {}); // Ignore cache errors

    res.json(scanResult);
  } catch (err) {
    console.error('[scan-document] error:', err.message);
    res.status(500).json({ error: 'Failed to scan document', is_safe: false, confidence: 0 });
  }
});

// ── secure-document-manager ──────────────────────────────────
router.post('/secure-document-manager', async (req, res) => {
  try {
    const userId = req.jwtPayload?.sub;
    if (!userId) return res.status(401).json({ error: 'Authorization required' });

    const { action, document_id, lead_id } = req.body;

    switch (action) {
      case 'validate_upload_access': {
        const leads = await query(`SELECT user_id FROM leads WHERE id = $1`, [lead_id]);
        if (!leads.length) return res.status(404).json({ allowed: false, reason: 'Lead not found' });
        const roles = await query(`SELECT get_user_role($1) AS role`, [userId]);
        const allowed = leads[0].user_id === userId || ['admin', 'super_admin'].includes(roles[0]?.role);
        return res.json({ allowed, reason: allowed ? 'Upload authorized' : 'Not authorized', secure_path: allowed ? `${userId}/${lead_id}/` : null });
      }
      case 'validate_document_access':
      case 'validate_document_modification':
      case 'validate_document_deletion': {
        const accessAction = action.replace('validate_document_', '');
        const rows = await query(`SELECT validate_document_access($1, $2) AS result`, [document_id, accessAction === 'access' ? 'read' : accessAction === 'modification' ? 'write' : 'delete']);
        return res.json({ allowed: !!rows[0]?.result, reason: rows[0]?.result ? 'Access granted' : 'Access denied' });
      }
      case 'get_secure_documents': {
        const docs = await query(
          `SELECT id, document_name, document_type, file_size, file_mime_type, status, uploaded_at, verified_at, verified_by, notes, metadata, user_id
           FROM lead_documents WHERE lead_id = $1 ORDER BY uploaded_at DESC`, [lead_id]);
        return res.json({ documents: docs, total: docs.length });
      }
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (err) {
    console.error('[secure-document-manager] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── secure-profile-access ────────────────────────────────────
router.post('/secure-profile-access', async (req, res) => {
  try {
    const userId = req.jwtPayload?.sub;
    if (!userId) return res.status(401).json({ error: 'Authorization required' });

    const { action, profile_id, updates, profile_ids } = req.body;

    switch (action) {
      case 'get_masked_profile': {
        const rows = await query(`SELECT get_masked_profile_data($1, $2) AS result`, [profile_id, userId]);
        return res.json({ data: rows[0]?.result });
      }
      case 'get_multiple_profiles': {
        if (!Array.isArray(profile_ids)) return res.status(400).json({ error: 'profile_ids must be an array' });
        const results = await Promise.all(profile_ids.map(async pid => {
          const rows = await query(`SELECT get_masked_profile_data($1, $2) AS result`, [pid, userId]);
          return rows[0]?.result || null;
        }));
        return res.json({ data: results.filter(Boolean) });
      }
      case 'update_profile_secure': {
        if (profile_id !== userId) {
          const roles = await query(`SELECT get_user_role($1) AS role`, [userId]);
          if (!['admin', 'super_admin'].includes(roles[0]?.role)) return res.status(403).json({ error: 'Unauthorized' });
        }
        const rows = await query(`SELECT update_profile_secure($1, $2) AS result`, [profile_id, JSON.stringify(updates)]);
        return res.json({ data: rows[0]?.result });
      }
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (err) {
    console.error('[secure-profile-access] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
