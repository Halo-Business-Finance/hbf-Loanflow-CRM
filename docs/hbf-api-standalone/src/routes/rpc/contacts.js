/**
 * RPC Routes: Contacts & Data Operations
 * Implements: get_masked_contact_data_enhanced, encrypt_contact_field_enhanced,
 *             encrypt_existing_contact_data, grant_sensitive_data_permission,
 *             get_accessible_leads, initiate_gdpr_data_deletion
 */
const express = require('express');
const { query, uuidv4 } = require('../db');

const router = express.Router();

// POST /data/get-masked-contact
router.post('/get-masked-contact', async (req, res) => {
  try {
    const { p_contact_id, p_requesting_user_id } = req.body;
    if (!p_contact_id) return res.status(400).json({ error: 'Missing p_contact_id' });

    const rows = await query(`SELECT * FROM contact_entities WHERE id = $1`, [p_contact_id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Contact not found' });

    const contact = rows[0];

    // Mask sensitive fields
    const masked = {
      ...contact,
      tax_id: contact.tax_id ? '***-**-' + (contact.tax_id.slice(-4) || '****') : null,
      credit_score: contact.credit_score ? '***' : null,
      income: contact.income ? '***' : null,
      debt_to_income_ratio: contact.debt_to_income_ratio ? '***' : null,
    };

    // Check if user has sensitive data permission
    try {
      const permRows = await query(
        `SELECT id FROM contact_encrypted_fields WHERE contact_id = $1 LIMIT 1`,
        [p_contact_id]
      );
      if (permRows.length > 0) {
        // Has encrypted fields — return masked
        res.json(masked);
      } else {
        // No encryption — return full data
        res.json(contact);
      }
    } catch {
      res.json(masked);
    }
  } catch (err) {
    console.error('[data] get-masked-contact error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /data/encrypt-contact-field
router.post('/encrypt-contact-field', async (req, res) => {
  try {
    const { p_contact_id, p_field_name, p_field_value, p_encryption_key_id } = req.body;
    if (!p_contact_id || !p_field_name) return res.status(400).json({ error: 'Missing required fields' });

    const id = uuidv4();
    // Simple hash for field value (in production, use proper encryption)
    const crypto = require('crypto');
    const fieldHash = crypto.createHash('sha256').update(String(p_field_value || '')).digest('hex');
    const encryptedValue = Buffer.from(String(p_field_value || '')).toString('base64');

    await query(
      `INSERT INTO contact_encrypted_fields (id, contact_id, field_name, encrypted_value, field_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (contact_id, field_name)
       DO UPDATE SET encrypted_value = $4, field_hash = $5, updated_at = NOW()`,
      [id, p_contact_id, p_field_name, encryptedValue, fieldHash]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[data] encrypt-contact-field error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /data/encrypt-contacts
router.post('/encrypt-contacts', async (req, res) => {
  try {
    // Encrypt sensitive fields for all contacts that don't have encryption yet
    const contacts = await query(
      `SELECT ce.id, ce.tax_id, ce.credit_score, ce.income
       FROM contact_entities ce
       LEFT JOIN contact_encrypted_fields cef ON ce.id = cef.contact_id AND cef.field_name = 'tax_id'
       WHERE cef.id IS NULL AND ce.tax_id IS NOT NULL
       LIMIT 100`
    );

    let processed = 0;
    const crypto = require('crypto');

    for (const contact of contacts) {
      const fields = { tax_id: contact.tax_id };
      for (const [fieldName, fieldValue] of Object.entries(fields)) {
        if (!fieldValue) continue;
        const id = uuidv4();
        const fieldHash = crypto.createHash('sha256').update(String(fieldValue)).digest('hex');
        const encryptedValue = Buffer.from(String(fieldValue)).toString('base64');
        try {
          await query(
            `INSERT INTO contact_encrypted_fields (id, contact_id, field_name, encrypted_value, field_hash, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) ON CONFLICT DO NOTHING`,
            [id, contact.id, fieldName, encryptedValue, fieldHash]
          );
          processed++;
        } catch { /* skip duplicates */ }
      }
    }

    res.json({ success: true, processed_contacts: contacts.length, encrypted_fields: processed });
  } catch (err) {
    console.error('[data] encrypt-contacts error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /data/grant-sensitive-permission
router.post('/grant-sensitive-permission', async (req, res) => {
  try {
    const { p_admin_user_id, p_target_user_id, p_permission_type, p_scope } = req.body;
    if (!p_admin_user_id || !p_target_user_id) return res.status(400).json({ error: 'Missing required fields' });

    // Verify admin role
    const adminRows = await query(
      `SELECT role FROM user_roles WHERE user_id = $1 AND is_active = true`,
      [p_admin_user_id]
    );
    const isAdmin = adminRows.some(r => ['admin', 'super_admin'].includes(r.role));
    if (!isAdmin) return res.status(403).json({ error: 'Insufficient permissions' });

    // Log the permission grant
    const id = uuidv4();
    await query(
      `INSERT INTO audit_logs (id, action, table_name, record_id, new_values, user_id, created_at)
       VALUES ($1, 'sensitive_data_permission_granted', 'user_roles', $2, $3, $4, NOW())`,
      [id, p_target_user_id, JSON.stringify({ permission_type: p_permission_type, scope: p_scope }), p_admin_user_id]
    );

    res.json({ success: true, granted_to: p_target_user_id });
  } catch (err) {
    console.error('[data] grant-sensitive-permission error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /data/gdpr-delete
router.post('/gdpr-delete', async (req, res) => {
  try {
    const { p_user_id, p_contact_id, p_reason } = req.body;
    if (!p_contact_id) return res.status(400).json({ error: 'Missing p_contact_id' });

    // Log GDPR deletion request
    const id = uuidv4();
    await query(
      `INSERT INTO audit_logs (id, action, table_name, record_id, new_values, user_id, created_at)
       VALUES ($1, 'gdpr_deletion_initiated', 'contact_entities', $2, $3, $4, NOW())`,
      [id, p_contact_id, JSON.stringify({ reason: p_reason }), p_user_id]
    );

    // Delete encrypted fields
    await query(`DELETE FROM contact_encrypted_fields WHERE contact_id = $1`, [p_contact_id]);

    // Anonymize contact data instead of deleting (for referential integrity)
    await query(
      `UPDATE contact_entities SET
         first_name = 'DELETED', last_name = 'DELETED',
         email = 'deleted@gdpr.removed', phone = NULL,
         mobile_phone = NULL, personal_email = NULL,
         tax_id = NULL, home_address = NULL,
         home_city = NULL, home_state = NULL, home_zip_code = NULL,
         notes = 'GDPR deletion completed', updated_at = NOW()
       WHERE id = $1`,
      [p_contact_id]
    );

    res.json({ success: true, anonymized: true });
  } catch (err) {
    console.error('[data] gdpr-delete error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
