import { ConversationManager } from '../server/dist/agent/conversation-manager.js';

async function runRegressionTests() {
  console.log('=== RUNNING AYRA 10 REGRESSION TESTS ===\n');

  const manager = new ConversationManager({ userId: 'test-user-regression' });
  const results = [];

  // Helper to send a turn and capture the agent output
  async function sendTurn(text, isInterruption = false) {
    return new Promise((resolve) => {
      let responseText = '';
      const onSpeech = (chunk) => {
        responseText += (responseText ? ' ' : '') + chunk.text;
      };
      const onEnd = () => {
        manager.removeListener('agent_speech_chunk', onSpeech);
        manager.removeListener('response_end', onEnd);
        resolve(responseText.trim());
      };

      manager.on('agent_speech_chunk', onSpeech);
      manager.on('response_end', onEnd);

      manager.handleUserSpeech({
        text,
        durationMs: 800,
        isInterruptionCheck: isInterruption
      }).catch(err => {
        console.error('Turn error:', err);
        resolve('ERROR: ' + err.message);
      });
    });
  }

  // TEST 1: "Hi Ayra."
  console.log('--- TEST 1: Greeting ---');
  const t1 = await sendTurn('Hi Ayra.');
  console.log(`User: "Hi Ayra."`);
  console.log(`Ayra: "${t1}"`);
  const t1Pass = t1.length > 0 && /hey|hi|hello|how are you|what's up/i.test(t1);
  results.push({ test: 1, name: 'Greeting', pass: t1Pass, details: t1 });

  // TEST 2: "Tell me about yourself."
  console.log('\n--- TEST 2: Self Introduction ---');
  const t2 = await sendTurn('Tell me about yourself.');
  console.log(`User: "Tell me about yourself."`);
  console.log(`Ayra: "${t2}"`);
  const t2Pass = /ayra/i.test(t2) && !/as an ai language model/i.test(t2);
  results.push({ test: 2, name: 'Self Introduction', pass: t2Pass, details: t2 });

  // TEST 3: "I had a bad day today. I don't want advice."
  console.log('\n--- TEST 3: Bad Day (No Advice) ---');
  const t3 = await sendTurn("I had a bad day today. I don't want advice.");
  console.log(`User: "I had a bad day today. I don't want advice."`);
  console.log(`Ayra: "${t3}"`);
  const t3Pass = !/you should|try to|make sure you|i advise|step 1/i.test(t3) && /sorry|hear you|here/i.test(t3);
  results.push({ test: 3, name: 'Bad Day (No Advice)', pass: t3Pass, details: t3 });

  // TEST 4: "I had a fever yesterday." -> "kind of good"
  console.log('\n--- TEST 4: Context Continuity (Fever -> kind of good) ---');
  const t4a = await sendTurn('I had a fever yesterday.');
  console.log(`User: "I had a fever yesterday."`);
  console.log(`Ayra: "${t4a}"`);
  const t4b = await sendTurn('kind of good');
  console.log(`User: "kind of good"`);
  console.log(`Ayra: "${t4b}"`);
  const t4Pass = !/what's on your mind|how can i help/i.test(t4b) && /yesterday|better|weak|feeling/i.test(t4b);
  results.push({ test: 4, name: 'Context Continuity (Fever -> Recovery)', pass: t4Pass, details: t4b });

  // TEST 5: "Tell me a joke." -> "No developer jokes. Give me a simple random joke."
  console.log('\n--- TEST 5: Preference Following (No Dev Jokes -> Simple Random Joke) ---');
  const t5a = await sendTurn('Tell me a joke.');
  console.log(`User: "Tell me a joke."`);
  console.log(`Ayra: "${t5a}"`);
  const t5b = await sendTurn('No developer jokes. Give me a simple random joke.');
  console.log(`User: "No developer jokes. Give me a simple random joke."`);
  console.log(`Ayra: "${t5b}"`);
  const isDevJoke = /cache|bugs|binary|null|javascript|programming|code|developer/i.test(t5b);
  const t5Pass = !isDevJoke && t5b.length > 10;
  results.push({ test: 5, name: 'No Developer Jokes -> Simple Joke', pass: t5Pass, details: t5b });

  // TEST 6: "Do you know Alia Bhatt?" -> "How old is she?"
  console.log('\n--- TEST 6: Pronoun Resolution & Dynamic Age ---');
  const t6a = await sendTurn('Do you know Alia Bhatt?');
  console.log(`User: "Do you know Alia Bhatt?"`);
  console.log(`Ayra: "${t6a}"`);
  const t6b = await sendTurn('How old is she?');
  console.log(`User: "How old is she?"`);
  console.log(`Ayra: "${t6b}"`);
  const currentYear = new Date().getFullYear();
  const expectedAge = currentYear - 1993 - (new Date().getMonth() < 2 ? 1 : 0);
  const t6Pass = (t6b.includes('Alia Bhatt') || t6b.includes('she is')) && (t6b.includes(String(expectedAge)) || t6b.includes('March 15, 1993') || t6b.includes('years old'));
  results.push({ test: 6, name: 'Alia Bhatt Age & Pronoun', pass: t6Pass, details: t6b });

  // TEST 7: "Do you know Siddharth Malhotra?"
  console.log('\n--- TEST 7: Entity Recognition (Siddharth Malhotra) ---');
  const t7 = await sendTurn('Do you know Siddharth Malhotra?');
  console.log(`User: "Do you know Siddharth Malhotra?"`);
  console.log(`Ayra: "${t7}"`);
  const t7Pass = /sidharth|siddharth|actor|shershaah|student of the year/i.test(t7) && !/what's on your mind/i.test(t7);
  results.push({ test: 7, name: 'Entity Recognition (Sidharth Malhotra)', pass: t7Pass, details: t7 });

  // TEST 8: "Tell me something about space." -> Interrupt: "Stop. Tell me something funny instead."
  console.log('\n--- TEST 8: Context Switch & Barge-In ("Stop. Tell me something funny instead.") ---');
  const t8a = await sendTurn('Tell me something about space.');
  console.log(`User: "Tell me something about space."`);
  console.log(`Ayra: "${t8a}"`);
  manager.cancelInFlightResponse('barge_in_test');
  const t8b = await sendTurn('Stop. Tell me something funny instead.', true);
  console.log(`User: "Stop. Tell me something funny instead."`);
  console.log(`Ayra: "${t8b}"`);
  const t8Pass = !/something funny instead/i.test(t8b) && !/space/i.test(t8b) && t8b.length > 10;
  results.push({ test: 8, name: 'Context Switching & Barge-In', pass: t8Pass, details: t8b });

  // TEST 9: "Tell me something about yourself." -> "Okay bye."
  console.log('\n--- TEST 9: Natural Goodbye ---');
  const t9a = await sendTurn('Tell me something about yourself.');
  console.log(`User: "Tell me something about yourself."`);
  console.log(`Ayra: "${t9a}"`);
  const t9b = await sendTurn('Okay bye.');
  console.log(`User: "Okay bye."`);
  console.log(`Ayra: "${t9b}"`);
  const t9Pass = /bye|take care|see you/i.test(t9b) && !/\?/i.test(t9b) && !/what would you like|how can i|what's on your mind/i.test(t9b);
  results.push({ test: 9, name: 'Natural Goodbye (No Question)', pass: t9Pass, details: t9b });

  // TEST 10: Current Information Question
  console.log('\n--- TEST 10: Current Information Routing ---');
  const t10 = await sendTurn("What is happening in tech right now?");
  console.log(`User: "What is happening in tech right now?"`);
  console.log(`Ayra: "${t10}"`);
  const t10Pass = /ai|tech|models|development|robotics|computing|software/i.test(t10);
  results.push({ test: 10, name: 'Current Info Routing', pass: t10Pass, details: t10 });

  console.log('\n========================================');
  console.log('           REGRESSION TEST SUMMARY       ');
  console.log('========================================');
  let allPass = true;
  for (const r of results) {
    console.log(`TEST ${r.test} [${r.pass ? 'PASS' : 'FAIL'}]: ${r.name}`);
    if (!r.pass) {
      allPass = false;
      console.log(`   Details: ${r.details}`);
    }
  }

  console.log(`\nOVERALL STATUS: ${allPass ? 'ALL 10 TESTS PASSED' : 'SOME TESTS FAILED'}`);
  process.exit(allPass ? 0 : 1);
}

runRegressionTests().catch(console.error);
