/**
 * IBM Cloud Function: storage-list
 * Lists objects inside an IBM COS bucket/prefix using native ibm-cos-sdk.
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

  const { bucket, prefix, limit = 100 } = body;

  if (!bucket) {
    return { statusCode: 400, headers: corsHeaders, body: { error: 'bucket is required' } };
  }

  try {
    const s3   = getS3(params);
    const data = await s3.listObjectsV2({
      Bucket:  bucket,
      Prefix:  prefix || '',
      MaxKeys: limit,
    }).promise();

    const files = (data.Contents || []).map((obj) => ({
      name:         obj.Key,
      path:         obj.Key,
      size:         obj.Size,
      lastModified: obj.LastModified,
    }));

    return { statusCode: 200, headers: corsHeaders, body: { files } };
  } catch (err) {
    console.error('[storage-list] Error:', err.message);
    return { statusCode: 500, headers: corsHeaders, body: { error: 'Failed to list files', detail: err.message } };
  }
}

exports.main = main;
