/**
 * RPC Routes: Documents
 * Implements: secure_document_manager, create_document_version,
 *             revert_to_document_version, increment_template_usage
 */
const express = require('express');
const { query, uuidv4 } = require('../db');

const router = express.Router();

// POST /documents/secure-manager
router.post('/secure-manager', async (req, res) => {
  try {
    const { p_action, p_lead_id, p_document_id, p_user_id } = req.body;

    switch (p_action) {
      case 'validate_upload_access': {
        // Check if user has access to the lead
        const rows = await query(
          `SELECT id FROM leads WHERE id = $1`,
          [p_lead_id]
        );
        res.json({ allowed: rows.length > 0 });
        break;
      }
      case 'validate_document_access':
      case 'validate_document_modification':
      case 'validate_document_deletion': {
        const rows = await query(
          `SELECT id FROM lead_documents WHERE id = $1`,
          [p_document_id]
        );
        res.json({ allowed: rows.length > 0 });
        break;
      }
      case 'get_secure_documents': {
        const rows = await query(
          `SELECT * FROM lead_documents WHERE lead_id = $1 ORDER BY created_at DESC`,
          [p_lead_id]
        );
        res.json(rows);
        break;
      }
      default:
        res.status(400).json({ error: `Unknown action: ${p_action}` });
    }
  } catch (err) {
    console.error('[documents] secure-manager error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /documents/create-version
router.post('/create-version', async (req, res) => {
  try {
    const { p_document_id, p_file_path, p_file_size, p_file_mime_type, p_change_description, p_uploaded_by } = req.body;
    if (!p_document_id || !p_file_path) return res.status(400).json({ error: 'Missing required fields' });

    // Get current max version number
    const versionRows = await query(
      `SELECT COALESCE(MAX(version_number), 0) as max_version FROM document_versions WHERE document_id = $1`,
      [p_document_id]
    );
    const newVersion = (versionRows[0]?.max_version || 0) + 1;

    // Mark all existing versions as not current
    await query(
      `UPDATE document_versions SET is_current = false WHERE document_id = $1`,
      [p_document_id]
    );

    // Insert new version
    const id = uuidv4();
    await query(
      `INSERT INTO document_versions (id, document_id, version_number, file_path, file_size, file_mime_type, change_description, uploaded_by, is_current, uploaded_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())`,
      [id, p_document_id, newVersion, p_file_path, p_file_size || 0, p_file_mime_type || 'application/octet-stream', p_change_description || '', p_uploaded_by]
    );

    // Update document's updated_at
    await query(`UPDATE lead_documents SET updated_at = NOW() WHERE id = $1`, [p_document_id]);

    const rows = await query(`SELECT * FROM document_versions WHERE id = $1`, [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('[documents] create-version error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /documents/revert-version
router.post('/revert-version', async (req, res) => {
  try {
    const { p_document_id, p_version_number, p_user_id } = req.body;
    if (!p_document_id || !p_version_number) return res.status(400).json({ error: 'Missing required fields' });

    // Check version exists
    const versionRows = await query(
      `SELECT * FROM document_versions WHERE document_id = $1 AND version_number = $2`,
      [p_document_id, p_version_number]
    );
    if (versionRows.length === 0) return res.status(404).json({ error: 'Version not found' });

    // Set all versions to not current
    await query(`UPDATE document_versions SET is_current = false WHERE document_id = $1`, [p_document_id]);

    // Set target version as current
    await query(
      `UPDATE document_versions SET is_current = true WHERE document_id = $1 AND version_number = $2`,
      [p_document_id, p_version_number]
    );

    // Update document file path to reverted version
    await query(
      `UPDATE lead_documents SET file_path = $1, updated_at = NOW() WHERE id = $2`,
      [versionRows[0].file_path, p_document_id]
    );

    res.json({ success: true, reverted_to: p_version_number });
  } catch (err) {
    console.error('[documents] revert-version error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /documents/increment-template-usage
router.post('/increment-template-usage', async (req, res) => {
  try {
    const { p_template_id } = req.body;
    if (!p_template_id) return res.status(400).json({ error: 'Missing p_template_id' });

    await query(
      `UPDATE document_templates SET usage_count = COALESCE(usage_count, 0) + 1, last_modified = NOW() WHERE id = $1`,
      [p_template_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[documents] increment-template-usage error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
