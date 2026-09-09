#!/usr/bin/env node
// test_stt_understanding_regressions.mjs — Verification of Section 17 STT tests & fallback fixes

import { ConversationManager } from './dist/agent/conversation-manager.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('==================================================');
  console.log('RUNNING AYRA STT UNDERSTANDING REGRESSION TESTS');
  console.log('==================================================\n');

  const manager = new ConversationManager('test-user-stt');

  let lastAgentText = '';
  manager.on('agent_speech_chunk', (chunk) => {
    lastAgentText += (chunk.text || '') + ' ';
  });

  async function getResponse(text) {
    lastAgentText = '';
    await manager.handleUserSpeech({ text, durationMs: 1000 });
    await new Promise(r => setTimeout(r, 250));
    return lastAgentText.trim();
  }

  // TEST 1: "you are very smart"
  console.log('--- TEST 1: "you are very smart" ---');
  const res1 = await getResponse("you are very smart");
  const isSpeechFallback1 = /missed that|clear nahi sunayi|broke up|didn't catch|voice thodi/i.test(res1);
  assert(!isSpeechFallback1, `Must NOT trigger speech fallback for "you are very smart". Got: "${res1}"`);
  assert(/compliment|thank you|math|smart/i.test(res1), `Response should acknowledge compliment naturally. Got: "${res1}"`);

  // TEST 2: "who build you"
  console.log('\n--- TEST 2: "who build you" ---');
  const res2 = await getResponse("who build you");
  const isSpeechFallback2 = /missed that|clear nahi sunayi|broke up|didn't catch|voice thodi/i.test(res2);
  assert(!isSpeechFallback2, `Must NOT trigger speech fallback for "who build you". Got: "${res2}"`);
  assert(/swati/i.test(res2), `Response should state Swati built Ayra. Got: "${res2}"`);

  // TEST 3: "tell me something about human brain"
  console.log('\n--- TEST 3: "tell me something about human brain" ---');
  const res3 = await getResponse("tell me something about human brain");
  const isSpeechFallback3 = /missed that|clear nahi sunayi|broke up|didn't catch|voice thodi/i.test(res3);
  assert(!isSpeechFallback3, `Must NOT trigger speech fallback for "tell me something about human brain". Got: "${res3}"`);
  assert(/brain|controls|movement|memory|emotions|organ/i.test(res3), `Response should provide brain information first. Got: "${res3}"`);

  // TEST 4: "tell me about stars"
  console.log('\n--- TEST 4: "tell me about stars" ---');
  const res4 = await getResponse("tell me about stars");
  const isSpeechFallback4 = /missed that|clear nahi sunayi|broke up|didn't catch|voice thodi/i.test(res4);
  assert(!isSpeechFallback4, `Must NOT trigger speech fallback for "tell me about stars". Got: "${res4}"`);
  assert(/star|plasma|gravity|fusion|sun/i.test(res4), `Response should explain stars naturally. Got: "${res4}"`);

  // TEST 5: "what you doing"
  console.log('\n--- TEST 5: "what you doing" ---');
  const res5 = await getResponse("what you doing");
  const isSpeechFallback5 = /missed that|clear nahi sunayi|broke up|didn't catch|voice thodi/i.test(res5);
  assert(!isSpeechFallback5, `Must NOT trigger speech fallback for "what you doing". Got: "${res5}"`);
  assert(/hanging|talking|khas|baat|doing/i.test(res5), `Response should respond casually. Got: "${res5}"`);

  // TEST 6: "who make you"
  console.log('\n--- TEST 6: "who make you" ---');
  const res6 = await getResponse("who make you");
  const isSpeechFallback6 = /missed that|clear nahi sunayi|broke up|didn't catch|voice thodi/i.test(res6);
  assert(!isSpeechFallback6, `Must NOT trigger speech fallback for "who make you". Got: "${res6}"`);
  assert(/swati/i.test(res6), `Response should state Swati built Ayra. Got: "${res6}"`);

  // TEST 7: "main stressed hoon because mere paas good projects nahi hai"
  console.log('\n--- TEST 7: "main stressed hoon because mere paas good projects nahi hai" ---');
  const res7 = await getResponse("main stressed hoon because mere paas good projects nahi hai");
  const isGenericCollege = /college ka kuch scene/i.test(res7);
  assert(!isGenericCollege, `Must NOT give generic college question for project stress. Got: "${res7}"`);
  assert(/stress|project|referral|domain|roles/i.test(res7), `Response should empathetically address referral/project stress. Got: "${res7}"`);

  // TEST 8: "nahi hai"
  console.log('\n--- TEST 8: "nahi hai" ---');
  const res8 = await getResponse("nahi hai");
  const inventedEmotion = /tired|thak|sad|udaas|sleepy|neend/i.test(res8);
  assert(!inventedEmotion, `Must NOT invent tiredness/sadness/sleepiness for "nahi hai". Got: "${res8}"`);
  assert(/kya nahi|what isn't/i.test(res8), `Response should ask clean clarification ("Haan? Kya nahi hai?"). Got: "${res8}"`);

  // TEST 9: "okay bye"
  console.log('\n--- TEST 9: "okay bye" ---');
  const res9 = await getResponse("okay bye");
  assert(/bye|take care/i.test(res9), `Response should be fast goodbye. Got: "${res9}"`);
  assert(!res9.includes('?'), `Goodbye must NOT end in a trailing question. Got: "${res9}"`);

  // TEST 10: "STOP"
  console.log('\n--- TEST 10: "STOP" ---');
  const res10 = await getResponse("STOP");
  assert(/stopping|listening/i.test(res10), `STOP should give quick acknowledgement. Got: "${res10}"`);

  console.log('\n==================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
