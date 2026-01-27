# Security Incident Response Playbook

## 🚨 Quick Reference

| Severity | Response Time | Escalation |
|----------|--------------|------------|
| **Critical** | Immediate (<15 min) | CEO + CTO + Security Team |
| **High** | <1 hour | CTO + Security Team |
| **Medium** | <4 hours | Security Team |
| **Low** | <24 hours | Security Team |

## Phase 1: Detection & Assessment (0-15 minutes)

### Incident Indicators
- Multiple failed authentication attempts from single IP
- Unusual database query patterns
- Spike in security_events table
- Abnormal data exfiltration patterns
- MFA verification failures
- Rate limit triggers from admin accounts
- Emergency shutdown triggered
- Dark web threat detection alerts

### Initial Assessment Questions
1. **What happened?** (SQL injection, data breach, DDoS, etc.)
2. **When did it start?** (Check security_events timestamps)
3. **What systems are affected?** (Database, Auth, Edge Functions)
4. **Is it ongoing?** (Check real-time monitoring)
5. **What data is at risk?** (PII, financial, business data)

### Severity Classification

#### CRITICAL (P0)
- Active data breach in progress
- Database compromise
- Authentication system bypass
- Admin account compromise
- Ransomware/destructive attack

#### HIGH (P1)
- Attempted unauthorized admin access
- Multiple coordinated attacks
- Vulnerability actively being exploited
- Sensitive data exposure

#### MEDIUM (P2)
- Failed attack attempts (successfully blocked)
- Suspicious patterns detected
- Non-critical vulnerability discovered

#### LOW (P3)
- Single failed authentication attempt
- Minor configuration issue
- False positive from monitoring

## Phase 2: Containment (15-60 minutes)

### Immediate Actions by Severity

#### CRITICAL Incidents
```typescript
// 1. EMERGENCY LOCKDOWN (if needed)
// Trigger via Supabase dashboard or:
await supabase.rpc('emergency_lockdown', { 
  reason: 'Active security breach detected' 
});

// 2. Disable compromised accounts
await supabase.auth.admin.updateUserById(compromisedUserId, {
  banned: true,
  ban_duration: 'indefinite'
});

// 3. Revoke all sessions for user
await supabase.rpc('revoke_user_sessions', { 
  user_id: compromisedUserId 
});

// 4. Block attacker IP (if identified)
await supabase.from('blocked_ips').insert({
  ip_address: attackerIP,
  reason: 'Security incident',
  blocked_at: new Date().toISOString(),
  blocked_until: null // Permanent
});
```

#### HIGH Incidents
```typescript
// 1. Increase security monitoring
await supabase.rpc('enable_enhanced_monitoring', {
  duration_minutes: 120
});

// 2. Force MFA for all admin operations
await supabase.rpc('require_mfa_globally', {
  required: true
});

// 3. Log incident
await supabase.from('security_incidents').insert({
  incident_type: 'unauthorized_access_attempt',
  severity: 'high',
  details: { /* incident details */ },
  response_status: 'contained'
});
```

### Containment Checklist
- [ ] Stop active attack (block IP, disable account)
- [ ] Preserve evidence (database snapshots, logs)
- [ ] Notify security team
- [ ] Document timeline
- [ ] Assess scope of compromise

## Phase 3: Eradication (1-4 hours)

### Root Cause Analysis
1. **Review security_events table**
   ```sql
   SELECT * FROM security_events
   WHERE created_at > NOW() - INTERVAL '24 hours'
   AND severity IN ('high', 'critical')
   ORDER BY created_at DESC;
   ```

2. **Check audit_logs for unauthorized changes**
   ```sql
   SELECT * FROM audit_logs
   WHERE user_id = '{{compromised_user_id}}'
   AND created_at > NOW() - INTERVAL '24 hours'
   ORDER BY created_at DESC;
   ```

3. **Review Edge Function logs**
   - Check Supabase Dashboard → Edge Functions → Logs
   - Look for unusual patterns, errors, or payloads

4. **Analyze attack vectors**
   - SQL injection attempts in logs?
   - XSS payloads detected?
   - Brute force patterns?
   - Privilege escalation attempts?

### Remediation Actions

#### Patch Vulnerability
```bash
# 1. Deploy fix to Edge Function
# Update validation in _shared/validation.ts
# Deploy automatically via Lovable

# 2. Update RLS policies if needed
# Run migration via supabase--migration tool

# 3. Update client-side validation
# Update React components with enhanced checks
```

#### Close Security Gaps
- **Input Validation**: Add missing validators
- **Rate Limiting**: Tighten limits if needed
- **RLS Policies**: Strengthen where compromised
- **Error Messages**: Ensure no info leakage
- **Encryption**: Verify keys not exposed

### Eradication Checklist
- [ ] Vulnerability patched
- [ ] Affected systems cleaned
- [ ] Unauthorized access removed
- [ ] Security controls strengthened
- [ ] Monitoring enhanced

## Phase 4: Recovery (4-24 hours)

### System Restoration

#### Database Recovery (if needed)
```sql
-- 1. Verify data integrity
SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL;
SELECT COUNT(*) FROM profiles WHERE is_active = true;

-- 2. Restore from backup if compromised
-- Use Supabase Dashboard → Database → Backups

-- 3. Verify RLS policies active
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = false;
-- Expected: Empty result (all tables have RLS)
```

#### Re-enable Services
```typescript
// 1. Lift emergency lockdown (if activated)
await supabase.rpc('disable_emergency_lockdown');

// 2. Restore normal monitoring levels
await supabase.rpc('disable_enhanced_monitoring');

// 3. Re-enable user accounts (if legitimate users affected)
await supabase.auth.admin.updateUserById(userId, {
  banned: false
});
```

### User Communication
```typescript
// For affected users only (don't alert entire user base unnecessarily)
await supabase.from('system_notifications').insert({
  user_id: affectedUserId,
  title: 'Security Update',
  message: 'We detected suspicious activity on your account and have taken protective measures. Please review your recent activity and change your password.',
  severity: 'high',
  requires_action: true
});
```

### Recovery Checklist
- [ ] Systems restored to normal operation
- [ ] Data integrity verified
- [ ] Affected users notified (if applicable)
- [ ] Security controls re-enabled
- [ ] Monitoring confirms normal operations

## Phase 5: Post-Incident Review (24-72 hours)

### Incident Documentation

Create detailed incident report:
```markdown
# Security Incident Report - {{incident_id}}

## Summary
- **Date/Time**: {{timestamp}}
- **Severity**: {{critical/high/medium/low}}
- **Type**: {{sql_injection/data_breach/ddos/etc}}
- **Duration**: {{start}} to {{end}}

## Timeline
- HH:MM - Incident detected
- HH:MM - Containment initiated
- HH:MM - Root cause identified
- HH:MM - Vulnerability patched
- HH:MM - Systems restored

## Impact
- **Users Affected**: {{number}}
- **Data Compromised**: {{yes/no}} - {{details}}
- **Downtime**: {{duration}}
- **Financial Impact**: {{estimate}}

## Root Cause
{{Detailed explanation of how incident occurred}}

## Response Effectiveness
- **Detection Time**: {{minutes}}
- **Response Time**: {{minutes}}
- **Recovery Time**: {{hours}}
- **What Worked Well**: {{list}}
- **What Needs Improvement**: {{list}}

## Remediation Actions Taken
1. {{action 1}}
2. {{action 2}}
...

## Preventive Measures
1. {{measure 1}}
2. {{measure 2}}
...

## Lessons Learned
{{Key takeaways for future incidents}}
```

### Security Improvements

Based on incident, implement:
1. **Code Changes**
   - Enhanced validation
   - Stricter rate limits
   - Better error handling

2. **Process Changes**
   - Updated monitoring alerts
   - Improved detection rules
   - Enhanced testing procedures

3. **Documentation Updates**
   - Security policies
   - Incident playbook
   - Training materials

4. **Team Training**
   - Incident response drill
   - Security awareness
   - Tool training

### Post-Incident Checklist
- [ ] Incident report completed
- [ ] Root cause analysis documented
- [ ] Security improvements implemented
- [ ] Team debriefing conducted
- [ ] Monitoring rules updated
- [ ] Playbook updated with lessons learned

## Emergency Contacts

### Internal Team
- **Security Lead**: {{name}} - {{phone}} - {{email}}
- **CTO**: {{name}} - {{phone}} - {{email}}
- **DevOps Lead**: {{name}} - {{phone}} - {{email}}
- **CEO**: {{name}} - {{phone}} - {{email}}

### External Resources
- **Supabase Support**: support@supabase.com
- **Lovable Support**: https://docs.lovable.dev/support
- **Legal Counsel**: {{contact}}
- **Cybersecurity Firm**: {{contact}} (for major incidents)

## Key Tools & Access

- **Supabase Dashboard**: https://supabase.com/dashboard/project/gshxxsniwytjgcnthyfq
- **Security Events**: `SELECT * FROM security_events ORDER BY created_at DESC;`
- **Audit Logs**: `SELECT * FROM audit_logs ORDER BY created_at DESC;`
- **Edge Function Logs**: Supabase Dashboard → Functions
- **Lovable Security View**: Project → Security tab

## Compliance & Legal

### Breach Notification Requirements

#### GDPR (if applicable)
- **Timeline**: 72 hours to report to authorities
- **Threshold**: Personal data of EU residents
- **Authority**: Relevant data protection authority

#### State Laws (California, etc.)
- **Timeline**: "Without unreasonable delay"
- **Threshold**: Personal information compromised
- **Notification**: Affected individuals + AG

### Documentation for Legal
- Incident timeline
- Data affected
- Users impacted
- Remediation actions
- Prevention measures

## Testing This Playbook

### Quarterly Tabletop Exercises
1. **Scenario**: SQL injection attack
2. **Participants**: Security team + DevOps
3. **Duration**: 2 hours
4. **Goal**: Practice response procedures

### Annual Full Drill
1. **Scenario**: Simulated data breach
2. **Participants**: All stakeholders
3. **Duration**: Half day
4. **Goal**: Test entire incident response

## Version History

- **v1.0** - {{date}} - Initial playbook
- **v1.1** - {{date}} - Updated after incident {{id}}

---

**Remember**: In a security incident, speed and accuracy are critical. Follow this playbook systematically, document everything, and don't hesitate to escalate.
