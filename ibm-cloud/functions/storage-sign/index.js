/**
 * IBM Cloud Function: storage-sign
 * Generates pre-signed URLs for IBM Cloud Object Storage (COS).
 * Keeps COS HMAC credentials server-side only.
 *
 * Environment variables required:
 *   IBM_COS_API_KEY         — IBM Cloud API key with COS Writer role
 *   IBM_COS_INSTANCE_ID     — COS service instance ID (resource instance ID)
 *   IBM_COS_ENDPOINT        — COS endpoint (e.g. s3.us-south.cloud-object-storage.appdomain.cloud)
 *   IBM_COS_BUCKET_DOCUMENTS — default documents bucket name
 */

const { S3 } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

function getCOSClient() {
  return new S3({
    endpoint: `https://${process.env.IBM_COS_ENDPOINT}`,
    region: 'us-south',
    credentials: {
      accessKeyId: process.env.IBM_COS_HMAC_ACCESS_KEY,
      secretAccessKey: process.env.IBM_COS_HMAC_SECRET_KEY,
    },
    forcePathStyle: true,
  });
}

async function main(params) {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (params.__ow_method === 'options') {
    return { statusCode: 200, headers: corsHeaders, body: {} };
  }

  const body = typeof params.body === 'string' ? JSON.parse(params.body) : params;
  const { bucket, path, operation, contentType } = body;

  if (!bucket || !path || !operation) {
    return { statusCode: 400, headers: corsHeaders, body: { error: 'bucket, path, and operation are required' } };
  }

  const cos = getCOSClient();
  const expiresIn = 3600; // 1 hour

  try {
    let signedUrl;

    if (operation === 'upload') {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: path,
        ContentType: contentType || 'application/octet-stream',
      });
      signedUrl = await getSignedUrl(cos, command, { expiresIn });

      const endpoint = process.env.IBM_COS_ENDPOINT;
      const publicUrl = `https://${bucket}.${endpoint}/${path}`;

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: { signedUrl, publicUrl },
      };
    }

    if (operation === 'download') {
      const command = new GetObjectCommand({ Bucket: bucket, Key: path });
      signedUrl = await getSignedUrl(cos, command, { expiresIn });
      return { statusCode: 200, headers: corsHeaders, body: { signedUrl } };
    }

    return { statusCode: 400, headers: corsHeaders, body: { error: 'operation must be upload or download' } };
  } catch (err) {
    console.error('[storage-sign] Error:', err.message);
    return { statusCode: 500, headers: corsHeaders, body: { error: 'Failed to generate signed URL' } };
  }
}

exports.main = main;
