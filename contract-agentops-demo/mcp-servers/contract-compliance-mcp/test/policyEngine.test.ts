import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkPolicy, flagRisk } from "../src/engine.js";
import { PolicyRule, PolicyViolation, policyEngine } from "../src/policyEngine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface TestCase {
	name: string;
	clause: {
		type: string;
		text: string;
		section: string;
	};
	expected: {
		violations: number;
		severity?: "low" | "medium" | "high" | "critical";
		status?: "pass" | "warning" | "fail";
	};
}

const testCases: TestCase[] = [
	{
		name: "High liability cap exceeds policy",
		clause: {
			type: "liability",
			text: "The maximum liability under this agreement shall be limited to $10,000,000 USD.",
			section: "15.2",
		},
		expected: {
			violations: 1,
			severity: "high",
			status: "fail",
		},
	},
	{
		name: "Acceptable liability cap within policy",
		clause: {
			type: "liability",
			text: "The maximum liability under this agreement shall be limited to $2,000,000 USD.",
			section: "15.2",
		},
		expected: {
			violations: 0,
		},
	},
	{
		name: "Unlimited indemnification violates policy",
		clause: {
			type: "indemnification",
			text: "Company shall provide unlimited indemnification for all claims arising from this agreement.",
			section: "12.1",
		},
		expected: {
			violations: 1,
			severity: "critical",
			status: "fail",
		},
	},
	{
		name: "Extended payment terms exceed policy",
		clause: {
			type: "payment",
			text: "All invoices are payable net-60 days from the invoice date.",
			section: "8.2",
		},
		expected: {
			violations: 1,
			severity: "medium",
			status: "fail",
		},
	},
	{
		name: "Standard payment terms acceptable",
		clause: {
			type: "payment",
			text: "Payment is due within 30 days of invoice receipt.",
			section: "8.2",
		},
		expected: {
			violations: 0,
		},
	},
	{
		name: "Excessive data retention period",
		clause: {
			type: "data_protection",
			text: "Customer data will be retained for a period of 10 years after contract termination.",
			section: "9.3",
		},
		expected: {
			violations: 1,
			severity: "medium",
			status: "fail",
		},
	},
	{
		name: "Non-preferred jurisdiction",
		clause: {
			type: "governing_law",
			text: "This agreement shall be governed by the laws of Illinois.",
			section: "16.1",
		},
		expected: {
			violations: 1,
			severity: "low",
			status: "fail",
		},
	},
	{
		name: "Low SLA uptime requirement",
		clause: {
			type: "sla",
			text: "The service level agreement guarantees 99.0% uptime availability.",
			section: "5.1",
		},
		expected: {
			violations: 1,
			severity: "medium",
			status: "fail",
		},
	},
];

async function runTests() {
	console.log("Starting Dynamic Policy Engine Tests\n");

	// Ensure test data directory exists
	const dataDir = resolve(__dirname, "../data/policies");
	try {
		await mkdir(dataDir, { recursive: true });
	} catch (error) {
		// Directory might already exist
	}

	let passed = 0;
	let failed = 0;

	for (const testCase of testCases) {
		console.log(`\nTest: ${testCase.name}`);
		console.log(`Clause: ${testCase.clause.text}`);
		console.log(`Type: ${testCase.clause.type}\n`);

		try {
			// Test individual clause evaluation
			const violations = await policyEngine.evaluateClause(testCase.clause.type, testCase.clause.text, {
				section: testCase.clause.section,
			});

			console.log(`Expected violations: ${testCase.expected.violations}`);
			console.log(`Actual violations: ${violations.length}`);

			if (violations.length === testCase.expected.violations) {
				if (violations.length > 0) {
					const violation = violations[0];
					console.log(`Severity: ${violation.severity} (expected: ${testCase.expected.severity})`);
					console.log(`Status: ${violation.status} (expected: ${testCase.expected.status})`);
					console.log(`Message: ${violation.message}`);
					console.log(`Rule: ${violation.rule_id}`);

					if (violation.severity === testCase.expected.severity && violation.status === testCase.expected.status) {
						console.log("✅ PASS - Violation details match expected");
						passed++;
					} else {
						console.log("❌ FAIL - Violation details don't match");
						failed++;
					}
				} else {
					console.log("✅ PASS - No violations as expected");
					passed++;
				}
			} else {
				console.log("❌ FAIL - Violation count mismatch");
				console.log("Actual violations:");
				violations.forEach((v, i) => {
					console.log(`  ${i + 1}. ${v.rule_id} (${v.severity}): ${v.message}`);
				});
				failed++;
			}
		} catch (error) {
			console.log(`❌ ERROR: ${error instanceof Error ? error.message : String(error)}`);
			failed++;
		}
	}

	console.log(`\n${"=".repeat(50)}`);
	console.log("Test Results Summary:");
	console.log(`Passed: ${passed}`);
	console.log(`Failed: ${failed}`);
	console.log(`Total: ${passed + failed}`);

	if (failed === 0) {
		console.log("🎉 All tests passed!");
	} else {
		console.log(`⚠️  ${failed} test(s) failed`);
	}

	// Test the full compliance check workflow
	console.log(`\n${"=".repeat(50)}`);
	console.log("Testing Full Compliance Workflow\n");

	const testClauses = [
		{
			type: "liability",
			text: "The maximum liability under this agreement shall be limited to $10,000,000 USD.",
			section: "15.2",
		},
		{
			type: "indemnification",
			text: "Company shall provide unlimited indemnification for all claims arising from this agreement.",
			section: "12.1",
		},
		{
			type: "payment",
			text: "All invoices are payable net-30 days from the invoice date.",
			section: "8.2",
		},
	];

	try {
		const complianceResult = await checkPolicy(testClauses, "service_agreement");
		console.log("Compliance Check Results:");
		console.log(`Overall Risk: ${complianceResult.overall_risk}`);
		console.log(`Flags Count: ${complianceResult.flags_count}`);
		console.log(`Warnings Count: ${complianceResult.warnings_count}`);
		console.log(`Total Violations: ${complianceResult.total_violations}`);
		console.log(`Policy References: ${complianceResult.policy_references.join(", ")}`);

		console.log("\nClause Results:");
		complianceResult.clause_results.forEach((result, i) => {
			console.log(`  ${i + 1}. ${result.clause_type}: ${result.status} (${result.severity || "N/A"})`);
			console.log(`     Policy: ${result.policy_ref}`);
			console.log(`     Reason: ${result.reason}`);
			if (result.extracted_value !== undefined) {
				console.log(`     Extracted: ${result.extracted_value} | Threshold: ${result.policy_threshold}`);
			}
		});

		// Test risk flagging
		const riskAssessment = await flagRisk(complianceResult.clause_results);
		console.log("\nRisk Assessment:");
		console.log(`Overall Risk: ${riskAssessment.overall_risk}`);
		console.log(`Summary: ${riskAssessment.summary}`);

		if (riskAssessment.critical_violations.length > 0) {
			console.log("Critical Violations:");
			riskAssessment.critical_violations.forEach((v) => console.log(`  - ${v}`));
		}

		if (riskAssessment.high_violations.length > 0) {
			console.log("High Violations:");
			riskAssessment.high_violations.forEach((v) => console.log(`  - ${v}`));
		}

		console.log("✅ Full compliance workflow test completed successfully");
	} catch (error) {
		console.log(`❌ Full compliance workflow test failed: ${error instanceof Error ? error.message : String(error)}`);
	}

	console.log(`\n${"=".repeat(50)}`);
	console.log("Dynamic Policy Engine Tests Complete");

	// Exit with appropriate code
	process.exit(failed > 0 ? 1 : 0);
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runTests().catch((error) => {
		console.error("Test execution failed:", error);
		process.exit(1);
	});
}

export { runTests };
