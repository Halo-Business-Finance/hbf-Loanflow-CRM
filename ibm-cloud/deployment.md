# IBM Cloud Full Migration Guide for CRM Application

## Overview

This guide covers migrating the entire CRM application from Supabase to IBM Cloud services, including database, authentication, serverless functions, storage, and AI capabilities.

## IBM Cloud Services Mapping

| Current (Supabase) | IBM Cloud Equivalent |
|-------------------|---------------------|
| PostgreSQL Database | IBM Cloud Databases for PostgreSQL |
| Supabase Auth | IBM App ID |
| Edge Functions | IBM Cloud Functions (OpenWhisk) |
| Storage Buckets | IBM Cloud Object Storage |
| Realtime Subscriptions | IBM Event Streams (Kafka) |
| Lovable AI Gateway | IBM watsonx.ai |

## Prerequisites

- IBM Cloud account with pay-as-you-go billing
- IBM Cloud CLI installed (`ibmcloud`)
- Node.js 18+ and npm
- Docker installed (for containerized deployment)
- kubectl (for Kubernetes deployment)

```bash
# Install IBM Cloud CLI
curl -fsSL https://clis.cloud.ibm.com/install/linux | sh

# Login to IBM Cloud
ibmcloud login --sso

# Install required plugins
ibmcloud plugin install cloud-functions
ibmcloud plugin install cloud-databases
ibmcloud plugin install container-service
ibmcloud plugin install container-registry
```

---

## Phase 1: Infrastructure Setup

### 1.1 Create Resource Group

```bash
# Create resource group for CRM
ibmcloud resource group-create crm-production

# Target the resource group
ibmcloud target -g crm-production
```

### 1.2 Create IBM Cloud Databases for PostgreSQL

```bash
# Create PostgreSQL instance
ibmcloud resource service-instance-create crm-database \
  databases-for-postgresql standard us-south \
  -p '{
    "members_memory_allocation_mb": 8192,
    "members_disk_allocation_mb": 20480,
    "members_cpu_allocation_count": 3
  }'

# Get service credentials
ibmcloud resource service-key-create crm-db-key Administrator \
  --instance-name crm-database

# View credentials
ibmcloud resource service-key crm-db-key --output json
```

### 1.3 Create IBM App ID (Authentication)

```bash
# Create App ID instance
ibmcloud resource service-instance-create crm-auth appid graduated-tier us-south

# Create service credentials
ibmcloud resource service-key-create crm-auth-key Writer \
  --instance-name crm-auth
```

### 1.4 Create Cloud Object Storage

```bash
# Create COS instance
ibmcloud resource service-instance-create crm-storage \
  cloud-object-storage standard global

# Create service credentials with HMAC
ibmcloud resource service-key-create crm-storage-key Writer \
  --instance-name crm-storage \
  --parameters '{"HMAC": true}'

# Create buckets
ibmcloud cos bucket-create \
  --bucket crm-documents \
  --ibm-service-instance-id <instance-id> \
  --region us-south
```

### 1.5 Create IBM Event Streams (for Realtime)

```bash
# Create Event Streams instance
ibmcloud resource service-instance-create crm-events \
  messagehub standard us-south

# Create service credentials
ibmcloud resource service-key-create crm-events-key Manager \
  --instance-name crm-events
```

### 1.6 Create IBM watsonx.ai (for AI features)

```bash
# Create watsonx.ai instance
ibmcloud resource service-instance-create crm-ai \
  watson-machine-learning v2-professional us-south

# Create service credentials
ibmcloud resource service-key-create crm-ai-key Writer \
  --instance-name crm-ai
```

---

## Phase 2: Database Migration

### 2.1 Export Supabase Data

```bash
# Using Supabase CLI to export schema and data
supabase db dump --data-only > supabase_data.sql
supabase db dump --schema-only > supabase_schema.sql
```

### 2.2 PostgreSQL Schema Conversion

The schema is largely compatible. Key differences:

```sql
-- IBM Cloud Databases for PostgreSQL schema adjustments

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create application schema
CREATE SCHEMA IF NOT EXISTS crm;

-- Leads table (converted from Supabase)
CREATE TABLE crm.leads (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    location VARCHAR(255),
    stage VARCHAR(50) DEFAULT 'Initial Contact',
    priority VARCHAR(20) DEFAULT 'medium',
    loan_amount DECIMAL(15,2),
    loan_type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_leads_user_id ON crm.leads(user_id);
CREATE INDEX idx_leads_stage ON crm.leads(stage);
CREATE INDEX idx_leads_created_at ON crm.leads(created_at DESC);

-- Row-Level Security using PostgreSQL RLS (supported in IBM Cloud PostgreSQL)
ALTER TABLE crm.leads ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (application must set session variable)
CREATE POLICY leads_user_policy ON crm.leads
    FOR ALL
    TO crm_app_user
    USING (user_id = current_setting('app.current_user_id')::uuid);

-- Documents table
CREATE TABLE crm.lead_documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    lead_id UUID REFERENCES crm.leads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    document_type VARCHAR(100),
    storage_bucket VARCHAR(100) DEFAULT 'crm-documents',
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs table
CREATE TABLE crm.audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create audit trigger function
CREATE OR REPLACE FUNCTION crm.audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO crm.audit_logs (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (
        current_setting('app.current_user_id', true)::uuid,
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply audit trigger to leads table
CREATE TRIGGER leads_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON crm.leads
    FOR EACH ROW EXECUTE FUNCTION crm.audit_trigger_function();
```

### 2.3 Import Data to IBM Cloud PostgreSQL

```bash
# Get connection string from IBM Cloud
CONNECTION_STRING=$(ibmcloud resource service-key crm-db-key --output json | jq -r '.[0].credentials.connection.postgres.composed[0]')

# Import schema
psql "$CONNECTION_STRING" -f supabase_schema_converted.sql

# Import data
psql "$CONNECTION_STRING" -f supabase_data.sql
```

---

## Phase 3: Authentication Migration (App ID)

### 3.1 Configure IBM App ID

1. Go to IBM Cloud Console → App ID instance
2. Configure identity providers:
   - Cloud Directory (email/password)
   - Google OAuth
   - Microsoft Azure AD

### 3.2 Create Authentication Service

```typescript
// src/lib/ibm-auth.ts

import AppID from 'ibmcloud-appid-js';

interface IBMAuthConfig {
  clientId: string;
  discoveryEndpoint: string;
  redirectUri: string;
}

class IBMAuthService {
  private appId: any;
  private config: IBMAuthConfig;

  constructor(config: IBMAuthConfig) {
    this.config = config;
    this.appId = new AppID();
  }

  async initialize(): Promise<void> {
    await this.appId.init({
      clientId: this.config.clientId,
      discoveryEndpoint: this.config.discoveryEndpoint,
    });
  }

  async signIn(): Promise<{ accessToken: string; user: any }> {
    const tokens = await this.appId.signin();
    const user = await this.getUserInfo(tokens.accessToken);
    return { accessToken: tokens.accessToken, user };
  }

  async signOut(): Promise<void> {
    await this.appId.signout();
    localStorage.removeItem('ibm_access_token');
    localStorage.removeItem('ibm_user');
  }

  async getUserInfo(accessToken: string): Promise<any> {
    const response = await fetch(
      `${this.config.discoveryEndpoint}/userinfo`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    return response.json();
  }

  async refreshToken(): Promise<string> {
    const tokens = await this.appId.silentSignin();
    return tokens.accessToken;
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('ibm_access_token');
  }

  getStoredUser(): any {
    const user = localStorage.getItem('ibm_user');
    return user ? JSON.parse(user) : null;
  }
}

export const ibmAuth = new IBMAuthService({
  clientId: process.env.IBM_APPID_CLIENT_ID || '',
  discoveryEndpoint: process.env.IBM_APPID_DISCOVERY_ENDPOINT || '',
  redirectUri: window.location.origin + '/auth/callback',
});
```

### 3.3 Update AuthProvider for IBM App ID

```typescript
// src/components/auth/IBMAuthProvider.tsx

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ibmAuth } from '@/lib/ibm-auth';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function IBMAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await ibmAuth.initialize();
        const storedUser = ibmAuth.getStoredUser();
        if (storedUser) {
          setUser(storedUser);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const signIn = async () => {
    try {
      const { user } = await ibmAuth.signIn();
      setUser(user);
      localStorage.setItem('ibm_user', JSON.stringify(user));
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    await ibmAuth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useIBMAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useIBMAuth must be used within IBMAuthProvider');
  }
  return context;
};
```

---

## Phase 4: IBM Cloud Functions Migration

### 4.1 Function Structure

```
ibm-cloud/
├── functions/
│   ├── audit-log/
│   │   ├── package.json
│   │   └── index.js
│   ├── send-email/
│   │   ├── package.json
│   │   └── index.js
│   ├── ai-decision-engine/
│   │   ├── package.json
│   │   └── index.js
│   └── document-manager/
│       ├── package.json
│       └── index.js
```

### 4.2 Example: Audit Log Function

```javascript
// ibm-cloud/functions/audit-log/index.js

const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.IBM_DB_CONNECTION_STRING,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pool;
}

async function main(params) {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  // Handle preflight
  if (params.__ow_method === 'options') {
    return { statusCode: 200, headers, body: {} };
  }

  try {
    const { action, table_name, record_id, old_values, new_values } = params;
    const user_id = params.__ow_headers?.['x-user-id'];

    const db = getPool();
    
    const result = await db.query(
      `INSERT INTO crm.audit_logs 
       (user_id, action, table_name, record_id, old_values, new_values, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [user_id, action, table_name, record_id, old_values, new_values, params.__ow_headers?.['x-forwarded-for']]
    );

    return {
      statusCode: 200,
      headers,
      body: { success: true, audit_id: result.rows[0].id }
    };
  } catch (error) {
    console.error('Audit log error:', error);
    return {
      statusCode: 500,
      headers,
      body: { error: error.message }
    };
  }
}

exports.main = main;
```

### 4.3 Deploy Functions

```bash
# Set namespace
ibmcloud fn namespace target crm-functions

# Deploy functions
ibmcloud fn action create audit-log functions/audit-log/index.js \
  --kind nodejs:18 \
  --web true \
  --param IBM_DB_CONNECTION_STRING "$CONNECTION_STRING"

ibmcloud fn action create send-email functions/send-email/index.js \
  --kind nodejs:18 \
  --web true

ibmcloud fn action create ai-decision functions/ai-decision-engine/index.js \
  --kind nodejs:18 \
  --web true \
  --param WATSONX_API_KEY "$WATSONX_API_KEY"

# Get API endpoints
ibmcloud fn action get audit-log --url
```

---

## Phase 5: Storage Migration (Cloud Object Storage)

### 5.1 Storage Service Implementation

```typescript
// src/lib/ibm-storage.ts

import COS from 'ibm-cos-sdk';

interface StorageConfig {
  endpoint: string;
  apiKeyId: string;
  serviceInstanceId: string;
  bucketName: string;
}

class IBMStorageService {
  private cos: COS.S3;
  private bucketName: string;

  constructor(config: StorageConfig) {
    this.cos = new COS.S3({
      endpoint: config.endpoint,
      apiKeyId: config.apiKeyId,
      ibmAuthEndpoint: 'https://iam.cloud.ibm.com/identity/token',
      serviceInstanceId: config.serviceInstanceId,
    });
    this.bucketName = config.bucketName;
  }

  async uploadFile(
    filePath: string,
    file: Buffer | Blob,
    contentType: string
  ): Promise<string> {
    await this.cos.putObject({
      Bucket: this.bucketName,
      Key: filePath,
      Body: file,
      ContentType: contentType,
    }).promise();

    return this.getPublicUrl(filePath);
  }

  async downloadFile(filePath: string): Promise<Buffer> {
    const result = await this.cos.getObject({
      Bucket: this.bucketName,
      Key: filePath,
    }).promise();

    return result.Body as Buffer;
  }

  async deleteFile(filePath: string): Promise<void> {
    await this.cos.deleteObject({
      Bucket: this.bucketName,
      Key: filePath,
    }).promise();
  }

  async listFiles(prefix: string): Promise<string[]> {
    const result = await this.cos.listObjects({
      Bucket: this.bucketName,
      Prefix: prefix,
    }).promise();

    return result.Contents?.map(obj => obj.Key || '') || [];
  }

  getPublicUrl(filePath: string): string {
    return `https://${this.bucketName}.s3.us-south.cloud-object-storage.appdomain.cloud/${filePath}`;
  }

  async getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    return this.cos.getSignedUrl('getObject', {
      Bucket: this.bucketName,
      Key: filePath,
      Expires: expiresIn,
    });
  }
}

export const ibmStorage = new IBMStorageService({
  endpoint: process.env.IBM_COS_ENDPOINT || 's3.us-south.cloud-object-storage.appdomain.cloud',
  apiKeyId: process.env.IBM_COS_API_KEY || '',
  serviceInstanceId: process.env.IBM_COS_INSTANCE_ID || '',
  bucketName: process.env.IBM_COS_BUCKET || 'crm-documents',
});
```

---

## Phase 6: Real-time Updates (Event Streams)

### 6.1 Kafka Producer/Consumer Setup

```typescript
// src/lib/ibm-realtime.ts

import { Kafka, Producer, Consumer } from 'kafkajs';

interface RealtimeConfig {
  brokers: string[];
  username: string;
  password: string;
  clientId: string;
}

class IBMRealtimeService {
  private kafka: Kafka;
  private producer: Producer;
  private consumers: Map<string, Consumer> = new Map();

  constructor(config: RealtimeConfig) {
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      ssl: true,
      sasl: {
        mechanism: 'plain',
        username: config.username,
        password: config.password,
      },
    });
    this.producer = this.kafka.producer();
  }

  async connect(): Promise<void> {
    await this.producer.connect();
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
    for (const consumer of this.consumers.values()) {
      await consumer.disconnect();
    }
  }

  async publish(topic: string, event: any): Promise<void> {
    await this.producer.send({
      topic,
      messages: [
        {
          key: event.id,
          value: JSON.stringify(event),
          timestamp: Date.now().toString(),
        },
      ],
    });
  }

  async subscribe(
    topic: string,
    groupId: string,
    handler: (event: any) => void
  ): Promise<void> {
    const consumer = this.kafka.consumer({ groupId });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ message }) => {
        if (message.value) {
          const event = JSON.parse(message.value.toString());
          handler(event);
        }
      },
    });

    this.consumers.set(`${topic}-${groupId}`, consumer);
  }

  async unsubscribe(topic: string, groupId: string): Promise<void> {
    const consumer = this.consumers.get(`${topic}-${groupId}`);
    if (consumer) {
      await consumer.disconnect();
      this.consumers.delete(`${topic}-${groupId}`);
    }
  }
}

export const ibmRealtime = new IBMRealtimeService({
  brokers: (process.env.IBM_KAFKA_BROKERS || '').split(','),
  username: process.env.IBM_KAFKA_USERNAME || '',
  password: process.env.IBM_KAFKA_PASSWORD || '',
  clientId: 'crm-app',
});
```

### 6.2 React Hook for Realtime Updates

```typescript
// src/hooks/useIBMRealtime.ts

import { useEffect, useState, useCallback } from 'react';
import { ibmRealtime } from '@/lib/ibm-realtime';

interface RealtimeEvent<T> {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  data: T;
  timestamp: string;
}

export function useIBMRealtime<T>(
  topic: string,
  onEvent?: (event: RealtimeEvent<T>) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent<T> | null>(null);

  useEffect(() => {
    const groupId = `crm-client-${Math.random().toString(36).substring(7)}`;

    const connect = async () => {
      try {
        await ibmRealtime.connect();
        await ibmRealtime.subscribe(topic, groupId, (event: RealtimeEvent<T>) => {
          setLastEvent(event);
          onEvent?.(event);
        });
        setIsConnected(true);
      } catch (error) {
        console.error('Realtime connection error:', error);
      }
    };

    connect();

    return () => {
      ibmRealtime.unsubscribe(topic, groupId);
    };
  }, [topic, onEvent]);

  const publish = useCallback(
    async (event: RealtimeEvent<T>) => {
      await ibmRealtime.publish(topic, event);
    },
    [topic]
  );

  return { isConnected, lastEvent, publish };
}
```

---

## Phase 7: AI Migration (watsonx.ai)

### 7.1 watsonx.ai Service

```typescript
// src/lib/ibm-ai.ts

interface WatsonxConfig {
  apiKey: string;
  projectId: string;
  endpoint: string;
}

class IBMAIService {
  private config: WatsonxConfig;
  private accessToken: string | null = null;

  constructor(config: WatsonxConfig) {
    this.config = config;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken) return this.accessToken;

    const response = await fetch('https://iam.cloud.ibm.com/identity/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
        apikey: this.config.apiKey,
      }),
    });

    const data = await response.json();
    this.accessToken = data.access_token;
    return this.accessToken;
  }

  async generateText(prompt: string, options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<string> {
    const token = await this.getAccessToken();

    const response = await fetch(
      `${this.config.endpoint}/ml/v1/text/generation?version=2024-01-01`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model_id: options?.model || 'ibm/granite-13b-chat-v2',
          input: prompt,
          project_id: this.config.projectId,
          parameters: {
            max_new_tokens: options?.maxTokens || 1000,
            temperature: options?.temperature || 0.7,
          },
        }),
      }
    );

    const data = await response.json();
    return data.results[0].generated_text;
  }

  async analyzeLead(leadData: any): Promise<{
    score: number;
    factors: string[];
    recommendation: string;
  }> {
    const prompt = `Analyze this loan lead and provide a score (0-100), key factors, and recommendation:
    
    Lead Data:
    - Business: ${leadData.business_name}
    - Loan Amount: $${leadData.loan_amount}
    - Industry: ${leadData.industry}
    - Time in Business: ${leadData.time_in_business}
    - Annual Revenue: $${leadData.annual_revenue}
    
    Provide response in JSON format with score, factors array, and recommendation.`;

    const response = await this.generateText(prompt);
    return JSON.parse(response);
  }

  async generateConditions(loanApplication: any): Promise<{
    conditions: Array<{ category: string; description: string; priority: string }>;
    summary: string;
    riskLevel: string;
  }> {
    const prompt = `Generate underwriting conditions for this loan application:
    
    ${JSON.stringify(loanApplication, null, 2)}
    
    Provide response in JSON with conditions array, summary, and riskLevel.`;

    const response = await this.generateText(prompt);
    return JSON.parse(response);
  }
}

export const ibmAI = new IBMAIService({
  apiKey: process.env.IBM_WATSONX_API_KEY || '',
  projectId: process.env.IBM_WATSONX_PROJECT_ID || '',
  endpoint: 'https://us-south.ml.cloud.ibm.com',
});
```

---

## Phase 8: Update Cloud Configuration

### 8.1 Updated cloud-config.ts

```typescript
// src/lib/cloud-config.ts

export interface CloudConfig {
  provider: 'supabase' | 'oracle' | 'aws' | 'azure' | 'ibm';
  database: {
    url: string;
    key: string;
    ssl?: boolean;
  };
  storage: {
    bucket: string;
    region: string;
    endpoint?: string;
  };
  functions: {
    baseUrl: string;
    region: string;
  };
  security: {
    encryptionKey: string;
    vaultService?: string;
  };
  auth?: {
    clientId: string;
    discoveryEndpoint: string;
  };
  ai?: {
    apiKey: string;
    projectId: string;
    endpoint: string;
  };
  realtime?: {
    brokers: string[];
    username: string;
    password: string;
  };
}

// IBM Cloud configuration
export const ibmCloudConfig: CloudConfig = {
  provider: 'ibm',
  database: {
    url: process.env.IBM_DB_CONNECTION_STRING || '',
    key: process.env.IBM_DB_API_KEY || '',
    ssl: true
  },
  storage: {
    bucket: process.env.IBM_COS_BUCKET || 'crm-documents',
    region: process.env.IBM_REGION || 'us-south',
    endpoint: process.env.IBM_COS_ENDPOINT || 's3.us-south.cloud-object-storage.appdomain.cloud'
  },
  functions: {
    baseUrl: process.env.IBM_FUNCTIONS_URL || 'https://us-south.functions.cloud.ibm.com/api/v1/web',
    region: process.env.IBM_REGION || 'us-south'
  },
  security: {
    encryptionKey: process.env.IBM_KEY_PROTECT_KEY || '',
    vaultService: process.env.IBM_KEY_PROTECT_INSTANCE
  },
  auth: {
    clientId: process.env.IBM_APPID_CLIENT_ID || '',
    discoveryEndpoint: process.env.IBM_APPID_DISCOVERY_ENDPOINT || ''
  },
  ai: {
    apiKey: process.env.IBM_WATSONX_API_KEY || '',
    projectId: process.env.IBM_WATSONX_PROJECT_ID || '',
    endpoint: 'https://us-south.ml.cloud.ibm.com'
  },
  realtime: {
    brokers: (process.env.IBM_KAFKA_BROKERS || '').split(','),
    username: process.env.IBM_KAFKA_USERNAME || '',
    password: process.env.IBM_KAFKA_PASSWORD || ''
  }
};

export function getCloudConfig(): CloudConfig {
  const provider = process.env.CLOUD_PROVIDER || 'supabase';
  
  switch (provider) {
    case 'ibm':
      return ibmCloudConfig;
    case 'oracle':
      return oracleCloudConfig;
    case 'supabase':
    default:
      return supabaseConfig;
  }
}
```

---

## Phase 9: Environment Variables

### 9.1 Create .env.ibm

```bash
# IBM Cloud Environment Variables

CLOUD_PROVIDER=ibm

# Database (PostgreSQL)
IBM_DB_CONNECTION_STRING=postgres://user:password@hostname:port/database?sslmode=verify-full
IBM_DB_API_KEY=your-api-key

# App ID (Authentication)
IBM_APPID_CLIENT_ID=your-client-id
IBM_APPID_TENANT_ID=your-tenant-id
IBM_APPID_DISCOVERY_ENDPOINT=https://us-south.appid.cloud.ibm.com/oauth/v4/tenant-id

# Cloud Object Storage
IBM_COS_ENDPOINT=s3.us-south.cloud-object-storage.appdomain.cloud
IBM_COS_API_KEY=your-cos-api-key
IBM_COS_INSTANCE_ID=crn:v1:bluemix:public:cloud-object-storage:global:...
IBM_COS_BUCKET=crm-documents

# Cloud Functions
IBM_FUNCTIONS_URL=https://us-south.functions.cloud.ibm.com/api/v1/web/namespace
IBM_FUNCTIONS_NAMESPACE=crm-functions
IBM_FUNCTIONS_API_KEY=your-functions-api-key

# Event Streams (Kafka)
IBM_KAFKA_BROKERS=broker1:9093,broker2:9093
IBM_KAFKA_USERNAME=token
IBM_KAFKA_PASSWORD=your-kafka-password

# watsonx.ai
IBM_WATSONX_API_KEY=your-watsonx-api-key
IBM_WATSONX_PROJECT_ID=your-project-id

# Key Protect (Encryption)
IBM_KEY_PROTECT_INSTANCE=your-key-protect-instance
IBM_KEY_PROTECT_KEY=your-encryption-key-id

# General
IBM_REGION=us-south
```

---

## Phase 10: Kubernetes Deployment

### 10.1 Create Kubernetes Cluster

```bash
# Create IKS cluster
ibmcloud ks cluster create vpc-gen2 \
  --name crm-cluster \
  --zone us-south-1 \
  --vpc-id <vpc-id> \
  --subnet-id <subnet-id> \
  --flavor bx2.4x16 \
  --workers 3

# Get kubeconfig
ibmcloud ks cluster config --cluster crm-cluster
```

### 10.2 Deployment YAML

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crm-app
  labels:
    app: crm
spec:
  replicas: 3
  selector:
    matchLabels:
      app: crm
  template:
    metadata:
      labels:
        app: crm
    spec:
      containers:
      - name: crm-app
        image: us.icr.io/crm-namespace/crm-app:latest
        ports:
        - containerPort: 3000
        envFrom:
        - secretRef:
            name: crm-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: crm-service
spec:
  selector:
    app: crm
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: crm-ingress
  annotations:
    kubernetes.io/ingress.class: "public-iks-k8s-nginx"
spec:
  tls:
  - hosts:
    - crm.yourdomain.com
    secretName: crm-tls
  rules:
  - host: crm.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: crm-service
            port:
              number: 80
```

### 10.3 Create Secrets

```bash
# Create Kubernetes secrets
kubectl create secret generic crm-secrets \
  --from-env-file=.env.ibm
```

### 10.4 Build and Deploy

```bash
# Build Docker image
docker build -t crm-app .

# Tag for IBM Container Registry
docker tag crm-app us.icr.io/crm-namespace/crm-app:latest

# Push to registry
docker push us.icr.io/crm-namespace/crm-app:latest

# Deploy to Kubernetes
kubectl apply -f k8s/
```

---

## Phase 11: Monitoring and Logging

### 11.1 IBM Log Analysis

```bash
# Create Log Analysis instance
ibmcloud resource service-instance-create crm-logging \
  logdna standard us-south

# Configure logging for cluster
ibmcloud ks logging config create --cluster crm-cluster \
  --logsource container \
  --type logdna
```

### 11.2 IBM Monitoring

```bash
# Create Monitoring instance
ibmcloud resource service-instance-create crm-monitoring \
  sysdig-monitor graduated-tier us-south

# Configure monitoring for cluster
ibmcloud ks logging config create --cluster crm-cluster \
  --logsource container \
  --type sysdig
```

---

## Quick Reference: Feature Compatibility

| Feature | Works on IBM Cloud | Migration Effort |
|---------|-------------------|------------------|
| Lead Management | ✅ Yes | Medium |
| Document Upload | ✅ Yes | Medium |
| User Authentication | ✅ Yes | High |
| Real-time Updates | ✅ Yes | High |
| AI Lead Scoring | ✅ Yes | Medium |
| Audit Logging | ✅ Yes | Low |
| Role-based Access | ✅ Yes | Medium |
| Email Notifications | ✅ Yes | Low |
| Pipeline Dashboard | ✅ Yes | Low |
| Analytics | ✅ Yes | Low |

---

## Estimated Migration Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Infrastructure Setup | 1-2 days | IBM Cloud account |
| Database Migration | 2-3 days | Infrastructure |
| Auth Migration | 3-4 days | Infrastructure |
| Functions Migration | 3-5 days | Database |
| Storage Migration | 1-2 days | Infrastructure |
| Realtime Migration | 2-3 days | Infrastructure |
| AI Migration | 2-3 days | Infrastructure |
| Testing | 3-5 days | All phases |
| **Total** | **17-27 days** | |

---

## Support Resources

- [IBM Cloud Docs](https://cloud.ibm.com/docs)
- [IBM Cloud Functions](https://cloud.ibm.com/docs/openwhisk)
- [IBM Cloud Databases for PostgreSQL](https://cloud.ibm.com/docs/databases-for-postgresql)
- [IBM App ID](https://cloud.ibm.com/docs/appid)
- [IBM watsonx.ai](https://www.ibm.com/products/watsonx-ai)
- [IBM Kubernetes Service](https://cloud.ibm.com/docs/containers)
