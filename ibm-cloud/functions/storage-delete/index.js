/**
 * IBM Cloud Function: storage-delete
 * Deletes one or more objects from IBM COS using native ibm-cos-sdk.
 *
 * Body: { bucket: string, paths: string[] }
 *
 * Environment variables (set via --param):
 *   IBM_COS_API_KEY, IBM_COS_INSTANCE_ID, IBM_COS_ENDPOINT
 *   IBM_COS_HMAC_ACCESS_KEY, IBM_COS_HMAC_SECRET_KEY, USE_HMAC
 */

'use strict';

const IBMCOS = require('ibm-cos-sdk');

function getS3(params) {
  const endpoint = params.IBM_COS_ENDPOINT || process.env.IBM_COS_ENDPOINT;
  const useHmac  = (params.USE_HMAC || process.env.USE_HMAC) === 'true';

  if (useHmac) {
    return new IBMCOS.S3({
      accessKeyId:     params.IBM_COS_HMAC_ACCESS_KEY || process.env.IBM_COS_HMAC_ACCESS_KEY,
      secretAccessKey: params.IBM_COS_HMAC_SECRET_KEY || process.env.IBM_COS_HMAC_SECRET_KEY,
      region: 'ibm',
      endpoint: new IBMCOS.Endpoint(endpoint),
    });
  }

  return new IBMCOS.S3({
    apiKeyId:          params.IBM_COS_API_KEY     || process.env.IBM_COS_API_KEY,
    serviceInstanceId: params.IBM_COS_INSTANCE_ID || process.env.IBM_COS_INSTANCE_ID,
    region: 'ibm',
    endpoint: new IBMCOS.Endpoint(endpoint),
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

  const body = typeof params.__ow_body === 'string'
    ? JSON.parse(Buffer.from(params.__ow_body, 'base64').toString('utf8'))
    : (params.body ? (typeof params.body === 'string' ? JSON.parse(params.body) : params.body) : params);

  const { bucket, paths } = body;

  if (!bucket || !Array.isArray(paths) || paths.length === 0) {
    return { statusCode: 400, headers: corsHeaders, body: { error: 'bucket and paths[] are required' } };
  }

  try {
    const s3      = getS3(params);
    const objects = paths.map((p) => ({ Key: p }));

    const data = await s3.deleteObjects({
      Bucket: bucket,
      Delete: { Objects: objects, Quiet: false },
    }).promise();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: {
        deleted: (data.Deleted || []).map((d) => d.Key),
        errors:  (data.Errors  || []),
      },
    };
  } catch (err) {
    console.error('[storage-delete] Error:', err.message);
    return { statusCode: 500, headers: corsHeaders, body: { error: 'Failed to delete files', detail: err.message } };
  }
}

exports.main = main;
