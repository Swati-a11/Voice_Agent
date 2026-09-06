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
  avgEnergy: number; // 0.0 -> 1.0
  peakEnergy: number; // 0.0 -> 1.0
  pitchVariation: number; // 0.0 -> 1.0
  speakingRate: 'slow' | 'normal' | 'fast' | 'rushed';
  durationMs: number;
}

export interface EmotionAnalysisResult {
  emotion: SpecificEmotion;
  intensity: number;
  speakingStyle: SpeakingStyle;
  confidence: number;
  tone: EmotionalTone;
  ttsAdjustment?: {
    rate: number;
    pitch: number;
    volume: number;
  };
}

export type ConversationMode =
  | 'CASUAL'
  | 'EXPLANATION'
  | 'STORY'
  | 'INTERVIEW'
  | 'PROBLEM_SOLVING';

export type LanguageMode = 'english' | 'hindi' | 'hinglish' | 'auto';

export interface InterviewState {
  active: boolean;
  topic: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'ADAPTIVE';
  questionNumber: number;
  lastQuestion: string;
  totalQuestionsAsked: number;
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
  llmFirstTokenTime: number;
  llmTTFTMs: number;
  ttsFirstAudioTime: number;
  ttsTTFAMs: number;
  totalLatencyMs: number;
  interrupted: boolean;
  intent: UserIntent;
  languageMode: LanguageMode;
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

export interface ScenarioStep {
  action: string;
  payload?: any;
  description: string;
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  steps: ScenarioStep[];
}
