import { IntentClassifier } from '../server/dist/agent/intent-classifier.js';
import { ConversationManager } from '../server/dist/agent/conversation-manager.js';
import { ConversationStateMachine } from '../server/dist/state/conversation-state.js';
import { MemoryManager } from '../server/dist/agent/memory-manager.js';
import { TopicManager } from '../server/dist/agent/topic-manager.js';
import { LatencyTracker } from '../server/dist/metrics/latency-tracker.js';
import { InterruptionHandler } from '../server/dist/voice/interruption-handler.js';
import { BackchannelManager } from '../server/dist/agent/backchannel-manager.js';

// Mock TTSService
class MockTTSService {
  async synthesize(text) {
    return { audioBuffer: Buffer.from([]), durationMs: 100, phoneticText: text, provider: 'browser' };
  }
  isConfigured() { return true; }
  getProvider() { return 'browser'; }
}

async function runTests() {
  console.log('====================================================');
  console.log('STARTING AYRA HUMAN CONVERSATIONAL UNDERSTANDING AUDIT');
  console.log('====================================================\n');

  const results = [];

  function recordResult(area, passed, evidence) {
    results.push({ area, status: passed ? 'PASS' : 'FAIL', evidence });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${area}: ${evidence}`);
  }

  // 1. Real Browser Session Bug Input 1
  {
    const text = "forget it I am telling something for that kya hua aaj main subah subah Uthi aur FIR Maine Myntra khola aur uske baad Jo top Mere ko chahiye nahi";
    const classification = IntentClassifier.classifyDetailed(text, 'hinglish');
    const isNarrative = classification.conversationMode === 'PERSONAL_STORY' || classification.intent === 'emotional_statement';
    const noClarification = !classification.needsClarification;
    const noWebSearch = !classification.requiresWebSearch;
    const noEntityHijack = classification.entity === null;
    
    const passed = isNarrative && noClarification && noWebSearch && noEntityHijack;
    recordResult(
      'Real Session Bug 1 (forget it + Myntra story)',
      passed,
      `mode=${classification.conversationMode}, needsClarification=${classification.needsClarification}, entity=${classification.entity}, search=${classification.requiresWebSearch}`
    );
  }

  // 2. Real Browser Session Bug Input 2
  {
    const text = "main batati hun kya hua aaj main subah subah Uthi aur Maine Khol liya aur I wanted to order a top for myself";
    const classification = IntentClassifier.classifyDetailed(text, 'hinglish');
    const narrativeRes = IntentClassifier.isPersonalNarrative(text);
    const passed = narrativeRes.isNarrative && !narrativeRes.isIncompleteOpener;
    recordResult(
      'Real Session Bug 2 (main batati hun + full event)',
      passed,
      `isNarrative=${narrativeRes.isNarrative}, isIncompleteOpener=${narrativeRes.isIncompleteOpener}, mainEvent="${narrativeRes.mainEvent}"`
    );
  }

  // 3. Test 1 — Daily story
  {
    const text = "Aaj subah main uthi aur Myntra khola, mujhe ek top order karna tha but mera size available nahi tha.";
    const cm = new ConversationManager(
      new ConversationStateMachine(),
      new MemoryManager(),
      new TopicManager(),
      new LatencyTracker(),
      new InterruptionHandler(),
      new BackchannelManager(),
      new MockTTSService()
    );
    let capturedResponse = '';
    cm.on('agent_speech_chunk', (chunk) => { capturedResponse += chunk.text; });
    await cm.handleUserSpeech({ text, durationMs: 1500 });
    const passed = capturedResponse.includes('Myntra') && (capturedResponse.includes('size') || capturedResponse.includes('top')) && !capturedResponse.includes("not sure what you mean");
    recordResult('Test 1 — Daily story (Myntra + size)', passed, `Ayra: "${capturedResponse}"`);
  }

  // 4. Test 2 — Hinglish story
  {
    const text = "Kal college mein na ek bahut funny incident hua, phir mera friend literally floor pe gir gaya laughing.";
    const cm = new ConversationManager(
      new ConversationStateMachine(),
      new MemoryManager(),
      new TopicManager(),
      new LatencyTracker(),
      new InterruptionHandler(),
      new BackchannelManager(),
      new MockTTSService()
    );
    let capturedResponse = '';
    cm.on('agent_speech_chunk', (chunk) => { capturedResponse += chunk.text; });
    await cm.handleUserSpeech({ text, durationMs: 1500 });
    const passed = (capturedResponse.includes('floor') || capturedResponse.includes('has-has') || capturedResponse.includes('college')) && !capturedResponse.includes("not sure what you mean");
    recordResult('Test 2 — Hinglish story (Floor laughing)', passed, `Ayra: "${capturedResponse}"`);
  }

  // 5. Test 3 — Childhood
  {
    const text = "When I was a kid, I used to hide under my bed whenever guests came home.";
    const cm = new ConversationManager(
      new ConversationStateMachine(),
      new MemoryManager(),
      new TopicManager(),
      new LatencyTracker(),
      new InterruptionHandler(),
      new BackchannelManager(),
      new MockTTSService()
    );
    let capturedResponse = '';
    cm.on('agent_speech_chunk', (chunk) => { capturedResponse += chunk.text; });
    await cm.handleUserSpeech({ text, durationMs: 1500 });
    const passed = (capturedResponse.includes('bed') || capturedResponse.includes('introverted') || capturedResponse.includes('guests')) && !capturedResponse.includes("not sure what you mean");
    recordResult('Test 3 — Childhood (Hiding under bed)', passed, `Ayra: "${capturedResponse}"`);
  }

  // 6. Test 4 — Emotional
  {
    const text = "Aaj meri friend ne mujhse baat nahi ki aur mujhe samajh hi nahi aa raha why.";
    const cm = new ConversationManager(
      new ConversationStateMachine(),
      new MemoryManager(),
      new TopicManager(),
      new LatencyTracker(),
      new InterruptionHandler(),
      new BackchannelManager(),
      new MockTTSService()
    );
    let capturedResponse = '';
    cm.on('agent_speech_chunk', (chunk) => { capturedResponse += chunk.text; });
    await cm.handleUserSpeech({ text, durationMs: 1500 });
    const passed = (capturedResponse.includes('reason') || capturedResponse.includes('confusing') || capturedResponse.includes('baat')) && !capturedResponse.includes("not sure what you mean");
    recordResult('Test 4 — Emotional (Friend ignored)', passed, `Ayra: "${capturedResponse}"`);
  }

  // 7. Test 5 — Advice request
  {
    const text = "My friend is ignoring me. What should I do?";
    const adviceIntent = IntentClassifier.isAdviceIntent(text);
    const cm = new ConversationManager(
      new ConversationStateMachine(),
      new MemoryManager(),
      new TopicManager(),
      new LatencyTracker(),
      new InterruptionHandler(),
      new BackchannelManager(),
      new MockTTSService()
    );
    let capturedResponse = '';
    cm.on('agent_speech_chunk', (chunk) => { capturedResponse += chunk.text; });
    await cm.handleUserSpeech({ text, durationMs: 1500 });
    const passed = adviceIntent.requestedAdvice && capturedResponse.includes("If I were in your place");
    recordResult('Test 5 — Advice request (Contextual advice)', passed, `Ayra: "${capturedResponse}"`);
  }

  // 8. Test 6 — No advice
  {
    const text = "I don't want advice, I just want to tell you what happened.";
    const adviceIntent = IntentClassifier.isAdviceIntent(text);
    const cm = new ConversationManager(
      new ConversationStateMachine(),
      new MemoryManager(),
      new TopicManager(),
      new LatencyTracker(),
      new InterruptionHandler(),
      new BackchannelManager(),
      new MockTTSService()
    );
    let capturedResponse = '';
    cm.on('agent_speech_chunk', (chunk) => { capturedResponse += chunk.text; });
    await cm.handleUserSpeech({ text, durationMs: 1500 });
    const passed = adviceIntent.declinedAdvice && capturedResponse.includes("no advice") && capturedResponse.includes("listening");
    recordResult('Test 6 — No advice (Empathetic listening)', passed, `Ayra: "${capturedResponse}"`);
  }

  // 9. Test 7 — Direct question
  {
    const text = "What is Google?";
    const classification = IntentClassifier.classifyDetailed(text);
    const cm = new ConversationManager(
      new ConversationStateMachine(),
      new MemoryManager(),
      new TopicManager(),
      new LatencyTracker(),
      new InterruptionHandler(),
      new BackchannelManager(),
      new MockTTSService()
    );
    let capturedResponse = '';
    cm.on('agent_speech_chunk', (chunk) => { capturedResponse += chunk.text; });
    await cm.handleUserSpeech({ text, durationMs: 1500 });
    const passed = classification.userIntent === 'QUESTION' && capturedResponse.includes("technology company") && capturedResponse.includes("Larry Page");
    recordResult('Test 7 — Direct question (What is Google)', passed, `Ayra: "${capturedResponse}"`);
  }

  // 10. Test 8 — Entity inside story
  {
    const text = "I was watching YouTube last night and found this really weird video.";
    const classification = IntentClassifier.classifyDetailed(text);
    const cm = new ConversationManager(
      new ConversationStateMachine(),
      new MemoryManager(),
      new TopicManager(),
      new LatencyTracker(),
      new InterruptionHandler(),
      new BackchannelManager(),
      new MockTTSService()
    );
    let capturedResponse = '';
    cm.on('agent_speech_chunk', (chunk) => { capturedResponse += chunk.text; });
    await cm.handleUserSpeech({ text, durationMs: 1500 });
    const passed = !capturedResponse.includes("YouTube is an online video platform") && (capturedResponse.includes("YouTube") || capturedResponse.includes("video")) && capturedResponse.includes("weird");
    recordResult('Test 8 — Entity inside story (YouTube narrative)', passed, `Ayra: "${capturedResponse}"`);
  }

  // 11. Test 9 — Story + brand
  {
    const text = "I opened Myntra because I wanted a dress but then I couldn't find my size.";
    const cm = new ConversationManager(
      new ConversationStateMachine(),
      new MemoryManager(),
      new TopicManager(),
      new LatencyTracker(),
      new InterruptionHandler(),
      new BackchannelManager(),
      new MockTTSService()
    );
    let capturedResponse = '';
    cm.on('agent_speech_chunk', (chunk) => { capturedResponse += chunk.text; });
    await cm.handleUserSpeech({ text, durationMs: 1500 });
    const passed = capturedResponse.includes("Myntra") && capturedResponse.includes("size") && !capturedResponse.includes("Myntra is");
    recordResult('Test 9 — Story + brand (Myntra shopping experience)', passed, `Ayra: "${capturedResponse}"`);
  }

  // 12. Test 10 — Story continuation
  {
    const cm = new ConversationManager(
      new ConversationStateMachine(),
      new MemoryManager(),
      new TopicManager(),
      new LatencyTracker(),
      new InterruptionHandler(),
      new BackchannelManager(),
      new MockTTSService()
    );
    let turn1Res = '';
    cm.on('agent_speech_chunk', (chunk) => { turn1Res += chunk.text; });
    await cm.handleUserSpeech({ text: "Aaj college mein kuch weird hua.", durationMs: 1500 });

    let turn2Res = '';
    cm.removeAllListeners('agent_speech_chunk');
    cm.on('agent_speech_chunk', (chunk) => { turn2Res += chunk.text; });
    await cm.handleUserSpeech({ text: "Professor ne mujhe class ke saamne bula liya.", durationMs: 1500 });

    let turn3Res = '';
    cm.removeAllListeners('agent_speech_chunk');
    cm.on('agent_speech_chunk', (chunk) => { turn3Res += chunk.text; });
    await cm.handleUserSpeech({ text: "Phir unhone...", durationMs: 1500 });

    const passed = (turn3Res.includes('professor') || turn3Res.includes('class')) && !turn3Res.includes("not sure what you mean");
    recordResult('Test 10 — Story continuation ("unhone" -> professor)', passed, `Turn 3 Ayra: "${turn3Res}"`);
  }

  // 13. Test 11 — Hindi
  {
    const text = "Aaj subah mujhe ek bahut ajeeb incident hua.";
    const cm = new ConversationManager(
      new ConversationStateMachine(),
      new MemoryManager(),
      new TopicManager(),
      new LatencyTracker(),
      new InterruptionHandler(),
      new BackchannelManager(),
      new MockTTSService()
    );
    let capturedResponse = '';
    cm.on('agent_speech_chunk', (chunk) => { capturedResponse += chunk.text; });
    await cm.handleUserSpeech({ text, durationMs: 1500 });
    const passed = (capturedResponse.includes('अजीब') || capturedResponse.includes('सुबह') || capturedResponse.includes('ajeeb')) && !capturedResponse.includes("not sure what you mean");
    recordResult('Test 11 — Hindi (Daily incident)', passed, `Ayra: "${capturedResponse}"`);
  }

  // 14. Test 12 — STT noise
  {
    const text = "maine mintra khola aur mujhe ek top chahiye tha but mera saiz available nahi tha";
    const cm = new ConversationManager(
      new ConversationStateMachine(),
      new MemoryManager(),
      new TopicManager(),
      new LatencyTracker(),
      new InterruptionHandler(),
      new BackchannelManager(),
      new MockTTSService()
    );
    let capturedResponse = '';
    cm.on('agent_speech_chunk', (chunk) => { capturedResponse += chunk.text; });
    await cm.handleUserSpeech({ text, durationMs: 1500 });
    const passed = capturedResponse.includes('Myntra') && (capturedResponse.includes('top') || capturedResponse.includes('size')) && !capturedResponse.includes("not sure what you mean");
    recordResult('Test 12 — STT noise (mintra + saiz)', passed, `Ayra: "${capturedResponse}"`);
  }

  // 15. Test 13 — "forget it" pivot
  {
    const text = "Forget it, actually let me tell you what happened this morning...";
    const isStop = IntentClassifier.isExplicitStopCommand(text);
    const cm = new ConversationManager(
      new ConversationStateMachine(),
      new MemoryManager(),
      new TopicManager(),
      new LatencyTracker(),
      new InterruptionHandler(),
      new BackchannelManager(),
      new MockTTSService()
    );
    let capturedResponse = '';
    cm.on('agent_speech_chunk', (chunk) => { capturedResponse += chunk.text; });
    await cm.handleUserSpeech({ text, durationMs: 1500 });
    const passed = !isStop && (capturedResponse.includes("listening") || capturedResponse.includes("happened"));
    recordResult('Test 13 — "forget it" pivot (Story start, NOT stop)', passed, `isStop=${isStop}, Ayra: "${capturedResponse}"`);
  }

  // 16. Test 14 — Completed story
  {
    const text = "Aaj mera interview tha, main nervous thi, but somehow I answered everything really well.";
    const cm = new ConversationManager(
      new ConversationStateMachine(),
      new MemoryManager(),
      new TopicManager(),
      new LatencyTracker(),
      new InterruptionHandler(),
      new BackchannelManager(),
      new MockTTSService()
    );
    let capturedResponse = '';
    cm.on('agent_speech_chunk', (chunk) => { capturedResponse += chunk.text; });
    await cm.handleUserSpeech({ text, durationMs: 1500 });
    const passed = (capturedResponse.includes('proud') || capturedResponse.includes('win') || capturedResponse.includes('amazing')) && !capturedResponse.includes("not sure what you mean");
    recordResult('Test 14 — Completed story (Interview celebration)', passed, `Ayra: "${capturedResponse}"`);
  }

  // 17. Test 15 — No-question response
  {
    const text = "My sister finally got the college she wanted.";
    const cm = new ConversationManager(
      new ConversationStateMachine(),
      new MemoryManager(),
      new TopicManager(),
      new LatencyTracker(),
      new InterruptionHandler(),
      new BackchannelManager(),
      new MockTTSService()
    );
    let capturedResponse = '';
    cm.on('agent_speech_chunk', (chunk) => { capturedResponse += chunk.text; });
    await cm.handleUserSpeech({ text, durationMs: 1500 });
    const passed = (capturedResponse.includes('huge') || capturedResponse.includes('happy for her') || capturedResponse.includes('amazing')) && !capturedResponse.endsWith('?');
    recordResult('Test 15 — No-question response (Sister college)', passed, `Ayra: "${capturedResponse}"`);
  }

  // 18. STOP command regression
  {
    const text = "stop please";
    const isStop = IntentClassifier.isExplicitStopCommand(text);
    recordResult('STOP command regression', isStop === true, `isExplicitStopCommand("stop please") = ${isStop}`);
  }

  // 19. Math regression
  {
    const text = "What is 15 times 14?";
    const math = IntentClassifier.evaluateMathExpression(text);
    const passed = math.isMath && math.result === 210;
    recordResult('Math regression (15 * 14 = 210)', passed, `math explanation: "${math.explanation}"`);
  }

  // 20. FULL REAL-WORLD SESSION (Section 29 Conversation A)
  {
    console.log('\n--- TESTING SECTION 29 FULL CONVERSATION A ---');
    const cm = new ConversationManager(
      new ConversationStateMachine(),
      new MemoryManager(),
      new TopicManager(),
      new LatencyTracker(),
      new InterruptionHandler(),
      new BackchannelManager(),
      new MockTTSService()
    );

    async function sendTurn(userText) {
      let resp = '';
      const listener = (chunk) => { resp += chunk.text; };
      cm.on('agent_speech_chunk', listener);
      await cm.handleUserSpeech({ text: userText, durationMs: 1500 });
      cm.removeListener('agent_speech_chunk', listener);
      return resp;
    }

    // Turn 1: "Hi"
    const r1 = await sendTurn("Hi");
    recordResult('Conv A Turn 1 (Hi)', r1.toLowerCase().includes("hey") || r1.toLowerCase().includes("hi") || r1.toLowerCase().includes("ayra"), `Ayra: "${r1}"`);

    // Turn 2: "I am doing great today."
    const r2 = await sendTurn("I am doing great today.");
    recordResult('Conv A Turn 2 (Great today)', r2.toLowerCase().includes("great") || r2.toLowerCase().includes("awesome") || r2.toLowerCase().includes("good"), `Ayra: "${r2}"`);

    // Turn 3: "Actually I am little sad today because main kuch kharidna chahti hoon."
    const r3 = await sendTurn("Actually I am little sad today because main kuch kharidna chahti hoon.");
    recordResult('Conv A Turn 3 (Sad + shopping desire)', (r3.includes("shopping") || r3.includes("kharidne") || r3.includes("low")) && !r3.includes("What happened next"), `Ayra: "${r3}"`);

    // Turn 4: "I don't know, give me some advice."
    const r4 = await sendTurn("I don't know, give me some advice.");
    recordResult('Conv A Turn 4 (Advice request)', (r4.includes("cart") || r4.includes("wait") || r4.includes("advice") || r4.includes("kharcha")) && !r4.includes("quite an experience"), `Ayra: "${r4}"`);

    // Turn 5: "Koi joke sunao mujhe."
    const r5 = await sendTurn("Koi joke sunao mujhe.");
    recordResult('Conv A Turn 5 (Joke request)', (r5.includes("?") || r5.includes("!")) && !r4.includes("quite an experience"), `Ayra: "${r5}"`);

    // Turn 6: "Koi dusra joke."
    const r6 = await sendTurn("Koi dusra joke.");
    recordResult('Conv A Turn 6 (Koi dusra joke)', r6 !== r5 && !r6.includes("glad you shared that") && !r6.includes("quite an experience"), `Ayra: "${r6}"`);

    // Turn 7: "Sunao."
    const r7 = await sendTurn("Sunao.");
    recordResult('Conv A Turn 7 (Sunao -> Joke continuation)', !r7.includes("quite a situation") && !r7.includes("glad you shared"), `Ayra: "${r7}"`);

    // Turn 8: "I am saying doosra joke sunao."
    const r8 = await sendTurn("I am saying doosra joke sunao.");
    recordResult('Conv A Turn 8 (doosra joke sunao)', !r8.includes("quite a situation") && !r8.includes("glad you shared"), `Ayra: "${r8}"`);

    // Turn 9: "You are so annoying."
    const r9 = await sendTurn("You are so annoying.");
    recordResult('Conv A Turn 9 (Playful insult response)', r9.includes("Excuse me") || r9.includes("Again") || r9.includes("What did I do"), `Ayra: "${r9}"`);

    // Turn 10: "Actually no, tell me something else."
    const r10 = await sendTurn("Actually no, tell me something else.");
    recordResult('Conv A Turn 10 (Topic change / new activity)', r10.includes("talk about") || r10.includes("explore") || r10.includes("mood"), `Ayra: "${r10}"`);
  }

  console.log('\n====================================================');
  console.log('AUDIT SUMMARY');
  console.log('====================================================');
  const failed = results.filter(r => r.status === 'FAIL');
  if (failed.length > 0) {
    console.log('FAILED TESTS:');
    failed.forEach(f => console.log(` - ${f.area}: ${f.evidence}`));
  }
  const allPassed = results.every(r => r.status === 'PASS');
  console.log(`Total tests: ${results.length} | Passed: ${results.filter(r => r.status === 'PASS').length} | Failed: ${failed.length}`);
  console.log(`Final Verdict: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
}

runTests().catch(console.error);
