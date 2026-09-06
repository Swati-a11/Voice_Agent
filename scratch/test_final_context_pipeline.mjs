import assert from 'assert';
import { ConversationManager } from '../server/dist/agent/conversation-manager.js';
import { IntentClassifier } from '../server/dist/agent/intent-classifier.js';
import { StoryEngine } from '../server/dist/agent/story-engine.js';
import { WebSearchService } from '../server/dist/agent/web-search-service.js';

let passed = 0;
let failed = 0;

function testAssert(condition, name, details = '') {
  if (condition) {
    passed++;
    console.log(`[PASS] ${name}`);
  } else {
    failed++;
    console.error(`[FAIL] ${name} ${details ? '-> ' + details : ''}`);
  }
}

async function runTestPipeline() {
  console.log('================================================================');
  console.log('AYRA FINAL CONTEXT RESOLUTION & STT REPAIR TEST SUITE');
  console.log('================================================================\n');

  // --- Part 1: STT Semantic Repair Layer (Section 5) ---
  console.log('--- Part 1: STT Semantic Repair Layer ---');
  const stt1 = IntentClassifier.normalizeSTTErrors("its for best lover roll");
  testAssert(/web developer role/i.test(stt1), "STT: 'best lover roll' -> 'web developer role'");

  const stt2 = IntentClassifier.normalizeSTTErrors("message what should I do");
  testAssert(/mess up/i.test(stt2), "STT: 'message what should I do' -> 'mess up, what should I do'");

  const stt3 = IntentClassifier.normalizeSTTErrors("save some really hard things back");
  testAssert(/said some really harsh things back/i.test(stt3), "STT: 'save some really hard things back' -> 'said some really harsh things back'");

  const stt4 = IntentClassifier.normalizeSTTErrors("make with him");
  testAssert(/make up with him/i.test(stt4), "STT: 'make with him' -> 'make up with him'");

  const stt5 = IntentClassifier.normalizeSTTErrors("who is called you think it was");
  testAssert(/whose fault do you think it was/i.test(stt5), "STT: 'who is called' -> 'whose fault'");

  const stt6 = IntentClassifier.normalizeSTTErrors("completely conversation");
  testAssert(/complete conversation/i.test(stt6), "STT: 'completely conversation' -> 'complete conversation'");

  // Helper for conversation turns
  function createSpeaker(userId) {
    const cm = new ConversationManager({ userId });
    return {
      cm,
      say: async (text) => {
        let responseText = '';
        const chunkListener = (data) => { responseText += (data.text || ''); };
        cm.on('agent_speech_chunk', chunkListener);
        await cm.handleUserSpeech({ text });
        cm.off('agent_speech_chunk', chunkListener);
        return responseText.trim();
      }
    };
  }

  // --- Part 2: Section 20 Regression Tests 1 to 18 ---
  console.log('\n--- Part 2: Section 20 Regression Tests ---');

  // TEST 1: Pending question role resolution
  const s1 = createSpeaker('user-test-1');
  const r1_1 = await s1.say("I have an interview tomorrow and I'm nervous.");
  testAssert(/nervous|role|interview/i.test(r1_1), "TEST 1 Turn 1: Ayra acknowledges nerves and asks role");
  const r1_2 = await s1.say("its for best lover roll");
  testAssert(/web developer|fundamentals|html|css|javascript|react|mock/i.test(r1_2) && !/not sure/i.test(r1_2), "TEST 1 Turn 2: Pending question role resolved from STT repaired 'best lover roll'", `Received: "${r1_2}"`);

  // TEST 2: Friend Conflict Activation
  const s2 = createSpeaker('user-test-2');
  const r2 = await s2.say("I just had a fight with my best friend.");
  testAssert(/what happened|yaar/i.test(r2), "TEST 2: Friend conflict enters FRIEND_CONFLICT", `Received: "${r2}"`);

  // TEST 3: Reported Speech ("she says you don't have knowledge you are so dumb")
  const s3 = createSpeaker('user-test-3');
  await s3.say("I just had a fight with my best friend.");
  const r3 = await s3.say("she says you don't have knowledge you are so dumb");
  testAssert(/hurtful|what did you say back|ouch/i.test(r3) && !/excuse me|how dare/i.test(r3), "TEST 3: Reported speech understood as friend's words, not insult to Ayra", `Received: "${r3}"`);

  // TEST 4: Both Potentially Responsible
  const s4 = createSpeaker('user-test-4');
  const r4 = await s4.say("my friend was rude to me but I also said really harsh things back");
  testAssert(/both|contributed|apologize|harsh/i.test(r4), "TEST 4: Evaluates both parties as contributing", `Received: "${r4}"`);

  // TEST 5: Contextual Apology Advice
  const s5 = createSpeaker('user-test-5');
  await s5.say("I just had a fight with my best friend.");
  await s5.say("I said some harsh things.");
  const r5 = await s5.say("do you think I should apologize?");
  testAssert(/apologize|apology|your part|fault/i.test(r5), "TEST 5: Gives contextual apology advice", `Received: "${r5}"`);

  // TEST 6 & 7: Interview Mode Activation & 1-at-a-time Config
  const s6 = createSpeaker('user-test-6');
  const r6 = await s6.say("pretend your my interviewer for a software developer role");
  testAssert(/interviewer|properly|one question at a time|honest|about yourself/i.test(r6), "TEST 6: Enters interview mode with honest feedback setup", `Received: "${r6}"`);
  const r7 = await s6.say("one question at a time and give me honest feedback");
  testAssert(/one question at a time|honest feedback|about yourself/i.test(r7), "TEST 7: Configures one-question-at-a-time flow", `Received: "${r7}"`);

  // TEST 8: Technical Follow-up "Explain" on React Hooks
  const s8 = createSpeaker('user-test-8');
  await s8.say("now explain react hooks for an interview");
  const r8 = await s8.say("explain");
  testAssert(/hooks|usestate|useeffect|components|stateful/i.test(r8) && !/tell me more—what were you thinking/i.test(r8), "TEST 8: Single-word 'explain' resolves to React Hooks", `Received: "${r8}"`);

  // TEST 9 & 10: Flirting Mode & "Carry On"
  const s9 = createSpeaker('user-test-9');
  const r9 = await s9.say("flirt with me");
  testAssert(/confident|impress|flirting|bold/i.test(r9), "TEST 9: Enters flirting mode playfully", `Received: "${r9}"`);
  const r10 = await s9.say("carry on");
  testAssert(/charm|careful|flirt|going/i.test(r10), "TEST 10: 'carry on' continues flirting mode without fallback", `Received: "${r10}"`);

  // TEST 11 & 12: Current World Information
  const s11 = createSpeaker('user-test-11');
  const r11 = await s11.say("the world right now that you think I should actually know");
  testAssert(/world|geopolitical|economic|ai|energy|global/i.test(r11), "TEST 11: Real-time world info answered directly", `Received: "${r11}"`);
  const r12 = await s11.say("tell me what happened in the world right now");
  testAssert(/world|geopolitical|economic|ai|energy|global/i.test(r12), "TEST 12: 'what happened in the world right now' answered directly", `Received: "${r12}"`);

  // TEST 13: Correction of Ayra ("it is not a compliment")
  const s13 = createSpeaker('user-test-13');
  const r13 = await s13.say("it is not a compliment");
  testAssert(/point taken|hurt|confidence/i.test(r13), "TEST 13: Correction 'it is not a compliment' recognized", `Received: "${r13}"`);

  // TEST 14: Direct Insult to Ayra ("you are so dumb")
  const s14 = createSpeaker('user-test-14');
  const r14 = await s14.say("you are so dumb");
  testAssert(/excuse me|harsh/i.test(r14), "TEST 14: Direct insult to Ayra defended playfully", `Received: "${r14}"`);

  // TEST 15: Correction + Reported Speech ("no no you're not dumb, my friend says that I am dumb")
  const s15 = createSpeaker('user-test-15');
  const r15 = await s15.say("no no you're not dumb, my friend says that I am dumb");
  testAssert(/got it|said that about you|hurtful/i.test(r15), "TEST 15: Correction + reported speech recognized", `Received: "${r15}"`);

  // TEST 16: Casual Normal Conversation ("let's have a complete normal conversation")
  const s16 = createSpeaker('user-test-16');
  const r16 = await s16.say("let's have a complete normal conversation");
  testAssert(/friends|chat|how'?s everything/i.test(r16), "TEST 16: 'let's have a complete normal conversation' starts CASUAL_CHAT", `Received: "${r16}"`);

  // TEST 17: Topic Switch (Interview -> Friend Conflict)
  const s17 = createSpeaker('user-test-17');
  await s17.say("pretend your my interviewer for a software developer role");
  const r17 = await s17.say("forget the interview, let's talk about my friend");
  testAssert(/forget the interview|what happened with your friend|yaar/i.test(r17), "TEST 17: Topic switch immediately exits interview to friend conflict", `Received: "${r17}"`);

  // TEST 18: Topic Switch (Technical -> Casual)
  const s18 = createSpeaker('user-test-18');
  await s18.say("now explain react hooks for an interview");
  const r18 = await s18.say("okay enough technical stuff, I'm tired, let's just talk");
  testAssert(/long day|breath|kick back|what'?s on your mind/i.test(r18), "TEST 18: Topic switch exits technical to casual chat", `Received: "${r18}"`);

  // --- Part 3: Section 22 Final Canonical Multi-Turn Conversation ---
  console.log('\n--- Part 3: Section 22 Canonical Conversation Sequence ---');
  const canon = createSpeaker('user-canonical');

  // Turn 1
  const t1 = await canon.say("I have an interview tomorrow and I'm nervous.");
  testAssert(/nervous|role|interview/i.test(t1), "Canon Turn 1: Nervous interview statement recognized");

  // Turn 2
  const t2 = await canon.say("it's for a web developer role.");
  testAssert(/web developer|fundamentals|html|css|javascript|react|projects/i.test(t2), "Canon Turn 2: Web developer role answered without fallback");

  // Turn 3
  const t3 = await canon.say("stop.");
  testAssert(/listening|okay/i.test(t3), "Canon Turn 3: Immediate stop");

  // Turn 4
  const t4 = await canon.say("I just had a fight with my best friend.");
  testAssert(/what happened|yaar/i.test(t4), "Canon Turn 4: Friend conflict listening");

  // Turn 5
  const t5 = await canon.say("she said I'm dumb.");
  testAssert(/hurtful|what did you say back|ouch/i.test(t5), "Canon Turn 5: Reported speech attributed to friend");

  // Turn 6
  const t6 = await canon.say("I said some harsh things back.");
  testAssert(/what did you say to her|harsh|escalat|both/i.test(t6), "Canon Turn 6: Both sides recorded");

  // Turn 7
  const t7 = await canon.say("should I apologize?");
  testAssert(/apologize|apology|your part|fault/i.test(t7), "Canon Turn 7: Contextual apology advice delivered");

  // Turn 8
  const t8 = await canon.say("okay forget that. tell me what's happening in the world right now.");
  testAssert(/world|geopolitical|economic|ai|energy|global/i.test(t8), "Canon Turn 8: Topic switch to world information with live summary");

  // Turn 9
  const t9 = await canon.say("now explain React Hooks for an interview.");
  testAssert(/hooks|usestate|useeffect|components|lifecycle/i.test(t9), "Canon Turn 9: Technical explanation of React Hooks");

  // Turn 10
  const t10 = await canon.say("okay enough technical stuff. let's just talk.");
  testAssert(/long day|breath|kick back|what'?s on your mind/i.test(t10), "Canon Turn 10: Switch to casual chat");

  // Turn 11
  const t11 = await canon.say("flirt with me.");
  testAssert(/confident|impress|flirting|bold/i.test(t11), "Canon Turn 11: Switch to flirting mode");

  // Turn 12
  const t12 = await canon.say("carry on.");
  testAssert(/charm|careful|flirt|going/i.test(t12), "Canon Turn 12: Flirting continued");

  // Turn 13
  const t13 = await canon.say("you're actually not very good.");
  testAssert(/tough crowd|ouch|better/i.test(t13), "Canon Turn 13: Playful reaction to feedback");

  // Turn 14
  const t14 = await canon.say("it wasn't a compliment.");
  testAssert(/point taken|hurt|confidence/i.test(t14), "Canon Turn 14: Correction acknowledged naturally");

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestPipeline().catch(console.error);
