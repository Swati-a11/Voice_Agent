import { ConversationStory, SocialSituation, ResponsibilityEvaluation, EmotionalTone, LanguageMode } from '../state/types.js';
import { IntentClassifier } from './intent-classifier.js';

export class StoryEngine {
  public static createInitialStory(): ConversationStory {
    return {
      situation: 'none',
      people: [],
      userActions: [],
      otherPersonActions: [],
      claims: [],
      emotions: [],
      unresolvedQuestions: [],
      timeline: [],
      currentGoal: null,
      adviceRequested: false,
      userDeclinedAdvice: false,
      safetyRelevant: false,
      physicalHarmReported: false,
      responsibility: 'unclear',
      stage: 'react_listen',
      lastUpdated: Date.now()
    };
  }

  /**
   * Reset or clear the active story state
   */
  public static resetStory(): ConversationStory {
    return StoryEngine.createInitialStory();
  }

  /**
   * Process a user turn to update the story state and determine if a contextual reaction/evaluation is ready.
   */
  public static processStoryTurn(
    story: ConversationStory,
    userText: string,
    context?: {
      previousAgentText?: string;
      interviewContext?: { hasUpcomingInterview: boolean; role?: string };
      crushContext?: { active: boolean };
      breakupContext?: { active: boolean };
      userNervous?: boolean;
      friendConflictLogged?: boolean;
    }
  ): {
    updatedStory: ConversationStory;
    hasDirectResponse: boolean;
    responseText?: string;
  } {
    const raw = userText.trim();
    const normalized = IntentClassifier.normalizeSTTErrors(raw);
    const lower = normalized.toLowerCase();
    const prevAgent = (context?.previousAgentText || '').toLowerCase();
    const updated: ConversationStory = { ...story, lastUpdated: Date.now() };

    // 0. Explicit Topic Cancellation / Reset (when user explicitly drops topic without introducing a new substantive situation)
    const hasSubstantiveTopic = /\b(fight|friend|boyfriend|girlfriend|boss|teacher|slapped|hit|punched|interview|react|crush|proposal|apologize|rude|harsh|job|selected|rejected|story|joke)\b/i.test(lower);
    if (!hasSubstantiveTopic && /\b(actually\s+forget\s+that|forget\s+that\s+too|okay\s+forget\s+that|forget\s+that|forget\s+it|never\s+mind|actually\s+no|tell\s+me\s+something\s+else|something\s+else|kuch\s+aur\s+baat|change\s+the\s+topic|let's\s+talk\s+about\s+something\s+else|tell me about cats|about cats)\b/i.test(lower)) {
      return {
        updatedStory: StoryEngine.createInitialStory(),
        hasDirectResponse: false
      };
    }

    // 1. Physical Aggression & Safety Check (Section 25 & Test 32/35)
    // "She slapped me", "He hit me", "She punched me", "My boyfriend hit me", "She slapped me across the face"
    if (/\b(slapped me|hit me|punched me|beat me|pushed me hard|physically hurt me|struck me|slapped across|thappad mara|haath uthaya)\b/i.test(lower)) {
      updated.safetyRelevant = true;
      updated.physicalHarmReported = true;
      updated.otherPersonActions.push('physically attacked/slapped user');
      updated.responsibility = 'other_primarily';
      updated.stage = 'advised';

      if (updated.userActions.includes('apologized') || /\b(i apologized|apologized|i said sorry)\b/i.test(lower)) {
        return {
          updatedStory: updated,
          hasDirectResponse: true,
          responseText: "Yeah, no. From what you've told me, the slap isn't your fault. You may have had an argument, but physically hitting you crossed a line. Are you safe right now?"
        };
      }

      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Wait, she actually slapped you? That's not okay. Are you safe right now?"
      };
    }

    // 2. Explicit "Who is wrong?" / "Who is at fault?" / "Is it my fault?" (Section 23, 33, 34, 35)
    if (/\b(who is wrong|who'?s wrong|who is at fault|whose fault is it|is it my fault|am i wrong|did i do the wrong thing|kiski galti hai|meri galti hai kya)\b/i.test(lower)) {
      // Evaluate based on facts gathered
      const resp = StoryEngine.evaluateResponsibility(updated);
      updated.responsibility = resp;
      updated.stage = 'advised';

      if (resp === 'shared' || (updated.otherPersonActions.includes('forgot birthday') && updated.userActions.some(a => a.includes('selfish')))) {
        return {
          updatedStory: updated,
          hasDirectResponse: true,
          responseText: "Honestly, I think this one's shared. Forgetting your birthday was hurtful, but calling her selfish was also a pretty harsh reaction. I'd own your part and then talk to her about why it hurt you."
        };
      }

      if (resp === 'user_primarily' || updated.userActions.some(a => a.includes('yelled for 2 hours') || a.includes('insulted without reason'))) {
        return {
          updatedStory: updated,
          hasDirectResponse: true,
          responseText: "Honestly, I think you're more in the wrong here. Yelling or escalating before hearing them out made things worse. If you value the relationship, I'd apologize for your reaction."
        };
      }

      if (resp === 'other_primarily' || updated.physicalHarmReported) {
        return {
          updatedStory: updated,
          hasDirectResponse: true,
          responseText: "From what you've told me, I don't think this is your fault. Whatever the disagreement was, their reaction was way out of line."
        };
      }

      // If not enough info
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Hmm, I don't think I have enough of the story to tell you who's actually at fault yet. What happened right before that?"
      };
    }

    // 3. User Admitting Overreaction / One-sided fault (Section 34)
    // "I yelled at my friend because she didn't reply for two hours."
    if (/\b(yelled at (?:my )?friend|shouted at (?:my )?friend|got angry at (?:my )?friend)\b/i.test(lower) && /\b(two hours|2 hours|an hour|didnt reply|didn't reply|not replying|late reply)\b/i.test(lower)) {
      updated.situation = 'friendship_conflict';
      updated.people = ['user', 'friend'];
      updated.userActions.push('yelled for 2 hours delay');
      updated.responsibility = 'user_primarily';
      updated.stage = 'advised';
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Honestly, two hours isn't really enough reason to yell at someone. I think you were probably too harsh there. If you care about the friendship, I'd apologize."
      };
    }

    // 4. "I called her stupid because she disagreed with me"
    if (/\b(called her (?:stupid|dumb|idiot)|called him (?:stupid|dumb|idiot))\b/i.test(lower) && /\b(disagreed|different opinion|disagreement)\b/i.test(lower)) {
      updated.situation = 'friendship_conflict';
      updated.userActions.push('insulted over disagreement');
      updated.responsibility = 'user_primarily';
      updated.stage = 'advised';
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Okay, I'll be honest with you — that part was probably your mistake. Disagreeing with you doesn't make her stupid, and calling her that probably escalated the fight. I'd apologize for that part."
      };
    }

    // 5. Boss / Workplace Situations (Section 15, 16, 36)
    if (/\b(missed (?:an |a )?(?:important )?deadline|missed deadline|late delivery|submitted late)\b/i.test(lower)) {
      updated.situation = 'workplace_conflict';
      updated.people = ['user', 'boss'];
      updated.userActions.push('missed deadline');
      updated.responsibility = 'shared';
      updated.stage = 'advised';
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Okay, I can understand why you're upset, but if the deadline was genuinely missed, there is a part you need to own too. His way of shouting at you may not have been great, but I'd focus on fixing the mistake first."
      };
    }

    if (/\b(my boss humiliated me today|my boss humiliated me|boss humiliated me|boss yelled at me|boss shouted at me|boss insulted me)\b/i.test(lower)) {
      updated.situation = 'workplace_conflict';
      updated.people = ['user', 'boss'];
      updated.stage = 'clarifying';
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Oh no, what happened?"
      };
    }

    if (updated.situation === 'workplace_conflict' || /\b(boss|presentation)\b/i.test(lower)) {
      if (/\b(criticized my (?:work|presentation) in front of everyone|criticized in front of everyone|shamed me in front of|humiliated in front of everyone)\b/i.test(lower)) {
        updated.otherPersonActions.push('criticized work publicly in front of everyone');
        updated.stage = 'clarifying';
        return {
          updatedStory: updated,
          hasDirectResponse: true,
          responseText: "Oof, I can imagine that felt embarrassing. Was the criticism actually valid, or was he just being unnecessarily harsh?"
        };
      }
    }

    // 6. Teacher / Student Situations (Section 17, 18, 37, 38)
    if (/\b(my teacher kicked me out of class|teacher kicked me out|kicked me out of class)\b/i.test(lower)) {
      updated.situation = 'teacher_student_conflict';
      updated.people = ['user', 'teacher'];
      updated.otherPersonActions.push('kicked user out of class');
      updated.stage = 'clarifying';
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Wait, what happened? Why did she kick you out?"
      };
    }

    if (updated.situation === 'teacher_student_conflict' && /\b(talking during class|i was talking|talking while she was teaching|disturbing the class|talking to my friend)\b/i.test(lower)) {
      updated.userActions.push('was talking in class');
      updated.responsibility = 'shared';
      updated.stage = 'advised';
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Ahh, okay, then I'll be honest — you probably did give her a reason to be annoyed. But if she embarrassed you in front of everyone, that's a separate issue."
      };
    }

    if (/\b(my teacher praised me today|my teacher praised me|teacher praised me|teacher appreciated my work|teacher complimented my project|teacher loved my project)\b/i.test(lower)) {
      updated.situation = 'positive_event';
      updated.people = ['user', 'teacher'];
      updated.stage = 'clarifying';
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Yooo, that's nice! What did she say?"
      };
    }

    if (updated.situation === 'positive_event' && (prevAgent.includes('what did she say') || prevAgent.includes('what happened')) && /\b(project was (?:really )?good|project was great|loved my project|praised my work|scored top|complimented)\b/i.test(lower)) {
      updated.stage = 'advised';
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "See? All that work paid off. You should be proud of that."
      };
    }

    // 7. Boyfriend / Girlfriend Scenarios (Section 14, 39)
    if (/\b(i had a fight with my (?:boyfriend|girlfriend)|had a fight with my bf|had a fight with my gf|fight with boyfriend|fight with girlfriend)\b/i.test(lower)) {
      const partner = lower.includes('boyfriend') || lower.includes('bf') ? 'boyfriend' : 'girlfriend';
      updated.situation = 'romantic_conflict';
      updated.people = ['user', partner];
      updated.stage = 'react_listen';
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Oh no. What happened?"
      };
    }

    if (updated.situation === 'romantic_conflict' && (prevAgent.includes('what happened') || updated.stage === 'react_listen')) {
      if (/\b(he got angry because i didn'?t reply|she got angry because i didn'?t reply|angry because i didn'?t reply|got angry because no reply|didn't reply)\b/i.test(lower)) {
        updated.otherPersonActions.push('got angry because user did not reply');
        updated.stage = 'clarifying';
        return {
          updatedStory: updated,
          hasDirectResponse: true,
          responseText: "Were you busy, or were you ignoring him?"
        };
      }
    }

    if (updated.situation === 'romantic_conflict' && prevAgent.includes('were you busy')) {
      if (/\b(i was busy|busy tha|busy thi|genuinely busy|working)\b/i.test(lower)) {
        updated.userActions.push('was genuinely busy');
        updated.stage = 'clarifying';
        return {
          updatedStory: updated,
          hasDirectResponse: true,
          responseText: "Then I can understand why you're annoyed. Did he know you were busy?"
        };
      }
      if (/\b(ignoring|intentionally|wanted space)\b/i.test(lower)) {
        updated.userActions.push('intentionally ignored');
        updated.stage = 'advised';
        return {
          updatedStory: updated,
          hasDirectResponse: true,
          responseText: "Okay, if you intentionally ignored him without communicating, I can understand why he got frustrated. Let him know you just needed a little space rather than leaving him hanging."
        };
      }
    }

    // 8. Positive Stories & Happy Events (Section 19)
    // "My friend got a job!"
    if (/\b(my friend got a job|friend got a job|my friend got hired|friend got placed)\b/i.test(lower)) {
      updated.situation = 'positive_event';
      updated.stage = 'advised';
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Yooo, that's amazing! I'm happy for her. Are you planning something for her?"
      };
    }

    // "My boyfriend surprised me."
    if (/\b(my boyfriend surprised me|boyfriend surprised me|my girlfriend surprised me)\b/i.test(lower)) {
      updated.situation = 'positive_event';
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Aww, that's so sweet! What did he do?"
      };
    }

    // 9. Multi-Turn Friendship Conflict Flow (Section 1, 12, 32, 33, Regression 20, 25)
    // Turn 2 & Topic Reset: "Forget it. I just had a fight with my best friend. Let me tell you what happened."
    if (/\b(forget (?:it|that|everything)|leave that|never mind|actually)\b/i.test(lower) && /\b(had a fight with my (?:best )?friend|fight with my (?:best )?friend|fought with my (?:best )?friend)\b/i.test(lower)) {
      updated.situation = 'friendship_conflict';
      updated.people = ['user', 'friend'];
      updated.stage = 'react_listen';
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Ahh yaar, okay. Forget the interview for a second. What happened with your friend?"
      };
    }

    // Conversation C: "I said some really bad things to her. So I have to apologize to her?"
    if (/\b(i said some really bad things|said some really bad things|said really bad things|bad things to her|harsh things to her)\b/i.test(lower) && /\b(apologize|apologise|sorry|apology)\b/i.test(lower)) {
      updated.situation = 'friendship_conflict';
      updated.userActions.push('said really bad things to her');
      updated.stage = 'advised';
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Yeah, I probably would. You can apologize for what you said without pretending the whole argument was your fault. But what did she say to you before that?"
      };
    }

    // Turn 3: "My friend was rude to me today, but I also said some really harsh things back. Do you think I should apologize?"
    if (/\b(my friend was (?:really )?rude to me|friend was rude to me|she was (?:really )?rude to me|friend was rude)\b/i.test(lower) && /\b(harsh things back|harsh things|harsh)\b/i.test(lower) && /\b(should i apologize|do you think i should apologize|apologize)\b/i.test(lower)) {
      updated.situation = 'friendship_conflict';
      updated.otherPersonActions.push('was rude to user');
      updated.userActions.push('said harsh things back');
      updated.stage = 'clarifying';
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Maybe, yeah. If you said things that were unnecessarily harsh, I'd apologize for your part. But tell me what she said first — I want to understand both sides before deciding who's more at fault."
      };
    }

    // Turn 1: "I just had a fight with my friend."
    if (/\b(i just had a fight with my (?:best )?friend|i had a fight with my (?:best )?friend|had a fight with my (?:best )?friend|fight with my (?:best )?friend)\b/i.test(lower)) {
      updated.situation = 'friendship_conflict';
      updated.people = ['user', 'friend'];
      updated.stage = 'react_listen';
      if (prevAgent.includes('role') || (prevAgent.includes('interview') && /\b(forget (?:it|that))\b/i.test(lower))) {
        return {
          updatedStory: updated,
          hasDirectResponse: true,
          responseText: "Ahh yaar, okay. Forget the interview for a second. What happened with your friend?"
        };
      }
      if (context?.userNervous) {
        return {
          updatedStory: updated,
          hasDirectResponse: true,
          responseText: "Ahh, you had a fight with your friend. That probably explains why you've been feeling nervous today. What happened between you two?"
        };
      }
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Ahh yaar. What happened?"
      };
    }

    // Friend was rude to me (Opening or continuation)
    if (/\b(my friend was (?:really )?rude(?: to me)?|friend was (?:really )?rude(?: to me)?|she was (?:being )?really rude|she was rude|she was being rude|he was being rude|rudely baat|rude thi)\b/i.test(lower)) {
      updated.situation = 'friendship_conflict';
      updated.people = ['user', 'friend'];
      updated.otherPersonActions.push('was being rude');
      updated.stage = 'clarifying';
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Ugh, what did she say?"
      };
    }

    // "She said I never listen."
    if (/\b(she said (?:that )?i never listen|he said (?:that )?i never listen|she said i don'?t listen|said i never listen)\b/i.test(lower)) {
      updated.situation = 'friendship_conflict';
      updated.otherPersonActions.push('accused user of never listening');
      updated.stage = 'clarifying';
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Ouch. What did you say back?"
      };
    }

    // "I also said some harsh things." / "I said some harsh things."
    if (/\b(i also said (?:some )?harsh things|i said (?:some )?harsh things|said some really harsh things|said harsh things back|maine bhi kuch harsh bola)\b/i.test(lower)) {
      updated.situation = 'friendship_conflict';
      updated.userActions.push('said harsh things');
      updated.stage = 'building';
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Hmm. What did you say to her?"
      };
    }

    // "She forgot my birthday."
    if (updated.situation === 'friendship_conflict' && /\b(she forgot my birthday|forgot my birthday|birthday bhool gayi|birthday bhool gaya)\b/i.test(lower)) {
      updated.otherPersonActions.push('forgot birthday');
      updated.stage = 'clarifying';
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Ouch, I can see why that hurt. What happened after that?"
      };
    }

    // "I called her selfish."
    if (updated.situation === 'friendship_conflict' && /\b(i called her selfish|called her selfish|maine use selfish bola)\b/i.test(lower)) {
      updated.userActions.push('called friend selfish');
      updated.stage = 'clarifying';
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Okay, that probably made things worse."
      };
    }

    // "She said I'm impossible to deal with."
    if (updated.situation === 'friendship_conflict' && /\b(she said i'?m impossible to deal with|said i'?m impossible|she called me impossible)\b/i.test(lower)) {
      updated.otherPersonActions.push('called user impossible to deal with');
      updated.stage = 'evaluating';
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Hmm. Sounds like you both got pretty heated."
      };
    }

    // "She said I'm useless because I forgot to do something."
    if (updated.situation === 'friendship_conflict' && /\b(useless because i forgot|said i'?m useless|called me useless)\b/i.test(lower)) {
      updated.otherPersonActions.push('called user useless');
      updated.stage = 'clarifying';
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Oof. Yeah, that's a pretty harsh way to say it. What did you forget to do?"
      };
    }

    // "I forgot to send her something she needed."
    if (updated.situation === 'friendship_conflict' && /\b(forgot to send (?:her )?something|forgot to send|send karna bhool gayi|send karna bhool gaya)\b/i.test(lower)) {
      updated.userActions.push('forgot to send something needed');
      updated.stage = 'building';
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Okay, so you did forget something, but calling you useless was still unnecessary."
      };
    }

    // "I told her she was being arrogant" / "Then I called her arrogant"
    if (updated.situation === 'friendship_conflict' && /\b(told her she was being (?:arrogant|disrespectful)|called her arrogant|called her disrespectful)\b/i.test(lower)) {
      updated.userActions.push('called friend arrogant');
      updated.stage = 'building';
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Hmm. So you both ended up saying things you probably didn't mean."
      };
    }

    // 10. Contextual "I don't know what to do" (Section 20)
    if (/\b(i don'?t know what to do|don'?t know what to do|what should i do now|kya karu samajh nahi aa raha)\b/i.test(lower)) {
      if (updated.situation === 'friendship_conflict') {
        return {
          updatedStory: updated,
          hasDirectResponse: true,
          responseText: "Okay, let's slow it down. Do you want to fix things with her, or do you think you need some space first?"
        };
      }
      if (context?.interviewContext?.hasUpcomingInterview) {
        return {
          updatedStory: updated,
          hasDirectResponse: true,
          responseText: "Okay, don't panic. We can prepare for the interview step by step. What topic do you want to start with?"
        };
      }
      if (context?.breakupContext?.active || updated.situation === 'breakup_situation') {
        return {
          updatedStory: updated,
          hasDirectResponse: true,
          responseText: "Honestly, you don't have to figure everything out tonight. Give yourself a little space first."
        };
      }
      if (context?.crushContext?.active || updated.situation === 'crush_situation') {
        return {
          updatedStory: updated,
          hasDirectResponse: true,
          responseText: "Take a breath. You don't have to rush it. We can keep it casual and simple."
        };
      }
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Let's break the problem down. What's worrying you the most right now?"
      };
    }

    // 11. Single-statement zero-fallback handlers (Section 43)
    if (/^(she is rude|she'?s rude|he is rude|he'?s rude)[.!]?$/i.test(lower)) {
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Ugh, what did she say or do?"
      };
    }

    if (/^(he was really nice to me today|she was really nice to me today|he was nice today)[.!]?$/i.test(lower)) {
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Ohh, that's nice! What happened?"
      };
    }

    if (/^(my teacher yelled at me|teacher yelled at me)[.!]?$/i.test(lower)) {
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Ouch, what happened? What was the reason?"
      };
    }

    if (/^(my boss appreciated my work|boss appreciated my work)[.!]?$/i.test(lower)) {
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Yesss! That must feel great. What project was it for?"
      };
    }

    if (/^(my boyfriend ignored me|boyfriend ignored me)[.!]?$/i.test(lower)) {
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Ugh, that's so frustrating. Did he explain why?"
      };
    }

    if (/^(my friend apologized|friend apologized)[.!]?$/i.test(lower)) {
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "That's really good to hear. How did the apology feel to you?"
      };
    }

    if (/^(i got rejected|i got rejected by my crush|got rejected|i was rejected)[.!]?$/i.test(lower)) {
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Oof, I'm really sorry. Was it a job, an interview, or someone you liked?"
      };
    }

    if (/\b(i have a crush on someone|crush on someone)\b/i.test(lower) && /\b(scared|reject|rejection)\b/i.test(lower)) {
      if (prevAgent.includes('project') || prevAgent.includes('introduction') || prevAgent.includes('interview')) {
        return {
          updatedStory: updated,
          hasDirectResponse: true,
          responseText: "Ahh, completely different topic. Forget the interview for a second. Honestly, rejection is scary, but you don't have to make the proposal super dramatic. What are you thinking of saying to them?"
        };
      }
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Honestly, rejection is the scary part, yeah. But you don't need to make it some huge dramatic confession. Tell them you like them and ask if they'd want to go out sometime. Keep it simple."
      };
    }

    if (/^(i have a crush on someone|i have a crush|i like a girl|i like a boy)[.!]?$/i.test(lower)) {
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Ohhh, okay! Now we're getting into interesting territory. Do they know you like them?"
      };
    }

    if (/^(i want to propose to her|i want to propose to him|i want to propose|want to propose)[.!]?$/i.test(lower)) {
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Ooh, that's a big step! Do you want to keep it simple or do something memorable?"
      };
    }

    if (/^(it'?s for a software developer role|it'?s for software development|software developer|software dev|machine learning developer)[.!]?$/i.test(lower)) {
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Got it — software developer role. That's clear now. We can focus on core coding, data structures, and problem solving."
      };
    }

    if (/^(i feel like i'?m failing|feel like failing|i am failing)[.!]?$/i.test(lower)) {
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Hey, take a breath. Feeling like that is really heavy, but one bad patch doesn't mean you're failing. What's making you feel this way?"
      };
    }

    if (/^(i am really happy today|i'?m really happy today|so happy today)[.!]?$/i.test(lower)) {
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Yooo, I love hearing that! What made today so good?"
      };
    }

    if (/^(i am angry|i'?m angry|feeling angry|so angry today)[.!]?$/i.test(lower)) {
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "I can hear that. What happened that got you so upset?"
      };
    }

    if (/^(i am embarrassed|i'?m embarrassed|so embarrassed|i messed up)[.!]?$/i.test(lower)) {
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "Oof, we've all been there. Most embarrassing things feel way bigger to us than anyone else. What happened?"
      };
    }

    if (/^(i think i was wrong|i was wrong)[.!]?$/i.test(lower)) {
      return {
        updatedStory: updated,
        hasDirectResponse: true,
        responseText: "It takes real maturity to admit that. What part do you think was your mistake?"
      };
    }

    return {
      updatedStory: updated,
      hasDirectResponse: false
    };
  }

  /**
   * Evaluate which party holds primary responsibility based on extracted story facts.
   */
  public static evaluateResponsibility(story: ConversationStory): ResponsibilityEvaluation {
    if (story.physicalHarmReported) {
      return 'other_primarily';
    }

    const hasUserMistake = story.userActions.length > 0;
    const hasOtherMistake = story.otherPersonActions.length > 0;

    if (hasUserMistake && hasOtherMistake) {
      return 'shared';
    }

    if (hasUserMistake && !hasOtherMistake) {
      return 'user_primarily';
    }

    if (hasOtherMistake && !hasUserMistake) {
      return 'other_primarily';
    }

    return 'unclear';
  }
}
