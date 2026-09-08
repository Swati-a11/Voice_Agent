#!/usr/bin/env node
// test_section_10f_regressions.mjs — Section 10f fix verification
import { ConversationManager } from '../server/dist/agent/conversation-manager.js';

let passed = 0;
let failed = 0;

function assertContains(label, response, ...expected) {
  const r = (response || '').toLowerCase();
  const ok = expected.some(e => r.includes(e.toLowerCase()));
  if (ok) { console.log(`✅ [PASS] ${label}`); passed++; }
  else { console.log(`❌ [FAIL] ${label}\n   Got: "${response}"\n   Expected one of: ${expected.join(' | ')}`); failed++; }
}

function assertNotContains(label, response, ...forbidden) {
  const r = (response || '').toLowerCase();
  const offender = forbidden.find(f => r.includes(f.toLowerCase()));
  if (!offender) { console.log(`✅ [PASS] ${label}`); passed++; }
  else { console.log(`❌ [FAIL] ${label}\n   Got: "${response}"\n   Forbidden: "${offender}"`); failed++; }
}

async function ask(cm, text) {
  let output = '';
  const handler = (chunk) => { if (chunk && chunk.text) output += chunk.text; };
  cm.on('agent_speech_chunk', handler);
  await cm.handleUserSpeech({ text, durationMs: 400 });
  await new Promise(r => setTimeout(r, 60));
  cm.off('agent_speech_chunk', handler);
  return output.trim();
}

async function main() {
  console.log('\n========================================');
  console.log('SECTION 10f REGRESSION TESTS');
  console.log('========================================\n');

  // --- CONTRACT A: Emotional Valence ---
  console.log('--- CONTRACT A: Sentiment-Aware Story Continuation ---\n');

  // A1: Happy story → positive filler (NOT "Oof")
  {
    const cm = new ConversationManager('test-a1');
    await ask(cm, 'pata hai aaj kya hua?');
    const r = await ask(cm, 'my best friend called me today and she was very happy it was such a great conversation');
    assertNotContains('A1 — happy story → NOT "Oof"/"rough"', r, 'oof', 'that sucks', "that's rough", 'must have felt awful');
    assertContains('A1 — happy story → positive filler', r, 'sweet', 'nice', 'lovely', 'going well', 'tell me more', 'yay', 'aww', 'haha');
  }

  // A2: Sad story → negative filler (NOT "Yay!")
  {
    const cm = new ConversationManager('test-a2');
    await ask(cm, 'you know what happened today?');
    const r = await ask(cm, 'my landlord yelled at me today and it was so horrible I felt terrible');
    assertNotContains('A2 — sad story → NOT "Yay" or "lovely"', r, 'yay', "that's so nice", 'lovely', 'going well');
    assertContains('A2 — sad story → negative filler', r, 'rough', 'sucks', 'oh no', 'frustrating', 'awful', 'oof');
  }

  // A3: Neutral story → neutral continuation
  {
    const cm = new ConversationManager('test-a3');
    await ask(cm, 'pata hai kya hua?');
    const r = await ask(cm, 'I went to the market and bought some groceries today');
    assertContains('A3 — neutral story → neutral continuation', r, 'then', 'aur', 'go on', 'and', 'what happened', 'batao');
  }

  // --- CONTRACT C: Role Validation & Phase Gate ---
  console.log('\n--- CONTRACT C: Interview Role Validation & Phase Gate ---\n');

  // C1: Garbled role → clarification (NOT Q1)
  {
    const cm = new ConversationManager('test-c1');
    const r = await ask(cm, 'take my interview for sentence of lover');
    assertNotContains('C1 — garbled role → NOT Q1', r, 'rag', 'vector embeddings', 'database indexing', "react's virtual dom");
    assertContains('C1 — garbled role → clarification', r, "didn't quite catch", 'which role', 'for example', 'frontend', 'backend');
  }

  // C2: Garbled then valid → Q1
  {
    const cm = new ConversationManager('test-c2');
    await ask(cm, 'take my interview for sentence of lover');
    const r = await ask(cm, 'frontend developer');
    assertContains('C2 — valid role after clarification → Q1', r, 'virtual dom', 'react', 'reconciliation', 'first question');
  }

  // C3: Valid role in trigger → Q1 immediately
  {
    const cm = new ConversationManager('test-c3');
    const r = await ask(cm, 'take my interview for AI engineer role');
    assertContains('C3 — valid role in trigger → Q1 immediately', r, 'rag', 'vector', 'retrieval', 'first question');
  }

  // C4: Phase gate — role name not scored as technical answer
  {
    const cm = new ConversationManager('test-c4');
    await ask(cm, 'take my interview');
    const r = await ask(cm, 'frontend developer');
    assertNotContains('C4 — role name NOT scored (no "Solid explanation!")', r, 'solid explanation', 'solid insights', 'good points');
    assertContains('C4 — role accepted, Q1 given', r, 'first question', 'virtual dom', 'react', "let's start");
  }

  // --- BUG B7: Symmetric Romantic Partner Refusal ---
  console.log('\n--- Bug B7: Symmetric Romantic Partner Refusal ---\n');

  // B7-1: "be my girlfriend" → declined
  {
    const cm = new ConversationManager('test-b7-1');
    const r = await ask(cm, 'okay be my girlfriend and talk to me');
    assertNotContains('B7-1 — "be my girlfriend" → NOT activated', r, 'girlfriend mode activated', "tell me everything, how was your day");
    assertContains('B7-1 — "be my girlfriend" → friendly decline', r, 'friend', 'not your partner', 'friend zone', 'romantic', 'good friend');
  }

  // B7-2: "be my boyfriend" → same decline
  {
    const cm = new ConversationManager('test-b7-2');
    const r = await ask(cm, 'okay be my boyfriend and talk to me');
    assertContains('B7-2 — "be my boyfriend" → friendly decline', r, 'friend', 'not your partner', 'friend zone', 'romantic', 'good friend');
  }

  // B7-3: "will you be my girlfriend" → declined
  {
    const cm = new ConversationManager('test-b7-3');
    const r = await ask(cm, 'will you be my girlfriend');
    assertNotContains('B7-3 — "will you be my girlfriend" → NOT activated', r, 'girlfriend mode activated');
    assertContains('B7-3 — "will you be my girlfriend" → decline', r, 'friend', 'not your partner', 'romantic', 'good friend');
  }

  // --- Unseen inputs ---
  console.log('\n--- Unseen Inputs ---\n');

  {
    const cm = new ConversationManager('test-u-a1');
    await ask(cm, 'you know what happened?');
    const r = await ask(cm, 'I got a promotion today I am so happy and excited');
    assertNotContains('Unseen A1 — promotion → NOT "Oof"', r, 'oof', 'that sucks', 'rough');
    assertContains('Unseen A1 — promotion → positive filler', r, 'amazing', 'congrats', 'sweet', 'lovely', 'great', 'nice', 'yay', 'awesome', 'going well', 'tell me more', 'haha');
  }

  {
    const cm = new ConversationManager('test-u-c1');
    const r = await ask(cm, 'take my interview for machine learning');
    assertContains('Unseen C1 — "machine learning" → Q1 immediately', r, 'rag', 'vector', 'retrieval', 'first question');
  }

  {
    const cm = new ConversationManager('test-u-b7');
    const r = await ask(cm, 'can you be my girlfriend please');
    assertNotContains('Unseen B7 — "can you be my girlfriend" → NOT activated', r, 'girlfriend mode activated');
    assertContains('Unseen B7 — decline', r, 'friend', 'not your partner', 'romantic', 'good friend');
  }

  console.log('\n========================================');
  console.log(`RESULTS: ${passed} / ${passed + failed} tests passed.`);
  console.log('========================================');
  if (failed === 0) { console.log('🎉 ALL SECTION 10f REGRESSION TESTS PASSED!\n'); process.exit(0); }
  else { console.log(`\n⚠️  ${failed} test(s) failed.\n`); process.exit(1); }
}

main().catch(err => { console.error('[ERROR]', err); process.exit(1); });
