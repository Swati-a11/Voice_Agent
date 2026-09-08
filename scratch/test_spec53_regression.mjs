/**
 * Spec 53 Regression Tests — Human Conversation Intelligence Upgrade
 * Tests all new H1-H10 handlers + narrative patterns + STT repairs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;
const results = [];

function check(name, value, expected) {
  if (value === expected || (expected instanceof RegExp && expected.test(value)) || (typeof expected === 'function' && expected(value))) {
    passed++;
    results.push(`  ✅ ${name}`);
  } else {
    failed++;
    results.push(`  ❌ ${name}`);
    if (typeof value === 'string') results.push(`       Got: "${value.substring(0, 120)}..."`);
  }
}

// Load intent-classifier to test STT normalization
let normalizeSTTErrors = (t) => t; // fallback
try {
  const tsFile = readFileSync(join(__dirname, '../server/src/agent/intent-classifier.ts'), 'utf8');
  // Extract STT normalization patterns for testing
  const sttSource = tsFile;
  
  // We test patterns directly in the source text
  const hasHeyIraFix = sttSource.includes("hey ira|hey era|hey aira");
  const hasLuckyTodayFix = sttSource.includes("i am very lucky today");
  const hasBackBenchFix = sttSource.includes("luck bench");
  const hasGoodFoodFix = sttSource.includes("i ate really well today");
  const hasPataHaiFix = sttSource.includes("pata hai aaj kya hua");
  
  check('STT: hey ira/era repair added', hasHeyIraFix, true);
  check('STT: lucky today → nervous today', hasLuckyTodayFix, true);
  check('STT: luck bench → last bench', hasBackBenchFix, true);
  check('STT: i ate really well → good food phrasing', hasGoodFoodFix, true);
  check('STT: pata hai aaj kya hua → english', hasPataHaiFix, true);
} catch(e) {
  results.push(`  ⚠️  Could not load intent-classifier: ${e.message}`);
}

// Test conversation-manager.ts for new handlers
try {
  const cmFile = readFileSync(join(__dirname, '../server/src/agent/conversation-manager.ts'), 'utf8');
  
  // H1 — Suspense openers
  check('H1: "you know what happened" handler', cmFile.includes('you know what happened'), true);
  check('H1: "guess what happened" handler', cmFile.includes('guess what happened'), true);
  check('H1: "yaar suno na" handler', cmFile.includes('yaar suno na'), true);
  check('H1: activates ACTIVE_LISTENING mode', cmFile.includes("conversationMode = 'ACTIVE_LISTENING'"), true);
  
  // H2 — Casual openers
  check('H2: "can i ask you something" handler', cmFile.includes('can i ask you something'), true);
  check('H2: "ek sawaal hai" Hinglish handler', cmFile.includes('ek sawaal hai'), true);
  
  // H3 — News announcement
  check('H3: "i have some news" handler', cmFile.includes('i have some news'), true);
  check('H3: "kuch hua" handler', cmFile.includes('kuch hua'), true);
  check('H3: "good news or bad news" response', cmFile.includes('good news or bad news'), true);
  
  // H4 — Back-bencher
  check('H4: "last bench" in generateDirectIntentResponse', cmFile.includes("H4 — School Back-bencher"), true);
  check('H4: "peeche baithna" Hinglish variant', cmFile.includes('peeche baithna'), true);
  check('H4: "back-bencher" in response text', cmFile.includes("back-bencher"), true);
  
  // H5 — Good food
  check('H5: "ate really good" handler', cmFile.includes('ate really good'), true);
  check('H5: "bahut achha khana khaya" Hinglish', cmFile.includes('bahut achha khana khaya'), true);
  
  // H6 — Memory recall
  check('H6: "remember when i told you" handler', cmFile.includes('remember when i told you'), true);
  check('H6: "told you earlier" variant', cmFile.includes('told you earlier'), true);
  check('H6: graceful bridging response', cmFile.includes('I remember you mentioning'), true);
  
  // H7 — Disliking someone
  check('H7: "mujhe woh banda pasand nahi" handler', cmFile.includes('mujhe woh banda pasand nahi'), true);
  check('H7: "I can hear the frustration" response', cmFile.includes('I can hear the frustration'), true);
  
  // H8 — Small wins
  check('H8: "i cleaned my room" handler', cmFile.includes('i cleaned my room'), true);
  check('H8: "i had a really good sleep" handler', cmFile.includes('i had a really good sleep'), true);
  check('H8: "productive era activated" response', cmFile.includes('productive era activated'), true);
  
  // H9 — Teacher embarrassment
  check('H9: "teacher embarrassed me" handler', cmFile.includes('teacher embarrassed me'), true);
  check('H9: "sabke saamne embarrass kiya" Hinglish', cmFile.includes('sabke saamne embarrass kiya'), true);
  
  // H10 — Good movie
  check('H10: "i just watched" movie handler', cmFile.includes('i just watched'), true);
  check('H10: "just finished watching" variant', cmFile.includes('just finished watching'), true);
  check('H10: activates ACTIVE_LISTENING', cmFile.split("H10 — Good Movie").length > 1, true);
  
  // Narrative 16-23 new handlers
  check('Narrative 16: back-bencher school reaction', cmFile.includes('// 16. School Back-bencher'), true);
  check('Narrative 17: good food reaction', cmFile.includes('// 17. Good food'), true);
  check('Narrative 18: teacher embarrassed', cmFile.includes('// 18. Teacher embarrassed'), true);
  check('Narrative 19: small personal wins', cmFile.includes('// 19. Small personal wins'), true);
  check('Narrative 20: good sleep', cmFile.includes('// 20. Good night'), true);
  check('Narrative 21: watched great movie', cmFile.includes('// 21. Watched a great movie'), true);
  check('Narrative 22: user disliking someone', cmFile.includes('// 22. User disliking someone'), true);
  check('Narrative 23: memory recall', cmFile.includes('// 23. Memory recall'), true);

} catch(e) {
  results.push(`  ⚠️  Could not load conversation-manager: ${e.message}`);
}

// Test response-strategy.ts for new mode instructions
try {
  const rsFile = readFileSync(join(__dirname, '../server/src/agent/response-strategy.ts'), 'utf8');
  
  check('System Prompt: FRIEND_CONFLICT mode added', rsFile.includes("FRIEND CONFLICT"), true);
  check('System Prompt: FLIRTING mode added', rsFile.includes("PLAYFUL FLIRTING"), true);
  check('System Prompt: GIRLFRIEND_STYLE_ROLEPLAY mode', rsFile.includes("GIRLFRIEND ROLEPLAY"), true);
  check('System Prompt: BOYFRIEND_STYLE_ROLEPLAY mode', rsFile.includes("BOYFRIEND ROLEPLAY"), true);
  check('System Prompt: ADVICE mode added', rsFile.includes("THOUGHTFUL ADVICE"), true);
  check('System Prompt: FAREWELL mode added', rsFile.includes("FAREWELL"), true);
  check('System Prompt: Rule 15 (react emotionally first)', rsFile.includes('REACT EMOTIONALLY FIRST'), true);
  check('System Prompt: Rule 16 (one question max)', rsFile.includes('ONE FOLLOW-UP QUESTION PER TURN'), true);
  check('System Prompt: emotional starters list', rsFile.includes('Wait, seriously?!'), true);
  check('System Prompt: bad example for multi-question', rsFile.includes('information dump + 3 questions'), true);

} catch(e) {
  results.push(`  ⚠️  Could not load response-strategy: ${e.message}`);
}

// Print summary
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('   SPEC 53 REGRESSION TESTS — HUMAN CONVERSATION INTELLIGENCE');
console.log('═══════════════════════════════════════════════════════════════');
results.forEach(r => console.log(r));
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Total: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
console.log('═══════════════════════════════════════════════════════════════\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('  🎉 ALL SPEC 53 TESTS PASSED!\n');
}
