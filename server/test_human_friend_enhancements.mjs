import { ConversationManager } from './dist/agent/conversation-manager.js';

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

async function runTests() {
  console.log('--- TESTING HUMAN FRIEND ENHANCEMENTS & USER REPORTED SCENARIOS ---');
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

  // 1. Generic Stress Test (No reason given)
  console.log('\n--- Scenario 1: Generic Stress without specific reason ---');
  const cm1 = new ConversationManager('test-stress-1');
  const resp1 = await ask(cm1, 'I am little stressed out today');
  console.log(`User: "I am little stressed out today" -> Ayra: "${resp1}"`);
  assert(
    !resp1.includes('Big challenges can definitely feel overwhelming') &&
    (resp1.toLowerCase().includes('what happened') || resp1.toLowerCase().includes('stressing you out') || resp1.toLowerCase().includes('what\'s going on')),
    'Generic stress gives natural short friend check-in (not robotic essay)',
    resp1
  );

  // 1b. Stress WITH reason given
  console.log('\n--- Scenario 1b: Stress with specific reason ---');
  const cm1b = new ConversationManager('test-stress-2');
  const resp1b = await ask(cm1b, 'I am stressed because of my AI interview tomorrow');
  console.log(`User: "I am stressed because of my AI interview tomorrow" -> Ayra: "${resp1b}"`);
  assert(
    resp1b.toLowerCase().includes('stressed') || resp1b.toLowerCase().includes('interview'),
    'Stress with reason gives contextual empathetic support',
    resp1b
  );

  // 2. Personal Story: Friend troubled / blackmailed
  console.log('\n--- Scenario 2: Friend troubled / blackmailed ---');
  const cm2 = new ConversationManager('test-trouble-1');
  const resp2a = await ask(cm2, 'I got a call from my best friend and she was saying that a guy is troubling her');
  console.log(`User: "I got a call from my best friend and she was saying that a guy is troubling her" -> Ayra: "${resp2a}"`);
  assert(
    (resp2a.toLowerCase().includes('worrying') || resp2a.toLowerCase().includes('troubling') || resp2a.toLowerCase().includes('safe')) &&
    !resp2a.toLowerCase().includes('broke up') && !resp2a.toLowerCase().includes('missed that'),
    'Friend troubled by a guy is handled with immediate concern',
    resp2a
  );

  const cm2b = new ConversationManager('test-blackmail-1');
  const resp2b = await ask(cm2b, 'I got a call from my best friend and she was saying that a guy is blackmailing her');
  console.log(`User: "I got a call from my best friend and she was saying that a guy is blackmailing her" -> Ayra: "${resp2b}"`);
  assert(
    resp2b.toLowerCase().includes('serious') || resp2b.toLowerCase().includes('blackmail') || resp2b.toLowerCase().includes('safe'),
    'Friend blackmailing situation is handled with urgent care & safety',
    resp2b
  );

  // 2c. Advice for blackmail situation ("I don't know what to do / give some advice")
  const resp2c = await ask(cm2b, 'I dont know what to do give some advice');
  console.log(`User: "I dont know what to do give some advice" -> Ayra: "${resp2c}"`);
  assert(
    resp2c.toLowerCase().includes('evidence') || resp2c.toLowerCase().includes('screenshot') || resp2c.toLowerCase().includes('safe') || resp2c.toLowerCase().includes('threat') || resp2c.toLowerCase().includes('demand'),
    'Gives practical safety advice for blackmail situation',
    resp2c
  );

  // 3. Interview Flow: Role not specified vs Role specified
  console.log('\n--- Scenario 3: Interview Flow ---');
  const cm3 = new ConversationManager('test-interview-1');
  const resp3a = await ask(cm3, 'take my interview');
  console.log(`User: "take my interview" -> Ayra: "${resp3a}"`);
  assert(
    resp3a.toLowerCase().includes('which role') || resp3a.toLowerCase().includes('role would you like'),
    'Asks which role when user does not specify role upfront',
    resp3a
  );

  // User specifies AI engineer
  const resp3b = await ask(cm3, 'AI engineer');
  console.log(`User: "AI engineer" -> Ayra: "${resp3b}"`);
  assert(
    resp3b.toLowerCase().includes('ai') || resp3b.toLowerCase().includes('rag') || resp3b.toLowerCase().includes('llm') || resp3b.toLowerCase().includes('model'),
    'Starts domain-specific AI engineer interview question',
    resp3b
  );

  // User answers AI question
  const resp3c = await ask(cm3, 'In RAG we retrieve relevant chunks from a vector database using embeddings and pass them into the context window of the LLM to reduce hallucinations.');
  console.log(`User answers -> Ayra: "${resp3c}"`);
  assert(
    (resp3c.toLowerCase().includes('feedback') || resp3c.toLowerCase().includes('great') || resp3c.toLowerCase().includes('spot on') || resp3c.toLowerCase().includes('solid')) &&
    (resp3c.toLowerCase().includes('next question') || resp3c.toLowerCase().includes('another question') || resp3c.toLowerCase().includes('ready for')),
    'Provides genuine feedback and asks if user wants another question',
    resp3c
  );

  // 3d. Direct role specified upfront: "take my interview for AI engineer roll"
  console.log('\n--- Scenario 3d: Direct role specified upfront with typo ---');
  const cm4 = new ConversationManager('test-interview-2');
  const resp4 = await ask(cm4, 'take my interview for AI engineer roll');
  console.log(`User: "take my interview for AI engineer roll" -> Ayra: "${resp4}"`);
  assert(
    resp4.toLowerCase().includes('ai') || resp4.toLowerCase().includes('rag') || resp4.toLowerCase().includes('llm') || resp4.toLowerCase().includes('engineer'),
    'Directly starts AI Engineer interview domain questions when role specified upfront',
    resp4
  );

  // 4. Referral / Project dilemma advice
  console.log('\n--- Scenario 4: Referral project advice ---');
  const cm5 = new ConversationManager('test-referral-advice');
  await ask(cm5, 'actually I want a referral for a company but I don\'t have good projects');
  const resp5 = await ask(cm5, 'give me some advice what should I do');
  console.log(`User: "give me some advice what should I do" -> Ayra: "${resp5}"`);
  assert(
    resp5.toLowerCase().includes('referral') || resp5.toLowerCase().includes('project') || resp5.toLowerCase().includes('working'),
    'Gives thoughtful friend advice for referral and project dilemma',
    resp5
  );

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed} / ${total} tests passed.`);
  console.log(`========================================`);

  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
