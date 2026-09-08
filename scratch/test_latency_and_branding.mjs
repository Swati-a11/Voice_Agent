import { ConversationManager } from '../server/dist/agent/conversation-manager.js';
import { WebSearchService } from '../server/dist/agent/web-search-service.js';

async function runAcceptanceTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   AYRA LOW-LATENCY & BRANDING ACCEPTANCE TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const results = [];

  function assert(name, condition, details = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${name} ${details ? '(' + details + ')' : ''}`);
      results.push({ name, pass: true, details });
    } else {
      console.log(`  ❌ [FAIL] ${name} — ${details}`);
      results.push({ name, pass: false, details });
    }
  }

  // Helper to send a turn and capture the agent output and latency
  async function sendTurn(manager, text, isInterruption = false) {
    const startTime = Date.now();
    return new Promise((resolve) => {
      let responseText = '';
      let firstChunkTime = 0;
      const chunks = [];

      const onSpeech = (chunk) => {
        if (!firstChunkTime) firstChunkTime = Date.now() - startTime;
        chunks.push(chunk.text);
        responseText += (responseText ? ' ' : '') + chunk.text;
      };
      const onEnd = () => {
        manager.removeListener('agent_speech_chunk', onSpeech);
        manager.removeListener('response_end', onEnd);
        resolve({
          text: responseText.trim(),
          chunks,
          firstChunkTime: firstChunkTime || (Date.now() - startTime),
          totalTime: Date.now() - startTime
        });
      };

      manager.on('agent_speech_chunk', onSpeech);
      manager.on('response_end', onEnd);

      manager.handleUserSpeech({
        text,
        durationMs: 400,
        isInterruptionCheck: isInterruption
      }).catch(err => {
        resolve({ text: 'ERROR: ' + err.message, chunks: [], firstChunkTime: 0, totalTime: 0 });
      });
    });
  }

  // -------------------------------------------------------------
  // TEST 1: Initial Greeting contains "Ayra, built by Swati"
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: Initial Greeting with Swati Branding ---');
  const m1 = new ConversationManager({ userId: 'test-user-1' });
  const r1 = await sendTurn(m1, 'Hello.');
  console.log(`User: "Hello."`);
  console.log(`Ayra: "${r1.text}" (TTFA: ${r1.firstChunkTime}ms)`);
  assert(
    'Test 1: Initial greeting contains "Ayra" and "Swati"',
    /ayra/i.test(r1.text) && /swati/i.test(r1.text) && r1.firstChunkTime < 100,
    `Response: "${r1.text}", TTFA: ${r1.firstChunkTime}ms`
  );

  // -------------------------------------------------------------
  // TEST 2: Self-Introduction ("Tell me about yourself")
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Self-Introduction ---');
  const m2 = new ConversationManager({ userId: 'test-user-2' });
  const r2 = await sendTurn(m2, 'Tell me about yourself.');
  console.log(`User: "Tell me about yourself."`);
  console.log(`Ayra: "${r2.text}" (TTFA: ${r2.firstChunkTime}ms)`);
  assert(
    'Test 2: Fast natural introduction ("I\'m Ayra, a conversational AI built by Swati...")',
    /ayra/i.test(r2.text) && /built by swati/i.test(r2.text) && r2.firstChunkTime < 100,
    `Response: "${r2.text}"`
  );

  // -------------------------------------------------------------
  // TEST 3: Fast Goodbye without Gemini
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Immediate Goodbye ---');
  const m3 = new ConversationManager({ userId: 'test-user-3' });
  await sendTurn(m3, 'Hello.');
  const r3 = await sendTurn(m3, 'Bye.');
  console.log(`User: "Bye."`);
  console.log(`Ayra: "${r3.text}" (TTFA: ${r3.firstChunkTime}ms)`);
  assert(
    'Test 3: Immediate goodbye without trailing question',
    /bye|take care|talk to you later/i.test(r3.text) && !r3.text.includes('?') && r3.firstChunkTime < 100,
    `Response: "${r3.text}"`
  );

  // -------------------------------------------------------------
  // TEST 4: Immediate Stop Command
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Stop Command Cancellation ---');
  const m4 = new ConversationManager({ userId: 'test-user-4' });
  let cancelFired = false;
  m4.on('cancel_audio_playback', () => { cancelFired = true; });
  await m4.handleStopCommand({ text: 'stop' });
  assert(
    'Test 4: Immediate stop command fires cancel_audio_playback and transitions cleanly',
    cancelFired || m4.stateMachine.getState() === 'LISTENING',
    `State: ${m4.stateMachine.getState()}`
  );

  // -------------------------------------------------------------
  // TEST 5: Emotional Stress Response
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Emotional Stress Response ---');
  const m5 = new ConversationManager({ userId: 'test-user-5' });
  const r5 = await sendTurn(m5, "I'm really stressed about my interview.");
  console.log(`User: "I'm really stressed about my interview."`);
  console.log(`Ayra: "${r5.text}" (TTFA: ${r5.firstChunkTime}ms)`);
  assert(
    'Test 5: Responds empathetically with emotional grounding',
    /stress|interview|overwhelm|understand/i.test(r5.text),
    `Response: "${r5.text}"`
  );

  // -------------------------------------------------------------
  // TEST 6: Pipelined Streaming Chunks
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Chunk Streaming ---');
  const m6 = new ConversationManager({ userId: 'test-user-6' });
  const r6 = await sendTurn(m6, "What is quantum physics?");
  console.log(`User: "What is quantum physics?"`);
  console.log(`Ayra: "${r6.text}" (${r6.chunks.length} chunks, TTFA: ${r6.firstChunkTime}ms)`);
  assert(
    'Test 6: Delivers structured speech chunks with low TTFA',
    r6.text.length > 20 && r6.firstChunkTime < 100,
    `Chunks: ${r6.chunks.length}, First chunk TTFA: ${r6.firstChunkTime}ms`
  );

  // -------------------------------------------------------------
  // TEST 7: Interruption / Barge-in Priority
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Interruption Handling ---');
  const m7 = new ConversationManager({ userId: 'test-user-7' });
  m7.stateMachine.transitionTo('AGENT_SPEAKING', 'TEST');
  const r7 = await sendTurn(m7, "Stop wait, let's talk about space.", true);
  console.log(`User interrupted: "Stop wait, let's talk about space."`);
  console.log(`Ayra: "${r7.text}"`);
  assert(
    'Test 7: Interruption seamlessly pivots to new topic',
    /space|universe|star|planet|cosmos/i.test(r7.text),
    `Response: "${r7.text}"`
  );

  // -------------------------------------------------------------
  // TEST 8: Web Search Routing Accuracy
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: Web Search Routing Decision ---');
  const isSearch1 = WebSearchService.shouldRouteToWebSearch("What's happening in tech right now?");
  const isSearch2 = WebSearchService.shouldRouteToWebSearch("What is React?");
  const isSearch3 = WebSearchService.shouldRouteToWebSearch("you know what happened today");
  const isSearch4 = WebSearchService.shouldRouteToWebSearch("I ate really good food today");

  assert(
    'Test 8a: Real-time query triggers web search',
    isSearch1 === true,
    `isSearch: ${isSearch1}`
  );
  assert(
    'Test 8b: Stable knowledge does NOT trigger search',
    isSearch2 === false,
    `isSearch: ${isSearch2}`
  );
  assert(
    'Test 8c: Suspense opener ("you know what happened today") does NOT trigger search',
    isSearch3 === false,
    `isSearch: ${isSearch3}`
  );
  assert(
    'Test 8d: Personal sharing does NOT trigger search',
    isSearch4 === false,
    `isSearch: ${isSearch4}`
  );

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  const passed = results.filter(r => r.pass).length;
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`   ACCEPTANCE TESTS SUMMARY: ${passed}/${results.length} PASSED`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (passed === results.length) {
    console.log('🎉 ALL 8 ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
  } else {
    process.exit(1);
  }
}

runAcceptanceTests().catch(err => {
  console.error('Acceptance test execution error:', err);
  process.exit(1);
});
