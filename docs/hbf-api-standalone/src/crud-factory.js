const express = require('express');
const { query, uuidv4 } = require('./db');

function crudRoutes({ table, filterParams = [], requiredFields = [], allowDelete = false }) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      let sql = `SELECT * FROM "${table}" WHERE 1=1`;
      const params = [];
      let idx = 1;
      for (const fp of filterParams) {
        if (req.query[fp] !== undefined) {
          sql += ` AND "${fp}" = $${idx++}`;
          params.push(req.query[fp]);
        }
      }
      const orderCol = req.query.order_by || 'created_at';
      const orderDir = req.query.order_dir === 'asc' ? 'ASC' : 'DESC';
      sql += /^[a-z_]+$/i.test(orderCol) ? ` ORDER BY "${orderCol}" ${orderDir}` : ` ORDER BY "created_at" DESC`;
      const limit = Math.min(parseInt(req.query.limit) || 100, 500);
      const offset = parseInt(req.query.offset) || 0;
      sql += ` LIMIT ${limit} OFFSET ${offset}`;
      const rows = await query(sql, params);
      res.json(rows);
    } catch (err) {
      console.error(`[${table}] GET / error:`, err.message);
      res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const rows = await query(`SELECT * FROM "${table}" WHERE id = $1`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
      res.json(rows[0]);
    } catch (err) {
      console.error(`[${table}] GET /:id error:`, err.message);
      res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
    }
  });

  router.post('/', async (req, res) => {
    try {
      for (const field of requiredFields) {
        if (!req.body[field] && req.body[field] !== 0 && req.body[field] !== false) {
          return res.status(400).json({ error: { message: `Missing required field: ${field}`, code: 'MISSING_FIELDS' } });
        }
      }
      const id = req.body.id || uuidv4();
      const now = new Date().toISOString();
      const record = { ...req.body, id, created_at: now, updated_at: now };
      const cols = Object.keys(record).filter(k => record[k] !== undefined);
      const vals = cols.map(k => typeof record[k] === 'object' && record[k] !== null ? JSON.stringify(record[k]) : record[k]);
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      await query(`INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`, vals);
      const rows = await query(`SELECT * FROM "${table}" WHERE id = $1`, [id]);
      res.status(201).json(rows[0] || record);
    } catch (err) {
      console.error(`[${table}] POST / error:`, err.message);
      if (err.code === '23505') return res.status(409).json({ error: { message: 'Duplicate record', code: 'DUPLICATE' } });
      res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const existing = await query(`SELECT id FROM "${table}" WHERE id = $1`, [req.params.id]);
      if (!existing.length) return res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
      const updates = { ...req.body, updated_at: new Date().toISOString() };
      delete updates.id; delete updates.created_at;
      const keys = Object.keys(updates);
      if (!keys.length) return res.status(400).json({ error: { message: 'No fields to update', code: 'EMPTY_UPDATE' } });
      const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`);
      const vals = keys.map(k => typeof updates[k] === 'object' && updates[k] !== null ? JSON.stringify(updates[k]) : updates[k]);
      vals.push(req.params.id);
      await query(`UPDATE "${table}" SET ${setClauses.join(', ')} WHERE id = $${keys.length + 1}`, vals);
      const rows = await query(`SELECT * FROM "${table}" WHERE id = $1`, [req.params.id]);
      res.json(rows[0]);
    } catch (err) {
      console.error(`[${table}] PUT /:id error:`, err.message);
      res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
    }
  });

  if (allowDelete) {
    router.delete('/:id', async (req, res) => {
      try {
        const existing = await query(`SELECT id FROM "${table}" WHERE id = $1`, [req.params.id]);
        if (!existing.length) return res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
        await query(`DELETE FROM "${table}" WHERE id = $1`, [req.params.id]);
        res.json({ success: true });
      } catch (err) {
        console.error(`[${table}] DELETE /:id error:`, err.message);
        res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    });
  }

  return router;
}

module.exports = crudRoutes;
