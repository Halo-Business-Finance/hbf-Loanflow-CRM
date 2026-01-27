# Security Testing Guide

## Overview
Comprehensive security testing procedures for the World Government and Military Grade Security CRM.

## 1. Input Validation Testing

### Test Scenarios

#### SQL Injection Tests
```bash
# Test admin-create-user with malicious input
curl -X POST 'https://gshxxsniwytjgcnthyfq.supabase.co/functions/v1/admin-create-user' \
  -H 'Authorization: Bearer YOUR_JWT' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "test@test.com",
    "password": "ValidPass123!",
    "firstName": "Robert'; DROP TABLE users;--",
    "lastName": "Test"
  }'

# Expected: 400 error with "First name contains invalid characters"
```

#### XSS Tests
```bash
# Test with XSS payload
curl -X POST 'https://gshxxsniwytjgcnthyfq.supabase.co/functions/v1/admin-update-user' \
  -H 'Authorization: Bearer YOUR_JWT' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "valid-uuid-here",
    "firstName": "<script>alert(\"XSS\")</script>",
    "city": "<img src=x onerror=alert(1)>"
  }'

# Expected: 400 error with "First name contains invalid characters"
```

#### Path Traversal Tests
```bash
# Test document upload with malicious filename
# This should be blocked by the MIME validation
```

### Validation Checklist
- ✅ Email format validation
- ✅ Phone number sanitization
- ✅ Text field length limits
- ✅ SQL injection prevention
- ✅ XSS payload blocking
- ✅ UUID format validation
- ✅ Password strength requirements

## 2. Rate Limiting Tests

### Test Scenarios

#### Admin Operations Rate Limits
```bash
# Test admin-create-user rate limit (10/hour)
for i in {1..15}; do
  curl -X POST 'https://gshxxsniwytjgcnthyfq.supabase.co/functions/v1/admin-create-user' \
    -H 'Authorization: Bearer YOUR_JWT' \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"test$i@test.com\",\"password\":\"ValidPass123!\"}"
  echo "Request $i completed"
done

# Expected: First 10 succeed, 11-15 return 429 with "Rate limit exceeded"
```

#### Brute Force Protection
```bash
# Test login rate limiting (should be in place via Supabase Auth)
for i in {1..20}; do
  curl -X POST 'https://gshxxsniwytjgcnthyfq.supabase.co/auth/v1/token' \
    -d "email=test@test.com&password=wrongpass$i"
done

# Expected: After 5-10 attempts, should be rate limited
```

### Rate Limit Checklist
- ✅ admin-create-user: 10/hour
- ✅ admin-update-user: 20/hour  
- ✅ admin-delete-user: 5/hour
- ✅ admin-reset-password: 10/hour
- ✅ audit-log: 100/hour
- ✅ blockchain-hash: 50/hour
- ⚠️ admin-get-users: Needs implementation
- ⚠️ Other Edge Functions: Needs audit

## 3. Authentication & Authorization Tests

### Test Scenarios

#### JWT Validation
```bash
# Test with invalid JWT
curl -X POST 'https://gshxxsniwytjgcnthyfq.supabase.co/functions/v1/admin-create-user' \
  -H 'Authorization: Bearer invalid.jwt.token' \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"ValidPass123!"}'

# Expected: 401 Unauthorized
```

#### Role-Based Access Control
```bash
# Test admin function with non-admin user
# 1. Login as non-admin user to get JWT
# 2. Attempt admin operation
curl -X POST 'https://gshxxsniwytjgcnthyfq.supabase.co/functions/v1/admin-delete-user' \
  -H 'Authorization: Bearer NON_ADMIN_JWT' \
  -H 'Content-Type: application/json' \
  -d '{"userId":"some-uuid"}'

# Expected: 403 Forbidden with "Insufficient privileges"
```

#### MFA Verification
```bash
# Test critical operation without MFA token
curl -X POST 'https://gshxxsniwytjgcnthyfq.supabase.co/functions/v1/admin-delete-user' \
  -H 'Authorization: Bearer ADMIN_JWT' \
  -H 'Content-Type: application/json' \
  -d '{"userId":"user-to-delete"}'

# Expected: Should complete (MFA optional) but log warning

# Test with invalid MFA token
curl -X POST 'https://gshxxsniwytjgcnthyfq.supabase.co/functions/v1/admin-delete-user' \
  -H 'Authorization: Bearer ADMIN_JWT' \
  -H 'Content-Type: application/json' \
  -d '{"userId":"user-to-delete","mfa_token":"123456"}'

# Expected: 403 with "MFA verification failed"
```

### Auth Checklist
- ✅ JWT required for all endpoints
- ✅ Role verification for admin functions
- ✅ MFA enforcement for critical ops (optional)
- ✅ Unauthorized attempt logging
- ✅ Session validation
- ✅ Token expiration handling

## 4. Encryption & Data Protection Tests

### Server-Side Encryption
```typescript
// Test encryption roundtrip
import { encryptData, decryptData } from '@/lib/server-encryption';

const testData = { ssn: '123-45-6789', creditScore: 750 };
const encrypted = await encryptData(testData, 'test-context');
const decrypted = await decryptData(encrypted.encrypted!, 'test-context');

// Expected: decrypted matches testData
```

### Storage Security
- ✅ No keys in localStorage/sessionStorage
- ✅ Keys managed server-side only
- ✅ Encrypted data in secure_session_data table
- ✅ TTL/expiration enforced
- ✅ User isolation (RLS policies)

## 5. RLS Policy Testing

### Test Scenarios

#### User Data Isolation
```sql
-- Test as User A
SELECT * FROM leads WHERE user_id != auth.uid();
-- Expected: Empty result (no access to other users' leads)

-- Test as User B
UPDATE leads SET amount = 999999 WHERE user_id != auth.uid();
-- Expected: 0 rows updated (no access to modify others' data)
```

#### Admin Bypass
```sql
-- Test admin can view all data
SELECT * FROM leads;
-- Expected: Returns all leads if user has admin role
```

### RLS Checklist
- ✅ leads table: Users see only their own
- ✅ profiles table: Users see own, admins see all
- ✅ contact_entities table: Proper user isolation
- ✅ workflows table: Admin manage, users view own
- ✅ All sensitive tables have RLS enabled
- ⚠️ SECURITY DEFINER functions audited

## 6. Error Handling & Information Leakage Tests

### Test Scenarios

#### Internal Error Exposure
```bash
# Trigger database error
curl -X POST 'https://gshxxsniwytjgcnthyfq.supabase.co/functions/v1/admin-create-user' \
  -H 'Authorization: Bearer ADMIN_JWT' \
  -H 'Content-Type: application/json' \
  -d '{"email":"duplicate@test.com","password":"ValidPass123!"}'

# Expected: Generic error like "Operation failed" 
# NOT: "duplicate key value violates unique constraint users_email_key"
```

#### Stack Trace Leakage
- ✅ No stack traces in client responses
- ✅ Detailed errors logged server-side only
- ✅ Generic user-facing messages
- ✅ Error codes without details

## 7. Security Monitoring Tests

### Real-Time Threat Detection
```typescript
// Verify security events are logged
const { data } = await supabase
  .from('security_events')
  .select('*')
  .order('created_at', { descending: true })
  .limit(10);

// Expected: Recent security events with proper severity
```

### Audit Trail
```sql
-- Verify comprehensive audit logging
SELECT * FROM audit_logs 
WHERE action = 'admin_password_reset'
ORDER BY created_at DESC
LIMIT 10;

-- Expected: All admin operations logged with user_id, IP, timestamp
```

## 8. Automated Security Scanning

### Dependency Vulnerabilities
```bash
# Run npm audit
npm audit

# Expected: No high or critical vulnerabilities
# If found, update dependencies immediately
```

### Code Security Scan
```bash
# Install and run ESLint security plugin
npm install --save-dev eslint-plugin-security
npx eslint --ext .ts,.tsx src/ --plugin security

# Expected: No security warnings
```

## 9. Penetration Testing Checklist

### Manual Tests
- [ ] Test all Edge Functions with invalid input
- [ ] Attempt privilege escalation
- [ ] Test CORS configuration
- [ ] Verify Content Security Policy
- [ ] Test session hijacking scenarios
- [ ] Attempt data exfiltration
- [ ] Test for timing attacks
- [ ] Verify secure headers present

### Automated Tests
- [ ] OWASP ZAP scan
- [ ] Burp Suite automated scan
- [ ] SQL injection automated tests
- [ ] XSS automated tests

## 10. Compliance Verification

### NIST 800-63B
- ✅ Password minimum 12 characters
- ✅ Password complexity requirements
- ✅ MFA available for critical operations
- ✅ Rate limiting on authentication

### SOC 2
- ✅ Audit logging comprehensive
- ✅ Access controls enforced
- ✅ Encryption at rest and in transit
- ✅ Security monitoring active

### GDPR/Privacy
- ✅ Data minimization
- ✅ User data isolation
- ✅ Right to deletion (admin functions)
- ✅ Consent logging (implicit via usage)

## Emergency Procedures

### If Vulnerability Discovered
1. **Assess severity** (Critical/High/Medium/Low)
2. **Isolate** affected systems if critical
3. **Notify** admin team immediately
4. **Patch** vulnerability ASAP
5. **Verify** fix with security tests
6. **Document** in security incident log
7. **Review** similar code for same issue

### Security Incident Response
1. **Detect**: Monitor security_events table
2. **Contain**: Use emergency lockdown if needed
3. **Eradicate**: Remove threat, patch vulnerability
4. **Recover**: Restore normal operations
5. **Lessons Learned**: Update security measures

## Continuous Monitoring

### Daily
- Check security_events for critical alerts
- Review failed authentication attempts
- Monitor rate limit triggers

### Weekly
- Review audit logs for anomalies
- Check dependency vulnerabilities
- Verify backup integrity

### Monthly
- Full penetration test
- RLS policy audit
- Security training for team
- Update security documentation

## Tools & Resources

- **Supabase Dashboard**: Monitor logs and events
- **Lovable Security View**: Real-time security findings
- **npm audit**: Dependency vulnerability scanning
- **ESLint Security Plugin**: Static code analysis
- **OWASP ZAP**: Automated penetration testing
- **Burp Suite**: Manual security testing

## Contact

For security concerns or vulnerability reports:
- **Internal**: Security team via secure channel
- **External**: security@yourdomain.com (create dedicated email)
