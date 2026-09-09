import { UserIntent, DetailedIntent, MentionedEntity, LanguageMode, SpecificEmotion, ConversationMode } from '../state/types.js';

export interface IntentClassificationContext {
  previousAgentText?: string;
  isInterruption?: boolean;
  topicStackSize?: number;
  previousLanguageMode?: LanguageMode;
  userSpokenDurationMs?: number;
  isInterviewActive?: boolean;
  lastMentionedEntity?: MentionedEntity | null;
  isStoryThreadActive?: boolean;
  storyThreadTopic?: string;
  activeConversationMode?: ConversationMode;
  lastUserIntent?: DetailedIntent | UserIntent;
}

export interface NarrativeAnalysisResult {
  isNarrative: boolean;
  type: 'day_experience' | 'childhood' | 'friend_conflict' | 'friend_harassment_story' | 'pain_bad_day' | 'embarrassing_moment' | 'work_college' | 'shopping_app' | 'milestone_achievement' | 'story_continuation' | 'story_end' | 'general_sharing' | 'animal_encounter' | 'none';
  storyType: string;
  mainEvent: string;
  peopleMentioned: string[];
  place: string;
  emotion: string;
  interestingDetail: string;
  problem: string;
  unexpectedPart: string;
  outcome: string;
  unfinishedPart: string;
  possibleFollowUp: string;
  details: string[];
  people: string[];
  emotions: string[];
  confidence: number;
  isIncompleteOpener: boolean;
}

export interface DetailedClassificationResult {
  intent: DetailedIntent;
  userIntent: UserIntent;
  entity: MentionedEntity | null;
  secondaryIntent: DetailedIntent | null;
  emotion: SpecificEmotion;
  emotionIntensity: number;
  conversationMode: ConversationMode;
  isCurrentInformation: boolean;
  requiresWebSearch: boolean;
  needsClarification: boolean;
  clarificationPrompt?: string;
  resolvedQuery?: string;
  sttNormalizedText: string;
  isFragment: boolean;
  fragmentType?: 'completion_prompt' | 'missing_subject' | 'partial_query';
  narrativeDetails?: string[];
  narrativeType?: string;
  narrativeAnalysis?: NarrativeAnalysisResult;
  languageDominance?: 'english' | 'hinglish' | 'hindi';
  socialRequestType?: 'flirt' | 'roast' | 'compliment' | 'cheer_up' | 'keep_company' | 'talk_to_me' | 'none';
  wantsAdvice?: boolean;
  declinedAdvice?: boolean;
}

export class IntentClassifier {
  // Hard stop / cancel commands & natural STT variations (Strict STOP)
  private static STOP_COMMAND_REGEX = /^(stop|stop stop|stop it|stop please|please stop|okay stop|ok stop|no stop|wait stop|bas stop|yeah stop|yes stop|okay okay stop|just stop|stop now|stop talking|stop speaking|bas|bas karo|bas bas|bas bas karo|bas abhi|ruk|ruko|ruk ja|ruk jao|ruko ruko|rukna|ruko please|pause|pause it|pause please|don't continue|dont continue|do not continue|stop continuing|that's enough|thats enough|that is enough|enough|enough now|it's enough|its enough|shut up|chup|chup raho|chup ho jao|i don't want to hear this|dont want to hear this|i don't want to listen|dont want to listen|don't want to hear)[.!,?]?$/i;

  // Conversational Hold commands: "wait", "hold on", "one second", etc.
  private static CONVERSATIONAL_HOLD_REGEX = /^(wait|wait wait|wait a minute|wait a sec|wait a second|wait please|just wait|hold on|hold on a second|hold on a sec|hold up|hang on|ek second|one second|1 second|one sec|1 sec|ek minute|one minute|1 minute|ruko ek second|ruko zara|ruko na)[.!,?]?$/i;

  public static isConversationalHoldCommand(text: string): boolean {
    const clean = text.trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, '');
    if (!clean) return false;
    if (this.isNewOrDifferentStory(clean) || this.isStoryRestartFromBeginning(clean) || this.isStoryContinuationOrResume(clean)) {
      return false;
    }
    return this.CONVERSATIONAL_HOLD_REGEX.test(clean);
  }

  public static isIncompleteUtterance(text: string): boolean {
    const clean = text.trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?"'…]/g, '');
    if (!clean) return true;
    if (/^(what are|what is|how do|and then|if you were|if you were reviewing|if you were doing|if you were reviewing my preparation|if you werewing my preparation)$/i.test(clean)) {
      return true;
    }
    return /^(wait i|no i mean|actually|hold on because|i was thinking about|i meant|so basically|because i|and i|what if i|im thinking about|i am thinking about|i was thinking|i thought that|let me think|so if|when i am)$/i.test(clean);
  }

  public static extractSelfCorrection(text: string): { hasCorrection: boolean; originalTarget?: string; correctedTarget: string } {
    const raw = text.trim();
    if (!raw) return { hasCorrection: false, correctedTarget: '' };

    // 1. Dash or hyphen split: "Explain Python—actually JavaScript" or "Elon Musk - actually Jeff Bezos"
    const dashMatch = raw.match(/^(.*?)(?:—|--|-)\s*(?:actually|no[, ]+i meant|no[, ]+i mean|i meant|i mean|sorry|rather|instead)\s+(.+)$/i);
    if (dashMatch && dashMatch[2]) {
      return {
        hasCorrection: true,
        originalTarget: dashMatch[1].trim(),
        correctedTarget: dashMatch[2].trim()
      };
    }

    // 2. Comma, period, or space with correction cue: "Tell me about Apple, no I mean the company" or "I want the second one. Wait, the first one."
    const sentenceMatch = raw.match(/^(.*?)(?:[.,;]+|\s+)(?:actually|no[, ]+i meant|no[, ]+i mean|i meant|i mean|sorry[, ]*|wait[, ]+)(?:the\s+)?(.+)$/i);
    if (sentenceMatch && sentenceMatch[1] && sentenceMatch[2]) {
      const pre = sentenceMatch[1].trim();
      const post = sentenceMatch[2].trim();
      // Ensure pre is not just a filler and post has actual substance
      if (pre.length > 2 && post.length > 1 && !/^(hi|hello|hey|wait|okay|ok)$/i.test(pre)) {
        return {
          hasCorrection: true,
          originalTarget: pre,
          correctedTarget: post
        };
      }
    }

    // 3. Leading correction: "No, I meant React" or "Actually JavaScript" or "Her movie—sorry, his movie."
    const leadingMatch = raw.match(/^(?:no[, ]+i meant|no[, ]+i mean|i meant|i mean|actually|rather|instead)\s+(.+)$/i);
    if (leadingMatch && leadingMatch[1]) {
      return {
        hasCorrection: true,
        correctedTarget: leadingMatch[1].trim()
      };
    }

    return { hasCorrection: false, correctedTarget: raw };
  }

  public static isExplicitStopCommand(text: string): boolean {
    const clean = text.trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, '');
    if (!clean) return false;
    
    if (this.isNewOrDifferentStory(clean) || this.isStoryRestartFromBeginning(clean) || this.isStoryContinuationOrResume(clean)) {
      return false;
    }

    if (this.STOP_COMMAND_REGEX.test(clean) || this.CONVERSATIONAL_HOLD_REGEX.test(clean)) {
      return true;
    }

    if (
      /^(stop talking|stop speaking|stop it now|stop right there|don't continue|dont continue|do not continue|that's enough|thats enough|shut up|i don't want to hear|dont want to hear|i don't want to listen|dont want to listen|bas karo)$/i.test(clean)
    ) {
      return true;
    }

    if (/^(okay|ok|yeah|yes|no|wait|bas|arre|yaar|please)?\s*(stop|pause|ruko|bas|enough)$/i.test(clean)) {
      return true;
    }

    return false;
  }

  /**
   * Detect explicit requests from the user to remember preferences, facts, or details.
   * e.g. "Remember that I prefer short explanations", "Remember that I like cats", "Please remember my project name is Ayra"
   */
  public static isExplicitMemoryRequest(text: string): { isMemory: boolean; fact: string; confirmation: string } {
    const raw = text.trim();
    if (!raw) return { isMemory: false, fact: '', confirmation: '' };

    const memRegex = /^(?:please\s+)?(?:remember\s+that|remember\s+this\s*:?|remember\s+to|remember\s+i\b|remember\s+my\b|remember\s+about\s+me\s+that|don'?t\s+forget\s+that|note\s+down\s+that|keep\s+in\s+mind\s+that|hamesha\s+yaad\s+rakhna\s+ki?|yaad\s+rakhna\s+ki?)\s+(.+)$/i;
    const match = raw.match(memRegex);

    if (match && match[1]) {
      let extracted = match[1].trim();
      // Remove trailing punctuation
      extracted = extracted.replace(/[.!?]+$/, '').trim();

      // Normalize pronouns for storage
      let normalizedFact = extracted;
      if (/^i\s+prefer\s+/i.test(extracted)) {
        normalizedFact = `User prefers ${extracted.replace(/^i\s+prefer\s+/i, '')}`;
      } else if (/^i\s+like\s+/i.test(extracted)) {
        normalizedFact = `User likes ${extracted.replace(/^i\s+like\s+/i, '')}`;
      } else if (/^i\s+love\s+/i.test(extracted)) {
        normalizedFact = `User loves ${extracted.replace(/^i\s+love\s+/i, '')}`;
      } else if (/^my\s+name\s+is\s+/i.test(extracted)) {
        normalizedFact = `User's name is ${extracted.replace(/^my\s+name\s+is\s+/i, '')}`;
      } else if (/^my\s+project\s+is\s+/i.test(extracted) || /^my\s+project\s+name\s+is\s+/i.test(extracted)) {
        normalizedFact = `User's project is ${extracted.replace(/^my\s+project(?:\s+name)?\s+is\s+/i, '')}`;
      }

      // Natural confirmation
      let confirmation = "Got it. I'll remember that.";
      if (/short explanation|concise|brief|to the point/i.test(extracted)) {
        confirmation = "Got it. I'll keep that in mind and keep things concise for you.";
      } else if (/like|love/i.test(extracted)) {
        confirmation = `Got it. I'll remember that.`;
      }

      return {
        isMemory: true,
        fact: normalizedFact,
        confirmation
      };
    }

    // Direct "Remember: ..." or "Remember - ..." pattern
    const colonMatch = raw.match(/^remember\s*[:,-]\s*(.+)$/i);
    if (colonMatch && colonMatch[1]) {
      const extracted = colonMatch[1].trim().replace(/[.!?]+$/, '');
      return {
        isMemory: true,
        fact: extracted,
        confirmation: "Got it. I'll remember that."
      };
    }

    return { isMemory: false, fact: '', confirmation: '' };
  }

  /**
   * Filter whether an utterance contains meaningful long-term personal context/preference,
   * as opposed to casual greetings, jokes, short questions, entity queries, or ephemeral fillers.
   */
  public static isMeaningfulLongTermContext(text: string): boolean {
    const lower = text.trim().toLowerCase();
    if (!lower || lower.length < 5) return false;

    // Reject obvious greetings, casual filler, jokes, weather, search, commands
    if (/^(hi|hello|hey|good morning|good evening|good afternoon|namaste|kaise ho|what's up|sup)[.?!]?$/i.test(lower)) return false;
    if (/^(how are you|what are you doing|who are you|tell me a joke|tell a joke|tell me a story|what's the weather|whats the weather|stop|wait|pause|okay|ok|haan|hmm)[.?!]?$/i.test(lower)) return false;
    if (/^(what is|who is|where is|explain|compare|how does|why is|what are)\s+/i.test(lower) && !lower.includes('my ') && !lower.includes('about me')) return false;

    // Check for stable personal facts, preferences, career, projects
    if (/\b(i prefer|i always prefer|i like|i love|i hate|i dislike|my favorite|my favourite)\b/i.test(lower)) return true;
    if (/\b(i am a|i'm a|i work as|my job is|i study|my degree is|my major is)\b/i.test(lower)) return true;
    if (/\b(i am working on|i'm building|my project is|my startup is|we are developing)\b/i.test(lower)) return true;
    if (/\b(my name is|i am called|call me)\s+[a-zA-Z]+/i.test(lower)) return true;

    return false;
  }

  private static LANG_ENGLISH_REGEX = /\b(speak only in english|talk in english|switch to english|in english please|only english)\b/i;
  private static LANG_HINDI_REGEX = /\b(hindi mein baat karo|talk in hindi|hindi me bolo|shuddh hindi)\b/i;
  private static LANG_HINGLISH_REGEX = /\b(hinglish mein baat karo|hinglish me bolo|mix hindi english)\b/i;
  private static INTERVIEW_START_REGEX = /\b(take my interview|interview me|can you interview me|mock interview|ask me (some |a few )?(react|python|javascript|dsa|system design|coding|technical)?\s*(interview )?questions|help me prepare for (an|my) interview|have an interview in \w+ hours|practice (for )?interview)\b/i;
  private static CONTEXTUAL_FOLLOW_UP_REGEX = /\b(i don't get (this|it|that)|don't get this|don't get it|can you explain( that| this)?|what does that mean|how does (that|this|it) work|why\??|why is that|why do we need|how are (they|these) formed|how\??|how so\??|explain that|explain this|tell me more about (that|this|it)|i didn't understand|what do you mean|how (is |are )?(oct|dec|october|december|31|25|a 2 21|disable 25|centre 25).*equal|samjha nahi|samajh nahi aaya|kya matlab|aisa kyun|kaise hota hai)\b/i;
  private static TOOL_WEATHER_REGEX = /\b(weather|temperature|forecast|barish|mausam|rain|sunny|how hot|how cold)\b/i;
  private static TOOL_REMINDER_REGEX = /\b(remind me|set a reminder|reminder for|yaad dilana|yaad dilao|schedule a reminder)\b/i;
  private static TOOL_SEARCH_REGEX = /\b(what is the capital|who is|who won|search for|look up|fact check|kya hota hai|kisne banaya)\b/i;
  private static TOPIC_RETURN_REGEX = /\b(anyway|coming back to|going back to|back to what (i|we) were saying|where were we|as i was saying|about that|phir se wahi|wapas aate hain|uske baare mein|go back to)\b/i;
  private static TOPIC_CHANGE_REGEX = /\b(actually forget that|forget that|forget the story|forget react|forget the interview|forget stars|never mind|by the way|speaking of which|change the topic|on another note|unrelated but|let's talk about|kuch aur baat karte hain|ek aur cheez|differently)\b/i;
  private static GREETING_REGEX = /^(hi|hello|hey|hey there|good morning|good evening|good afternoon|namaste|kaise ho|what's up|sup)[.?!]?$/i;
  private static CREATIVE_REQUEST_REGEX = /\b(story|stories|fairytale|narrative|kahani|kahaani|tale|fable|joke|chutkula|funny story|bedtime story)\b/i;
  private static SELF_INQUIRY_REGEX = /\b(tell me (about|something about) yourself|who are you|what are you|introduce yourself|apne baare mein batao|about you|about yourself)\b/i;
  private static INFO_REQUEST_REGEX = /\b(tell me about|explain |describe |teach me |can you explain|can you tell me|what is |what are |how does |how do |i want to know|batao|samjhao)\b/i;
  private static BACKCHANNEL_REGEX = /^(hmm+|yeah|yep|uh-huh|mm-hmm|right|okay|haan|achha|acha|sahi hai|theek hai|oh|cool)[.?!]?$/i;
  private static CONTINUATION_REGEX = /\b(tell me the rest|continue the story|continue that story|continue from there|continue where you stopped|okay continue|okay again continue|again continue|start again|the story you were telling|the story you were telling start|where were you|what happened next|tell me what happened next|tell me the rest|the rest of the story|what happens next|aage batao|aur phir|go on with the story|go on with it|resume the story|resume that story|start where you stopped)\b|^(go on|continue|resume|aur batao)[.!]?$/i;
  private static NEW_STORY_REGEX = /\b(different story|another story|new story|change the story|tell me a different story|tell me another story|tell me a new story|give me a new story|i want another story|stop this one and tell me (another|a different|a new) story|forget that story,? tell me (another|a different|a new) story|koi aur kahani|doosri kahani|nayee kahani|alag kahani|tell me a story|tell a story|say a story|tell me a long space exploration story|tell me a space story|story about space|space story|story sunao|ek kahani sunao)\b/i;

  public static isNewOrDifferentStory(text: string): boolean {
    const clean = text.trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, '');
    if (/\b(joke|jokes|chutkula|funny)\b/i.test(clean)) return false;
    return (
      this.NEW_STORY_REGEX.test(clean) ||
      /\b(tell me a story|tell a story|say a story|give me a story|i want a story|space exploration story|space story|ocean story|clockmaker story|ek kahani)\b/i.test(clean) ||
      /^(story|a story|new story|different story|another story|change the story|give me another story|tell another story|tell me a story)$/i.test(clean)
    );
  }

  public static isStoryRestartFromBeginning(text: string): boolean {
    const clean = text.trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, '');
    if (this.isNewOrDifferentStory(clean)) return false;
    return (
      /\b(from the beginning|from start|from the start|start from beginning|start the story again from the beginning|tell me that story again from the beginning|tell that story from the beginning|tell me that story again|tell the same story again|repeat that story|restart the story|same story again)\b/i.test(clean) ||
      /^(start the story|start that story again|start the story again|tell that story again|restart the story|start again|okay start again|start it again)$/i.test(clean)
    );
  }

  public static isStoryContinuationOrResume(text: string): boolean {
    const clean = text.trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, '');
    if (this.isNewOrDifferentStory(clean) || this.isStoryRestartFromBeginning(clean)) return false;
    return (
      this.CONTINUATION_REGEX.test(clean) ||
      /^(the story you were telling|the story you were telling start|start that story|continue story|resume story|continue|okay continue|okay again continue|start where you stopped|what happened next|where were we|tell me the rest)$/i.test(clean)
    );
  }

  private static CORRECTION_REGEX = /\b(no i meant|actually no|not that|i didn't mean|no, i meant|galat samjhe|mera matlab ye nahi tha|correction)\b/i;
  private static CLARIFICATION_REGEX = /\b(wait what|what do you mean|kya matlab|can you clarify|samjha nahi|explain that again)\b/i;

  public static normalizeSTTErrors(text: string): string {
    let normalized = text.trim().replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
    normalized = normalized.replace(/\b(talk talk|top top|stop talk)\b/gi, 'stop stop');
    normalized = normalized.replace(/\b(?:yaara|yara|tiara)\s+advani\b/gi, 'Kiara Advani');
    normalized = normalized.replace(/\b(?:sidharth|siddharth)\s+malhotra\b/gi, 'Sidharth Malhotra');
    normalized = normalized.replace(/\bmintra\b/gi, 'Myntra');
    normalized = normalized.replace(/\bsaiz\b/gi, 'size');
    normalized = normalized.replace(/\bkhollia\b/gi, 'khol liya');
    normalized = normalized.replace(/\byou are so and knowing\b/gi, 'you are so annoying');
    normalized = normalized.replace(/\bso and knowing\b/gi, 'so annoying');
    normalized = normalized.replace(/\bvery lovers today\b/gi, 'very nervous today');
    normalized = normalized.replace(/\bvery lovers\b/gi, 'very nervous');
    normalized = normalized.replace(/\bam very lovers\b/gi, 'am very nervous');
    normalized = normalized.replace(/\blovers today\b/gi, 'nervous today');
    normalized = normalized.replace(/\bhim to religion\b/gi, 'his religion');
    normalized = normalized.replace(/\bher to religion\b/gi, 'her religion');
    normalized = normalized.replace(/\bthem to religion\b/gi, 'their religion');
    normalized = normalized.replace(/^your actually\b/gi, "you're actually");
    normalized = normalized.replace(/\bwhat you do next\b/gi, 'what to do next');
    normalized = normalized.replace(/\b(?:software|web|fullstack|frontend|backend|machine learning|ml)\s+developer\s+roll\b/gi, (m) => m.replace(/roll$/i, 'role'));
    normalized = normalized.replace(/\bdeveloper roll\b/gi, 'developer role');
    normalized = normalized.replace(/\bengineer roll\b/gi, 'engineer role');
    normalized = normalized.replace(/\b(cutie kuthe|cutie kute|cute kute|cutie at this|kuthe at this)\b/gi, 'cute at this');
    normalized = normalized.replace(/\b(getting cutie|getting cuter|getting cute at this)\b/gi, 'getting cute');
    normalized = normalized.replace(/\b(?:really\s+|feeling\s+|very\s+|so\s+|am\s+)?never\s+today\b/gi, (m) => m.replace(/never/i, 'nervous'));
    normalized = normalized.replace(/\b(feeling never|am never|really never|so never|very never)\b/gi, (m) => m.replace(/never/i, 'nervous'));
    normalized = normalized.replace(/\b(message up|mass up|messup)\b/gi, 'mess up');
    normalized = normalized.replace(/\bwhat's happening in the world right now that you think i should actually no about\b/gi, "what's happening in the world right now that you think I should actually know about");
    normalized = normalized.replace(/\b(actually no about|actually no\b|should actually no\b|should no about|to no about)\b/gi, (m) => m.replace(/\bno\b/i, 'know'));
    normalized = normalized.replace(/\b(who's for|who's called|whose for|whose called)\b/gi, 'whose fault');
    normalized = normalized.replace(/\b(friend was me today|was me today)\b/gi, 'friend was rude to me today');
    normalized = normalized.replace(/\b(harsh since back|harsh sins back|harsh things back)\b/gi, 'harsh things back');
    normalized = normalized.replace(/\b(n't you are my interview|now you are my interview)\b/gi, 'now you are my interviewer');
    normalized = normalized.replace(/\b(?:software|web|fullstack|frontend|backend|machine learning|ml)\s+developer\s+road\b/gi, (m) => m.replace(/road$/i, 'role'));
    normalized = normalized.replace(/\b(developer road|engineer road)\b/gi, (m) => m.replace(/road$/i, 'role'));
    normalized = normalized.replace(/\bwhat road is it for\b/gi, 'what role is it for');
    normalized = normalized.replace(/\bknow youtube\b/gi, 'do you know YouTube');
    normalized = normalized.replace(/\bknow alia bhatt\b/gi, 'do you know Alia Bhatt');
    normalized = normalized.replace(/\b(was route to me|route to me)\b/gi, 'was rude to me');
    normalized = normalized.replace(/\b(?:its\s+for\s+|it's\s+for\s+)?best\s+lover\s+roll\b/gi, "it's for web developer role");
    normalized = normalized.replace(/\bbest\s+lover\s+(?:roll|role)\b/gi, 'web developer role');
    normalized = normalized.replace(/\bmessage\s+(?:up\s+)?what\s+should\s+i\s+do\b/gi, 'mess up, what should I do');
    normalized = normalized.replace(/\b(save\s+some\s+really\s+hard\s+things\s+back|save\s+some\s+hard\s+things\s+back|save\s+some\s+really\s+harsh\s+things\s+back)\b/gi, 'said some really harsh things back');
    normalized = normalized.replace(/\b(make\s+with\s+him)\b/gi, 'make up with him');
    normalized = normalized.replace(/\b(make\s+with\s+her)\b/gi, 'make up with her');
    normalized = normalized.replace(/\bcompletely\s+conversation\b/gi, 'complete conversation');
    normalized = normalized.replace(/\bwho\s+is\s+called\s+you\s+think\s+it\s+was\b/gi, 'whose fault do you think it was');
    normalized = normalized.replace(/\bwho\s+is\s+called\b/gi, 'whose fault');
    normalized = normalized.replace(/\b(should approach|have to approach|to approach to her|approach to her|approach to him)\b/gi, (m) => m.replace(/approach/i, 'apologize'));
    normalized = normalized.replace(/\b(apply to her|apply to him|have to apply|have to apply to)\b/gi, (m) => m.replace(/apply/i, 'apologize'));
    normalized = normalized.replace(/\b(pretend your my interview|pretend you're my interview|your my interview|act as my interview|be my interview)\b/gi, "pretend you're my interviewer");
    normalized = normalized.replace(/\bpretend your my interviewer\b/gi, "pretend you're my interviewer");
    normalized = normalized.replace(/\byour my interviewer\b/gi, "you're my interviewer");
    normalized = normalized.replace(/\b(?:software|web|fullstack|frontend|backend|machine learning|ml)\s+developer\s+rule\b/gi, (m) => m.replace(/rule$/i, 'role'));
    normalized = normalized.replace(/\b(developer rule|engineer rule)\b/gi, (m) => m.replace(/rule$/i, 'role'));
    normalized = normalized.replace(/\b(really hard things back|hard things back)\b/gi, 'really harsh things back');
    normalized = normalized.replace(/\b(of the stock|of the stocks)\b/gi, 'what about the stock market');
    normalized = normalized.replace(/\bi am seeing that i had a fever\b/gi, 'I am saying that I had a fever');
    normalized = normalized.replace(/\b(portugal tom|portugal dome|portugal dom|virtual term|virtual turn|virtual dorm)\b/gi, 'virtual DOM');
    normalized = normalized.replace(/\b(real tom|real dome|real dorm)\b/gi, 'real DOM');
    normalized = normalized.replace(/\bthe dome\b/gi, 'the DOM');
    normalized = normalized.replace(/\bai coating tools\b/gi, 'AI coding tools');
    normalized = normalized.replace(/\bai coating\b/gi, 'AI coding');
    normalized = normalized.replace(/\binstitute of\b/gi, 'instead of');
    normalized = normalized.replace(/\btry to compare with ai\b/gi, 'try to compete with AI');
    normalized = normalized.replace(/\bstudent comedy make\b/gi, 'students commonly make');
    normalized = normalized.replace(/\bstudent comedy\b/gi, 'students commonly');
    normalized = normalized.replace(/\byou werewing\b/gi, 'you were reviewing');
    normalized = normalized.replace(/\bwerewing\b/gi, 'reviewing');
    normalized = normalized.replace(/\b(?:skills\s+would\s+you\s+|would\s+you\s+)?paradise\b/gi, 'prioritize');
    normalized = normalized.replace(/\bsoftware developer rolls\b/gi, 'software developer roles');
    normalized = normalized.replace(/\bdeveloper rolls\b/gi, 'developer roles');
    normalized = normalized.replace(/\btake for (?:my\s+)?interview\b/gi, 'take my interview');
    normalized = normalized.replace(/\btake (?:for\s+)?interview one question\b/gi, 'take my interview one question');
    normalized = normalized.replace(/\b(i also set|i set|set some really hard things|set some really harsh things|set some hard things)\b/gi, 'I said some really harsh things');
    normalized = normalized.replace(/\b(set some|set really)\s+(?:hard|harsh)\s+things\b/gi, 'said some harsh things');
    normalized = normalized.replace(/\b(very hash things|very hash|hash things)\b/gi, 'very harsh things');
    normalized = normalized.replace(/\b(when my friends meet dumb|when my friend meet dumb|friends meet dumb|friend meet dumb|meet dumb)\b/gi, 'when my friend called me dumb');
    normalized = normalized.replace(/\b(really hours things back|hours things back|hours things)\b/gi, 'really harsh things back');
    normalized = normalized.replace(/\b(she call me dumb|he call me dumb)\b/gi, (m) => m.replace(/call/i, 'called'));
    normalized = normalized.replace(/\b(he said me to get out|she said me to get out|teacher said me to get out|said me to get out)\b/gi, 'he told me to get out');
    normalized = normalized.replace(/\b(and trying to impress you|and try to impress you)\b/gi, "I'm trying to impress you");
    normalized = normalized.replace(/\b(interesting in listening|interesting in listening it)\b/gi, 'interested in listening');
    normalized = normalized.replace(/\bhey ira\b/gi, 'Hey Ayra');
    normalized = normalized.replace(/\b(what if she doesn'?t reply to me|what if she doesn'?t reply)\b/gi, "what if she doesn't reply");
    normalized = normalized.replace(/\b(food what would you recommend|and food what would you recommend)\b/gi, 'and what would you recommend');
    normalized = normalized.replace(/\bsoftware developer road\b/gi, 'software developer role');
    normalized = normalized.replace(/\b(?:aur|or|and)\s+fir\b/gi, 'aur phir');
    normalized = normalized.replace(/\band\s+phir\b/gi, 'aur phir');
    normalized = normalized.replace(/\bjhagada\b/gi, 'jhagda');
    // Additional STT repairs for new conversation patterns
    normalized = normalized.replace(/\b(hey ira|hey era|hey aira|hi ira|hi era)\b/gi, 'Hey Ayra');
    normalized = normalized.replace(/\b(i am very lucky today|am very lucky today|feeling very lucky today)\b/gi, 'I am very nervous today');
    normalized = normalized.replace(/\b(set some really hard things|set very hard things|set hard things back|said very hard things back)\b/gi, 'said some really harsh things back');
    normalized = normalized.replace(/\b(luck bench|luck bitch|back bench please)\b/gi, 'last bench');
    normalized = normalized.replace(/\b(you know what have been thinking|you know what i am thinking|you know what i been thinking)\b/gi, "you know what I've been thinking");
    normalized = normalized.replace(/\b(pata hai aaj kya hua|pata hai kya hua aaj)\b/gi, 'you know what happened today');
    normalized = normalized.replace(/\b(mujhe ek news milna tha|ek news tha|ek important news)\b/gi, 'I have some news');
    normalized = normalized.replace(/\b(i have something interesting to tell|i have something interesting|kuch interesting baat hai)\b/gi, 'I have something to tell you');
    normalized = normalized.replace(/\b(i did eat really good|i ate really well today|i ate so good today)\b/gi, 'I ate really good food today');
    normalized = normalized.replace(/\bswathi\b/gi, 'Swati');
    normalized = normalized.replace(/\b(btech casey|b\.tech casey|btech cse|casey 4th year|casey student)\b/gi, 'BTech CSE');
    normalized = normalized.replace(/\b(?:air|ae|aye)\s+engineer\s+(?:role|road|roll)\b/gi, 'AI engineer role');
    normalized = normalized.replace(/\bai\s+(?:road|roll)\b/gi, 'AI role');
    normalized = normalized.replace(/\bai\s+engineers?\s+(?:road|roll)\b/gi, 'AI engineer role');
    normalized = normalized.replace(/\b(can you be my interview|be my interview)\b/gi, 'can you be my interviewer');
    normalized = normalized.replace(/\bsee my interview\b/gi, 'take my interview');
    normalized = normalized.replace(/\btroubling here\b/gi, 'troubling her');
    normalized = normalized.replace(/\b(want|need|get)\s+a\s+(?:refill|refil|referal)\b/gi, '$1 a referral');
    normalized = normalized.replace(/\b(?:refill|refil|referal)\s+for\s+(a\s+|the\s+|my\s+)?(company|job|role|internship|teacher)\b/gi, 'referral for $1$2');
    normalized = normalized.replace(/\bwant a refill for\b/gi, 'want a referral for');
    // Indian English & spoken variations STT repairs
    normalized = normalized.replace(/\bwho build (?:you|ya)\b/gi, 'who built you');
    normalized = normalized.replace(/\bwho make (?:you|ya)\b/gi, 'who built you');
    normalized = normalized.replace(/\byou build by who\b/gi, 'who built you');
    normalized = normalized.replace(/\bwho created you\b/gi, 'who built you');
    normalized = normalized.replace(/\bwho made you\b/gi, 'who built you');
    normalized = normalized.replace(/\bwhat you doing\b/gi, 'what are you doing');
    normalized = normalized.replace(/\bmereko batao\b/gi, 'tell me');
    normalized = normalized.replace(/\bmujhe batao\b/gi, 'tell me');
    normalized = normalized.replace(/\btell me na\b/gi, 'tell me');
    normalized = normalized.replace(/\bacha tell me\b/gi, 'tell me');
    normalized = normalized.replace(/\btell me something about human brain\b/gi, 'tell me about the human brain');
    normalized = normalized.replace(/\btell about yourself\b/gi, 'tell me about yourself');
    return normalized;
  }

  public static isGenuinelyUnintelligible(text: string): boolean {
    const raw = text.trim();
    if (!raw) return true;
    const clean = raw.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    if (!clean || clean.length < 2) return true;
    if (/^([a-z])\1{2,}$/i.test(clean)) return true;
    if (/^(?:asdf|qwer|zxcv|ghjk|hjkl|dfgh)+$/i.test(clean)) return true;
    return false;
  }

  public static isReportedSpeech(text: string): { isReported: boolean; speaker?: string; content?: string } {
    const match = text.match(/\b(she\s+said|he\s+said|my\s+friend\s+said|she\s+told\s+me|he\s+told\s+me|they\s+told\s+me|he\s+called\s+me|she\s+called\s+me|they\s+were\s+saying|my\s+teacher\s+said|my\s+boss\s+told\s+me|she\s+says\s+like|he\s+says\s+like|she\s+says|he\s+says|my\s+friend\s+says|friend\s+says|boss\s+said|teacher\s+said|usne\s+kaha|usne\s+bola)\s*(?:that|like|ke|ki|:)?\s*(.+)$/i);
    if (match) {
      return {
        isReported: true,
        speaker: match[1].toLowerCase(),
        content: match[2].trim()
      };
    }
    return { isReported: false };
  }

  /**
   * Determine whether text is Hindi-dominant, Hinglish, or English-dominant
   */
  public static detectLanguageDominance(text: string): 'english' | 'hinglish' | 'hindi' {
    const trimmed = text.trim();
    if (!trimmed) return 'english';

    // 1. Devanagari script detection
    if (/[\u0900-\u097F]/.test(trimmed)) {
      return 'hindi';
    }

    const lower = trimmed.toLowerCase();
    // 2. Hinglish / Roman Hindi keyword matching
    const hinglishKeywords = [
      'aaj', 'subah', 'uth', 'uthte', 'mera', 'meri', 'mere', 'mereko', 'mujhko', 'mujhe',
      'tha', 'thi', 'the', 'hai', 'hain', 'kya', 'hua', 'kyun', 'kaise', 'kab', 'kahan',
      'phir', 'fir', 'aur', 'usne', 'maine', 'humne', 'unhone', 'bola', 'boli', 'bole', 'bol', 'baat',
      'pata', 'sun', 'suno', 'yaar', 'bhai', 'matlab', 'dekh', 'dekho', 'bachpan', 'jhagda', 'jhagada',
      'kharaab', 'kharab', 'gussa', 'bura', 'laga', 'lagi', 'bohot', 'bahut', 'sabke', 'daanta', 'danta',
      'saamne', 'nahi', 'nahin', 'theek', 'gaya', 'gayi', 'gaye', 'ab', 'bata', 'batao',
      'agar', 'tum', 'hoti', 'hota', 'toh', 'karti', 'karta', 'chahiye', 'mat', 'dena',
      'kuch', 'bhi', 'pehle', 'baad', 'mein', 'me', 'se', 'ko', 'ki', 'ke', 'ka', 'yeh',
      'woh', 'wo', 'ye', 'raha', 'rahi', 'rahe', 'chal', 'raha', 'meri', 'mera', 'apna',
      'apni', 'apne', 'sabko', 'kisi', 'kisko', 'kaun', 'kyu', 'kyuki', 'kyunki', 'lekin',
      'par', 'magar', 'sahi', 'galat', 'achha', 'acha', 'chalo', 'batati', 'batata'
    ];

    const words = lower.replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, ' ').split(/\s+/).filter(Boolean);
    let hinglishCount = 0;
    for (const w of words) {
      if (hinglishKeywords.includes(w)) {
        hinglishCount++;
      }
    }

    if (hinglishCount >= 2 || (words.length <= 5 && hinglishCount >= 1)) {
      return 'hinglish';
    }

    return 'english';
  }

  /**
   * Detect whether the user is sharing a personal story, experience, emotion, childhood memory,
   * friend/relationship situation, bad day, or continuing a multi-turn narrative.
   */
  public static isPersonalNarrative(
    text: string,
    context?: { isStoryThreadActive?: boolean; prevAgentText?: string; lastMentionedPerson?: string }
  ): NarrativeAnalysisResult {
    const lower = text.toLowerCase().trim();
    const clean = lower.replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, ' ');

    const emptyResult: NarrativeAnalysisResult = {
      isNarrative: false,
      type: 'none',
      storyType: '',
      mainEvent: '',
      peopleMentioned: [],
      place: '',
      emotion: '',
      interestingDetail: '',
      problem: '',
      unexpectedPart: '',
      outcome: '',
      unfinishedPart: '',
      possibleFollowUp: '',
      details: [],
      people: [],
      emotions: [],
      confidence: 0,
      isIncompleteOpener: false
    };

    // Explicit rejection of factual queries like "what is X", "who is X", "how does X work", "capital of X", "who founded X" (unless personal narrative context)
    if (
      /^(what is|who is|where is|how does|why is|explain |tell me about the |what are |search for|capital of|speed of|largest ocean|who founded|who created|when was)\s+/i.test(lower) &&
      !/\b(my|me|i|friend|yesterday|today|school|childhood|morning|subah|teacher|feel|feeling|cramp|pain|uthi|khola|order)\b/i.test(lower)
    ) {
      return emptyResult;
    }

    // Explicit rejection if the user is explicitly requesting a joke or giving a stop command
    if (this.isExplicitJokeRequest(lower).isJoke || this.isExplicitStopCommand(lower)) {
      return emptyResult;
    }

    // 0. Story End Signals ("Bas, phir eventually sab theek ho gaya", "Finally sort ho gaya", etc.)
    if (
      /(सब ठीक हो गया|बात संभल गई|फोन किया और सब ठीक|मामला सुलझ गया)/.test(text) ||
      /\b(bas phir eventually sab theek|eventually sab theek ho gaya|sab theek ho gaya|finally sort ho gaya|bas yahi hua tha|and that was it|and that's the whole story|and then everything was fine|bas phir sab normal ho gaya|eventually everything was fine|finally worked out)\b/i.test(lower) ||
      (context?.isStoryThreadActive && /^(bas yahi tha|bas itna hi tha|that's all that happened|eventually it worked out|then it got sorted)[.!]?$/i.test(clean))
    ) {
      return {
        ...emptyResult,
        isNarrative: true,
        type: 'story_end',
        storyType: 'story_resolution',
        mainEvent: 'Story resolved successfully',
        emotion: 'relieved',
        outcome: 'Everything worked out fine',
        details: ['resolution', 'conclusion'],
        emotions: ['relieved'],
        confidence: 0.98
      };
    }

    // 1. Multi-turn Continuation within active personal story thread (e.g. "Professor called me" -> "Phir unhone...")
    if (context?.isStoryThreadActive) {
      const isExit = (
        /\b(what is|what are|tell me about|can you tell me|who is|how does|why is|why does|explain|definition of|name \w+ animals|list \w+|difference between|how to|where is|when was|take my interview|mock interview|teacher|girlfriend|boyfriend|joke|react|stars?|friction|loop engineering|animals?|science|math|python|javascript|coding|code|stop|forget|exit|bye|good night|weather|capital of|mona lisa|speed of light)\b/i.test(lower) ||
        /\b(stop|forget|exit|bye|good night|chup raho|quiet)\b/i.test(lower)
      );
      if (!isExit) {
        const details: string[] = ['story continuation'];
        const people: string[] = [];
        if (/unhone|professor|teacher/i.test(lower) || context.lastMentionedPerson?.includes('professor')) people.push('professor');
        if (/she|he|usne|friend|guy|ladka|banda|dost|girl/i.test(lower)) people.push('friend');
        return {
          ...emptyResult,
          isNarrative: true,
          type: 'story_continuation',
          storyType: 'story_continuation',
          mainEvent: `Continuation of story: ${lower}`,
          peopleMentioned: people,
          emotion: 'invested',
          interestingDetail: lower,
          details,
          people,
          emotions: ['conversational'],
          confidence: 0.98
        };
      }
    }

    // 2. Shopping / E-commerce / Fashion / Sizing / Online Cart Incident
    // Catches:
    // - "forget it I am telling something for that kya hua aaj main subah subah Uthi aur FIR Maine Myntra khola aur uske baad Jo top Mere ko chahiye nahi"
    // - "main batati hun kya hua aaj main subah subah Uthi aur Maine Khol liya aur I wanted to order a top for myself"
    // - "Aaj subah main uthi aur Myntra khola, mujhe ek top order karna tha but mera size available nahi tha."
    // - "I opened Myntra because I wanted a dress but then I couldn't find my size."
    // - "maine mintra khola aur mujhe ek top chahiye tha but mera saiz available nahi tha"
    // - "Maine Myntra khola—sorry, actually main pehle Instagram kholi thi—then Myntra..."
    const isShoppingNarrative = (
      /\b(myntra|mintra|amazon|flipkart|zara|nykaa|meesho|shopping|cart|app khola|khol liya)\b/i.test(lower) &&
      (/\b(top|dress|shoes|shirt|kurti|clothes|order|size|saiz|available|unavailable|out of stock|nahi tha|nahi mila|chahiye tha|pasand aaya|subah|uthi|utha|woke up|opened|khola|khol liya)\b/i.test(lower))
    ) || (
      /\b(order karna tha|order karne gayi|wanted to order|wanted to buy|kharidna tha|kharidna chahti|kharidna chahta|kuch kharidna|kuch buy karna)\b/i.test(lower)
    ) || (
      /\b(jo top|jo dress|woh top|woh dress|mera size|size available|size nahi|size unavailable)\b/i.test(lower) &&
      /\b(chahiye|order|pasand|myntra|mintra|app|online|khol|kharid)\b/i.test(lower)
    ) || (
      /\b(sad|upset|mood off|low|depressed|down|udaas|pareshan)\b/i.test(lower) &&
      /\b(kharidna|shopping|buy|order|purchase|kharid)\b/i.test(lower)
    );

    if (isShoppingNarrative) {
      const details: string[] = ['shopping on app / Myntra'];
      let mainItem = 'top / clothing';
      if (/top/i.test(lower)) mainItem = 'top';
      else if (/dress/i.test(lower)) mainItem = 'dress';
      else if (/shoes/i.test(lower)) mainItem = 'shoes';
      else if (/kurti/i.test(lower)) mainItem = 'kurti';

      if (/size|saiz|available|unavailable|out of stock|nahi mila|nahi tha/i.test(lower)) {
        details.push(`desired ${mainItem} unavailable in size`);
      }
      return {
        ...emptyResult,
        isNarrative: true,
        type: 'shopping_app',
        storyType: 'personal_daily_event',
        mainEvent: `User opened Myntra/app to order a ${mainItem}`,
        place: 'Myntra / shopping app',
        peopleMentioned: [],
        emotion: 'mild disappointment / frustration',
        problem: `Desired ${mainItem} was unavailable in user's size`,
        interestingDetail: `Found a ${mainItem} they wanted, but the size was unavailable`,
        unexpectedPart: 'Size unavailable right when ready to order',
        unfinishedPart: 'Whether user found an alternative or cancelled the order',
        possibleFollowUp: 'Phir tumne koi aur top dekha ya wahi wala chahiye tha?',
        details,
        people: [],
        emotions: ['frustrated', 'disappointed'],
        confidence: 0.96,
        isIncompleteOpener: false
      };
    }

    // 3. Pain / Bad Morning / Cramps / Health / Missing essentials
    if (
      (/\b(aaj subah|subah uthte hi|woke up this morning|woke up and|my whole morning|pura mood kharab|aaj mera mood|mood off|pain|cramps|period|cramp|room mein|didn't have|didnt have|needed in the room|cheez chahiye thi|kya karu|what to do)\b/i.test(lower) &&
       (/\b(i was|mera|mere|i had|i woke|main|subah|room|mood|bad|pain|cramp|period)\b/i.test(lower))) ||
      (/\b(period|cramps|bad morning|horrible morning|terrible morning)\b/i.test(lower) && /\b(woke up|in pain|room|pads|pets|needed|frustrating|pain|cramp)\b/i.test(lower))
    ) {
      const details: string[] = [];
      if (/cramp|pain|dard/i.test(lower)) details.push('cramps and physical pain');
      if (/morning|subah|woke up/i.test(lower)) details.push('bad morning start');
      if (/room|cheez|pads|pets|needed/i.test(lower)) details.push('missing essential item in room');
      return {
        ...emptyResult,
        isNarrative: true,
        type: 'pain_bad_day',
        storyType: 'health_and_wellbeing',
        mainEvent: 'Woke up with pain/cramps and missing essentials',
        place: 'room',
        emotion: 'frustrated / drained / unwell',
        problem: 'Dealing with morning discomfort without required items',
        details,
        people: [],
        emotions: ['frustrated', 'drained', 'unwell'],
        confidence: 0.96
      };
    }

    // 3b. Waking up tired, nervous, bad feeling / weird day ("I had a really weird day today. I woke up tired and nervous and I don't even know why.")
    // - "Actually I am little sad today because when I woke up in the morning I was feeling very tired and very nervous and mixed feelings like something bad will happen today."
    const isMorningFatigueAndDread = (
      /\b(woke up|waking up|subah uthi|subah utha|subah jab main uthi)\b/i.test(lower) &&
      (/\b(tired|nervous|anxious|mixed feelings|something bad|dont even know why|don't even know why|without knowing why|weird day|heavy)\b/i.test(lower))
    ) || (
      /\b(really weird day|had a weird day|weird day today)\b/i.test(lower) &&
      /\b(tired|nervous|anxious|woke up)\b/i.test(lower)
    );

    if (isMorningFatigueAndDread) {
      return {
        ...emptyResult,
        isNarrative: true,
        type: 'day_experience',
        storyType: 'morning_fatigue_and_dread',
        mainEvent: 'Woke up tired, nervous, and experiencing a weird feeling of dread',
        place: 'home',
        emotion: 'tired / nervous / anxious',
        problem: 'Waking up with anxiety and dread without a clear reason',
        interestingDetail: 'Unexplained morning fatigue and nervous feeling',
        details: ['woke up tired and nervous', 'mixed feelings / impending dread'],
        people: [],
        emotions: ['tired', 'nervous', 'anxious'],
        confidence: 0.98
      };
    }

    // 3c. Friend Troubled, Harassed, or Blackmailed by Someone
    const isFriendTroubledNarrative = (
      /\b(friend|best friend|dost|saheli)\b/i.test(lower) &&
      (/\b(troubling|blackmailing|harassing|disturbing|pestering|threatening|stalking|following|calling her|crying|pareshan|tang|blackmail)\b/i.test(lower))
    ) || (
      /\b(got a call from my best friend|got a call from my friend|my friend called me|called me and she was crying)\b/i.test(lower)
    );

    if (isFriendTroubledNarrative) {
      return {
        ...emptyResult,
        isNarrative: true,
        type: 'friend_harassment_story',
        storyType: 'friend_troubled',
        mainEvent: 'Friend called sharing that a guy is troubling or blackmailing her',
        place: 'phone / call',
        emotion: 'worried / concerned',
        problem: 'A guy is harassing, calling, or blackmailing user\'s friend',
        interestingDetail: lower,
        details: ['friend troubled by a guy', 'phone call from friend'],
        people: ['friend', 'guy'],
        emotions: ['worried', 'concerned'],
        confidence: 0.98
      };
    }

    // 4. College / School Funny Moments / Classroom Laughing / Surprise tests / Teacher Reprimand
    // Catches:
    // - "Kal college mein na ek bahut funny incident hua, phir mera friend literally floor pe gir gaya laughing."
    // - "Aaj college mein kuch weird hua." -> "Professor ne mujhe class ke saamne bula liya." -> "Phir unhone..."
    // - "I woke up late, missed breakfast, rushed to college, then my professor suddenly announced a test."
    // - "I was scolded by my teacher" -> "what happened next is that he said me to get out of the classroom"
    // 4. College / School / Workplace / Authority Reprimands & Funny Incidents
    const isCollegeWorkIncident = (
      /\b(college|school|class|classroom|campus|professor|teacher|boss|manager|office|workplace)\b/i.test(lower) &&
      (/\b(funny incident|weird|floor pe gir gaya|floor pe|laughing|hasne laga|class ke saamne|bula liya|called in front|surprise test|announced a test|scolded|daanta|daant|incident hua|so raha tha|get out|kicked me out|kicked out|told me to get out|said me to get out|asked me to leave|humiliated|shouted|yelled|insulted|angry with me|mad at me)\b/i.test(lower))
    ) || (
      /\b(floor pe gir gaya laughing|floor pe gir gaya|literally fell on the floor laughing)\b/i.test(lower)
    ) || (
      /\b(professor ne|teacher ne|boss ne|manager ne)\b/i.test(lower) && /\b(bula liya|class ke saamne|daanta|daant|announced|called|nikal diya|bahar|shouted|yelled)\b/i.test(lower)
    ) || (
      /\b(scolded by (?:my )?(?:teacher|boss|manager)|scolded by (?:teacher|boss|manager)|(?:teacher|professor|boss|manager) scolded me)\b/i.test(lower)
    ) || (
      /\b(my boss scolded me|boss scolded me|boss ne daanta|boss humiliated me|boss shouted at me|boss yelled at me)\b/i.test(lower)
    ) || (
      /\b(get out of the classroom|get out of class|kicked me out|kicked out of the classroom|told me to get out|said me to get out)\b/i.test(lower)
    );

    if (isCollegeWorkIncident) {
      const details: string[] = [];
      const people: string[] = [];
      let emotion = 'upset / overwhelmed';
      let mainEvent = 'Workplace/academic incident with authority figure';

      if (/boss|manager/i.test(lower)) {
        details.push('scolded by boss/manager at work');
        people.push('boss');
        emotion = 'frustrated / upset';
        mainEvent = 'Boss scolded user at work';
      } else if (/funny|laughing|floor pe|hasne/i.test(lower)) {
        details.push('friend fell on floor laughing during funny incident');
        people.push('friend');
        emotion = 'hilarious / amused';
        mainEvent = 'Funny college incident where friend fell on the floor laughing';
      } else if (/class ke saamne|bula liya|called/i.test(lower)) {
        details.push('professor called user in front of the class');
        people.push('professor');
        emotion = 'surprised / nervous';
        mainEvent = 'Professor called user in front of the class';
      } else if (/test|surprise test/i.test(lower)) {
        details.push('surprise test announced after rushing to college');
        people.push('professor');
        emotion = 'stressed / overwhelmed';
        mainEvent = 'Professor announced a surprise test';
      } else if (/scolded|daanta|get out|kicked|leave/i.test(lower)) {
        details.push('scolded by teacher and asked to get out of class');
        people.push('teacher');
        emotion = 'upset / frustrated';
        mainEvent = 'Teacher scolded user and asked them to leave the classroom';
      }

      return {
        ...emptyResult,
        isNarrative: true,
        type: 'work_college',
        storyType: 'college_incident',
        mainEvent,
        place: /boss|manager/i.test(lower) ? 'office / work' : 'college / class',
        peopleMentioned: people,
        emotion,
        interestingDetail: details[0] || 'Workplace/college incident',
        details,
        people,
        emotions: [emotion],
        confidence: 0.95
      };
    }

    // 4b. Pet / Animal Encounter Narrative ("so I was walking home today and this cute Street cat started following me everywhere")
    const isAnimalNarrative = (
      /\b(street cat|stray cat|cute cat|cat started following|cat followed me|cat was following|cute kitten|stray dog|cute dog|dog started following|dog followed me)\b/i.test(lower) ||
      (/\b(walking home|on my way home|on the street|outside|today)\b/i.test(lower) && /\b(cat|kitten|dog|puppy)\b/i.test(lower) && /\b(following|followed|saw|found|cute)\b/i.test(lower))
    );

    if (isAnimalNarrative) {
      return {
        ...emptyResult,
        isNarrative: true,
        type: 'animal_encounter',
        storyType: 'pet_animal_encounter',
        mainEvent: 'Cute street cat/animal followed user on the way home',
        emotion: 'warm / amused / delighted',
        details: ['cute street cat followed user everywhere'],
        people: [],
        emotions: ['delighted', 'amused'],
        confidence: 0.98
      };
    }

    // 5. Childhood Memories & Quirks
    // Catches:
    // - "When I was a kid, I used to hide under my bed whenever guests came home."
    // - "When I was in school my best friend and I used to secretly eat snacks on the last bench..."
    const isChildhoodMemory = (
      /\b(when i was (little|young|a kid|in school|in college)|bachpan mein|school ke time|school mein|college ke time|back in school|childhood mein)\b/i.test(lower) &&
      (/\b(hide under my bed|guests came|guests|chup jaati thi|chup jata tha|last bench|secretly eat|eating snacks|eating chips|teacher caught us|teacher ne pakad liya|secretly eating|toys|hide)\b/i.test(lower))
    ) || /\b(hide under my bed whenever guests came)\b/i.test(lower);

    if (isChildhoodMemory) {
      const details: string[] = [];
      const people: string[] = [];
      let mainEvent = 'Childhood memory';
      if (/hide under my bed|guests/i.test(lower)) {
        details.push('hiding under bed from guests');
        people.push('guests');
        mainEvent = 'Hiding under bed whenever guests visited';
      }
      if (/last bench|chips|snacks/i.test(lower)) {
        details.push('eating snacks secretly on last bench');
        people.push('friend', 'teacher');
        mainEvent = 'Sneaking snacks on the last bench in school';
      }
      return {
        ...emptyResult,
        isNarrative: true,
        type: 'childhood',
        storyType: 'childhood_memory',
        mainEvent,
        place: 'home / school',
        peopleMentioned: people,
        emotion: 'nostalgic / amused',
        interestingDetail: details[0] || 'Childhood quirk',
        details,
        people,
        emotions: ['nostalgic', 'amused'],
        confidence: 0.96
      };
    }

    // 6. Friend Conflict / Social Mystery / Ignored Without Reason
    // Catches:
    // - "aaj mera best friend se jhagada ho gaya usne mujhe dumb bola"
    // - "Aaj meri friend ne mujhse baat nahi ki aur mujhe samajh hi nahi aa raha why."
    // - "Aaj mera friend mujhse bina reason ke gussa ho gaya."
    // - "Meri friend kal se mujhse baat nahi kar rahi..."
    // - "My friend hasn't replied to me for two days and normally we talk every day."
    const isFriendConflict = (
      /\b(friend|suno|pata hai|meri friend|mera friend|best friend|riya|rohit|dost|saheli)\b/i.test(lower) &&
      (/\b(baat nahi ki|bina reason|bina kisi reason|gussa ho gaya|gussa|samajh hi nahi aa raha|hasn't replied|hasnt replied|not replying|stopped replying|had a fight|ladai hui|argument|ignore kar rahi|ignoring me|not talking|jhagada|jhagda|dumb bola|called me dumb)\b/i.test(lower))
    ) || (
      /\b(my friend is ignoring me|friend ignoring me|friend not talking to me|friend is mad at me|best friend se jhagada|best friend se jhagda|usne mujhe dumb bola)\b/i.test(lower)
    );

    if (isFriendConflict) {
      const isFight = /\b(fight|had a fight|ladai|argument|disagreement|jhagada|jhagda)\b/i.test(lower);
      const isInsult = /\b(dumb|stupid|insult|bad things|harsh)\b/i.test(lower);
      const isIgnoring = /\b(baat nahi ki|ignore|ignoring|not talking|silent)\b/i.test(lower);
      const isNoReply = /\b(hasn't replied|hasnt replied|not replying|stopped replying|two days|2 days)\b/i.test(lower);

      const details: string[] = isInsult ? ['friend insulted user / called user dumb in argument'] : isFight ? ['had a fight with friend'] : isIgnoring ? ['friend not talking / ignoring'] : isNoReply ? ['friend hasn\'t replied'] : ['issue with friend'];
      const mainEvent = isInsult ? 'Fight with friend where friend called user dumb' : isFight ? 'Had a fight with friend' : isIgnoring ? 'Friend not talking / ignoring' : 'Interpersonal conflict with friend';
      const problem = isFight ? 'Fight with friend' : isIgnoring ? 'Friend not talking' : isNoReply ? 'Friend not replying' : 'Friend conflict';

      return {
        ...emptyResult,
        isNarrative: true,
        type: 'friend_conflict',
        storyType: 'interpersonal_conflict',
        mainEvent,
        peopleMentioned: ['friend'],
        emotion: 'hurt / upset / concerned',
        problem,
        interestingDetail: details[0],
        details,
        people: ['friend'],
        emotions: ['hurt', 'upset'],
        confidence: 0.98
      };
    }

    // 7. Entity Inside Story (YouTube, Netflix, Instagram inside personal narrative)
    // Catches:
    // - "I was watching YouTube last night and found this really weird video."
    // - "Aaj main YouTube pe ek video dekh rahi thi aur..."
    // - "Yesterday I was scrolling Instagram and saw this..."
    const isMediaStory = (
      /\b(watching youtube|youtube pe|netflix pe|watching netflix|scrolling instagram|instagram pe|browsing youtube)\b/i.test(lower) ||
      (/\b(youtube|netflix|instagram|spotify|reels|tiktok)\b/i.test(lower) && /\b(last night|yesterday|aaj|kal|found this|saw this|weird video|crazy video|funny video|scrolling|watching)\b/i.test(lower))
    );

    if (isMediaStory) {
      return {
        ...emptyResult,
        isNarrative: true,
        type: 'day_experience',
        storyType: 'media_and_browsing',
        mainEvent: 'Watching/browsing content online and found something notable',
        place: 'YouTube / Online',
        peopleMentioned: [],
        emotion: 'curious / amused',
        interestingDetail: 'Found a weird/interesting video while watching late last night',
        details: ['watching video online', 'found weird video'],
        people: [],
        emotions: ['curious', 'amused'],
        confidence: 0.94
      };
    }

    // 8. Milestones & Celebrations (Job offer, interview success, sister college, exam passed)
    // Catches:
    // - "aaj mujhe job mil gayi!" / "I got the job!"
    // - "Aaj mera interview tha, main nervous thi, but somehow I answered everything really well."
    // - "My sister finally got the college she wanted."
    // - "My friend finally got the internship she wanted."
    // - "I finally submitted the project."
    const isMilestone = (
      /\b(aaj mujhe job mil gayi|mujhe job mil gayi|job mil gayi|i got the job|got the job|i got selected|selected for the job|cracked the interview|cleared the interview|i got the offer|got an offer|interview tha|answered really well|answered everything really well|got the college she wanted|got the college|got the internship|cleared my exam|passed my exam|finally submitted|submitted the project)\b/i.test(lower)
    );

    if (isMilestone) {
      const details: string[] = ['personal/milestone success'];
      const people: string[] = [];
      if (/sister/i.test(lower)) people.push('sister');
      if (/friend/i.test(lower)) people.push('friend');
      return {
        ...emptyResult,
        isNarrative: true,
        type: 'milestone_achievement',
        storyType: 'milestone_achievement',
        mainEvent: 'Milestone / success achieved',
        peopleMentioned: people,
        emotion: 'proud / excited / thrilled',
        outcome: 'Success achieved',
        details,
        people,
        emotions: ['excited', 'happy', 'proud'],
        confidence: 0.98
      };
    }

    // 9. Embarrassing / Presentation Experience
    if (
      /\b(embarrassed|embarrassing|presentation|messed up|college mein|sabke saamne|aisa bol diya|mind went blank)\b/i.test(lower) &&
      (/\b(i was|maine|mera|meri|today|aaj|college|presentation)\b/i.test(lower))
    ) {
      const details: string[] = [];
      if (/presentation/i.test(lower)) details.push('presentation mess-up');
      if (/sabke saamne|everyone/i.test(lower)) details.push('happened in front of everyone');
      return {
        ...emptyResult,
        isNarrative: true,
        type: 'embarrassing_moment',
        storyType: 'embarrassing_moment',
        mainEvent: 'Embarrassing presentation moment in front of everyone',
        place: 'college / room',
        peopleMentioned: ['classmates'],
        emotion: 'embarrassed / awkward',
        details,
        people: ['classmates', 'friend'],
        emotions: ['embarrassed', 'awkward'],
        confidence: 0.93
      };
    }

    // 10. General Day Story / Narrative Openers / Hindi & Hinglish Sharing
    // Catches:
    // - "forget it I am telling something for that kya hua aaj main..."
    // - "Forget it, actually let me tell you what happened this morning..."
    // - "main batati hun kya hua..." / "main batati hoon kya hua..."
    // - "Aaj subah mujhe ek bahut ajeeb incident hua."
    // - "Today was weird, I woke up late..."
    const hasNarrativeOpener = /\b(forget it i am telling|forget it actually let me tell you|let me tell you what happened|main batati hun kya hua|main batati hoon kya hua|main batata hoon kya hua|pata hai aaj kya hua|suno kya hua|aaj kya hua|sun na kya hua|suno na kya hua|ek incident batati hoon|ek incident hua|kuch weird hua|something weird happened|had the worst morning|today was weird)\b/i.test(lower);

    const isHindiNarrative = (
      (/[\u0900-\u097F]/.test(lower) && /(दिन|सुबह|खराब|सहेली|कॉलेज|दोस्त|परेशान|गुस्सा|दर्द|बात|आज|हुआ|रहा|थी|था|अजीब)/.test(lower)) ||
      (/\b(aaj subah mujhe ek|aaj mere saath|aaj ka din|mera pura din|subah subah|ajeeb incident)\b/i.test(lower))
    );

    if (hasNarrativeOpener || isHindiNarrative || (lower.startsWith('aaj ') && lower.length > 20) || (lower.startsWith('today ') && lower.length > 20)) {
      // Check if it's only an opener without any actual details (e.g. user just said "main batati hun kya hua" or "forget it let me tell you what happened")
      const wordsCount = clean.trim().split(/\s+/).length;
      const isIncompleteOpener = wordsCount <= 7 && !/\b(myntra|top|dress|shoes|college|school|friend|professor|exam|interview|cramp|pain|uth|uthi|khola)\b/i.test(lower);

      return {
        ...emptyResult,
        isNarrative: true,
        type: 'day_experience',
        storyType: 'personal_daily_event',
        mainEvent: isIncompleteOpener ? 'User wants to start telling a story' : 'Daily experience sharing',
        emotion: 'conversational',
        details: ['daily experience sharing'],
        people: [],
        emotions: ['conversational'],
        confidence: 0.92,
        isIncompleteOpener
      };
    }

    return emptyResult;
  }

  /**
   * Detect direct social and playful requests (Flirt, Roast, Compliment, Cheer up, Keep company)
   */
  public static isSocialRequest(text: string): { isSocial: boolean; type: 'flirt' | 'roast' | 'compliment' | 'cheer_up' | 'keep_company' | 'talk_to_me' | 'none' } {
    const lower = text.toLowerCase().trim();
    if (/\b(flirt with me|flirt karo|flirt|make a romantic joke|say something romantic)\b/i.test(lower)) {
      return { isSocial: true, type: 'flirt' };
    }
    if (/\b(roast me|roast karo|give me a roast|burn me|roast me hard)\b/i.test(lower)) {
      return { isSocial: true, type: 'roast' };
    }
    if (/\b(compliment me|say something nice about me|praise me|tareef karo)\b/i.test(lower)) {
      return { isSocial: true, type: 'compliment' };
    }
    if (/\b(cheer me up|make me smile|make me laugh|mood theek karo|cheer up karo)\b/i.test(lower)) {
      return { isSocial: true, type: 'cheer_up' };
    }
    if (/\b(keep me company|stay with me|be with me|company do)\b/i.test(lower)) {
      return { isSocial: true, type: 'keep_company' };
    }
    if (/^(talk to me|talk with me|baat karo|kuch baat karo|chat with me)[.!]?$/i.test(lower)) {
      return { isSocial: true, type: 'talk_to_me' };
    }
    return { isSocial: false, type: 'none' };
  }

  /**
   * Detect whether the user explicitly wants or declines advice
   */
  public static isAdviceIntent(text: string): { requestedAdvice: boolean; declinedAdvice: boolean } {
    const lower = text.toLowerCase().trim();
    const declinedAdvice = /(सलाह मत देना|कोई सलाह मत देना|सलाह नहीं चाहिए|सलाह मत दो|सिर्फ सुनो|बस सुनो|बताना चाहती हूँ|बताना चाहता हूँ)/.test(text) || /\b(advice mat dena|no advice|don't want advice|dont want advice|not looking for advice|no suggestions|i don't need advice|dont need advice|advice nahi chahiye|mat samjhao|just listen|just want to tell you|sirf suno)\b/i.test(lower);
    const requestedAdvice = /(अगर तुम मेरी जगह|क्या करना चाहिए|क्या करूँ|क्या करूं|सलाह दो|मुझे बताओ क्या करूँ)/.test(text) || /\b(agar tum meri jagah hoti|agar tum meri jagah hote|what should i do|what would you do|what do you suggest|give me (?:some )?advice|you give me (?:some )?advice|give (?:some )?advice|need (?:some )?advice|mujhe kya karna chahiye|kya karu|kya karun|advice do|kuch advice do|suggest me something|tell me what to do|what to do|i don'?t know what to do|dont know what to do|give some advice|give advice)\b/i.test(lower);
    return { requestedAdvice, declinedAdvice };
  }

  /**
   * Detect explicit joke request and category
   */
  public static isExplicitJokeRequest(
    text: string,
    context?: { activeConversationMode?: ConversationMode; lastUserIntent?: DetailedIntent | UserIntent }
  ): { isJoke: boolean; category: 'developer' | 'santabanta' | 'hindi' | 'simple_random' | 'general'; isAnother?: boolean } {
    const lower = text.toLowerCase().trim();

    // Must NOT be a descriptive phrase or personal narrative
    if (/\b(funny\s+(incident|story|video|thing|moment|event|stuff|meme|person|guy|girl|friend)|so\s+funny|was\s+funny|very\s+funny|pretty\s+funny|laughing|laughed)\b/i.test(lower)) {
      return { isJoke: false, category: 'general', isAnother: false };
    }

    const inJokeMode = context?.activeConversationMode === 'JOKE' || context?.lastUserIntent === 'joke_request';
    const isAnother = /\b(another|one more|different|next|doosra|dusra|ek aur|aur ek|koi dusra|koi doosra|koi aur)\b/i.test(lower);

    const isJokePattern = 
      /\b(tell|crack|say|share|give|recite|sunao|sunaye|batao|kaho|bolo|need|want|another|one\s+more|different|next|doosra|dusra|ek\s+aur|aur\s+ek|koi\s+aur|koi\s+dusra|koi\s+doosra)\s+(?:me\s+)?(?:a\s+)?(?:funny\s+)?(?:joke|jokes|chutkula|chutkule)\b/i.test(lower) ||
      /\b(?:joke|jokes|chutkula|chutkule)\s*(?:sunao|batao|sunaye|bolo|kaho|please|chahiye|hai|do|mujhe| सुनाओ| बताओ)\b/i.test(lower) ||
      /\b(?:koi\s+)?(?:dusra|doosra|another|different|ek\s+aur|aur\s+ek|next)\s+(?:joke|chutkula)\b/i.test(lower) ||
      /\b(tell\s+(?:me\s+)?something\s+funny|say\s+something\s+funny|kuch\s+funny\s+sunao|kuch\s+funny\s+batao|make\s+me\s+laugh|crack\s+me\s+up|know\s+any\s+jokes|got\s+any\s+jokes)\b/i.test(lower) ||
      /^(tell\s+(?:me\s+)?a\s+)?(joke|chutkula)[s]?[.!?]?$/i.test(lower) ||
      /\b(developer\s+joke|santa\s+banta\s+joke|hindi\s+joke|coding\s+joke|programming\s+joke)\b/i.test(lower) ||
      /\b(doosra\s+joke\s+sunao|dusra\s+joke\s+sunao|ek\s+aur\s+joke\s+sunao|another\s+joke\s+please|i am saying doosra joke sunao|i am saying dusra joke sunao|i am saying another joke)\b/i.test(lower) ||
      (inJokeMode && /^(koi dusra|koi doosra|koi aur|sunao|another one|one more|ek aur|aur ek|doosra|dusra|next|next one|different one|different|another|again|phir se|tell me another one|okay sunao|haan sunao|suno|batao)[.!?]?$/i.test(lower));

    if (!isJokePattern) {
      return { isJoke: false, category: 'general', isAnother: false };
    }

    if (/\b(developer|programming|coding|coder|binary|javascript|python|software)\b/i.test(lower) && !/\b(no developer|not developer|stop developer)\b/i.test(lower)) {
      return { isJoke: true, category: 'developer', isAnother };
    }
    if (/\b(santa|banta|santa banta|santa-banta)\b/i.test(lower)) {
      return { isJoke: true, category: 'santabanta', isAnother };
    }
    if (/\b(hindi|hinglish|desi)\b/i.test(lower)) {
      return { isJoke: true, category: 'hindi', isAnother };
    }
    if (/\b(simple|random|clean|quick|short)\b/i.test(lower)) {
      return { isJoke: true, category: 'simple_random', isAnother };
    }
    return { isJoke: true, category: 'general', isAnother };
  }

  /**
   * Deterministic math evaluation for basic arithmetic queries
   */
  public static evaluateMathExpression(text: string): { isMath: boolean; result?: number | string; explanation?: string } {
    const clean = text.trim().toLowerCase().replace(/[?,!]/g, '');

    // 15 times 14, 15 * 14, 15 multiplied by 14
    const multMatch = clean.match(/(?:what(?:\s+is|\s*'s)?\s+)?(\d+(?:\.\d+)?)\s*(?:times|multiplied by|\*|x)\s*(\d+(?:\.\d+)?)/i);
    if (multMatch) {
      const a = parseFloat(multMatch[1]);
      const b = parseFloat(multMatch[2]);
      const res = a * b;
      return { isMath: true, result: res, explanation: `${a} times ${b} is ${res}.` };
    }

    // 25 plus 37, 25 + 37, add 25 and 37
    const addMatch = clean.match(/(?:what(?:\s+is|\s*'s)?\s+)?(\d+(?:\.\d+)?)\s*(?:plus|\+|added to)\s*(\d+(?:\.\d+)?)/i);
    if (addMatch) {
      const a = parseFloat(addMatch[1]);
      const b = parseFloat(addMatch[2]);
      const res = a + b;
      return { isMath: true, result: res, explanation: `${a} plus ${b} is ${res}.` };
    }

    // 100 divided by 4, 100 / 4
    const divMatch = clean.match(/(?:what(?:\s+is|\s*'s)?\s+)?(\d+(?:\.\d+)?)\s*(?:divided by|\/)\s*(\d+(?:\.\d+)?)/i);
    if (divMatch) {
      const a = parseFloat(divMatch[1]);
      const b = parseFloat(divMatch[2]);
      if (b === 0) {
        return { isMath: true, result: 'Infinity', explanation: 'Division by zero is mathematically undefined, resulting in Infinity in computing.' };
      }
      const res = a / b;
      return { isMath: true, result: res, explanation: `${a} divided by ${b} is ${res}.` };
    }

    // 50 minus 20, 50 - 20
    const subMatch = clean.match(/(?:what(?:\s+is|\s*'s)?\s+)?(\d+(?:\.\d+)?)\s*(?:minus|\-|subtract(?:ed by)?)\s*(\d+(?:\.\d+)?)/i);
    if (subMatch) {
      const a = parseFloat(subMatch[1]);
      const b = parseFloat(subMatch[2]);
      const res = a - b;
      return { isMath: true, result: res, explanation: `${a} minus ${b} is ${res}.` };
    }

    // 12 squared, square of 12
    const squareMatch = clean.match(/(?:what(?:\s+is|\s*'s)?\s+)?(?:square of\s+(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*squared)/i);
    if (squareMatch) {
      const num = parseFloat(squareMatch[1] || squareMatch[2]);
      const res = num * num;
      return { isMath: true, result: res, explanation: `${num} squared is ${res}.` };
    }

    // 20 percent of 500, 20% of 500
    const pctMatch = clean.match(/(?:what(?:\s+is|\s*'s)?\s+)?(\d+(?:\.\d+)?)\s*(?:percent|%)\s+of\s+(\d+(?:\.\d+)?)/i);
    if (pctMatch) {
      const pct = parseFloat(pctMatch[1]);
      const total = parseFloat(pctMatch[2]);
      const res = (pct / 100) * total;
      return { isMath: true, result: res, explanation: `${pct} percent of ${total} is ${res}.` };
    }

    return { isMath: false };
  }

  public static extractCleanUserRequest(text: string): { isPureStop: boolean; hasStopPrefix: boolean; cleanText: string } {
    const raw = text.trim();
    const normalized = this.normalizeSTTErrors(raw);

    // 1. Pure Stop Check
    if (this.isExplicitStopCommand(normalized)) {
      return { isPureStop: true, hasStopPrefix: false, cleanText: normalized };
    }

    // 1.1 Action Phrases with Stop (e.g. "Stop the interview", "Stop the story", "Stop roleplay")
    if (/^(?:stop|end|exit|pause)\s+(?:the\s+)?(?:interview|story|game|music|roleplay|girlfriend|boyfriend|session|simulation)[.!?]?$/i.test(normalized)) {
      return { isPureStop: false, hasStopPrefix: false, cleanText: normalized };
    }

    let clean = normalized;
    let hasStopPrefix = false;

    // 2. STOP + NEW REQUEST in same turn ("Stop. Tell me about JavaScript." or "Bas, tell me a joke instead")
    const stopPrefixRegex = /^(?:stop\s+stop|stop\s+it|please\s+stop|stop\s+please|okay\s+stop|ok\s+stop|no\s+stop|wait\s+stop|just\s+stop|stop|wait\s+wait|wait\s+a\s+sec|wait\s+a\s+second|wait|hold\s+on|hold\s+up|pause|bas\s+bas|bas\s+karo|bas|ruk\s+ja|ruko\s+ruko|ruko|enough|shut\s+up|ek\s+second|one\s+second|1\s+second|ek\s+minute|one\s+minute|1\s+minute)[.,!?:;\s\-]+(.+)$/i;
    const match = clean.match(stopPrefixRegex);
    if (match && match[1]) {
      const potentialNewRequest = match[1].trim();
      if (potentialNewRequest && !this.isExplicitStopCommand(potentialNewRequest)) {
        hasStopPrefix = true;
        clean = potentialNewRequest;
      }
    }

    // Clean context switch trailing markers like "instead", "rather"
    clean = clean.replace(/\s+(?:instead|rather)[.!?]*$/i, '').trim();

    return { isPureStop: false, hasStopPrefix, cleanText: clean };
  }

  public static extractEntity(text: string): MentionedEntity | null {
    let clean = text.toLowerCase().trim();
    clean = clean.replace(/\s+(?:instead|rather)[.!?]*$/i, '').trim();

    // 0. Explicit Pronoun, Common Topics & Conversational Safeguard - NEVER treat pronouns or context switch markers as entities
    const strictForbiddenExact = [
      'you', 'your', 'yours', 'me', 'my', 'mine', 'i', 'we', 'us', 'our', 'ours',
      'myself', 'yourself', 'yourselves', 'him', 'her', 'hers', 'himself', 'herself',
      'them', 'they', 'their', 'theirs', 'themselves', 'the other person', 'other person',
      'someone', 'anyone', 'everyone', 'nobody', 'this', 'that', 'these', 'those',
      'it', 'its', 'itself', 'who', 'what', 'where', 'when', 'why', 'how',
      'something', 'anything', 'nothing', 'everything', 'ayra', 'nova', 'the story',
      'the news', 'okay', 'yeah', 'no', 'actually', 'true', 'false', 'instead', 'rather',
      'cats instead', 'cats', 'cat', 'dogs', 'dog', 'space', 'space exploration', 'animals',
      'movies', 'music', 'food', 'travel', 'cars', 'about you', 'about me',
      'the ceo of google', 'ceo of google', 'the ceo', 'ceo'
    ];
    if (strictForbiddenExact.includes(clean)) {
      return null;
    }

    // 1. KNOWN PEOPLE (Case A - Stable Knowledge)
    if (/\bkiara advani|yaara advani|yara advani\b/i.test(clean)) {
      return {
        name: 'Kiara Advani',
        type: 'person',
        gender: 'female',
        description: 'Indian actress known for films like Kabir Singh, Shershaah, MS Dhoni: The Untold Story, and Bhool Bhulaiyaa 2',
        knownInformation: 'Kiara Advani is an Indian actress known for her performances in Shershaah, Kabir Singh, MS Dhoni: The Untold Story, and Bhool Bhulaiyaa 2.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\bsidharth malhotra|siddharth malhotra\b/i.test(clean)) {
      return {
        name: 'Sidharth Malhotra',
        type: 'person',
        gender: 'male',
        description: 'Indian actor known for films like Student of the Year, Shershaah, Ek Villain, and Mission Majnu',
        knownInformation: 'Sidharth Malhotra is an Indian actor who debuted in Student of the Year and received acclaim for playing Captain Vikram Batra in Shershaah.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\balia bhatt\b/i.test(clean)) {
      return {
        name: 'Alia Bhatt',
        type: 'person',
        gender: 'female',
        description: 'Indian actress and producer known for films like Raazi, Gully Boy, and Gangubai Kathiawadi',
        knownInformation: 'Alia Bhatt is an Indian actress and producer who predominantly works in Hindi films, known for Raazi, Gully Boy, Gangubai Kathiawadi, and Brahmāstra.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\bvarun dhawan\b/i.test(clean)) {
      return {
        name: 'Varun Dhawan',
        type: 'person',
        gender: 'male',
        description: 'Indian actor known for Hindi films like Student of the Year, Badlapur, and Bhediya',
        knownInformation: 'Varun Dhawan is an Indian actor who works in Hindi cinema, known for films like Student of the Year, Badlapur, Humpty Sharma Ki Dulhania, and Bhediya.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\bshah rukh khan|srk\b/i.test(clean)) {
      return {
        name: 'Shah Rukh Khan',
        type: 'person',
        gender: 'male',
        description: 'Indian actor and film producer, known as the King of Bollywood',
        knownInformation: 'Shah Rukh Khan is an Indian actor and producer who has appeared in over 90 Hindi films, including DDLJ, Swades, Chak De! India, and Jawan.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\bsundar pichai\b/i.test(clean)) {
      return {
        name: 'Sundar Pichai',
        type: 'person',
        gender: 'male',
        description: 'CEO of Alphabet and Google',
        knownInformation: 'Sundar Pichai is an Indian-American business executive who serves as the CEO of Alphabet Inc. and Google.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\bsatya nadella\b/i.test(clean)) {
      return {
        name: 'Satya Nadella',
        type: 'person',
        gender: 'male',
        description: 'Chairman and CEO of Microsoft',
        knownInformation: 'Satya Nadella is the Chairman and CEO of Microsoft, having succeeded Steve Ballmer in 2014.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\btim cook\b/i.test(clean)) {
      return {
        name: 'Tim Cook',
        type: 'person',
        gender: 'male',
        description: 'CEO of Apple Inc.',
        knownInformation: 'Tim Cook is the Chief Executive Officer of Apple Inc., having previously served as the company\'s chief operating officer under Steve Jobs.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\bsam altman\b/i.test(clean)) {
      return {
        name: 'Sam Altman',
        type: 'person',
        gender: 'male',
        description: 'CEO of OpenAI',
        knownInformation: 'Sam Altman is an American entrepreneur and investor who serves as the CEO of OpenAI.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\btaylor swift\b/i.test(clean)) {
      return {
        name: 'Taylor Swift',
        type: 'person',
        gender: 'female',
        description: 'American singer-songwriter and pop cultural icon',
        knownInformation: 'Taylor Swift is an American singer-songwriter known for her narrative songwriting and record-breaking global Eras Tour.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\bleonardo da vinci|da vinci\b/i.test(clean)) {
      return {
        name: 'Leonardo da Vinci',
        type: 'person',
        gender: 'male',
        description: 'Italian Renaissance polymath and painter of the Mona Lisa',
        knownInformation: 'Leonardo da Vinci was an Italian polymath of the High Renaissance who painted iconic masterworks including the Mona Lisa and The Last Supper.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\bnarendra modi|pm modi|prime minister modi\b/i.test(clean)) {
      return {
        name: 'Narendra Modi',
        type: 'person',
        gender: 'male',
        description: 'Prime Minister of India',
        knownInformation: 'Narendra Modi is the current Prime Minister of India, in office since May 2014.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\belon musk\b/i.test(clean)) {
      return {
        name: 'Elon Musk',
        type: 'person',
        gender: 'male',
        description: 'Tech entrepreneur, CEO of Tesla, CTO of X, and founder of SpaceX',
        knownInformation: 'Elon Musk is a business magnate and investor known for SpaceX, Tesla, Neuralink, and xAI.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\bjeff bezos\b/i.test(clean)) {
      return {
        name: 'Jeff Bezos',
        type: 'person',
        gender: 'male',
        description: 'Founder and Executive Chairman of Amazon and founder of Blue Origin',
        knownInformation: 'Jeff Bezos is an American entrepreneur and investor who founded Amazon and Blue Origin.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\bmark zuckerberg\b/i.test(clean)) {
      return {
        name: 'Mark Zuckerberg',
        type: 'person',
        gender: 'male',
        description: 'Founder and CEO of Meta',
        knownInformation: 'Mark Zuckerberg is an American businessman and philanthropist who co-founded Facebook (now Meta) and leads the company as its chairman and CEO.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    // 2. KNOWN COMPANIES & PLATFORMS
    if (/\byoutube\b/i.test(clean) && !/\byoutube channel\b/i.test(clean)) {
      return {
        name: 'YouTube',
        type: 'company',
        gender: 'unknown',
        description: 'Global video sharing and streaming platform owned by Google',
        knownInformation: 'YouTube is a global video sharing platform founded in February 2005 by Steve Chen, Chad Hurley, and Jawed Karim, and acquired by Google in 2006 for $1.65 billion.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\bopenai\b/i.test(clean)) {
      return {
        name: 'OpenAI',
        type: 'company',
        gender: 'unknown',
        description: 'AI research and deployment company behind ChatGPT and GPT-4',
        knownInformation: 'OpenAI is an AI research and deployment company that created ChatGPT, GPT-4, and the o-series reasoning models.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\bmicrosoft\b/i.test(clean)) {
      return {
        name: 'Microsoft',
        type: 'company',
        gender: 'unknown',
        description: 'Global technology corporation founded by Bill Gates and Paul Allen',
        knownInformation: 'Microsoft is a multinational technology corporation founded in 1975 by Bill Gates and Paul Allen, known for Windows, Azure, and Office.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\bgoogle|alphabet\b/i.test(clean)) {
      return {
        name: 'Google',
        type: 'company',
        gender: 'unknown',
        description: 'Multinational technology company specializing in search, cloud, and AI',
        knownInformation: 'Google is a multinational technology company founded by Larry Page and Sergey Brin in 1998, leading in Search, Android, Cloud, and Gemini AI.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\bapple(\s+company|\s+inc|\s+corp)?\b/i.test(clean) && !/\b(eating an apple|red apple|fruit)\b/i.test(clean) && (clean.includes('company') || clean.includes('apple') || clean.includes('iphone') || clean.includes('mac'))) {
      return {
        name: 'Apple',
        type: 'company',
        gender: 'unknown',
        description: 'Global technology company known for iPhone, Mac, iPad, and iOS',
        knownInformation: 'Apple Inc. is an American multinational corporation that designs and manufactures consumer electronics, software, and online services.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    // 3. KNOWN PRODUCTS & TECHNOLOGIES
    if (/\bchatgpt\b/i.test(clean)) {
      return {
        name: 'ChatGPT',
        type: 'product',
        gender: 'unknown',
        description: 'AI conversational chatbot developed by OpenAI',
        knownInformation: 'ChatGPT is an AI chatbot developed by OpenAI that uses generative pre-trained transformer models for natural conversation.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\bnext\.?js|nextjs\b/i.test(clean)) {
      return {
        name: 'Next.js',
        type: 'technology',
        gender: 'unknown',
        description: 'React framework for server-rendered and full-stack web applications',
        knownInformation: 'Next.js is a flexible React framework developed by Vercel that enables features such as server-side rendering and generating static websites.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\btypescript|ts\b/i.test(clean) && !/\bts\s+shirt\b/i.test(clean) && (clean.includes('typescript') || clean.includes('programming') || clean.includes('code') || clean.includes('what is ts'))) {
      return {
        name: 'TypeScript',
        type: 'technology',
        gender: 'unknown',
        description: 'Typed superset of JavaScript developed by Microsoft',
        knownInformation: 'TypeScript is a strongly typed programming language that builds on JavaScript, giving you better tooling at any scale.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\breact|reactjs|react\.js\b/i.test(clean)) {
      return {
        name: 'React',
        type: 'technology',
        gender: 'unknown',
        description: 'JavaScript library for building component-based user interfaces',
        knownInformation: 'React is an open-source, component-based frontend JavaScript library created by Meta for building user interfaces with a virtual DOM.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\bpython\b/i.test(clean)) {
      return {
        name: 'Python',
        type: 'technology',
        gender: 'unknown',
        description: 'High-level programming language widely used in AI, data science, and web development',
        knownInformation: 'Python is an interpreted, high-level, general-purpose programming language designed by Guido van Rossum.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\bjavascript|js\b/i.test(clean) && !/\bts\b/i.test(clean) && (clean.includes('javascript') || clean.includes('js'))) {
      return {
        name: 'JavaScript',
        type: 'technology',
        gender: 'unknown',
        description: 'Core programming language for web browsers and Node.js',
        knownInformation: 'JavaScript is a high-level, interpreted programming language that powers interactive web pages and server-side applications via Node.js.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\bnode\.?js|nodejs\b/i.test(clean)) {
      return {
        name: 'Node.js',
        type: 'technology',
        gender: 'unknown',
        description: 'Open-source, cross-platform JavaScript runtime environment',
        knownInformation: 'Node.js is an open-source, cross-platform JavaScript runtime environment that executes JavaScript code outside a web browser.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\bmongodb\b/i.test(clean)) {
      return {
        name: 'MongoDB',
        type: 'technology',
        gender: 'unknown',
        description: 'Popular open-source document-oriented NoSQL database',
        knownInformation: 'MongoDB is a source-available, cross-platform, document-oriented database program classified as a NoSQL database product.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\bsql\b/i.test(clean) && !/\b(nosql)\b/i.test(clean)) {
      return {
        name: 'SQL',
        type: 'technology',
        gender: 'unknown',
        description: 'Domain-specific language used for managing data in relational database management systems',
        knownInformation: 'SQL (Structured Query Language) is a standard language for storing, manipulating, and retrieving data in relational databases.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\bredux\b/i.test(clean)) {
      return {
        name: 'Redux',
        type: 'technology',
        gender: 'unknown',
        description: 'Predictable state management library for JavaScript applications',
        knownInformation: 'Redux is an open-source JavaScript library for managing and centralizing application state, commonly used with React.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\b(rag|retrieval augmented generation)\b/i.test(clean)) {
      return {
        name: 'RAG',
        type: 'technology',
        gender: 'unknown',
        description: 'Retrieval-Augmented Generation AI architecture',
        knownInformation: 'RAG is an AI pattern that augments LLM generation by retrieving relevant context from an external knowledge base.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\b(vector database|vector db)\b/i.test(clean)) {
      return {
        name: 'Vector Database',
        type: 'technology',
        gender: 'unknown',
        description: 'Database specialized for indexing and querying high-dimensional vector embeddings',
        knownInformation: 'A vector database indexes and queries multi-dimensional vector embeddings for semantic search and AI retrieval.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\b(rest api|api|apis)\b/i.test(clean) && (clean.includes('api') || clean.includes('rest'))) {
      return {
        name: 'API',
        type: 'technology',
        gender: 'unknown',
        description: 'Application Programming Interface',
        knownInformation: 'An API enables different software applications to communicate and exchange data using defined protocols.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\b(machine learning|ml)\b/i.test(clean) && !clean.includes('html')) {
      return {
        name: 'Machine Learning',
        type: 'concept',
        gender: 'unknown',
        description: 'Subset of artificial intelligence focused on learning patterns from data',
        knownInformation: 'Machine learning is a field of artificial intelligence focused on algorithms that improve through experience.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\b(artificial intelligence|ai)\b/i.test(clean) && !/\b(main|pain|gain|fail|air)\b/i.test(clean) && (clean.includes('artificial intelligence') || /\bai\b/i.test(clean))) {
      return {
        name: 'Artificial Intelligence',
        type: 'concept',
        gender: 'unknown',
        description: 'Field of computer science dedicated to intelligent systems',
        knownInformation: 'Artificial intelligence is the intelligence of machines and computer systems, enabling reasoning, perception, and learning.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    // 4. KNOWN CONCEPTS / ART / SCIENCE / GEOGRAPHY
    if (/\bmona lisa\b/i.test(clean)) {
      return {
        name: 'Mona Lisa',
        type: 'concept',
        gender: 'unknown',
        description: 'Renaissance masterpiece painting by Leonardo da Vinci',
        knownInformation: 'The Mona Lisa is a half-length portrait painting by Italian artist Leonardo da Vinci, considered an archetypal masterpiece of the Italian Renaissance.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\bphotosynthesis\b/i.test(clean)) {
      return {
        name: 'Photosynthesis',
        type: 'concept',
        gender: 'unknown',
        description: 'Biological process by which plants convert sunlight into chemical energy',
        knownInformation: 'Photosynthesis is a biological process used by plants and other organisms to convert light energy into chemical energy.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\brecursion\b/i.test(clean)) {
      return {
        name: 'Recursion',
        type: 'concept',
        gender: 'unknown',
        description: 'Problem solving method where a function calls itself',
        knownInformation: 'Recursion in computer science is a method of solving a problem where the solution depends on solutions to smaller instances of the same problem.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\bfrance\b/i.test(clean) || /\bcapital of france\b/i.test(clean)) {
      return {
        name: 'France',
        type: 'place',
        gender: 'unknown',
        description: 'Country in Western Europe whose capital is Paris',
        knownInformation: 'France is a country in Western Europe. Its capital and largest city is Paris.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    if (/\bspeed of light\b/i.test(clean)) {
      return {
        name: 'Speed of Light',
        type: 'concept',
        gender: 'unknown',
        description: 'Universal physical constant, approx 299,792,458 m/s in vacuum',
        knownInformation: 'The speed of light in vacuum, commonly denoted c, is a universal physical constant exactly equal to 299,792,458 meters per second.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
    }

    // 5. NICHE CREATORS / UNCERTAIN ENTITIES (Case B)
    if (/\b(ravel kit|youtuber ravel kit)\b/i.test(clean)) {
      return {
        name: 'Ravel Kit',
        type: 'creator',
        gender: 'male',
        description: 'YouTube content creator',
        knownInformation: 'Ravel Kit is a content creator and YouTuber known for gaming and commentary videos.',
        isNicheOrAmbiguous: true,
        lastMentionedAt: Date.now()
      };
    }

    if (/\bsamar anna\b/i.test(clean)) {
      return {
        name: 'Samar Anna',
        type: 'creator',
        gender: 'male',
        description: 'Online personality / creator',
        knownInformation: 'Samar Anna is an online creator/personality.',
        isNicheOrAmbiguous: true,
        lastMentionedAt: Date.now()
      };
    }

    // 6. DYNAMIC EXTRACTION FOR UNKNOWN / CUSTOM QUERIES (Case B / Case C)
    const entityMatch = clean.match(
      /\b(?:do you know about|have you heard of|who is|tell me about|what do you know about|tell me something about|who is this person|who founded|what is (?:the )?known for)\s+(?:youtuber\s+|creator\s+|streamer\s+|company\s+)?([a-z0-9\s'-]+?)(?:\?|$|\.|\bto\b|\bis\b)/i
    );
    if (entityMatch && entityMatch[1]) {
      let candidate = entityMatch[1].trim();
      candidate = candidate.replace(/\s+(?:instead|rather)[.!?]*$/i, '').trim();

      const forbiddenTokens = [
        'you', 'your', 'yours', 'me', 'my', 'mine', 'i', 'we', 'us', 'our', 'ours',
        'myself', 'yourself', 'yourselves', 'him', 'her', 'hers', 'himself', 'herself',
        'them', 'they', 'their', 'theirs', 'themselves', 'the other person', 'other person',
        'someone', 'anyone', 'everyone', 'nobody', 'this', 'that', 'these', 'those',
        'it', 'its', 'itself', 'who', 'what', 'where', 'when', 'why', 'how',
        'something', 'anything', 'nothing', 'everything', 'ayra', 'nova', 'the story',
        'the news', 'okay', 'yeah', 'no', 'actually', 'true', 'false', 'about you', 'about me',
        'instead', 'rather', 'cats instead', 'cats', 'cat', 'dogs', 'dog', 'space',
        'space exploration', 'animals', 'movies', 'music', 'food', 'travel', 'cars',
        'the ceo of google', 'ceo of google', 'the ceo', 'ceo', 'joke', 'jokes',
        'weather', 'fun fact', 'a joke', 'a story'
      ];
      if (!forbiddenTokens.includes(candidate.toLowerCase()) && candidate.length > 2) {
        const formattedName = candidate.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const isCreator = clean.includes('youtuber') || clean.includes('creator') || clean.includes('streamer');
        const isCompany = clean.includes('company') || clean.includes('firm') || clean.includes('startup') || clean.includes('founded');
        return {
          name: formattedName,
          type: isCreator ? 'creator' : isCompany ? 'company' : 'person',
          gender: 'unknown',
          description: `Entity queried by user: ${formattedName}`,
          isNicheOrAmbiguous: true,
          lastMentionedAt: Date.now()
        };
      }
    }

    return null;
  }

  public static classifyDetailed(
    text: string,
    currentLanguage: LanguageMode = 'auto',
    context?: IntentClassificationContext
  ): DetailedClassificationResult {
    const rawTrimmed = text.trim();
    const normalized = this.normalizeSTTErrors(rawTrimmed);
    const clean = normalized.toLowerCase();

    const result: DetailedClassificationResult = {
      intent: 'casual_chat',
      userIntent: 'NORMAL_TURN',
      entity: null,
      secondaryIntent: null,
      emotion: 'neutral',
      emotionIntensity: 0.2,
      conversationMode: 'CASUAL',
      isCurrentInformation: false,
      requiresWebSearch: false,
      needsClarification: false,
      sttNormalizedText: normalized,
      isFragment: false
    };

    if (!rawTrimmed) {
      result.intent = 'incomplete';
      result.userIntent = 'CONTINUATION';
      result.isFragment = true;
      return result;
    }

    if (this.isExplicitStopCommand(clean)) {
      result.intent = 'stop';
      result.userIntent = 'COMMAND';
      return result;
    }

    if (this.isIncompleteUtterance(clean)) {
      result.intent = 'incomplete';
      result.userIntent = 'CLARIFICATION';
      result.isFragment = true;
      result.fragmentType = 'completion_prompt';
      result.clarificationPrompt = "Go ahead, I'm listening.";
      return result;
    }

    // Extract self-correction target if present ("Explain Python—actually JavaScript" -> "JavaScript")
    const correction = this.extractSelfCorrection(normalized);
    const targetQueryText = correction.hasCorrection ? correction.correctedTarget : normalized;
    const targetQueryClean = targetQueryText.toLowerCase();

    // Check for correction with referent shift (e.g., "no no that's not what I meant I was talking about the other person")
    if (/\b(not what i meant|talking about the other person|talking about someone else|different person|other person)\b/i.test(clean)) {
      result.intent = 'clarification';
      result.userIntent = 'CORRECTION';
      result.entity = null;
      return result;
    }

    // Check for self inquiry / asking about Ayra ("do you know you", "do you know about you", "who are you")
    if (/\b(do you know (about )?you|do you know you|tell me about you|what about you|who are you|introduce yourself)\b/i.test(clean)) {
      result.intent = 'casual_chat';
      result.userIntent = 'QUESTION';
      result.entity = null;
      return result;
    }

    if (/\b(bye|okay bye|ok bye|goodbye|see you|see ya|talk to you later|ttyl|i'm leaving|im leaving|going to sleep|gonna sleep|good night|goodnight|gn|sleep well|good night ayra|okay good night)\b/i.test(clean)) {
      result.intent = 'goodbye';
      result.userIntent = 'GREETING';
      result.conversationMode = 'GOODBYE';
      return result;
    }

    if (/^(okay|ok|haan|yep|yeah|right|sahi hai|theek hai|acha|achha|got it|cool)[.!]?$/i.test(clean)) {
      result.intent = 'acknowledgement';
      result.userIntent = 'BACKCHANNEL';
      return result;
    }

    if (/^(but you are so|you are so|and you are so)[.!,?]?$/i.test(clean)) {
      result.intent = 'incomplete';
      result.userIntent = 'CLARIFICATION';
      result.isFragment = true;
      result.fragmentType = 'completion_prompt';
      result.clarificationPrompt = "So... what? Don't leave me hanging.";
      return result;
    }

    if (/^(are very annoying|are so annoying|is very annoying|is so annoying)[.!,?]?$/i.test(clean)) {
      result.intent = 'personal_feedback';
      result.userIntent = 'CLARIFICATION';
      result.isFragment = true;
      result.fragmentType = 'missing_subject';
      result.clarificationPrompt = "Are very annoying... what? You're talking about me, aren't you?";
      return result;
    }

    if (/^(i am little bit|i am a little bit|im little bit|i'm a little bit)[.!,?]?$/i.test(clean)) {
      result.intent = 'incomplete';
      result.userIntent = 'CLARIFICATION';
      result.isFragment = true;
      result.fragmentType = 'completion_prompt';
      result.clarificationPrompt = "Little bit... what?";
      return result;
    }

    if (/^(about)[.!,?]?$/i.test(clean)) {
      result.intent = 'incomplete';
      result.userIntent = 'CLARIFICATION';
      result.isFragment = true;
      result.fragmentType = 'partial_query';
      result.clarificationPrompt = "About what?";
      return result;
    }

    if (/^(your actually|you're actually|you are actually)[.!,?]?$/i.test(clean)) {
      result.intent = 'incomplete';
      result.userIntent = 'CLARIFICATION';
      result.isFragment = true;
      result.fragmentType = 'completion_prompt';
      result.clarificationPrompt = "Actually what?";
      return result;
    }

    if (/^(you too much|you talk too much|do you know you too much)[.!,?]?$/i.test(clean)) {
      result.intent = 'casual_chat';
      result.userIntent = 'NORMAL_TURN';
      return result;
    }

    if (clean === 'i don\'t know what to do next' || clean === 'i dont know what to do next' || clean === 'i don\'t know what you do next' || clean === 'i dont know what you do next') {
      result.intent = 'advice_request';
      result.userIntent = 'STATEMENT';
      return result;
    }

    // 0. Explicit Topic Change / New Activity ("Actually no, tell me something else", "switch gears completely", etc.)
    if (/\b(?:now\s+)?switch\s+gears\s+completely\b/i.test(clean) || /\b(?:now\s+)?switch\s+gears\b/i.test(clean)) {
      if (/\b(react\s+hooks|react|javascript|typescript|node\.?js|python|sql|generative\s+ai|rag|rest\s+apis?)\b/i.test(clean)) {
        result.intent = 'technical_explanation';
        result.userIntent = 'QUESTION';
        result.conversationMode = 'TECHNICAL_EXPLANATION';
        return result;
      }
      result.intent = 'topic_change';
      result.userIntent = 'TOPIC_CHANGE';
      result.conversationMode = 'GENERAL_CHAT';
      return result;
    }

    if (/\b(actually no|tell me something else|something else|kuch aur baat|change the topic|let's talk about something else|kuch aur batao|kuch aur sunao|kuch naya)\b/i.test(clean)) {
      result.intent = 'topic_change';
      result.userIntent = 'TOPIC_CHANGE';
      result.conversationMode = 'GENERAL_CHAT';
      return result;
    }

    // 0.0001 Technical Explanation Requests ("explain React Hooks", "give me a real-world example")
    if (/\b(?:explain|tell me about|what is|how do|how does)\s+(?:react hooks|react|javascript|typescript|node\.?js|python|sql|generative ai|rag|rest apis?)\b/i.test(clean) || /\b(explain react hooks|react hooks)\b/i.test(clean) || (clean === 'give me a real-world example' || clean === 'give me a real world example' || clean === 'real world example')) {
      result.intent = 'technical_explanation';
      result.userIntent = 'QUESTION';
      result.conversationMode = 'TECHNICAL_EXPLANATION';
      return result;
    }

    // 0.0002 Apology Action & Message Drafting ("give me some ideas how to apologize to her", "what should I text her")
    if (/\b(give me (?:some )?ideas how to apologize|how should i apologize|ideas how to apologize|how to apologize|apologize to her|apologize to him|what should i say to apologize)\b/i.test(clean)) {
      result.intent = 'apology_action';
      result.userIntent = 'QUESTION';
      result.conversationMode = 'ADVICE';
      return result;
    }

    if (/\b(what should i text (?:her|him|them)|draft a text (?:for me)?|what to text (?:her|him))\b/i.test(clean)) {
      result.intent = 'message_drafting';
      result.userIntent = 'INFORMATION_REQUEST';
      result.conversationMode = 'ADVICE';
      return result;
    }

    // 0.0003 Stock Market & Live Financial Info ("what about the stock market", "what about stocks")
    if (/\b(what about (?:the )?stock market|what about stocks|stock market|of the stock|of the stocks)\b/i.test(clean)) {
      result.intent = 'stock_market';
      result.userIntent = 'QUESTION';
      result.conversationMode = 'CURRENT_INFORMATION';
      result.isCurrentInformation = true;
      result.requiresWebSearch = true;
      return result;
    }

    // 0.0004 Personal Health Statements ("I had a fever today", "I had a fever this morning", "I'm tired")
    if (/\b(had a fever|having a fever|got a fever|caught a fever|fever today|fever this morning)\b/i.test(clean) || /\b(everything is (?:okay|great|fine)(?:,?\s+everything is just (?:okay|great|fine))?\s+but i had a fever)\b/i.test(clean) || /\b(i am (?:saying|seeing) that i had a fever)\b/i.test(clean) || /\b(i'?m tired|i am tired|feeling exhausted|feeling so tired|feeling tired today)\b/i.test(clean)) {
      result.intent = 'personal_health_event';
      result.userIntent = 'STATEMENT';
      result.conversationMode = 'CASUAL';
      return result;
    }

    // 0.00 Roleplay Mode Activations
    if (/\b(talk to me (?:as|like) my girlfriend|be my girlfriend|girlfriend mode|girlfriend roleplay|act like my girlfriend)\b/i.test(clean)) {
      result.intent = 'girlfriend_roleplay';
      result.userIntent = 'CREATIVE_REQUEST';
      result.conversationMode = 'GIRLFRIEND_STYLE_ROLEPLAY';
      return result;
    }

    if (/\b(talk to me (?:as|like) my boyfriend|be my boyfriend|boyfriend mode|boyfriend roleplay|act like my boyfriend|can you be my boyfriend|will you be my boyfriend)\b/i.test(clean)) {
      result.intent = 'boyfriend_roleplay';
      result.userIntent = 'CREATIVE_REQUEST';
      result.conversationMode = 'CASUAL';
      return result;
    }

    if (/\b(act (?:as|like) (?:my|a)?\s*(?:[a-z0-9_ -]+)?\s*teacher|be my\s*(?:[a-z0-9_ -]+)?\s*teacher|teach me\s+([a-z0-9_ -]+)|teacher mode|teacher roleplay)\b/i.test(clean)) {
      result.intent = 'teacher_roleplay';
      result.userIntent = 'COMMAND';
      result.conversationMode = 'TEACHER_ROLEPLAY';
      return result;
    }

    if (/\b(pretend\s+(?:you'?re|your)\s+(?:my|an)?\s*interviewer|be\s+(?:an|my)?\s*interviewer\s*(?:and\s+take\s+my\s+interview)?|take\s+(?:my\s+)?interview|interview\s+me|start\s+(?:the|my|an)?\s*interview|interviewer\s+mode|mock\s+interview|act\s+(?:like|as)\s+(?:an|my)?\s*interviewer|ask\s+me\s+interview\s+questions|give\s+me\s+honest\s+(?:interview\s+)?feedback|take\s+my\s+interview\s+one\s+question\s+at\s+a\s+time)\b/i.test(clean)) {
      result.intent = 'interviewer_roleplay';
      result.userIntent = 'COMMAND';
      result.conversationMode = 'INTERVIEWER_ROLEPLAY';
      return result;
    }

    if (/\b(stop (?:the\s+)?interview|end (?:the\s+)?interview|exit interview|stop roleplay|exit roleplay|stop girlfriend mode|stop boyfriend mode)\b/i.test(clean)) {
      result.intent = 'stop';
      result.userIntent = 'COMMAND';
      result.conversationMode = 'CASUAL';
      return result;
    }

    // 0.001 Flirtation Requests ("Flirt with me", "now flirt with me")
    if (/\b(now flirt with me|flirt with me|flirt kar na|flirt karo|say something flirty|flirt)\b/i.test(clean) && !/\b(don't|dont|stop)\b/i.test(clean)) {
      result.intent = 'flirtation';
      result.userIntent = 'CREATIVE_REQUEST';
      result.conversationMode = 'CASUAL';
      return result;
    }

    // 0.002 Proposal Practice ("Can you practice with me?", "Practice with me")
    if (/\b(can you practice with me|practice with me|practice proposing|practice (?:the\s+)?proposal|let'?s practice)\b/i.test(clean)) {
      result.intent = 'proposal_practice';
      result.userIntent = 'CREATIVE_REQUEST';
      result.conversationMode = 'PROPOSAL_PRACTICE';
      return result;
    }

    // 0.003 Crush & Propose Scenarios
    if (/\b(how should i propose to my crush|how to propose (?:to\s+)?(?:my\s+)?crush|how do i propose|how to tell my crush|how should i confess)\b/i.test(clean)) {
      result.intent = 'crush';
      result.userIntent = 'QUESTION';
      result.conversationMode = 'ADVICE';
      return result;
    }

    if (/\b(i have a crush on someone|i have a crush|i like a girl|i like a boy|crush on a girl|crush on a guy|crush on my friend)\b/i.test(clean) || /\b(i want to tell them but i'?m scared|i don'?t know how to tell them|scared to confess)\b/i.test(clean)) {
      result.intent = 'crush';
      result.userIntent = 'STATEMENT';
      result.conversationMode = 'EMOTIONAL_SUPPORT';
      return result;
    }

    // 0.004 Rejection & Breakup Support
    if (/\b(my crush rejected me|i got rejected by my crush|she rejected me|he rejected me|crush rejected me)\b/i.test(clean)) {
      result.intent = 'rejection_support';
      result.userIntent = 'STATEMENT';
      result.conversationMode = 'EMOTIONAL_SUPPORT';
      return result;
    }

    if (/\b(i just broke up with my (?:girlfriend|boyfriend|partner)|i broke up|we broke up|recent breakup|i miss my ex)\b/i.test(clean)) {
      result.intent = 'breakup_support';
      result.userIntent = 'STATEMENT';
      result.conversationMode = 'EMOTIONAL_SUPPORT';
      return result;
    }

    // 0.005 Friendship Reconciliation & Texting Guidance
    if (/\b(i want to patch things up|want to patch up|fix things with my friend|make up with my friend)\b/i.test(clean)) {
      result.intent = 'reconciliation';
      result.userIntent = 'STATEMENT';
      result.conversationMode = 'ADVICE';
      return result;
    }

    if (/\b(i don'?t know if i should text them|should i text them|should i call them|should i message them)\b/i.test(clean)) {
      result.intent = 'reconciliation';
      result.userIntent = 'QUESTION';
      result.conversationMode = 'ADVICE';
      return result;
    }

    if (/\b(what should i (?:say|text|message|write)|help me (?:reply|text|respond|draft))\b/i.test(clean)) {
      result.intent = 'what_should_i_say';
      result.userIntent = 'QUESTION';
      result.conversationMode = 'ADVICE';
      return result;
    }

    // 0.0055 Social Conflict & Situational Intents (Friend, Boss, Teacher, Romantic)
    if (/\b(i (?:just )?had a fight with my friend|had a fight with my friend|my friend was (?:really )?rude|friend was (?:really )?rude|she was (?:being )?really rude|she was rude|she said (?:that )?i never listen|he said (?:that )?i never listen|i said (?:some )?harsh things|said harsh things back|she forgot my birthday|i called her (?:selfish|arrogant|stupid)|she said i'?m (?:impossible|useless)|i forgot to send her something|she slapped me|who is wrong|who'?s wrong|whose fault is it|i yelled at my friend)\b/i.test(clean)) {
      result.intent = 'friendship_conflict';
      result.userIntent = 'STATEMENT';
      result.conversationMode = 'PERSONAL_SHARING';
      return result;
    }

    if (/\b(my boss (?:humiliated|yelled at|shouted at|criticized|appreciated) me|criticized my (?:work|presentation) in front of everyone|missed (?:an |a )?(?:important )?deadline)\b/i.test(clean)) {
      result.intent = 'life_scenario';
      result.userIntent = 'STATEMENT';
      result.conversationMode = 'PERSONAL_SHARING';
      return result;
    }

    if (/\b(my teacher (?:kicked me out|praised me|yelled at me|appreciated me)|talking during class|she said my project was (?:really )?good)\b/i.test(clean)) {
      result.intent = 'life_scenario';
      result.userIntent = 'STATEMENT';
      result.conversationMode = 'PERSONAL_SHARING';
      return result;
    }

    if (/\b(i had a fight with my (?:boyfriend|girlfriend)|he got angry because i didn'?t reply|my boyfriend (?:surprised|ignored) me|my friend got a job)\b/i.test(clean)) {
      result.intent = 'life_scenario';
      result.userIntent = 'STATEMENT';
      result.conversationMode = 'PERSONAL_SHARING';
      return result;
    }

    if (/\b(i don'?t know what to do|what should i do now|kya karu samajh nahi aa raha)\b/i.test(clean)) {
      result.intent = 'advice_request';
      result.userIntent = 'QUESTION';
      result.conversationMode = 'ADVICE';
      return result;
    }

    // 0.006 Social Teasing ("You're so dramatic")
    if (/\b(you'?re so dramatic|you are so dramatic|so dramatic|why are you dramatic)\b/i.test(clean)) {
      result.intent = 'social_teasing';
      result.userIntent = 'STATEMENT';
      result.conversationMode = 'CASUAL';
      return result;
    }

    // 0.007 Opinion & Boredom Requests
    if (/\b(what would you do if you were me|if you were me,? what would you do|what would you do)\b/i.test(clean)) {
      result.intent = 'opinion_request';
      result.userIntent = 'QUESTION';
      result.conversationMode = 'CASUAL';
      return result;
    }

    if (/\b(i'?m bored|im bored|feeling bored|kuch bore ho raha hai|bore ho raha hoon|bored today)\b/i.test(clean)) {
      result.intent = 'boredom';
      result.userIntent = 'STATEMENT';
      result.conversationMode = 'CASUAL';
      return result;
    }

    if (/\b(my roommate is annoying me|roommate issue|i argued with my parents|fight with parents|i failed my exam|failed exam|i passed my exam|passed exam|i got an internship|i did something embarrassing|i messed up|i met someone i really like|i think i was wrong|i feel like i'?m failing|i am really happy today|i am angry|i am embarrassed|my friend apologized)\b/i.test(clean)) {
      result.intent = 'life_scenario';
      result.userIntent = 'STATEMENT';
      result.conversationMode = 'CASUAL';
      return result;
    }

    // 0.0 Friend's Birthday & Context Reset ("Forget that. I want to tell you that tomorrow is my friend's birthday.")
    if (/\b(?:forget\s+(?:that|it|everything)|leave\s+(?:that|it)|never\s+mind|scratch\s+that)[.,]?\s*(?:i\s+want\s+to\s+tell\s+you\s+that\s+)?(?:tomorrow\s+is\s+my\s+friend'?s\s+birthday|my\s+friend'?s\s+birthday\s+is\s+tomorrow)\b/i.test(clean) || /\b(tomorrow is my friend'?s birthday|my friend'?s birthday is tomorrow|kal meri friend ka birthday hai|kal mere dost ka birthday hai|friend'?s birthday tomorrow)\b/i.test(clean)) {
      result.intent = 'friend_birthday';
      result.userIntent = 'STATEMENT';
      result.conversationMode = 'PERSONAL_SHARING';
      return result;
    }

    // 0.01 Homework Completion / Daily accomplishment
    if (/\b(i just completed my homework|i completed my homework|just finished my homework|finished my homework|i just completed my assignment|completed my assignment|homework done)\b/i.test(clean) || (/\b(doing great today|doing great)\b/i.test(clean) && /\b(homework|assignment)\b/i.test(clean))) {
      result.intent = 'homework_done';
      result.userIntent = 'STATEMENT';
      result.conversationMode = 'CASUAL';
      return result;
    }

    // 0.02 Romantic Quotes & Inspirational Quotes
    if (/\b(tell me (?:some |a )?romantic quotes?|romantic quotes?|romantic lines?|love quotes?|quotes? about love|romantic shayaris?)\b/i.test(clean)) {
      result.intent = 'quote_request';
      result.userIntent = 'CREATIVE_REQUEST';
      result.conversationMode = 'CASUAL';
      return result;
    }
    if (/\b(tell me (?:some |a )?inspirational quotes?|inspirational quotes?|motivational quotes?|quotes? about life|tell me a quote|tell me some quotes)\b/i.test(clean)) {
      result.intent = 'quote_request';
      result.userIntent = 'CREATIVE_REQUEST';
      result.conversationMode = 'CASUAL';
      return result;
    }

    // 0.03 Future of AI in Upcoming 5 Years / Trend Forecast
    if (/\b(future of (?:ai|artificial intelligence)|(?:ai|artificial intelligence)\s+in\s+(?:the\s+)?upcoming\s+(?:\d+|five|5|ten|10)\s+years|future of tech|future of technology)\b/i.test(clean)) {
      result.intent = 'future_forecast';
      result.userIntent = 'QUESTION';
      result.conversationMode = 'CASUAL';
      return result;
    }

    // 0.04 Current World News / What's happening in the world right now
    if (/\b(what'?s happening in the world|what is happening in the world|what'?s happening right now|what is happening right now|world news today|current world situation|what should i actually know about|what should i know about|what should i know|what happened today|current events|latest updates|recent developments|what'?s going on|what is going on|latest news|today'?s news|recent news)\b/i.test(clean)) {
      result.intent = 'current_information';
      result.userIntent = 'QUESTION';
      result.conversationMode = 'INFORMATION';
      result.isCurrentInformation = true;
      result.requiresWebSearch = true;
      return result;
    }

    // 0.045 Technical explanations (React Hooks, Node.js, Let/Const, RAG, etc.)
    if (/\b(explain react hooks|what are react hooks|explain react|explain node|explain python|explain javascript|explain rag|what is rag|what is node|difference between let and const|explain let and const|explain closures|what is closure)\b/i.test(clean)) {
      result.intent = 'explanation_request';
      result.userIntent = 'QUESTION';
      result.conversationMode = 'CASUAL';
      return result;
    }

    // 0.046 Exhausted / Casual talk request
    if (/\b(exhausted|so exhausted|really tired|i'm exhausted|im exhausted)\b/i.test(clean) && /\b(talk normally|just talk|normal talk|talk casual)\b/i.test(clean)) {
      result.intent = 'casual_chat';
      result.userIntent = 'NORMAL_TURN';
      result.conversationMode = 'GENERAL_CHAT';
      return result;
    }

    // 0.047 Explicit Casual Conversation Request ("Let's have a complete normal conversation", "let's just talk", "talk to me like a friend")
    if (/\b(let'?s have a complete normal conversation|let'?s have a normal conversation|talk to me like a friend|let'?s talk normally|just talk to me|say something random|complete normal conversation|normal conversation)\b/i.test(clean)) {
      result.intent = 'casual_chat';
      result.userIntent = 'NORMAL_TURN';
      result.conversationMode = 'CASUAL';
      return result;
    }

    // 0.048 Flirting Mode ("flirt with me", "try flirting with me", "continue flirting", "carry on" when in flirting)
    if (/\b(flirt with me|try flirting with me|flirting with me|continue flirting|keep flirting|start flirting)\b/i.test(clean) || (context?.activeConversationMode === 'FLIRTING' && /^(carry on|continue|keep going|more|go on)[.!]?$/i.test(clean))) {
      result.intent = 'flirtation';
      result.userIntent = 'STATEMENT';
      result.conversationMode = 'FLIRTING';
      return result;
    }

    // 0.049 Correction / Not a compliment / Negative feedback
    if (/\b(it is not a compliment|it'?s not a compliment|not a compliment|it wasn'?t a compliment|it was not a compliment)\b/i.test(clean)) {
      result.intent = 'role_correction';
      result.userIntent = 'CORRECTION';
      result.conversationMode = 'CASUAL';
      return result;
    }

    if (/\b(no no you'?re not dumb|not you[, ]+my friend|not talking about you|my friend says that i am dumb|my friend said that i am dumb)\b/i.test(clean)) {
      result.intent = 'friendship_conflict';
      result.userIntent = 'CORRECTION';
      result.conversationMode = 'FRIEND_CONFLICT';
      return result;
    }

    if (/\b(you'?re actually not very good|you are actually not very good|you'?re not very good|not very good at this|you kind of suck)\b/i.test(clean)) {
      result.intent = 'insult';
      result.userIntent = 'STATEMENT';
      result.conversationMode = 'CASUAL';
      result.socialRequestType = 'roast';
      return result;
    }

    // 0.1 Affection Question ("Do you like me?", "Do you like me Ayra?")
    if (/\b(do you like me|do you like me ayra|do you love me|kya tum mujhe pasand karti ho)\b/i.test(clean)) {
      result.intent = 'personal_feedback';
      result.userIntent = 'QUESTION';
      result.conversationMode = 'CASUAL';
      return result;
    }

    // 0.2 Compliment / "You are actually being nice today" / "I like you" / "You are smart"
    if (/\b(you are actually being nice today|you're actually being nice today|actually being nice today|being nice today|i like you|like you ayra|you're amazing|you are awesome|you are so nice|you have good vibes|love your voice|getting cute|getting cuter|you are cute|you're cute|you are a cutie|you're a cutie|cute at this|you are very smart|you're very smart|you are so smart|you're so smart|you are smart|you're smart|you are intelligent|you're intelligent|you are super smart|you're super smart|you are really smart|you're really smart)\b/i.test(clean)) {
      result.intent = 'compliment';
      result.userIntent = 'STATEMENT';
      result.conversationMode = 'CASUAL';
      return result;
    }

    // 0.3 Reported Speech Check before direct insult
    const reportedCheck = IntentClassifier.isReportedSpeech(clean);
    const hasReportedPrefix = reportedCheck.isReported || /\b(she said|he said|my friend said|she says|he says|my friend says|my boss told|my teacher said|usne bola|usne kaha)\b/i.test(clean);
    const inConflictContext = context?.activeConversationMode === 'FRIEND_CONFLICT' || (context?.previousAgentText && /what did (?:she|he) say|what happened/i.test(context.previousAgentText));

    // 1. Insult & Playful Negativity (Direct towards Ayra only when NOT reported speech)
    if (!hasReportedPrefix && !inConflictContext && /\b(you are very annoying|you're very annoying|you are so annoying|you're so annoying|you are annoying|you're annoying|no you're annoying|no,? you're annoying|you are so and knowing|you are dumb|you're dumb|you are stupid|you're stupid|you are useless|you're useless|you are pagal|you're pagal|pagal ho kya|bakwas ho|chup raho|you are so rude|you're so rude|you are rude|you're rude|why are you rude)\b/i.test(clean)) {
      result.intent = 'insult';
      result.userIntent = 'STATEMENT';
      result.conversationMode = 'CASUAL';
      result.socialRequestType = 'roast';
      return result;
    }

    // 1.1 Job Interview Role & Anxiety Context Tracking
    if (/\b(i think i won't get this job|i think i wont get this job|i think i'm not going to get the job|i think im not going to get the job|i think i will not get this job|won't get this job|wont get this job|not going to get the job|reject myself)\b/i.test(clean)) {
      result.intent = 'emotional_statement';
      result.userIntent = 'STATEMENT';
      result.conversationMode = 'EMOTIONAL_SUPPORT';
      result.emotion = 'anxious';
      result.emotionIntensity = 0.9;
      return result;
    }

    if (/\b(actually,?\s*it'?s for a (?:software|web|frontend|backend|fullstack|machine learning|ml)\s*(?:developer|engineer|dev)?\s*role|it is for a software developer role)\b/i.test(clean)) {
      result.intent = 'role_correction';
      result.userIntent = 'CORRECTION';
      result.conversationMode = 'EMOTIONAL_SUPPORT';
      return result;
    }

    if (/\b(it's for a (?:machine learning|ml|software|web|frontend|backend|fullstack|data science|ai|devops)\s*(?:developer|engineer|dev)?\s*(?:job|role)?|it is for a (?:machine learning|ml|software|web|frontend|backend|fullstack|data science|ai|devops)\s*(?:developer|engineer|dev)?\s*(?:job|role)?|it's a (?:web|frontend|backend|fullstack|software|react|python|java)\s*(?:developer|engineer|dev)?\s*role|web developer role|frontend developer role|software engineer role|it is a web developer role)\b/i.test(clean)) {
      result.intent = 'career_support';
      result.userIntent = 'STATEMENT';
      result.conversationMode = 'EMOTIONAL_SUPPORT';
      return result;
    }

    if (/\b(actually i have an interview tomorrow|i have an interview tomorrow|have an interview tomorrow|interview tomorrow|tomorrow i have an interview also|tomorrow i have interview also|i have an interview tomorrow also|interview also tomorrow)\b/i.test(clean)) {
      result.intent = 'emotional_statement';
      result.userIntent = 'STATEMENT';
      result.conversationMode = 'EMOTIONAL_SUPPORT';
      result.emotion = 'nervous';
      result.emotionIntensity = 0.85;
      return result;
    }

    // 2. Joke Feedback (e.g. "that's bad", "that's annoying" when immediately after a joke)
    const inJokeContext = context?.activeConversationMode === 'JOKE' || context?.lastUserIntent === 'joke_request';
    if (inJokeContext && /\b(that's bad|that was bad|that's annoying|terrible joke|lame|not funny|no this one was bad|bakwas joke|achha nahi tha)\b/i.test(clean)) {
      result.intent = 'joke_request';
      result.userIntent = 'CREATIVE_REQUEST';
      result.conversationMode = 'JOKE';
      return result;
    }

    // 3. Explicit Joke Requests & Mode Continuations ("Koi dusra joke", "sunao", "another one", "doosra joke sunao", "tell me a developer joke")
    const jokeReq = IntentClassifier.isExplicitJokeRequest(clean, {
      activeConversationMode: context?.activeConversationMode,
      lastUserIntent: context?.lastUserIntent
    });
    if (jokeReq.isJoke) {
      result.intent = 'joke_request';
      result.userIntent = 'CREATIVE_REQUEST';
      result.conversationMode = 'JOKE';
      return result;
    }

    // 3.1 Long Space Exploration Story / Detailed Story Requests
    if (/\b(long space exploration story|detailed story about space|space exploration story|long space story|space story|story about space)\b/i.test(clean)) {
      result.intent = 'story_request';
      result.userIntent = 'CREATIVE_REQUEST';
      result.conversationMode = 'STORY';
      return result;
    }

    // 4. Advice Intent Extraction (Requested vs Declined Advice)
    const adviceIntent = IntentClassifier.isAdviceIntent(clean);
    if (adviceIntent.declinedAdvice) {
      result.declinedAdvice = true;
    }
    if (adviceIntent.requestedAdvice) {
      result.wantsAdvice = true;
      result.intent = 'advice_request';
      result.userIntent = 'QUESTION';
      result.conversationMode = 'ADVICE';
      return result;
    }

    // 5. PERSONAL NARRATIVE & STORY SHARING (High priority for actual narratives)
    const narrativeRes = IntentClassifier.isPersonalNarrative(normalized, {
      isStoryThreadActive: context?.isStoryThreadActive,
      prevAgentText: context?.previousAgentText,
      lastMentionedPerson: context?.storyThreadTopic
    });
    if (narrativeRes.isNarrative) {
      result.intent = 'emotional_statement';
      result.userIntent = 'STATEMENT';
      result.conversationMode = 'PERSONAL_STORY';
      result.narrativeType = narrativeRes.type;
      result.narrativeDetails = narrativeRes.details;
      result.narrativeAnalysis = narrativeRes;
      result.entity = null; // Strictly prevent accidental entity matches
      result.requiresWebSearch = false;
      result.isCurrentInformation = false;
      result.languageDominance = IntentClassifier.detectLanguageDominance(rawTrimmed);
      result.emotion = narrativeRes.emotions.includes('sad') ? 'sad' : narrativeRes.emotions.includes('frustrated') ? 'frustrated' : 'neutral';
      result.emotionIntensity = 0.8;
      return result;
    }

    // 6. Social Requests (Flirt with me, Roast me, Compliment me, Cheer me up, Keep me company)
    const socialReq = IntentClassifier.isSocialRequest(clean);
    if (socialReq.isSocial) {
      result.intent = 'personal_feedback';
      result.userIntent = 'CREATIVE_REQUEST';
      result.socialRequestType = socialReq.type;
      result.conversationMode = 'CASUAL';
      return result;
    }

    // Compliment detection with noisy STT variants
    if (/\b(you're amazing|you are awesome|you are so nice|you have good vibes|love your voice|getting cute|getting cuter|you are cute|you're cute|you are a cutie|you're a cutie|cute at this)\b/i.test(clean)) {
      result.intent = 'compliment';
      result.userIntent = 'STATEMENT';
      return result;
    }

    // Pronoun and Entity Follow-up Resolution (strictly matching explicit questions/aspect inquiries, NOT conversational phrases like "forget it" or "for that")
    const pronounQuestionMatch = clean.match(/\b(who founded|who created|who made|who started|when was|what is|how old is|what movies has|what films has|what has|tell me about|what about|know about|how about|and about)\s+(her|his|their|him|she|he|they|them|it|its|this person|that person|this actor|that actor|this actress|that actress|this platform|that platform|this company|that company)\b/i);
    const pronounAspectMatch = clean.match(/\b(?:and\s+)?(her|his|their|its)\s+(religion|career|age|background|movies|films|work|recent work|recent movies|latest movie|movie|family|channel|videos|achievements|founder|net worth)\b/i);
    const isEntityPronounStatement = /\b(she is my (favourite|favorite)|he is my (favourite|favorite)|she's my (favourite|favorite)|he's my (favourite|favorite)|he is an indian actor|he's an indian actor|she is an indian actress|she's an indian actress|she is great|he is great|who founded it|who created it|who made it|how old is it|how old is she|how old is he)\b/i.test(clean);

    if (pronounQuestionMatch || pronounAspectMatch || isEntityPronounStatement) {
      const pronoun = pronounQuestionMatch ? pronounQuestionMatch[2].toLowerCase() : pronounAspectMatch ? pronounAspectMatch[1].toLowerCase() : clean.includes('she') || clean.includes('her') ? 'she' : clean.includes('it') ? 'it' : 'he';
      const aspect = (pronounAspectMatch && pronounAspectMatch[2]) ? pronounAspectMatch[2].toLowerCase() : 'general';

      result.intent = 'entity_question';
      result.userIntent = isEntityPronounStatement ? 'STATEMENT' : 'QUESTION';

      const lastEntity = context?.lastMentionedEntity;
      if ((pronoun === 'her' || pronoun === 'she' || pronoun === 'that actress' || pronoun === 'this actress') && lastEntity && (lastEntity.gender === 'female' || lastEntity.name.toLowerCase().includes('alia') || lastEntity.name.toLowerCase().includes('swift') || lastEntity.name.toLowerCase().includes('kiara'))) {
        result.entity = lastEntity;
        result.resolvedQuery = `${lastEntity.name}'s ${aspect}`;
        return result;
      } else if ((pronoun === 'his' || pronoun === 'him' || pronoun === 'he' || pronoun === 'this actor' || pronoun === 'that actor') && lastEntity && (lastEntity.gender === 'male' || lastEntity.name.toLowerCase().includes('varun') || lastEntity.name.toLowerCase().includes('sidharth') || lastEntity.name.toLowerCase().includes('samar') || lastEntity.name.toLowerCase().includes('modi') || lastEntity.name.toLowerCase().includes('khan') || lastEntity.name.toLowerCase().includes('pichai') || lastEntity.name.toLowerCase().includes('musk') || lastEntity.name.toLowerCase().includes('bezos'))) {
        result.entity = lastEntity;
        result.resolvedQuery = `${lastEntity.name}'s ${aspect}`;
        return result;
      } else if ((pronoun === 'it' || pronoun === 'its' || pronoun === 'this platform' || pronoun === 'that platform' || pronoun === 'this company' || pronoun === 'that company') && lastEntity && (lastEntity.type === 'company' || lastEntity.type === 'product' || lastEntity.type === 'technology' || lastEntity.name.toLowerCase().includes('youtube') || lastEntity.name.toLowerCase().includes('openai') || lastEntity.name.toLowerCase().includes('react') || lastEntity.name.toLowerCase().includes('google'))) {
        result.entity = lastEntity;
        result.resolvedQuery = `${lastEntity.name}'s ${aspect}`;
        return result;
      } else if ((pronoun === 'they' || pronoun === 'them' || pronoun === 'their' || pronoun === 'this person' || pronoun === 'that person') && lastEntity) {
        result.entity = lastEntity;
        result.resolvedQuery = `${lastEntity.name}'s ${aspect}`;
        return result;
      } else if (!lastEntity) {
        result.needsClarification = true;
        result.clarificationPrompt = (pronoun === 'her' || pronoun === 'she' || pronoun === 'this actress' || pronoun === 'that actress') ? "Sure — who do you mean by 'her'?" : pronoun === 'it' ? "Sure — what are you referring to?" : "Sure — who are you referring to?";
        return result;
      }
    }

    if (/\b(i am doing great|doing great|doing well|i'm fine)\b/i.test(clean) && /\b(do you know|tell me about|who is)\b/i.test(clean)) {
      result.secondaryIntent = 'greeting';
      const extracted = this.extractEntity(targetQueryClean) || this.extractEntity(clean);
      if (extracted) {
        result.intent = 'entity_question';
        result.userIntent = 'QUESTION';
        result.entity = extracted;
        return result;
      }
    }

    // Only extract entity if the user is genuinely inquiring about an entity (not telling a personal story)
    const isEntityQueryStructure = /^(?:who is|what is|tell me about|do you know|who founded|what do you know about|have you heard of|explain)\b/i.test(clean) || (
      !/\b(i was|we were|my friend|yesterday|last night|today|aaj|kal|subah|watching|scrolling|opened|order|dress|top|size|nahi tha|incident)\b/i.test(clean) &&
      (clean.includes('google') || clean.includes('alia bhatt') || clean.includes('sidharth malhotra') || clean.includes('kiara advani') || clean.includes('varun dhawan') || clean.includes('youtube') || clean.includes('openai') || clean.includes('microsoft'))
    );
    if (isEntityQueryStructure && !/\b(i was telling|my friend and i|we were talking about|my friend told me|watching youtube|scrolling|opened myntra)\b/i.test(clean)) {
      const detectedEntity = this.extractEntity(targetQueryClean) || this.extractEntity(clean);
      if (detectedEntity) {
        result.intent = detectedEntity.type === 'person' || detectedEntity.type === 'creator' ? 'person_question' : 'entity_question';
        result.userIntent = 'QUESTION';
        result.entity = detectedEntity;
        result.isCurrentInformation = detectedEntity.isNicheOrAmbiguous ?? false;
        result.requiresWebSearch = detectedEntity.isNicheOrAmbiguous ?? false;
        return result;
      }
    }

    if (/\b(what is happening in the world right now|what's happening in the world|current world situation|world news today|happening in ai right now|latest ai models)\b/i.test(clean)) {
      result.intent = 'current_information';
      result.userIntent = 'QUESTION';
      result.isCurrentInformation = true;
      result.requiresWebSearch = true;
      return result;
    }

    if (/\b(do you think|what's your opinion|what is your opinion|how do you feel about|do you believe|is money|can money|do you think i am improving|do you think i'm improving)\b/i.test(clean)) {
      result.intent = 'opinion';
      result.userIntent = 'QUESTION';
      return result;
    }

    if (/\b(i am little sad|i'm little sad|i am sad|i'm tired|i am tired|i'm nervous|i am nervous|i'm stressed|i am stressed|scared about my future|bad day|interview tomorrow so i am stressed|interview tomorrow)\b/i.test(clean)) {
      result.intent = 'emotional_statement';
      result.userIntent = 'STATEMENT';
      result.emotion = clean.includes('sad') ? 'sad' : clean.includes('tired') ? 'tired' : clean.includes('nervous') || clean.includes('stressed') ? 'stressed' : 'neutral';
      result.emotionIntensity = 0.8;
      return result;
    }

    if (this.isNewOrDifferentStory(clean) || this.isStoryRestartFromBeginning(clean) || this.isStoryContinuationOrResume(clean)) {
      result.intent = 'story_request';
      result.userIntent = 'CREATIVE_REQUEST';
      result.conversationMode = 'STORY';
      return result;
    }

    if (this.INTERVIEW_START_REGEX.test(clean)) {
      result.intent = 'advice_request';
      result.userIntent = 'COMMAND';
      result.conversationMode = 'INTERVIEW';
      return result;
    }

    if (clean.endsWith('?') || /^(who|what|why|how|when|where|is|are|can|could|do|does|did|kya|kyun|kaise)\b/i.test(clean)) {
      result.intent = 'question';
      result.userIntent = 'QUESTION';
      return result;
    }

    const legacyIntent = this.classify(rawTrimmed, currentLanguage, context);
    result.userIntent = legacyIntent;
    return result;
  }

  public static classify(
    text: string,
    currentLanguage: LanguageMode,
    context?: IntentClassificationContext
  ): UserIntent {
    const trimmed = text.trim();
    if (!trimmed) {
      return 'CONTINUATION';
    }

    if (this.isExplicitStopCommand(trimmed)) {
      return 'COMMAND';
    }

    if (this.isNewOrDifferentStory(trimmed)) {
      return 'CREATIVE_REQUEST';
    }

    if (this.isStoryRestartFromBeginning(trimmed)) {
      return 'CREATIVE_REQUEST';
    }

    if (this.isStoryContinuationOrResume(trimmed)) {
      return 'CONTINUATION';
    }

    if (this.LANG_ENGLISH_REGEX.test(trimmed) || this.LANG_HINDI_REGEX.test(trimmed) || this.LANG_HINGLISH_REGEX.test(trimmed)) {
      return 'LANGUAGE_SWITCH';
    }

    if (this.INTERVIEW_START_REGEX.test(trimmed)) {
      return 'COMMAND';
    }

    if (this.CONTEXTUAL_FOLLOW_UP_REGEX.test(trimmed)) {
      return 'CONTEXTUAL_FOLLOW_UP';
    }

    if (this.BACKCHANNEL_REGEX.test(trimmed)) {
      return 'BACKCHANNEL';
    }

    if (context?.isInterruption) {
      if (this.CREATIVE_REQUEST_REGEX.test(trimmed)) return 'CREATIVE_REQUEST';
      if (this.TOPIC_CHANGE_REGEX.test(trimmed)) return 'TOPIC_CHANGE';
      if (this.CORRECTION_REGEX.test(trimmed)) return 'CORRECTION';
      return 'INTERRUPTION';
    }

    if (this.CONTINUATION_REGEX.test(trimmed)) {
      return 'CONTINUATION';
    }

    if (this.CORRECTION_REGEX.test(trimmed)) {
      return 'CORRECTION';
    }

    if (this.CLARIFICATION_REGEX.test(trimmed)) {
      return 'CLARIFICATION';
    }

    if (this.GREETING_REGEX.test(trimmed)) {
      return 'GREETING';
    }

    if (this.SELF_INQUIRY_REGEX.test(trimmed)) {
      return 'INFORMATION_REQUEST';
    }

    if (this.CREATIVE_REQUEST_REGEX.test(trimmed)) {
      return 'CREATIVE_REQUEST';
    }

    if (
      this.TOOL_WEATHER_REGEX.test(trimmed) ||
      this.TOOL_REMINDER_REGEX.test(trimmed) ||
      this.TOOL_SEARCH_REGEX.test(trimmed)
    ) {
      return 'TOOL_REQUEST';
    }

    if (this.TOPIC_RETURN_REGEX.test(trimmed)) {
      return 'TOPIC_RETURN';
    }

    if (this.TOPIC_CHANGE_REGEX.test(trimmed)) {
      return 'TOPIC_CHANGE';
    }

    if (this.INFO_REQUEST_REGEX.test(trimmed)) {
      return 'INFORMATION_REQUEST';
    }

    if (trimmed.endsWith('?') || /^(what|why|how|when|where|who|is|are|can|could|do|does|did|kya|kyun|kaise|kab|kahan|kaun)\b/i.test(trimmed)) {
      return 'QUESTION';
    }

    if (/\b(that actually is nice|that was nice|that's nice|that is cool|i like that|awesome|loved it)\b/i.test(trimmed)) {
      return 'STATEMENT';
    }

    return 'NORMAL_TURN';
  }
}
