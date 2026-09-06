import { ConversationManager } from '../server/dist/agent/conversation-manager.js';

async function runConversations() {
  console.log("=================================================");
  console.log("AYRA MULTI-TURN HUMAN CONVERSATION BENCHMARKS");
  console.log("=================================================\n");

  // Helper to talk to a manager
  async function simulateTurn(manager, userText) {
    let responseText = '';
    const onChunk = (chunk) => {
      if (chunk.text && !chunk.isFiller) responseText += chunk.text;
    };
    manager.on('agent_speech_chunk', onChunk);
    await manager.handleUserSpeech({ text: userText });
    manager.off('agent_speech_chunk', onChunk);
    return responseText;
  }

  // ==========================================
  // CONVERSATION A: English Personal Story
  // ==========================================
  console.log("-------------------------------------------------");
  console.log("CONVERSATION A: English Personal Story (5 Turns)");
  console.log("-------------------------------------------------");
  const managerA = new ConversationManager({ userId: 'user-english-story' });

  const turnsA = [
    "I'm feeling a little overwhelmed today.",
    "My whole morning was horrible. I woke up with severe cramps and realized I didn't even have what I needed in my room.",
    "Then when I went to make tea, the milk was spoiled, and I was already running late.",
    "I was telling my friend about Google careers later and we ended up in an argument.",
    "Bas, then eventually we calmed down and everything got sorted out."
  ];

  for (let i = 0; i < turnsA.length; i++) {
    const user = turnsA[i];
    const agent = await simulateTurn(managerA, user);
    console.log(`[Turn ${i + 1}] User : "${user}"`);
    console.log(`         Ayra : "${agent}"\n`);
  }

  // ==========================================
  // CONVERSATION B: Hinglish Personal Story
  // ==========================================
  console.log("-------------------------------------------------");
  console.log("CONVERSATION B: Hinglish Personal Story (5 Turns)");
  console.log("-------------------------------------------------");
  const managerB = new ConversationManager({ userId: 'user-hinglish-story' });

  const turnsB = [
    "Pata hai aaj college mein kya hua?",
    "Meri friend ne na sabke saamne ek aisi baat bol di, I was literally so embarrassed.",
    "Uske baad main class se bahar aa gayi and I was just sitting in the canteen alone.",
    "She called me later in the evening.",
    "I didn't answer."
  ];

  for (let i = 0; i < turnsB.length; i++) {
    const user = turnsB[i];
    const agent = await simulateTurn(managerB, user);
    console.log(`[Turn ${i + 1}] User : "${user}"`);
    console.log(`         Ayra : "${agent}"\n`);
  }

  // ==========================================
  // CONVERSATION C: Hindi-Dominant Personal Story
  // ==========================================
  console.log("-------------------------------------------------");
  console.log("CONVERSATION C: Hindi-Dominant Personal Story (5 Turns)");
  console.log("-------------------------------------------------");
  const managerC = new ConversationManager({ userId: 'user-hindi-story' });

  const turnsC = [
    "आज मेरा पूरा दिन बहुत खराब था। सुबह से कुछ भी सही नहीं हो रहा था।",
    "मेरी सहेली ने दो दिन से कोई जवाब नहीं दिया है और हम रोज़ बात करते हैं।",
    "मैं बस तुम्हें बताना चाहती हूँ, कोई सलाह मत देना।",
    "बस, फिर शाम को उसने फोन किया और सब ठीक हो गया।",
    "मुझे अब बहुत सुकून महसूस हो रहा है।"
  ];

  for (let i = 0; i < turnsC.length; i++) {
    const user = turnsC[i];
    const agent = await simulateTurn(managerC, user);
    console.log(`[Turn ${i + 1}] User : "${user}"`);
    console.log(`         Ayra : "${agent}"\n`);
  }
}

runConversations().catch(err => {
  console.error("Conversation test crashed:", err);
  process.exit(1);
});
