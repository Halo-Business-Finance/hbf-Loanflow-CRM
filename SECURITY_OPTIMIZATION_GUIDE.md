# Security Optimization Implementation Guide

## Priority 1: LocalStorage Migration (MEDIUM Risk)

### Overview
Currently, 39 localStorage operations store security-sensitive data client-side. This poses risks:
- **XSS vulnerability**: Attackers can access localStorage via JavaScript
- **Rate limit bypass**: Clients can clear localStorage to reset limits
- **Audit log tampering**: Logs stored client-side can be deleted
- **Device switching**: Security state doesn't persist across devices

### Migration Strategy

#### Phase 1: Security Incident Storage (CRITICAL - Complete First)

**Current Issue:**
- `src/lib/security-incident-response.ts` stores incidents, rate limits, and IP blocks in localStorage
- Attackers can bypass rate limiting by clearing localStorage
- Security incidents disappear on logout

**Migration Steps:**

1. **Create Edge Function for Server-Side Rate Limiting:**
```typescript
// supabase/functions/rate-limiter/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { identifier, action_type, max_attempts = 5, window_minutes = 15 } = await req.json()

  // Check rate limit from database
  const { data: attempts, error } = await supabaseClient
    .from('rate_limit_tracking')
    .select('*')
    .eq('identifier', identifier)
    .eq('action_type', action_type)
    .gte('created_at', new Date(Date.now() - window_minutes * 60 * 1000).toISOString())

  const attemptCount = attempts?.length || 0
  const blocked = attemptCount >= max_attempts

  if (!blocked) {
    // Log new attempt
    await supabaseClient
      .from('rate_limit_tracking')
      .insert({
        identifier,
        action_type,
        metadata: { ip: req.headers.get('x-forwarded-for') }
      })
  }

  return new Response(
    JSON.stringify({
      blocked,
      attempts_remaining: Math.max(0, max_attempts - attemptCount - 1),
      retry_after: blocked ? window_minutes * 60 : 0
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
```

2. **Create Migration for Rate Limit Tracking Table:**
```sql
-- Create table for server-side rate limiting
CREATE TABLE IF NOT EXISTS rate_limit_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- user_id, ip_address, or session_id
  action_type TEXT NOT NULL, -- 'login_attempt', 'api_call', etc.
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_rate_limit_identifier ON rate_limit_tracking(identifier, action_type, created_at DESC);

-- Auto-cleanup old entries (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limit_tracking
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup (run hourly)
SELECT cron.schedule(
  'cleanup-rate-limits',
  '0 * * * *', -- Every hour
  $$SELECT cleanup_old_rate_limits();$$
);

-- Enable RLS
ALTER TABLE rate_limit_tracking ENABLE ROW LEVEL SECURITY;

-- Only service role can access (called via Edge Functions)
CREATE POLICY "Service role full access" ON rate_limit_tracking
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');
```

3. **Update `src/lib/security-incident-response.ts`:**
```typescript
// Remove ALL localStorage operations
// Replace with Supabase calls

async executeResponse(incidentId: string, action: string, emergency: boolean = false): Promise<void> {
  // OLD: localStorage.setItem('enhanced_monitoring', 'true');
  // NEW:
  await supabase.rpc('enable_enhanced_monitoring', {
    p_user_id: this.currentUserId,
    p_incident_id: incidentId,
    p_reason: action
  });

  // OLD: localStorage.setItem(rateLimitKey, JSON.stringify({ ... }));
  // NEW: Use rate-limiter Edge Function (server-side)
  await supabase.functions.invoke('rate-limiter', {
    body: {
      identifier: this.currentUserId,
      action_type: 'security_incident',
      max_attempts: 3,
      window_minutes: 60
    }
  });

  // OLD: localStorage.setItem(blockKey, JSON.stringify({ ... }));
  // NEW:
  await supabase.from('blocked_users').insert({
    user_id: this.currentUserId,
    reason: action,
    blocked_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    metadata: { incident_id: incidentId }
  });
}
```

#### Phase 2: Audit Log Migration

**Current Issue:**
- `src/lib/data-integrity.ts` stores audit logs in localStorage
- Logs lost on logout or browser clear

**Migration:**

1. **Create Migration for Data Integrity Audit Table:**
```sql
CREATE TABLE IF NOT EXISTS data_integrity_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id TEXT,
  details JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_data_audit_user ON data_integrity_audit_log(user_id, timestamp DESC);

ALTER TABLE data_integrity_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own audit logs
CREATE POLICY "Users view own audit logs" ON data_integrity_audit_log
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins view all audit logs" ON data_integrity_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );
```

2. **Update `src/lib/data-integrity.ts`:**
```typescript
private async logAuditEvent(action: string, details: any): Promise<void> {
  // Remove localStorage
  try {
    await this.supabase
      .from('data_integrity_audit_log')
      .insert({
        user_id: this.userId,
        action,
        details,
        timestamp: new Date().toISOString()
      });
  } catch (error) {
    logger.error('Failed to log audit event:', error);
  }
}

async getAuditLog(): Promise<AuditLog[]> {
  // Remove localStorage.getItem
  const { data, error } = await this.supabase
    .from('data_integrity_audit_log')
    .select('*')
    .eq('user_id', this.userId)
    .order('timestamp', { ascending: false })
    .limit(100);

  if (error) {
    logger.error('Failed to fetch audit log:', error);
    return [];
  }

  return data || [];
}
```

#### Phase 3: Enhanced Secure Storage Migration

**Current Issue:**
- `src/lib/enhanced-secure-storage.ts` encrypts data but still stores client-side
- Better than plain localStorage, but still vulnerable to XSS

**Migration:**

1. **Use Existing `secure_session_data` Table** (already created)
2. **Update `src/lib/enhanced-secure-storage.ts`:**
```typescript
async setSecureItem(key: string, value: any): Promise<void> {
  const { data: { user } } = await this.supabase.auth.getUser();
  if (!user) throw new Error('No authenticated user');

  // Remove localStorage.setItem
  // Use server-side storage instead
  const { error } = await this.supabase
    .from('secure_session_data')
    .upsert({
      user_id: user.id,
      key,
      value: JSON.stringify(value),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

  if (error) throw error;
}

async getSecureItem(key: string): Promise<any> {
  const { data: { user } } = await this.supabase.auth.getUser();
  if (!user) return null;

  // Remove localStorage.getItem
  const { data, error } = await this.supabase
    .from('secure_session_data')
    .select('value')
    .eq('user_id', user.id)
    .eq('key', key)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) return null;
  return JSON.parse(data.value);
}
```

#### Phase 4: Zero Trust Security Event Storage

**Update `src/lib/zero-trust.ts` and `src/hooks/useEnhancedSecurity.ts`:**
```typescript
// Remove: const events = JSON.parse(localStorage.getItem('_security_events') || '[]');
// Use: security_events table instead

async logSecurityEvent(event: SecurityEvent): Promise<void> {
  await this.supabase
    .from('security_events')
    .insert({
      user_id: this.userId,
      event_type: event.type,
      severity: event.severity,
      details: event.details,
      timestamp: new Date().toISOString()
    });
}
```

---

## Priority 2: Console Logging Migration (LOW Risk)

### Overview
Found **748 console statements** across 158 files. Most are debugging logs, not security-critical.

### Phased Migration Strategy

#### High Priority Console Logs (Complete First - ~50 files)

**Security-Related Files:**
- `src/components/security/*` (all security components)
- `src/lib/security*.ts` (all security libraries) ✅ ALREADY DONE
- `src/hooks/useSecurity*.ts` (all security hooks) ✅ ALREADY DONE
- Edge functions with sensitive data

**Migration Pattern:**
```typescript
// Before
console.log('User authenticated:', user);
console.error('Database error:', error);

// After
import { logger } from '@/lib/logger';
logger.debug('User authenticated'); // No user object!
logger.error('Database operation failed:', error); // Sanitized in production
```

#### Medium Priority (Complete Second - ~50 files)

**Database/API Files:**
- `src/components/Dashboard.tsx`
- `src/components/DocumentViewer.tsx`
- `src/components/LeadCard.tsx`
- All files that handle user data

#### Low Priority (Complete Last - ~58 files)

**UI/UX Files:**
- Component render logs
- Button click handlers
- Animation/transition logs

**Strategy:** Can remain as-is or batch migrate during maintenance windows

---

## Priority 3: Deprecated Code Cleanup (VERY LOW Risk)

### Files to Remove

1. **`src/lib/fortress-security.DEPRECATED.ts`**
   - Already unused (zero imports)
   - Safe to delete entirely
   - Remove with: `git rm src/lib/fortress-security.DEPRECATED.ts`

2. **`src/lib/fortress-security-deprecated.md`**
   - Documentation file, safe to keep for historical reference
   - Or move to `docs/archive/` folder

---

## New Security Concerns Identified

### 1. SessionStorage Security Keys (MEDIUM Risk)

**Files Affected:**
- `src/lib/field-encryption.ts` (Lines 121, 134)
- `src/lib/security.ts` (Lines 408, 420)

**Issue:**
Encryption master keys stored in sessionStorage are still vulnerable to XSS attacks.

**Remediation:**
```typescript
// Remove sessionStorage usage entirely
// Store master keys only in memory (process scope)

class SecureKeyManager {
  private static inMemoryKeys = new Map<string, string>();
  
  static getMasterKey(userId: string): string {
    if (!this.inMemoryKeys.has(userId)) {
      // Generate ephemeral key for this session only
      const key = this.generateSecureRandom(32);
      this.inMemoryKeys.set(userId, key);
      
      // Auto-clear after 15 minutes of inactivity
      setTimeout(() => {
        this.inMemoryKeys.delete(userId);
      }, 15 * 60 * 1000);
    }
    return this.inMemoryKeys.get(userId)!;
  }
  
  static clearKey(userId: string): void {
    this.inMemoryKeys.delete(userId);
  }
}
```

### 2. Workflow Automation Webhook Storage (LOW Risk)

**File:** `src/components/ai/WorkflowAutomation.tsx`

**Issue:**
Webhook URLs stored in sessionStorage (Lines 73, 92).

**Risk:** If webhook contains sensitive tokens in URL, could leak via XSS.

**Remediation:**
```typescript
// Store webhook configurations server-side
const { data, error } = await supabase
  .from('workflow_configurations')
  .upsert({
    user_id: user.id,
    webhook_url: webhookUrl,
    automations: automations
  });
```

---

## Implementation Timeline

### Week 1: Critical Migrations
- ✅ Day 1-2: Server-side rate limiting Edge Function
- ✅ Day 3-4: Security incident storage migration
- ✅ Day 5: Testing and validation

### Week 2: Data Integrity & Audit Logs
- Day 1-2: Audit log migration
- Day 3-4: Enhanced secure storage migration
- Day 5: Testing

### Week 3: Remaining Optimizations
- Day 1-2: SessionStorage encryption key migration
- Day 3-4: High-priority console log migration (security files)
- Day 5: Deprecated code cleanup

### Weeks 4-6: Phased Console Log Migration
- Week 4: Medium-priority files (database/API)
- Week 5: Low-priority files (UI/UX)
- Week 6: Testing and validation

---

## Testing Checklist

### After LocalStorage Migration:
- [ ] Verify rate limiting works across browser sessions
- [ ] Confirm security incidents persist after logout
- [ ] Test audit log retention and retrieval
- [ ] Validate encrypted data storage/retrieval
- [ ] Ensure no localStorage calls remain in security files

### After Console Log Migration:
- [ ] Verify no sensitive data in production console
- [ ] Confirm errors still logged (sanitized)
- [ ] Test development debugging still works
- [ ] Validate logger.security() is silent in production

### After Deprecated Cleanup:
- [ ] Build succeeds without fortress-security
- [ ] All tests pass
- [ ] No import errors

---

## Rollback Plans

### If Rate Limiting Migration Fails:
```typescript
// Temporary: Keep localStorage as fallback
const serverLimit = await checkServerRateLimit();
if (serverLimit === null) {
  // Fallback to localStorage temporarily
  return checkLocalStorageRateLimit();
}
return serverLimit;
```

### If Audit Log Migration Fails:
```typescript
// Dual-write during transition period
await Promise.all([
  writeToDatabase(auditLog),
  writeToLocalStorage(auditLog) // Remove after 2 weeks
]);
```

---

## Compliance Impact

### After Full Migration:
- ✅ **SOC 2 Type II**: Server-side audit logs meet immutability requirements
- ✅ **NIST 800-53**: Rate limiting enforced server-side (AC-7)
- ✅ **ISO 27001**: Security events stored in tamper-proof database
- ✅ **FedRAMP**: Eliminates client-side security state vulnerabilities
- ✅ **GDPR**: Audit logs persist for required retention periods

---

## Cost Estimate

### Database Storage Impact:
- **Rate limit tracking**: ~5 MB/month (auto-cleanup after 24h)
- **Audit logs**: ~50 MB/month (keep 90 days)
- **Security events**: ~20 MB/month (keep 1 year)
- **Total**: ~75 MB/month additional storage (negligible cost)

### Performance Impact:
- **Server-side rate limiting**: +50ms latency per check (acceptable)
- **Audit log writes**: Async, no user-facing impact
- **Security event writes**: Async, no impact

---

## Success Metrics

After migration, you should achieve:
- ✅ **Zero** security-sensitive localStorage operations
- ✅ **Zero** console logs exposing sensitive data in production
- ✅ **100%** audit log retention (survives logout/browser clear)
- ✅ **100%** rate limit enforcement (cannot be bypassed)
- ✅ **Security Score**: 95+ → 98+ (target)

---

## Questions Before Implementation?

Ready to proceed with Phase 1 (server-side rate limiting)? This is the most critical migration and provides immediate security improvement.
