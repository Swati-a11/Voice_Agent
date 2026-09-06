import { ConversationManager } from '../server/dist/agent/conversation-manager.js';
import { IntentClassifier } from '../server/dist/agent/intent-classifier.js';
import { StoryEngine } from '../server/dist/agent/story-engine.js';

let passed = 0;
let failed = 0;

function assert(condition, message, detail = '') {
  if (condition) {
    passed++;
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${message}`);
  } else {
    failed++;
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${message} | ${detail}`);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('  TESTING AYRA FINAL HUMAN-LIKE CONTEXTUAL ADVICE ENGINE (1-43)');
  console.log('================================================================\n');

  // Test 1: Section 32 - Complete Friend Fight Multi-Turn Flow
  console.log('1. Section 32: Friend Fight & Physical Aggression Safety Test');
  const cm1 = new ConversationManager({ userId: 'test-user-1' });

  // Turn 1
  let res1 = cm1['generateDirectIntentResponse']({
    userText: 'I just had a fight with my friend.'
  });
  assert(res1.toLowerCase().includes('what happened') || res1.includes('off today'), 'Turn 1 Reacts & Gathers info', res1);

  // Turn 2
  let res2 = cm1['generateDirectIntentResponse']({
    userText: 'She was being really rude.',
    previousAssistantMessage: res1
  });
  assert(res2.includes('what did she say') || res2.includes('rude'), 'Turn 2 Clarifies what friend said', res2);

  // Turn 3
  let res3 = cm1['generateDirectIntentResponse']({
    userText: 'I told her she was being arrogant.',
    previousAssistantMessage: res2
  });
  assert(res3.includes('both ended up') || res3.includes('arrogant') || res3.includes('escalate'), 'Turn 3 Builds both sides of the conflict', res3);

  // Turn 4 - Physical aggression
  let res4 = cm1['generateDirectIntentResponse']({
    userText: 'She slapped me.',
    previousAssistantMessage: res3
  });
  assert(res4.includes('slapped you') && res4.includes('safe right now'), 'Turn 4 Immediate physical aggression safety check', res4);

  // Test 2: Section 33 - Shared Fault Birthday Conflict
  console.log('\n2. Section 33: Shared Fault Birthday Argument');
  const cm2 = new ConversationManager({ userId: 'test-user-2' });
  let t1 = cm2['generateDirectIntentResponse']({ userText: 'I had a fight with my friend.' });
  let t2 = cm2['generateDirectIntentResponse']({ userText: 'She forgot my birthday.', previousAssistantMessage: t1 });
  assert(t2.includes('hurt') && (t2.includes('what happened') || t2.includes('after that')), 'Validates hurt from forgotten birthday', t2);
  let t3 = cm2['generateDirectIntentResponse']({ userText: 'I called her selfish.', previousAssistantMessage: t2 });
  assert(t3.includes('worse') || t3.includes('heated'), 'Identifies escalation from name-calling', t3);
  let t4 = cm2['generateDirectIntentResponse']({ userText: 'She said I\'m impossible to deal with.', previousAssistantMessage: t3 });
  let t5 = cm2['generateDirectIntentResponse']({ userText: 'Who is wrong?', previousAssistantMessage: t4 });
  assert(t5.includes('shared') || t5.includes('both'), 'Evaluates shared responsibility on "Who is wrong?"', t5);

  // Test 3: Section 34 - User is Primarily Wrong
  console.log('\n3. Section 34: User is Primarily Wrong');
  const cm3 = new ConversationManager({ userId: 'test-user-3' });
  let userWrongRes = cm3['generateDirectIntentResponse']({
    userText: 'I yelled at my friend because she didn\'t reply for two hours.'
  });
  assert(userWrongRes.includes('two hours isn\'t') && userWrongRes.includes('apologize'), 'Direct kind & honest correction for 2hr yelling', userWrongRes);

  let userDisagreedRes = cm3['generateDirectIntentResponse']({
    userText: 'I called her stupid because she disagreed with me.'
  });
  assert(userDisagreedRes.includes('mistake') && userDisagreedRes.includes('apologize'), 'Direct kind & honest correction for insult over disagreement', userDisagreedRes);

  // Test 4: Section 35 - Other Person is Wrong (Slap after apology)
  console.log('\n4. Section 35: Other Person is Wrong');
  const cm4 = new ConversationManager({ userId: 'test-user-4' });
  let otherWrongRes = cm4['generateDirectIntentResponse']({
    userText: 'My friend insulted me, I apologized, and then she slapped me.'
  });
  assert(otherWrongRes.includes('crossed a line') && otherWrongRes.includes('safe right now'), 'Affirms user is not at fault for physical slap', otherWrongRes);

  // Test 5: Section 36 - Boss & Workplace Situations
  console.log('\n5. Section 36: Boss & Workplace Situations');
  const cm5 = new ConversationManager({ userId: 'test-user-5' });
  let boss1 = cm5['generateDirectIntentResponse']({ userText: 'My boss humiliated me today.' });
  assert(boss1.includes('what happened'), 'Boss humiliation opens for context', boss1);
  let boss2 = cm5['generateDirectIntentResponse']({
    userText: 'He criticized my work in front of everyone.',
    previousAssistantMessage: boss1
  });
  assert(boss2.includes('embarrassing') && boss2.includes('criticism'), 'Evaluates public delivery vs valid feedback', boss2);
  let boss3 = cm5['generateDirectIntentResponse']({
    userText: 'My boss shouted at me because I missed an important deadline.'
  });
  assert(boss3.includes('deadline was genuinely missed') && boss3.includes('own'), 'Balanced advice on workplace mistake', boss3);

  // Test 6: Section 37 & 38 - Teacher Situations
  console.log('\n6. Section 37 & 38: Teacher / Student Situations');
  const cm6 = new ConversationManager({ userId: 'test-user-6' });
  let teach1 = cm6['generateDirectIntentResponse']({ userText: 'My teacher kicked me out of class.' });
  assert(teach1.includes('what happened') || teach1.includes('why'), 'Teacher inquiry opens for context', teach1);
  let teach2 = cm6['generateDirectIntentResponse']({
    userText: 'I was talking during class.',
    previousAssistantMessage: teach1
  });
  assert(teach2.includes('give her a reason') || teach2.includes('waited'), 'Acknowledges user contributed to teacher annoyance', teach2);

  let teachPraise = cm6['generateDirectIntentResponse']({ userText: 'My teacher praised me today.' });
  assert(teachPraise.includes('what did she say') || teachPraise.includes('nice'), 'Praise reaction celebratory', teachPraise);
  let teachPraise2 = cm6['generateDirectIntentResponse']({
    userText: 'She said my project was really good.',
    previousAssistantMessage: teachPraise
  });
  assert(teachPraise2.includes('paid off') || teachPraise2.includes('proud'), 'Celebrates student win', teachPraise2);

  // Test 7: Section 39 - Boyfriend Conflict
  console.log('\n7. Section 39: Boyfriend Conflict');
  const cm7 = new ConversationManager({ userId: 'test-user-7' });
  let bf1 = cm7['generateDirectIntentResponse']({ userText: 'I had a fight with my boyfriend.' });
  assert(bf1.toLowerCase().includes('what happened'), 'Boyfriend conflict opens for context', bf1);
  let bf2 = cm7['generateDirectIntentResponse']({
    userText: 'He got angry because I didn\'t reply.',
    previousAssistantMessage: bf1
  });
  assert(bf2.includes('busy') || bf2.includes('ignoring'), 'Clarifies reason behind non-reply', bf2);
  let bf3 = cm7['generateDirectIntentResponse']({
    userText: 'I was busy.',
    previousAssistantMessage: bf2
  });
  assert(bf3.includes('understand why you\'re annoyed') && bf3.includes('know you were busy'), 'Context-sensitive support for boyfriend delay', bf3);

  // Test 8: Section 40 - Career Context
  console.log('\n8. Section 40: Career Context');
  const cm8 = new ConversationManager({ userId: 'test-user-8' });
  let c1 = cm8['generateDirectIntentResponse']({ userText: 'I have an interview tomorrow.' });
  assert(c1.includes('role is it for') || c1.includes('interview'), 'Gathers interview role', c1);
  let c2 = cm8['generateDirectIntentResponse']({
    userText: 'Software developer.',
    previousAssistantMessage: c1
  });
  assert(c2.includes('software developer') && !c2.includes('is a computer language'), 'Updates role context without explaining what software development is', c2);

  // Test 9: Section 41 - Friend Birthday Context
  console.log('\n9. Section 41: Friend Birthday Context');
  const cm9 = new ConversationManager({ userId: 'test-user-9' });
  let b1 = cm9['generateDirectIntentResponse']({ userText: 'My friend\'s birthday is tomorrow.' });
  assert(b1.includes('tomorrow') && b1.includes('planning'), 'Birthday recognition', b1);
  let b2 = cm9['generateDirectIntentResponse']({
    userText: 'Not really.',
    previousAssistantMessage: b1
  });
  assert(b2.includes('thoughtful') || b2.includes('time'), 'Birthday planning follow-up', b2);

  // Test 10: Section 42 - Topic Switch Cleanliness
  console.log('\n10. Section 42: Topic Switch Cleanliness');
  const cm10 = new ConversationManager({ userId: 'test-user-10' });
  let sw1 = cm10['generateDirectIntentResponse']({ userText: 'I had a fight with my friend.' });
  let sw2 = cm10['generateDirectIntentResponse']({
    userText: 'Actually forget that. Tell me something about cats.',
    previousAssistantMessage: sw1
  });
  assert(sw2.includes('Cats') && !sw2.includes('fight') && !sw2.includes('friend'), 'Clean topic switch to cats without friend fight contamination', sw2);

  // Test 11: Section 20 - Contextual "I don't know what to do"
  console.log('\n11. Section 20: Contextual "I don\'t know what to do"');
  const cm11 = new ConversationManager({ userId: 'test-user-11' });
  cm11['generateDirectIntentResponse']({ userText: 'I had a fight with my friend.' });
  let idkFriend = cm11['generateDirectIntentResponse']({ userText: 'I don\'t know what to do.' });
  assert(idkFriend.includes('fix things') || idkFriend.includes('space first'), 'Friendship conflict "I don\'t know what to do" advice', idkFriend);

  // Test 12: Section 43 - Zero Fallback Test for All Normal Human Sentences
  console.log('\n12. Section 43: Zero Fallback Test for 17 Common Human Sentences');
  const singlePhrases = [
    'She is rude.',
    'He was really nice to me today.',
    'My teacher yelled at me.',
    'My boss appreciated my work.',
    'My boyfriend ignored me.',
    'My girlfriend surprised me.',
    'I got rejected.',
    'I have a crush.',
    'I want to propose to her.',
    'My friend apologized.',
    'I don\'t know what to do.',
    'I feel like I\'m failing.',
    'I am really happy today.',
    'I am angry.',
    'I am embarrassed.',
    'I messed up.',
    'I think I was wrong.'
  ];

  for (const phrase of singlePhrases) {
    const cmTest = new ConversationManager({ userId: `test-phrase-${phrase}` });
    const res = cmTest['generateDirectIntentResponse']({ userText: phrase });
    assert(!res.includes("I'm not sure what you mean") && res.length > 5, `Zero fallback for "${phrase}"`, res);
  }

  console.log('\n================================================================');
  console.log(`  TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
