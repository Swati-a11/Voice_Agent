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

async function runFinalContextResolverSuite() {
  console.log('================================================================');
  console.log('AYRA FINAL CONTEXT RESOLVER & STT REPAIR TEST SUITE');
  console.log('================================================================\n');

  // --- Part 1: STT Semantic Repair Layer ---
  console.log('--- Part 1: STT Semantic Repair Layer ---');
  const stt1 = IntentClassifier.normalizeSTTErrors("my friend was route to me today");
  testAssert(/rude to me/i.test(stt1), "STT: 'route to me' -> 'rude to me'");

  const stt2 = IntentClassifier.normalizeSTTErrors("do you think I should approach");
  testAssert(/apologize/i.test(stt2), "STT: 'should approach' -> 'apologize'");

  const stt3 = IntentClassifier.normalizeSTTErrors("I have to apply to her");
  testAssert(/apologize to her/i.test(stt3), "STT: 'apply to her' -> 'apologize to her'");

  const stt4 = IntentClassifier.normalizeSTTErrors("pretend your my interview I am applying for a software developer rule");
  testAssert(/you're my interviewer/i.test(stt4) && /developer role/i.test(stt4), "STT: 'your my interview' & 'rule' repaired");

  const stt5 = IntentClassifier.normalizeSTTErrors("I said some really hard things back");
  testAssert(/harsh things back/i.test(stt5), "STT: 'hard things back' -> 'harsh things back'");

  const stt6 = IntentClassifier.normalizeSTTErrors("what's happening in the world right now that you think I should actually no about");
  testAssert(/actually know about/i.test(stt6), "STT: 'no about' -> 'know about'");

  // --- Part 2: Conversation A (Interview Anxiety & Role Resolution) ---
  console.log('\n--- Part 2: Conversation A (Interview Anxiety & Role Resolution) ---');
  const cmA = new ConversationManager({ userId: 'test-conv-a' });
  async function sayA(text) {
    let responseText = '';
    const chunkListener = (data) => { responseText += (data.text || ''); };
    cmA.on('agent_speech_chunk', chunkListener);
    await cmA.handleUserSpeech({ text });
    cmA.off('agent_speech_chunk', chunkListener);
    return responseText.trim();
  }

  const a1 = await sayA("I am feeling very nervous today. I have an interview tomorrow and honestly I'm scared I'll mess up.");
  testAssert(/nervous|role|interview/i.test(a1), "Conv A Turn 1: Ayra recognizes interview anxiety & asks role", `Received: "${a1}"`);

  const a2 = await sayA("It is the role of software developer.");
  testAssert(/software developer|fundamentals|projects|problem-solving|problem solving|mock/i.test(a2) && !/not sure/i.test(a2), "Conv A Turn 2: Understood role answer & gives targeted preparation advice", `Received: "${a2}"`);

  // --- Part 3: Conversation B (Friend Conflict Continuation) ---
  console.log('\n--- Part 3: Conversation B (Friend Conflict Continuation) ---');
  const cmB = new ConversationManager({ userId: 'test-conv-b' });
  async function sayB(text) {
    let responseText = '';
    const chunkListener = (data) => { responseText += (data.text || ''); };
    cmB.on('agent_speech_chunk', chunkListener);
    await cmB.handleUserSpeech({ text });
    cmB.off('agent_speech_chunk', chunkListener);
    return responseText.trim();
  }

  const b1 = await sayB("I just had a fight with my best friend.");
  testAssert(/what happened|yaar/i.test(b1), "Conv B Turn 1: Ayra reacts with 'Ahh yaar. What happened?'", `Received: "${b1}"`);

  const b2 = await sayB("my friend was route to me today but I also said some really hard things back do you think I should approach");
  testAssert(/apologize|what she said|both sides|fault|blame/i.test(b2) && !/not sure|mood for/i.test(b2), "Conv B Turn 2: Robust STT repair and balanced friendship advice", `Received: "${b2}"`);

  // --- Part 4: Conversation C (Apology Understanding & Balanced Context) ---
  console.log('\n--- Part 4: Conversation C (Apology Understanding & Balanced Context) ---');
  const cmC = new ConversationManager({ userId: 'test-conv-c' });
  async function sayC(text) {
    let responseText = '';
    const chunkListener = (data) => { responseText += (data.text || ''); };
    cmC.on('agent_speech_chunk', chunkListener);
    await cmC.handleUserSpeech({ text });
    cmC.off('agent_speech_chunk', chunkListener);
    return responseText.trim();
  }

  const c1 = await sayC("I said some really bad things to her. So I have to apply to her?");
  testAssert(/apologize|apology|harsh|fault|what she said/i.test(c1) && !/not sure/i.test(c1), "Conv C: Understands apology question despite 'apply' STT error", `Received: "${c1}"`);

  // --- Part 5: Conversation D (Explicit Interview Mode Activation with STT Error) ---
  console.log('\n--- Part 5: Conversation D (Interview Mode Activation) ---');
  const cmD = new ConversationManager({ userId: 'test-conv-d' });
  async function sayD(text) {
    let responseText = '';
    const chunkListener = (data) => { responseText += (data.text || ''); };
    cmD.on('agent_speech_chunk', chunkListener);
    await cmD.handleUserSpeech({ text });
    cmD.off('agent_speech_chunk', chunkListener);
    return responseText.trim();
  }

  const d1 = await sayD("pretend your my interview I am applying for a software developer rule take for interview one question at a time and give me honest feedback");
  testAssert(/interviewer|properly|one question at a time|honest|about yourself/i.test(d1), "Conv D: Enters INTERVIEW mode with one-at-a-time honest feedback", `Received: "${d1}"`);

  // --- Part 6: Conversation E (Contextual "Explain." Single-Word Follow-Up) ---
  console.log('\n--- Part 6: Conversation E (Contextual "Explain." Single-Word Follow-Up) ---');
  const cmE = new ConversationManager({ userId: 'test-conv-e' });
  async function sayE(text) {
    let responseText = '';
    const chunkListener = (data) => { responseText += (data.text || ''); };
    cmE.on('agent_speech_chunk', chunkListener);
    await cmE.handleUserSpeech({ text });
    cmE.off('agent_speech_chunk', chunkListener);
    return responseText.trim();
  }

  await sayE("Explain React Hooks to me like I'm preparing for a technical interview.");
  const e2 = await sayE("Explain.");
  testAssert(/hooks|usestate|useeffect|components|lifecycle|functional/i.test(e2) && !/tell me more—what were you thinking/i.test(e2), "Conv E: Single-word 'Explain.' resolves to active React Hooks context", `Received: "${e2}"`);

  // --- Part 7: Conversation F (Current World Information) ---
  console.log('\n--- Part 7: Conversation F (Current World Information) ---');
  const cmF = new ConversationManager({ userId: 'test-conv-f' });
  async function sayF(text) {
    let responseText = '';
    const chunkListener = (data) => { responseText += (data.text || ''); };
    cmF.on('agent_speech_chunk', chunkListener);
    await cmF.handleUserSpeech({ text });
    cmF.off('agent_speech_chunk', chunkListener);
    return responseText.trim();
  }

  const f1 = await sayF("What's happening in the world right now that you think I should actually no about");
  testAssert(/world|developments|headlines|technology|ai|economic|global/i.test(f1) && !/mood for|random interesting topic/i.test(f1), "Conv F: Current world information answered directly with live summary", `Received: "${f1}"`);

  // --- Part 8: Pronoun Resolution in Multi-turn Dialogue ---
  console.log('\n--- Part 8: Pronoun Resolution in Multi-turn Dialogue ---');
  const cmG = new ConversationManager({ userId: 'test-conv-g' });
  async function sayG(text) {
    let responseText = '';
    const chunkListener = (data) => { responseText += (data.text || ''); };
    cmG.on('agent_speech_chunk', chunkListener);
    await cmG.handleUserSpeech({ text });
    cmG.off('agent_speech_chunk', chunkListener);
    return responseText.trim();
  }

  const g1 = await sayG("My friend was rude to me.");
  testAssert(/what did she say|what happened/i.test(g1), "Pronoun Turn 1: Asks what friend said", `Received: "${g1}"`);

  const g2 = await sayG("She said I never listen.");
  testAssert(/what did you say|say back|respond/i.test(g2), "Pronoun Turn 2: Gathers user response without asking 'Who is she?'", `Received: "${g2}"`);

  const g3 = await sayG("I said some harsh things.");
  testAssert(/what did you say to her|escalat|harsh|apologize|both/i.test(g3), "Pronoun Turn 3: Resolves 'she' to friend seamlessly", `Received: "${g3}"`);

  console.log('\n================================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');
}

runFinalContextResolverSuite().catch(console.error);
