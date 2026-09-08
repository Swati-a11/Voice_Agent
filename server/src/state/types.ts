export type ConversationState =
  | 'IDLE'
  | 'LISTENING'
  | 'USER_SPEAKING'
  | 'PROCESSING'
  | 'AGENT_SPEAKING'
  | 'BACKCHANNEL'
  | 'INTERRUPTED'
  | 'TOPIC_SWITCH'
  | 'TOPIC_RETURN'
  | 'WAITING_FOR_CONTINUATION'
  | 'TOOL_CALLING';

export type UserIntent =
  | 'NORMAL_TURN'
  | 'GREETING'
  | 'COMMAND'
  | 'QUESTION'
  | 'INFORMATION_REQUEST'
  | 'CREATIVE_REQUEST'
  | 'STATEMENT'
  | 'BACKCHANNEL'
  | 'INTERRUPTION'
  | 'TOPIC_CHANGE'
  | 'TOPIC_RETURN'
  | 'CLARIFICATION'
  | 'CORRECTION'
  | 'CONTINUATION'
  | 'CONTEXTUAL_FOLLOW_UP'
  | 'TOOL_REQUEST'
  | 'LANGUAGE_SWITCH';

export type DetailedIntent =
  | 'greeting'
  | 'goodbye'
  | 'stop'
  | 'acknowledgement'
  | 'question'
  | 'opinion'
  | 'entity_question'
  | 'person_question'
  | 'current_information'
  | 'future_forecast'
  | 'quote_request'
  | 'emotional_statement'
  | 'personal_sharing'
  | 'personal_feedback'
  | 'friend_birthday'
  | 'homework_done'
  | 'affection'
  | 'flirtation'
  | 'crush'
  | 'proposal_practice'
  | 'rejection_support'
  | 'breakup_support'
  | 'reconciliation'
  | 'friendship_conflict'
  | 'what_should_i_say'
  | 'opinion_request'
  | 'girlfriend_roleplay'
  | 'boyfriend_roleplay'
  | 'teacher_roleplay'
  | 'interviewer_roleplay'
  | 'interview_feedback'
  | 'social_teasing'
  | 'life_scenario'
  | 'boredom'
  | 'insult'
  | 'compliment'
  | 'joke_request'
  | 'story_request'
  | 'story_continue'
  | 'role_correction'
  | 'career_support'
  | 'topic_change'
  | 'advice_request'
  | 'apology_action'
  | 'message_drafting'
  | 'personal_health_event'
  | 'technical_explanation'
  | 'stock_market'
  | 'explanation_request'
  | 'incomplete'
  | 'clarification'
  | 'casual_chat'
  | 'health'
  | 'safety'
  | 'unknown';

export interface MentionedEntity {
  name: string;
  type: 'person' | 'creator' | 'company' | 'product' | 'technology' | 'place' | 'organization' | 'concept' | 'event';
  gender?: 'female' | 'male' | 'unknown';
  description?: string;
  knownInformation?: string;
  isNicheOrAmbiguous?: boolean;
  lastMentionedAt: number;
}

export type EmotionalTone =
  | 'neutral'
  | 'happy'
  | 'excited'
  | 'sad'
  | 'frustrated'
  | 'confused'
  | 'surprised'
  | 'casual'
  | 'serious';

export type SpecificEmotion =
  | 'happy'
  | 'excited'
  | 'calm'
  | 'neutral'
  | 'sad'
  | 'frustrated'
  | 'angry'
  | 'anxious'
  | 'nervous'
  | 'confused'
  | 'tired'
  | 'stressed';

export type SpeakingStyle =
  | 'casual'
  | 'serious'
  | 'playful'
  | 'rushed'
  | 'hesitant'
  | 'emotional'
  | 'calm';

export interface VoiceProsody {
  avgEnergy: number;
  peakEnergy: number;
  pitchVariation: number;
  speakingRate: 'slow' | 'normal' | 'fast' | 'rushed';
  durationMs: number;
}

export type ConversationMode =
  | 'CASUAL'
  | 'GENERAL_CHAT'
  | 'CASUAL_CHAT'
  | 'PERSONAL_STORY'
  | 'EMOTIONAL_SUPPORT'
  | 'ADVICE'
  | 'JOKE'
  | 'STORY'
  | 'STORYTELLING'
  | 'INFORMATION'
  | 'CURRENT_INFORMATION'
  | 'TECHNICAL_EXPLANATION'
  | 'GAME'
  | 'INTERVIEW'
  | 'INTERVIEW_PREP'
  | 'INTERVIEWER_ROLEPLAY'
  | 'FRIEND_CONFLICT'
  | 'RELATIONSHIP_CONFLICT'
  | 'FLIRTING'
  | 'GIRLFRIEND_STYLE_ROLEPLAY'
  | 'BOYFRIEND_STYLE_ROLEPLAY'
  | 'PROPOSAL_PRACTICE'
  | 'TEACHER_ROLEPLAY'
  | 'ROLEPLAY'
  | 'PROBLEM_SOLVING'
  | 'PERSONAL_SHARING'
  | 'ACTIVE_LISTENING'
  | 'GOODBYE';

export type LanguageMode = 'english' | 'hindi' | 'hinglish' | 'auto';

export interface PersonalStoryThread {
  isActive: boolean;
  topic: string;
  peopleMentioned: string[];
  keyDetails: string[];
  emotionalArc: SpecificEmotion[];
  lastEvent: string;
  unresolvedProblem?: string;
  userWantsAdvice: boolean;
  userDeclinedAdvice: boolean;
  turnsCount: number;
  languageStyle: 'english' | 'hinglish' | 'hindi';
  startedAt: number;
  lastUpdated: number;
  storyType?: string;
  mainEvent?: string;
  place?: string;
  emotion?: string;
  interestingDetail?: string;
  problem?: string;
  unexpectedPart?: string;
  outcome?: string;
  unfinishedPart?: string;
  possibleFollowUp?: string;
  isIncompleteOpener?: boolean;
}

export type SocialSituation =
  | 'none'
  | 'friendship_conflict'
  | 'romantic_conflict'
  | 'workplace_conflict'
  | 'teacher_student_conflict'
  | 'family_conflict'
  | 'career_anxiety'
  | 'crush_situation'
  | 'breakup_situation'
  | 'friend_troubled'
  | 'positive_event'
  | 'general_life';

export type ResponsibilityEvaluation =
  | 'unclear'
  | 'user_primarily'
  | 'other_primarily'
  | 'shared'
  | 'no_fault_positive';

export interface ConversationStory {
  situation: SocialSituation;
  people: string[];
  userActions: string[];
  otherPersonActions: string[];
  claims: string[];
  emotions: string[];
  unresolvedQuestions: string[];
  timeline: string[];
  currentGoal: string | null;
  adviceRequested: boolean;
  userDeclinedAdvice: boolean;
  safetyRelevant: boolean;
  physicalHarmReported: boolean;
  responsibility: ResponsibilityEvaluation;
  responsibilityReasoning?: string;
  stage: 'react_listen' | 'clarifying' | 'building' | 'evaluating' | 'advised';
  lastUpdated: number;
}

export type ResponseGoal =
  | 'REACT'
  | 'ANSWER'
  | 'ADVISE'
  | 'COMFORT'
  | 'JOKE'
  | 'STORY'
  | 'CLARIFY'
  | 'CONTINUE'
  | 'CORRECT'
  | 'GOODBYE'
  | 'PLAYFULLY_DEFEND'
  | 'CELEBRATE'
  | 'LISTEN';

export interface InterviewContextState {
  hasUpcomingInterview: boolean;
  role: string;
  time: string;
  company?: string;
  emotion?: string;
  anxietyDiscussed?: boolean;
  mockOffered?: boolean;
}

export interface InterviewState {
  active: boolean;
  topic: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'ADAPTIVE';
  questionNumber: number;
  lastQuestion: string;
  totalQuestionsAsked: number;
  context?: InterviewContextState;
}

export interface PendingQuestion {
  question: string;
  expectedInformation: 'interview_role' | 'conflict_detail' | 'other_person_statement' | 'user_response' | 'crush_name' | 'clarification' | 'general';
  topic: string;
  mode: ConversationMode;
  turnId: string;
  timestamp: number;
}

export interface FullConversationContext {
  activeMode: ConversationMode;
  activeTopic: string;
  pendingQuestion?: PendingQuestion | null;
  pendingExpectedAnswer?: string | null;
  recentIntent?: DetailedIntent | UserIntent | string;
  recentEntity?: MentionedEntity | null;
  recentFacts: string[];
  emotionalState: SpecificEmotion;
  conversationGoal?: string | null;
  storyState: ConversationStory;
  lastUserMessage?: string;
  lastAyraMessage?: string;
  lastMeaningfulUserMessage?: string;
}

export interface StateTransitionEvent {
  id: string;
  fromState: ConversationState;
  toState: ConversationState;
  trigger: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface InterruptionEvent {
  id: string;
  timestamp: number;
  type: 'REAL_INTERRUPTION' | 'REJECTED_NOISE';
  reason: string;
  durationMs: number;
  tokenCount?: number;
  partialTranscript?: string;
  agentSpeechProgress?: number;
}

export interface TurnMetrics {
  turnId: string;
  userSpeechEndTime: number;
  sttEndTime: number;
  sttLatencyMs: number;
  intentResolvedTime?: number;
  geminiRequestStartTime?: number;
  llmFirstTokenTime: number;
  llmTTFTMs: number;
  geminiFirstChunkTime?: number;
  ttsFirstAudioTime: number;
  ttsTTFAMs: number;
  totalLatencyMs: number;
  interrupted: boolean;
  intent: UserIntent;
  languageMode: LanguageMode;
}

export interface TopicItem {
  id: string;
  name: string;
  summary: string;
  keywords: string[];
  startedAt: number;
  lastActiveAt: number;
  unresolvedQuestions: string[];
}

export interface MemoryFact {
  id: string;
  userId: string;
  fact: string;
  category: 'preference' | 'personal' | 'work' | 'education' | 'project' | 'reminder' | 'general';
  confidence: number;
  createdAt: number;
  lastMentionedAt: number;
}

export interface ReminderItem {
  id: string;
  userId: string;
  text: string;
  timeString: string;
  createdAt: number;
  status: 'pending' | 'completed';
}

export interface PersonaConfig {
  name: string;
  trait: string;
  description: string;
  speechStyle: string;
  fillers: string[];
  hinglishFillers: string[];
  tonePreferences: string;
  voiceGender?: 'female' | 'male';
}

export interface ConversationTurn {
  id: string;
  role: 'user' | 'agent' | 'system';
  text: string;
  intent?: UserIntent;
  emotion?: EmotionalTone;
  languageMode?: LanguageMode;
  timestamp: number;
  audioDurationMs?: number;
  interrupted?: boolean;
}
