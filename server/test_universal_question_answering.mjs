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

async function runUniversalQAQuestionTests() {
  console.log('=============================================================');
  console.log('🚀 TESTING UNIVERSAL QUESTION ANSWERING & CURRENT NEWS ROUTING');
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

  const cm = new ConversationManager({ userId: 'test-universal-qa-user' });

  // 1. "what is Gemini?"
  const r1 = await ask(cm, 'what is Gemini?');
  console.log('User: "what is Gemini?" -> Ayra:', r1);
  assert(
    (r1.toLowerCase().includes('gemini') || r1.toLowerCase().includes('google') || r1.toLowerCase().includes('multimodal')) &&
    !r1.includes('is a fascinating subject') && !r1.includes('Tell me what specific part'),
    '1. "what is Gemini?" gives actual Gemini explanation',
    r1
  );

  // 2. "tell me something about Gemini"
  const r2 = await ask(cm, 'tell me something about Gemini');
  console.log('User: "tell me something about Gemini" -> Ayra:', r2);
  assert(
    (r2.toLowerCase().includes('gemini') || r2.toLowerCase().includes('google') || r2.toLowerCase().includes('multimodal')) &&
    !r2.includes('is a fascinating subject') && !r2.includes('Is baare mein aur kya soch rahe ho'),
    '2. "tell me something about Gemini" gives actual Gemini explanation',
    r2
  );

  // 3. "tell me about DSA"
  const r3 = await ask(cm, 'tell me about DSA');
  console.log('User: "tell me about DSA" -> Ayra:', r3);
  assert(
    (r3.toLowerCase().includes('data structures') || r3.toLowerCase().includes('algorithms') || r3.toLowerCase().includes('dsa')) &&
    !r3.includes('is a fascinating subject') && !r3.includes('Is baare mein aur kya soch rahe ho'),
    '3. "tell me about DSA" gives actual DSA explanation',
    r3
  );

  // 4. "what is DSA?"
  const r4 = await ask(cm, 'what is DSA?');
  console.log('User: "what is DSA?" -> Ayra:', r4);
  assert(
    (r4.toLowerCase().includes('data structures') || r4.toLowerCase().includes('algorithms') || r4.toLowerCase().includes('dsa')) &&
    !r4.includes('is a fascinating subject'),
    '4. "what is DSA?" gives actual DSA definition',
    r4
  );

  // 5. "what is JavaScript?"
  const r5 = await ask(cm, 'what is JavaScript?');
  console.log('User: "what is JavaScript?" -> Ayra:', r5);
  assert(
    (r5.toLowerCase().includes('javascript') || r5.toLowerCase().includes('web') || r5.toLowerCase().includes('event loop') || r5.toLowerCase().includes('programming language')),
    '5. "what is JavaScript?" gives actual JavaScript definition',
    r5
  );

  // 6. "what is React?"
  const r6 = await ask(cm, 'what is React?');
  console.log('User: "what is React?" -> Ayra:', r6);
  assert(
    (r6.toLowerCase().includes('react') || r6.toLowerCase().includes('library') || r6.toLowerCase().includes('user interfaces') || r6.toLowerCase().includes('virtual dom')),
    '6. "what is React?" gives actual React definition',
    r6
  );

  // 7. "what is Next.js?"
  const r7 = await ask(cm, 'what is Next.js?');
  console.log('User: "what is Next.js?" -> Ayra:', r7);
  assert(
    (r7.toLowerCase().includes('next.js') || r7.toLowerCase().includes('react') || r7.toLowerCase().includes('vercel') || r7.toLowerCase().includes('framework')),
    '7. "what is Next.js?" gives actual Next.js definition',
    r7
  );

  // 8. "what is React Native?"
  const r8 = await ask(cm, 'what is React Native?');
  console.log('User: "what is React Native?" -> Ayra:', r8);
  assert(
    (r8.toLowerCase().includes('react native') || r8.toLowerCase().includes('mobile') || r8.toLowerCase().includes('ios') || r8.toLowerCase().includes('android')),
    '8. "what is React Native?" gives actual React Native definition',
    r8
  );

  // 9. "what is RAG?"
  const r9 = await ask(cm, 'what is RAG?');
  console.log('User: "what is RAG?" -> Ayra:', r9);
  assert(
    (r9.toLowerCase().includes('retrieval') || r9.toLowerCase().includes('rag') || r9.toLowerCase().includes('vector')),
    '9. "what is RAG?" gives actual RAG definition',
    r9
  );

  // 10. "what is a door?"
  const r10 = await ask(cm, 'what is a door?');
  console.log('User: "what is a door?" -> Ayra:', r10);
  assert(
    (r10.toLowerCase().includes('door') || r10.toLowerCase().includes('barrier') || r10.toLowerCase().includes('entrance')),
    '10. "what is a door?" gives actual door definition',
    r10
  );

  // 11. "what is a bell?"
  const r11 = await ask(cm, 'what is a bell?');
  console.log('User: "what is a bell?" -> Ayra:', r11);
  assert(
    (r11.toLowerCase().includes('bell') || r11.toLowerCase().includes('ringing') || r11.toLowerCase().includes('sound') || r11.toLowerCase().includes('acoustic')),
    '11. "what is a bell?" gives actual bell definition',
    r11
  );

  // 12. "what is AC?"
  const r12 = await ask(cm, 'what is AC?');
  console.log('User: "what is AC?" -> Ayra:', r12);
  assert(
    (r12.toLowerCase().includes('air conditioning') || r12.toLowerCase().includes('cools') || r12.toLowerCase().includes('indoor')),
    '12. "what is AC?" gives actual air-conditioner definition',
    r12
  );

  // 13. "tell me about AC"
  const r13 = await ask(cm, 'tell me about AC');
  console.log('User: "tell me about AC" -> Ayra:', r13);
  assert(
    (r13.toLowerCase().includes('air conditioning') || r13.toLowerCase().includes('cools') || r13.toLowerCase().includes('indoor')),
    '13. "tell me about AC" gives actual AC explanation',
    r13
  );

  // 14. "what is the moon?"
  const r14 = await ask(cm, 'what is the moon?');
  console.log('User: "what is the moon?" -> Ayra:', r14);
  assert(
    (r14.toLowerCase().includes('moon') || r14.toLowerCase().includes('satellite') || r14.toLowerCase().includes('tides')),
    '14. "what is the moon?" gives actual moon explanation',
    r14
  );

  // 15. "what are stars?"
  const r15 = await ask(cm, 'what are stars?');
  console.log('User: "what are stars?" -> Ayra:', r15);
  assert(
    (r15.toLowerCase().includes('stars') || r15.toLowerCase().includes('plasma') || r15.toLowerCase().includes('fusion') || r15.toLowerCase().includes('sun')),
    '15. "what are stars?" gives actual star explanation',
    r15
  );

  // 16. "what is happening in the world right now?"
  const c16 = IntentClassifier.classifyDetailed('what is happening in the world right now?');
  assert(
    c16.isCurrentInformation === true && c16.requiresWebSearch === true,
    '16. "what is happening in the world right now?" routes to current-information & web search',
    `isCurrentInfo: ${c16.isCurrentInformation}`
  );

  // 17. "what is happening in technology right now?"
  const c17 = IntentClassifier.classifyDetailed('what is happening in technology right now?');
  assert(
    c17.isCurrentInformation === true && c17.requiresWebSearch === true,
    '17. "what is happening in technology right now?" routes to current-information & web search',
    `isCurrentInfo: ${c17.isCurrentInformation}`
  );

  // 18. "what happened today?"
  const c18 = IntentClassifier.classifyDetailed('what happened today?');
  assert(
    c18.isCurrentInformation === true && c18.requiresWebSearch === true,
    '18. "what happened today?" routes to current-information & web search',
    `isCurrentInfo: ${c18.isCurrentInformation}`
  );

  // 19. "give me five news"
  const c19 = IntentClassifier.classifyDetailed('give me five news');
  assert(
    c19.isCurrentInformation === true && c19.requiresWebSearch === true,
    '19. "give me five news" routes to current-information & web search',
    `isCurrentInfo: ${c19.isCurrentInformation}`
  );

  // 20. "tell me today's AI news"
  const c20 = IntentClassifier.classifyDetailed("tell me today's AI news");
  assert(
    c20.isCurrentInformation === true && c20.requiresWebSearch === true,
    '20. "tell me today\'s AI news" routes to current-information & web search',
    `isCurrentInfo: ${c20.isCurrentInformation}`
  );

  // 21. "wish me luck"
  const r21 = await ask(cm, 'wish me luck');
  console.log('User: "wish me luck" -> Ayra:', r21);
  assert(
    (r21.toLowerCase().includes('all the best') || r21.toLowerCase().includes('got this') || r21.toLowerCase().includes('good luck')),
    '21. "wish me luck" returns good-wish response',
    r21
  );

  // 22. "motivate me"
  const r22 = await ask(cm, 'motivate me');
  console.log('User: "motivate me" -> Ayra:', r22);
  assert(
    (r22.toLowerCase().includes('potential') || r22.toLowerCase().includes('capable') || r22.toLowerCase().includes('push forward')),
    '22. "motivate me" returns motivation response',
    r22
  );

  // 23. "stop"
  const isStop = IntentClassifier.isExplicitStopCommand('stop');
  assert(
    isStop === true,
    '23. "stop" triggers immediate STOP',
    isStop
  );

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed} / ${total} tests passed.`);
  console.log(`========================================`);

  if (passed === total) {
    console.log('🎉 ALL UNIVERSAL QUESTION ANSWERING TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

runUniversalQAQuestionTests().catch((err) => {
  console.error('Error running universal QA tests:', err);
  process.exit(1);
});
