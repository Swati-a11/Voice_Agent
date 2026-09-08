import { ConversationManager } from '../server/dist/agent/conversation-manager.js';
import assert from 'assert';

console.log('--- RUNNING UNIVERSAL KNOWLEDGE & CONVERSATION FIXES TEST ---');

async function testScenario() {
  const manager = new ConversationManager('test-user-knowledge');

  // Test 1: Friend fight story — MUST NOT trigger professor hallucination
  console.log('\n[TEST 1] Friend Fight Story Flow');
  const turnsStory = [
    "I am doing great but I am little stressed out today",
    "with my friend",
    "I just had a fight with my friend",
    "she was very good to me",
    "but today she said something very hardful",
    "kuch nahi phir maine bhi usko bahut Kuchh bol diya ulta Sidha",
    "and then she is not talking to me right now"
  ];

  let lastResponse = '';
  for (const turn of turnsStory) {
    let responseText = '';
    manager.once('agent_speech_chunk', (chunk) => {
      if (!chunk.isFiller) responseText += chunk.text + ' ';
    });
    await manager.handleUserSpeech({ text: turn });
    lastResponse = responseText.trim();
    console.log(`User: "${turn}"\nAyra: "${lastResponse}"`);
  }

  assert(!lastResponse.toLowerCase().includes('professor'), `FAILED: Ayra mentioned professor in friend fight! Output: ${lastResponse}`);
  assert(!lastResponse.toLowerCase().includes('class ke saamne'), `FAILED: Ayra mentioned class ke saamne in friend fight! Output: ${lastResponse}`);
  console.log('✅ TEST 1 PASSED: Friend fight story did not trigger professor hallucination.');

  // Test 2: Interviewer Mode with Dynamic "I don't know"
  console.log('\n[TEST 2] Interviewer Roleplay Dynamic Q&A');
  const managerInterview = new ConversationManager('test-user-interview');

  const turnsInterview = [
    { input: "can you take my interview", check: (r) => r.toLowerCase().includes('interviewer') },
    { input: "one technical project on which I have worked is getting a voice agent from scratch", check: (r) => r.toLowerCase().includes('websocket') },
    { input: "I don't know answer of this", check: (r) => (r.toLowerCase().includes('websocket') || r.toLowerCase().includes('latency')) && r.toLowerCase().includes('graphql') },
    { input: "I don't know", check: (r) => r.toLowerCase().includes('graphql') && r.toLowerCase().includes('react') },
    { input: "can you keep my feedback of interview", check: (r) => r.toLowerCase().includes('feedback') || r.toLowerCase().includes('communicated') }
  ];

  for (const step of turnsInterview) {
    let responseText = '';
    managerInterview.on('agent_speech_chunk', (chunk) => {
      if (!chunk.isFiller) responseText += chunk.text + ' ';
    });
    await managerInterview.handleUserSpeech({ text: step.input });
    managerInterview.removeAllListeners('agent_speech_chunk');
    const finalResp = responseText.trim();
    console.log(`User: "${step.input}"\nAyra: "${finalResp}"\n`);
    assert(step.check(finalResp), `FAILED check for "${step.input}". Output was: "${finalResp}"`);
  }
  console.log('✅ TEST 2 PASSED: Interviewer roleplay gives dynamic, question-tailored explanations and feedback.');

  // Test 3: Teacher Roleplay & Universal Knowledge (Physics, Chemistry, Tech, Biology)
  console.log('\n[TEST 3] Teacher Roleplay & Universal Knowledge');
  const managerTeacher = new ConversationManager('test-user-teacher');

  const knowledgeQueries = [
    {
      input: "be my Physics teacher",
      check: (r) => r.toLowerCase().includes('teacher') || r.toLowerCase().includes('physics')
    },
    {
      input: "what is friction",
      check: (r) => r.toLowerCase().includes('friction') && (r.toLowerCase().includes('opposes') || r.toLowerCase().includes('resists') || r.toLowerCase().includes('motion')) && !r.toLowerCase().includes("can't check live")
    },
    {
      input: "explain p block in chemistry",
      check: (r) => (r.toLowerCase().includes('p-block') || r.toLowerCase().includes('p-orbital') || r.toLowerCase().includes('groups 13')) && !r.toLowerCase().includes("can't check live")
    },
    {
      input: "what is react",
      check: (r) => (r.toLowerCase().includes('javascript') || r.toLowerCase().includes('virtual dom') || r.toLowerCase().includes('component')) && !r.toLowerCase().includes("can't check live")
    },
    {
      input: "tell me about photosynthesis",
      check: (r) => (r.toLowerCase().includes('chloroplast') || r.toLowerCase().includes('sunlight') || r.toLowerCase().includes('glucose') || r.toLowerCase().includes('co2')) && !r.toLowerCase().includes("can't check live")
    },
    {
      input: "what is gravity",
      check: (r) => (r.toLowerCase().includes('mass') || r.toLowerCase().includes('spacetime') || r.toLowerCase().includes('attract')) && !r.toLowerCase().includes("can't check live")
    }
  ];

  for (const item of knowledgeQueries) {
    let responseText = '';
    managerTeacher.on('agent_speech_chunk', (chunk) => {
      if (!chunk.isFiller) responseText += chunk.text + ' ';
    });
    await managerTeacher.handleUserSpeech({ text: item.input });
    managerTeacher.removeAllListeners('agent_speech_chunk');
    const finalResp = responseText.trim();
    console.log(`User: "${item.input}"\nAyra: "${finalResp}"\n`);
    assert(item.check(finalResp), `FAILED check for "${item.input}". Output was: "${finalResp}"`);
  }
  console.log('✅ TEST 3 PASSED: Universal knowledge and Teacher roleplay successfully explain topics clearly like Google/tutor without false deflections.');

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
}

testScenario().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
