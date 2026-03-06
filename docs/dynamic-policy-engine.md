# Dynamic Policy Engine

The Dynamic Policy Engine replaces hard-coded compliance rules with a flexible, configurable system that supports real-time policy updates, detailed violation reporting, and sophisticated risk assessment.

## Key Features

### 1. Configurable Policy Rules
- **JSON-based configuration** stored in `data/policies/contract_policies.json`
- **Runtime updates** without restarting the service
- **Rule versioning** with effective and expiry dates
- **Multiple condition types**: threshold, pattern matching, lookup tables, calculations

### 2. Enhanced Violation Detection
- **Monetary value extraction** from contract text with currency support
- **Time period parsing** for payment terms, retention periods, notice requirements
- **Pattern matching** for jurisdiction, indemnification types, SLA requirements
- **Regex support** for complex text analysis

### 3. Severity-Based Risk Assessment
- **Four severity levels**: low, medium, high, critical
- **Graduated responses**: warnings vs. failures based on severity
- **Risk escalation**: critical violations trigger immediate flags
- **Detailed reporting** with extracted values and policy thresholds

## Policy Rule Structure

```typescript
interface PolicyRule {
  id: string;                    // Unique rule identifier (e.g., "FIN-001")
  category: string;              // Policy category: financial, legal, data, operational, ai_ml, security
  clause_types: string[];        // Applicable clause types
  rule_type: string;            // Rule evaluation type: threshold, pattern, lookup, calculation
  condition: PolicyCondition;    // Evaluation criteria
  severity: string;             // Violation severity: low, medium, high, critical
  message_template: string;     // Message template with placeholders
  effective_date: string;       // When rule becomes active
  expiry_date?: string;         // Optional rule expiration
  enabled: boolean;             // Rule activation status
  metadata?: Record<string, unknown>;  // Additional rule data
}
```

### Policy Condition Types

```typescript
interface PolicyCondition {
  operator: "gt" | "lt" | "eq" | "ne" | "contains" | "not_contains" | "regex" | "in" | "not_in";
  field: string;               // Field to evaluate (liability_amount, payment_days, etc.)
  value: string | number | string[];  // Comparison value(s)
  unit?: string;               // Optional unit (days, years, etc.)
  currency?: string;           // Optional currency (USD, EUR, etc.)
}
```

## Default Policy Rules

The system initializes with the following default policies:

| Rule ID | Category | Clause Type | Condition | Severity | Description |
|---------|----------|-------------|-----------|----------|-------------|
| FIN-001 | financial | liability | liability_amount > $5M | high | Liability cap exceeds maximum |
| FIN-002 | financial | payment | payment_days > 45 | medium | Extended payment terms |
| FIN-003 | financial | indemnification | unlimited indemnification | critical | Unlimited indemnification prohibited |
| DATA-001 | data | data_protection | retention_years > 7 | medium | Excessive data retention |
| LEG-001 | legal | governing_law | jurisdiction not in [DE, NY, CA] | low | Non-preferred jurisdiction |
| OPS-001 | operational | sla | uptime_percentage < 99.9% | medium | Low SLA uptime requirement |

## Value Extraction Capabilities

The policy engine automatically extracts and evaluates:

### Monetary Values
- **Formats**: `$10,000,000`, `USD 5000000`, `5M dollars`
- **Special cases**: "unlimited", "uncapped", "no limit" → Infinity
- **Currency normalization** with Intl.NumberFormat

### Time Periods
- **Payment terms**: "net-30", "30 days from invoice", "payment due in 45 days"
- **Retention periods**: "5 years retention", "retain for 7 years"
- **Notice periods**: "30 days notice", "notice of 60 days"

### Text Patterns
- **Jurisdiction extraction** from governing law clauses
- **Indemnification type analysis**: mutual, unlimited, one-way, standard
- **SLA parsing**: "99.9% uptime", "availability of 95%"

## API Integration

### MCP Server Tools

The compliance MCP server provides these tools for policy management:

```typescript
// Get all policy rules
await mcpClient.callTool("get_policy_rules", {});

// Add new policy rule
await mcpClient.callTool("add_policy_rule", {
  rule: JSON.stringify({
    id: "SEC-001",
    category: "security",
    clause_types: ["cybersecurity"],
    rule_type: "pattern",
    condition: {
      operator: "not_contains",
      field: "security_standards",
      value: "ISO 27001"
    },
    severity: "high",
    message_template: "Missing required ISO 27001 certification",
    effective_date: "2024-01-01",
    enabled: true
  })
});

// Update existing rule
await mcpClient.callTool("update_policy_rule", {
  rule_id: "FIN-001",
  updates: JSON.stringify({
    severity: "critical",
    condition: { ...existingCondition, value: 3000000 }
  })
});

// Delete policy rule
await mcpClient.callTool("delete_policy_rule", {
  rule_id: "OLD-001"
});
```

### Direct Engine Usage

```typescript
import { policyEngine } from "./policyEngine.js";

// Evaluate individual clause
const violations = await policyEngine.evaluateClause(
  "liability",
  "Maximum liability shall not exceed $10,000,000",
  { section: "15.2" }
);

// Add new policy programmatically
await policyEngine.addPolicy({
  id: "CUSTOM-001",
  category: "ai_ml",
  clause_types: ["ai_services", "data_processing"],
  rule_type: "threshold",
  condition: {
    operator: "gt",
    field: "training_data_retention",
    value: 24
  },
  severity: "medium",
  message_template: "AI training data retention of {actual_value} months exceeds policy limit of {policy_value} months",
  effective_date: "2024-12-01",
  enabled: true
});
```

## Enhanced Risk Assessment

The dynamic policy engine provides sophisticated risk calculation:

```typescript
interface RiskAssessment {
  overall_risk: "low" | "medium" | "high" | "critical";
  flags_count: number;           // Number of failed checks
  warnings_count: number;        // Number of warnings
  summary: string;              // Human-readable summary
  critical_violations: string[]; // List of critical issues
  high_violations: string[];     // List of high-severity issues
}
```

### Risk Calculation Logic

1. **Critical**: Any critical severity violations
2. **High**: 2+ high severity violations OR 3+ total failures
3. **Medium**: 1 high severity violation OR 1+ failure OR 3+ warnings
4. **Low**: Only warnings or no violations

## Configuration Management

### File Location
Policy configurations are stored in: `data/policies/contract_policies.json`

### Auto-Refresh
The engine automatically reloads policies every 5 minutes to support runtime updates.

### Validation
- Rule IDs must be unique
- Effective dates must be valid ISO strings
- Condition operators must match supported types
- Clause types must exist in the system

## Testing

Run the comprehensive test suite:

```bash
cd mcp-servers/contract-compliance-mcp
node run-tests.mjs
```

The test suite covers:
- ✅ Individual policy rule evaluation
- ✅ Value extraction (monetary, time, patterns)
- ✅ Severity-based risk assessment
- ✅ Full compliance workflow
- ✅ Edge cases and error handling

## Migration from Hard-Coded Rules

The new dynamic policy engine provides these advantages over the previous hard-coded implementation:

| Feature | Hard-Coded | Dynamic Policy Engine |
|---------|------------|----------------------|
| Rule Updates | Code deployment required | Runtime configuration |
| Value Extraction | Simple regex | Comprehensive parsing |
| Risk Assessment | Basic counting | Severity-weighted calculation |
| Extensibility | Code changes needed | JSON configuration |
| Auditability | Limited | Full rule traceability |
| Testing | Limited coverage | Comprehensive test suite |

## Future Enhancements

Planned improvements include:
- **Rule dependencies**: Complex conditional logic between rules
- **Machine learning integration**: AI-powered risk scoring
- **Industry templates**: Pre-built rule sets for different sectors
- **Audit logging**: Complete compliance check history
- **Real-time notifications**: Webhook integration for policy violations