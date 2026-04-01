<!-- Context: workflows/security | Priority: critical | Version: 1.0 | Updated: 2026-03-31 -->

# Security Remediation Workflow

## Quick Reference

**Purpose**: End-to-end workflow for security vulnerability detection, reporting, and remediation

**Key Agents**: SecurityScanner (detect) → CoderAgent (fix) → TestEngineer (verify)

**Process**: Scan → Alert → Log → Delegate → Fix → Verify → Close

**Golden Rule**: Critical issues block deployment until fixed and verified

---

## Workflow Overview

```
┌─────────────────┐
│  Scan Trigger   │ (Pre-commit, Pre-deploy, On-demand, Scheduled)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SecurityScanner │ (Comprehensive scan: packages, code, forms, prompts)
│   Detection     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Severity Check  │ (Classify: Critical, High, Medium, Low)
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
 Critical   Non-Critical
    │         │
    ▼         ▼
┌────────┐ ┌──────────┐
│ ALERT  │ │   Log    │
│  User  │ │ Finding  │
└───┬────┘ └────┬─────┘
    │           │
    └─────┬─────┘
          ▼
┌─────────────────┐
│  Log to Report  │ (.tmp/security/scan-reports/)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Task for │
│   CoderAgent    │ (Delegate fix with context)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   CoderAgent    │ (Implement fix following remediation guidance)
│  Implements Fix │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ TestEngineer    │ (Write regression test)
│  Adds Tests     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SecurityScanner │ (Verify fix in rescan)
│    Verifies     │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
  Fixed    Not Fixed
    │         │
    ▼         ▼
┌────────┐ ┌──────────┐
│ Close  │ │ Escalate │
│Finding │ │ to User  │
└────────┘ └──────────┘
```

---

## Step-by-Step Workflow

### Step 1: Scan Trigger

**When to Trigger SecurityScanner**:

1. **Pre-commit Hook** (Quick Scan):
   - Secrets detection
   - Basic injection patterns
   - Duration: <10 seconds
   - Blocks commit if Critical issues found

2. **Pre-deployment** (Comprehensive Scan):
   - All scan categories
   - Full package audit
   - Duration: 1-5 minutes
   - Blocks deployment if Critical/High issues found

3. **On-demand** (User-initiated):
   ```bash
   # Via command
   /security-scan

   # Or delegate directly
   task(subagent_type="SecurityScanner",
        description="Comprehensive security scan",
        prompt="Run comprehensive security scan on the entire codebase.
                Check: packages, secrets, injection, forms, prompt injection, auth, data exposure.
                Report all findings by severity.")
   ```

4. **Scheduled** (Continuous Monitoring):
   - Weekly comprehensive scan
   - Monthly deep audit
   - Automated via CI/CD

5. **Dependency Changes**:
   - After `package.json` updates
   - After `requirements.txt` updates
   - After any dependency file modification

---

### Step 2: SecurityScanner Detection

**Process**:

1. **Load Security Context**:
   ```
   Read .opencode/context/core/standards/security-scanning.md
   ```

2. **Run Comprehensive Scans**:
   - Package vulnerabilities
   - Secret detection
   - Injection vulnerabilities
   - Form security
   - Prompt injection
   - Authentication/authorization
   - Data exposure

3. **Classify Findings**:
   - 🔴 Critical (CVSS 9.0-10.0)
   - 🟠 High (CVSS 7.0-8.9)
   - 🟡 Medium (CVSS 4.0-6.9)
   - 🔵 Low (CVSS 0.1-3.9)

---

### Step 3: Alert User (Critical/High Only)

**For Critical and High severity findings**:

**Alert Format**:
```
🚨 SECURITY ALERT: {critical_count} Critical, {high_count} High severity issues found!

Critical Issues ({critical_count}):
- SEC-001: {title} ({location})
- SEC-002: {title} ({location})

High Issues ({high_count}):
- SEC-003: {title} ({location})
- SEC-004: {title} ({location})

📄 Full report: .tmp/security/scan-reports/scan-{timestamp}.json

⚡ Remediation tasks created. Review findings and approve fixes.

🚫 {deployment_status}
```

**Deployment Status by Severity**:
- **Critical**: 🚫 Deployment BLOCKED until all Critical issues fixed
- **High**: ⚠️  Deployment allowed with explicit approval only
- **Medium/Low**: ✅ Deployment allowed, fix in next sprint

---

### Step 4: Log Findings

**Create Structured Report**:

**Location**: `.tmp/security/scan-reports/scan-{timestamp}.json`

**Format**:
```json
{
  "scan_id": "scan-2026-03-31-142530",
  "timestamp": "2026-03-31T14:25:30Z",
  "project": "openagentscontrol",
  "scan_type": "comprehensive",
  "duration_seconds": 45,
  "triggered_by": "pre-deployment",
  "summary": {
    "critical": 1,
    "high": 3,
    "medium": 7,
    "low": 12,
    "total": 23
  },
  "findings": [
    {
      "id": "SEC-001",
      "severity": "critical",
      "category": "prompt_injection",
      "title": "Unsanitized user input in AI prompt",
      "description": "User input flows directly to LLM prompt without validation or sanitization, allowing prompt injection attacks",
      "location": "src/agents/chat.ts:45",
      "evidence": "const prompt = `User query: ${req.body.input}`;",
      "impact": "Attacker can inject malicious instructions to bypass system prompts, extract sensitive data, or manipulate AI behavior",
      "remediation": "Sanitize user input using prompt injection filters. Implement structured prompts with JSON format. Add input length limits and keyword blocklist.",
      "cwe": "CWE-74: Improper Neutralization of Special Elements",
      "owasp": "A03:2021 – Injection",
      "cvss_score": 9.1,
      "status": "open",
      "created_at": "2026-03-31T14:25:30Z",
      "remediation_task_id": "task-001"
    }
  ],
  "scan_coverage": {
    "packages": true,
    "secrets": true,
    "injection": true,
    "forms": true,
    "prompt_injection": true,
    "auth": true,
    "data_exposure": true
  }
}
```

**Maintain Scan History**:
- Latest: `.tmp/security/latest-scan.json` (symlink)
- History: `.tmp/security/scan-reports/scan-{timestamp}.json`
- Retention: Keep last 30 scans

---

### Step 5: Create Remediation Tasks

**For EACH finding, delegate to CoderAgent**:

**Task Creation**:
```typescript
task(
  subagent_type="CoderAgent",
  description="Fix {severity} security issue: {title}",
  prompt=`Security Remediation Task

Finding ID: {id}
Severity: {severity} (CVSS {cvss_score})
Category: {category}

📍 Location: {location}

🔍 Issue Description:
{description}

📋 Evidence:
\`\`\`
{evidence}
\`\`\`

💥 Impact:
{impact}

🛠️  Required Remediation:
{remediation}

📚 Context to Load:
- .opencode/context/core/standards/security-scanning.md
- .opencode/context/core/standards/code-quality.md

✅ Acceptance Criteria:
1. Implement the remediation steps exactly as described
2. Follow secure coding best practices
3. Do NOT introduce new vulnerabilities
4. Add inline comments explaining the security fix
5. Update any related code that has the same pattern

⚠️  Important:
- Load security context BEFORE implementing
- Apply fix to ALL instances of this pattern, not just flagged location
- Test the fix thoroughly
- Document what was changed in completion summary

After fixing, I will verify the fix in the next security scan.`
)
```

**Track Task Mapping**:

Update finding with task ID:
```json
{
  "id": "SEC-001",
  "status": "in_progress",
  "remediation_task_id": "task-001",
  "assigned_to": "coder-agent",
  "assigned_at": "2026-03-31T14:26:00Z"
}
```

---

### Step 6: CoderAgent Implements Fix

**CoderAgent Process**:

1. **Load Context**:
   - Read `.opencode/context/core/standards/security-scanning.md`
   - Read `.opencode/context/core/standards/code-quality.md`
   - Understand the vulnerability pattern

2. **Implement Remediation**:
   - Follow remediation steps exactly
   - Apply fix to ALL instances (not just the flagged one)
   - Add security comments in code
   - Follow secure coding patterns

3. **Self-Review**:
   - Check that fix doesn't introduce new issues
   - Verify all instances are fixed
   - Confirm acceptance criteria met

4. **Report Completion**:
   ```
   ✅ Security fix completed: SEC-001

   Changes:
   - src/agents/chat.ts: Added prompt injection sanitization
   - src/utils/sanitize.ts: Created sanitization utility
   - Applied fix to 3 similar patterns found in codebase

   Fix applied:
   - Input sanitization with keyword blocklist
   - Input length limit (1000 chars)
   - Structured JSON prompt format
   - Added security comments

   Ready for security verification scan.
   ```

---

### Step 7: TestEngineer Adds Regression Tests

**After CoderAgent fixes issue, delegate to TestEngineer**:

```typescript
task(
  subagent_type="TestEngineer",
  description="Write regression test for security fix: {title}",
  prompt=`Write regression tests for security fix

Original Issue: {title}
Finding ID: {id}
Fixed in: {location}

Test Requirements:
1. Test that the vulnerability is NOW FIXED
2. Test attack vectors that were previously exploitable
3. Test edge cases around the fix
4. Ensure fix doesn't break existing functionality

Example test cases for prompt injection fix:
- Test input with "ignore previous instructions"
- Test input with system role injection attempts
- Test input with token manipulation attempts
- Test valid user input still works correctly

Load test context from .opencode/context/core/standards/test-coverage.md`
)
```

**Test ensures**:
- Vulnerability is fixed
- Attack vectors are blocked
- Fix doesn't break functionality
- Prevents regression in future

---

### Step 8: SecurityScanner Verifies Fix

**After CoderAgent completes fix, run verification scan**:

**Targeted Rescan**:
```typescript
task(
  subagent_type="SecurityScanner",
  description="Verify security fix: {title}",
  prompt=`Verify that security issue {id} is now fixed

Original Issue:
- Location: {location}
- Category: {category}
- Pattern: {evidence}

Verification Steps:
1. Rescan the specific file/area where fix was applied
2. Check if the vulnerability pattern still exists
3. Verify the fix follows secure coding practices
4. Check for similar patterns elsewhere in codebase

Report:
- FIXED: Vulnerability no longer present, fix is correct
- NOT FIXED: Vulnerability still exists or fix is incomplete
- NEW ISSUES: Fix introduced new vulnerabilities`
)
```

**Update Finding Status**:

If **FIXED**:
```json
{
  "id": "SEC-001",
  "status": "fixed",
  "fixed_at": "2026-03-31T15:00:00Z",
  "fixed_by": "coder-agent",
  "verified_at": "2026-03-31T15:10:00Z",
  "verified_by": "security-scanner",
  "fix_commit": "abc123",
  "verification_notes": "Vulnerability pattern no longer present. Sanitization correctly implemented. No similar patterns found elsewhere."
}
```

If **NOT FIXED** or **NEW ISSUES**:
```json
{
  "id": "SEC-001",
  "status": "reopened",
  "reopened_at": "2026-03-31T15:10:00Z",
  "reopened_reason": "Fix incomplete: Input validation missing for edge case with Unicode characters",
  "remediation_attempts": 1
}
```

Escalate to user and create new remediation task.

---

### Step 9: Close Finding or Escalate

**If FIXED**:
1. Update finding status to "fixed"
2. Add to "fixed_findings" report
3. Notify user of successful remediation
4. Archive finding (keep in history)

**If NOT FIXED after 2 attempts**:
1. Escalate to user
2. Provide detailed analysis of why fix failed
3. Request manual intervention
4. Consider alternative remediation approaches

**Escalation Message**:
```
⚠️  Security Finding Escalation: SEC-001

Issue: {title}
Severity: {severity}
Attempts: 2

Status: Automated remediation unsuccessful

Reason:
{reason_fix_failed}

Attempted Fixes:
1. {attempt_1_description} - Result: {result}
2. {attempt_2_description} - Result: {result}

Recommendation:
{manual_remediation_guidance}

This issue requires manual review and intervention.
```

---

## Scan Schedules

### Pre-commit (Quick Scan)

**Trigger**: Git pre-commit hook
**Duration**: <10 seconds
**Scans**: Secrets, basic injection patterns
**Block**: Critical issues only

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running security scan..."

# Quick scan
oac delegate SecurityScanner "quick-scan" --timeout 10s

if [ $? -ne 0 ]; then
  echo "❌ Critical security issues found. Commit blocked."
  echo "Run 'oac security-report' for details."
  exit 1
fi
```

### Pre-deployment (Comprehensive Scan)

**Trigger**: CI/CD pipeline before deployment
**Duration**: 1-5 minutes
**Scans**: All categories
**Block**: Critical + High issues

```yaml
# .github/workflows/deploy.yml
jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - name: Security Scan
        run: |
          oac delegate SecurityScanner "comprehensive-scan"

      - name: Check Results
        run: |
          CRITICAL=$(cat .tmp/security/latest-scan.json | jq '.summary.critical')
          HIGH=$(cat .tmp/security/latest-scan.json | jq '.summary.high')

          if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
            echo "Security issues found: $CRITICAL critical, $HIGH high"
            exit 1
          fi
```

### Scheduled (Weekly)

**Trigger**: Cron job / GitHub Actions schedule
**Duration**: 5-10 minutes
**Scans**: All categories + deep analysis
**Block**: None (report only)

```yaml
# .github/workflows/security-audit.yml
on:
  schedule:
    - cron: '0 2 * * 1' # Every Monday at 2 AM

jobs:
  security-audit:
    runs-on: ubuntu-latest
    steps:
      - name: Weekly Security Audit
        run: |
          oac delegate SecurityScanner "deep-audit"

      - name: Upload Report
        uses: actions/upload-artifact@v3
        with:
          name: security-report
          path: .tmp/security/scan-reports/
```

---

## Remediation SLAs

**Service Level Agreements for fixing security issues**:

| Severity | Response Time | Fix Deadline | Deployment Block |
|----------|---------------|--------------|------------------|
| 🔴 Critical | Immediate | 24 hours | Yes |
| 🟠 High | 4 hours | 7 days | Requires approval |
| 🟡 Medium | 24 hours | 30 days | No |
| 🔵 Low | 7 days | 90 days | No |

**Response Time**: How quickly to acknowledge and start working
**Fix Deadline**: When fix must be completed and deployed
**Deployment Block**: Whether deployments are blocked until fixed

---

## Integration with Development Workflow

### OpenAgent Integration

**Add SecurityScanner to OpenAgent's available subagents**:

```markdown
# In .opencode/agent/core/openagent.md

**Security Subagents**:
- `SecurityScanner` - Comprehensive security vulnerability scanning

**When to Use**:
- Before deployments (pre-deploy gate)
- After dependency updates
- User requests security audit
- Weekly scheduled scans
```

### Automated Triggers

**Integration Points**:

1. **Git Hooks**:
   - Pre-commit: Quick scan (secrets, basic patterns)
   - Pre-push: Medium scan (injection, forms)

2. **CI/CD Pipeline**:
   - PR checks: Comprehensive scan
   - Pre-deployment: Full audit + block if issues

3. **Dependency Updates**:
   - package.json changes trigger package audit
   - Dependabot PRs automatically scanned

4. **On-demand**:
   - User command: `/security-scan`
   - Delegate: `task(subagent_type="SecurityScanner", ...)`

---

## Report Dashboard (Future Enhancement)

**Visual Security Dashboard** (`.tmp/security/dashboard.html`):

```
┌─────────────────────────────────────────────────────────┐
│            Security Scan Dashboard                      │
├─────────────────────────────────────────────────────────┤
│  Last Scan: 2026-03-31 14:25:30                        │
│  Status: ⚠️  2 High Issues Found                        │
│                                                         │
│  Summary:                                               │
│    🔴 Critical: 0                                       │
│    🟠 High: 2                                           │
│    🟡 Medium: 5                                         │
│    🔵 Low: 8                                            │
│                                                         │
│  Trending:                                              │
│    📈 +2 new issues since last scan                    │
│    📉 -3 issues fixed                                   │
│                                                         │
│  Top Categories:                                        │
│    1. Injection (5 findings)                           │
│    2. Packages (4 findings)                            │
│    3. Auth (3 findings)                                │
└─────────────────────────────────────────────────────────┘
```

---

## Best Practices

### For SecurityScanner

✅ **Run comprehensive scans** (don't skip categories)
✅ **Alert immediately for Critical/High**
✅ **Provide actionable remediation steps**
✅ **Log all findings with timestamps**
✅ **Verify fixes after remediation**
✅ **Track remediation status**

### For CoderAgent

✅ **Load security context before fixing**
✅ **Fix ALL instances, not just flagged one**
✅ **Add security comments in code**
✅ **Don't introduce new vulnerabilities**
✅ **Request verification scan after fix**

### For OpenAgent

✅ **Trigger security scans at key checkpoints**
✅ **Block deployments for Critical issues**
✅ **Track remediation progress**
✅ **Escalate unresolved issues**

---

## Example: End-to-End Flow

### Scenario: Prompt Injection Vulnerability

**1. Detection**:
```
SecurityScanner finds unsanitized user input in LLM prompt
→ Classified as Critical (CVSS 9.1)
→ Logged to .tmp/security/scan-reports/scan-123.json
→ User alerted immediately
```

**2. Task Creation**:
```
SecurityScanner delegates to CoderAgent:
"Fix critical prompt injection vulnerability in src/agents/chat.ts:45"
```

**3. Fix Implementation**:
```
CoderAgent:
- Loads security-scanning.md
- Implements sanitization function
- Applies to all 3 instances found
- Adds security comments
```

**4. Test Addition**:
```
TestEngineer:
- Writes tests for attack vectors
- Verifies sanitization works
- Ensures valid input still works
```

**5. Verification**:
```
SecurityScanner rescans:
- Confirms vulnerability no longer present
- Checks for similar patterns
- Updates finding status to "fixed"
```

**6. Closure**:
```
Finding SEC-001 marked as fixed
User notified of successful remediation
Deployment unblocked
```

---

**Remember**: Security is continuous, not a one-time check. Scan often, fix fast, verify always.
