/**
 * IBM Cloud Function: storage-sign
 * Generates pre-signed URLs for IBM Cloud Object Storage (COS)
 * using the native ibm-cos-sdk (IAM or HMAC credentials).
 *
 * Environment variables required (set via ibmcloud fn action update --param):
 *   IBM_COS_API_KEY          — IAM API key with COS Writer role (preferred)
 *   IBM_COS_INSTANCE_ID      — COS resource instance ID (crn:v1:...)
 *   IBM_COS_ENDPOINT         — COS public endpoint (e.g. s3.us-south.cloud-object-storage.appdomain.cloud)
 *   IBM_COS_HMAC_ACCESS_KEY  — HMAC access key id  (only needed if USE_HMAC=true)
 *   IBM_COS_HMAC_SECRET_KEY  — HMAC secret access key (only needed if USE_HMAC=true)
 *   USE_HMAC                 — 'true' to use HMAC credentials; default: IAM
 */

'use strict';

const IBMCOS = require('ibm-cos-sdk');

// ── S3 client factory ────────────────────────────────────────────────────────

function getS3(params) {
  const endpoint = params.IBM_COS_ENDPOINT || process.env.IBM_COS_ENDPOINT;
  const useHmac  = (params.USE_HMAC || process.env.USE_HMAC) === 'true';

  let s3Options;

  if (useHmac) {
    const accessKeyId     = params.IBM_COS_HMAC_ACCESS_KEY || process.env.IBM_COS_HMAC_ACCESS_KEY;
    const secretAccessKey = params.IBM_COS_HMAC_SECRET_KEY || process.env.IBM_COS_HMAC_SECRET_KEY;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('HMAC credentials (IBM_COS_HMAC_ACCESS_KEY / IBM_COS_HMAC_SECRET_KEY) are required when USE_HMAC=true');
    }

    s3Options = {
      accessKeyId,
      secretAccessKey,
      region: 'ibm',
      endpoint: new IBMCOS.Endpoint(endpoint),
    };
  } else {
    const apiKeyId           = params.IBM_COS_API_KEY       || process.env.IBM_COS_API_KEY;
    const serviceInstanceId  = params.IBM_COS_INSTANCE_ID   || process.env.IBM_COS_INSTANCE_ID;

    if (!apiKeyId) throw new Error('IBM_COS_API_KEY is required for IAM authentication');

    s3Options = {
      apiKeyId,
      serviceInstanceId,
      region: 'ibm',
      endpoint: new IBMCOS.Endpoint(endpoint),
    };
  }

  return new IBMCOS.S3(s3Options);
}

// ── Pre-signed URL helpers ───────────────────────────────────────────────────

/**
 * Generate a pre-signed PUT URL for file upload.
 * ibm-cos-sdk uses the same getSignedUrl API as aws-sdk v2.
 */
function getUploadUrl(s3, bucket, key, contentType, expiresIn) {
  return new Promise((resolve, reject) => {
    s3.getSignedUrl('putObject', {
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      Expires: expiresIn,
    }, (err, url) => {
      if (err) return reject(err);
      resolve(url);
    });
  });
}

/**
 * Generate a pre-signed GET URL for file download.
 */
function getDownloadUrl(s3, bucket, key, expiresIn) {
  return new Promise((resolve, reject) => {
    s3.getSignedUrl('getObject', {
      Bucket: bucket,
      Key: key,
      Expires: expiresIn,
    }, (err, url) => {
      if (err) return reject(err);
      resolve(url);
    });
  });
}

// ── Main handler ─────────────────────────────────────────────────────────────

async function main(params) {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle pre-flight
  if (params.__ow_method === 'options') {
    return { statusCode: 200, headers: corsHeaders, body: {} };
  }

  // Parse body (web actions deliver it as a string)
  const body = typeof params.__ow_body === 'string'
    ? JSON.parse(Buffer.from(params.__ow_body, 'base64').toString('utf8'))
    : (params.body ? (typeof params.body === 'string' ? JSON.parse(params.body) : params.body) : params);

  const { bucket, path, operation, contentType } = body;

  if (!bucket || !path || !operation) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: { error: 'bucket, path, and operation are required' },
    };
  }

  if (!['upload', 'download'].includes(operation)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: { error: 'operation must be "upload" or "download"' },
    };
  }

  try {
    const s3        = getS3(params);
    const expiresIn = 3600; // 1 hour
    const endpoint  = params.IBM_COS_ENDPOINT || process.env.IBM_COS_ENDPOINT;

    if (operation === 'upload') {
      const resolvedContentType = contentType || 'application/octet-stream';
      const signedUrl  = await getUploadUrl(s3, bucket, path, resolvedContentType, expiresIn);
      const publicUrl  = `https://${bucket}.${endpoint}/${path}`;

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: { signedUrl, publicUrl },
      };
    }

    // operation === 'download'
    const signedUrl = await getDownloadUrl(s3, bucket, path, expiresIn);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: { signedUrl },
    };

  } catch (err) {
    console.error('[storage-sign] Error:', err.message);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: { error: 'Failed to generate signed URL', detail: err.message },
    };
  }
}

exports.main = main;
