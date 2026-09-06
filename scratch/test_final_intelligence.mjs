import { ConversationManager } from '/Users/swatikumari/Desktop/voice_agent/server/dist/agent/conversation-manager.js';
import { IntentClassifier } from '/Users/swatikumari/Desktop/voice_agent/server/dist/agent/intent-classifier.js';

async function runTest() {
  console.log("====================================================");
  console.log("STARTING AYRA FINAL CONVERSATION INTELLIGENCE TEST");
  console.log("====================================================\n");

  const cm = new ConversationManager('user_test_final');
  let turnCount = 0;
  let passedCount = 0;

  async function testTurn(input, assertFn, description) {
    turnCount++;
    let responseText = '';
    
    const onChunk = (chunk) => {
      responseText += chunk.text;
    };
    cm.on('agent_speech_chunk', onChunk);

    try {
      await cm.handleUserSpeech({ text: input, durationMs: 400 });
      await new Promise(r => setTimeout(r, 50));
      
      cm.removeListener('agent_speech_chunk', onChunk);

      const pass = assertFn(responseText);
      if (pass) {
        passedCount++;
        console.log(`[PASS] Turn ${turnCount} (${input}) -> "${responseText.trim()}"`);
      } else {
        console.error(`[FAIL] Turn ${turnCount} (${input})\nExpected criteria for: ${description}\nGot: "${responseText.trim()}"`);
      }
      return responseText;
    } catch (err) {
      cm.removeListener('agent_speech_chunk', onChunk);
      console.error(`[ERROR] Turn ${turnCount} (${input}):`, err);
      return '';
    }
  }

  // 1. "Hi Ayra."
  await testTurn("Hi Ayra.", (r) => /hey|how are you|doing today/i.test(r), "Greeting response");

  // 2. "I am doing great today, I just completed my homework."
  await testTurn("I am doing great today, I just completed my homework.", (r) => /homework|satisfying|rest of your day|great/i.test(r) && !/not sure what you mean/i.test(r), "Homework completion acknowledgement");

  // 3. "Forget that. I want to tell you that tomorrow is my friend's birthday."
  await testTurn("Forget that. I want to tell you that tomorrow is my friend's birthday.", (r) => /friend'?s birthday|birthday is tomorrow|exciting|planned|what you want to do/i.test(r) && !/not sure what you mean/i.test(r), "Forget that + Friend birthday context");

  // 4. "Tomorrow is my friend's birthday."
  await testTurn("Tomorrow is my friend's birthday.", (r) => /friend'?s birthday|birthday is tomorrow|exciting|what you want to do/i.test(r) && !/not sure what you mean/i.test(r), "Friend birthday confirmation");

  // 5. "I am nervous today."
  await testTurn("I am nervous today.", (r) => /nervous|hear you|moment at a time|tough/i.test(r) && !/not sure what you mean/i.test(r), "Nervous feeling statement");

  // 6. "I had a fight with my friend."
  await testTurn("I had a fight with my friend.", (r) => /fight with your friend|explains why you've been feeling nervous|serious|disagreement/i.test(r) && !/stopped talking without explanation/i.test(r), "Fight with friend without fabrication");

  // 7. "Tomorrow I have an interview also."
  await testTurn("Tomorrow I have an interview also.", (r) => /explains a lot|fight with your friend.*?nervous.*?interview|interview tomorrow/i.test(r) && !/not sure what you mean/i.test(r), "Multi-topic synthesis (fight + nervous + interview)");

  // 8. "I have an interview tomorrow."
  await testTurn("I have an interview tomorrow.", (r) => /interview|sitting in the back of your mind|being nervous|what role/i.test(r), "Interview context retention");

  // 9. "It's for a machine learning developer job."
  await testTurn("It's for a machine learning developer job.", (r) => /machine learning developer|ml fundamentals|mock interview|makes sense/i.test(r) && !/subset of artificial intelligence/i.test(r), "ML developer role recognition (no ML definition)");

  // 10. "Actually, it's for a software developer role."
  await testTurn("Actually, it's for a software developer role.", (r) => /software developer|fundamentals|projects|problem-solving|coding/i.test(r), "Role correction to software developer");

  // 11. "I think I will not get this job."
  await testTurn("I think I will not get this job.", (r) => /don't reject yourself|interviewer|capable|mock interview/i.test(r), "Self-doubt reassurance & career support");

  // 12. "You're so annoying."
  await testTurn("You're so annoying.", (r) => /excuse me|annoying|harsh|what did i do/i.test(r), "Playful mock-hurt reaction to annoying");

  // 13. "Okay, then I like you."
  await testTurn("Okay, then I like you.", (r) => /lovable|know i'm pretty lovable|like/i.test(r), "Affection response");

  // 14. "Tell me some romantic quotes."
  await testTurn("Tell me some romantic quotes.", (r) => /romantic quote|ordinary days|perpetual feeling|remembering/i.test(r) && !/not sure what you mean/i.test(r), "Romantic quotes delivery");

  // 15. "What's happening in the world right now?"
  await testTurn("What's happening in the world right now?", (r) => /world|ai technology|space exploration|global|robotics|headlines/i.test(r) && !/not sure what you mean/i.test(r), "Current world information");

  // 16. "Can you tell me the future of AI in the upcoming five years?"
  await testTurn("Can you tell me the future of AI in the upcoming five years?", (r) => /five years|autonomous agents|multimodal|humanoid robotics|collaboration|forecasts/i.test(r) && !/not sure what you mean/i.test(r), "Future of AI in 5 years trend forecast");

  // 17. "Okay, good night."
  await testTurn("Okay, good night.", (r) => /good night|don't overthink that interview|sleep well|get some sleep/i.test(r), "Goodnight with interview callback");

  console.log(`\n====================================================`);
  console.log(`TEST RESULTS: Total: ${turnCount} | Passed: ${passedCount} | Failed: ${turnCount - passedCount}`);
  console.log(`====================================================\n`);

  if (passedCount === turnCount) {
    console.log("ALL 17 CONVERSATION TURNS PASSED PERFECTLY!");
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTest();
