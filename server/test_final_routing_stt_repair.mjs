import { ConversationManager } from './dist/agent/conversation-manager.js';
import { IntentClassifier } from './dist/agent/intent-classifier.js';

async function ask(cm, text) {
  let output = '';
  const handler = (chunk) => {
    if (chunk && chunk.text) output += chunk.text;
  };
  cm.on('agent_speech_chunk', handler);
  await cm.handleUserSpeech({ text, durationMs: 400 });
  await new Promise((r) => setTimeout(r, 60));
  cm.off('agent_speech_chunk', handler);
  return output.trim();
}

async function runFinalRoutingTests() {
  console.log('=============================================================');
  console.log('🚀 TESTING FINAL ROUTING, BROAD INFORMATION & STT REPAIRS');
  console.log('=============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, name, actual) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}\n   Actual output: "${actual}"`);
    }
  }

  const cm = new ConversationManager({ userId: 'test-final-routing-user' });

  // -------------------------------------------------------------
  // TEST 1: "tell me something about GPT"
  // Expected: Direct useful explanation, NO clarification question
  // -------------------------------------------------------------
  const r1 = await ask(cm, 'tell me something about GPT');
  console.log('TEST 1: "tell me something about GPT" -> Ayra:', r1);
  assert(
    (r1.toLowerCase().includes('generative pre-trained transformer') || r1.toLowerCase().includes('openai') || r1.toLowerCase().includes('neural network') || r1.toLowerCase().includes('language model')) &&
    !r1.includes('Tell me what specific part you\'re curious about') &&
    !r1.includes('Acha, I see! Is baare mein aur kya soch rahe ho?'),
    'TEST 1: "tell me something about GPT" gives direct explanation without probing clarification',
    r1
  );

  // -------------------------------------------------------------
  // TEST 2: "tell me about ChatGPT"
  // Expected: Direct useful explanation, NO generic clarification
  // -------------------------------------------------------------
  const r2 = await ask(cm, 'tell me about ChatGPT');
  console.log('TEST 2: "tell me about ChatGPT" -> Ayra:', r2);
  assert(
    (r2.toLowerCase().includes('chatgpt') || r2.toLowerCase().includes('conversational ai') || r2.toLowerCase().includes('openai')) &&
    !r2.includes('Chat GPT is a great topic! Tell me what specific part'),
    'TEST 2: "tell me about ChatGPT" gives direct explanation',
    r2
  );

  // -------------------------------------------------------------
  // TEST 3: "tell me about AI"
  // Expected: Direct useful explanation, NO generic clarification
  // -------------------------------------------------------------
  const r3 = await ask(cm, 'tell me about AI');
  console.log('TEST 3: "tell me about AI" -> Ayra:', r3);
  assert(
    (r3.toLowerCase().includes('artificial intelligence') || r3.toLowerCase().includes('machine learning') || r3.toLowerCase().includes('human intelligence')) &&
    !r3.includes('AI is a great topic! Tell me what specific part'),
    'TEST 3: "tell me about AI" gives direct explanation',
    r3
  );

  // -------------------------------------------------------------
  // TEST 4: "wish me birthday"
  // Expected: Birthday wish, NO fallback
  // -------------------------------------------------------------
  const r4 = await ask(cm, 'wish me birthday');
  console.log('TEST 4: "wish me birthday" -> Ayra:', r4);
  assert(
    r4.toLowerCase().includes('happy birthday') &&
    !r4.includes('Acha, I see! Is baare mein aur kya soch rahe ho?'),
    'TEST 4: Elliptical "wish me birthday" gives birthday celebration wish',
    r4
  );

  // -------------------------------------------------------------
  // TEST 5: "wish me happy birthday"
  // Expected: Birthday wish
  // -------------------------------------------------------------
  const r5 = await ask(cm, 'wish me happy birthday');
  console.log('TEST 5: "wish me happy birthday" -> Ayra:', r5);
  assert(
    r5.toLowerCase().includes('happy birthday'),
    'TEST 5: "wish me happy birthday" gives birthday wish',
    r5
  );

  // -------------------------------------------------------------
  // TEST 6: "wish me luck"
  // Expected: Good luck response
  // -------------------------------------------------------------
  const r6 = await ask(cm, 'wish me luck');
  console.log('TEST 6: "wish me luck" -> Ayra:', r6);
  assert(
    r6.toLowerCase().includes('all the best') || r6.toLowerCase().includes('got this') || r6.toLowerCase().includes('best of luck'),
    'TEST 6: "wish me luck" gives good wishes',
    r6
  );

  // -------------------------------------------------------------
  // TEST 7: "tell me about RAG"
  // Expected: Direct RAG explanation
  // -------------------------------------------------------------
  const r7 = await ask(cm, 'tell me about RAG');
  console.log('TEST 7: "tell me about RAG" -> Ayra:', r7);
  assert(
    (r7.toLowerCase().includes('retrieval') || r7.toLowerCase().includes('vector') || r7.toLowerCase().includes('database') || r7.toLowerCase().includes('context')),
    'TEST 7: "tell me about RAG" gives direct RAG explanation',
    r7
  );

  // -------------------------------------------------------------
  // TEST 8: "Red r a g"
  // Expected: Recovers RAG if confidence high, NOT color red
  // -------------------------------------------------------------
  const r8 = await ask(cm, 'Red r a g');
  console.log('TEST 8: "Red r a g" -> Ayra:', r8);
  assert(
    (r8.toLowerCase().includes('retrieval') || r8.toLowerCase().includes('rag') || r8.toLowerCase().includes('vector') || r8.toLowerCase().includes('hallucination')) &&
    !r8.toLowerCase().includes('color red is a primary color'),
    'TEST 8: Spoken "Red r a g" is STT repaired to RAG (not color red)',
    r8
  );

  // -------------------------------------------------------------
  // TEST 9: "R A G"
  // Expected: Recognizes RAG
  // -------------------------------------------------------------
  const r9 = await ask(cm, 'R A G');
  console.log('TEST 9: "R A G" -> Ayra:', r9);
  assert(
    (r9.toLowerCase().includes('retrieval') || r9.toLowerCase().includes('rag') || r9.toLowerCase().includes('vector')),
    'TEST 9: Spoken letter sequence "R A G" recognizes RAG',
    r9
  );

  // -------------------------------------------------------------
  // TEST 10: "tell me about red"
  // Expected: Do NOT automatically convert to RAG (keeps color red)
  // -------------------------------------------------------------
  const r10 = await ask(cm, 'tell me about red');
  console.log('TEST 10: "tell me about red" -> Ayra:', r10);
  assert(
    r10.toLowerCase().includes('red') && !r10.toLowerCase().includes('retrieval-augmented generation'),
    'TEST 10: "tell me about red" does NOT over-correct to RAG',
    r10
  );

  // -------------------------------------------------------------
  // TEST 11: "stock tell me about rack"
  // Expected: Short targeted clarification, NEVER generic fallback
  // -------------------------------------------------------------
  const r11 = await ask(cm, 'stock tell me about rack');
  console.log('TEST 11: "stock tell me about rack" -> Ayra:', r11);
  assert(
    (r11.toLowerCase().includes('rag') || r11.toLowerCase().includes('stock')) &&
    !r11.includes('Acha, I see! Is baare mein aur kya soch rahe ho?'),
    'TEST 11: Ambiguous "stock tell me about rack" asks short targeted clarification, NO generic fallback',
    r11
  );

  // -------------------------------------------------------------
  // TEST 12: "tell me something about human brain"
  // Expected: Direct interesting explanation
  // -------------------------------------------------------------
  const r12 = await ask(cm, 'tell me something about human brain');
  console.log('TEST 12: "tell me something about human brain" -> Ayra:', r12);
  assert(
    (r12.toLowerCase().includes('brain') || r12.toLowerCase().includes('controls') || r12.toLowerCase().includes('memory')),
    'TEST 12: "tell me something about human brain" gives direct interesting explanation',
    r12
  );

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed} / ${total} tests passed.`);
  console.log(`========================================`);

  if (passed === total) {
    console.log('🎉 ALL FINAL ROUTING & STT REPAIR TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

runFinalRoutingTests().catch((err) => {
  console.error('Error running final routing tests:', err);
  process.exit(1);
});
