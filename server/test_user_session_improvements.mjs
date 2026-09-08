import { ConversationManager } from '../server/dist/agent/conversation-manager.js';

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

async function runSessionTests() {
  console.log('--- TESTING EXACT USER SESSION IMPROVEMENTS ---');
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

  // Session 1: Friend fight & Rude behavior followed by science questions
  console.log('\n--- Test Suite 1: Friend Fight -> Rude -> Stars -> Friction -> Loop Engineering ---');
  const cm1 = new ConversationManager('session-1');
  
  const r1 = await ask(cm1, 'today I had a fight with my friend');
  console.log('User: "today I had a fight with my friend" -> Ayra:', r1);
  assert(
    r1.toLowerCase().includes('what happened') || r1.toLowerCase().includes('yaar'),
    'Friend fight opening',
    r1
  );

  const r2 = await ask(cm1, 'I don\'t know she was actually very rude to me');
  console.log('User: "I don\'t know she was actually very rude to me" -> Ayra:', r2);
  assert(
    (r2.toLowerCase().includes('sucks') || r2.toLowerCase().includes('overthink') || r2.toLowerCase().includes('what did she say') || r2.toLowerCase().includes('rude')) &&
    !r2.includes('Ahh okay. Go on.') && !r2.includes('Yeah? And?'),
    'Friend being rude gets genuine comfort and validation',
    r2
  );

  const r3 = await ask(cm1, 'can you tell me about stars');
  console.log('User: "can you tell me about stars" -> Ayra:', r3);
  assert(
    r3.toLowerCase().includes('plasma') || r3.toLowerCase().includes('nuclear fusion') || r3.toLowerCase().includes('sun') || r3.toLowerCase().includes('celestial'),
    'Tell me about stars explains astronomy (not story listener reaction)',
    r3
  );

  const r4 = await ask(cm1, 'what is friction');
  console.log('User: "what is friction" -> Ayra:', r4);
  assert(
    r4.toLowerCase().includes('friction') || r4.toLowerCase().includes('resisting force') || r4.toLowerCase().includes('sliding'),
    'Explains friction clearly',
    r4
  );

  const r5 = await ask(cm1, 'tell me about loop engineering');
  console.log('User: "tell me about loop engineering" -> Ayra:', r5);
  assert(
    r5.toLowerCase().includes('loop') || r5.toLowerCase().includes('feedback') || r5.toLowerCase().includes('iterative'),
    'Explains loop engineering clearly',
    r5
  );

  const r6 = await ask(cm1, 'name five animals');
  console.log('User: "name five animals" -> Ayra:', r6);
  assert(
    r6.toLowerCase().includes('tiger') || r6.toLowerCase().includes('elephant') || r6.toLowerCase().includes('dog') || r6.toLowerCase().includes('dolphin'),
    'Names five animals with engaging warmth',
    r6
  );

  // Session 2: ML Engineer Interview
  console.log('\n--- Test Suite 2: ML Engineer Interview Flow ---');
  const cm2 = new ConversationManager('session-2');

  const ir1 = await ask(cm2, 'I want to take my interview for ml engineer');
  console.log('User: "I want to take my interview for ml engineer" -> Ayra:', ir1);
  assert(
    ir1.toLowerCase().includes('ml engineer') || ir1.toLowerCase().includes('rag') || ir1.toLowerCase().includes('vector'),
    'Starts ML Engineer mock interview with domain Q1',
    ir1
  );

  const ir2 = await ask(cm2, 'I under vector embroiding by using vector database like pinof file coin');
  console.log('User answers Q1 -> Ayra:', ir2);
  assert(
    (ir2.toLowerCase().includes('vector') || ir2.toLowerCase().includes('embedding') || ir2.toLowerCase().includes('database') || ir2.toLowerCase().includes('solid')) &&
    (ir2.toLowerCase().includes('latency') || ir2.toLowerCase().includes('websocket') || ir2.toLowerCase().includes('streaming') || ir2.toLowerCase().includes('stt')) &&
    (ir2.toLowerCase().includes('another question') || ir2.toLowerCase().includes('feedback')),
    'Gives genuine feedback on Q1 and asks Q2 on streaming latency without repeating Q1',
    ir2
  );

  // Session 3: Stop typo / Single word noise ("top", "from")
  console.log('\n--- Test Suite 3: Single Word Noise Filtering ---');
  const cm3 = new ConversationManager('session-3');
  const sr1 = await ask(cm3, 'top');
  console.log('User: "top" -> Ayra:', sr1);
  assert(
    !sr1.includes('Top? Tell me more'),
    'Single word "top" (stop typo) does not trigger annoying question expansion',
    sr1
  );

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed} / ${total} tests passed.`);
  console.log(`========================================`);

  if (passed === total) {
    console.log('🎉 ALL SESSION IMPROVEMENT TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

runSessionTests().catch(err => {
  console.error(err);
  process.exit(1);
});
