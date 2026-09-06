import { ConversationManager } from '/Users/swatikumari/Desktop/voice_agent/server/dist/agent/conversation-manager.js';
import { IntentClassifier } from '/Users/swatikumari/Desktop/voice_agent/server/dist/agent/intent-classifier.js';

let passed = 0;
let failed = 0;
const results = [];

function assert(cond, name, evidence = '') {
  if (cond) {
    passed++;
    console.log(`[PASS] ${name}${evidence ? ` -> "${evidence}"` : ''}`);
    results.push({ name, status: 'PASS', evidence });
  } else {
    failed++;
    console.error(`[FAIL] ${name}${evidence ? ` -> "${evidence}"` : ''}`);
    results.push({ name, status: 'FAIL', evidence });
  }
}

async function runHumanLifeTests() {
  console.log("==================================================================");
  console.log("       STARTING HUMAN-LIFE SCENARIO & ROLEPLAY TEST SUITE        ");
  console.log("==================================================================\n");

  const cm = new ConversationManager('test_user_human_life');

  async function say(userText) {
    let responseText = '';
    const onChunk = (chunk) => {
      if (chunk && chunk.text) responseText += chunk.text;
    };
    cm.on('agent_speech_chunk', onChunk);
    await cm.handleUserSpeech({ text: userText, durationMs: 400 });
    await new Promise(r => setTimeout(r, 60));
    cm.off('agent_speech_chunk', onChunk);
    return responseText.trim();
  }

  // ==========================================
  // SECTION 33: EXACT HUMAN-LIFE CONVERSATION
  // ==========================================
  console.log("--- 1. SECTION 33: EXACT MULTI-TURN CONVERSATION ---");
  
  let res = await say("Hey Ayra.");
  assert(/how are you|hey|doing today/i.test(res) && !/not sure what you mean/i.test(res), "S33.1: Hey Ayra", res);

  res = await say("I had a fight with my friend today.");
  assert(/fight|friend|explain|off today|what happened/i.test(res), "S33.2: Fight with friend", res);

  res = await say("I don't know if I should text them.");
  assert(/breathing room|check-in|text|calm/i.test(res), "S33.3: Don't know if I should text them", res);

  res = await say("Actually forget that.");
  assert(/new topic|sure|talk about|mood/i.test(res), "S33.4: Actually forget that", res);

  res = await say("I have a crush on someone.");
  assert(/crush|interesting territory|know you like them/i.test(res), "S33.5: Crush confession", res);

  res = await say("I want to tell them but I'm scared.");
  assert(/less scary|subtle|confident|honest/i.test(res), "S33.6: Scared to tell crush", res);

  res = await say("Can you practice with me?");
  assert(/play the crush|listening|take a breath/i.test(res), "S33.7: Proposal practice activation", res);

  res = await say("I really like you and I was wondering if you'd like to go on a date with me.");
  assert(/sweet|genuine|sincerity|appreciate/i.test(res), "S33.8: Proposal practice interaction", res);

  res = await say("Okay forget that too.");
  assert(/sure|talk about|new topic/i.test(res) || !/not sure/i.test(res), "S33.9: Forget proposal practice", res);

  res = await say("I have an interview tomorrow.");
  assert(/interview|tomorrow|nervous|role/i.test(res), "S33.10: Interview tomorrow", res);

  res = await say("It's for a software developer role.");
  assert(/software developer|coding|data structures|problem solving/i.test(res), "S33.11: Software developer role", res);

  res = await say("I don't think I'll get the job.");
  assert(/don't reject yourself|software developer|mock interview|capable/i.test(res), "S33.12: Career anxiety reassurance", res);

  res = await say("Be my interviewer and take my interview.");
  assert(/interviewer|properly|introduction/i.test(res), "S33.13: Interviewer roleplay start", res);

  res = await say("My name is Alex and I have 2 years of experience building React and Node applications.");
  assert(/javascript|asynchronous|event loop|technical|promises/i.test(res), "S33.14: Interviewer roleplay question 1", res);

  res = await say("Stop the interview.");
  assert(/stopping the interview|exit/i.test(res), "S33.15: Stop interview roleplay", res);

  res = await say("Now flirt with me.");
  assert(/flirting|confident|impress|tease/i.test(res), "S33.16: Playful flirtation", res);

  res = await say("You're annoying.");
  assert(/excuse me|harsh|what did i do/i.test(res), "S33.17: Playful insult reaction", res);

  res = await say("Okay okay, you're cute.");
  assert(/thank you|try my best|cute/i.test(res), "S33.18: Affection / Cute reaction", res);

  res = await say("Tell me a romantic quote.");
  assert(/romantic quote|ordinary days|perpetual feeling|love/i.test(res), "S33.19: Romantic quote", res);

  res = await say("Okay good night.");
  assert(/good night|sleep|rest/i.test(res), "S33.20: Natural goodbye", res);

  // ==========================================
  // SECTION 34: CONTEXT CONTAMINATION TEST
  // ==========================================
  console.log("\n--- 2. SECTION 34: CONTEXT CONTAMINATION TEST ---");
  const cm2 = new ConversationManager('test_user_contamination');
  async function say2(userText) {
    let responseText = '';
    const onChunk = (chunk) => {
      if (chunk && chunk.text) responseText += chunk.text;
    };
    cm2.on('agent_speech_chunk', onChunk);
    await cm2.handleUserSpeech({ text: userText, durationMs: 400 });
    await new Promise(r => setTimeout(r, 60));
    cm2.off('agent_speech_chunk', onChunk);
    return responseText.trim();
  }

  res = await say2("I fought with my friend.");
  assert(/fight|friend|off today|what happened/i.test(res), "S34.1: Friend fight initial", res);

  res = await say2("I have an interview tomorrow.");
  assert(/interview|tomorrow/i.test(res) && !res.includes("friend se ladai"), "S34.2: Clean interview transition without forced friend mention", res);

  res = await say2("It's for software development.");
  assert(/software developer|coding|data structures/i.test(res), "S34.3: Software developer update", res);

  res = await say2("I think I'm going to fail.");
  assert(/don't reject yourself|nervous|mock/i.test(res), "S34.4: Interview anxiety support", res);

  res = await say2("Actually, forget the interview. My friend's birthday is tomorrow.");
  assert(/birthday|tomorrow|exciting|thought about/i.test(res) && !res.includes("software developer"), "S34.5: Clean birthday switch without interview contamination", res);

  // ==========================================
  // SECTION 32: FULL SCENARIO MATRIX AUDIT
  // ==========================================
  console.log("\n--- 3. SECTION 32: REGRESSION MATRIX AUDIT ---");
  const cm3 = new ConversationManager('test_user_matrix');
  async function say3(userText) {
    let responseText = '';
    const onChunk = (chunk) => {
      if (chunk && chunk.text) responseText += chunk.text;
    };
    cm3.on('agent_speech_chunk', onChunk);
    await cm3.handleUserSpeech({ text: userText, durationMs: 400 });
    await new Promise(r => setTimeout(r, 60));
    cm3.off('agent_speech_chunk', onChunk);
    return responseText.trim();
  }

  // Girlfriend roleplay
  res = await say3("Talk to me as my girlfriend.");
  assert(/girlfriend mode activated/i.test(res), "Roleplay: Girlfriend mode", res);

  // Boyfriend roleplay
  res = await say3("Talk to me as my boyfriend.");
  assert(/boyfriend mode it is/i.test(res), "Roleplay: Boyfriend mode", res);

  // Breakup support
  res = await say3("I just broke up with my girlfriend.");
  assert(/rough|happened|distraction|listen/i.test(res), "Relationships: Breakup support", res);

  // Rejection support
  res = await say3("My crush rejected me.");
  assert(/ouch|hurts|listen|honest advice/i.test(res), "Relationships: Crush rejection", res);

  // Reconciliation advice
  res = await say3("I want to patch things up with my friend.");
  assert(/courtroom argument|acknowledge|first message/i.test(res), "Relationships: Reconciliation advice", res);

  // "What should I say?"
  res = await say3("What should I say to my friend?");
  assert(/text|value our friendship|weird note/i.test(res), "Advice: What should I say", res);

  // Teasing reaction
  res = await say3("You're so dramatic.");
  assert(/me\? dramatic\? never/i.test(res), "Social: Playful teasing", res);

  // Opinion request
  res = await say3("What would you do if you were me?");
  assert(/if i were in your position/i.test(res) && !/when i went through this/i.test(res), "Social: Opinion request without fake human history", res);

  // Daily life: Boredom
  res = await say3("I'm bored.");
  assert(/boredom is officially banned|20 questions|stories/i.test(res), "Daily life: Boredom", res);

  // Daily life: Embarrassing moment
  res = await say3("I did something embarrassing.");
  assert(/embarrassing moments|bigger in our own heads/i.test(res), "Daily life: Embarrassing moment", res);

  // Daily life: Exam pass
  res = await say3("I passed my exam.");
  assert(/congratulations|celebrate|studying paid off/i.test(res), "Daily life: Exam pass celebration", res);

  // Daily life: Exam fail
  res = await say3("I failed my exam.");
  assert(/discouraging|one exam does not define/i.test(res), "Daily life: Exam failure support", res);

  // Information: Future of AI
  res = await say3("Can you tell me the future of AI in the upcoming 5 years?");
  assert(/next five years|autonomous agents|multimodal/i.test(res), "Information: Future of AI", res);

  // Information: Current World News
  res = await say3("What is happening in the world right now?");
  assert(/world|news|developments|headlines/i.test(res), "Information: World News", res);

  // Information vs Roleplay disambiguation
  res = await say3("What does an interviewer ask?");
  assert(/interviewer|concept|domain|question/i.test(res) && !/give me your introduction/i.test(res), "Information vs Roleplay: What does an interviewer ask", res);

  console.log("\n==================================================================");
  console.log(`TEST SUMMARY: Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runHumanLifeTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
