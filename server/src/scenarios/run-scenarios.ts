import { TEST_SCENARIOS, runScenario } from './test-scenarios.js';

async function main() {
  console.log('===============================================================');
  console.log('  RUNNING ALL VOICE AGENT VERIFICATION SCENARIOS');
  console.log('===============================================================\n');

  let passedCount = 0;
  const startTime = Date.now();

  for (const scenario of TEST_SCENARIOS) {
    console.log(`\n▶ Running [${scenario.id}] ${scenario.name}...`);
    try {
      const result = await runScenario(scenario);
      if (result.passed) {
        passedCount++;
        console.log(`✅ PASSED: ${scenario.name}`);
        // Print snippet of logs
        result.logs.slice(0, 8).forEach(l => console.log('   ', l));
        if (result.logs.length > 8) {
          console.log(`    ... and ${result.logs.length - 8} more events logged.`);
        }
      } else {
        console.error(`❌ FAILED: ${scenario.name}`);
      }
    } catch (err) {
      console.error(`❌ ERROR in ${scenario.name}:`, err);
    }
  }

  const durationMs = Date.now() - startTime;
  console.log('\n===============================================================');
  console.log(`  SCENARIOS COMPLETE: ${passedCount}/${TEST_SCENARIOS.length} Passed in ${durationMs}ms`);
  console.log('===============================================================\n');

  if (passedCount === TEST_SCENARIOS.length) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main();
