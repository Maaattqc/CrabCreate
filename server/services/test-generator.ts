import * as repo from '../db/repositories';
import type { Ticket, CodingResult, TestResults } from '../types';

/**
 * Test generator — generates and "runs" PHPUnit tests.
 * Currently in simulation mode — returns mocked results.
 */
async function runTests(ticket: Ticket, codingResult: CodingResult): Promise<TestResults> {
  // Simulate test generation and execution
  const files = codingResult.files || [];
  const multiplier = parseInt(repo.getConfig('test_multiplier_per_file') || '3', 10);
  const totalTests = Math.max(files.length * multiplier, multiplier);
  const passed = totalTests - Math.floor(Math.random() * 2); // 0-1 failures
  const failed = totalTests - passed;

  const tests: TestResults['tests'] = [];
  for (let i = 0; i < totalTests; i++) {
    const fileIdx = i % Math.max(files.length, 1);
    const fileName = files[fileIdx]?.path || 'unknown.php';
    tests.push({
      name: `test_${fileName.replace(/[^a-zA-Z0-9]/g, '_')}_case_${i + 1}`,
      file: fileName,
      status: i < passed ? 'passed' : 'failed',
      message: i < passed ? null : 'Assertion failed: expected output mismatch',
      duration: Math.round(Math.random() * 500 + 50),
    });
  }

  return {
    total: totalTests,
    passed,
    failed,
    duration: tests.reduce((sum, t) => sum + t.duration, 0),
    tests,
  };
}

export { runTests };
