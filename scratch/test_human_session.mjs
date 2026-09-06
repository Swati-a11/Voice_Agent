import { ConversationManager } from '/Users/swatikumari/Desktop/voice_agent/server/dist/agent/conversation-manager.js';
import { IntentClassifier } from '/Users/swatikumari/Desktop/voice_agent/server/dist/agent/intent-classifier.js';

let passed = 0;
let failed = 0;

function assert(condition, message, detail = '') {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message} - Detail: ${detail}`);
    failed++;
  }
}

async function runRealBrowserSession() {
  console.log('\n====================================================');
  console.log('TESTING REAL BROWSER 13-TURN CONVERSATION SESSION');
  console.log('====================================================');

  const manager = new ConversationManager({ userId: 'test-browser-user' });
  const turns = [
    {
      id: 1,
      input: "Hi Ayra.",
      check: (res) => /hey|how are you|good to hear/i.test(res),
      name: "Turn 1 (Greeting)"
    },
    {
      id: 2,
      input: "I had a really weird day today. I woke up tired and nervous and I don't even know why.",
      check: (res) => /weird feeling|tired|nervous|something bad/i.test(res),
      name: "Turn 2 (Personal emotional sharing - tired/nervous morning)"
    },
    {
      id: 3,
      input: "I just want to talk.",
      check: (res) => /right here|tell me what's on your mind|listening/i.test(res),
      name: "Turn 3 (Active listening without unsolicited advice)"
    },
    {
      id: 4,
      input: "Actually I have an interview tomorrow.",
      check: (res) => /interview|tomorrow|nervous|what role/i.test(res),
      name: "Turn 4 (Interview context tracking)"
    },
    {
      id: 5,
      input: "It's a web developer role.",
      check: (res) => /web developer|frontend|react|javascript/i.test(res),
      name: "Turn 5 (Web developer role context)"
    },
    {
      id: 6,
      input: "I think I'm not going to get the job.",
      check: (res) => /don't reject yourself|interviewer|web developer|mock/i.test(res),
      name: "Turn 6 (Interview anxiety reassurance + mock offer)"
    },
    {
      id: 7,
      input: "You are actually being nice today.",
      check: (res) => /compliment|nice|thank you|try my best/i.test(res),
      name: "Turn 7 (Playful reaction to compliment)"
    },
    {
      id: 8,
      input: "No, you're annoying.",
      check: (res) => /excuse me|annoying|harsh|what did i do/i.test(res),
      name: "Turn 8 (Playful reaction to 'No, you\'re annoying')"
    },
    {
      id: 9,
      input: "You are so rude.",
      check: (res) => /ouch|personal|rude|what did i do/i.test(res),
      name: "Turn 9 (Playful reaction to 'You are so rude')"
    },
    {
      id: 10,
      input: "Okay tell me a developer joke.",
      check: (res) => /dark mode|bugs|cache|binary|programmer|developer|javascript/i.test(res),
      name: "Turn 10 (Developer joke request)"
    },
    {
      id: 11,
      input: "Koi dusra.",
      check: (res) => /cache|binary|developer|bugs|programmer|null/i.test(res),
      name: "Turn 11 (Another developer joke via 'Koi dusra')"
    },
    {
      id: 12,
      input: "Sunao.",
      check: (res) => /binary|cache|bugs|programmer|null|scarecrow|noodle|skeletons/i.test(res),
      name: "Turn 12 (Joke continuation via 'Sunao')"
    },
    {
      id: 13,
      input: "Okay good night.",
      check: (res) => /good night|interview|sleep/i.test(res),
      name: "Turn 13 (Good night with interview context callback)"
    }
  ];

  for (const t of turns) {
    let responseText = '';
    const chunkListener = (data) => {
      responseText += (data.text || '');
    };
    manager.on('agent_speech_chunk', chunkListener);

    await manager.handleUserSpeech({ text: t.input });
    manager.off('agent_speech_chunk', chunkListener);

    assert(t.check(responseText), `${t.name} -> Ayra: "${responseText}"`, `Input: ${t.input} | Received: ${responseText}`);
  }
}

async function run30RegressionTests() {
  console.log('\n====================================================');
  console.log('TESTING 30 REGRESSION TEST CASES');
  console.log('====================================================');

  const manager = new ConversationManager({ userId: 'test-reg-user' });

  async function getResponse(input) {
    let responseText = '';
    const chunkListener = (data) => {
      responseText += (data.text || '');
    };
    manager.on('agent_speech_chunk', chunkListener);
    await manager.handleUserSpeech({ text: input });
    manager.off('agent_speech_chunk', chunkListener);
    return responseText;
  }

  // 1. Personal emotional story
  let r = await getResponse("Aaj subah main uthi aur Myntra khola because mujhe ek top order karna tha but mera size available nahi tha.");
  assert(/myntra|top|size|unavailable/i.test(r), "Test 1: Personal emotional story (Myntra top size)");

  // 2. User only wants to talk
  r = await getResponse("I just want to talk.");
  assert(/right here|on your mind|listening/i.test(r), "Test 2: User only wants to talk (no unsolicited advice)");

  // 3. User asks for advice
  r = await getResponse("Actually I want to buy a dress to cheer myself up, give me some advice.");
  assert(/cart|impulse|advice|wait/i.test(r), "Test 3: User asks for advice (shopping dilemma advice)");

  // 4. Interview anxiety
  r = await getResponse("I have an interview tomorrow.");
  assert(/interview|tomorrow|nervous|role/i.test(r), "Test 4: Interview anxiety");

  // 5. Web developer interview context
  r = await getResponse("It's a web developer role.");
  assert(/web developer|frontend|react|javascript/i.test(r), "Test 5: Web developer interview context");

  // 6. "I won't get this job"
  r = await getResponse("I think I won't get this job.");
  assert(/don't reject yourself|interviewer|capable|mock/i.test(r), "Test 6: 'I won\'t get this job' reassurance");

  // 7. STT error for nervous ("very lovers today")
  const sttNorm = IntentClassifier.normalizeSTTErrors("I have an interview tomorrow and I am very lovers today");
  assert(/very nervous today/i.test(sttNorm), "Test 7: STT error for nervous ('very lovers today' -> 'very nervous today')");

  // 8. "You are rude"
  r = await getResponse("You are so rude.");
  assert(/ouch|personal|rude|what did i do/i.test(r) && !/okay, fair/i.test(r), "Test 8: 'You are so rude' natural social reaction");

  // 9. "You are annoying"
  r = await getResponse("You are so annoying.");
  assert(/excuse me|annoying|harsh|what did i do/i.test(r), "Test 9: 'You are so annoying' playful reaction");

  // 10. Compliment
  r = await getResponse("You are actually being nice today.");
  assert(/compliment|nice|thank you|try my best/i.test(r), "Test 10: Compliment reaction");

  // 11. Affection ("Do you like me?")
  r = await getResponse("Do you like me?");
  assert(/enjoy talking to you|fun to talk to|like/i.test(r) && !/not sure what you mean/i.test(r), "Test 11: Affection ('Do you like me?')");

  // 12. Developer joke
  r = await getResponse("Tell me a funny developer joke.");
  assert(/dark mode|bugs|cache|binary|developer|programmer/i.test(r), "Test 12: Developer joke");

  // 13. Another developer joke
  r = await getResponse("Koi dusra joke.");
  assert(/cache|binary|dark mode|programmer|developer|null/i.test(r), "Test 13: Another developer joke ('Koi dusra joke')");

  // 14. "Sunao" after joke
  r = await getResponse("Sunao.");
  assert(/binary|cache|programmer|null|scarecrow|noodle/i.test(r), "Test 14: 'Sunao' after joke continues joke mode");

  // 15. Emotional context -> joke request
  r = await getResponse("I am feeling really sad, but tell me a joke.");
  assert(/joke|eggs|scarecrow|noodle|skeletons|bicycle|programmer/i.test(r), "Test 15: Emotional context + joke request executes joke");

  // 16. Story request
  r = await getResponse("Tell me a story.");
  assert(/library|volcano|observatory|ocean|clock/i.test(r), "Test 16: Story request");

  // 17. Long space story request
  r = await getResponse("Tell me a long space exploration story.");
  assert(/astronomical library|volcano|constellation|observatory/i.test(r), "Test 17: Long space exploration story");

  // 18. STOP -> new topic
  r = await getResponse("Stop. Tell me about artificial intelligence.");
  assert(/artificial intelligence|computer science|reasoning|learning/i.test(r), "Test 18: STOP -> new topic ('artificial intelligence')");

  // 19. "cats instead"
  r = await getResponse("Stop. Tell me about cats instead.");
  assert(/cats|felines|purr/i.test(r) && !/not sure what you mean/i.test(r), "Test 19: Context switch ('cats instead')");

  // 20. "I meant the other person"
  r = await getResponse("No, I meant the other person.");
  assert(/who was the person|who do you mean|my bad/i.test(r), "Test 20: Referent correction ('I meant the other person')");

  // 21. "Dubai" ambiguity
  r = await getResponse("Dubai");
  assert(/dubai/i.test(r) && !/not sure what you mean/i.test(r), "Test 21: 'Dubai' single-word context handling");

  // 22. Good night
  r = await getResponse("Good night.");
  assert(/good night|sleep well|rest/i.test(r), "Test 22: Good night handling");

  // 23. Repeated good night
  await new Promise(res => setTimeout(res, 50));
  r = await getResponse("Good night.");
  assert(/okay okay|good night|sleep well/i.test(r), "Test 23: Repeated good night");

  // 24. Goodbye + new question
  r = await getResponse("Actually before going, what is the capital of France?");
  assert(/paris/i.test(r), "Test 24: Goodbye + factual question ('capital of France' -> 'Paris')");

  // 25. Old response contamination
  r = await getResponse("What is Google?");
  assert(/google/i.test(r) && !/paris|interview|joke/i.test(r), "Test 25: Old response contamination check (Clean 'What is Google')");

  // 26. Latest-turn intent priority
  r = await getResponse("Actually no, tell me something else.");
  assert(/what's on your mind|what do you want to talk about|batao kya baat|new topic|tell you about/i.test(r), "Test 26: Latest-turn intent priority (Topic change)");

  // 27. Hindi / Hinglish story understanding
  r = await getResponse("Aaj subah mujhe ek bahut ajeeb incident hua.");
  assert(/ajeeb|subah|incident|kya hua|अजीब|सुबह/i.test(r), "Test 27: Hindi personal story understanding");

  // 28. Hinglish
  r = await getResponse("Kal college mein na ek bahut funny incident hua, phir mera friend literally floor pe gir gaya laughing.");
  assert(/floor|gir gaya|has|college/i.test(r), "Test 28: Hinglish funny incident understanding");

  // 29. English
  r = await getResponse("When I was a kid, I used to hide under my bed whenever guests came home.");
  assert(/hide|bed|guests|introvert/i.test(r), "Test 29: English childhood memory understanding");

  // 30. No-question-every-turn behavior
  r = await getResponse("My sister finally got the college she wanted.");
  assert(/amazing|huge|happy for her|congratulations|proud/i.test(r) && !r.trim().endsWith('?'), "Test 30: No-question-every-turn celebration (does not end with question)");
}

async function main() {
  await runRealBrowserSession();
  await run30RegressionTests();

  console.log('\n====================================================');
  console.log(`AUDIT SUMMARY: Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
