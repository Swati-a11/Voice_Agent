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

async function runDirectActionTests() {
  console.log('=============================================================');
  console.log('🚀 TESTING DIRECT ACTION REQUESTS & CONTEXTUAL INTENT ROUTING');
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

  // -------------------------------------------------------------
  // Test 1: Unit Intent Classifier Tests
  // -------------------------------------------------------------
  console.log('--- 1. Intent Classification Tests ---');
  
  const c1 = IntentClassifier.classifyDetailed('say all the best to me');
  assert(c1.intent === 'good_wish', 'Intent "say all the best to me" -> good_wish', c1.intent);

  const c2 = IntentClassifier.classifyDetailed('wish me luck');
  assert(c2.intent === 'good_wish', 'Intent "wish me luck" -> good_wish', c2.intent);

  const c3 = IntentClassifier.classifyDetailed('say something nice to me');
  assert(c3.intent === 'positive_reassurance', 'Intent "say something nice to me" -> positive_reassurance', c3.intent);

  const c4 = IntentClassifier.classifyDetailed('motivate me');
  assert(c4.intent === 'motivation', 'Intent "motivate me" -> motivation', c4.intent);

  const c5 = IntentClassifier.classifyDetailed('tell me a joke');
  assert(c5.intent === 'joke_request', 'Intent "tell me a joke" -> joke_request', c5.intent);

  const c6 = IntentClassifier.classifyDetailed('say happy birthday to me');
  assert(c6.intent === 'celebration', 'Intent "say happy birthday to me" -> celebration', c6.intent);

  const c7 = IntentClassifier.classifyDetailed('who build you');
  assert(c7.sttNormalizedText.includes('who built you'), 'STT repair "who build you" -> "who built you"', c7.sttNormalizedText);

  const c8 = IntentClassifier.classifyDetailed('who make you');
  assert(c8.sttNormalizedText.includes('who made you'), 'STT repair "who make you" -> "who made you"', c8.sttNormalizedText);

  const c9 = IntentClassifier.classifyDetailed('what you doing');
  assert(c9.sttNormalizedText.includes('what are you doing'), 'STT repair "what you doing" -> "what are you doing"', c9.sttNormalizedText);

  const c10 = IntentClassifier.classifyDetailed('stop stop');
  assert(c10.intent === 'stop', 'Intent "stop stop" -> stop', c10.intent);

  const c11 = IntentClassifier.classifyDetailed('okay bye');
  assert(c11.intent === 'goodbye', 'Intent "okay bye" -> goodbye', c11.intent);

  // -------------------------------------------------------------
  // Test 2: Full End-to-End Conversation Manager Direct Responses
  // -------------------------------------------------------------
  console.log('\n--- 2. End-to-End Conversation Manager Responses ---');
  const cm = new ConversationManager({ userId: 'test-user-direct-actions' });

  // Single Direct Request 1: "say all the best to me"
  const r1 = await ask(cm, 'say all the best to me');
  console.log('User: "say all the best to me" -> Ayra:', r1);
  assert(
    (r1.toLowerCase().includes('all the best') || r1.toLowerCase().includes('got this')) &&
    !r1.includes('Acha, I see! Is baare mein aur kya soch rahe ho?'),
    'Direct action "say all the best to me" returns encouragement and NO generic fallback',
    r1
  );

  // Single Direct Request 2: "wish me luck"
  const r2 = await ask(cm, 'wish me luck');
  console.log('User: "wish me luck" -> Ayra:', r2);
  assert(
    r2.toLowerCase().includes('all the best') || r2.toLowerCase().includes('got this') || r2.toLowerCase().includes('good luck'),
    'Direct action "wish me luck" returns good wish',
    r2
  );

  // Single Direct Request 3: "say something nice to me"
  const r3 = await ask(cm, 'say something nice to me');
  console.log('User: "say something nice to me" -> Ayra:', r3);
  assert(
    r3.toLowerCase().includes('awesome') || r3.toLowerCase().includes('amazing') || r3.toLowerCase().includes('thoughtful'),
    'Direct action "say something nice to me" returns positive reassurance',
    r3
  );

  // Single Direct Request 4: "motivate me"
  const r4 = await ask(cm, 'motivate me');
  console.log('User: "motivate me" -> Ayra:', r4);
  assert(
    r4.toLowerCase().includes('potential') || r4.toLowerCase().includes('push forward') || r4.toLowerCase().includes('capable'),
    'Direct action "motivate me" returns motivation',
    r4
  );

  // Single Direct Request 5: "say happy birthday to me"
  const r5 = await ask(cm, 'say happy birthday to me');
  console.log('User: "say happy birthday to me" -> Ayra:', r5);
  assert(
    r5.toLowerCase().includes('happy birthday'),
    'Direct action "say happy birthday to me" returns birthday celebration',
    r5
  );

  // Single Direct Request 6: "who build you"
  const r6 = await ask(cm, 'who build you');
  console.log('User: "who build you" -> Ayra:', r6);
  assert(
    r6.toLowerCase().includes('swati'),
    'Imperfect STT "who build you" returns identity "built by Swati"',
    r6
  );

  // Single Direct Request 7: "who make you"
  const r7 = await ask(cm, 'who make you');
  console.log('User: "who make you" -> Ayra:', r7);
  assert(
    r7.toLowerCase().includes('swati'),
    'Imperfect STT "who make you" returns identity "built by Swati"',
    r7
  );

  // Single Direct Request 8: "what you doing"
  const r8 = await ask(cm, 'what you doing');
  console.log('User: "what you doing" -> Ayra:', r8);
  assert(
    r8.toLowerCase().includes('hanging out') || r8.toLowerCase().includes('up to'),
    'Imperfect STT "what you doing" returns casual chat status',
    r8
  );

  // Single Direct Request 9: "tell me something about human brain"
  const r9 = await ask(cm, 'tell me something about human brain');
  console.log('User: "tell me something about human brain" -> Ayra:', r9);
  assert(
    r9.toLowerCase().includes('brain') || r9.toLowerCase().includes('controls') || r9.toLowerCase().includes('memory'),
    'Broad science question "tell me something about human brain" gives brain overview without asking probing clarification',
    r9
  );

  // Single Direct Request 10: "tell me something about stars"
  const r10 = await ask(cm, 'tell me something about stars');
  console.log('User: "tell me something about stars" -> Ayra:', r10);
  assert(
    r10.toLowerCase().includes('plasma') || r10.toLowerCase().includes('fusion') || r10.toLowerCase().includes('sun') || r10.toLowerCase().includes('milky way'),
    'Broad science question "tell me something about stars" gives astronomy overview',
    r10
  );

  // -------------------------------------------------------------
  // Test 3: Multi-turn Contextual Resume Release Session
  // -------------------------------------------------------------
  console.log('\n--- 3. Multi-Turn Contextual Resume Release Session ---');
  const cmContext = new ConversationManager({ userId: 'test-user-contextual-resume' });

  const turn1 = await ask(cmContext, 'I am very stressed out today');
  console.log('User: "I am very stressed out today" -> Ayra:', turn1);

  const turn2 = await ask(cmContext, 'actually my resume');
  console.log('User: "actually my resume" -> Ayra:', turn2);

  const turn3 = await ask(cmContext, 'is going to release today');
  console.log('User: "is going to release today" -> Ayra:', turn3);

  const turn4 = await ask(cmContext, 'say all the best to me');
  console.log('User: "say all the best to me" -> Ayra:', turn4);

  assert(
    (turn4.toLowerCase().includes('all the best') || turn4.toLowerCase().includes('got this')) &&
    (turn4.toLowerCase().includes('work') || turn4.toLowerCase().includes('resume') || turn4.toLowerCase().includes('shot') || turn4.toLowerCase().includes('crush')) &&
    !turn4.includes('Acha, I see! Is baare mein aur kya soch rahe ho?'),
    'Contextual GOOD_WISH after resume stress session returns natural encouragement with contextual touch and NO generic fallback',
    turn4
  );

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed} / ${total} tests passed.`);
  console.log(`========================================`);

  if (passed === total) {
    console.log('🎉 ALL DIRECT ACTION REGRESSION TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME REGRESSION TESTS FAILED');
    process.exit(1);
  }
}

runDirectActionTests().catch((err) => {
  console.error('Error running direct action regression tests:', err);
  process.exit(1);
});
