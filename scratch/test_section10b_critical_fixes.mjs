import { ConversationManager } from '../server/dist/agent/conversation-manager.js';
import { EmotionalAnalyzer } from '../server/dist/agent/emotional-analyzer.js';

let passed = 0;
let failed = 0;

function testAssert(condition, name, details = '') {
  if (condition) {
    passed++;
    console.log(`[PASS] ${name}`);
  } else {
    failed++;
    console.error(`[FAIL] ${name}${details ? ` -> ${details}` : ''}`);
  }
}

function createSpeaker(userId = 'sec10b-test-user') {
  const cm = new ConversationManager({ userId });
  return {
    cm,
    async say(userText) {
      let responseText = '';
      const onChunk = (chunk) => {
        if (chunk && chunk.text) responseText += chunk.text;
      };
      cm.on('agent_speech_chunk', onChunk);
      await cm.handleUserSpeech({ text: userText, durationMs: 400 });
      await new Promise((r) => setTimeout(r, 60));
      cm.off('agent_speech_chunk', onChunk);
      return responseText.trim();
    }
  };
}

async function runSection10bTests() {
  console.log("================================================================");
  console.log("  TESTING SECTION 10b: CRITICAL FIXES (BUGS 1 - 4)");
  console.log("================================================================\n");

  // -------------------------------------------------------------
  // BUG 1: Emotional context reaching response generation
  // -------------------------------------------------------------
  console.log("--- Testing Bug 1: Emotion context routing ---");
  const s1 = createSpeaker('bug1-speaker');

  const emoBoss = EmotionalAnalyzer.analyzeEmotion("my boss scolded me");
  testAssert(
    emoBoss.emotion === 'frustrated' || emoBoss.tone === 'serious',
    "Bug 1.1: 'my boss scolded me' classified with negative/serious emotion",
    `emotion=${emoBoss.emotion}, tone=${emoBoss.tone}`
  );

  const emoJob = EmotionalAnalyzer.analyzeEmotion("aaj mujhe job mil gayi!");
  testAssert(
    emoJob.emotion === 'excited' && emoJob.intensity > 0.8,
    "Bug 1.2: 'aaj mujhe job mil gayi!' classified as high-intensity excited",
    `emotion=${emoJob.emotion}, intensity=${emoJob.intensity}`
  );

  const resBoss = await s1.say("my boss scolded me");
  const s2 = createSpeaker('bug1-speaker-job');
  const resJob = await s2.say("aaj mujhe job mil gayi!");

  testAssert(
    resBoss !== resJob,
    "Bug 1.3: Boss scold and Job win produce distinct responses",
    `Boss: "${resBoss}" | Job: "${resJob}"`
  );

  testAssert(
    /rough|kya bola|what happened|sucks|daanta/i.test(resBoss),
    "Bug 1.4: Boss scold receives sympathetic validation",
    resBoss
  );

  testAssert(
    /party|huge|congratulations|banti|proud|what/i.test(resJob),
    "Bug 1.5: Job win receives high-energy celebration",
    resJob
  );

  // -------------------------------------------------------------
  // BUG 2: Tool calling and ambiguous queries (no fabrication)
  // -------------------------------------------------------------
  console.log("\n--- Testing Bug 2: Tool calling & ambiguous query clarification ---");
  const sTools = createSpeaker('bug2-speaker');

  const resAmbiguousWeather = await sTools.say("what is the weather in the City");
  testAssert(
    /which city|city name|kaunsi city/i.test(resAmbiguousWeather) && !/notable concept and subject of interest/i.test(resAmbiguousWeather),
    "Bug 2.1: 'what is the weather in the City' asks for city clarification and never fabricates",
    resAmbiguousWeather
  );

  const resRealWeather = await sTools.say("what is the weather in London");
  testAssert(
    /london|weather|celsius|degrees|temperature|sunny|clouds|rain/i.test(resRealWeather),
    "Bug 2.2: 'what is the weather in London' executes weather tool and returns factual weather",
    resRealWeather
  );

  // -------------------------------------------------------------
  // BUG 3: Verbatim-repeated fallback lines
  // -------------------------------------------------------------
  console.log("\n--- Testing Bug 3: Rotating fallback pool ---");
  const sFallbacks = createSpeaker('bug3-speaker');

  const fb1 = await sFallbacks.say("xyzabc12345 qwertys");
  const fb2 = await sFallbacks.say("xyzabc12345 qwertys again");
  const fb3 = await sFallbacks.say("xyzabc12345 qwertys third time");

  testAssert(
    fb1 !== fb2,
    "Bug 3.1: Fallback 1 and Fallback 2 are not identical",
    `FB1: "${fb1}" vs FB2: "${fb2}"`
  );
  testAssert(
    fb2 !== fb3,
    "Bug 3.2: Fallback 2 and Fallback 3 are not identical",
    `FB2: "${fb2}" vs FB3: "${fb3}"`
  );

  // -------------------------------------------------------------
  // BUG 4: Empathy beat before follow-up questions
  // -------------------------------------------------------------
  console.log("\n--- Testing Bug 4: Empathy on complete negative events ---");
  const sEmpathy = createSpeaker('bug4-speaker');

  const resFriendFight = await sEmpathy.say("aaj mera best friend se jhagada ho gaya usne mujhe dumb bola");
  testAssert(
    /sucks|hurts|dumb|fight|yaar|ouch|calling you dumb/i.test(resFriendFight) && !/following along! what happened next/i.test(resFriendFight),
    "Bug 4.1: Insult from best friend receives empathy validation before follow-up",
    resFriendFight
  );

  const resContinuation = await sEmpathy.say("Aur FIR");
  testAssert(
    /aur phir|phir kya hua|what happened next|batao/i.test(resContinuation),
    "Bug 4.2: 'Aur FIR' phonetically handled as story continuation prompt",
    resContinuation
  );

  console.log("\n================================================================");
  console.log(`SECTION 10b TESTS COMPLETED: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runSection10bTests();
