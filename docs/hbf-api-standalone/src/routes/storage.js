/**
 * IBM Cloud Object Storage (COS) Routes
 *
 * Provides signed-URL-based upload/download, listing, and deletion
 * using the ibm-cos-sdk (S3-compatible). COS credentials are server-side only.
 *
 * Routes:
 *   POST /storage-sign   — Generate a signed PUT or GET URL
 *   POST /storage-list   — List objects in a bucket/prefix
 *   POST /storage-delete  — Delete one or more objects
 */

const express = require('express');
const router = express.Router();

// ibm-cos-sdk is S3-compatible; we lazy-init so the app boots even without COS creds
let cosClient = null;

function getCOS() {
  if (cosClient) return cosClient;

  const IBMCOS = require('ibm-cos-sdk');

  cosClient = new IBMCOS.S3({
    endpoint: process.env.IBM_COS_ENDPOINT || 's3.us-south.cloud-object-storage.appdomain.cloud',
    apiKeyId: process.env.IBM_COS_API_KEY,
    serviceInstanceId: process.env.IBM_COS_INSTANCE_ID,
    signatureVersion: 'iam',
  });

  return cosClient;
}

// ── POST /storage-sign ──────────────────────────────────────────
router.post('/storage-sign', async (req, res) => {
  try {
    const { bucket, path, operation, contentType, expiresIn } = req.body;

    if (!bucket || !path) {
      return res.status(400).json({ error: { message: 'bucket and path are required', code: 'MISSING_FIELDS' } });
    }

    const cos = getCOS();
    const expiry = expiresIn || 900; // 15 min default

    if (operation === 'upload') {
      const signedUrl = await cos.getSignedUrlPromise('putObject', {
        Bucket: bucket,
        Key: path,
        Expires: expiry,
        ContentType: contentType || 'application/octet-stream',
      });

      const publicUrl = `https://${bucket}.${process.env.IBM_COS_ENDPOINT || 's3.us-south.cloud-object-storage.appdomain.cloud'}/${path}`;

      return res.json({ signedUrl, publicUrl });
    }

    // download (default)
    const signedUrl = await cos.getSignedUrlPromise('getObject', {
      Bucket: bucket,
      Key: path,
      Expires: expiry,
    });

    return res.json({ signedUrl });
  } catch (err) {
    console.error('[storage-sign] error:', err.message);
    res.status(500).json({ error: { message: err.message, code: 'STORAGE_ERROR' } });
  }
});

// ── POST /storage-list ──────────────────────────────────────────
router.post('/storage-list', async (req, res) => {
  try {
    const { bucket, prefix, limit } = req.body;

    if (!bucket) {
      return res.status(400).json({ error: { message: 'bucket is required', code: 'MISSING_FIELDS' } });
    }

    const cos = getCOS();
    const params = {
      Bucket: bucket,
      Prefix: prefix || '',
      MaxKeys: Math.min(limit || 100, 1000),
    };

    const result = await cos.listObjectsV2(params).promise();

    const files = (result.Contents || []).map(obj => ({
      name: obj.Key.split('/').pop(),
      size: obj.Size,
      lastModified: obj.LastModified?.toISOString() || '',
      path: obj.Key,
    }));

    res.json({ files });
  } catch (err) {
    console.error('[storage-list] error:', err.message);
    res.status(500).json({ error: { message: err.message, code: 'STORAGE_ERROR' } });
  }
});

// ── POST /storage-delete ────────────────────────────────────────
router.post('/storage-delete', async (req, res) => {
  try {
    const { bucket, paths } = req.body;

    if (!bucket || !paths || !paths.length) {
      return res.status(400).json({ error: { message: 'bucket and paths[] are required', code: 'MISSING_FIELDS' } });
    }

    const cos = getCOS();

    const deleteParams = {
      Bucket: bucket,
      Delete: {
        Objects: paths.map(p => ({ Key: p })),
        Quiet: true,
      },
    };

    await cos.deleteObjects(deleteParams).promise();
    res.json({ success: true, deleted: paths.length });
  } catch (err) {
    console.error('[storage-delete] error:', err.message);
    res.status(500).json({ error: { message: err.message, code: 'STORAGE_ERROR' } });
  }
});

module.exports = router;
