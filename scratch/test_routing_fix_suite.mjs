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

async function runRoutingTestSuite() {
  console.log('====================================================');
  console.log('AYRA CRITICAL CONVERSATION ROUTING & CONTEXT ENGINE TEST SUITE');
  console.log('====================================================');

  // 1. Test STT Normalization
  console.log('\n--- Part 1: Imperfect STT Semantic Recovery ---');
  const stt1 = IntentClassifier.normalizeSTTErrors("what's happening in the world right now that you think I should actually no about");
  testAssert(/know about/i.test(stt1), "STT: 'actually no about' -> 'actually know about'");

  const stt2 = IntentClassifier.normalizeSTTErrors("I'm feeling really never today because I have an interview");
  testAssert(/nervous/i.test(stt2), "STT: 'really never today' -> 'nervous'");

  const stt3 = IntentClassifier.normalizeSTTErrors("scared I'll message up in the interview");
  testAssert(/mess up/i.test(stt3), "STT: 'message up' -> 'mess up'");

  const stt4 = IntentClassifier.normalizeSTTErrors("my friend was me today but I also said some really Harsh since back do you think I should apologize");
  testAssert(/rude to me today/i.test(stt4) && /harsh things back/i.test(stt4), "STT: 'was me today' & 'harsh since back' recovered");

  const stt5 = IntentClassifier.normalizeSTTErrors("it is for a software developer road");
  testAssert(/software developer role/i.test(stt5), "STT: 'developer road' -> 'developer role'");

  const stt6 = IntentClassifier.normalizeSTTErrors("whose for is it");
  testAssert(/whose fault/i.test(stt6), "STT: 'whose for' -> 'whose fault'");

  // 2. Test Intent Classification for Critical Queries
  console.log('\n--- Part 2: Hard Intent Routing & Web Triggering ---');
  const query1 = "What’s happening in the world right now that you think I should actually know about?";
  const class1 = IntentClassifier.classifyDetailed(query1);
  testAssert(class1.intent === 'current_information' && class1.requiresWebSearch === true, "Intent: 'What’s happening in the world...' -> current_information + webSearch");

  const webCheck1 = WebSearchService.isCurrentInformationQuery(query1);
  testAssert(webCheck1 === true, "WebSearchService: isCurrentInformationQuery returns true");

  const query2 = "Explain React Hooks to me like I'm preparing for a technical interview.";
  const class2 = IntentClassifier.classifyDetailed(query2);
  testAssert(class2.intent === 'explanation_request' || class2.userIntent === 'QUESTION', "Intent: 'Explain React Hooks...' -> technical explanation request");

  const query3 = "Actually, I'm exhausted. Let's just talk normally.";
  const class3 = IntentClassifier.classifyDetailed(query3);
  testAssert(class3.conversationMode === 'GENERAL_CHAT', "Intent: 'Actually, I'm exhausted...' -> GENERAL_CHAT");

  // 3. Test The 6 Exact Regression Turns in a Live Conversation Session
  console.log('\n--- Part 3: EXACT 6-TURN REGRESSION SESSION (Section 25) ---');
  const manager = new ConversationManager({ userId: 'test-exact-regression' });

  async function getResponse(text) {
    let responseText = '';
    const chunkListener = (data) => {
      responseText += (data.text || '');
    };
    manager.on('agent_speech_chunk', chunkListener);
    await manager.handleUserSpeech({ text });
    manager.off('agent_speech_chunk', chunkListener);
    return responseText;
  }

  // Turn 1
  const t1 = await getResponse("I’m feeling really nervous today. I have an interview tomorrow and honestly I’m scared I’ll mess up. What should I do?");
  testAssert(/interview|nervous|mess up|sleep|topics|role/i.test(t1), "TURN 1: Interview anxiety & advice", `Received: "${t1}"`);

  // Turn 2
  const t2 = await getResponse("Forget it. I just had a fight with my best friend. Let me tell you what happened.");
  testAssert(/forget the interview|what happened with your friend|what happened/i.test(t2) && !/mood for|random interesting topic/i.test(t2), "TURN 2: Switch to FRIEND_CONFLICT without robotic fallback", `Received: "${t2}"`);

  // Turn 3
  const t3 = await getResponse("my friend was me today but I also said some really Harsh since back do you think I should apologize");
  testAssert(/apologize|what she said|what you said|both sides|fault/i.test(t3), "TURN 3: Imperfect STT understood & conflict evaluation", `Received: "${t3}"`);

  // Turn 4
  const t4 = await getResponse("What’s happening in the world right now that you think I should actually no about");
  testAssert(/world|ai|developments|headlines|technology|global/i.test(t4) && !/mood for|random interesting topic/i.test(t4), "TURN 4: CURRENT_INFORMATION answered directly without fallback", `Received: "${t4}"`);

  // Turn 5
  const t5 = await getResponse("Explain React Hooks to me like I'm preparing for a technical interview.");
  testAssert(/hooks|usestate|useeffect|components|lifecycle|state/i.test(t5), "TURN 5: Technical React Hooks interview explanation", `Received: "${t5}"`);

  // Turn 6
  const t6 = await getResponse("Actually, I'm exhausted. Let's just talk normally.");
  testAssert(/long day|relax|what's on your mind|kick back|take it easy/i.test(t6) && !/mood for|random interesting topic/i.test(t6), "TURN 6: GENERAL_CHAT natural conversation", `Received: "${t6}"`);

  // 4. Test Roleplay Interruptibility & Priority (Section 21)
  console.log('\n--- Part 4: Roleplay Non-Stickiness & Immediate Exit ---');
  const manager2 = new ConversationManager({ userId: 'test-roleplay-exit' });
  async function getResponse2(text) {
    let responseText = '';
    const chunkListener = (data) => {
      responseText += (data.text || '');
    };
    manager2.on('agent_speech_chunk', chunkListener);
    await manager2.handleUserSpeech({ text });
    manager2.off('agent_speech_chunk', chunkListener);
    return responseText;
  }

  const rp1 = await getResponse2("Pretend you're my interviewer.");
  testAssert(/interviewer|introduction/i.test(rp1), "Roleplay Step 1: Interviewer starts");

  const rp2 = await getResponse2("I'm Swati Kumari.");
  testAssert(/technical|fundamentals|asynchronous|event loop|project|introduction/i.test(rp2), "Roleplay Step 2: Follows up on interview");

  const rp3 = await getResponse2("Actually, I have a crush on someone and I'm scared they'll reject me.");
  testAssert(/crush|rejection|proposal|dramatic|forget the interview/i.test(rp3) && !/technical fundamentals|next question/i.test(rp3), "Roleplay Step 3: Immediately exits interview on crush confession", `Received: "${rp3}"`);

  // 5. Test Physical Harm & Safety (Section 8)
  console.log('\n--- Part 5: Physical Aggression Recognition ---');
  const safeRes = await getResponse2("She slapped me.");
  testAssert(/slapped you|safe right now|not okay/i.test(safeRes), "Safety: 'She slapped me' triggers immediate safety check", `Received: "${safeRes}"`);

  // 6. Test Personal Sharing First-Class (Section 5)
  console.log('\n--- Part 6: Personal Sharing Intent ---');
  const share1 = await getResponse2("My boss humiliated me in front of everyone.");
  testAssert(/what happened|humiliated|embarrassing/i.test(share1) && !/how can i help/i.test(share1), "Personal Sharing: Boss humiliation", `Received: "${share1}"`);

  const share2 = await getResponse2("My teacher kicked me out of class.");
  testAssert(/kick you out|what happened/i.test(share2), "Personal Sharing: Teacher kicked out", `Received: "${share2}"`);

  const share3 = await getResponse2("I got selected for the internship!");
  testAssert(/selected|win|proud|happy|big/i.test(share3), "Personal Sharing: Selected celebration", `Received: "${share3}"`);

  console.log('\n====================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runRoutingTestSuite().catch(err => {
  console.error(err);
  process.exit(1);
});
