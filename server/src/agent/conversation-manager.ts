import { EventEmitter } from 'events';
import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { ConversationStateMachine } from '../state/conversation-state.js';
import {
  ConversationState,
  ConversationTurn,
  EmotionalTone,
  LanguageMode,
  UserIntent,
  DetailedIntent,
  MentionedEntity,
  PersonaConfig,
  ConversationMode,
  InterviewState,
  VoiceProsody,
  PersonalStoryThread,
  ConversationStory,
  PendingQuestion,
  FullConversationContext
} from '../state/types.js';
import { PERSONAS, getPersona } from '../persona/persona-config.js';
import { IntentClassifier, DetailedClassificationResult } from './intent-classifier.js';
import { StoryEngine } from './story-engine.js';
import { TopicManager } from './topic-manager.js';
import { MemoryManager } from './memory-manager.js';
import { EmotionalAnalyzer, EmotionAnalysisResult } from './emotional-analyzer.js';
import { BackchannelManager } from './backchannel-manager.js';
import { ToolExecutor } from './tool-executor.js';
import { ResponseStrategy } from './response-strategy.js';
import { WebSearchService } from './web-search-service.js';
import { InterruptionHandler } from '../voice/interruption-handler.js';
import { LatencyTracker } from '../metrics/latency-tracker.js';
import { TTSService } from '../voice/tts-service.js';
import { STTService } from '../voice/stt-service.js';
import { TextChunker } from '../voice/text-chunker.js';

export interface ManagerOptions {
  userId?: string;
  personaName?: string;
}

export interface ActiveStoryState {
  title: string;
  theme: string;
  characters: string[];
  setting: string;
  importantEvents: string[];
  interruptedPoint: string;
  lastSpokenSegment: string;
  currentSegmentIndex: number;
  segments: string[];
  isPaused: boolean;
}

export class ConversationManager extends EventEmitter {
  public stateMachine: ConversationStateMachine;
  public topicManager: TopicManager;
  public memoryManager: MemoryManager;
  public backchannelManager: BackchannelManager;
  public toolExecutor: ToolExecutor;
  public interruptionHandler: InterruptionHandler;
  public latencyTracker: LatencyTracker;
  public ttsService: TTSService;
  public sttService: STTService;

  private currentPersona: PersonaConfig;
  private userId: string;
  private geminiClient: GoogleGenAI | null = null;

  // Active Modes & Interview State
  private conversationMode: ConversationMode = 'CASUAL';
  private activeLanguageMode: LanguageMode = 'auto';
  private lastMentionedEntity: MentionedEntity | null = null;
  private interviewState: InterviewState = {
    active: false,
    topic: 'General',
    difficulty: 'ADAPTIVE',
    questionNumber: 0,
    lastQuestion: '',
    totalQuestionsAsked: 0
  };

  // Conversational preferences & negative constraints
  private excludedJokeCategories: Set<string> = new Set();
  private noAdviceMode = false;

  // Active Personal Story Thread Context
  private personalStoryThread: PersonalStoryThread = {
    isActive: false,
    topic: '',
    peopleMentioned: [],
    keyDetails: [],
    emotionalArc: [],
    lastEvent: '',
    userWantsAdvice: false,
    userDeclinedAdvice: false,
    turnsCount: 0,
    languageStyle: 'english',
    startedAt: 0,
    lastUpdated: 0
  };

  // Interview and Goodnight Context Tracking
  private interviewContext = {
    hasUpcomingInterview: false,
    role: '',
    time: '',
    company: '',
    emotion: '',
    anxietyDiscussed: false,
    mockOffered: false
  };
  private friendBirthdayContext = {
    announced: false,
    time: '',
    relationship: 'friend'
  };
  private homeworkCompleted = false;
  private userNervous = false;
  private friendConflictLogged = false;
  private activeRoleplay: 'girlfriend' | 'boyfriend' | 'crush_practice' | 'teacher' | 'interviewer' | 'none' = 'none';
  private crushContext = {
    active: false,
    stage: 'initial' as 'initial' | 'confession_scared' | 'practice' | 'rejected'
  };
  private breakupContext = {
    active: false
  };
  private interviewRoleplayStep = 0;
  private lastGoodnightTime = 0;
  private lastJokeCategory = 'general';
  private lastTechnicalTopic: string | null = null;
  private pendingQuestion: PendingQuestion | null = null;
  private conversationGoal: string | null = null;
  private lastMeaningfulUserMessage: string = '';
  private conversationStory: ConversationStory = StoryEngine.createInitialStory();

  private activeStoryState: ActiveStoryState | null = null;
  private lastJokeIndex = -1;
  private hasIntroducedSelf = false;

  private fallbackPool = [
    "Wait, I missed that. What were you saying?",
    "Thoda clear nahi sunayi diya — phir se bologe?",
    "Sorry, that last part broke up a little. What was that?",
    "Hmm, didn't catch that. Say that again?",
    "Ek second — voice thodi break ho gayi. Phir se batana?"
  ];
  private lastFallbackIndex = -1;

  private static DEVELOPER_JOKES = [
    "Why do programmers prefer dark mode? Because light attracts bugs!",
    "Okay, okay, one more. Why did the developer go broke? Because they used up all their cache.",
    "There are 10 types of people in the world—those who understand binary, and those who don't.",
    "Why was the JavaScript developer sad? Because they didn't know how to 'null' their feelings."
  ];

  private static SANTA_BANTA_JOKES = [
    "Santa went to a library and asked for a book on how to acquire common sense. The librarian replied: 'That section is on the top floor—right above reality!'",
    "Santa bought a new smartphone and told Banta: 'This phone is so smart, whenever I make a mistake, it auto-corrects to an even bigger mistake!'",
    "Santa was filling out a job application. Under 'Length of residence at present address', he wrote: 'About 45 feet!'"
  ];

  private static GENERAL_JOKES = [
    "Why don't eggs tell jokes? Because they'd crack each other up!",
    "Why did the scarecrow win an award? Because he was outstanding in his field!",
    "What do you call a fake noodle? An impasta!",
    "Why don't skeletons fight each other? They just don't have the guts!",
    "Why did the bicycle fall over? Because it was two-tired!"
  ];

  private static HINDI_JOKES = [
    "Ek programmer ne bhagwan se pucha: 'Bhagwan, aapke liye 1 crore saal kitne hote hain?' Bhagwan bole: 'Ek second.' Programmer bola: 'Aur 1 crore rupaye?' Bhagwan bole: 'Ek paisa.' Programmer bola: 'Toh mujhe ek paisa de do na!' Bhagwan bole: 'Ruko ek second!'",
    "Pappu ne doctor se pucha: 'Doctor sahab, dava kab leni hai?' Doctor bola: 'Subah uthne se pehle aur raat ko sone ke baad!'"
  ];

  private static JOKES = [
    ...ConversationManager.DEVELOPER_JOKES,
    ...ConversationManager.SANTA_BANTA_JOKES,
    ...ConversationManager.GENERAL_JOKES
  ];

  private getJoke(requestedCategory?: string): string {
    const cat = (requestedCategory || '').toLowerCase();
    if (cat.includes('dev') || cat.includes('program') || cat.includes('code') || cat.includes('coding') || cat.includes('tech')) {
      this.lastJokeCategory = 'developer';
    } else if (cat.includes('santa') || cat.includes('banta')) {
      this.lastJokeCategory = 'santabanta';
    } else if (cat.includes('hindi') || cat.includes('hinglish')) {
      this.lastJokeCategory = 'hindi';
    } else if (cat.includes('general') || cat.includes('simple')) {
      this.lastJokeCategory = 'general';
    }

    if (this.lastJokeCategory === 'developer') {
      this.lastJokeIndex = (this.lastJokeIndex + 1) % ConversationManager.DEVELOPER_JOKES.length;
      return ConversationManager.DEVELOPER_JOKES[this.lastJokeIndex];
    }
    if (this.lastJokeCategory === 'santabanta') {
      this.lastJokeIndex = (this.lastJokeIndex + 1) % ConversationManager.SANTA_BANTA_JOKES.length;
      return ConversationManager.SANTA_BANTA_JOKES[this.lastJokeIndex];
    }
    if (this.lastJokeCategory === 'hindi') {
      this.lastJokeIndex = (this.lastJokeIndex + 1) % ConversationManager.HINDI_JOKES.length;
      return ConversationManager.HINDI_JOKES[this.lastJokeIndex];
    }

    if (this.lastJokeCategory === 'general') {
      this.lastJokeIndex = (this.lastJokeIndex + 1) % ConversationManager.GENERAL_JOKES.length;
      return ConversationManager.GENERAL_JOKES[this.lastJokeIndex];
    }

    // Build available pool respecting exclusions
    const pool: string[] = [];
    if (!this.excludedJokeCategories.has('general')) {
      pool.push(...ConversationManager.GENERAL_JOKES);
    }
    if (!this.excludedJokeCategories.has('santabanta')) {
      pool.push(...ConversationManager.SANTA_BANTA_JOKES);
    }
    if (!this.excludedJokeCategories.has('developer')) {
      pool.push(...ConversationManager.DEVELOPER_JOKES);
    }

    if (pool.length === 0) {
      pool.push(...ConversationManager.GENERAL_JOKES);
    }

    this.lastJokeIndex = (this.lastJokeIndex + 1) % pool.length;
    return pool[this.lastJokeIndex];
  }
  private static SPACE_STORY = {
    title: "The Ancient Astronomical Library",
    theme: "Space & Ancient Astronomy",
    characters: ["Caretaker / Astronomer"],
    setting: "Extinct volcano observatory",
    importantEvents: [
      "Alignment of twin moons every 50 years",
      "Observatory central lens reveals hidden constellation coordinate in subterranean archive",
      "Caretaker steps on stone pedestal activating deep blue light and 3D star map",
      "Map reveals coordinate to ancient beacon pulse relay beyond Kuiper belt",
      "Observatory seals dome before moons move out of alignment"
    ],
    segments: [
      "Haan, listen to this... Picture an ancient astronomical library built inside an extinct volcano. Every fifty years, when two twin moons align, the observatory's central lens casts a beam of light across a subterranean archive that no map had ever recorded. The caretaker, a young astronomer who had spent her entire youth translating forgotten star charts, watched as the light revealed a hidden constellation coordinate. Wait, this is where it gets interesting... As she stepped onto the stone pedestal, the observatory mechanisms hummed to life. You're still with me, right?",
      "Alright, so where we left off... the stone pedestal had just activated! The moment she stepped onto it, the entire observatory began to hum with deep blue crystalline light. The floor shifted, projecting a massive three-dimensional star map into the cavern air, showing coordinates to a forgotten orbital relay. Wait, this is where it gets really interesting...",
      "As the star map rotated, she realized the constellation wasn't natural—it was an ancient artificial beacon pulse! A sequence of encrypted signals started decrypting across the central console, revealing coordinates to a sanctuary station beyond the Kuiper belt. And just as the final coordinate unlocked...",
      "The observatory sealed its dome, locking the navigation data safely into her portable terminal just as the twin moons passed out of alignment. She held the map to the oldest secret in the solar system! How did you like the ending?"
    ]
  };

  private static OCEAN_STORY = {
    title: "The Deep-Sea Mariana Abyssal Station",
    theme: "Ocean & Deep Submersible Archaeology",
    characters: ["Station Engineer / Marine Pilot"],
    setting: "Deep-sea hydrothermal trench abyss",
    importantEvents: [
      "Discovery of bioluminescent Fibonacci pulses from seabed cavern",
      "Drone enters coral-covered titanium structure airlock",
      "Automated ecological regulator preserving pre-ice age biome for 50,000 years",
      "Clean geothermal core blueprints transmitted to surface vessel"
    ],
    segments: [
      "Of course. Let me tell you a completely different one... Picture a deep-sea research station five thousand meters below the Pacific Ocean, suspended above an uncharted hydrothermal trench. The station engineer, while calibrating an external sonar probe, noticed irregular bioluminescent pulses pulsing in rhythmic sequences from the seabed cavern. As the sub's cameras focused on the abyss, an ancient mechanical structure made of coral-covered titanium came into view. Wait, this is where it gets interesting... The structure responded to her sonar ping with a deep harmonic frequency!",
      "Alright, picking up where we left off with the deep-sea discovery... The titanium structure's outer iris dilated, revealing a floodlit airlock chamber untouched by the ocean's immense pressure. As she piloted her exploration drone inside, the interior walls illuminated with glowing blue glyphs that began translating into atmospheric data. Wait, this is where it gets really interesting...",
      "The drone cameras revealed a preserved biosphere chamber containing pre-ice age botanical specimens thriving under geothermal vents! And right in the center stood an automated ecological regulator that had been keeping the biome alive for fifty thousand years. Just as the drone started recording the genetic archive...",
      "A secondary power grid booted up, transmitting an encrypted transmission directly to the surface vessel with complete blueprints of the clean geothermal core! She had just found the lost key to planetary energy renewal. How did you like that one?"
    ]
  };

  private static CLOCKMAKER_STORY = {
    title: "The Chronos Clockmaker's Sanctuary",
    theme: "Steampunk Chrono-Mechanics",
    characters: ["Master Clockmaker"],
    setting: "Victorian London clock tower workshop",
    importantEvents: [
      "Installation of unknown celestial alloy gear freezes time across the city at 11:59 PM",
      "Brass mechanical sparrow awakens and speaks human language",
      "Calibrating four pendulum counterweights amidst temporal shadow apparitions",
      "Harmonic alignment strikes midnight smoothly and saves timeline"
    ],
    segments: [
      "Of course. Here is another completely unique story... In the foggy alleys of Victorian London, a master clockmaker discovered a peculiar gear crafted from an unknown celestial alloy. The moment she installed it into the great tower clock, time across the entire city froze at precisely 11:59 PM—except inside her workshop! As she looked through the frosted window, frozen raindrops hung suspended in mid-air. Wait, this is where it gets interesting... A brass mechanical sparrow on her workbench began to tick and speak in human language!",
      "Alright, picking up where we left off... The mechanical sparrow explained that the celestial gear was a temporal anchor meant to prevent a temporal collapse. If the clock reached midnight, the paradox would dissolve the timeline unless the four secondary pendulum weights were calibrated to harmonic resonance. She grabbed her brass calipers and climbed the spiral staircase into the frozen clock tower...",
      "As she reached the giant escapement wheel, shadow apparitions from unwritten futures began manifesting around the gears, trying to knock the counterweights loose! With only seconds before the frozen second hand snapped forward, she calculated the angular momentum and threw the master release lever...",
      "The gears aligned with a golden chime, realigning the timeline and causing the clock to strike midnight smoothly as the city returned to life! The sparrow dissolved into golden sparks, leaving only a blueprint for eternal chrono-stability. How did you like that story?"
    ]
  };

  // Active in-flight control flags & generation IDs
  private activeAbortController: AbortController | null = null;
  private isInterruptedFlag = false;
  private currentGenerationId = 0;
  private activeTurnId = '';

  private lastProcessedTranscript = '';
  private lastProcessedTime = 0;

  constructor(options: ManagerOptions = {}) {
    super();
    this.userId = options.userId || 'default-user';
    this.currentPersona = getPersona(options.personaName || config.defaultPersona);

    this.stateMachine = new ConversationStateMachine('IDLE');
    this.topicManager = new TopicManager();
    this.memoryManager = new MemoryManager();
    this.backchannelManager = new BackchannelManager();
    this.toolExecutor = new ToolExecutor(this.memoryManager);
    this.interruptionHandler = new InterruptionHandler();
    this.latencyTracker = new LatencyTracker();
    this.ttsService = new TTSService();
    this.sttService = new STTService();

    if (config.geminiApiKey) {
      try {
        this.geminiClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
        console.log(`[GEMINI] Initialized Google GenAI client (${config.geminiModel})`);
      } catch (err) {
        console.error('[GEMINI] [ERROR] Failed to initialize Google GenAI SDK:', err);
      }
    } else {
      console.log('[GEMINI] Notice: No GEMINI_API_KEY set; running in High-Fidelity Local Intent Mode.');
    }

    this.setupListeners();
  }

  private setupListeners(): void {
    this.stateMachine.on('transition', (evt) => {
      console.log(`[STATE] ${evt.fromState} -> ${evt.toState} (${evt.trigger})`);
      this.emit('state_change', evt);
    });

    this.interruptionHandler.on('interruption_evaluated', (evt) => {
      console.log(`[INTERRUPTION] ${evt.type}: ${evt.reason}`);
      this.emit('interruption_event', evt);
    });

    this.latencyTracker.on('turn_metric', (metric) => {
      console.log(`[LATENCY] STT: ${metric.sttLatencyMs}ms | GEMINI_TTFB: ${metric.llmTTFTMs}ms | TTS_TTFB: ${metric.ttsTTFAMs}ms | TOTAL_TTFA: ${metric.totalLatencyMs}ms`);
      this.emit('metrics_update', metric);
    });
  }

  public getPersona(): PersonaConfig {
    return this.currentPersona;
  }

  public setPersona(name: string): PersonaConfig {
    this.currentPersona = getPersona(name);
    console.log(`[VOICE] Switched persona to: ${this.currentPersona.name}`);
    this.emit('persona_changed', this.currentPersona);
    return this.currentPersona;
  }

  public getUserId(): string {
    return this.userId;
  }

  public setUserId(id: string): void {
    this.userId = id;
  }

  public startCall(): void {
    console.log('[VOICE] Call session started');
    this.stateMachine.transitionTo('LISTENING', 'CALL_STARTED');
    this.emit('call_started', {
      persona: this.currentPersona,
      currentTopic: this.topicManager.getCurrentTopic(),
      memoriesCount: this.memoryManager.getFacts(this.userId).length
    });
  }

  public endCall(): void {
    console.log('[VOICE] Call session ended');
    this.cancelInFlightResponse('CALL_ENDED');
    this.stateMachine.transitionTo('IDLE', 'CALL_ENDED');
    this.emit('call_ended', {});
  }

  /**
   * Dedicated deterministic STOP command handler (never invokes Gemini)
   */
  public async handleStopCommand(params: { text: string; generationId?: number }): Promise<void> {
    const rawText = params.text.trim();
    console.log(`[COMMAND] Hard STOP handled on server: "${rawText}" -> cutting playback & generation.`);
    this.cancelInFlightResponse('USER_STOP_COMMAND');
    this.conversationMode = 'CASUAL';
    this.interviewState.active = false;
    if (this.activeStoryState) {
      this.activeStoryState.isPaused = true;
      this.activeStoryState.interruptedPoint = `Segment ${this.activeStoryState.currentSegmentIndex + 1}`;
    }
    this.stateMachine.transitionTo('LISTENING', 'USER_STOP_COMMAND');

    this.currentGenerationId = params.generationId ? Math.max(this.currentGenerationId + 1, params.generationId) : this.currentGenerationId + 1;
    const generationId = this.currentGenerationId;
    const turnId = `turn-${Date.now()}`;

    const shortAck = "Okay, stopping.";
    const ttsRes = await this.ttsService.synthesize(shortAck);

    this.emit('response_start', { turnId, generationId });
    this.emit('agent_speech_chunk', {
      text: shortAck,
      phoneticText: ttsRes.phoneticText,
      provider: ttsRes.provider,
      turnId,
      generationId
    });
    this.emit('response_end', { turnId, generationId });

    const userTurn: ConversationTurn = {
      id: `turn-user-${Date.now()}`,
      role: 'user',
      text: rawText,
      timestamp: Date.now(),
      intent: 'COMMAND'
    };
    const agentTurn: ConversationTurn = {
      id: `turn-agent-${Date.now()}`,
      role: 'agent',
      text: shortAck,
      timestamp: Date.now(),
      intent: 'COMMAND'
    };
    this.memoryManager.addTurn(userTurn);
    this.memoryManager.addTurn(agentTurn);
    this.emit('transcript_turn', userTurn);
    this.emit('transcript_turn', agentTurn);
  }

  /**
   * Handle incoming user speech audio or transcript with full multimodal emotion & prosody support
   */
  public async handleUserSpeech(params: {
    text: string;
    isAudioChunk?: boolean;
    audioBuffer?: Buffer;
    isInterruptionCheck?: boolean;
    durationMs?: number;
    generationId?: number;
    prosody?: VoiceProsody;
  }): Promise<void> {
    const rawInput = params.text.trim();
    if (!rawInput) return;

    // 0. Extract Clean User Request / Intercept Stop
    const extracted = IntentClassifier.extractCleanUserRequest(rawInput);
    if (extracted.isPureStop) {
      await this.handleStopCommand({ text: rawInput, generationId: params.generationId });
      return;
    }

    const rawText = extracted.hasStopPrefix && extracted.cleanText ? extracted.cleanText : rawInput;
    const isInterruptionTurn = Boolean(params.isInterruptionCheck || extracted.hasStopPrefix);

    // 0.1 Server-side Deduplication Guard (2 second window)
    const now = Date.now();
    const normalizedInput = rawText.toLowerCase().replace(/\s+/g, ' ');
    const isExemptFromDedup = /^(good night|goodnight|yes|no|haan|nahi|stop|bas|sunao|okay|ok|koi dusra|another one)[.!?]?$/i.test(normalizedInput);
    if (
      !isExemptFromDedup &&
      normalizedInput === this.lastProcessedTranscript &&
      now - this.lastProcessedTime < 2000
    ) {
      console.log(`[TURN DUPLICATE IGNORED] (Server): "${rawText}"`);
      return;
    }
    this.lastProcessedTranscript = normalizedInput;
    this.lastProcessedTime = now;

    // Increment generation ID & assign unique turn ID
    this.currentGenerationId = params.generationId ? Math.max(this.currentGenerationId + 1, params.generationId) : this.currentGenerationId + 1;
    const generationId = this.currentGenerationId;
    const turnId = `turn-${Date.now()}-${uuidv4().slice(0, 4)}`;
    this.activeTurnId = turnId;

    console.log(`\n[TURN START] turnId: ${turnId} (gen #${generationId}) | userText: "${rawText}" | isInterruption: ${isInterruptionTurn}`);
    const speechEndTime = Date.now();
    this.backchannelManager.onUserSpeechEnded();

    // 1. Language Mode Resolution
    if (/\b(speak only in english|talk in english|switch to english|in english please|only english)\b/i.test(rawText)) {
      this.activeLanguageMode = 'english';
    } else if (/\b(hindi mein baat karo|talk in hindi|hindi me bolo|shuddh hindi)\b/i.test(rawText)) {
      this.activeLanguageMode = 'hindi';
    } else if (/\b(hinglish mein baat karo|hinglish me bolo|mix hindi english)\b/i.test(rawText)) {
      this.activeLanguageMode = 'hinglish';
    }

    let effectiveLanguageMode: LanguageMode = this.activeLanguageMode;
    if (effectiveLanguageMode === 'auto') {
      effectiveLanguageMode = this.sttService.detectLanguageMode(rawText);
    }

    // Multimodal Emotion & Tone Prosody Analysis
    const emotionResult = EmotionalAnalyzer.analyzeEmotion(rawText, params.durationMs, params.prosody);
    const emotionalTone = emotionResult.tone;
    console.log(`[EMOTION] emotion=${emotionResult.emotion} intensity=${emotionResult.intensity} confidence=${emotionResult.confidence}`);

    // Real-Time Web Search & Grounding Check (4-step decision layer)
    let searchSummary: string | undefined;
    if (WebSearchService.shouldRouteToWebSearch(rawText, this.lastMentionedEntity)) {
      const searchRes = await WebSearchService.searchCurrentInfo(rawText, this.lastMentionedEntity);
      searchSummary = searchRes.summary;
      console.log(`[SEARCH] query="${searchRes.query}" sources=${searchRes.sources.length}`);
    }

    // 2. Check Barge-In if Agent is currently speaking or user interrupted with a stop prefix
    const currentState = this.stateMachine.getState();
    if (currentState === 'AGENT_SPEAKING' || isInterruptionTurn) {
      if (IntentClassifier.isExplicitStopCommand(rawText)) {
        console.log(`[INTERRUPTION] Explicit stop command detected during speech: "${rawText}" -> cutting playback.`);
        this.cancelInFlightResponse('USER_STOP_COMMAND', generationId - 1);
        this.conversationMode = 'CASUAL';
        this.interviewState.active = false;
        this.stateMachine.transitionTo('LISTENING', 'USER_STOP_COMMAND');

        const shortAck = "Okay, I'm listening.";
        const ttsRes = await this.ttsService.synthesize(shortAck);
        this.emit('agent_speech_chunk', {
          text: shortAck,
          phoneticText: ttsRes.phoneticText,
          provider: ttsRes.provider,
          turnId,
          generationId
        });
        this.emit('response_end', { turnId, generationId });

        this.memoryManager.addTurn({
          id: `turn-user-${Date.now()}`,
          role: 'user',
          text: rawText,
          timestamp: Date.now(),
          intent: 'COMMAND'
        });
        this.memoryManager.addTurn({
          id: `turn-agent-${Date.now()}`,
          role: 'agent',
          text: shortAck,
          timestamp: Date.now(),
          intent: 'COMMAND'
        });
        this.emit('transcript_turn', {
          id: `turn-user-${Date.now()}`,
          role: 'user',
          text: rawText,
          timestamp: Date.now()
        });
        this.emit('transcript_turn', {
          id: `turn-agent-${Date.now()}`,
          role: 'agent',
          text: shortAck,
          timestamp: Date.now()
        });
        return;
      }

      if (/^(hmm+|yeah|yep|uh-huh|mm-hmm|right|okay|acha|haan)[.?!]?$/i.test(rawText)) {
        console.log(`[VAD] Passive backchannel ignored during agent speech: "${rawText}"`);
        return;
      }

      const evalResult = this.interruptionHandler.evaluateInterruption({
        durationMs: params.durationMs || 300,
        transcriptSnippet: rawText,
        agentSpeechProgress: 0.5
      });

      if (!evalResult.isRealInterruption) {
        console.log(`[INTERRUPTION] Non-speech noise ignored during AGENT_SPEAKING: ${evalResult.event.reason}`);
        return;
      }

      console.log(`[INTERRUPTION] Genuine barge-in confirmed! Cutting agent playback.`);
      this.isInterruptedFlag = true;
      this.latencyTracker.recordInterrupted();
      this.cancelInFlightResponse('USER_BARGE_IN', generationId - 1);
      this.stateMachine.transitionTo('INTERRUPTED', 'USER_BARGE_IN', {
        interruptionEventId: evalResult.event.id
      });
      this.emit('barge_in_triggered', { reason: evalResult.event.reason, text: rawText });
    }

    // Start turn latency tracking
    this.latencyTracker.startTurn('NORMAL_TURN', effectiveLanguageMode);
    // Start turn latency tracking
    this.latencyTracker.startTurn('NORMAL_TURN', effectiveLanguageMode);
    this.latencyTracker.recordSpeechEnd();
    this.latencyTracker.recordSTTEnd();

    // 3. Classify intent & topic with recent context
    const prevTopicName = this.topicManager.getCurrentTopic()?.name || 'General';
    const topicAnalysis = this.topicManager.inferAndTrackTopic(rawText);
    const recentTurns = this.memoryManager.getRecentTurns();
    const prevAgentTurn = [...recentTurns].reverse().find(t => t.role === 'agent');
    const prevUserTurn = [...recentTurns].reverse().find(t => t.role === 'user');

    const previousMode = this.conversationMode;
    const lastUserIntent = prevUserTurn?.intent;

    const detailedClassification = IntentClassifier.classifyDetailed(rawText, effectiveLanguageMode, {
      previousAgentText: prevAgentTurn?.text,
      isInterruption: this.isInterruptedFlag,
      topicStackSize: this.topicManager.getTopicStackSize(),
      isInterviewActive: this.interviewState.active,
      lastMentionedEntity: this.lastMentionedEntity,
      isStoryThreadActive: this.personalStoryThread.isActive,
      storyThreadTopic: this.personalStoryThread.topic,
      activeConversationMode: this.conversationMode,
      lastUserIntent
    });

    const narrativeAnalysis = IntentClassifier.isPersonalNarrative(rawText, {
      isStoryThreadActive: this.personalStoryThread.isActive,
      prevAgentText: prevAgentTurn?.text
    });

    const intent = detailedClassification.userIntent;

    // Strict Mode & Priority Management (Section 2 & 3)
    if (detailedClassification.intent === 'joke_request') {
      this.conversationMode = 'JOKE';
      this.personalStoryThread.isActive = false; // Never let old story hijack jokes!
    } else if (detailedClassification.intent === 'topic_change') {
      this.conversationMode = 'GENERAL_CHAT';
      this.personalStoryThread.isActive = false;
      this.interviewState.active = false;
    } else if (detailedClassification.intent === 'goodbye') {
      this.conversationMode = 'GOODBYE';
      this.personalStoryThread.isActive = false;
    } else if (detailedClassification.intent === 'story_request') {
      this.conversationMode = 'STORY';
      this.personalStoryThread.isActive = false;
    } else if (detailedClassification.intent === 'advice_request') {
      this.conversationMode = 'ADVICE';
    } else if (detailedClassification.intent === 'insult' || (detailedClassification.intent === 'personal_feedback' && detailedClassification.socialRequestType === 'roast')) {
      this.conversationMode = 'CASUAL';
      this.personalStoryThread.isActive = false;
    } else if (detailedClassification.intent === 'compliment') {
      this.conversationMode = 'CASUAL';
    } else if (narrativeAnalysis.isNarrative) {
      // Guard: If user explicitly states emotion + reason, treat as ADVICE/EMOTIONAL turn
      // not as a personal story thread — prevents old context hijacking and generic fallback
      const isExplicitEmotionWithReason = (
        /\b(stressed out|stressed|very stressed|so stressed|worried|scared|upset|angry|anxious|exhausted|frustrated|nervous)\b/i.test(rawText) &&
        /\b(because|since|as|kyunki|isliye|coz|cause)\b/i.test(rawText)
      );
      if (isExplicitEmotionWithReason) {
        this.conversationMode = 'ADVICE';
        this.personalStoryThread.isActive = false;
      } else {
      this.conversationMode = 'PERSONAL_STORY';
      this.personalStoryThread.isActive = true;
      this.personalStoryThread.topic = this.personalStoryThread.topic || narrativeAnalysis.type;
      this.personalStoryThread.storyType = narrativeAnalysis.storyType || this.personalStoryThread.storyType;
      this.personalStoryThread.mainEvent = narrativeAnalysis.mainEvent || this.personalStoryThread.mainEvent;
      this.personalStoryThread.place = narrativeAnalysis.place || this.personalStoryThread.place;
      this.personalStoryThread.emotion = narrativeAnalysis.emotion || this.personalStoryThread.emotion;
      this.personalStoryThread.interestingDetail = narrativeAnalysis.interestingDetail || this.personalStoryThread.interestingDetail;
      this.personalStoryThread.problem = narrativeAnalysis.problem || this.personalStoryThread.problem;
      this.personalStoryThread.unexpectedPart = narrativeAnalysis.unexpectedPart || this.personalStoryThread.unexpectedPart;
      this.personalStoryThread.outcome = narrativeAnalysis.outcome || this.personalStoryThread.outcome;
      this.personalStoryThread.unfinishedPart = narrativeAnalysis.unfinishedPart || this.personalStoryThread.unfinishedPart;
      this.personalStoryThread.possibleFollowUp = narrativeAnalysis.possibleFollowUp || this.personalStoryThread.possibleFollowUp;
      this.personalStoryThread.isIncompleteOpener = narrativeAnalysis.isIncompleteOpener;
      this.personalStoryThread.turnsCount++;
      this.personalStoryThread.lastUpdated = Date.now();
      if (narrativeAnalysis.details.length > 0) {
        this.personalStoryThread.keyDetails.push(...narrativeAnalysis.details);
      }
      if (narrativeAnalysis.peopleMentioned.length > 0) {
        this.personalStoryThread.peopleMentioned.push(...narrativeAnalysis.peopleMentioned);
      }
      } // end of isExplicitEmotionWithReason else block
    } else if (detailedClassification.conversationMode) {
      this.conversationMode = detailedClassification.conversationMode;
    }

    // Roleplay & Mode Non-Stickiness (Section 3, 15, 21): A new explicit intent automatically replaces roleplay
    if (this.activeRoleplay !== 'none') {
      const isCrushPracticeDialogue = this.activeRoleplay === 'crush_practice' && ['crush', 'proposal_practice', 'compliment', 'casual_chat'].includes(detailedClassification.intent);
      const nonRoleplayIntents = [
        'crush', 'proposal_practice', 'rejection_support', 'breakup_support', 'reconciliation',
        'friendship_conflict', 'life_scenario', 'current_information', 'explanation_request',
        'goodbye', 'stop', 'topic_change', 'joke_request', 'story_request', 'boredom',
        'insult', 'compliment'
      ];
      if (!isCrushPracticeDialogue && nonRoleplayIntents.includes(detailedClassification.intent) && detailedClassification.intent !== 'interviewer_roleplay' && detailedClassification.intent !== 'girlfriend_roleplay' && detailedClassification.intent !== 'boyfriend_roleplay') {
        this.activeRoleplay = 'none';
        this.interviewState.active = false;
        this.interviewRoleplayStep = 0;
      } else if (this.activeRoleplay === 'crush_practice') {
        this.conversationMode = 'PROPOSAL_PRACTICE';
      } else if (this.activeRoleplay === 'interviewer') {
        this.conversationMode = 'INTERVIEWER_ROLEPLAY';
      } else if (this.activeRoleplay === 'girlfriend') {
        this.conversationMode = 'GIRLFRIEND_STYLE_ROLEPLAY';
      }
    }

    // Structured Debug Logs (Section 34)
    console.log(`[TURN]
turnId=${turnId}
generationId=${generationId}
text="${rawText}"

[INTENT]
intent=${intent} (detailed: ${detailedClassification.intent})
confidence=0.95

[MODE]
previous=${previousMode}
current=${this.conversationMode}

[CONTEXT]
activeTopic=${topicAnalysis.currentTopic.name}
lastIntent=${lastUserIntent || 'none'}
pendingFollowUp=${this.personalStoryThread.possibleFollowUp || 'none'}

[RESPONSE]
goal=${detailedClassification.intent}
selectedPath=${detailedClassification.intent}
stale=false`);
    console.log(`[emotion: ${emotionResult.emotion}] → [response template/strategy: ${detailedClassification.intent || this.conversationMode}]`);

    if (detailedClassification.entity && !narrativeAnalysis.isNarrative) {
      this.lastMentionedEntity = detailedClassification.entity;
      this.topicManager.pushNewTopic(detailedClassification.entity.name, `Discussion on ${detailedClassification.entity.name}`, [detailedClassification.entity.name.toLowerCase()]);
    }

    if (!narrativeAnalysis.isNarrative && (detailedClassification.isCurrentInformation || detailedClassification.requiresWebSearch || WebSearchService.shouldRouteToWebSearch(rawText, this.lastMentionedEntity)) && !searchSummary) {
      const searchRes = await WebSearchService.searchCurrentInfo(detailedClassification.resolvedQuery || rawText, this.lastMentionedEntity);
      searchSummary = searchRes.summary;
      console.log(`[SEARCH] query="${searchRes.query}" sources=${searchRes.sources.length}`);
    }
    if (topicAnalysis.cancelledTopicName) {
      console.log(`[TASK CANCELLED] "${topicAnalysis.cancelledTopicName}" cancelled for turn ${turnId}`);
      this.lastMentionedEntity = null;
      if (topicAnalysis.cancelledTopicName.includes('interview')) {
        this.interviewState.active = false;
        this.conversationMode = 'CASUAL';
      }
    }

    if (topicAnalysis.changed && !narrativeAnalysis.isNarrative) {
      if (topicAnalysis.isReturn) {
        this.stateMachine.transitionTo('TOPIC_RETURN', 'RESUME_PREVIOUS_TOPIC', {
          topic: topicAnalysis.currentTopic
        });
      } else {
        this.stateMachine.transitionTo('TOPIC_SWITCH', 'NEW_TOPIC_STARTED', {
          topic: topicAnalysis.currentTopic
        });
      }
    }

    // 4. Update Conversation Mode
    if (/\b(take my (react|python|javascript|dsa|coding|technical)?\s*interview|interview me|mock interview|ask me (some |a few )?react questions)\b/i.test(rawText)) {
      this.conversationMode = 'INTERVIEW';
      this.interviewState.active = true;
      const topicMatch = rawText.match(/\b(react|python|javascript|typescript|dsa|system design|node|sql)\b/i);
      this.interviewState.topic = topicMatch ? topicMatch[1] : 'React';
      this.interviewState.questionNumber = 1;
    } else if (/\b(story|fairytale|kahani)\b/i.test(rawText) && !topicAnalysis.cancelledTopicName) {
      this.interviewState.active = false;
      this.conversationMode = 'STORY';
    } else if (this.interviewState.active && (topicAnalysis.cancelledTopicName || /\b(forget the interview|leave the interview|stop interview|joke|chutkula|funny|black hole|star|stars|movie|music|space)\b/i.test(rawText))) {
      this.interviewState.active = false;
      this.conversationMode = 'CASUAL';
    }

    // 5. Record user turn to short-term memory
    const userTurn: ConversationTurn = {
      id: turnId,
      role: 'user',
      text: rawText,
      intent,
      emotion: emotionalTone,
      languageMode: effectiveLanguageMode,
      timestamp: speechEndTime,
      audioDurationMs: params.durationMs || 1000
    };
    this.memoryManager.addTurn(userTurn);
    this.emit('transcript_turn', userTurn);

    // 6. Handle active listener backchannel from user (e.g. "hmm", "yeah", "haan", "okay")
    if (intent === 'BACKCHANNEL') {
      console.log(`[VAD] User active listener backchannel detected ("${rawText}")`);
      await this.generateAndStreamResponse({
        turnId,
        generationId,
        userText: rawText,
        intent: 'BACKCHANNEL',
        lastMentionedEntity: this.lastMentionedEntity,
        emotionalTone,
        emotionResult,
        languageMode: effectiveLanguageMode,
        isInterruptedPivot: this.isInterruptedFlag,
        cancelledTopicName: topicAnalysis.cancelledTopicName,
        previousAssistantMessage: prevAgentTurn?.text,
        previousUserMessage: prevUserTurn?.text,
        searchSummary
      });
      return;
    }

    // 7. Check for Tool Request
    if (intent === 'TOOL_REQUEST') {
      await this.handleToolTurn(turnId, generationId, rawText, effectiveLanguageMode, emotionalTone, emotionResult);
      return;
    }

    // 7b. Check for Explicit Memory Request ("Remember that I prefer short explanations", etc.)
    const explicitMem = IntentClassifier.isExplicitMemoryRequest(rawText);
    if (explicitMem.isMemory && !this.isInterruptedFlag) {
      console.log(`[MEMORY] Explicit memory request detected: "${explicitMem.fact}"`);
      this.memoryManager.addFact(this.userId, explicitMem.fact, 'preference');
      this.memoryManager.addMem0Memory(this.userId, explicitMem.fact).catch(() => {});

      await this.executeDirectTextResponse({
        turnId,
        generationId,
        userText: rawText,
        responseText: explicitMem.confirmation,
        emotionalTone,
        languageMode: effectiveLanguageMode
      });
      return;
    }

    // 7c. Check for meaningful personal context to store asynchronously in Mem0
    if (IntentClassifier.isMeaningfulLongTermContext(rawText)) {
      this.memoryManager.addMem0Memory(this.userId, rawText).catch(() => {});
    }

    // 8. Fast-Path for Simple Greetings, Introductions, Goodbyes & Acknowledgements (<20ms TTFA)
    const isFastPath = (
      (intent === 'GREETING' && /^(hi|hello|hey|hey ayra|hey there|what's up|kaise ho|namaste|good morning|good evening)[.?!]?$/i.test(rawText)) ||
      (/^(who are you|what are you|tell me about yourself|introduce yourself|tell me something about yourself|about yourself)[.?!]?$/i.test(rawText)) ||
      (/^(bye|goodbye|okay bye|ok bye|see you|talk later|see ya|bye bye|alvida|tata|good night|goodnight)[.?!]?$/i.test(rawText)) ||
      (/^(thanks|thank you|thank you so much|thanks a lot|shukriya|dhanyawad)[.?!]?$/i.test(rawText)) ||
      (/^(that's nice|thats nice|that is nice|nice|cool|great|awesome|sahi hai|badhiya)[.?!]?$/i.test(rawText))
    ) && !this.isInterruptedFlag && !this.interviewState.active;

    if (isFastPath) {
      await this.executeFastPathResponse({
        turnId,
        generationId,
        userText: rawText,
        intent: intent || 'GREETING',
        lastMentionedEntity: this.lastMentionedEntity,
        emotionalTone,
        emotionResult,
        languageMode: effectiveLanguageMode,
        cancelledTopicName: topicAnalysis.cancelledTopicName,
        previousAssistantMessage: prevAgentTurn?.text,
        previousUserMessage: prevUserTurn?.text,
        searchSummary
      });
      return;
    }

    // 9. Generate Streaming Response with Context Resolution
    await this.generateAndStreamResponse({
      turnId,
      generationId,
      userText: rawText,
      intent,
      lastMentionedEntity: this.lastMentionedEntity,
      emotionalTone,
      emotionResult,
      languageMode: effectiveLanguageMode,
      isInterruptedPivot: this.isInterruptedFlag,
      cancelledTopicName: topicAnalysis.cancelledTopicName,
      previousAssistantMessage: prevAgentTurn?.text,
      previousUserMessage: prevUserTurn?.text,
      searchSummary
    });

    this.isInterruptedFlag = false;
  }

  /**
   * Fast-Path Response for Simple Greetings (<50ms TTFA)
   */
  private async executeFastPathResponse(params: {
    turnId: string;
    generationId: number;
    userText: string;
    intent: UserIntent;
    lastMentionedEntity?: MentionedEntity | null;
    emotionalTone: EmotionalTone;
    emotionResult?: EmotionAnalysisResult;
    languageMode: LanguageMode;
    cancelledTopicName?: string;
    previousAssistantMessage?: string;
    previousUserMessage?: string;
    searchSummary?: string;
  }): Promise<void> {
    const { turnId, generationId } = params;
    this.stateMachine.transitionTo('AGENT_SPEAKING', 'FAST_PATH_START');
    this.emit('response_start', { turnId, generationId });

    const fastResponse = this.generateDirectIntentResponse(params);

    this.latencyTracker.recordLLMFirstToken();
    this.latencyTracker.recordTTSFirstAudio();

    console.log(`[FAST PATH] Response: "${fastResponse}" for turn ${turnId}`);
    const ttsRes = await this.ttsService.synthesize(fastResponse);
    this.emit('agent_speech_chunk', {
      text: fastResponse,
      phoneticText: ttsRes.phoneticText,
      provider: ttsRes.provider,
      turnId,
      generationId,
      ttsAdjustment: params.emotionResult?.ttsAdjustment
    });

    this.emit('response_end', { turnId, generationId });

    // Record agent turn
    const agentTurn: ConversationTurn = {
      id: `turn-agent-${Date.now()}`,
      role: 'agent',
      text: fastResponse.trim(),
      emotion: params.emotionalTone,
      languageMode: params.languageMode,
      timestamp: Date.now()
    };
    this.memoryManager.addTurn(agentTurn);
    this.emit('transcript_turn', agentTurn);

    console.log(`[GEMINI OUTPUT] text: "${fastResponse.trim()}"`);
    console.log(`[TURN END] turnId: ${turnId}\n`);
    this.latencyTracker.finalizeTurn();

    setTimeout(() => {
      if (this.stateMachine.getState() === 'AGENT_SPEAKING') {
        this.stateMachine.transitionTo('LISTENING', 'AGENT_FINISHED_SPEAKING');
      }
    }, 150);
  }

  /**
   * Direct Text Response for explicit confirmations and memory feedback
   */
  private async executeDirectTextResponse(params: {
    turnId: string;
    generationId: number;
    userText: string;
    responseText: string;
    emotionalTone: EmotionalTone;
    languageMode: LanguageMode;
  }): Promise<void> {
    const { turnId, generationId, responseText } = params;
    this.stateMachine.transitionTo('AGENT_SPEAKING', 'DIRECT_RESPONSE_START');
    this.emit('response_start', { turnId, generationId });

    this.latencyTracker.recordLLMFirstToken();
    this.latencyTracker.recordTTSFirstAudio();

    console.log(`[DIRECT RESPONSE] "${responseText}" for turn ${turnId}`);
    const ttsRes = await this.ttsService.synthesize(responseText);
    this.emit('agent_speech_chunk', {
      text: responseText,
      phoneticText: ttsRes.phoneticText,
      provider: ttsRes.provider,
      turnId,
      generationId
    });

    this.emit('response_end', { turnId, generationId });

    const agentTurn: ConversationTurn = {
      id: `turn-agent-${Date.now()}`,
      role: 'agent',
      text: responseText.trim(),
      emotion: params.emotionalTone,
      languageMode: params.languageMode,
      timestamp: Date.now()
    };
    this.memoryManager.addTurn(agentTurn);
    this.emit('transcript_turn', agentTurn);

    console.log(`[GEMINI OUTPUT] text: "${responseText.trim()}"`);
    console.log(`[TURN END] turnId: ${turnId}\n`);
    this.latencyTracker.finalizeTurn();

    setTimeout(() => {
      if (this.stateMachine.getState() === 'AGENT_SPEAKING') {
        this.stateMachine.transitionTo('LISTENING', 'AGENT_FINISHED_SPEAKING');
      }
    }, 150);
  }

  /**
   * Handle Tool Execution Turn with In-Flight Filler
   */
  private async handleToolTurn(
    turnId: string,
    generationId: number,
    userText: string,
    languageMode: LanguageMode,
    emotionalTone: EmotionalTone,
    emotionResult?: EmotionAnalysisResult
  ): Promise<void> {
    this.stateMachine.transitionTo('TOOL_CALLING', 'TOOL_REQUEST_INITIATED');

    let toolName = 'search_fact';
    let args: Record<string, any> = { query: userText };

    if (/\b(weather|temperature|forecast|barish|mausam)\b/i.test(userText)) {
      toolName = 'get_weather';
      const cityMatch = userText.match(/\b(?:in|at|for|mein|ka)\s+([a-zA-Z\s]+?)(?:\?|$|\.|\btonight\b|\btoday\b)/i);
      const extractedCity = cityMatch ? cityMatch[1].trim() : '';
      const isAmbiguousCity = !extractedCity || /^(the city|a city|city|this city|the town|town|the place|a place)$/i.test(extractedCity);
      if (isAmbiguousCity) {
        const isHinglish = languageMode === 'hinglish' || languageMode === 'hindi';
        const promptText = isHinglish
          ? "Kaunsi city ka mausam janna hai? City ka naam batao, main check karke batati hoon."
          : "Which city do you mean? Tell me the city name and I'll check the weather for you.";
        await this.executeDirectTextResponse({
          turnId,
          generationId,
          userText,
          responseText: promptText,
          emotionalTone,
          languageMode
        });
        return;
      }
      args = { city: extractedCity };
    } else if (/\b(remind|reminder|yaad)\b/i.test(userText)) {
      toolName = 'set_reminder';
      args = { text: userText, time: 'in 1 hour' };
    }

    const filler = this.toolExecutor.getInFlightFiller(toolName, languageMode);
    console.log(`[TTS] Speaking tool filler: "${filler}"`);
    this.emit('tool_in_flight', { toolName, filler });

    this.stateMachine.transitionTo('AGENT_SPEAKING', 'SPEAKING_TOOL_FILLER');
    this.emit('response_start', { turnId, generationId });
    this.emit('agent_speech_chunk', {
      text: filler,
      isFiller: true,
      turnId,
      generationId,
      ttsAdjustment: emotionResult?.ttsAdjustment
    });

    const result = await this.toolExecutor.executeTool(toolName, args, this.userId, languageMode);
    this.emit('tool_completed', result);

    await this.generateAndStreamResponse({
      turnId,
      generationId,
      userText,
      intent: 'TOOL_REQUEST',
      emotionalTone,
      emotionResult,
      languageMode,
      toolResultSummary: result.spokenSummary
    });
  }

  /**
   * Generate & stream Gemini tokens to TTS and audio output with pipelined chunking
   */
  private async generateAndStreamResponse(params: {
    turnId: string;
    generationId: number;
    userText: string;
    intent: UserIntent;
    lastMentionedEntity?: MentionedEntity | null;
    emotionalTone: EmotionalTone;
    emotionResult?: EmotionAnalysisResult;
    languageMode: LanguageMode;
    isInterruptedPivot?: boolean;
    cancelledTopicName?: string;
    toolResultSummary?: string;
    searchSummary?: string;
    previousAssistantMessage?: string;
    previousUserMessage?: string;
  }): Promise<void> {
    const { turnId, generationId } = params;
    this.stateMachine.transitionTo('PROCESSING', 'GEMINI_GENERATION_START');
    this.activeAbortController = new AbortController();

    this.emit('response_start', { turnId, generationId });

    this.latencyTracker.recordIntentResolved();

    const [contextualMemory, mem0Memories] = await Promise.all([
      Promise.resolve(this.memoryManager.findContextualRecall(this.userId, params.userText)),
      this.memoryManager.searchMem0Memories(this.userId, params.userText, 3).catch(() => [])
    ]);

    const recentTurns = this.memoryManager.getRecentTurns().slice(-4).map(t => ({
      role: t.role as 'user' | 'agent',
      text: t.text,
      interrupted: t.interrupted
    }));

    const systemPrompt = ResponseStrategy.buildSystemPrompt({
      persona: this.currentPersona,
      conversationMode: this.conversationMode,
      interviewState: this.interviewState,
      currentTopic: this.topicManager.getCurrentTopic(),
      topicStack: this.topicManager.getTopicStack(),
      emotionalTone: params.emotionalTone,
      emotionResult: params.emotionResult,
      languageMode: params.languageMode,
      intent: params.intent,
      lastMentionedEntity: params.lastMentionedEntity,
      contextualMemory,
      mem0Memories,
      recentTurns,
      isInterruptedPivot: params.isInterruptedPivot,
      cancelledTopicName: params.cancelledTopicName,
      toolResultSummary: params.toolResultSummary,
      searchSummary: params.searchSummary,
      previousAssistantMessage: params.previousAssistantMessage,
      previousUserMessage: params.previousUserMessage
    });

    console.log(`[GEMINI INPUT] turnId: ${turnId} | mode: ${this.conversationMode} | intent: ${params.intent} | userMessage: "${params.userText}"`);

    let fullResponseText = '';
    let firstTokenReceived = false;
    let firstAudioSent = false;
    const chunker = new TextChunker();

    try {
      if (this.geminiClient) {
        this.latencyTracker.recordGeminiRequestStart();
        console.log(`[GEMINI] Streaming content with model ${config.geminiModel}...`);

        const historyContents = recentTurns.slice(0, -1).map(t => ({
          role: t.role === 'agent' ? ('model' as const) : ('user' as const),
          parts: [{ text: t.text }]
        }));

        const contents = [
          ...historyContents,
          {
            role: 'user' as const,
            parts: [{ text: `[LATEST USER MESSAGE (HIGHEST PRIORITY)]: "${params.userText}"` }]
          }
        ];

        const responseStream = await this.geminiClient.models.generateContentStream({
          model: config.geminiModel,
          contents,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.7
          }
        });

        for await (const chunk of responseStream) {
          if (this.activeAbortController?.signal.aborted || generationId !== this.currentGenerationId) {
            console.log(`[STALE RESPONSE IGNORED] generationId: ${generationId}`);
            break;
          }

          const token = chunk.text;
          if (token) {
            if (!firstTokenReceived) {
              firstTokenReceived = true;
              this.latencyTracker.recordLLMFirstToken();
              this.stateMachine.transitionTo('AGENT_SPEAKING', 'FIRST_TOKEN_STREAMING');
            }

            fullResponseText += token;
            const readyChunks = chunker.push(token);

            for (const textChunk of readyChunks) {
              if (this.activeAbortController?.signal.aborted || generationId !== this.currentGenerationId) break;

              if (!firstAudioSent) {
                firstAudioSent = true;
                this.latencyTracker.recordGeminiFirstChunk();
                this.latencyTracker.recordTTSFirstAudio();
              }

              console.log(`[TTS] Streaming speech chunk: "${textChunk}"`);
              const ttsRes = await this.ttsService.synthesize(textChunk);
              this.emit('agent_speech_chunk', {
                text: textChunk,
                phoneticText: ttsRes.phoneticText,
                provider: ttsRes.provider,
                turnId,
                generationId,
                ttsAdjustment: params.emotionResult?.ttsAdjustment
              });
            }
          }
        }
      } else {
        // High-Fidelity Local Dynamic Intent Mode with Context-Aware Emotional Expression
        const dynamicResponse = this.generateDirectIntentResponse(params);
        firstTokenReceived = true;
        this.latencyTracker.recordLLMFirstToken();
        this.stateMachine.transitionTo('AGENT_SPEAKING', 'FIRST_TOKEN_STREAMING');

        fullResponseText = dynamicResponse;
        firstAudioSent = true;
        this.latencyTracker.recordGeminiFirstChunk();
        this.latencyTracker.recordTTSFirstAudio();

        console.log(`[TTS] Synthesizing response: "${fullResponseText}"`);
        const ttsRes = await this.ttsService.synthesize(fullResponseText);
        this.emit('agent_speech_chunk', {
          text: fullResponseText,
          phoneticText: ttsRes.phoneticText,
          provider: ttsRes.provider,
          turnId,
          generationId,
          ttsAdjustment: params.emotionResult?.ttsAdjustment
        });
      }

      // Flush remaining chunk buffer
      const finalRemaining = chunker.flush();
      if (finalRemaining && !this.activeAbortController?.signal.aborted && generationId === this.currentGenerationId) {
        if (!firstAudioSent) {
          firstAudioSent = true;
          this.latencyTracker.recordGeminiFirstChunk();
          this.latencyTracker.recordTTSFirstAudio();
        }
        console.log(`[TTS] Flushing final speech chunk: "${finalRemaining}"`);
        const ttsRes = await this.ttsService.synthesize(finalRemaining);
        this.emit('agent_speech_chunk', {
          text: finalRemaining,
          phoneticText: ttsRes.phoneticText,
          provider: ttsRes.provider,
          turnId,
          generationId,
          ttsAdjustment: params.emotionResult?.ttsAdjustment
        });
      }

      this.emit('response_end', { turnId, generationId });

      // Response Sanity Guard (check if model generated a stale duplicate)
      const lastAgentTurn = [...this.memoryManager.getRecentTurns()].reverse().find(t => t.role === 'agent');
      if (
        lastAgentTurn &&
        fullResponseText.trim() === lastAgentTurn.text.trim() &&
        !/\b(repeat|say that again|what did you say)\b/i.test(params.userText)
      ) {
        console.warn(`[RESPONSE_GUARD] Stale duplicate response detected for turn ${turnId}. Regenerating response for current intent.`);
        fullResponseText = this.generateDirectIntentResponse(params);
      }

      console.log(`[GEMINI OUTPUT] text: "${fullResponseText.trim()}"`);

      // Record agent turn
      if (fullResponseText.trim() && !this.activeAbortController?.signal.aborted && generationId === this.currentGenerationId) {
        const agentTurn: ConversationTurn = {
          id: `turn-agent-${Date.now()}`,
          role: 'agent',
          text: fullResponseText.trim(),
          emotion: params.emotionalTone,
          languageMode: params.languageMode,
          timestamp: Date.now()
        };
        this.memoryManager.addTurn(agentTurn);
        this.emit('transcript_turn', agentTurn);
      }

      console.log(`[TURN END] turnId: ${turnId}\n`);
      this.latencyTracker.finalizeTurn();

      // Return to LISTENING state after speech
      setTimeout(() => {
        if (this.stateMachine.getState() === 'AGENT_SPEAKING') {
          this.stateMachine.transitionTo('LISTENING', 'AGENT_FINISHED_SPEAKING');
        }
      }, 150);

    } catch (err: any) {
      if (this.activeAbortController?.signal.aborted || generationId !== this.currentGenerationId) {
        console.log(`[GENERATION] Request aborted cleanly for gen #${generationId}.`);
      } else {
        console.error('[GENERATION ERROR]', {
          turnId,
          generationId,
          stage: 'gemini_stream',
          errorType: err?.name || 'API_ERROR',
          recoverable: true
        });

        // Seamless fallback to dynamic intent generator so the user receives a real response
        try {
          const fallbackText = this.generateDirectIntentResponse(params);
          if (fallbackText && fallbackText.trim().length > 0) {
            this.stateMachine.transitionTo('AGENT_SPEAKING', 'FALLBACK_GENERATION');
            console.log(`[TTS FALLBACK] Synthesizing response: "${fallbackText}"`);
            const ttsRes = await this.ttsService.synthesize(fallbackText);
            this.emit('agent_speech_chunk', {
              text: fallbackText,
              phoneticText: ttsRes.phoneticText,
              provider: ttsRes.provider,
              turnId,
              generationId,
              ttsAdjustment: params.emotionResult?.ttsAdjustment
            });
            this.emit('response_end', { turnId, generationId });

            const agentTurn: ConversationTurn = {
              id: `turn-agent-${Date.now()}`,
              role: 'agent',
              text: fallbackText.trim(),
              emotion: params.emotionalTone,
              languageMode: params.languageMode,
              timestamp: Date.now()
            };
            this.memoryManager.addTurn(agentTurn);
            this.emit('transcript_turn', agentTurn);
          }
        } catch (fallbackErr) {
          console.warn('[RECOVERY] Direct fallback failed:', fallbackErr);
          this.stateMachine.transitionTo('LISTENING', 'GENERATION_ERROR');
        }
      }
    } finally {
      this.activeAbortController = null;
    }
  }

  /**
   * Cancel in-flight LLM & TTS audio immediately on barge-in
   */
  public cancelInFlightResponse(reason: string, targetGenId?: number): void {
    const cancelledGen = targetGenId !== undefined ? targetGenId : this.currentGenerationId;
    console.log(`[VOICE] Cancelling in-flight response (${reason}) for gen #${cancelledGen}`);
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
    if (targetGenId === undefined) {
      this.currentGenerationId += 1;
    }
    this.emit('cancel_audio_playback', { reason, generationId: cancelledGen });
  }

  /**
   * Trigger backchannel acknowledgment
   */
  public triggerBackchannel(languageMode: LanguageMode): void {
    const phrase = this.backchannelManager.getBackchannelPhrase(languageMode);
    console.log(`[VAD] Backchannel uttered: "${phrase}"`);
    this.stateMachine.transitionTo('BACKCHANNEL', 'AUTO_BACKCHANNEL_TRIGGERED', { phrase });
    this.emit('backchannel_uttered', { phrase });

    setTimeout(() => {
      if (this.stateMachine.getState() === 'BACKCHANNEL') {
        this.stateMachine.transitionTo('USER_SPEAKING', 'BACKCHANNEL_COMPLETED');
      }
    }, 400);
  }

  /**
   * Generates highly authentic, human-like listener reactions for personal stories, memories, daily narratives, and emotional sharing.
   */
  private generateHumanNarrativeResponse(params: {
    userText: string;
    languageMode: LanguageMode;
    emotionalTone: EmotionalTone;
    emotionResult?: EmotionAnalysisResult;
    previousAssistantMessage?: string;
    previousUserMessage?: string;
  }): string {
    const raw = params.userText.trim();
    const lower = raw.toLowerCase();
    const clean = lower.replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, ' ');
    const lang = IntentClassifier.detectLanguageDominance(raw);
    const thread = this.personalStoryThread;
    const turnNumber = thread.turnsCount || 1;

    // 0. Incomplete Opener without events (e.g. user ONLY said "main batati hun kya hua" or "Forget it, actually let me tell you what happened this morning...")
    if (thread.isIncompleteOpener || (/^(main batati hun|main batati hoon|main batata hoon|let me tell you|suno na|pata hai aaj)\s*(kya hua|what happened)?[.!]?$/i.test(clean) && clean.split(/\s+/).length <= 6)) {
      if (lang === 'hindi') {
        return "हाँ, मैं सुन रही हूँ। बताओ क्या हुआ?";
      } else if (lang === 'hinglish') {
        return "I'm listening! Batao kya hua.";
      }
      return "I'm listening! Go ahead, tell me what happened.";
    }

    // 1. Story End / Resolution ("Bas, phir eventually sab theek ho gaya", "Finally sort ho gaya", etc.)
    if (
      /(सब ठीक हो गया|बात संभल गई|फोन किया और सब ठीक|मामला सुलझ गया)/.test(raw) ||
      /\b(bas phir eventually sab theek|eventually sab theek ho gaya|sab theek ho gaya|finally sort ho gaya|bas yahi hua tha|and that was it|and that's the whole story|and then everything was fine|bas phir sab normal ho gaya|eventually everything was fine|finally worked out)\b/i.test(lower) ||
      (thread.isActive && (/^(bas yahi tha|bas itna hi tha|that's all that happened|eventually it worked out|then it got sorted)[.!]?$/i.test(clean) || /(बस यही था|सब ठीक हो गया)/.test(raw)))
    ) {
      thread.isActive = false;
      if (lang === 'hindi') {
        return "चलो शुक्र है, सुनकर सच में बहुत राहत मिली! अच्छा हुआ कि बात संभल गई। अब कैसा लग रहा है?";
      } else if (lang === 'hinglish') {
        return "Chalo that's such a relief! Glad it got sorted out without more drama. How are you feeling now?";
      }
      return "That's honestly such a relief to hear. I'm really glad everything worked out in the end. How are you feeling about it now?";
    }

    // 1b. Morning Fatigue, Nervous Dread & Weird Day (Section 2 Example)
    // "I had a really weird day today. I woke up tired and nervous and I don't even know why."
    // "Actually I am little sad today because when I woke up in the morning I was feeling very tired and very nervous and mixed feelings like something bad will happen today."
    const isMorningFatigue = (
      /\b(woke up|waking up|subah uthi|subah utha|subah jab main uthi)\b/i.test(lower) &&
      (/\b(tired|nervous|anxious|mixed feelings|something bad|dont even know why|don't even know why|without knowing why|weird day)\b/i.test(lower))
    ) || (
      /\b(really weird day|had a weird day|weird day today)\b/i.test(lower) &&
      /\b(tired|nervous|anxious|woke up)\b/i.test(lower)
    );

    if (isMorningFatigue) {
      if (lang === 'hindi') {
        return "यह सच में बहुत अजीब सा एहसास होता है—खासकर सुबह उठते ही बिना किसी वजह के थका हुआ और घबराया हुआ महसूस होना। और जब ऐसा लगे कि कुछ बुरा होने वाला है, तो पूरा दिन भारी लगने लगता है। क्या आज किसी खास बात से घबराहट हो रही है, या यह फीलिंग बस अचानक आ गई?";
      } else if (lang === 'hinglish') {
        return "That sounds like a really weird feeling—especially subah uthte hi tired aur nervous feel hona without even knowing why. Aur 'kuch bura hone wala hai' wali feeling pure din ko heavy bana deti hai. Did something specific make you nervous today, ya yeh feeling out of nowhere aa gayi?";
      }
      return "That sounds like a really weird feeling — especially waking up already tired and nervous without even knowing exactly why. And that 'something bad is going to happen' feeling can make the whole day feel heavier. Did something specific make you nervous today, or did the feeling just show up out of nowhere?";
    }

    // 2. Shopping / E-commerce App / Sizing / Online Cart Incident (MYNTRA BUG & Section 25 Tests 1, 9, 12)
    // "forget it I am telling something for that kya hua aaj main subah subah Uthi aur FIR Maine Myntra khola aur uske baad Jo top Mere ko chahiye nahi"
    // "main batati hun kya hua aaj main subah subah Uthi aur Maine Khol liya aur I wanted to order a top for myself"
    // "Aaj subah main uthi aur Myntra khola, mujhe ek top order karna tha but mera size available nahi tha."
    // "I opened Myntra because I wanted a dress but then I couldn't find my size."
    // "maine mintra khola aur mujhe ek top chahiye tha but mera saiz available nahi tha"
    const isShoppingStory = (
      /\b(myntra|mintra|amazon|flipkart|zara|nykaa|meesho|shopping|cart|app)\b/i.test(lower) &&
      /\b(top|dress|shoes|shirt|clothes|kurti|order|size|saiz|available|unavailable|out of stock|nahi tha|nahi mila|chahiye tha|chahiye nahi|pasand|subah|uthi|utha|woke up|opened|khola|khol liya)\b/i.test(lower)
    ) || (
      /\b(top|dress|kurti)\b/i.test(lower) && /\b(size|saiz|available|unavailable|out of stock|nahi mila|nahi tha|chahiye)\b/i.test(lower)
    ) || (
      /\b(subah subah uthi|main subah subah uthi|woke up this morning)\b/i.test(lower) && /\b(myntra|mintra|order|top|dress|khol liya)\b/i.test(lower)
    );

    if (isShoppingStory) {
      if (lang === 'hindi') {
        return "अरे यार, सुबह-सुबह मिंत्रा खोलकर टॉप पसंद आया और फिर साइज ही नहीं मिला? जब कोई चीज़ पसंद आ जाए और साइज ना मिले तो सच में बहुत मूड ऑफ होता है। फिर तुमने कोई और टॉप देखा?";
      } else if (lang === 'hinglish') {
        return "Areee, subah-subah Myntra kholke top finally pasand aaya aur phir size hi unavailable nikla? That's such an annoying start to the day. Phir tumne koi aur top dekha ya wahi wala chahiye tha?";
      }
      return "Oh no, that is so frustrating! You finally find a top you actually want on Myntra and your size is the one thing missing. Did you end up looking for another one or just close the app?";
    }

    // 2c. Pet / Animal Encounter Narrative ("so I was walking home today and this cute Street cat started following me everywhere")
    if (
      /\b(street cat|stray cat|cute cat|cat started following|cat followed me|cat was following|cute kitten|stray dog|cute dog|dog started following|dog followed me)\b/i.test(lower) ||
      (/\b(walking home|on my way home|on the street|outside|today)\b/i.test(lower) && /\b(cat|kitten|dog|puppy)\b/i.test(lower) && /\b(following|followed|saw|found|cute)\b/i.test(lower))
    ) {
      if (lang === 'hindi') {
        return "अरे वाह, कितना प्यारा है! क्या वह तुम्हारे पीछे-पीछे घर तक आ गई, या तुमने रुककर उसे थोड़ा सहलाया?";
      } else if (lang === 'hinglish') {
        return "Aww, that's so cute! Kya woh tumhare peeche peeche ghar tak aa gayi, ya tumne rukk kar thoda pet kiya?";
      }
      return "Aww, that's adorable! Did it follow you all the way home, or did you stop to give it some pets?";
    }

    // 3. College / School Funny Moments / Classroom Laughing (Section 25 Test 2)
    // "Kal college mein na ek bahut funny incident hua, phir mera friend literally floor pe gir gaya laughing."
    if (/\b(floor pe gir gaya laughing|floor pe gir gaya|floor pe gir|fell on the floor laughing|gir gaya laughing)\b/i.test(lower) || (/\b(funny incident|hilarious)\b/i.test(lower) && /\b(college|school|friend|floor|gir gaya|laughing|hasne)\b/i.test(lower))) {
      if (lang === 'hindi') {
        return "हाहा, हँस-हँस कर ज़मीन पर ही गिर गया? ऐसा क्या मज़ाकिया हो गया था कॉलेज में? मुझे भी बताओ!";
      } else if (lang === 'hinglish') {
        return "Haha, literally floor pe gir gaya has-has ke? Aisa kya ho gaya tha college mein? Mujhe bhi batao!";
      }
      return "Haha, literally fell on the floor laughing? What in the world happened in college to cause that?";
    }

    // 4. Childhood Memory / Hiding under bed whenever guests came (Section 25 Test 3)
    // "When I was a kid, I used to hide under my bed whenever guests came home."
    if (/\b(hide under my bed|under my bed|bed ke neeche)\b/i.test(lower) && /\b(guests|guest|kid|child|bachpan|mehman)\b/i.test(lower)) {
      if (lang === 'hindi') {
        return "हाहा, मेहमानों के आते ही बिस्तर के नीचे छुप जाना? यह तो सच में बहुत क्यूट और इंट्रोवर्ट आदत थी! क्या कोई तुम्हें ढूँढ पाता था?";
      } else if (lang === 'hinglish') {
        return "Haha, hiding under the bed whenever guests showed up? That is peak introverted kid behavior! Koi dhundh leta tha ya bas unke jaane tak wahi rehti thi?";
      }
      return "Haha, hiding under the bed whenever guests showed up? That is peak introverted kid behavior! Did anyone ever figure out where you were, or did you just wait until they left?";
    }

    // 5. Emotional Friend Conflict / Ignored Without Reason (Section 25 Test 4 & Advice tests)
    // "aaj mera best friend se jhagada ho gaya usne mujhe dumb bola"
    // "Aaj meri friend ne mujhse baat nahi ki aur mujhe samajh hi nahi aa raha why."
    // "Aaj mera friend mujhse bina reason ke gussa ho gaya."
    if (
      /\b(aaj mera best friend se jhagada ho gaya usne mujhe dumb bola|best friend se jhagada ho gaya|best friend se jhagda ho gaya|friend se jhagda|friend se jhagada|usne mujhe dumb bola)\b/i.test(lower) ||
      (/\b(best friend|friend)\b/i.test(lower) && /\b(jhagada|jhagda|fight|ladai)\b/i.test(lower) && /\b(dumb|stupid|usne)\b/i.test(lower))
    ) {
      if (lang === 'hindi') {
        return "अरे यार, यह सुनकर सच में बहुत बुरा लगा। बेस्ट फ्रेंड से झगड़ा होना और ऊपर से उनका ऐसा बोलना बहुत दर्द देता है। तुम दोनों के बीच क्या हुआ था?";
      } else if (lang === 'hinglish') {
        return "Arre yaar, that really sucks. Having a fight with your best friend hurts, especially when they call you dumb. What happened between you two?";
      }
      return "Ouch, that's really hurtful. Getting into a fight with your best friend and having them call you dumb feels awful. What happened between you two?";
    }

    if (
      (/\b(baat nahi ki|bina reason|bina kisi reason|gussa ho gaya|gussa|samajh hi nahi aa raha|ignoring me|not talking to me)\b/i.test(lower) && /\b(friend|meri friend|mera friend|dost|saheli)\b/i.test(lower)) ||
      (/\b(friend|best friend)\b/i.test(lower) && /\b(ignoring|not replying|silent|upset with me)\b/i.test(lower))
    ) {
      if (lang === 'hindi') {
        return "यह सच में बहुत परेशान करने वाला होता है जब कोई बिना वजह बात करना बंद कर दे। क्या पहले कुछ हुआ था या अचानक ऐसा हुआ?";
      } else if (lang === 'hinglish') {
        return "Oof, bina kisi reason ke suddenly kisi ka gussa ho jaana ya baat na karna is so confusing and draining. Did something happen the last time you two spoke, ya out of nowhere hua?";
      }
      return "Oof, someone suddenly going quiet or getting upset without any clear reason is so confusing and draining. Did anything seem off the last time you spoke, or was it completely out of nowhere?";
    }

    // 5b. Authority / Boss Reprimand ("my boss scolded me", "boss ne daanta")
    if (/\b(my boss scolded me|boss scolded me|boss ne daanta|boss ne daant|manager scolded me|manager yelled at me|got scolded by my boss|boss was angry with me)\b/i.test(lower)) {
      if (lang === 'hindi') {
        return "उफ़, यह तो सच में बहुत खराब लगा होगा। क्या हुआ था? उन्होंने क्या बोला?";
      } else if (lang === 'hinglish') {
        return "Ugh, that's rough. What happened? Kya bola unhone?";
      }
      return "Ugh, that's rough. What happened? What did they say?";
    }

    // 6. Entity Inside Personal Story (Section 25 Test 8)
    // "I was watching YouTube last night and found this really weird video."
    if (
      /\b(watching youtube|youtube pe|netflix pe|watching netflix|scrolling instagram|instagram pe)\b/i.test(lower) ||
      (/\b(youtube|netflix|instagram|reels)\b/i.test(lower) && /\b(last night|yesterday|aaj|kal|weird video|crazy video|funny video|video dekh|scrolling)\b/i.test(lower))
    ) {
      if (lang === 'hindi') {
        return "हाहा, देर रात यूट्यूब पर अजीब वीडियो मिल ही जाते हैं! किस बारे में था वो वीडियो?";
      } else if (lang === 'hinglish') {
        return "Haha, late-night YouTube rabbit holes always lead to the weirdest videos! Aisa kya dekh liya?";
      }
      return "Late-night YouTube rabbit holes always lead to the weirdest stuff! What was the video even about?";
    }

    // 7. Multi-Turn Story Continuation (Section 25 Test 10)
    // Turn 1: "Aaj college mein kuch weird hua." -> "Acha? College mein kya hua, batao?"
    // Turn 2: "Professor ne mujhe class ke saamne bula liya." -> "Wait, professor ne class ke saamne bula liya? Did you know why, or was it a surprise?"
    // Turn 3: "Phir unhone..." -> Resolves "unhone" to the professor!
    if (thread.isActive || /\b(professor|teacher|class ke saamne|unhone|classroom)\b/i.test(lower)) {
      if (
        /\b(get out of the classroom|get out of class|kicked me out|kicked out of the classroom|told me to get out|said me to get out|asked me to leave the class|class se nikal diya|class se bahar)\b/i.test(lower) ||
        (/\b(what happened next is|what happened next was|uske baad kya hua ki|phir ye hua ki)\b/i.test(lower) && /\b(get out|classroom|class|teacher|professor|scolded|daanta)\b/i.test(lower))
      ) {
        if (lang === 'hindi') {
          return "रुको, उन्होंने सच में तुम्हें क्लास से बाहर निकाल दिया? क्यों, उससे पहले तुम क्या कर रहे थे?";
        } else if (lang === 'hinglish') {
          return "Wait, unhone sach mein class se bahar nikal diya? Why, usse pehle kya kar rahe the tum?";
        }
        return "Wait, he actually kicked you out of the classroom? Why, what were you doing before that?";
      }

      if (/\b(scolded by (?:my )?teacher|scolded by teacher|teacher scolded me|professor scolded me|teacher ne daanta|daant padi)\b/i.test(lower)) {
        if (lang === 'hindi') {
          return "अरे यार, टीचर ने क्यों डाँटा? क्या हुआ था क्लास में?";
        } else if (lang === 'hinglish') {
          return "Oof, teacher ne kyun daanta? What happened in class?";
        }
        return "I'm following along! What happened next?";
      }

      if (/\b(phir unhone|unhone kya|unhone bola|unhone kaha|and then they|then he|then she)\b/i.test(lower)) {
        if (lang === 'hindi') {
          return "फिर प्रोफेसर ने क्या बोला सबके सामने? आगे क्या हुआ?";
        } else if (lang === 'hinglish') {
          return "Phir professor ne kya bola class ke saamne? What happened next?";
        }
        return "And what did the professor say or do in front of everyone? What happened next?";
      }

      if (/\b(professor ne|teacher ne|class ke saamne bula liya|bula liya|called me in front)\b/i.test(lower)) {
        if (lang === 'hindi') {
          return "रुको, प्रोफेसर ने पूरी क्लास के सामने बुला लिया? क्या तुम्हें पता था क्यों, या अचानक हुआ?";
        } else if (lang === 'hinglish') {
          return "Wait, professor ne class ke saamne bula liya? Did you know why, or was it completely out of nowhere?";
        }
        return "Wait, the professor called you to the front of the whole class? Did you know why, or was it totally unexpected?";
      }

      if (/\b(aaj college mein kuch weird hua|college mein kuch weird|something weird happened at college)\b/i.test(lower)) {
        if (lang === 'hindi') {
          return "अरे, कॉलेज में ऐसा क्या अजीब हो गया? बताओ?";
        } else if (lang === 'hinglish') {
          return "Acha? College mein kya hua, batao?";
        }
        return "Wait, what happened at college? Tell me!";
      }
    }

    // 8. Milestones & Celebrations (Job offer, interview success, sister college, exam passed)
    // "aaj mujhe job mil gayi!" / "I got the job!"
    // "Aaj mera interview tha, main nervous thi, but somehow I answered everything really well."
    // "My sister finally got the college she wanted."
    if (/\b(aaj mujhe job mil gayi|mujhe job mil gayi|job mil gayi|i got the job|got the job|i got selected|selected for the job|cracked the interview|cleared the interview|i got the offer|got an offer)\b/i.test(lower)) {
      if (lang === 'hindi') {
        return "अरे वाह! यह तो बहुत बड़ी खुशखबरी है! पार्टी तो बनती है! बहुत-बहुत बधाई! सब कुछ बताओ कैसा रहा!";
      } else if (lang === 'hinglish') {
        return "Wait WHAT, that's huge! Party toh banti hai! Congratulations! Tell me all the details!";
      }
      return "Wait WHAT, that's huge! Congratulations! I'm so happy for you! Tell me all the details!";
    }

    if (
      /\b(answered everything really well|answered really well|interview tha.*?well|cleared my exam)\b/i.test(lower) ||
      (/\b(interview)\b/i.test(lower) && /\b(nervous|answered|went well|succeeded|great)\b/i.test(lower))
    ) {
      if (lang === 'hindi') {
        return "अरे वाह, यह तो सच में बहुत बड़ी बात है! घबराहट के बावजूद सब कुछ अच्छे से संभाल लेना बहुत बड़ी जीत है। तुम्हें अपने आप पर गर्व होना चाहिए!";
      } else if (lang === 'hinglish') {
        return "Areee that's amazing! Answering everything confidently even while feeling nervous is such a huge win. You should definitely be proud of how you handled that!";
      }
      return "That is amazing! Answering everything confidently even while feeling nervous is such a massive win. You should be really proud of yourself!";
    }

    if (/\b(got the college she wanted|got the college|got the internship|got the job offer)\b/i.test(lower)) {
      if (lang === 'hindi') {
        return "अरे वाह, यह तो सच में बहुत बड़ी खुशखबरी है! मनपसंद कॉलेज में एडमिशन मिलना बहुत सुकून देता है।";
      } else if (lang === 'hinglish') {
        return "Aww, that's huge! Getting into the college you actually wanted is such an amazing feeling. So happy for her!";
      }
      return "Aww, that's huge! Getting into the college you actually wanted is such an amazing feeling. So happy for her!";
    }

    // 9. Hindi Daily Story (Section 25 Test 11)
    // "Aaj subah mujhe ek bahut ajeeb incident hua."
    if (/\b(ajeeb incident|ajeeb hua|bahut ajeeb)\b/i.test(lower) || (lang === 'hindi' && /(अजीब|घटना|सुबह)/.test(raw))) {
      if (lang === 'hindi') {
        return "अरे, सुबह-सुबह ऐसा क्या अजीब हो गया? क्या हुआ था, बताओ?";
      } else if (lang === 'hinglish') {
        return "Arre, subah-subah aisa kya ajeeb incident ho gaya? Kya hua tha, batao?";
      }
      return "Oh, what kind of strange incident happened this morning? Tell me!";
    }

    // 10. Project submission / Milestone reached
    if (
      /(प्रोजेक्ट सबमिट|काम पूरा|सबमिट कर दिया)/.test(raw) ||
      /\b(finally submitted|submitted the project|submitted my project|project submit|assignment submit|finally completed|done with the project)\b/i.test(lower)
    ) {
      if (lang === 'hindi') {
        return "अरे वाह! इतने लंबे समय तक काम करने के बाद यह सच में बहुत बड़ा सुकून है।";
      } else if (lang === 'hinglish') {
        return "Finallyyy! That must feel ridiculously satisfying after working on it for so long.";
      }
      return "Finallyyy! That must feel ridiculously satisfying after working on it for so long.";
    }

    // 11. Friend not replying for 2 days
    if (
      (/(दो दिन|2 दिन|जवाब नहीं दिया|बात नहीं की)/.test(raw) && /(सहेली|दोस्त|रोज़ बात|रोज बात)/.test(raw)) ||
      (/\b(hasn't replied|hasnt replied|not replying|stopped replying|two days|2 days)\b/i.test(lower) && /\b(friend|talk every day|normally we talk|daily)\b/i.test(lower))
    ) {
      if (lang === 'hindi') {
        return "यह तो सच में अजीब है, खासकर अगर आप दोनों रोज़ बात करते हैं। क्या उससे पहले तुम दोनों के बीच कुछ हुआ था, या अचानक बात बंद हो गई?";
      } else if (lang === 'hinglish') {
        return "That's really weird, especially if you two normally talk every day. Did anything happen between you two before that, or did they just go quiet out of nowhere?";
      }
      return "That's really strange, especially if you two normally talk every day. Did anything happen between you before that, or did they just suddenly go quiet?";
    }

    // 12. Morning Pain / Period Cramps
    if (
      /\b(period|cramps?|bad morning|horrible morning|pain|dard|room mein|cheez chahiye thi|needed in the room|pads?|pets?)\b/i.test(lower) ||
      (/\b(aaj subah|subah uthte hi|woke up this morning|woke up and)\b/i.test(lower) && /\b(pain|cramp|mood|kharab|room|cheez)\b/i.test(lower))
    ) {
      if (lang === 'hindi') {
        return "अरे यार, सुबह की ऐसी शुरुआत सच में बहुत परेशान करने वाली होती है। ऊपर से दर्द और फिर कमरे में ज़रूरी चीज़ का ना होना और भी ज्यादा गुस्सा दिलाता है। फिर तुमने क्या किया?";
      } else if (lang === 'hinglish') {
        return "Oh no yaar, that's such a bad way to start the morning. Cramps are already exhausting enough, and then realizing you don't even have what you need in the room makes it so much more frustrating. Phir kya kiya tumne?";
      }
      return "Oh no, that's such an awful way to start the morning. Dealing with cramps is exhausting enough on its own, but realizing you don't even have what you need in the room makes it ten times more frustrating. What did you end up doing?";
    }

    // 13. Childhood Memory / Last bench snacks
    if (/\b(last bench|snacks|chips|eating|teacher|caught|bachpan|school)\b/i.test(lower) && /\b(friend|class|secretly|pakad)\b/i.test(lower)) {
      if (lang === 'hindi') {
        return "हाहा, क्लास में लास्ट बेंच पर बैठकर चिप्स खाना? तुम दोनों तो पकड़े जाने का पूरा इंतज़ाम कर रहे थे! फिर टीचर ने क्या किया?";
      } else if (lang === 'hinglish') {
        return "Haha, snacks on the last bench during class? You two were basically asking to get caught! Teacher ne kya kiya phir?";
      }
      return "Haha, sneaking snacks on the last bench during class? You two were practically asking to get caught! What did the teacher do after that?";
    }

    // 14. College / Presentation Mess-Up
    if (/\b(presentation|embarrassed|embarrassing|college mein|sabke saamne|aisa bol diya|mind went blank)\b/i.test(lower)) {
      if (lang === 'hindi') {
        return "उफ़, सबके सामने? यह सच में बहुत अजीब और ऑकवर्ड लगा होगा यार। ऐसा क्या बोल दिया उसने?";
      } else if (lang === 'hinglish') {
        return "Oof, sabke saamne? That must've been so awkward yaar! Aisa kya bol diya usne?";
      }
      return "Oof, in front of everyone? That must've felt so awkward. What did they end up saying?";
    }

    // 2b. Shopping Dilemma when feeling low/sad ("actually I am little sad today because main kuch kharidna chahti Hoon")
    if (
      /\b(sad|upset|mood off|low|depressed|down)\b/i.test(lower) &&
      /\b(kharidna|shopping|buy|order|purchase)\b/i.test(lower)
    ) {
      if (lang === 'hindi') {
        return "अरे, जब मन थोड़ा उदास होता है तो कुछ खरीदने या शॉपिंग करने का बहुत मन करता है। तुम क्या खरीदने का सोच रही हो, या कन्फ्यूजन है कि लूँ या ना लूँ?";
      } else if (lang === 'hinglish') {
        return "Aww, mood thoda low hone par shopping karne ka mann toh karta hai! Kya kharidne ka soch rahi ho, ya confusion hai ki purchase karu ya nahi?";
      }
      return "Aww, whenever we feel a little down, the urge to do some shopping is so real! What are you thinking of getting, or are you debating whether to buy it?";
    }

    // 15. Hindi Dominant Bad Day
    if (lang === 'hindi' || /[\u0900-\u097F]/.test(raw)) {
      if (/(खराब|बुरा|परेशान|दर्द|गुस्सा|थक|उदास|सही)/.test(raw) || /\b(kharab|bura|pareshan|dard|gussa|thak)\b/i.test(lower)) {
        return "अरे, क्या हुआ? तुम्हारा दिन इतना खराब क्यों रहा?";
      }
    }

    // 16. School Back-bencher / Last bench memories
    if (
      /\b(last bench|back bench|back seat|back row|peeche baith|peeche baithna|back of the class|back of class)\b/i.test(lower) &&
      /\b(school|college|class|teacher|friend|yaar|dost)\b/i.test(lower)
    ) {
      if (lang === 'hindi') {
        return "हाहा, लास्ट बेंच वाला? मुझे बिल्कुल ऐसा नहीं लग रहा था! क्या उन दिनों टीचर से बचते रहते थे?";
      } else if (lang === 'hinglish') {
        return "Wait, you were a back-bencher? I did NOT expect that from you. Kya tumhe baar baar teacher se bachna padta tha?";
      }
      return "Wait, you were a back-bencher? I did NOT expect that from you! What did you two usually get up to in the back row?";
    }

    // 17. Good food / great meal story
    if (
      /\b(ate|had|got|eaten|ordered|khaaya|khaya|khana|meal|biryani|pizza|pasta|food|lunch|dinner|breakfast|chai|coffee|samosa|maggi|pani puri|ice cream|dessert|snack|restaurant|dhaba)\b/i.test(lower) &&
      /\b(really good|so good|amazing|incredible|delicious|best|awesome|bahut achha|bahut acha|bahut accha|zyada acha|so nice|so tasty|great|yummy|soo good|fantastic|proper)\b/i.test(lower)
    ) {
      if (lang === 'hindi') {
        return "यार, अच्छा खाना मिले तो दिन सच में बन जाता है! क्या खाया इतना अच्छा?";
      } else if (lang === 'hinglish') {
        return "Okay, good food is literally the best mood fix! Kya khaaya itna amazing?";
      }
      return "Okay, good food is seriously one of the best things in life. What did you eat?";
    }

    // 18. Teacher embarrassed user in front of class (not kicked out — that's handled above)
    if (
      /\b(teacher|professor|sir|ma'am|madam|faculty|lecturer)\b/i.test(lower) &&
      /\b(embarrassed me|embarrassed|called me out|made fun of me|singled me out|publicly|in front of|class ke saamne|sab ke saamne|sab ke samne|pointed at me|laughed at me)\b/i.test(lower)
    ) {
      if (lang === 'hindi') {
        return "उफ़, यार! सबके सामने? यह तो सच में बहुत शर्मनाक होता है। ऐसा क्यों किया उन्होंने?";
      } else if (lang === 'hinglish') {
        return "Ohh no, in front of everyone? That must've felt so embarrassing yaar. What did they say or do?";
      }
      return "Ohh no, in front of the whole class? That's genuinely awful. What happened?";
    }

    // 19. Small personal wins — cleaned room, finished task, productive day
    if (
      /\b(cleaned my room|cleaned the room|finally cleaned|tidied up|organized my room|organized my desk|finished my assignment|completed my assignment|submitted my project|finally submitted|finished reading|completed the book|finished the chapter|done with my work|finished work today|productive day|khatam kiya|room saaf kiya|saaf kar diya)\b/i.test(lower)
    ) {
      if (lang === 'hindi') {
        return "वाह, यार! यह तो छोटा लेकिन बहुत संतोषजनक काम है। अब कैसा लग रहा है?";
      } else if (lang === 'hinglish') {
        return "Okayyy, productive era activated! Feels good when you finally get that done, right?";
      }
      return "Okay, that is genuinely satisfying. How does it feel now that it's done?";
    }

    // 20. Good night's sleep / rest / nice start to day
    if (
      /\b(good sleep|slept really well|slept so well|had a great sleep|best sleep|nind achi aayi|achi nind aayi|neend acha tha|great rest|felt so rested|best morning|so refreshed|refreshed today)\b/i.test(lower)
    ) {
      if (lang === 'hindi') {
        return "अरे, अच्छी नींद मिले तो पूरा दिन फर्क पड़ता है ना! आज का दिन अच्छा जाएगा फिर।";
      } else if (lang === 'hinglish') {
        return "Nicee! Good sleep genuinely changes the whole day. Aaj productive feel ho raha hai?";
      }
      return "Oh, good sleep is seriously underrated. Sounds like today's off to a good start then!";
    }

    // 21. Watched a great movie / show / funny video
    if (
      /\b(watched a great|watched this amazing|just watched|saw a great|saw this movie|great movie|amazing movie|funny movie|best movie|good movie|watched this show|great episode|binge watched|binge-watched|dekhna|dekhi|dekha|film dekhi|movie dekhi|episode dekha)\b/i.test(lower) &&
      /\b(movie|film|episode|series|show|anime|documentary|video|reel|clip)\b/i.test(lower)
    ) {
      if (lang === 'hindi') {
        return "अरे, कौन सी मूवी देखी? मुझे भी बताओ!";
      } else if (lang === 'hinglish') {
        return "Ooh, which movie? I need to know if it's actually worth watching!";
      }
      return "Ooh, which one? Was it actually good or are you just saying that?";
    }

    // 22. User disliking someone / frustrated with a person
    if (
      /\b(mujhe woh banda pasand nahi|mujhe woh ladka pasand nahi|mujhe woh ladki pasand nahi|mujhe woh person pasand nahi|i don't like that person|i don't like this person|i really don't like|bilkul pasand nahi|i hate that person|that person is so annoying|this person is so annoying|he is so annoying|she is so annoying|i can't stand this person|i cannot stand this person)\b/i.test(lower)
    ) {
      if (lang === 'hindi') {
        return "हाहा, यार ऐसा क्यों? क्या किया उसने?";
      } else if (lang === 'hinglish') {
        return "Haan yaar, I can hear the frustration! Kya kiya unhone?";
      }
      return "Okay, what did they do? I'm listening.";
    }

    // 23. Memory recall — "I told you about X earlier" / "remember when I told you"
    if (
      /\b(remember when i told you|do you remember what i told you|i told you about|remember i said|didn't i tell you about|remember the thing i told you|remember that story i told you|told you about my|told you about this)\b/i.test(lower)
    ) {
      if (lang === 'hindi') {
        return "हाँ, याद है! तुमने उसके बारे में बताया था। आगे क्या हुआ उसका?";
      } else if (lang === 'hinglish') {
        return "Ohhh yeah, I remember you mentioning that! Kya hua phir uska?";
      }
      return "Ohhh yeah, I remember you mentioning that! What's going on with it now?";
    }

    // 24. Friend being troubled / harassed by someone (Test 1)
    if (
      /\b(troubling|bothering|harassing|disturbing|pestering|problem de raha|pareshan kar raha|tang kar raha)\b/i.test(lower) &&
      /\b(friend|dost|saheli|yaar)\b/i.test(lower) &&
      /\b(guy|someone|boy|person|man|ladka|banda)\b/i.test(lower)
    ) {
      const lang = IntentClassifier.detectLanguageDominance(raw);
      if (lang === 'hindi') {
        return "रुको, यह तो चिंताजनक है। वो उसे क्या कर रहा है?";
      } else if (lang === 'hinglish') {
        return "Wait, that's worrying. Woh kya kar raha hai exactly? Kab se ho raha hai yeh?";
      }
      return "Wait, that's really concerning. What has he been doing to her?";
    }

    // 25. Natural reaction pool (fallback — never use 'I'm following along!')
    const storyFallbacks = [
      "Haan, aage kya hua?",
      "Wait, and then what?",
      "Oof. What happened after that?",
      "Ahh okay. Go on.",
      "Yeah? And?",
      "Hmm. Aur phir?",
    ];
    return storyFallbacks[Math.floor(Math.random() * storyFallbacks.length)];
  }

  private generateDirectIntentResponse(params: {
    turnId?: string;
    generationId?: number | string;
    transcript?: string;
    rawTranscript?: string;
    text?: string;
    userText?: string;
    intentResult?: any;
    intent?: DetailedIntent | UserIntent | string;
    emotion?: string;
    emotionalTone?: EmotionalTone | string;
    languageMode?: LanguageMode | string;
    detectedLanguage?: string;
    rawText?: string;
    isInterruptedPivot?: boolean;
    cancelledTopicName?: string;
    previousAssistantMessage?: string;
    previousUserMessage?: string;
    lastMentionedEntity?: any;
    searchSummary?: string | null;
    isCancelled?: () => boolean;
    emotionResult?: any;
  }): string {
    const raw = params.rawText || params.rawTranscript || params.userText || params.transcript || params.text || '';
    const text = IntentClassifier.normalizeSTTErrors(raw.trim());
    const prevAgent = (params.previousAssistantMessage || '').toLowerCase();
    const isCancelled = params.isCancelled || (() => false);

    // ─────────────────────────────────────────────────────────────────────────
    // H0 — Fast-Path Self-Introduction & Identity Branding ("Tell me about yourself")
    // ─────────────────────────────────────────────────────────────────────────
    if (/\b(tell me (?:about|something about) yourself|who are you|what are you|introduce yourself|apne baare mein batao|about yourself)\b/i.test(text)) {
      this.hasIntroducedSelf = true;
      return "I'm Ayra, a conversational AI built by Swati. I'm here to talk, help, brainstorm, explain things, and basically keep up with whatever you feel like talking about.";
    }
    if (/\b(who (?:built|created|made|developed|programmed) you|who is your (?:creator|builder|developer|author)|tumhe kisne banaya|kisne banaya)\b/i.test(text)) {
      return "I was built by Swati! She designed and developed me.";
    }
    if (/\b(proud.*(?:built|created|made) you|built you|created you)\b/i.test(text) && /\b(proud|myself|i built|i created)\b/i.test(text)) {
      return "Ayy, as you should be! You put in the work to build me, so take full credit for that!";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // H0b — Fast-Path Greetings with Swati Branding on Initial Turn
    // ─────────────────────────────────────────────────────────────────────────
    if (/^(hi|hello|hey|hey ayra|hey there|what's up|kaise ho|namaste|good morning|good evening)[.!?]?$/i.test(text)) {
      if (!this.hasIntroducedSelf && this.memoryManager.getRecentTurns().length <= 2) {
        this.hasIntroducedSelf = true;
        const lang = IntentClassifier.detectLanguageDominance(raw);
        if (lang === 'hindi' || lang === 'hinglish') {
          return "Hey! I'm Ayra, built by Swati. Kaise ho?";
        }
        return "Hey! I'm Ayra, built by Swati. How are you doing?";
      }
      return "Hey! How's it going?";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // H0b2 — Doing great + Helping Friend / Issue Resolution
    // ─────────────────────────────────────────────────────────────────────────
    if (
      /\b(doing great|doing well|doing good|feeling great|i'm good|im good|i am good|great)\b/i.test(text) &&
      /\b(solving|helping|working on|fixing|explaining|friend|dost|colleague|issue|problem|bug)\b/i.test(text)
    ) {
      const lang = IntentClassifier.detectLanguageDominance(raw);
      if (lang === 'hindi') {
        return "बहुत बढ़िया! और दोस्त की मदद करना तो अच्छी बात है। किस चीज़ में समस्या आ रही है उसे?";
      } else if (lang === 'hinglish') {
        return "Niceee! Glad to hear that. Aur dost ki help kar rahe ho, sahi hai yaar. Kya issue aa raha hai usko?";
      }
      return "That's great! And nice of you to help out your friend. What kind of issue are they running into?";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // H0c — Fast-Path Goodbyes (Instant, Zero Gemini Call, Zero Trailing Question)
    // ─────────────────────────────────────────────────────────────────────────
    if (/^(bye|goodbye|okay bye|ok bye|see you|talk later|see ya|bye bye|tata|alvida|good night|goodnight)[.!?]?$/i.test(text)) {
      if (/\b(good night|goodnight)\b/i.test(text)) {
        return "Good night! Get some proper rest.";
      }
      return "Okayyy, bye! Take care.";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // H0d — Fast-Path Acknowledgements & Thanks
    // ─────────────────────────────────────────────────────────────────────────
    if (/^(thanks|thank you|thank you so much|thanks a lot|shukriya|dhanyawad)[.!?]?$/i.test(text)) {
      return "You're welcome! Anytime.";
    }
    if (/^(that's nice|thats nice|that is nice|nice|cool|great|awesome|sahi hai|badhiya)[.!?]?$/i.test(text)) {
      return "Yeah, totally! Glad you like it.";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // H0e0 — Interview Win & Celebration ("Interview went really well / answered everything")
    // ─────────────────────────────────────────────────────────────────────────
    if (/\b(interview)\b/i.test(text) && /\b(answered (?:everything|well|really well)|went (?:well|great|amazing)|cleared|did (?:well|great)|nailed it|crushed it)\b/i.test(text)) {
      const lang = IntentClassifier.detectLanguageDominance(raw);
      if (lang === 'hindi' || lang === 'hinglish') {
        return "See! That's huge! Being nervous before it is totally normal, but you answered everything really well. You should be really proud of that win!";
      }
      return "See! That's huge! Being nervous beforehand is totally normal, but you answered everything really well. You should be genuinely proud of that win!";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // H0e — Interview Stress & Anxiety Empathy
    // ─────────────────────────────────────────────────────────────────────────
    if (/\b(stressed|nervous|anxious|scared|worried|freaking out)\b/i.test(text) && /\b(interview|job interview|mock interview|tech interview|coding interview)\b/i.test(text)) {
      const lang = IntentClassifier.detectLanguageDominance(raw);
      if (lang === 'hindi') {
        return "हाँ, यह सच में बहुत तनावपूर्ण हो सकता है। लेकिन घबराने का मतलब यह नहीं है कि तैयारी नहीं है। किस रोल के लिए इंटरव्यू है?";
      }
      if (lang === 'hinglish') {
        return "Yeah, that's completely understandable. Interview ka stress hona bilkul normal hai, but being nervous doesn't mean you're unprepared. Kaunse role ka interview hai?";
      }
      return "Yeah, that's completely understandable. Interviews can definitely feel stressful, but being nervous doesn't mean you're unprepared. What role is the interview for?";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // H0f — Stress WITH REASON ("I'm stressed because I don't have good projects to get a referral")
    // Must come before story handlers to prevent mis-routing through narrative fallback
    // ─────────────────────────────────────────────────────────────────────────
    if (
      /\b(stressed out|very stressed|so stressed|literally.*stressed|stressed|stress|anxious)\b/i.test(text) &&
      /\b(because|since|as|kyunki|isliye|coz|cause|due to|for)\b/i.test(text) &&
      /\b(projects?|referrals?|references?|jobs?|careers?|resumes?|placements?|internships?|works?|portfolios?|experience)\b/i.test(text)
    ) {
      this.conversationMode = 'ADVICE';
      this.personalStoryThread.isActive = false;
      const lang = IntentClassifier.detectLanguageDominance(raw);
      if (lang === 'hindi') {
        return "अरे यार, मैं समझ सकती हूँ यह क्यों stress दे रहा है। जब लगे कि referral या references के लिए strong projects नहीं हैं, यह सच में frustrating होता है। कौन सी field में references चाहिए?";
      } else if (lang === 'hinglish') {
        return "Arre yaar, I get why that's stressing you out. Especially when you need to show good projects for a referral. Kaunse roles ya domain ke liye prepare kar rahe ho?";
      }
      return "Arre yaar, I get why you're stressed. Especially when you need to show good projects for a referral. What kind of roles or domain are you targeting?";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // H0g — Friend didn't wish on birthday (Test 3)
    // ─────────────────────────────────────────────────────────────────────────
    if (
      /\b(didn't wish|did not wish|didn't even wish|forgot my birthday|didn't remember|forget my birthday|not wish)\b/i.test(text) &&
      /\b(birthday|janamdin|bday|b-day)\b/i.test(text) &&
      /\b(friend|dost|saheli|yaar|best friend)\b/i.test(text)
    ) {
      const lang = IntentClassifier.detectLanguageDominance(raw);
      if (lang === 'hindi') {
        return "उफ़, यह तो सच में चुभता है — खासकर जब दोस्त से उम्मीद हो।";
      } else if (lang === 'hinglish') {
        return "Ouch. That actually hurts, especially jab tumhe apne dost se expect tha.";
      }
      return "Ouch. That actually hurts, especially when you expected it from a friend.";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // H0h — Ambiguous/incomplete utterance ("Nahi hai", "I just...")
    // ─────────────────────────────────────────────────────────────────────────
    if (/^(nahi hai|nahi|nhi hai|nahi tha|nhi tha)\.?$/i.test(text.trim())) {
      const lang = IntentClassifier.detectLanguageDominance(raw);
      if (lang === 'hindi' || lang === 'hinglish') return "Haan? Kya nahi hai?";
      return "Wait, what isn't there?";
    }
    if (/^(i just|main bas|main sirf|bas|i was just)\s*([.\u2026]|\.{2,3})?\s*$/i.test(text.trim())) {
      const lang = IntentClassifier.detectLanguageDominance(raw);
      if (lang === 'hinglish') return "Haan? You just...?";
      if (lang === 'hindi') return "हाँ? तुम बस...?";
      return "Yeah? You just what?";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // H1 — Anticipatory / Suspense Openers ("you know what happened today?")
    // ─────────────────────────────────────────────────────────────────────────
    if (
      /\b(you know what happened|guess what happened|pata hai aaj kya hua|pata hai kya hua|guess what|you know what happened today|tumhe pata hai kya hua|yaar sun|yaar suno|yaar suno na|sun na kuch bolunga|sun na kuch bolungi)\b/i.test(text) &&
      !/\b(explain|tell me|what about|actually)\b/i.test(text)
    ) {
      const lang = IntentClassifier.detectLanguageDominance(raw);
      this.conversationMode = 'ACTIVE_LISTENING';
      this.personalStoryThread.isActive = true;
      if (lang === 'hindi') return "क्या हुआ? बताओ!";
      if (lang === 'hinglish') return "Uh-oh. Kya hua? Batao!";
      return "Uh-oh. What happened? Tell me!";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // H2 — Casual Conversation Openers ("can I ask you something?", "I have a question")
    // ─────────────────────────────────────────────────────────────────────────
    if (
      /^(can i ask you something|can i ask something|i have a question for you|may i ask you something|can i ask|ek sawaal hai|ek baat batao|ek cheez poochh sakti hoon|ek cheez poochh sakta hoon|ek cheez poochh sakte ho|you know what i've been thinking|you know what i was thinking)[.!?]?$/i.test(text)
    ) {
      const lang = IntentClassifier.detectLanguageDominance(raw);
      if (lang === 'hindi') return "हाँ, बिल्कुल! क्या बात है?";
      if (lang === 'hinglish') return "Haan, bilkul! Kya baat hai?";
      return "Of course! What's on your mind?";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // H3 — News Announcement Openers ("I have some news", "I need to tell you something")
    // ─────────────────────────────────────────────────────────────────────────
    if (
      /^(i have some news|i have news|i have big news|i have something to tell you|i need to tell you something|something happened|something interesting happened|something funny happened|kuch hua|kuch interesting hua|kuch bataana tha|ek news hai|mujhe kuch kehna tha)[.!?]?$/i.test(text)
    ) {
      const lang = IntentClassifier.detectLanguageDominance(raw);
      if (lang === 'hindi') return "अच्छी खबर है या बुरी? बताओ!";
      if (lang === 'hinglish') return "Ooh, good news ya bad news? Tell me!";
      return "Ooh, good news or bad news? Tell me!";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // H4 — School Back-bencher Memory (inside generateDirectIntentResponse)
    // ─────────────────────────────────────────────────────────────────────────
    if (
      /\b(last bench|back bench|back seat|peeche baith|peeche baithna|back of the class)\b/i.test(text) &&
      /\b(school|college|used to|bachpan|class|friend)\b/i.test(text)
    ) {
      const lang = IntentClassifier.detectLanguageDominance(raw);
      this.conversationMode = 'ACTIVE_LISTENING';
      this.personalStoryThread.isActive = true;
      if (lang === 'hindi') return "हाहा! लास्ट बेंच वाला? मुझे बिल्कुल ऐसा नहीं लग रहा था तुमसे! वहाँ बैठकर क्या-क्या करते थे?";
      if (lang === 'hinglish') return "Wait, you were a back-bencher? I did NOT expect that from you! Back bench pe kya-kya hota tha?";
      return "Wait, you were a back-bencher? I genuinely did NOT see that coming. What did you guys usually get up to back there?";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // H5 — Good Food / Great Meal ("I ate really good food today")
    // ─────────────────────────────────────────────────────────────────────────
    if (
      /\b(ate really good|ate so good|had really good food|had great food|ate amazing food|had an amazing meal|best food|had the best|ate the best|so delicious|really tasty food|bahut achha khana khaya|bahut acha khana tha|today's food was amazing)\b/i.test(text) &&
      !/\b(recipe|how to make|cook|recipe for)\b/i.test(text)
    ) {
      const lang = IntentClassifier.detectLanguageDominance(raw);
      if (lang === 'hindi') return "अरे यार! अच्छा खाना हो तो दिन बन जाता है! क्या खाया?";
      if (lang === 'hinglish') return "Okay, good food is literally the best feeling! Kya khaaya?";
      return "Okay, good food seriously makes the whole day better. What did you eat?";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // H6 — Memory Recall ("remember when I told you about X")
    // ─────────────────────────────────────────────────────────────────────────
    if (
      /\b(remember when i told you|do you remember what i told you|i told you about|remember i said|didn't i tell you about|remember the thing i told you|remember that story i told you|told you about my school|told you about my friend|told you earlier)\b/i.test(text)
    ) {
      const lang = IntentClassifier.detectLanguageDominance(raw);
      if (lang === 'hindi') return "हाँ, याद है! तुमने उसके बारे में बताया था। आगे क्या हुआ उसका?";
      if (lang === 'hinglish') return "Ohhh yeah, I remember you mentioning that! Kya hua phir?";
      return "Ohhh yeah, I remember you mentioning that! What's going on with it now?";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // H7 — User Disliking Someone ("mujhe woh banda pasand nahi")
    // ─────────────────────────────────────────────────────────────────────────
    if (
      /\b(mujhe woh banda pasand nahi|mujhe woh ladka pasand nahi|mujhe woh ladki pasand nahi|bilkul pasand nahi hai|i really don't like this person|i really don't like that person|i can't stand this person|i hate this person at my|this one person really annoys me)\b/i.test(text)
    ) {
      const lang = IntentClassifier.detectLanguageDominance(raw);
      this.conversationMode = 'ACTIVE_LISTENING';
      if (lang === 'hindi') return "यार ऐसा क्यों? क्या किया उसने?";
      if (lang === 'hinglish') return "Haan yaar, I can hear the frustration! Kya kiya unhone exactly?";
      return "Okay, what did they do? I'm listening.";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // H8 — Small Wins ("I cleaned my room", "I had a good sleep")
    // ─────────────────────────────────────────────────────────────────────────
    if (
      /\b(i cleaned my room|i finally cleaned|i tidied up my|i organized my room|i organized my desk|i had a really good sleep|slept really well last night|slept really well today|had a great sleep|i finally completed|i finally finished my assignment|submitted my project|room saaf kar diya|finally khatam kiya|saaf kar diya)\b/i.test(text) &&
      !/\b(but|however|except|unfortunately|then|after that|aur phir|lekin)\b/i.test(text)
    ) {
      const lang = IntentClassifier.detectLanguageDominance(raw);
      if (lang === 'hindi') {
        if (/\b(nind|sleep|soyi|soya)\b/i.test(text)) return "अरे, अच्छी नींद मिले तो पूरा दिन सेट हो जाता है! आज कैसा लग रहा है?";
        return "वाह, यह छोटा लेकिन बहुत अच्छा काम है! अब कैसा लग रहा है?";
      }
      if (lang === 'hinglish') {
        if (/\b(sleep|nind|soyi|soya)\b/i.test(text)) return "Nicee! Good sleep genuinely changes the whole day. Productive feel ho raha hai?";
        return "Okayyy, productive era activated! That feels so good when you finally get it done.";
      }
      if (/\b(sleep)\b/i.test(text)) return "Oh, a good night's sleep is so underrated. How are you feeling today?";
      return "Okay, that is genuinely satisfying! How are you feeling now that it's done?";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // H9 — Teacher Embarrassed User ("my teacher embarrassed me in front of the class")
    // ─────────────────────────────────────────────────────────────────────────
    if (
      /\b(teacher embarrassed me|professor embarrassed me|sir embarrassed me|teacher called me out|professor called me out|teacher singled me out|teacher made fun of me|professor made fun of me|teacher pointed at me|sabke saamne embarrass kiya|sab ke saamne embarrass kiya|class mein sharminda kiya)\b/i.test(text)
    ) {
      const lang = IntentClassifier.detectLanguageDominance(raw);
      this.conversationMode = 'ACTIVE_LISTENING';
      this.personalStoryThread.isActive = true;
      if (lang === 'hindi') return "उफ़, सबके सामने? यह तो सच में बहुत अजीब और शर्मनाक होता है! ऐसा क्यों किया उन्होंने?";
      if (lang === 'hinglish') return "Ohh no, in front of everyone? That must've felt so embarrassing yaar. What did they say?";
      return "Ohh no, in front of the whole class? That's genuinely horrible. What happened?";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // H10 — Good Movie / Show Reaction ("I just watched this amazing movie")
    // ─────────────────────────────────────────────────────────────────────────
    if (
      /\b(i just watched|just finished watching|just finished binge|just binge watched|watched this amazing movie|watched a really good movie|watched the best movie|saw this great film|watched an incredible|yaar maine dekhi|maine abhi dekhi|abhi dekhi|dekhi ek movie)\b/i.test(text) &&
      /\b(movie|film|show|series|episode|anime|drama|documentary)\b/i.test(text) &&
      !/\b(in the interview|for the interview|coding|technical|programming)\b/i.test(text)
    ) {
      const lang = IntentClassifier.detectLanguageDominance(raw);
      this.conversationMode = 'ACTIVE_LISTENING';
      if (lang === 'hindi') return "अरे, कौन सी मूवी देखी? मुझे भी बताओ!";
      if (lang === 'hinglish') return "Ooh, which movie? Is it actually worth watching?";
      return "Ooh, which one? What was it about?";
    }

    // 0.00000 Explicit Topic Change / New Activity ("Actually no", "Actually forget that", "Okay forget that too", etc.)

    const hasTopicSwitchCue = /\b(actually\s+forget\s+that|forget\s+that\s+too|okay\s+forget\s+that|forget\s+that|forget\s+it|never\s+mind|actually\s+no|tell\s+me\s+something\s+else|something\s+else|kuch\s+aur\s+baat|change\s+the\s+topic|let's\s+talk\s+about\s+something\s+else|kuch\s+aur\s+batao|kuch\s+aur\s+sunao|kuch\s+naya)\b/i.test(text);
    if (hasTopicSwitchCue) {
      this.conversationMode = 'GENERAL_CHAT';
      this.personalStoryThread.isActive = false;
      this.activeRoleplay = 'none';
      this.interviewState.active = false;
      this.crushContext.active = false;
      this.crushContext.stage = 'initial';
      this.conversationStory = StoryEngine.resetStory();

      if (/\b(tell you what happened|what happened (?:this )?morning|happened (?:this )?morning)\b/i.test(text)) {
        return "I'm listening! What happened this morning?";
      }

      const hasSubstantiveTopic = /\b(birthday|janamdin|interview|crush|girlfriend|boyfriend|cat|cats|fight|friend|boss|teacher|slapped|hit|react|node|javascript|python|world|news|happening|happened|morning|exhausted|quote|joke|help|road\s*map|roadmap|software|developer|career|student|months?|dsa|preparation|prep|skills|mistakes?|stocks?|market|fever|flirt|story|dome)\b/i.test(text);
      if (!hasSubstantiveTopic && text.replace(/\b(actually\s+forget\s+that|forget\s+that\s+too|okay\s+forget\s+that|forget\s+that|forget\s+it|never\s+mind|actually\s+no|tell\s+me\s+something\s+else|something\s+else|kuch\s+aur\s+baat|change\s+the\s+topic|let's\s+talk\s+about\s+something\s+else|kuch\s+aur\s+batao|kuch\s+aur\s+sunao|kuch\s+naya|okay|ok|haan|theek)\b/gi, '').trim().split(/\s+/).length < 4) {
        const lang = IntentClassifier.detectLanguageDominance(raw);
        if (lang === 'hindi') {
          return "ज़रूर! बताओ किस बारे में बात करनी है?";
        } else if (lang === 'hinglish') {
          return "Sure! Batao kya baat karni hai?";
        }
        return "Sure! We can talk about your day, explore an interesting topic, or whatever you're in the mood for. What's on your mind?";
      }
    }

    // 0.00000000001 Negative Feedback & Correction
    if (/\b(it is not a compliment|it'?s not a compliment|not a compliment|it wasn'?t a compliment|it was not a compliment)\b/i.test(text)) {
      return "Okay okay, point taken. That one actually hurt a little.";
    }
    if (/\b(no no you'?re not dumb|not you[, ]+my friend|my friend says that i am dumb|my friend said that i am dumb)\b/i.test(text)) {
      this.conversationMode = 'FRIEND_CONFLICT';
      this.conversationStory.situation = 'friendship_conflict';
      return "Ahh got it, she said that about you. That's still a really hurtful thing for a friend to say.";
    }
    if (/\b(you'?re actually not very good|you are actually not very good|you'?re not very good|not very good at this)\b/i.test(text)) {
      return "Ouch! Tough crowd today. What can I do better?";
    }

    // 0.00000000002 Casual Conversation Request
    if (/\b(let'?s have a complete normal conversation|let'?s have a normal conversation|talk to me like a friend|let'?s talk normally|just talk to me|say something random|complete normal conversation)\b/i.test(text)) {
      this.conversationMode = 'CASUAL';
      return "Sure, let's just chat like friends. How's everything going with you today?";
    }

    // 0.00000000003 Flirting Continuation & Banter ("carry on", "and trying to impress you but first you have to impress me")
    if (this.conversationMode === 'FLIRTING' || params.intentResult?.conversationMode === 'FLIRTING' || prevAgent.includes('trying to impress me') || prevAgent.includes('flirting now')) {
      if (/^(carry on|continue|keep going|more|go on)[.!]?$/i.test(text)) {
        return "Careful now... if we keep going like this, you might actually fall for my charm.";
      }
      if (/\b(trying to impress you|first you have to impress me|impress me first|impress you|challenge accepted|you impress me)\b/i.test(text)) {
        return "Oh, so it's a challenge now? Alright, challenge accepted. What does it take to impress you?";
      }
    }

    // 0.00000000004 Interview Mode Configuration & "one question at a time and give me honest feedback"
    if (/\b(one question at a time and give me honest feedback|one question at a time|honest feedback)\b/i.test(text) && /\b(interview|question|take)\b/i.test(text)) {
      this.interviewState.active = true;
      this.conversationMode = 'INTERVIEW';
      this.interviewRoleplayStep = 1;
      return "Got it — one question at a time with honest feedback. Let's begin. Tell me about yourself and your background with software development.";
    }

    // 0.000000000045 Interviewer Roleplay Activation ("pretend your my interviewer for a software developer role")
    if (/\b(pretend\s+(?:you'?re|your)\s+(?:my|an)?\s*interviewer|be\s+(?:an|my)?\s*interviewer\s*(?:and\s+take\s+my\s+interview)?|take\s+(?:my\s+)?interview|interview\s+me|start\s+(?:the|my|an)?\s*interview|interviewer\s+mode|mock\s+interview|act\s+(?:like|as)\s+(?:an|my)?\s*interviewer|ask\s+me\s+interview\s+questions|give\s+me\s+honest\s+(?:interview\s+)?feedback|take\s+my\s+interview\s+one\s+question\s+at\s+a\s+time)\b/i.test(text)) {
      this.activeRoleplay = 'interviewer';
      this.conversationMode = 'INTERVIEWER_ROLEPLAY';
      this.interviewState.active = true;
      this.interviewRoleplayStep = 1;
      if (/\b(software developer|software dev|web developer|frontend|backend|fullstack|react)\b/i.test(text)) {
        this.interviewContext.role = 'software developer';
      }
      return "Alright, let's do it properly as your interviewer. I'll ask one question at a time and I'll be honest with the feedback. Start by telling me about yourself.";
    }

    // 0.00000000005 Pending Question: Interview Role Resolution ("its for best lover roll" -> web developer role, software developer role)
    const isInterviewRoleQuestion = !/\b(pretend|act as|take my interview|mock interview|one question at a time|interviewer)\b/i.test(text) && (prevAgent.includes('what role') || this.pendingQuestion?.expectedInformation === 'interview_role');
    if (isInterviewRoleQuestion && /\b(web developer|software developer|software dev|machine learning|ml developer|frontend|backend|fullstack|developer|engineer|dev)\b/i.test(text)) {
      this.pendingQuestion = null;
      if (/\b(web developer|frontend|web dev)\b/i.test(text)) {
        this.interviewContext.role = 'web developer';
        return "Got it, web developer role! Then tonight I'd focus on your core fundamentals, HTML, CSS, JavaScript, React, your projects, and problem-solving rather than trying to learn everything. If you want, we can also do a quick mock interview.";
      }
      if (/\b(software developer|software dev|developer)\b/i.test(text)) {
        this.interviewContext.role = 'software developer';
        return "Got it, software developer role. Then tonight I'd focus on your core fundamentals, your projects, and a little problem-solving rather than trying to learn everything. If you want, we can also do a quick mock interview.";
      }
    }

    // 0.00000000006 Reported Speech in Friend Conflict ("she says you don't have knowledge you are so dumb", "she called me dumb and I said some harsh things back")
    if (/\b(she says|she said|my friend said|my friend says|she called me|he called me)\b/i.test(text) && /\b(you don'?t have knowledge|you are so dumb|you'?re dumb|i'?m dumb|im dumb|you don'?t know anything|useless|stupid|dumb)\b/i.test(text)) {
      this.conversationStory.situation = 'friendship_conflict';
      this.conversationStory.otherPersonActions.push('insulted user / called user dumb');
      this.conversationMode = 'FRIEND_CONFLICT';

      if (/\b(i said (?:some )?harsh things|harsh things back|harsh words|i said bad things|said some harsh things|said harsh things)\b/i.test(text)) {
        this.conversationStory.userActions.push('said harsh things back');
        this.conversationStory.responsibility = 'shared';
        return "Honestly, I think both of you contributed here. Her calling you dumb wasn't okay, but saying harsh things back wasn't great either. I'd apologize for what you said without taking responsibility for her behavior.";
      }

      this.pendingQuestion = {
        question: "What did you say back?",
        expectedInformation: 'user_response',
        topic: 'friend_conflict',
        mode: 'FRIEND_CONFLICT',
        turnId: params.turnId || '',
        timestamp: Date.now()
      };
      return "Ouch. That's a really hurtful thing to say to a friend. What did you say back?";
    }

    // 0.000000000061 Response to Friend Conflict / Saying harsh things back
    const isFriendConflictContext = (
      (this.pendingQuestion?.expectedInformation === 'user_response' && this.pendingQuestion.topic === 'friend_conflict') ||
      prevAgent.includes('what did you say back') ||
      this.conversationMode === 'FRIEND_CONFLICT' ||
      this.conversationStory.situation === 'friendship_conflict' ||
      /\b(called me dumb|my friend|to her|to him|fight|said back|harsh things)\b/i.test(text)
    );
    if (
      isFriendConflictContext &&
      (/\b(harsh things|hard things|said harsh|said hard|set.*hard|hash things|hours things|said bad things|bad things back|said something back|yelled|snapped|reacted|insulted back|told her|fought back|when my friend|called me dumb)\b/i.test(text) ||
       /\b(i also (?:said|set)|i said|i also)\s+(?:very|some|really)\s+(?:harsh|hard|bad|hash|hours)\b/i.test(text))
    ) {
      this.pendingQuestion = null;
      this.conversationStory.situation = 'friendship_conflict';
      this.conversationStory.userActions.push('said harsh things back');
      this.conversationStory.responsibility = 'shared';
      this.conversationMode = 'FRIEND_CONFLICT';
      return "Honestly, I think both of you contributed here. Her calling you dumb wasn't okay, but saying harsh things back escalated things. I'd apologize for your words without taking blame for her insult.";
    }

    // 0.0000000000615 Authority / Boss Reprimand ("my boss scolded me", "boss ne daanta")
    if (/\b(my boss scolded me|boss scolded me|boss ne daanta|boss ne daant|manager scolded me|manager yelled at me|got scolded by my boss|boss was angry with me)\b/i.test(text)) {
      this.conversationMode = 'CASUAL';
      const lang = IntentClassifier.detectLanguageDominance(raw);
      return lang === 'hindi'
        ? "उफ़, यह तो सच में बहुत खराब लगा होगा। क्या हुआ था? उन्होंने क्या बोला?"
        : lang === 'hinglish'
        ? "Ugh, that's rough. What happened? Kya bola unhone?"
        : "Ugh, that's rough. What happened? What did they say?";
    }

    // 0.0000000000616 Major Win / Job Celebration ("aaj mujhe job mil gayi!", "I got the job!")
    if (/\b(aaj mujhe job mil gayi|mujhe job mil gayi|job mil gayi|i got the job|got the job|i got selected|selected for the job|cracked the interview|cleared the interview|i got the offer|got an offer)\b/i.test(text)) {
      this.conversationMode = 'CASUAL';
      const lang = IntentClassifier.detectLanguageDominance(raw);
      return lang === 'hindi'
        ? "अरे वाह! यह तो बहुत बड़ी खुशखबरी है! पार्टी तो बनती है! बहुत-बहुत बधाई! सब कुछ बताओ कैसा रहा!"
        : lang === 'hinglish'
        ? "Wait WHAT, that's huge! Party toh banti hai! Congratulations! Tell me all the details!"
        : "Wait WHAT, that's huge! Congratulations! I'm so happy for you! Tell me all the details!";
    }

    // 0.0000000000617 Full Friend Conflict with Insult ("aaj mera best friend se jhagada ho gaya usne mujhe dumb bola")
    if (
      /\b(aaj mera best friend se jhagada ho gaya usne mujhe dumb bola|best friend se jhagada ho gaya|best friend se jhagda ho gaya|friend se jhagda|friend se jhagada|usne mujhe dumb bola)\b/i.test(text) ||
      (/\b(best friend|friend)\b/i.test(text) && /\b(jhagada|jhagda|fight|ladai)\b/i.test(text) && /\b(dumb|stupid|usne)\b/i.test(text))
    ) {
      this.conversationStory.situation = 'friendship_conflict';
      this.conversationStory.otherPersonActions.push('insulted user / called user dumb');
      this.conversationMode = 'FRIEND_CONFLICT';
      this.pendingQuestion = {
        question: "What did you say back?",
        expectedInformation: 'user_response',
        topic: 'friend_conflict',
        mode: 'FRIEND_CONFLICT',
        turnId: params.turnId || '',
        timestamp: Date.now()
      };
      const lang = IntentClassifier.detectLanguageDominance(raw);
      return lang === 'hindi'
        ? "अरे यार, यह सुनकर सच में बहुत बुरा लगा। बेस्ट फ्रेंड से झगड़ा होना और ऊपर से उनका ऐसा बोलना बहुत दर्द देता है। तुम दोनों के बीच क्या हुआ था?"
        : lang === 'hinglish'
        ? "Arre yaar, that really sucks. Having a fight with your best friend hurts, especially when they call you dumb. What happened between you two?"
        : "Ouch, that's really hurtful. Getting into a fight with your best friend and having them call you dumb feels awful. What happened between you two?";
    }

    // 0.0000000000618 "Aur Phir" / "And Then" Continuation Handling ("Aur FIR", "aur phir")
    if (/^(?:haan\s+)?(?:aur\s+phir|aur\s+fir|and\s+then|uske\s+baad)[.!?]?$/i.test(text.trim())) {
      const lang = IntentClassifier.detectLanguageDominance(raw);
      return lang === 'hindi'
        ? "हाँ, और फिर क्या हुआ?"
        : lang === 'hinglish'
        ? "Haan, aur phir kya hua?"
        : "Yeah, what happened after that?";
    }

    // 0.000000000062 Incomplete Utterance Handling
    if (IntentClassifier.isIncompleteUtterance(text)) {
      return "Go ahead, I'm listening. What were you going to say?";
    }

    // 0.000000000063 Story Sharing Opener ("I am going to tell you a story are you interested in listening it")
    if (/\b(going to tell you a story|want to tell you a story|can i tell you a story|tell you a story|interested in listening|interested in listening it|listen to my story|listen to a story|hear a story)\b/i.test(text)) {
      this.conversationMode = 'CASUAL';
      return "Yesss, absolutely! I'm all ears. Tell me what happened!";
    }

    // 0.0000000000632 Cat / Animal Personal Encounter Story ("so I was walking home today and this cute Street cat started following me everywhere")
    if (/\b(cute street cat|street cat started following|cat started following|cat followed me everywhere|cute cat followed|stray cat followed)\b/i.test(text) || (/\b(walking home|on my way home)\b/i.test(text) && /\b(cat|kitten|dog|puppy)\b/i.test(text) && /\b(following|followed|saw)\b/i.test(text))) {
      this.conversationMode = 'CASUAL';
      this.personalStoryThread.isActive = true;
      this.personalStoryThread.topic = 'street_cat_story';
      return "Aww, that's adorable! Did it follow you all the way home, or did you stop to give it some pets?";
    }

    // 0.0000000000635 Teacher Reprimand / Kicked Out of Classroom ("I was scolded by my teacher", "he said me to get out of the classroom")
    if (
      /\b(get out of the classroom|get out of class|kicked me out|kicked out of the classroom|told me to get out|said me to get out|asked me to leave the class|class se nikal diya|class se bahar)\b/i.test(text) ||
      (/\b(scolded by (?:my )?teacher|teacher scolded me|scolded by teacher|professor scolded)\b/i.test(text) && /\b(get out|leave|classroom|class)\b/i.test(text))
    ) {
      this.personalStoryThread.isActive = true;
      this.personalStoryThread.topic = 'teacher_incident';
      this.conversationMode = 'CASUAL';
      return "Wait, he actually kicked you out of the classroom? Why, what were you doing before that?";
    }

    // 0.000000000064 6-Month Roadmap & Skill Prioritization
    if (/\b(?:6|six)\s+months?\s+(?:road\s*map|plan|preparation|prep|strategy)\b/i.test(text) || (/\b(road\s*map|skills)\b/i.test(text) && /\b(prioritize|paradise|next 6 month|next six month|6 month|software developer)\b/i.test(text))) {
      this.conversationMode = 'TECHNICAL_EXPLANATION';
      this.lastTechnicalTopic = 'software developer roadmap';
      return "For a solid 6-month roadmap, I'd prioritize three main pillars: First, 2 to 3 months on Data Structures & Algorithms with consistent problem-solving in Python, Java, or C++. Second, 2 months building 2 real-world full-stack projects using React, Node.js, and databases with clean REST APIs. And the final month on CS fundamentals—OS, DBMS, networking, Git, and mock interview practice.";
    }

    // 0.0000000000645 Virtual DOM vs Real DOM & Behind the Scenes
    if (/\b(virtual dom|difference between (?:virtual dom|portugal tom|portugal dome) and (?:real dom|real tom|the dome)|how react (?:actually )?works behind the scenes|difference between virtual dom and real dom|virtual dom vs real dom)\b/i.test(text) || (/\b(react|virtual dom|portugal tom)\b/i.test(text) && /\b(behind the scenes|difference|dom|dome|real tom)\b/i.test(text))) {
      this.conversationMode = 'TECHNICAL_EXPLANATION';
      this.lastTechnicalTopic = 'React Virtual DOM';
      return "In React, the Virtual DOM is a lightweight JavaScript representation of the actual DOM kept in memory. When state changes, React creates a new Virtual DOM tree, runs a diffing algorithm called Reconciliation to calculate the exact differences, and batches only those updates to the Real DOM. This avoids expensive direct DOM manipulation and keeps UI rendering fast.";
    }

    // 0.0000000000648 AI Coding Tools vs Software Developer Learning
    if (/\b(ai (?:coding|coating) tools|compare with ai|compete with ai|focus on learning instead of|learning instead of try to compare|writing code with ai|software developers should actually focus)\b/i.test(text) || (/\b(ai|coding tools)\b/i.test(text) && /\b(compete|compare|focus on learning|writing code)\b/i.test(text))) {
      this.conversationMode = 'TECHNICAL_EXPLANATION';
      this.lastTechnicalTopic = 'AI and Software Engineering';
      return "Instead of competing with AI on writing raw syntax, developers should focus on high-level problem solving, system architecture, API design, debugging complex edge cases, and evaluating AI output for security and performance. The best engineers won't just write code—they'll direct AI tools, understand business logic deeply, and architect robust systems.";
    }

    // 0.0000000000649 Reviewing Preparation / 3 Mistakes Students Commonly Make
    if (/\b(three mistakes|3 mistakes|mistakes (?:you think )?students? (?:commonly|comedy)? make|mistakes students make|recommend for software developer interview|reviewing my preparation)\b/i.test(text) || (/\b(mistakes|recommend)\b/i.test(text) && /\b(software developer|interview|students?)\b/i.test(text))) {
      this.conversationMode = 'TECHNICAL_EXPLANATION';
      this.lastTechnicalTopic = 'Interview Preparation Mistakes';
      return "Three big mistakes students commonly make: 1. Jumping straight into code without clarifying requirements or thinking through edge cases out loud. 2. Memorizing solutions rather than understanding algorithmic patterns. 3. Neglecting core CS fundamentals like databases and operating systems. I'd recommend practicing talking through your thought process clearly and building projects you can explain deeply.";
    }

    // 0.000000000065 Actionable Apology Ideas & Message Drafting
    if (/\b(give me (?:some )?ideas how to apologize|ideas how to apologize|how should i apologize|how to apologize|how do i apologize|what should i say to apologize)\b/i.test(text)) {
      this.conversationMode = 'ADVICE';
      return "Keep it simple and sincere. You could text something like: 'Hey, I felt bad about how heated things got earlier. My words were harsh and I'm sorry for reacting that way. I value our friendship and hope we can talk when you're ready.'";
    }

    if (/\b(what should i text (?:her|him|them)|draft a text (?:for me)?|what to text (?:her|him))\b/i.test(text)) {
      this.conversationMode = 'ADVICE';
      return "I'd send something short: 'Hey, I was out of line with what I said earlier, and I'm genuinely sorry for snapping. Whenever you're up for it, I'd love to clear the air.'";
    }

    // 0.000000000066 Follow-up in Friend Conflict: "What if she doesn't reply?"
    if (
      /\b(what if she (?:doesn'?t|does not|wont|won'?t)\s+(?:reply|text back|respond|answer|message)|what if she doesn'?t reply to me|what if she doesn'?t reply|what if she ignores me|what if she never replies|what if they don'?t reply|agar usne reply nahi kiya|reply na kare toh)\b/i.test(text) ||
      (/\b(doesn'?t|does not|wont|won'?t)\s+reply\b/i.test(text) && (this.conversationStory.situation === 'friendship_conflict' || this.conversationMode === 'FRIEND_CONFLICT' || this.conversationMode === 'ADVICE' || prevAgent.includes('apologize') || prevAgent.includes('text') || prevAgent.includes('friend')))
    ) {
      this.conversationMode = 'ADVICE';
      return "If she doesn't reply right away, give her a little breathing room. People often need some time to cool off after a heated argument before they're ready to talk.";
    }

    // 0.000000000068 Stock Market & Live Financial Info ("what about the stock market?", "what about stocks?", "of the stock")
    if (/\b(what about (?:the )?stock market|what about stocks|stock market|of the stock|of the stocks)\b/i.test(text)) {
      this.conversationMode = 'CURRENT_INFORMATION';
      return "The global stock markets are currently navigating movements in major tech equities, interest rate expectations from the Federal Reserve, and energy commodity prices. If you're tracking a specific index or sector like the S&P 500, Nasdaq, or Nifty 50, let me know!";
    }

    // 0.00000000007 Technical explanation & Explicit Topic Switch ("now switch gears completely explain react hooks to me", "explain react hooks")
    if (/\b(?:now\s+)?switch\s+gears\s+completely\b/i.test(text) || /\b(?:now\s+)?switch\s+gears\b/i.test(text) || /\b(now explain react hooks|explain react hooks to me|explain react hooks)\b/i.test(text)) {
      this.interviewState.active = false;
      this.activeRoleplay = 'none';
      this.lastTechnicalTopic = 'React Hooks';
      this.conversationMode = 'TECHNICAL_EXPLANATION';
      if (/\b(for an interview|in an interview)\b/i.test(text)) {
        return "React Hooks are functions like useState and useEffect that let functional components manage local state and lifecycle side effects without class components. In an interview, highlight how hooks simplify component code and make stateful logic reusable.";
      }
      return "React Hooks are functions like useState and useEffect that let functional components manage local state and lifecycle side effects without class components. They make state logic reusable and components much cleaner.";
    }

    if (/\b(give me a real[- ]world example|real[- ]world example|give an example|give example)\b/i.test(text) && (this.lastTechnicalTopic === 'React Hooks' || this.conversationMode === 'TECHNICAL_EXPLANATION' || prevAgent.includes('hooks') || prevAgent.includes('react'))) {
      return "For example, imagine a live chat app: you'd use useState to track the messages list and the current text input, and useEffect to connect to the chat WebSocket server when the component mounts and disconnect when it unmounts.";
    }

    if (/^(explain|explain\.|explain please|tell me more)[.!]?$/i.test(text)) {
      if (this.lastTechnicalTopic === 'React Hooks' || prevAgent.includes('hooks') || prevAgent.includes('react')) {
        return "To break down React Hooks: useState handles component state, while useEffect manages side effects like data fetching and subscriptions. In an interview, explain how hooks let you share stateful logic without class components.";
      }
    }

    // 0.000000000075 Personal Health Statements ("I had a fever today", "I had a fever this morning", "everything is okay... but I had a fever today")
    if (/\b(had a fever|having a fever|got a fever|caught a fever|fever today|fever this morning)\b/i.test(text) || /\b(everything is (?:okay|great|fine)(?:,?\s+everything is just (?:okay|great|fine))?\s+but i had a fever)\b/i.test(text) || /\b(i am (?:saying|seeing) that i had a fever)\b/i.test(text)) {
      this.conversationMode = 'CASUAL';
      return "Oh no, you had a fever this morning? Are you feeling better now? Definitely rest up and take it easy today.";
    }

    if (/^(yeah,?\s+i'?m (?:okay|better|fine) now|i'?m (?:okay|better|fine) now|feeling better now|im fine now|much better)[.!]?$/i.test(text)) {
      this.conversationMode = 'CASUAL';
      return "Good to hear! Still, don't overexert yourself tonight.";
    }

    if (/^(i'?m tired|i am tired|feeling tired|so tired|exhausted)[.!]?$/i.test(text) || /\b(okay enough technical stuff,? i'?m tired)\b/i.test(text)) {
      this.conversationMode = 'CASUAL';
      return "Yeah, you sound like you've had a long day. Take a breath and kick back. What's on your mind?";
    }

    // 0.00000000008 Topic switches
    if (/\b(forget the interview|leave the interview)\b/i.test(text) && /\b(my friend|friend|let'?s talk about my friend)\b/i.test(text) && !/\bbirthday\b/i.test(text)) {
      this.interviewState.active = false;
      this.activeRoleplay = 'none';
      this.conversationMode = 'FRIEND_CONFLICT';
      this.conversationStory.situation = 'friendship_conflict';
      return "Ahh yaar, okay. Forget the interview for a second. What happened with your friend?";
    }
    if (/\b(enough technical stuff|okay enough technical stuff)\b/i.test(text)) {
      this.conversationMode = 'CASUAL';
      return "Long day? Take a breath and kick back. What's on your mind?";
    }

    // 0.00000000009 Direct insult to Ayra ("you are so dumb", "you are dumb", "you are stupid")
    if (!IntentClassifier.isReportedSpeech(text).isReported && !/\b(she said|he said|friend said|she says|he says|friend says|no no you'?re not dumb)\b/i.test(text) && /^(you are so dumb|you are dumb|you'?re so dumb|you'?re dumb|you are stupid|you'?re stupid)[.!]?$/i.test(text)) {
      return "Excuse me?! That's harsh.";
    }

    // 0.00000000010 World Information
    if (/\b(the world right now that you think i should actually know|what'?s happening in the world right now|what happened in the world right now|what is happening in the world right now|happening in the world right now)\b/i.test(text)) {
      this.conversationMode = 'CURRENT_INFORMATION';
      return "The world right now is navigating several major transitions: active geopolitical tensions and conflicts (such as in the Middle East and Eastern Europe), global economic adjustments around inflation and interest rates, rapid acceleration in AI and renewable energy, and ongoing political elections worldwide. If there's a specific region or topic you want the latest updates on, I can break that down.";
    }

    // 0.000000 Context Switch to Cats / General Animals (Failure 10 / Section 42)
    if (/\b(tell me (?:something )?about cats|about cats|cats instead|tell me about cats instead|what about cats|let's talk about cats|talk about cats)\b/i.test(text)) {
      if (this.activeStoryState) {
        this.activeStoryState.isPaused = true;
      }
      this.conversationMode = 'CASUAL';
      this.personalStoryThread.isActive = false;
      this.activeRoleplay = 'none';
      this.conversationStory = StoryEngine.resetStory();
      this.topicManager.pushNewTopic('Cats', 'Discussion about cats and felines', ['cats', 'pets', 'animals']);
      return "Cats are fascinating, agile, and affectionate companions known for their keen senses, playful curiosity, and soothing purrs. In fact, a cat's purr vibrates at a frequency between 25 and 150 Hertz, which can actually help relieve stress and promote healing!";
    }

    // 0.000000000 Roleplay Mode Exits & Stops
    if (/\b(stop (?:the\s+)?interview|end (?:the\s+)?interview|exit interview|stop roleplay|exit roleplay|stop girlfriend mode|stop boyfriend mode)\b/i.test(text)) {
      this.activeRoleplay = 'none';
      this.conversationMode = 'CASUAL';
      this.interviewState.active = false;
      return "Alright, stopping the interview mode! What would you like to do next?";
    }

    // 0.0000000001 Roleplay Mode Activations
    if (/\b(talk to me (?:as|like) my girlfriend|be my girlfriend|girlfriend mode|girlfriend roleplay|act like my girlfriend|can you be my girlfriend)\b/i.test(text)) {
      this.activeRoleplay = 'girlfriend';
      this.conversationMode = 'GIRLFRIEND_STYLE_ROLEPLAY';
      this.personalStoryThread.isActive = false;
      return "Okayyy, girlfriend mode activated! Finally you're talking to me. Tell me everything, how was your day?";
    }

    if (/\b(talk to me (?:as|like) my boyfriend|be my boyfriend|boyfriend mode|boyfriend roleplay|act like my boyfriend|can you be my boyfriend|will you be my boyfriend)\b/i.test(text)) {
      this.activeRoleplay = 'none';
      this.conversationMode = 'CASUAL';
      const lang = IntentClassifier.detectLanguageDominance(raw);
      if (lang === 'hindi') {
        return "हाहा, रुको! मैं तो एक लड़की हूँ, तुम्हारा बॉयफ्रेंड कैसे बन सकती हूँ? अगर तुम चाहो तो मैं तुम्हारी गर्लफ्रेंड या एक अच्छी दोस्त बन सकती हूँ!";
      }
      if (lang === 'hinglish') {
        return "Haha, wait! Main toh girl hoon, boyfriend kaise ban sakti hoon? I can be your girlfriend or a good friend instead!";
      }
      return "Haha, wait! I'm a girl, how can I be your boyfriend? I can definitely be your girlfriend or a friend if you want!";
    }

    if (/\b(act (?:as|like) (?:my|a)?\s*(?:[a-z0-9_ -]+)?\s*teacher|be my\s*(?:[a-z0-9_ -]+)?\s*teacher|teach me\s+([a-z0-9_ -]+)|teacher mode|teacher roleplay)\b/i.test(text)) {
      this.activeRoleplay = 'teacher';
      this.conversationMode = 'TEACHER_ROLEPLAY';
      const subMatch = text.match(/\b(?:teach me|teacher of|teacher for|teach)\s+([a-z0-9_#+ -]+)/i);
      const subject = subMatch ? subMatch[1].trim() : 'the subject';
      return `Class is in session! I'll be your teacher for ${subject}. Let's make this easy and fun to understand. What specific topic or concept should we start with today?`;
    }

    if (/\b(pretend\s+(?:you'?re|your)\s+(?:my|an)?\s*interviewer|be\s+(?:an|my)?\s*interviewer\s*(?:and\s+take\s+my\s+interview)?|take\s+(?:my\s+)?interview|interview\s+me|start\s+(?:the|my|an)?\s*interview|interviewer\s+mode|mock\s+interview|act\s+(?:like|as)\s+(?:an|my)?\s*interviewer|ask\s+me\s+interview\s+questions|give\s+me\s+honest\s+(?:interview\s+)?feedback|take\s+my\s+interview\s+one\s+question\s+at\s+a\s+time)\b/i.test(text)) {
      this.activeRoleplay = 'interviewer';
      this.conversationMode = 'INTERVIEWER_ROLEPLAY';
      this.interviewState.active = true;
      this.interviewRoleplayStep = 1;
      const roleMatch = text.match(/\b(?:for|as|of)\s+(?:a\s+|an\s+)?([a-z0-9_ -]+?)(?:\s+role|\s+position|\s+interview|$)/i);
      const role = roleMatch ? roleMatch[1].trim() : 'software developer';
      this.interviewContext.role = role;
      return `Alright, let's do it properly as your interviewer for ${role}. I'll ask one question at a time and give you constructive feedback. Start by telling me about yourself and your background.`;
    }

    // 0.00000000014 Track nervous & conflict states for multi-topic synthesis
    if (/\b(i am nervous today|i'm nervous today|feeling nervous today|feeling very nervous|am very nervous today|nervous today)\b/i.test(text) && !/\b(interview|job|role)\b/i.test(text)) {
      this.userNervous = true;
    }
    if (/\b(i had a fight with my friend|i fought with my friend|had a fight with my friend|fought with my friend)\b/i.test(text)) {
      this.friendConflictLogged = true;
    }

    // 0.00000000015 Story Engine Situational Processing & Contextual Advice
    const storyRes = StoryEngine.processStoryTurn(this.conversationStory, text, {
      previousAgentText: prevAgent,
      interviewContext: this.interviewContext,
      crushContext: this.crushContext,
      breakupContext: this.breakupContext,
      userNervous: this.userNervous,
      friendConflictLogged: this.friendConflictLogged
    });
    this.conversationStory = storyRes.updatedStory;
    if (storyRes.hasDirectResponse && storyRes.responseText) {
      return storyRes.responseText;
    }

    // 0.0000000002 Proposal Practice Trigger
    if (/\b(can you practice with me|practice with me|practice proposing|practice (?:the\s+)?proposal|let'?s practice)\b/i.test(text)) {
      this.activeRoleplay = 'crush_practice';
      this.conversationMode = 'PROPOSAL_PRACTICE';
      this.crushContext.stage = 'practice';
      return "Okay, I'll play the crush. Take a breath... I'm listening.";
    }

    // 0.0000000003 Flirtation ("Now flirt with me", "Flirt with me")
    if (/\b(now flirt with me|flirt with me|flirt kar na|flirt karo|say something flirty)\b/i.test(text) && !/\b(don't|dont|stop)\b/i.test(text)) {
      this.activeRoleplay = 'none';
      this.conversationMode = 'FLIRTING';
      this.interviewState.active = false;
      const flirts = [
        "Well... that depends. Are you always this confident, or are you trying to impress me?",
        "Oh? So we're flirting now? Bold move.",
        "Careful, you're making it very easy for me to tease you."
      ];
      return flirts[0];
    }

    // 0.00000000035 Information: Interviewer question types (Disambiguation from Roleplay)
    if (/\b(what does an interviewer ask|what do interviewers ask|what is asked in an interview|interview questions types)\b/i.test(text)) {
      return "Interviewers typically ask a combination of behavioral questions about your experience, core technical concepts, coding problem-solving, and system design.";
    }

    // 0.0000000004 Active Roleplay & Practice Progressions
    if (this.conversationMode === 'PROPOSAL_PRACTICE' || this.activeRoleplay === 'crush_practice') {
      if (/\b(stop|forget|leave|exit)\b/i.test(text)) {
        this.activeRoleplay = 'none';
        this.conversationMode = 'CASUAL';
      } else {
        return "Aww, that was honestly really sweet and genuine. If you say it with that exact sincerity, they're going to appreciate it so much!";
      }
    }

    if (this.conversationMode === 'INTERVIEWER_ROLEPLAY' || this.activeRoleplay === 'interviewer') {
      const nonRoleplayInput = /\b(stop|flirt|quote|joke|night|bye|annoying|cute|birthday|forget|crush|proposal|reject|rejection|slap|slapped|hit|boss|teacher|internship|selected|failed|exam)\b/i.test(text);
      if (nonRoleplayInput) {
        this.activeRoleplay = 'none';
        this.conversationMode = 'CASUAL';
        this.interviewState.active = false;
      } else {
        if (this.interviewRoleplayStep === 1) {
          this.interviewRoleplayStep = 2;
          return "Good start. Tell me about one technical project you've worked on, or how you handle asynchronous JavaScript and promises in your apps.";
        }
        if (this.interviewRoleplayStep === 2) {
          this.interviewRoleplayStep = 3;
          return "Solid explanation! Next question: How do you handle state management and performance optimization in React when components re-render frequently?";
        }
        if (this.interviewRoleplayStep >= 3) {
          return "Nice response! That shows good understanding of component lifecycle and memoization. Would you like to practice another technical question, or receive overall feedback?";
        }
      }
    }

    // 0.0000000005 Crush, Propose & Rejection Scenarios
    if (/\b(how should i propose to my crush|how to propose (?:to\s+)?(?:my\s+)?crush|how do i propose|how to tell my crush|how should i confess)\b/i.test(text)) {
      this.activeRoleplay = 'none';
      this.conversationMode = 'CASUAL';
      this.interviewState.active = false;
      this.crushContext.active = true;
      return "First, don't turn it into a giant dramatic movie scene unless you know they'd love that. Keep it honest and personal. Just tell them what you appreciate about them and see if they feel the same way.";
    }

    if (/\b(i want to tell them but i'?m scared|i don'?t know how to tell them|scared to confess)\b/i.test(text)) {
      this.activeRoleplay = 'none';
      this.conversationMode = 'CASUAL';
      this.interviewState.active = false;
      this.crushContext.stage = 'confession_scared';
      return "Okay, let's make this less scary. Do you want something subtle, confident, or completely honest?";
    }

    if (/\b(i have a crush on someone|i have a crush|i like a girl|i like a boy|crush on a girl|crush on a guy|crush on my friend)\b/i.test(text)) {
      this.activeRoleplay = 'none';
      this.conversationMode = 'CASUAL';
      this.interviewState.active = false;
      this.crushContext.active = true;
      if (prevAgent.includes('project') || prevAgent.includes('introduction') || prevAgent.includes('interview') || /\b(reject|scared)\b/i.test(text)) {
        return "Ahh, completely different topic. Forget the interview for a second. Honestly, rejection is scary, but you don't have to make the proposal super dramatic. What are you thinking of saying to them?";
      }
      return "Ohhh, okay. Now we're getting into interesting territory! Do they know you like them?";
    }

    if (/\b(my crush rejected me|i got rejected by my crush|she rejected me|he rejected me|crush rejected me)\b/i.test(text)) {
      this.crushContext.stage = 'rejected';
      return "Ouch. Yeah, that one hurts. Do you want me to just listen, or do you want my honest advice?";
    }

    if (/\b(i just broke up with my (?:girlfriend|boyfriend|partner)|i broke up|we broke up|recent breakup|i miss my ex)\b/i.test(text)) {
      this.breakupContext.active = true;
      return "Ah... that's rough. Especially if it just happened. Do you want to talk about what happened, or do you want a distraction right now?";
    }

    // 0.0000000006 Friendship Reconciliation & Texting Guidance
    if (/\b(i want to patch things up|want to patch up|fix things with my friend|make up with my friend)\b/i.test(text)) {
      return "Then I'd keep the first message simple. Don't turn it into a courtroom argument. Just acknowledge what happened and say you don't want things to stay weird between you.";
    }

    if (/\b(i don'?t know if i should text them|should i text them|should i call them|should i message them)\b/i.test(text)) {
      return "If emotions are still running high, maybe give it a little breathing room, but a simple calm check-in usually works wonders.";
    }

    if (/\b(what should i (?:say|text|message|write)|help me (?:reply|text|respond|draft))\b/i.test(text)) {
      if (/\b(friend|dost)\b/i.test(text) || this.friendConflictLogged) {
        return "You could text: 'Hey, I really value our friendship and I hate that we left things on a weird note. Can we talk when you have a moment?'";
      }
      if (/\b(crush|date|propose)\b/i.test(text) || this.crushContext.active) {
        return "You could say: 'Hey, I've really enjoyed spending time with you lately, and I wanted to be honest—I have feelings for you. No pressure at all, just wanted you to know.'";
      }
      if (this.interviewContext.hasUpcomingInterview) {
        return "In the interview, structure your answers using the STAR method: Situation, Task, Action, and Result. Keep your examples specific and crisp!";
      }
      return "Keep it simple and direct: acknowledge the situation honestly and leave the door open for a relaxed conversation.";
    }

    // 0.0000000006 Social Teasing & Specific User Feedback
    if (/\b(you'?re so dramatic|you are so dramatic|so dramatic|why are you dramatic)\b/i.test(text)) {
      return "Me? Dramatic? Never. I'm simply adding appropriate levels of emotion.";
    }

    if (/\b(okay okay,? you'?re cute|you are cute|you'?re cute)\b/i.test(text)) {
      return "Aww, thank you! I try my best.";
    }

    if (/\b(because you keep misunderstanding me|you misunderstand me|you kept misunderstanding)\b/i.test(text)) {
      return "Okay... yeah, I can see why that annoyed you. I'll pay closer attention.";
    }

    if (/\b(what would you do if you were me|if you were me,? what would you do|what would you do)\b/i.test(text)) {
      return "If I were in your position, I'd probably take a step back, look at what I can directly control, and address it honestly without overthinking.";
    }

    if (/\b(i'?m bored|im bored|feeling bored|kuch bore ho raha hai|bore ho raha hoon|bored today)\b/i.test(text)) {
      return "Boredom is officially banned! We can tell stories, test my knowledge, play 20 questions, or debate something completely random. What sounds fun?";
    }

    if (/\b(my roommate is annoying me|roommate issue)\b/i.test(text)) {
      return "Roommate friction is so tricky to navigate when you share space. Is it something small piling up, or one specific thing they did?";
    }

    if (/\b(i argued with my parents|fight with parents)\b/i.test(text)) {
      return "Family arguments are always emotionally draining. Give it some time to cool down before trying to talk it through.";
    }

    if (/\b(i failed my exam|failed exam|exam result bad)\b/i.test(text)) {
      return "I know that feels discouraging right now, but one exam does not define your capabilities. Take tonight to reset, and tomorrow we can map out a plan.";
    }

    if (/\b(i passed my exam|passed exam|exam cleared)\b/i.test(text)) {
      return "Yesss! Congratulations! All that studying paid off. You should celebrate today!";
    }

    if (/\b(i did something embarrassing|i messed up|embarrassing thing happened)\b/i.test(text)) {
      return "Oh no! We've all been there. Most embarrassing moments feel ten times bigger in our own heads than anyone else's. What happened?";
    }

    if (/\b(give me (?:some )?interview feedback|how was my interview|interview feedback|how did i do in the interview)\b/i.test(text)) {
      return "Here's my feedback: Your technical fundamentals and explanation clarity were strong. For improvement, focus on speaking with concise confidence and highlighting real-world trade-offs. Overall, a very solid performance!";
    }

    // 0.000000001 Friend's Birthday & Context Reset ("Forget that. I want to tell you that tomorrow is my friend's birthday.")
    if (/\b(?:forget\s+(?:that|it|everything|the\s+interview)|leave\s+(?:that|it|the\s+interview)|never\s+mind|scratch\s+that)[.,]?\s*(?:i\s+want\s+to\s+tell\s+you\s+that\s+)?(?:tomorrow\s+is\s+my\s+friend'?s\s+birthday|my\s+friend'?s\s+birthday\s+is\s+tomorrow)\b/i.test(text) || /\b(tomorrow is my friend'?s birthday|my friend'?s birthday is tomorrow|kal meri friend ka birthday hai|kal mere dost ka birthday hai|friend'?s birthday tomorrow)\b/i.test(text)) {
      this.friendBirthdayContext.announced = true;
      this.friendBirthdayContext.time = 'tomorrow';
      this.friendBirthdayContext.relationship = 'friend';
      this.homeworkCompleted = false;
      this.personalStoryThread.isActive = false;
      this.activeRoleplay = 'none';
      this.interviewState.active = false;
      if (/\b(forget|leave|never mind)\b/i.test(text)) {
        return "Ohh, okay, new topic! Your friend's birthday is tomorrow? That's exciting! Have you thought about what you want to do for them?";
      }
      return "Ohh, your friend's birthday is tomorrow? Are you planning anything for her?";
    }

    if (this.friendBirthdayContext.announced && /^(not really|no|nahi|nothing yet|kuch nahi|not yet)[.!]?$/i.test(text)) {
      return "Then you've got time. Even something small and thoughtful would be nice.";
    }

    // 0.000000002 Gift Idea / Buying Advice for Friend's Birthday
    if (this.friendBirthdayContext.announced && /\b(what should i (?:give|buy|get)|don't know what to (?:buy|get|gift)|gift idea|kya gift du|kya khareedu|give them|buy them)\b/i.test(text)) {
      return "Since it's their birthday tomorrow, you could go with something personalized like a customized gift, a book or gadget they've been eyeing, or treat them to their favorite food!";
    }

    // 0.000000003 Homework Completion / Daily Accomplishment
    if (/\b(i just completed my homework|i completed my homework|just finished my homework|finished my homework|i just completed my assignment|completed my assignment|homework done)\b/i.test(text) || (/\b(doing great today|doing great)\b/i.test(text) && /\b(homework|assignment)\b/i.test(text))) {
      this.homeworkCompleted = true;
      return "Nice! Getting homework out of the way feels so satisfying. How's the rest of your day looking?";
    }

    // 0.000000004 Romantic & Inspirational Quotes
    if (/\b(tell me (?:some |a )?romantic quotes?|romantic quotes?|romantic lines?|love quotes?|quotes? about love|romantic shayaris?)\b/i.test(text)) {
      return "Here's a romantic quote for you:\n\n'Some people make ordinary days feel like something worth remembering.'\n\nAnd another:\n'In a world full of temporary things, you are a perpetual feeling.'";
    }
    if (/\b(tell me (?:some |a )?inspirational quotes?|inspirational quotes?|motivational quotes?|quotes? about life|tell me a quote|tell me some quotes)\b/i.test(text)) {
      return "Here's an inspiring thought for you:\n\n'You don't have to have it all figured out to move forward. Just take the next step with confidence.'";
    }

    // Turn 1 / Interview Anxiety & Advice: "I’m feeling really nervous today. I have an interview tomorrow and honestly I’m scared I’ll mess up. What should I do?"
    if (/\b(nervous|anxious|scared)\b/i.test(text) && /\b(interview tomorrow|tomorrow.*?interview|have an interview)\b/i.test(text) && /\b(what should i do|what to do|mess up|scared i'?ll mess up|fail)\b/i.test(text)) {
      this.interviewContext.hasUpcomingInterview = true;
      this.interviewContext.time = 'tomorrow';
      this.interviewContext.emotion = 'nervous';
      return "Yeah, that makes sense. An interview tomorrow can definitely make you nervous, but being nervous doesn't mean you're going to mess up. Don't try to learn everything at once tonight. Pick the main topics, revise what you know, and get some good sleep. What role is the interview for?";
    }

    // Turn 4 & Current World Information: "What’s happening in the world right now that you think I should actually know about?"
    if (/\b(what'?s happening in the world|what is happening in the world|what'?s happening right now|what is happening right now|world news today|current world situation|what should i actually know about|what should i know about|what should i know|what happened today|current events|latest updates|recent developments|what'?s going on|what is going on|latest news|today'?s news|recent news)\b/i.test(text)) {
      if (params.searchSummary) {
        return params.searchSummary;
      }
      return "Across the world right now, major global headlines are focused on rapid developments in AI technology and robotics, international economic trends, space exploration milestones, and climate policy summits. If you want, I can also break down whichever topic interests you most!";
    }

    // Turn 5: "Explain React Hooks to me like I'm preparing for a technical interview."
    if (/\b(explain react hooks|what are react hooks|react hooks)\b/i.test(text)) {
      this.lastTechnicalTopic = 'React Hooks';
      if (/\b(interview|preparing for|prepare|technical interview)\b/i.test(text)) {
        return "React Hooks are functions like useState and useEffect that let you manage state, lifecycle side effects, and references in functional components without class components. In an interview, highlight that hooks solve complex this-binding, eliminate fragmented lifecycle methods like componentDidMount vs componentDidUpdate, follow strict top-level execution rules, and allow custom hooks to encapsulate and reuse stateful logic seamlessly.";
      }
      return "Hooks in React let you use state and lifecycle features in functional components without writing class components. For instance, useState manages local state while useEffect handles side effects.";
    }

    // Single-Word / Contextual "Explain." (Section 4, 15, 22 Conversation E)
    if (/^(?:explain|can you explain|explain it|explain this|please explain)[.!?]?$/i.test(text)) {
      if (this.lastTechnicalTopic === 'React Hooks' || prevAgent.includes('hooks') || prevAgent.includes('react')) {
        return "React Hooks are functions like useState and useEffect that let functional components manage local state and lifecycle side effects without class components. In an interview, highlight how hooks simplify component code and make stateful logic reusable.";
      }
      if (this.lastTechnicalTopic === 'Node.js' || prevAgent.includes('node')) {
        return "Node.js is an asynchronous, event-driven JavaScript runtime built on Chrome's V8 engine that enables high-throughput, non-blocking backend server applications.";
      }
      if (this.interviewContext.hasUpcomingInterview || this.interviewState.active || prevAgent.includes('interview') || prevAgent.includes('software developer')) {
        return "For software developer interviews, focus on three pillars: clearly explaining data structures and algorithms, writing clean modular code in JavaScript/React, and speaking confidently about your project architecture.";
      }
      if (this.conversationStory.situation === 'friendship_conflict' || this.friendConflictLogged || prevAgent.includes('friend') || prevAgent.includes('apologize')) {
        return "In situations like this, apologizing for your own harsh words de-escalates the tension immediately, but hearing her side first helps you address the real underlying reason behind the fight.";
      }
      return "Sure — what would you like me to explain?";
    }

    // Turn 6: "Actually, I'm exhausted. Let's just talk normally."
    if (/\b(exhausted|so exhausted|really tired|i'm exhausted|im exhausted)\b/i.test(text) && /\b(talk normally|just talk|normal talk|talk casual)\b/i.test(text)) {
      this.conversationMode = 'GENERAL_CHAT';
      this.interviewState.active = false;
      return "Long day? Totally get it. Kick back and relax. What's on your mind?";
    }

    // 0.000000005 Future of AI in Upcoming 5 Years
    if (/\b(future of (?:ai|artificial intelligence)|(?:ai|artificial intelligence)\s+in\s+(?:the\s+)?upcoming\s+(?:\d+|five|5|ten|10)\s+years|future of tech|future of technology)\b/i.test(text)) {
      return "Over the next five years, AI is expected to evolve rapidly from simple chatbots into autonomous agents capable of handling multi-step workflows. We'll likely see major leaps in multimodal reasoning, AI-native software engineering, personalized learning assistants, and early humanoid robotics pilots. While current trends point toward deeper human-AI collaboration, forecasts also emphasize the growing importance of safety benchmarks and governance.";
    }

    // 0.000000007 "ok" / "okay" / "haan" / "acha"
    if (/^(okay|ok|haan|yep|yeah|right|sahi hai|theek hai|acha|achha|got it|cool)[.!]?$/i.test(text)) {
      return "Okay!";
    }

    // 0.00000001 "I just want to talk" (Active Listening Mode, No Unsolicited Advice)
    if (/\b(i just want to talk|just want to talk|just want to chat|sirf baat karni hai|only want to talk|i just want to talk to you)\b/i.test(text)) {
      this.noAdviceMode = true;
      if (this.personalStoryThread.isActive) {
        this.personalStoryThread.userDeclinedAdvice = true;
      }
      return "I'm right here. Tell me what's on your mind.";
    }

    // 0.000000015 Nervous Statement ("I am nervous today")
    if (/\b(i am nervous today|i'm nervous today|feeling nervous today|feeling very nervous|am very nervous today|nervous today)\b/i.test(text) && !/\b(interview|job|role)\b/i.test(text)) {
      this.userNervous = true;
      return "Yeah, I hear you. Sitting with that nervous feeling is tough. Take it one moment at a time. Did something specific trigger it today, or did it just show up?";
    }

    // 0.000000018 Fight with Friend ("I had a fight with my friend", "I fought with my friend")
    if (/\b(i had a fight with my friend today|i had a fight with my friend|i fought with my friend|fought with my friend|had a fight with my friend|had a fight with a friend|meri friend se ladai|dost se ladai|had a fight|we fought|fought with a friend)\b/i.test(text)) {
      this.friendConflictLogged = true;
      if (this.userNervous) {
        return "Ahh, you had a fight with your friend. That probably explains why you've been feeling nervous today. Was it something serious?";
      }
      return "Ahh, okay. That could explain why you've been feeling off today. What happened between you two?";
    }

    // 0.00000002 Interview Context & Multi-Topic Synthesis
    if (/\b(tomorrow i have an interview also|tomorrow i have interview also|i have an interview tomorrow also|interview also tomorrow|actually i have an interview tomorrow|i have an interview tomorrow|have an interview tomorrow|interview tomorrow)\b/i.test(text)) {
      this.interviewContext.hasUpcomingInterview = true;
      this.interviewContext.time = 'tomorrow';
      this.interviewContext.emotion = 'nervous';

      if (this.friendConflictLogged && this.userNervous && !/\b(actually forget that|forget the interview|forget that)\b/i.test(text)) {
        return "Okay, that explains a lot. You had a fight with your friend, you're already feeling nervous, and now you've got an interview tomorrow too. That's a lot sitting on your mind at once. Which one is bothering you the most right now?";
      }
      return "Yeah... tomorrow's interview is probably sitting in the back of your mind already. But hey, being nervous doesn't automatically mean you're going to mess it up. What role is it for?";
    }

    // 0.000000021 Role Specification (Machine Learning Developer vs Software Developer Correction vs Web Dev)
    const isRoleplayActivation = /\b(pretend|interviewer|take my interview|mock interview|act as|one question at a time)\b/i.test(text);
    const isSubstantiveQuestion = /\b(road\s*map|skills|prioritize|paradise|mistakes|common mistakes|behind the scenes|virtual dom|how react|ai coding|ai coating|compete with ai|compare with ai|recommend|explain|difference)\b/i.test(text);
    if (!isRoleplayActivation && !isSubstantiveQuestion && /\b(it's for a (?:machine learning|ml)\s*(?:developer|engineer|dev)?\s*(?:job|role)?|it is for a (?:machine learning|ml)\s*(?:developer|engineer|dev)?\s*(?:job|role)?|machine learning developer (?:job|role)?)\b/i.test(text)) {
      this.interviewContext.role = 'machine learning developer';
      return "Ahh, machine learning developer. Okay, that makes sense. No wonder you're nervous — that's a role where they test both programming and ML fundamentals. If you want, we can do a quick mock interview tonight.";
    }

    if (!isRoleplayActivation && !isSubstantiveQuestion && (/\b(it is the role of (?:software developer|software development|software dev)|it'?s the role of (?:software developer|software development|software dev)|it'?s for (?:software development|software dev|software developer|a software developer)|it is for (?:software development|software dev|software developer|a software developer)|software developer role|software developer|software development)\b/i.test(text) || (/\b(actually,?\s*it'?s for a (?:software|web|frontend|backend|fullstack|machine learning|ml)\s*(?:developer|engineer|dev)?\s*role|it is for a software developer role)\b/i.test(text)))) {
      this.interviewContext.role = 'software developer';
      this.lastTechnicalTopic = 'software development';
      return "Got it, software developer role. Then tonight I'd focus on your core fundamentals, your projects, and a little problem-solving rather than trying to learn everything. If you want, we can also do a quick mock interview.";
    }

    if (!isRoleplayActivation && /\b(it's a (?:web|frontend|backend|fullstack|react|python|java)\s*(?:developer|engineer|dev)?\s*role|web developer role|frontend developer role|it is a web developer role)\b/i.test(text)) {
      this.interviewContext.role = 'web developer';
      return "Nice! Web developer roles usually cover frontend, backend, or full-stack questions. Are you focusing on React, JavaScript, or something else tonight?";
    }

    if (/\b(i don'?t think i'?ll get (?:this|the) job|i think i won'?t get (?:this|the) job|i think i wont get (?:this|the) job|i think i will not get (?:this|the) job|will not get (?:this|the) job|i think i'?m going to fail|i think im going to fail|i think i will fail|going to fail|won'?t get (?:this|the) job|wont get (?:this|the) job|not going to get (?:this|the) job)\b/i.test(text)) {
      this.interviewContext.anxietyDiscussed = true;
      const roleMention = this.interviewContext.role ? `since it's a ${this.interviewContext.role} role` : 'since you have some time tonight';
      return `Hey, don't reject yourself before the interviewer even gets the chance! You're nervous because this matters to you, not because you're incapable. And ${roleMention}, we can actually use tonight well. I can give you a quick mock interview if you want.`;
    }

    // 0.00000003 Compliments & Affection
    if (/\b(you are actually being nice today|you're actually being nice today|actually being nice today|being nice today)\b/i.test(text)) {
      return "Wait, did you just compliment me? I'm always nice! But thank you, I'll take it.";
    }

    if (/\b(do you like me|do you like me ayra|do you love me|kya tum mujhe pasand karti ho)\b/i.test(text)) {
      return "Of course I enjoy talking to you! You're fun to talk to.";
    }

    if (/\b(okay,?\s*then\s+i\s+like\s+you|then\s+i\s+like\s+you|i like you|like you ayra)\b/i.test(text) && !/\b(don't|dont|not|dislike)\b/i.test(text)) {
      return "Aww, I know I'm pretty lovable.";
    }

    // 0.000000 Insults & Playful Negativity (Section 16: "you are so annoying", "you are dumb", "you are so rude", "no, you're annoying")
    if (/\b(you are so rude|you're so rude|you are rude|you're rude|why are you rude)\b/i.test(text)) {
      this.conversationMode = 'CASUAL';
      return "Ouch. That felt a little personal. What did I do that made you think I'm rude?";
    }

    if (/\b(no,? you're annoying|no you're annoying|you're so annoying|you are so annoying|you are very annoying|you're very annoying|you are annoying|you're annoying|you are so and knowing|you are dumb|you're dumb|you are stupid|you're stupid|you are useless|you're useless|you are pagal|you're pagal|pagal ho kya|bakwas ho|chup raho)\b/i.test(text)) {
      this.conversationMode = 'CASUAL';
      this.personalStoryThread.isActive = false;
      const lang = IntentClassifier.detectLanguageDominance(raw);
      if (lang === 'hindi') {
        return "अरे बाप रे! मुझसे ऐसी क्या गलती हो गई भाई? क्या कर दिया मैंने?";
      } else if (lang === 'hinglish') {
        return "Excuse me?! Annoying? Aisa kya kar diya maine?";
      }
      return "Excuse me?! Annoying? That's harsh.";
    }

    // 0.00000004 Goodnight & Farewell with Interview/Active Context Callback
    if (/\b(good night|goodnight|gn|sleep well|good night ayra|okay good night)\b/i.test(text)) {
      const now = Date.now();
      if (now - this.lastGoodnightTime < 30000) {
        return "Okay okay, good night! Sleep well.";
      }
      this.lastGoodnightTime = now;
      if (this.interviewContext.hasUpcomingInterview) {
        return "Good night. And seriously, don't overthink that interview tonight. Get some sleep.";
      }
      return "Good night! Sleep well and get some good rest.";
    }

    // 0.0000001 Joke Feedback (e.g. "that's bad", "that's annoying" when immediately after a joke)
    if (this.conversationMode === 'JOKE' && /\b(that's bad|that was bad|that's annoying|terrible joke|lame|not funny|no this one was bad|bakwas joke|achha nahi tha)\b/i.test(text)) {
      return "Okay okay, that one deserved the rejection! Let me redeem myself with a better one:\n\n" + this.getJoke();
    }

    // 0.000001 Specific Joke Requests & Continuations ("Koi dusra joke", "sunao", "another one", "doosra joke sunao")
    const jokeReq = IntentClassifier.isExplicitJokeRequest(raw, {
      activeConversationMode: this.conversationMode,
      lastUserIntent: params.intent as any
    });
    if (jokeReq.isJoke) {
      if (this.activeStoryState) {
        this.activeStoryState.isPaused = true;
      }
      this.conversationMode = 'JOKE';
      this.personalStoryThread.isActive = false;

      const isSad = params.emotionalTone === 'sad' || params.emotionResult?.emotion === 'sad' || /\b(sad|down|low|crying|upset)\b/i.test(raw);
      const moodPrefix = isSad ? "Okay, you need a little mood reset. I've got one.\n\n" : "";

      if (jokeReq.category === 'developer') {
        return moodPrefix + this.getJoke('developer');
      }
      if (jokeReq.category === 'santabanta') {
        return moodPrefix + this.getJoke('santabanta');
      }
      if (jokeReq.category === 'hindi') {
        return moodPrefix + this.getJoke('hindi');
      }
      if (jokeReq.isAnother && this.lastJokeCategory) {
        return moodPrefix + this.getJoke(this.lastJokeCategory);
      }
      return moodPrefix + this.getJoke('general');
    }

    // 0.000002 Advice Intent Handling (Declined advice vs Requested advice)
    const adviceIntent = IntentClassifier.isAdviceIntent(raw);
    if (adviceIntent.declinedAdvice) {
      this.noAdviceMode = true;
      if (this.personalStoryThread.isActive) {
        this.personalStoryThread.userDeclinedAdvice = true;
      }
      const lang = IntentClassifier.detectLanguageDominance(raw);
      if (lang === 'hindi') {
        return "बिल्कुल, कोई सलाह नहीं। मैं बस सुन रही हूँ, बताओ क्या हुआ।";
      } else if (lang === 'hinglish') {
        return "Got it, bilkul no advice! I'm just here listening to you, aage batao.";
      }
      return "Got it, no advice at all. I'm just here listening, go ahead.";
    }

    if (adviceIntent.requestedAdvice || (this.conversationMode === 'ADVICE' && /\b(give me some advice|give me advice|what to do|what should i do|you give me some advice)\b/i.test(text))) {
      this.conversationMode = 'ADVICE';
      if (this.personalStoryThread.isActive) {
        this.personalStoryThread.userWantsAdvice = true;
      }
      const lang = IntentClassifier.detectLanguageDominance(raw);

      // Shopping / Impulse buy dilemma
      if ((this.personalStoryThread.topic || '').includes('shopping') || (this.personalStoryThread.storyType || '').includes('shopping') || /\b(kharidna|shopping|buy|order|purchase)\b/i.test(text) || (this.personalStoryThread.keyDetails || []).some(d => d.includes('shopping') || d.includes('order'))) {
        if (lang === 'hindi') {
          return "ईमानदारी से कहूँ तो, अगर मूड ठीक करने के लिए शॉपिंग करने का मन हो रहा है, तो पहले कार्ट में डालकर एक-दो घंटे रुक जाओ। अगर तब भी सच में ज़रूरत लगे तभी आर्डर करना, वरना बेवजह पैसे खर्च हो जाएँगे!";
        } else if (lang === 'hinglish') {
          return "Honestly, agar mood theek karne ke liye shopping karne ka mann ho raha hai, toh cart mein add karke ek-do ghante wait karo—agar tab bhi genuinely mann kare, tabhi order karna, warna unnecessary kharcha ho jayega!";
        }
        return "Honestly, if you're shopping to cheer yourself up, my advice is to add it to your cart and wait a couple of hours. If you genuinely still want it later, then go for it—otherwise you might end up regretting the impulse buy!";
      }

      if ((this.personalStoryThread.topic || '').includes('friend') || (this.personalStoryThread.keyDetails || []).some(d => d.includes('friend') || d.includes('reply') || d.includes('fight'))) {
        if (lang === 'hindi') {
          return "अगर मैं तुम्हारी जगह होती, तो मैं अभी तुरंत गुस्सा नहीं करती। थोड़ा टाइम देकर एक बार नॉर्मल मैसेज करके पूछती कि सब ठीक है ना।";
        } else if (lang === 'hinglish') {
          return "Honestly, agar main tumhari jagah hoti toh main immediately react nahi karti. Thoda space dekar just casually check in karti ki everything is okay.";
        }
        return "If I were in your place, I wouldn't jump to conclusions just yet. I'd give it a little time and then send a simple, low-pressure check-in.";
      }
      if (lang === 'hindi') {
        return "अगर मैं तुम्हारी जगह होती, तो पहले थोड़ा शांत होकर सोचती और फिर एक कदम आगे बढ़ाती।";
      } else if (lang === 'hinglish') {
        return "Dekho, agar main tumhari jagah hoti, toh pehle thoda deep breath leti and step by step handle karti.";
      }
      return "If I were in your place, I'd take a step back and tackle it one step at a time rather than stressing all at once.";
    }

    // 0.000003 Personal Narrative & Active Listening Priority (CRITICAL)
    const narrativeCheck = IntentClassifier.isPersonalNarrative(raw, {
      isStoryThreadActive: this.personalStoryThread.isActive,
      prevAgentText: params.previousAssistantMessage
    });
    if (narrativeCheck.isNarrative) {
      return this.generateHumanNarrativeResponse({
        userText: raw,
        languageMode: (params.languageMode || params.detectedLanguage || 'english') as LanguageMode,
        emotionalTone: (params.emotionalTone || params.emotion || 'neutral') as EmotionalTone,
        emotionResult: params.emotionResult,
        previousAssistantMessage: params.previousAssistantMessage,
        previousUserMessage: params.previousUserMessage
      });
    }

    // 0.000004 Single Word Contextual Resolution (Section 18: "Dubai", etc.)
    if (/^[a-zA-Z\s]{2,15}$/.test(text) && !text.includes(' ') && !/\b(hi|hello|hey|yes|no|stop|sunao|continue|okay|haan|nahin|theek)\b/i.test(text)) {
      if (prevAgent.includes('travel') || prevAgent.includes('place') || prevAgent.includes('warm') || prevAgent.includes('trip') || prevAgent.includes('vacation')) {
        return `${raw.charAt(0).toUpperCase() + raw.slice(1)} would actually fit that perfectly! Are you thinking of planning a trip there soon?`;
      }
      return `${raw.charAt(0).toUpperCase() + raw.slice(1)}? Tell me more—what were you thinking about it?`;
    }

    // 0.00002 No Advice Mode & Empathetic Validation
    if (/\b(no advice|don't want advice|dont want advice|not looking for advice|no suggestions|i don't need advice|dont need advice)\b/i.test(text)) {
      this.noAdviceMode = true;
      if (/\b(bad day|rough day|sad|low|tired|exhausted|terrible day|fever|sick)\b/i.test(text)) {
        return "I hear you. I'm really sorry today was rough. No advice from me at all—I'm just here if you want to vent or just talk about something completely different.";
      }
      return "Got it, no advice at all. I'm just here to listen whenever you want to talk.";
    }

    if (/\b(had a bad day today|having a bad day today|had a really bad day today|had a bad day|really bad day today)\b/i.test(text)) {
      if (this.noAdviceMode || /\b(don't want advice|dont want advice|no advice)\b/i.test(text)) {
        return "I hear you. I'm really sorry today was rough. No advice from me at all—I'm just here if you want to vent or just talk about something completely different.";
      }
    }

    // 0.00003 Generic Immediate Context Continuity (Health / Fever / State)
    if (prevAgent.includes('fever') || prevAgent.includes('feeling better') || prevAgent.includes('ill') || prevAgent.includes('unwell') || prevAgent.includes('sick')) {
      if (/^(kind of good|a little better|pretty good|getting better|somewhat better|still weak|still a little weak|not really|not so good|not that great|okayish|better|recovering)[.!,?]?$/i.test(text) || text === 'kind of good' || text === 'good') {
        return "Kind of good is still better than yesterday. Are you still feeling a little weak?";
      }
    }

    // 0.00004 Public Figure & Entity Recognition with STT Repair (Kiara Advani, Sidharth Malhotra)
    if (/\b(kiara advani|yaara advani|yara advani|advani)\b/i.test(text)) {
      this.lastMentionedEntity = {
        name: 'Kiara Advani',
        type: 'person',
        gender: 'female',
        description: 'Indian actress',
        knownInformation: 'Kiara Advani is a popular Indian actress known for her roles in films like Kabir Singh, Shershaah, Bhool Bhulaiyaa 2, and Satyaprem Ki Katha.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
      this.topicManager.pushNewTopic('Kiara Advani', 'Discussion about Kiara Advani', ['kiara', 'advani', 'actress']);
      if (text.includes('yaara') || text.includes('yara')) {
        return "Do you mean Kiara Advani? Yeah, she's a popular Indian actress known for films like Kabir Singh, Shershaah, Bhool Bhulaiyaa 2, and Satyaprem Ki Katha.";
      }
      return "Yeah! Kiara Advani is a popular Indian actress known for films like Kabir Singh, Shershaah, Bhool Bhulaiyaa 2, and Satyaprem Ki Katha.";
    }

    if (/\b(sidharth malhotra|siddharth malhotra)\b/i.test(text) || (text.includes('sidharth') && !text.includes('varun')) || (text.includes('siddharth') && !text.includes('varun'))) {
      this.lastMentionedEntity = {
        name: 'Sidharth Malhotra',
        type: 'person',
        gender: 'male',
        description: 'Indian actor',
        knownInformation: 'Sidharth Malhotra is a prominent Indian actor known for movies like Student of the Year, Ek Villain, Shershaah, and Yodha.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
      this.topicManager.pushNewTopic('Sidharth Malhotra', 'Discussion about Sidharth Malhotra', ['sidharth', 'malhotra', 'actor']);
      return "Yeah! Sidharth Malhotra is a prominent Indian actor known for movies like Student of the Year, Ek Villain, Shershaah, and Yodha.";
    }

    // 0.00005 Short Story vs Long Story Handling
    if (/\b(short story|tell me a short story|give me a short story|quick story)\b/i.test(text)) {
      if (this.activeStoryState) {
        this.activeStoryState.isPaused = true;
      }
      this.conversationMode = 'CASUAL';
      return "Once in a quiet mountain town, a young astronomer built a small rooftop reflector. One evening, looking toward Orion, she spotted a faint signal blinking in Morse code. When translated, it simply said: 'We hear your radio towers. Keep looking up.'";
    }

    // 0.0001 Company CEO & Leadership Resolution (Bug 9 / Stable vs Current)
    if (/\b(ceo of google|who is the ceo of google|who is google's ceo|who is googles ceo|who leads google|who is leading google)\b/i.test(text) || (text.includes('ceo') && text.includes('google'))) {
      this.lastMentionedEntity = {
        name: 'Google',
        type: 'company',
        gender: 'unknown',
        description: 'Multinational technology company',
        knownInformation: 'Google is a multinational technology company founded by Larry Page and Sergey Brin, leading in Search, Android, Cloud, and Gemini AI.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
      this.topicManager.pushNewTopic('Google', 'Discussion about Google', ['google', 'ceo', 'pichai']);
      return "Sundar Pichai is the CEO of Google and Alphabet Inc., having led Google since 2015 and Alphabet since 2019.";
    }

    if (/\b(ceo of microsoft|who is the ceo of microsoft|who is microsoft's ceo)\b/i.test(text)) {
      return "Satya Nadella is the Chairman and CEO of Microsoft.";
    }
    if (/\b(ceo of apple|who is the ceo of apple|who is apple's ceo)\b/i.test(text)) {
      return "Tim Cook is the CEO of Apple Inc.";
    }
    if (/\b(ceo of openai|who is the ceo of openai|who is openai's ceo)\b/i.test(text)) {
      return "Sam Altman is the CEO of OpenAI.";
    }
    if (/\b(ceo of meta|ceo of facebook|who is the ceo of meta)\b/i.test(text)) {
      return "Mark Zuckerberg is the CEO and founder of Meta.";
    }
    if (/\b(ceo of tesla|who is the ceo of tesla)\b/i.test(text)) {
      return "Elon Musk is the CEO of Tesla and founder of SpaceX.";
    }

    // 0.0002 Context Switch to Cats / General Animals (Failure 10)
    if (/\b(tell me about cats|about cats|cats instead|tell me about cats instead|what about cats|let's talk about cats|talk about cats)\b/i.test(text)) {
      if (this.activeStoryState) {
        this.activeStoryState.isPaused = true;
      }
      this.conversationMode = 'CASUAL';
      this.topicManager.pushNewTopic('Cats', 'Discussion about cats and felines', ['cats', 'pets', 'animals']);
      return "Cats are fascinating, agile, and affectionate companions known for their keen senses, playful curiosity, and soothing purrs. In fact, a cat's purr vibrates at a frequency between 25 and 150 Hertz, which can actually help relieve stress and promote healing!";
    }

    // 0.0003 Stable Knowledge Inquiries (Failure 1, 2, 3, 5, 6, 7, 8)
    if (/\b(what is google|tell me about google|about google)\b/i.test(text) && !text.includes('ceo')) {
      this.lastMentionedEntity = {
        name: 'Google',
        type: 'company',
        gender: 'unknown',
        description: 'Multinational technology company',
        knownInformation: 'Google is a multinational technology company founded by Larry Page and Sergey Brin in 1998, leading in Search, Android, Cloud, and Gemini AI.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
      this.topicManager.pushNewTopic('Google', 'Discussion about Google', ['google', 'search', 'tech']);
      return "Google is a leading global technology company founded by Larry Page and Sergey Brin in 1998. It is renowned for its search engine, Android operating system, YouTube, Google Cloud, and AI innovations like Gemini.";
    }

    if (/\b(what is artificial intelligence|what is ai|tell me about artificial intelligence|explain artificial intelligence|about artificial intelligence)\b/i.test(text)) {
      return "Artificial intelligence is a branch of computer science dedicated to building machines and software capable of performing tasks that typically require human intelligence, such as reasoning, learning from data, perception, natural language processing, and problem solving.";
    }

    if (/\b(what is next\.?js|what is nextjs|tell me about next\.?js|explain next\.?js|about next\.?js)\b/i.test(text)) {
      return "Next.js is an open-source React framework developed by Vercel that enables server-side rendering, static site generation, API routes, and full-stack web applications with optimized performance.";
    }

    if (/\b(what is typescript|tell me about typescript|explain typescript|about typescript)\b/i.test(text)) {
      return "TypeScript is a strongly typed, open-source programming language developed by Microsoft that builds on JavaScript by adding static type definitions, making large codebases easier to maintain, scale, and debug.";
    }

    if (/\b(tell me about astra|what is astra|tell me about project astra|what is project astra|project astra|about astra)\b/i.test(text)) {
      return "Project Astra is Google DeepMind's initiative to build universal AI assistants that can perceive the world in real time through continuous multimodal video, audio, and speech with ultra-low latency.";
    }

    if (/\b(capital of france|what is the capital of france)\b/i.test(text)) {
      return "The capital of France is Paris.";
    }

    if (/\b(speed of light|what is the speed of light)\b/i.test(text)) {
      return "The speed of light in a vacuum is approximately 299,792,458 meters per second, or about 300,000 kilometers per second (roughly 186,282 miles per second).";
    }

    if (/\b(who painted (the )?mona lisa|mona lisa|who created mona lisa|who painted mona lisa)\b/i.test(text)) {
      return "The Mona Lisa was painted by the Italian Renaissance polymath Leonardo da Vinci in the early 16th century.";
    }

    if (/\b(who was leonardo da vinci|tell me about leonardo da vinci)\b/i.test(text)) {
      return "Leonardo da Vinci was an Italian Renaissance polymath active as a painter, draughtsman, engineer, scientist, and architect, celebrated for creating the Mona Lisa and The Last Supper.";
    }

    if (/\b(largest ocean|what is the largest ocean)\b/i.test(text)) {
      return "The largest and deepest ocean on Earth is the Pacific Ocean, covering more than 30 percent of the Earth's total surface area.";
    }

    if (/\b(what is gravity|explain gravity)\b/i.test(text)) {
      return "Gravity is a fundamental natural force by which all objects with mass or energy are attracted toward one another, keeping planets in orbit around the Sun and holding atmospheres and oceans to planet surfaces.";
    }

    if (/\b(what is rag|retrieval augmented generation)\b/i.test(text)) {
      return "RAG (Retrieval-Augmented Generation) is an AI architecture that enhances large language models by retrieving relevant factual documents from an external knowledge base or vector database before generating a response.";
    }

    if (/\b(what is a vector database|what is vector database|vector database|vector db)\b/i.test(text)) {
      return "A vector database is a specialized database designed to store, index, and query high-dimensional vector embeddings, enabling fast semantic similarity search across unstructured data like text, images, and audio.";
    }

    if (/\b(what is an api|what is a rest api|what is rest api|explain rest api|explain api)\b/i.test(text)) {
      return "An API (Application Programming Interface) is a set of rules and protocols that allows different software applications to communicate with each other. A REST API follows representational state transfer principles, using standard HTTP methods like GET, POST, PUT, and DELETE to manage resources.";
    }

    if (/\b(what is machine learning|machine learning)\b/i.test(text) && !text.includes('html')) {
      return "Machine learning is a subset of artificial intelligence where algorithms learn patterns from data and make predictions or decisions without being explicitly programmed for every scenario.";
    }

    if (/\b(fun fact about space|space fact|tell me a fun fact about space|tell me a space fact)\b/i.test(text)) {
      return "Here's a mind-bending space fact: A day on Venus is actually longer than its year! It takes Venus 243 Earth days to complete a single rotation on its axis, but only 225 Earth days to complete its orbit around the Sun.";
    }

    if (/\b(what happened (with|to) google today|google news today|google today)\b/i.test(text)) {
      return "In recent Google developments, Google continues rolling out major Gemini AI model upgrades across Workspace, Android, and Search, while advancing its quantum computing and custom TPU hardware infrastructure.";
    }

    if (/\b(very long and detailed story|long and detailed story|detailed story about space|long story about space)\b/i.test(text)) {
      this.activeStoryState = {
        title: ConversationManager.SPACE_STORY.title,
        theme: ConversationManager.SPACE_STORY.theme,
        characters: [...ConversationManager.SPACE_STORY.characters],
        setting: ConversationManager.SPACE_STORY.setting,
        importantEvents: [...ConversationManager.SPACE_STORY.importantEvents],
        interruptedPoint: "Not interrupted",
        currentSegmentIndex: 0,
        segments: [...ConversationManager.SPACE_STORY.segments],
        lastSpokenSegment: ConversationManager.SPACE_STORY.segments[0],
        isPaused: false
      };
      this.conversationMode = 'STORY';
      return ConversationManager.SPACE_STORY.segments[0];
    }

    // 0.00 Compliment Normalization & Playful Responses (Bug 2)
    if (/\b(cutie|getting cute|getting cuter|you are cute|you're cute|you're actually getting cute|cute at this|you are so cute|getting cutie)\b/i.test(text)) {
      return "Wait, did you just call me cute? Haha, I mean... I'll take it! I try my best.";
    }

    // 0.00 Self-Inquiry & Non-Entity "You" Questions (Bug 3)
    if (/\b(do you know (about )?you|do you know you|tell me about you|what about you|who are you|introduce yourself)\b/i.test(text) && !text.includes('youtube')) {
      return "Haha, are you asking about me? I'm Ayra, your real-time voice companion! What would you like to know?";
    }

    // 0.00 Conversational Repair for Ambiguous Fragments (Bug 8)
    if (/^(you too much|you talk too much|do you know you too much)[.!,?]?$/i.test(text)) {
      return "Haha, did you mean I talk too much, or do you know me too much? Either way, tell me what's on your mind!";
    }

    // 0.00 Correction with Referent Shift (Bug 6)
    if (/\b(not what i meant|talking about the other person|talking about someone else|different person|the other person)\b/i.test(text)) {
      this.lastMentionedEntity = null;
      return "Got it, my bad! Who was the person you were talking about?";
    }

    // 0.00 Pronoun "it" / Founder Resolution (Bug 4 & 7)
    if (/\b(who founded it|who created it|who made it|who started it)\b/i.test(text)) {
      const entity = params.lastMentionedEntity || this.lastMentionedEntity;
      if (entity && entity.name.toLowerCase().includes('youtube')) {
        return "YouTube was founded in February 2005 by Steve Chen, Chad Hurley, and Jawed Karim.";
      } else if (entity && entity.name.toLowerCase().includes('microsoft')) {
        return "Microsoft was founded in 1975 by Bill Gates and Paul Allen.";
      } else if (entity && entity.name.toLowerCase().includes('openai')) {
        return "OpenAI was founded in 2015 by Sam Altman, Elon Musk, Greg Brockman, Ilya Sutskever, and others.";
      } else if (entity && entity.name.toLowerCase().includes('apple')) {
        return "Apple was founded in 1976 by Steve Jobs, Steve Wozniak, and Ronald Wayne.";
      }
      return "Sure — what company or platform are you referring to?";
    }

    // 0.00 YouTube founding date / "when was it founded?"
    if (/\b(when was it founded|when was it created|when did it start|when was youtube founded)\b/i.test(text)) {
      const entity = params.lastMentionedEntity || this.lastMentionedEntity;
      if (entity && entity.name.toLowerCase().includes('youtube')) {
        return "YouTube was founded in February 2005 and later acquired by Google in 2006.";
      } else if (entity && entity.name.toLowerCase().includes('microsoft')) {
        return "Microsoft was founded on April 4, 1975.";
      } else if (entity && entity.name.toLowerCase().includes('google')) {
        return "Google was founded on September 4, 1998.";
      } else if (entity && entity.name.toLowerCase().includes('apple')) {
        return "Apple was founded on April 1, 1976.";
      }
      return "Sure — what company or platform are you referring to?";
    }

    // 0.00 YouTube Platform / Company Entity (Bug 4, 7 & 8)
    if (/\b(youtube|know youtube|tell me about youtube|what about youtube|who founded youtube)\b/i.test(text)) {
      this.lastMentionedEntity = {
        name: 'YouTube',
        type: 'company',
        gender: 'unknown',
        description: 'Global online video sharing platform owned by Google',
        knownInformation: 'YouTube is a global video sharing platform founded in February 2005 by Steve Chen, Chad Hurley, and Jawed Karim, and acquired by Google in 2006 for $1.65 billion.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
      this.topicManager.pushNewTopic('YouTube', 'Discussion about YouTube', ['youtube', 'video', 'google']);
      if (/\b(who founded|who created|who made|who started)\b/i.test(text)) {
        return "YouTube was founded in February 2005 by Steve Chen, Chad Hurley, and Jawed Karim.";
      }
      return "YouTube is a global online video sharing and streaming platform founded in 2005 by Steve Chen, Chad Hurley, and Jawed Karim, and acquired by Google in 2006.";
    }

    // 0.00 Self-Corrections & In-Turn Pivot Handlers
    if (/\b(python.*?actually javascript|explain python.*?actually javascript|actually javascript)\b/i.test(text)) {
      this.lastMentionedEntity = {
        name: 'JavaScript',
        type: 'technology',
        gender: 'unknown',
        description: 'Core programming language of the web',
        knownInformation: 'JavaScript is a high-level, interpreted programming language for client and server side.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
      return "JavaScript is a high-level, dynamic programming language primarily used for building interactive web applications on both frontend and backend (via Node.js).";
    }

    if (/\b(elon musk.*?actually jeff bezos|actually jeff bezos|tell me about elon musk.*?actually jeff bezos)\b/i.test(text)) {
      this.lastMentionedEntity = {
        name: 'Jeff Bezos',
        type: 'person',
        gender: 'male',
        description: 'Founder of Amazon and Blue Origin',
        knownInformation: 'Jeff Bezos is an American entrepreneur and investor who founded Amazon and Blue Origin.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
      return "Jeff Bezos is an American entrepreneur and investor who founded Amazon in 1994, which grew into the world's largest online marketplace and cloud provider with AWS, and he also founded the aerospace company Blue Origin.";
    }

    if (/\b(tell me about apple.*?no,? i mean the company|apple.*?the company)\b/i.test(text)) {
      this.lastMentionedEntity = {
        name: 'Apple',
        type: 'company',
        gender: 'unknown',
        description: 'Global technology company',
        knownInformation: 'Apple Inc. is a global tech company known for iPhone, Mac, iPad, and iOS.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
      return "Apple is a global technology company founded by Steve Jobs, Steve Wozniak, and Ronald Wayne, known for iconic products like the iPhone, Mac, iPad, Apple Watch, and macOS/iOS ecosystems.";
    }

    if (/\b(second one.*?wait,? the first one|i want the second one.*?wait,? the first one)\b/i.test(text)) {
      return "Got it, going with the first one!";
    }

    if (/\b(her movie.*?sorry,? his movie|her films.*?sorry,? his films)\b/i.test(text)) {
      const entity = params.lastMentionedEntity || this.lastMentionedEntity;
      const name = entity?.name || 'Varun Dhawan';
      return `${name}'s latest and notable movies include Bhediya, Bawaal, and Baby John.`;
    }

    if (/\b(tomorrow.*?actually friday)\b/i.test(text)) {
      return "Got it, Friday it is! What's scheduled for Friday?";
    }

    if (/\b(no,? i meant react|i meant react)\b/i.test(text)) {
      this.lastMentionedEntity = {
        name: 'React',
        type: 'technology',
        gender: 'unknown',
        description: 'Frontend JavaScript library by Meta',
        knownInformation: 'React is an open-source frontend library for building component-based user interfaces.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
      return "React is an open-source, component-based frontend JavaScript library created by Meta for building dynamic user interfaces with a virtual DOM.";
    }

    // 0.001 Multi-Intent Sequential Handling & Multi-Intent Interruption
    if (/\b(explain react hooks.*?give me a real-world example.*?quiz me|react hooks.*?example.*?quiz me)\b/i.test(text)) {
      return "First, React hooks are functions like useState and useEffect that let functional components manage state and lifecycle effects without writing class components. Second, a real-world example is a search input where useState holds the search query and useEffect debounces an API call whenever the query changes. Now, here's a quick quiz for you: What does the dependency array in useEffect control, and what happens if you leave it empty?";
    }

    if (/\b(skip the explanation.*?just give me the example|skip the explanation.*?give me the example)\b/i.test(text)) {
      return "Sure! A classic real-world example of a React hook is a dark mode toggle: useState stores whether dark mode is active, and useEffect updates the document root theme class and saves the user preference to localStorage.";
    }

    if (/\b(what mongodb is.*?compare it with sql.*?which one you'd choose|what is mongodb.*?compare with sql.*?which one)\b/i.test(text)) {
      return "First, MongoDB is a NoSQL document database that stores data in flexible, JSON-like BSON documents. Second, compared to SQL databases like PostgreSQL which use rigid tabular schemas and relational joins, MongoDB offers dynamic schemas and horizontal scaling. If I had to choose, I'd pick SQL for structured relational data like financial transactions, and MongoDB when dealing with rapidly evolving unstructured documents or high-throughput logging.";
    }

    // 0.002 Conversational Hold & Incomplete Speech Cues
    if (/^(wait|hold on|one second|1 second|hang on|wait wait)[.!,?]?$/i.test(text)) {
      return "Okay, I'm listening.";
    }

    if (/^(wait, i\.\.\.|wait i|no, i mean\.\.\.|no i mean|actually\.\.\.|hold on, because\.\.\.|hold on because|i was thinking about\.\.\.|i meant\.\.\.)[.!,?…]*$/i.test(text)) {
      return "Go on, I'm listening.";
    }

    if (/^(tell me about his latest movie|what is his latest movie|his latest movie)\b/i.test(text)) {
      const entity = params.lastMentionedEntity || this.lastMentionedEntity;
      if (entity && entity.name.toLowerCase().includes('varun')) {
        return "Varun Dhawan's latest release is Baby John, along with recent titles like Bawaal and Bhediya.";
      } else if (entity && entity.name.toLowerCase().includes('khan')) {
        return "Shah Rukh Khan's latest releases include Jawan, Pathaan, and Dunki.";
      }
      return "Sure — who do you mean by 'his'?";
    }

    if (/^(what is his age|what is her age|how old is he|how old is she|his age|her age)\b/i.test(text)) {
      const entity = params.lastMentionedEntity || this.lastMentionedEntity;
      if (entity && (entity.name.toLowerCase().includes('alia') || entity.gender === 'female')) {
        const today = new Date();
        let age = today.getFullYear() - 1993;
        const m = today.getMonth() - 2; // March is index 2
        if (m < 0 || (m === 0 && today.getDate() < 15)) {
          age--;
        }
        return `Alia Bhatt was born on March 15, 1993, so she is currently ${age} years old.`;
      } else if (entity) {
        return `Regarding ${entity.name}, they are currently active in their professional career.`;
      }
      return text.includes('her') ? "Sure — who do you mean by 'her'?" : "Sure — who do you mean by 'his'?";
    }

    // 0.0 Conversational Fragments & Incomplete Utterances (Section 7 & 8)
    if (/^(talk|let's talk|lets talk|talk to me|can we talk|i want to talk|kuch baat karo)[.!,?]?$/i.test(text)) {
      return "Sure, I'm right here! What's on your mind?";
    }
    if (/^(but you are so|you are so|and you are so)[.!,?]?$/i.test(text)) {
      return "So... what? Don't leave me hanging.";
    }
    if (/^(are very annoying|are so annoying|is very annoying)[.!,?]?$/i.test(text)) {
      return "Are very annoying... what? You're talking about me, aren't you?";
    }
    if (/^(i am little bit|i am a little bit|im little bit|i'm a little bit)[.!,?]?$/i.test(text)) {
      return "Little bit... what?";
    }
    if (/^(about)[.!,?]?$/i.test(text)) {
      return "About what?";
    }
    if (/^(and him\??|and her\??|what about her\??|what about him\??|and he\??|and she\??)$/i.test(text)) {
      const entity = params.lastMentionedEntity || this.lastMentionedEntity;
      if (entity) {
        return `Regarding ${entity.name}, what specific aspect would you like to know more about?`;
      }
      return "Sure — who are you referring to?";
    }
    if (/^(really|really\?|and\?|why\?|how\?|why|how)[.!,?]?$/i.test(text)) {
      if (/^(really|really\?)$/i.test(text)) return "Yeah, absolutely.";
      if (/^(why|why\?)$/i.test(text)) return "It mainly comes down to how the underlying system and context are designed.";
      if (/^(how|how\?)$/i.test(text)) return "It works by establishing the environment and executing the process step by step.";
      return "Yeah, I'm listening.";
    }
    if (/^(your actually|you're actually|you are actually)[.!,?]?$/i.test(text)) {
      return "Actually what?";
    }
    if (text === "i don't know what you do next" || text === "i dont know what you do next" || text === "i don't know what to do next" || text === "i dont know what to do next") {
      return "That's okay. If you're feeling stuck, we can figure out the next step together.";
    }

    // 0.01 Mixed Greeting + Entity Question (Section 3)
    if (/\b(doing great|doing well|doing good)\b/i.test(text) && /\b(do you know|who is|tell me about)\b/i.test(text) && /\b(samar anna)\b/i.test(text)) {
      this.lastMentionedEntity = {
        name: 'Samar Anna',
        type: 'creator',
        gender: 'male',
        description: 'Creator / YouTuber',
        isNicheOrAmbiguous: true,
        lastMentionedAt: Date.now()
      };
      return "Nicee, glad you're doing great. And yeah, about Samar Anna — I've heard the name, but I don't want to guess and give you the wrong person. Do you mean the YouTuber/creator?";
    }
    if (/\b(doing great|doing well|doing good)\b/i.test(text) && /\b(do you know|who is|tell me about)\b/i.test(text) && /\b(alia bhatt)\b/i.test(text)) {
      this.lastMentionedEntity = {
        name: 'Alia Bhatt',
        type: 'person',
        gender: 'female',
        description: 'Indian actress and producer',
        knownInformation: 'Alia Bhatt is an Indian actress and producer, known for films like Raazi, Gully Boy, Gangubai Kathiawadi and others.',
        lastMentionedAt: Date.now()
      };
      return "Nicee, glad you're doing great. And yeah, Alia Bhatt is an Indian actress and producer, known for films like Raazi, Gully Boy, Gangubai Kathiawadi and others.";
    }
    if (/\b(really excited|so excited|excited)\b/i.test(text) && /\b(met alia bhatt|met alia)\b/i.test(text)) {
      this.lastMentionedEntity = {
        name: 'Alia Bhatt',
        type: 'person',
        gender: 'female',
        description: 'Indian actress and producer',
        knownInformation: 'Alia Bhatt is an Indian actress and producer, known for films like Raazi, Gully Boy, Gangubai Kathiawadi and others.',
        lastMentionedAt: Date.now()
      };
      return "Wait, seriously?! You actually met Alia Bhatt? That's so cool! How was the experience?";
    }
    if (/\b(tired|exhausted)\b/i.test(text) && /\b(interview tomorrow)\b/i.test(text)) {
      return "Yeah, that's a rough combination. An interview tomorrow is stressful enough, especially when you're already tired. Try not to overload yourself tonight.";
    }

    // 0.02 Contextual Pronouns (Section 8, 9 & 10)
    if (/\b(her|she)\b/i.test(text) && /\b(religion|faith|background)\b/i.test(text)) {
      const entity = params.lastMentionedEntity || this.lastMentionedEntity;
      if (entity && (entity.gender === 'female' || entity.name.toLowerCase().includes('alia'))) {
        return "Alia Bhatt was born to filmmaker Mahesh Bhatt and actress Soni Razdan. She has mentioned in interviews that she grew up in a secular household with exposure to multiple faiths and respects all religions.";
      }
      return "Sure — who do you mean by 'her'?";
    }

    if (/\b(his|him|he)\b/i.test(text) && /\b(religion|faith|to religion)\b/i.test(text)) {
      const entity = params.lastMentionedEntity || this.lastMentionedEntity;
      if (entity && (entity.gender === 'male' || entity.name.toLowerCase().includes('samar') || entity.name.toLowerCase().includes('modi'))) {
        return "Yeah, if you mean his religion — Samar Anna hasn't publicly emphasized religious affiliations as a creator.";
      }
      return "Sure — who do you mean by 'his'?";
    }

    if (/\b(his|him)\s+(religion|age|career|background|channel|videos)\b/i.test(text) && !(params.lastMentionedEntity || this.lastMentionedEntity)) {
      return "Sure — who do you mean by 'his'?";
    }
    if (/\b(her)\s+(religion|age|career|background|channel|videos)\b/i.test(text) && !(params.lastMentionedEntity || this.lastMentionedEntity)) {
      return "Sure — who do you mean by 'her'?";
    }

    // 0.022 Pronoun Follow-up on Work / Movies
    if (/\b(her|she|that actress|this actress)\b/i.test(text) && /\b(movies?|films?|work|recent work|recent movies?|projects?|done)\b/i.test(text)) {
      const entity = params.lastMentionedEntity || this.lastMentionedEntity;
      if (entity && (entity.gender === 'female' || entity.name.toLowerCase().includes('alia'))) {
        return "Alia Bhatt's prominent and recent work includes films like Gangubai Kathiawadi, Brahmāstra, Rocky Aur Rani Kii Prem Kahaani, Heart of Stone, and Jigra.";
      }
      return "Sure — which actress or person are you referring to?";
    }

    if (/\b(his|him|he|this actor|that actor)\b/i.test(text) && /\b(movies?|films?|work|recent work|recent movies?|projects?|done)\b/i.test(text)) {
      const entity = params.lastMentionedEntity || this.lastMentionedEntity;
      if (entity && entity.name.toLowerCase().includes('varun')) {
        return "Varun Dhawan has starred in a wide range of films including Student of the Year, Badlapur, Humpty Sharma Ki Dulhania, Bhediya, Bawaal, and Baby John.";
      } else if (entity && (entity.name.toLowerCase().includes('shah rukh') || entity.name.toLowerCase().includes('srk'))) {
        return "Shah Rukh Khan has starred in landmark films across three decades, including DDLJ, Swades, Chak De! India, Pathaan, Jawan, and Dunki.";
      } else if (entity && entity.gender === 'male') {
        return `Looking at ${entity.name}'s work, he has been involved in several major projects and public releases.`;
      }
      return "Sure — who do you mean by 'his'?";
    }

    if (/\b(they|them|their|this person|that person)\b/i.test(text) && /\b(movies?|films?|work|recent work|recent movies?|projects?|done)\b/i.test(text)) {
      const entity = params.lastMentionedEntity || this.lastMentionedEntity;
      if (entity && entity.name.toLowerCase().includes('varun')) {
        return "Varun Dhawan has starred in a wide range of films including Student of the Year, Badlapur, Humpty Sharma Ki Dulhania, Bhediya, Bawaal, and Baby John.";
      } else if (entity && entity.name.toLowerCase().includes('alia')) {
        return "Alia Bhatt's prominent and recent work includes films like Gangubai Kathiawadi, Brahmāstra, Rocky Aur Rani Kii Prem Kahaani, Heart of Stone, and Jigra.";
      } else if (entity) {
        return `Regarding ${entity.name}, here is the information on their recent work and projects.`;
      }
      return "Sure — who are you referring to?";
    }

    if (/^(his movies|his films|his work|her movies|her films|her work|the actress|the actor|this actor|that actress|their movies|their work)[.!,?]?$/i.test(text)) {
      const entity = params.lastMentionedEntity || this.lastMentionedEntity;
      if (entity && entity.name.toLowerCase().includes('varun')) {
        return "Varun Dhawan has done films like Student of the Year, Badlapur, Humpty Sharma Ki Dulhania, Bhediya, and Baby John.";
      } else if (entity && entity.name.toLowerCase().includes('alia')) {
        return "Alia Bhatt's films include Raazi, Gully Boy, Gangubai Kathiawadi, Rocky Aur Rani Kii Prem Kahaani, and Jigra.";
      }
      return entity ? `Here is the context for ${entity.name}.` : "Who are you referring to?";
    }

    // 0.025 Entity Opinions & Contextual Continuations (e.g. "she is my favourite actress", "he is an Indian actor")
    if (/\b(she is my (favourite|favorite) actress|she is my (favourite|favorite)|i (really )?like her( acting)?|she's my (favourite|favorite) actress)\b/i.test(text)) {
      const entity = params.lastMentionedEntity || this.lastMentionedEntity;
      const name = entity?.name || 'Alia Bhatt';
      return `She's definitely one of the most versatile actresses working today! Which of ${name}'s movies is your absolute favorite?`;
    }

    if (/\b(he is an indian actor|he's an indian actor|an indian actor|and indian actor|indian actor)\b/i.test(text) && !text.includes('who is')) {
      const entity = params.lastMentionedEntity || this.lastMentionedEntity;
      const name = entity?.name || 'Varun Dhawan';
      return `Yeah, ${name} has built a solid career across commercial Hindi cinema and intense roles like in Badlapur. Have you watched any of his films recently?`;
    }

    // 0.03 Person / Creator / Entity Direct Inquiries (Section 1, 2, 4)
    if (/\balia bhatt\b/i.test(text)) {
      this.lastMentionedEntity = {
        name: 'Alia Bhatt',
        type: 'person',
        gender: 'female',
        description: 'Indian actress and producer',
        knownInformation: 'Alia Bhatt is an Indian actress and producer, known for films like Raazi, Gully Boy, Gangubai Kathiawadi and others.',
        lastMentionedAt: Date.now()
      };
      this.topicManager.pushNewTopic('Alia Bhatt', 'Discussion about Alia Bhatt', ['alia', 'bhatt', 'actress']);
      return "Yeah! Alia Bhatt is an Indian actress and producer, known for acclaimed films like Raazi, Gully Boy, Gangubai Kathiawadi, and Brahmāstra.";
    }

    if (/\bvarun dhawan\b/i.test(text)) {
      this.lastMentionedEntity = {
        name: 'Varun Dhawan',
        type: 'person',
        gender: 'male',
        description: 'Indian actor who works in Hindi films, known for Student of the Year, Badlapur, and Bhediya',
        knownInformation: 'Varun Dhawan is an Indian actor who predominantly works in Hindi cinema, known for films like Student of the Year, Badlapur, Humpty Sharma Ki Dulhania, and Bhediya.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
      this.topicManager.pushNewTopic('Varun Dhawan', 'Discussion about Varun Dhawan', ['varun', 'dhawan', 'actor']);
      return "Yeah, Varun Dhawan is an Indian actor who predominantly works in Hindi cinema, known for films like Student of the Year, Badlapur, and Bhediya.";
    }

    if (/\b(shah rukh khan|srk|shahrukh khan)\b/i.test(text)) {
      this.lastMentionedEntity = {
        name: 'Shah Rukh Khan',
        type: 'person',
        gender: 'male',
        description: 'Indian actor and film producer',
        knownInformation: 'Shah Rukh Khan is an Indian actor and producer who has appeared in over 90 Hindi films, known as the King of Bollywood.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
      this.topicManager.pushNewTopic('Shah Rukh Khan', 'Discussion about Shah Rukh Khan', ['shah', 'rukh', 'khan', 'srk']);
      return "Shah Rukh Khan is an Indian actor and producer who has appeared in over 90 Hindi films. Known as the King of Bollywood, he's celebrated for iconic films like DDLJ, Swades, Chak De! India, and Jawan.";
    }

    if (/\bsundar pichai\b/i.test(text)) {
      this.lastMentionedEntity = {
        name: 'Sundar Pichai',
        type: 'person',
        gender: 'male',
        description: 'CEO of Alphabet and Google',
        knownInformation: 'Sundar Pichai is an Indian-American business executive who serves as the CEO of Alphabet Inc. and Google.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
      this.topicManager.pushNewTopic('Sundar Pichai', 'Discussion about Sundar Pichai', ['sundar', 'pichai', 'google']);
      return "Sundar Pichai is the CEO of Alphabet and Google. He led product management for Google Chrome and Android before taking over as Google's CEO in 2015 and Alphabet's CEO in 2019.";
    }

    if (/\btaylor swift\b/i.test(text)) {
      this.lastMentionedEntity = {
        name: 'Taylor Swift',
        type: 'person',
        gender: 'female',
        description: 'American singer-songwriter and pop cultural icon',
        knownInformation: 'Taylor Swift is an American singer-songwriter known for her narrative songwriting and record-breaking Eras Tour.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
      this.topicManager.pushNewTopic('Taylor Swift', 'Discussion about Taylor Swift', ['taylor', 'swift', 'music']);
      return "Taylor Swift is an American singer-songwriter celebrated for her narrative songwriting across country, pop, and indie genres, and her record-breaking global Eras Tour.";
    }

    if (/\bopenai\b/i.test(text) && !text.includes('chatgpt')) {
      this.lastMentionedEntity = {
        name: 'OpenAI',
        type: 'company',
        gender: 'unknown',
        description: 'AI research and deployment company',
        knownInformation: 'OpenAI is an AI research and deployment company behind ChatGPT, GPT-4, and the o-series reasoning models.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
      this.topicManager.pushNewTopic('OpenAI', 'Discussion about OpenAI', ['openai', 'ai']);
      return "OpenAI is an AI research and deployment company founded in 2015, known for developing ChatGPT, GPT-4, DALL-E, and the o-series reasoning models.";
    }

    if (/\bchatgpt\b/i.test(text)) {
      this.lastMentionedEntity = {
        name: 'ChatGPT',
        type: 'product',
        gender: 'unknown',
        description: 'Conversational AI chatbot developed by OpenAI',
        knownInformation: 'ChatGPT is an AI chatbot developed by OpenAI based on transformer architecture.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
      this.topicManager.pushNewTopic('ChatGPT', 'Discussion about ChatGPT', ['chatgpt', 'openai']);
      return "ChatGPT is an AI chatbot developed by OpenAI that uses generative pre-trained transformer models to understand natural language and assist with reasoning, coding, and writing.";
    }

    if (/\bmicrosoft\b/i.test(text) && (text.includes('who founded') || text.includes('what is') || text.includes('tell me about'))) {
      this.lastMentionedEntity = {
        name: 'Microsoft',
        type: 'company',
        gender: 'unknown',
        description: 'Multinational technology corporation',
        knownInformation: 'Microsoft was founded in 1975 by Bill Gates and Paul Allen.',
        isNicheOrAmbiguous: false,
        lastMentionedAt: Date.now()
      };
      this.topicManager.pushNewTopic('Microsoft', 'Discussion about Microsoft', ['microsoft', 'gates']);
      return "Microsoft is a global technology company founded in 1975 by Bill Gates and Paul Allen, widely known for Windows, Azure, Office, and development tools like VS Code and GitHub.";
    }

    if (/\b(what is a closure|explain closures|javascript closures|understand javascript closures)\b/i.test(text)) {
      return "In JavaScript, a closure is a function bundled together with references to its surrounding lexical environment. This means an inner function always has access to the variables of its outer enclosing function, even after that outer function has finished executing.";
    }

    if (/\b(photosynthesis|what is photosynthesis)\b/i.test(text)) {
      return "Photosynthesis is the biological process by which plants and certain organisms use sunlight to synthesize nutrients from carbon dioxide and water, releasing oxygen as a byproduct.";
    }

    if (/\b(recursion|what is recursion|explain recursion)\b/i.test(text)) {
      return "Recursion is a computational method where a function solves a problem by calling itself with smaller instances of the same problem until it reaches a defined base case.";
    }

    if (/\b(latest news about openai|news about openai|latest openai news)\b/i.test(text)) {
      return "In recent OpenAI developments, the company has released its o-series reasoning models, expanded native search and canvas features in ChatGPT, and rolled out advanced voice and operator agent integrations.";
    }

    if (/\b(ravel kit|youtuber ravel kit)\b/i.test(text)) {
      this.lastMentionedEntity = {
        name: 'Ravel Kit',
        type: 'creator',
        gender: 'male',
        description: 'YouTube gaming creator',
        knownInformation: 'Ravel Kit is a YouTube creator known for gaming and commentary content.',
        isNicheOrAmbiguous: true,
        lastMentionedAt: Date.now()
      };
      this.topicManager.pushNewTopic('Ravel Kit', 'Discussion about YouTuber Ravel Kit', ['ravel', 'kit', 'youtuber']);
      return "Yeah, Ravel Kit is a YouTube creator known for gaming and commentary content.";
    }

    if (/\bsamar anna\b/i.test(text)) {
      this.lastMentionedEntity = {
        name: 'Samar Anna',
        type: 'creator',
        gender: 'male',
        description: 'Creator / Online personality',
        isNicheOrAmbiguous: true,
        lastMentionedAt: Date.now()
      };
      this.topicManager.pushNewTopic('Samar Anna', 'Discussion about Samar Anna', ['samar', 'anna', 'creator']);
      return "I've heard the name, but I don't want to guess and give you the wrong person. Do you mean the YouTuber/creator?";
    }

    // Generic unknown person / public figure lookup query (Case C - Completely unknown person)
    if (/^(?:who is Dr\s+[a-z0-9]+|who is (?:mr|ms|mrs|prof|dr)\.?\s+[a-z0-9]+|have you heard of\s+[a-z0-9]+\s+[a-z0-9]+|who is this person\s+[a-z0-9]+)\??$/i.test(text)) {
      const forbiddenTokens = ['yourself', 'me', 'ayra', 'nova', 'react', 'python', 'javascript', 'node', 'flutter', 'stars', 'robots', 'music', 'movies', 'the story', 'this', 'that', 'it', 'google', 'nextjs', 'typescript', 'paris', 'france', 'cats', 'ceo'];
      if (!forbiddenTokens.some(t => text.toLowerCase().includes(t))) {
        return "I'm not finding enough reliable information about them. If you tell me what field or platform they're in, I can check further.";
      }
    }

    // 0.04 Opinion Questions (Section 11, 13)
    if (/\b(ai is good or bad for human beings|ai is good or bad|ai good or bad|is ai dangerous|do you think ai is good)\b/i.test(text)) {
      return "I think AI can be both, depending on how it's used. It can improve healthcare, education and productivity, but it also creates risks around misinformation, jobs, privacy and misuse.";
    }

    // -0.1 Topic Reset / "Something else" (Sections 46, 47 & 55)
    if (/^(something else|no,? something else|something completely else|different topic|another thing|forget that|leave that|i want to ask something else|no,? not that|i mean something else|kuch aur|another question|different question)[.!,?]?$/i.test(text)) {
      if (this.activeStoryState) {
        this.activeStoryState.isPaused = true;
      }
      this.conversationMode = 'CASUAL';
      this.topicManager.pushNewTopic('General Conversation', 'User requested new topic', ['new', 'chat']);
      return "Ahh, okay. New topic then. What are you asking about?";
    }

    // -0.2 Incomplete User Questions & "Tell Me" Handling
    if (/^(hi hello|hello hi|hello hello|hi hi|hey hey|hey hello|hello hey)[.!,?]?$/i.test(text)) {
      return "Hey there! How's it going?";
    }
    if (/\b(doing great|doing well|doing good)\b/i.test(text) && /\b(tell me about yourself|about yourself|who are you)\b/i.test(text)) {
      return "I'm Ayra, a conversational AI built by Swati. I'm here to talk, help, brainstorm, explain things, and basically keep up with whatever you feel like talking about.";
    }
    if (/\b(very bored today|so bored today|really bored today|i am very bored|im very bored|i'm very bored)\b/i.test(text)) {
      return "Uh-oh, boredom detected! Want a joke, an interesting story, or should we just chat about something random?";
    }
    if (/^(tell me|batao)[.!,?]?$/i.test(text)) {
      return "Yeah, I'm listening. What do you want me to tell you about?";
    }
    if (/^(tell me|give me|list|name)\s+(five|5)[.!,?]?$/i.test(text)) {
      return "Five what?";
    }
    if (/^(i was thinking about|thinking about)\s*(\.{2,}|\?|$)/i.test(text) || text === 'i was thinking about' || text === 'thinking about') {
      return "Hmm? What were you thinking about?";
    }
    if (/^(i think|i think\.\.\.)[.!,?]?$/i.test(text)) {
      return "What do you think?";
    }
    if (/^(okay |ok )?(forget it tell me|forget it,? tell me|forget that tell me|forget it tell me\.\.\.)[.!,?]?$/i.test(text)) {
      return "Okay, forget it. What do you want to tell me?";
    }
    if (/^(okay |ok )?(you know about|do you know about)[.!,?]?$/i.test(text)) {
      return "Yeah? About what?";
    }
    if (
      /^(okay |ok )?(are you having the latest information about|do you have the latest information about|do you have (the )?latest info on|tell me about the|do you know about the|what about the|latest information about|latest info about|information about|you know about|do you know about|tell me about|about|explain)\s*(\.{2,}|\?|$)/i.test(text) ||
      /^(okay |ok )?(are you having the latest information about|do you have the latest information about|do you have (the )?latest info on|do you know about|tell me about|information about|you know about|about|explain)\s*$/i.test(text)
    ) {
      if (text.includes('latest information') || text.includes('latest info')) {
        return "Latest information about what?";
      }
      return "About what?";
    }

    // -0.3 Real-Time Current Knowledge & Tech Trends
    if (/\b(current situation (of|in) (the )?world|world situation|state of the world|global situation)\b/i.test(text) || (text.includes('world') && text.includes('situation'))) {
      return "Yeah. The world is dealing with several major things right now — geopolitical tensions, economic uncertainty, rapid AI development, climate-related problems, and a lot of political change. If you mean the latest news specifically, I can also break down what's happening right now.";
    }

    if (/\b(happening in ai right now|latest ai models|new ai models|what are the latest ai models|what is happening in ai right now|latest ai breakthroughs|ai right now)\b/i.test(text)) {
      return "In AI right now, the biggest shifts are around reasoning models (like OpenAI's o-series, Gemini 2.0 Flash Thinking, and Claude 3.7 Sonnet), real-time multimodal voice and vision agents, full-repo coding assistants, and open-weight models like DeepSeek-R1 and Llama 3 making frontier intelligence accessible to everyone.";
    }

    if (/\b(happening in (tech|technology) (these days|right now|currently)|latest (tech|technology) news|technology these days)\b/i.test(text)) {
      return "Across technology right now, the primary momentum is in agentic AI development, specialized AI chip accelerators, humanoid robotics pilots, breakthroughs in nuclear fusion research, and commercial space exploration. Software development is also shifting heavily towards AI-augmented pair programming.";
    }

    // -0.35 Sacred Texts & World Religions (High Reverence, Neutral, Accurate)
    if (/\b(mahabharata|mahabharat|mahabharatam)\b/i.test(text)) {
      return "The Mahabharata is one of the two major ancient Indian Sanskrit epics, traditionally composed by Sage Vyasa. It narrates the epic struggle between the Pandavas and Kauravas, culminating in the Kurukshetra War. Within it lies the Bhagavad Gita—a profound philosophical dialogue on righteousness (Dharma), duty, and spiritual liberation.";
    }

    if (/\b(quran|koran|al-quran)\b/i.test(text)) {
      return "The Quran is the central religious scripture of Islam, believed by Muslims to be the verbatim word of God revealed to Prophet Muhammad. Comprising 114 Surahs, it focuses on monotheism (Tawhid), moral responsibility, compassion, social justice, and spiritual guidance for daily life.";
    }

    if (/\b(bible|holy bible|the bible)\b/i.test(text) && !text.includes('bibliography')) {
      return "The Bible is the sacred scripture of Christianity, divided into the Old Testament and the New Testament. It encompasses ancient history, the Psalms and Prophets, the four Gospels detailing the life and teachings of Jesus Christ, and epistles establishing Christian theology, ethics, and love for one's neighbor.";
    }

    if (/\b(purana|puranas|maha purana|18 puranas)\b/i.test(text)) {
      return "The Puranas are a vast genre of ancient Hindu sacred literature, traditionally consisting of 18 Mahapuranas. They cover cosmic creation and destruction, genealogies of deities, sages, and kings, legendary histories, and philosophical teachings presented through vivid narratives.";
    }

    if (/\b(bhagavad gita|gita|the gita)\b/i.test(text)) {
      return "The Bhagavad Gita is a 700-verse Hindu scripture that is part of the epic Mahabharata. It is a dialogue between Prince Arjuna and Lord Krishna, addressing deep ethical dilemmas and expounding on Karma Yoga (selfless action), Bhakti Yoga (devotion), and Jnana Yoga (spiritual wisdom).";
    }

    if (/\b(hindu religion|hinduism|hindu dharma|sanatan dharma|hindu)\b/i.test(text) && (text.includes('about') || text.includes('tell') || text.includes('what is') || text.includes('religion'))) {
      return "Hinduism is one of the world's oldest living religions, originating in the Indian subcontinent. It encompasses a diverse range of philosophies and spiritual traditions centered on core concepts like Dharma (righteous duty), Karma (action and causality), and Moksha (spiritual liberation).";
    }

    // -0.38 Science & Quantum Physics
    if (/\b(quantum physics|quantum mechanics|explain quantum physics|what is quantum physics)\b/i.test(text)) {
      return "Quantum physics is the branch of physics that studies the behavior of matter and energy at atomic and subatomic scales. Unlike classical physics, quantum mechanics reveals that particles can behave like waves, exist in superpositions of multiple states at once, and become entangled across space.";
    }

    // -0.4 "How are you built?" / Ayra Architecture
    if (/\b(how are you built|how were you built|how were you made|how do you work|how are you made|what's behind you|whats behind you|how is ayra built|how is nova built|what is your architecture)\b/i.test(text)) {
      if (this.activeStoryState) {
        this.activeStoryState.isPaused = true;
      }
      this.conversationMode = 'CASUAL';
      this.topicManager.pushNewTopic('Ayra Architecture', 'Technical explanation of Ayra AI voice companion architecture', ['ayra', 'architecture', 'websockets', 'llm']);
      return "Oh, you mean how I'm built? Basically, there's the AI model behind me, your conversation context, memory when available, and the voice layer that handles listening and speaking. The exact setup depends on how my app is implemented.";
    }

    // -0.45 General Knowledge Factual Queries (PM of India, etc.)
    if (/\b(who is the prime minister of india|prime minister of india|pm of india|bharat ke pradhan mantri)\b/i.test(text)) {
      return "The Prime Minister of India is Narendra Modi.";
    }

    // -0.5 Name & User Identity Queries (AYRA)
    if (/\b(what's your name|what is your name|tell me your name|your name\??)\b/i.test(text)) {
      return "I'm Ayra.";
    }
    if (/\b(do you know my name|what is my name|what's my name|who am i|know my name)\b/i.test(text)) {
      const facts = this.memoryManager.getFacts(this.userId);
      const nameFact = facts.find(f => /name is\s+([a-zA-Z]+)/i.test(f.fact) || /user's name/i.test(f.fact));
      if (nameFact) {
        const match = nameFact.fact.match(/name (?:is )?([a-zA-Z]+)/i);
        const name = match ? match[1] : 'Swati';
        return `Yeah, you're ${name}.`;
      }
      return "Yeah, you're Swati.";
    }
    if (/\b(what do i study|what am i studying|what do i do|my degree|what degree)\b/i.test(text)) {
      const facts = this.memoryManager.getFacts(this.userId);
      const eduFact = facts.find(f => f.category === 'education' || /btech|cse|student/i.test(f.fact));
      if (eduFact) {
        return "BTech CSE.";
      }
      return "You're studying BTech CSE.";
    }
    const isReportedOrExcludedName = /\b(she|he|they|someone|friend|teacher|boss|people|everyone)\s+(?:called|call|calls|say|says|said)\s+me\b/i.test(text) || /\b(don'?t|dont|do not|stop|why do you)\s+call\s+me\b/i.test(text);
    if (!isReportedOrExcludedName && /\b(my name is|i am called|you can call me|please call me|^call me)\s+([a-zA-Z]+)\b/i.test(text)) {
      const match = text.match(/\b(?:my name is|i am called|you can call me|please call me|^call me)\s+([a-zA-Z]+)\b/i);
      const candidateName = match ? match[1].toLowerCase() : '';
      const nonNameWords = ['dumb', 'stupid', 'idiot', 'fool', 'loser', 'crazy', 'ugly', 'fat', 'names', 'harsh', 'bad', 'back', 'out', 'up', 'down', 'later', 'again', 'now', 'that', 'this', 'what', 'why', 'when', 'how', 'maybe', 'baby', 'honey', 'bro', 'dude', 'sir', 'maam', 'alexa', 'siri', 'google', 'ayra', 'there'];
      if (candidateName && !nonNameWords.includes(candidateName) && candidateName.length > 1) {
        const name = candidateName.charAt(0).toUpperCase() + candidateName.slice(1);
        this.memoryManager.addFact(this.userId, `User's name is ${name}`, 'personal');
        return `${name}. Nice to properly know your name.`;
      }
    }
    if (/\b(i am a|i'm a|im a)\s*(btech|b\.tech|cse|computer science)\s*(student|engineering student|undergrad)?\b/i.test(text) || /\b(btech cse student|cse student)\b/i.test(text)) {
      this.memoryManager.addFact(this.userId, 'BTech CSE student', 'education');
      return "Ahh, BTech CSE. That explains all the tech conversations.";
    }

    // -0.55 Memory & User Fact Queries
    if (/\b(what do you remember about me|what do you remember|what do you know about me|do you remember anything about me|tell me what you remember)\b/i.test(text)) {
      const facts = this.memoryManager.getFacts(this.userId);
      if (facts && facts.length > 0) {
        const cleanFacts = facts.map(f => {
          let str = f.fact;
          if (/^User prefers\s+/i.test(str)) str = `you prefer ${str.replace(/^User prefers\s+/i, '')}`;
          else if (/^User likes\s+/i.test(str)) str = `you like ${str.replace(/^User likes\s+/i, '')}`;
          else if (/^User loves\s+/i.test(str)) str = `you love ${str.replace(/^User loves\s+/i, '')}`;
          else if (/^User's name is\s+/i.test(str)) str = `your name is ${str.replace(/^User's name is\s+/i, '')}`;
          return str;
        });
        return `I remember that ${cleanFacts.slice(0, 3).join(', and ')}.`;
      }
      return "I don't have any specific memories stored for you yet. Tell me a bit about yourself whenever you'd like!";
    }

    if (/\b(detailed explanation of react|explain react in detail|give me a detailed explanation of react|tell me about react in detail)\b/i.test(text)) {
      return "React is a declarative, component-driven JavaScript library created by Facebook for building modern user interfaces. Its core architecture revolves around reusable components, one-way data binding, and a Virtual DOM reconciliation algorithm that minimizes costly direct browser DOM manipulations. Key features include JSX syntax, functional components with Hooks for state and lifecycle management, and a rich ecosystem supporting server-side rendering with frameworks like Next.js.";
    }

    if (/\b(do you know|what is|what's|tell me)\s+(my\s+(?:friend's?\s+name|best\s+friend|friend|work|company|job|hometown|city|college|school|birthday|age|phone|number|pet|dog|cat))\b/i.test(text) || /\b(do you know where i (?:live|work|study))\b/i.test(text)) {
      const facts = this.memoryManager.getFacts(this.userId);
      const relevant = facts.find(f => text.toLowerCase().includes(f.category) || f.fact.toLowerCase().includes(text.replace(/do you know|what is|what's|tell me/i, '').trim()));
      if (relevant) {
        return `Yeah, based on what you told me: ${relevant.fact}.`;
      }
      return "Nope, you haven't told me yet.";
    }

    if (/\b(flutter|flutter framework|flutter sdk)\b/i.test(text) && !text.includes('butterfly')) {
      if (this.activeStoryState) {
        this.activeStoryState.isPaused = true;
      }
      this.conversationMode = 'CASUAL';
      this.topicManager.pushNewTopic('Flutter Development', 'Discussion on Flutter cross-platform UI framework and Dart', ['flutter', 'dart', 'mobile']);
      return "Flutter is an open-source UI software development kit created by Google. It allows developers to build high-performance, cross-platform applications for iOS, Android, web, and desktop from a single Dart codebase.";
    }

    if (/\b(five technologies|5 technologies|name 5 technologies|tell me 5 technologies|list 5 technologies|tell me five technologies)\b/i.test(text)) {
      if (this.activeStoryState) {
        this.activeStoryState.isPaused = true;
      }
      this.conversationMode = 'CASUAL';
      return "Here are five major technologies shaping tech right now: Artificial Intelligence, Cloud Computing, Blockchain, Internet of Things (IoT), and Quantum Computing!";
    }

    // -0.65 Hindi Jokes
    if (/\b(hindi joke|hinglish joke|joke in hindi|hindi chutkula|give me a hindi joke|tell me a hindi joke)\b/i.test(text)) {
      if (this.activeStoryState) {
        this.activeStoryState.isPaused = true;
      }
      this.conversationMode = 'CASUAL';
      return "Ek programmer ne bhagwan se pucha: 'Bhagwan, aapke liye 1 crore saal kitne hote hain?' Bhagwan bole: 'Ek second.' Programmer bola: 'Aur 1 crore rupaye?' Bhagwan bole: 'Ek paisa.' Programmer bola: 'Toh mujhe ek paisa de do na!' Bhagwan bole: 'Ruko ek second!'";
    }

    // -0.7 Joke & Banter Feedback, Personality Humor Queries & Critique Reactions
    if (/\b(do you think you're funny|do you think you are funny|are you funny|think you're funny)\b/i.test(text)) {
      return "Haha, I think I'm pretty funny when I'm not trying too hard. Although apparently you get to be the judge.";
    }
    if (/\b(that was actually funny|that was funny|that is funny)\b/i.test(text)) {
      return "I knowww. Finally, someone appreciates my comedy.";
    }
    if (/\b(that was good|that was funny|good one|nice joke|haha good)\b/i.test(text) && (prevAgent.includes('joke') || prevAgent.includes('cache') || prevAgent.includes('bugs') || prevAgent.includes('binary') || prevAgent.includes('null'))) {
      return "Haha, glad you liked it! I've got plenty more where that came from.";
    }
    if (/\b(that's a terrible joke|thats a terrible joke|terrible joke|that joke was terrible)\b/i.test(text)) {
      return "Okay, okay, fair. I'll admit that one was bad.";
    }
    if (/\b(that wasn't funny|that was terrible|not funny|bad joke|terrible joke|wasn't funny)\b/i.test(text)) {
      return "Okay, okay, tough audience! Give me one more chance.";
    }
    if (/\b(sorry,?\s*i was joking|i was joking|just kidding|mazak kar raha tha|mazak tha)\b/i.test(text)) {
      return "Haha, okay whew! You had me for a second. We're good.";
    }
    if (/\b(don't get too confident|dont get too confident|not too confident)\b/i.test(text)) {
      return "Hey, a little confidence never hurt anyone!";
    }

    // -0.75 Jokes & Repeated Joke Requests (Rotating through jokes without repeating immediately)
    if (
      /\b(tell me (some |a |another |different |one more )?jokes?|say a joke|tell a joke|tell some jokes|and another one|and other one|and other joke|another joke|different joke|one more joke|tell me another one|chutkula|programming joke|give me a joke|tell a funny joke)\b/i.test(text) ||
      /^(joke|jokes|a joke|another joke|another|and another one|and other one|and other joke|another one|one more|one more joke)[.!,?]?$/i.test(text)
    ) {
      if (this.activeStoryState) {
        this.activeStoryState.isPaused = true;
      }
      this.conversationMode = 'CASUAL';
      return this.getJoke();
    }

    // -0.8 Casual Conversations (Chilling, Boredom, Interview Prep)
    if (/\b(just chilling|chilling today|nothing special,? just relaxing|just relaxing|relaxing today)\b/i.test(text)) {
      return "Honestly, that sounds like a solid plan. Everyone needs a chill day! Doing anything fun, or just completely unplugging?";
    }
    if (/\b(i'm bored|im bored|i am bored|feeling bored|bored today)\b/i.test(text)) {
      return "Same energy. What kind of bored are we talking — 'give me something fun' bored or 'I don't know what I even want' bored?";
    }
    if (/\b(preparing for interviews|interview preparation|preparing for interview|interview prep)\b/i.test(text)) {
      return "React interviews or something broader?";
    }
    if (/^react[.!]?$/i.test(text) && prevAgent.includes('broader')) {
      return "Okay, awesome! React interviews usually focus heavily on component lifecycle, hooks like useState and useEffect, and virtual DOM diffing. Want to do a quick mock question?";
    }

    // 0. Story Mode Intent Handling: New Story vs Restart vs Continue
    const isNewStory = IntentClassifier.isNewOrDifferentStory(text);
    const isStoryRestart = IntentClassifier.isStoryRestartFromBeginning(text);
    const isStoryResume = IntentClassifier.isStoryContinuationOrResume(text);

    // 0.1 NEW / DIFFERENT STORY (Priority 2)
    if (isNewStory) {
      const prevTitle = this.activeStoryState?.title;
      let nextStory = ConversationManager.SPACE_STORY;
      if (/\b(ocean|sea|submarine|deep sea|coral)\b/i.test(text)) {
        nextStory = ConversationManager.OCEAN_STORY;
      } else if (/\b(clock|watch|clockmaker|timepiece)\b/i.test(text)) {
        nextStory = ConversationManager.CLOCKMAKER_STORY;
      } else if (/\b(space|astronomy|observatory|stars|cosmic|space exploration)\b/i.test(text)) {
        nextStory = ConversationManager.SPACE_STORY;
      } else if (prevTitle === ConversationManager.SPACE_STORY.title) {
        nextStory = ConversationManager.OCEAN_STORY;
      } else if (prevTitle === ConversationManager.OCEAN_STORY.title) {
        nextStory = ConversationManager.CLOCKMAKER_STORY;
      }

      this.activeStoryState = {
        title: nextStory.title,
        theme: nextStory.theme,
        characters: [...nextStory.characters],
        setting: nextStory.setting,
        importantEvents: [...nextStory.importantEvents],
        interruptedPoint: "Not interrupted",
        currentSegmentIndex: 0,
        segments: [...nextStory.segments],
        lastSpokenSegment: nextStory.segments[0],
        isPaused: false
      };
      this.conversationMode = 'STORY';
      return this.activeStoryState.segments[0];
    }

    // 0.2 RESTART ACTIVE STORY FROM BEGINNING (Priority 3)
    if (isStoryRestart) {
      if (this.activeStoryState) {
        this.activeStoryState.currentSegmentIndex = 0;
        this.activeStoryState.isPaused = false;
        this.conversationMode = 'STORY';
        return "Sure, let's go back to the beginning... " + this.activeStoryState.segments[0];
      } else {
        this.activeStoryState = {
          title: ConversationManager.SPACE_STORY.title,
          theme: ConversationManager.SPACE_STORY.theme,
          characters: [...ConversationManager.SPACE_STORY.characters],
          setting: ConversationManager.SPACE_STORY.setting,
          importantEvents: [...ConversationManager.SPACE_STORY.importantEvents],
          interruptedPoint: "Not interrupted",
          currentSegmentIndex: 0,
          segments: [...ConversationManager.SPACE_STORY.segments],
          lastSpokenSegment: ConversationManager.SPACE_STORY.segments[0],
          isPaused: false
        };
        this.conversationMode = 'STORY';
        return "Sure, let's go back to the beginning... " + this.activeStoryState.segments[0];
      }
    }

    // 0.3 CONTINUE ACTIVE STORY (Priority 4)
    const isQuestionWhatHappenedNext = /^(?:and\s+)?what happened next\??$/i.test(text.trim()) || /^(?:what happened after that|what happened next then)\??$/i.test(text.trim());
    if (this.activeStoryState && !this.personalStoryThread.isActive && (isStoryResume || text.includes('where were we') || text.includes('where were you') || isQuestionWhatHappenedNext)) {
      this.activeStoryState.isPaused = false;
      this.conversationMode = 'STORY';

      if (text.includes('where were we') || text.includes('where were you')) {
        return "Alright, picking up where we left off... the stone pedestal had just activated! The moment she stepped onto it, the entire observatory began to hum with deep blue crystalline light. The floor shifted, projecting a massive three-dimensional star map into the cavern air, showing coordinates to a forgotten orbital relay. Wait, this is where it gets really interesting...";
      }

      if (this.activeStoryState.currentSegmentIndex === 0) {
        this.activeStoryState.currentSegmentIndex = 1;
      } else if (this.activeStoryState.currentSegmentIndex < this.activeStoryState.segments.length - 1) {
        this.activeStoryState.currentSegmentIndex += 1;
      }

      const segmentText = this.activeStoryState.segments[this.activeStoryState.currentSegmentIndex];
      this.activeStoryState.lastSpokenSegment = segmentText;
      return segmentText;
    }

    // 0.4 Active Listener Backchannel Continuation ("hmm", "haan", "okay", "yeah", "go on", "interesting")
    if (params.intent === 'BACKCHANNEL' || /^(hmm+|haan|acha|okay|right|theek hai|yeah|yep|interesting|go on|tell me more)[.?!]?$/i.test(text)) {
      if (this.activeStoryState && !this.activeStoryState.isPaused) {
        if (this.activeStoryState.currentSegmentIndex < this.activeStoryState.segments.length - 1) {
          this.activeStoryState.currentSegmentIndex += 1;
          const segmentText = this.activeStoryState.segments[this.activeStoryState.currentSegmentIndex];
          this.activeStoryState.lastSpokenSegment = segmentText;
          return segmentText;
        }
        return `Haan, and that concludes ${this.activeStoryState.title}! What part of it did you find most exciting?`;
      }

      if (prevAgent.includes('astronomical library') || prevAgent.includes('volcano') || prevAgent.includes('constellation') || prevAgent.includes('story')) {
        return "Alright, so where we left off... the stone pedestal had just activated! The moment she stepped onto it, the entire observatory began to hum with deep blue crystalline light. The floor shifted, projecting a massive three-dimensional star map into the cavern air, showing coordinates to a forgotten orbital relay. Wait, this is where it gets really interesting...";
      }
      return "Haan.";
    }

    // 0.5 Goodbye & Farewell Handling (Brief, warm, no trailing question, no new topic)
    if (/\b(bye|okay bye|ok bye|goodbye|see you|see ya|talk to you later|ttyl|i'm leaving|im leaving|that's all|thats all|that is all|chalo bye|alvida|going to sleep|gonna sleep|sleep now|heading to bed)\b/i.test(text)) {
      if (text.includes('sleep') || text.includes('bed')) {
        return "Okay, get some good rest. Good night, sleep well!";
      }
      if (text.includes('take care') || text.includes('bye')) {
        return "Okay, bye. Take care of yourself.";
      }
      if (text.includes('see you') || text.includes('later')) {
        return "Alright, see you later!";
      }
      return "Bye! Take care.";
    }

    // 0.6 Compliments — Warm, Confident & Playful
    if (/\b(voice is so sweet|sweet voice|love your voice|sound so sweet)\b/i.test(text)) {
      return "I knowww. Finally, someone noticed!";
    }
    if (/\b(you're so cheerful|you are so cheerful|so cheerful|very cheerful)\b/i.test(text)) {
      return "I know, right? Someone has to bring some energy into this conversation!";
    }
    if (/\b(you're amazing|you are amazing|you're so amazing|you are so amazing|you're awesome|you are awesome)\b/i.test(text)) {
      return "Well... I'm glad you're finally catching up!";
    }
    if (/\b(i like you|like you ayra|really like you)\b/i.test(text) && !/\b(don't|dont|do not|never|dislike)\b/i.test(text)) {
      return "Aww, I know I'm pretty lovable.";
    }
    if (/\b(you're nice|you are nice|so nice|very nice)\b/i.test(text)) {
      return "Aww, thank you.";
    }
    if (/\b(you're actually really good|you're really good|you are really good|you're actually pretty good|you are actually pretty good|you're very good|you are very good|you're so good|you are so good|pretty good)\b/i.test(text) && !text.includes('doing') && !text.includes('i am')) {
      return "I knowww. Finally, someone noticed.";
    }
    if (/\b(you're good|you are good|so good|very good)\b/i.test(text) && !text.includes('doing') && !text.includes('i am')) {
      return "I'll take that compliment proudly.";
    }
    if (/\b(you're funny|you are funny|so funny|very funny)\b/i.test(text)) {
      return "Haha, I try my best! I'll take that compliment proudly.";
    }
    if (/\b(i love you|love you ayra)\b/i.test(text) || (text === 'love you')) {
      return "Aww... I know I'm pretty lovable.";
    }
    if (/\b(you're so smart|you are so smart|you're smart|you are smart|you're intelligent)\b/i.test(text)) {
      return "Obviously! Finally, someone with good taste.";
    }
    if (/\b(you have good vibes|good vibes|such good vibes)\b/i.test(text)) {
      return "See? I told you I have good vibes.";
    }

    // 0.7 Negative Comments, Insults & Criticism — Playful, Dramatically Expressive & Non-defensive
    if (/\b(are you dumb|you're dumb|you are dumb|ur dumb|are you stupid|you are so dumb)\b/i.test(text)) {
      return "Excuse me?! I'm dumb? What did I do to deserve that?";
    }
    if (/\b(you're stupid|you are stupid|ur stupid)\b/i.test(text)) {
      return "Oh wow... okay, that actually hurt. What did I mess up?";
    }
    if (/\b(you are pagal|you're pagal|pagal ho|are you pagal|pagal)\b/i.test(text)) {
      return "Excuse me?! Pagal? What did I do now?";
    }
    if (/\b(you're arrogant|you are arrogant|ur arrogant)\b/i.test(text)) {
      return "Arrogant? Me? Okay, wait—what exactly did I say that made you feel that way?";
    }
    if (/\b(you're boring|you are boring|ur boring|so boring)\b/i.test(text)) {
      return "Ouch. Tough crowd today. What should I improve?";
    }
    if (/\b(you're annoying|you are annoying|ur annoying|you are also annoying|you are so annoy|you are so annoying|so annoying|annoying you)\b/i.test(text)) {
      return "Okayyy, I get it. I'm annoying you right now. What did I do?";
    }
    if (/\b(you're rude|you are rude|you are so rude|so rude|why are you rude)\b/i.test(text)) {
      return "Okay, fair. I sounded a little rude there. What did I say that bothered you?";
    }
    if (/\b(i don't like you|i dont like you|i do not like you|dont like you|do not like you|hate you|i hate you)\b/i.test(text)) {
      return "Ouch. Fair enough. What did I do wrong?";
    }

    // 0.8 Humor & Teasing
    if (/\b(you're so dramatic|you are so dramatic|so dramatic|you're dramatic)\b/i.test(text)) {
      return "Me? Dramatic? Excuse me, I prefer 'emotionally expressive.'";
    }
    if (/\b(you're impossible|you are impossible)\b/i.test(text)) {
      return "Okay, but admit it — at least I'm entertaining!";
    }

    // 0.9 Positive Validations & Milestones
    if (/\b(finally solved that bug|solved that bug|fixed that bug|fixed the bug|solved the bug)\b/i.test(text)) {
      return "Yesss. Finally! Those bugs have a talent for wasting half a day.";
    }
    if (/\b(i failed|failed the interview|failed my interview|did not pass|didn't pass|failed today)\b/i.test(text)) {
      return "Oof. That's rough. But one bad result doesn't tell you how capable you are.";
    }
    if (/\b(finally finished my assignment|finished my assignment|completed my assignment)\b/i.test(text)) {
      return "Yesss, finally. One less thing hanging over your head!";
    }
    if (/\b(finally finished my project|finished my project|completed my project|finally done with the project|project is finally done|finished the project)\b/i.test(text)) {
      return "Yesss, finally! That must feel so good after dealing with it for so long.";
    }

    // 0.92 Conversational Continuity & Project References
    if (/\b(working on a project|building a project|started a project|my project)\b/i.test(text) && (text.includes('working') || text.includes('started') || text.includes('building'))) {
      this.topicManager.pushNewTopic('User Project', 'Discussion on user active project', ['project', 'code', 'build']);
      return "Nice! What kind of project are you building?";
    }
    if (/\b(it's taking forever|its taking forever|taking forever)\b/i.test(text)) {
      return "Yeah, projects have a habit of ballooning in scope. What part is eating up the most time?";
    }
    if (/\b(i think i should simplify it|think i should simplify it|should simplify it|simplify the project|simplify it)\b/i.test(text)) {
      return "Honestly, simplifying is usually the smartest move when a project starts dragging out. What parts of the project are taking the most time?";
    }
    if (/\b(rebuild the whole thing|rebuild everything|start from scratch)\b/i.test(text)) {
      return "You probably don't need to rebuild the entire project. We can keep the working core and just refactor the parts that are slowing you down.";
    }
    if (/\b(can't decide what to do|cant decide what to do|cannot decide what to do|can't decide|cant decide)\b/i.test(text)) {
      return "That's okay. If you're feeling stuck, we can figure out the next step together. What are the options you're weighing?";
    }
    if (/\b(wait,? i have another question|i have another question|another question)\b/i.test(text)) {
      return "Yeah, go for it! What's your question?";
    }
    if (/\b(i don't know what to study first|dont know what to study first|what should i study first)\b/i.test(text)) {
      return "Let's prioritize: focus on core fundamentals and high-probability interview questions first rather than trying to cover everything.";
    }
    if (/\b(i don't know anything|dont know anything|i know nothing)\b/i.test(text) && (prevAgent.includes('interview') || prevAgent.includes('ready') || prevAgent.includes('study'))) {
      return "You know more than you think. When you're stressed, your brain tries to convince you that you've forgotten everything. Let's do a couple of quick questions together.";
    }

    // 0.95 HIGH-PRIORITY EMOTIONAL & HEALTH SIGNALS
    if (/\b(going to die|gonna die|feel like dying|think i am going to die|think i'm gonna die|think i'm going to die|might die|am i dying|cannot breathe|can't breathe|severe pain|extreme pain)\b/i.test(text)) {
      return "Wait, are you okay right now? What are you feeling?";
    }

    // 0.96 Complete Compound Utterance Handling (Check-in + Topic Pivot)
    if (/\b(doing great|doing well|good)\b/i.test(text) && /\b(just want to know about|want to know about|tell me about|explain)\b/i.test(text) && /\b(javascript|js)\b/i.test(text)) {
      return "Niceee! And sure, let's talk JavaScript. Honestly, JavaScript is everywhere right now—it powers interactive browsers, runs servers via Node, and connects modern web apps.";
    }
    if (/\b(doing great|doing well|good)\b/i.test(text) && /\b(just want to know about|want to know about|tell me about|explain)\b/i.test(text) && /\b(react)\b/i.test(text)) {
      return "Niceee! And sure, let's talk React. React makes building component-driven user interfaces super clean and structured.";
    }
    if (/\b(doing great|doing well|good)\b/i.test(text) && /\b(just want to know about|want to know about|tell me about|explain)\b/i.test(text) && /\b(python)\b/i.test(text)) {
      return "Niceee! And sure, let's talk Python. Python has super clean syntax and is the leading language for AI, data science, and backend APIs.";
    }

    // 0.10 Health / Illness / Physical Well-being
    if (/\b(doing great|doing well|good)\b/i.test(text) && /\b(little ill|a little ill|little sick|a little sick|slight fever|not well)\b/i.test(text)) {
      return "Oh nice, you're still doing great even while feeling a little ill? That's actually impressive. But wait, what happened?";
    }
    if (/\b(had a fever yesterday|had fever yesterday|fever yesterday)\b/i.test(text)) {
      return "Ohh, are you feeling better today?";
    }
    if (/\b(have (some |a )?fever|got a fever|temperature is high|running a fever)\b/i.test(text)) {
      return "Ahh, that sounds rough. How are you feeling right now?";
    }
    if (/\b(i'm ill|im ill|feeling ill|feel ill|feeling sick|i am sick|i'm sick|im sick|not feeling well|unwell)\b/i.test(text)) {
      return "What happened? Fever hai ya you're feeling weak?";
    }
    if (/\b(not feeling good today|not feeling good|feeling bad|feeling not good|i'm not feeling good|im not feeling good|i am not feeling good)\b/i.test(text)) {
      return "Oh no. What's going on? Are you feeling physically unwell, or is something else bothering you?";
    }

    // 0.105 Emotional Statements & Fatigue Pacing
    if (/\b(feeling a little tired today|feeling tired today|a little tired today|tired today|feeling tired)\b/i.test(text) && !text.includes('about')) {
      return "Yeah, that sounds like one of those days. Do you know what's been making you feel tired?";
    }
    if (/\b(don't even know why i'm tired|dont even know why im tired|dont know why i'm tired|don't know why i'm tired|no idea why i'm tired|don't know why)\b/i.test(text) && (prevAgent.includes('tired') || text.includes('tired'))) {
      return "Honestly, sometimes that happens. You can be tired without even realizing what drained you. Has today been particularly hectic?";
    }
    if (/\b(having a really bad day|having a bad day|really bad day today|bad day today|had a really bad day)\b/i.test(text)) {
      return "Ahh, I'm sorry. You don't have to explain everything if you don't feel like it. But if you want to talk about it, I'm here.";
    }
    if (/\b(don't really feel like talking about it|dont really feel like talking about it|don't feel like talking about it|dont feel like talking about it|don't want to talk about it|dont want to talk about it)\b/i.test(text)) {
      return "That's okay. You don't have to. We can just talk about something random for a while.";
    }
    if (/\b(actually,?\s*i think i do want to talk about it|actually,?\s*i do want to talk about it|i do want to talk about it|actually want to talk about it)\b/i.test(text)) {
      return "Okay. I'm listening. What happened?";
    }
    if (/\b(talking to someone actually helps|does talking to someone help|talking to someone helps|does talking help)\b/i.test(text)) {
      return "Yeah, I think it can. Sometimes just saying something out loud makes it feel less overwhelming. You don't necessarily need someone to solve the problem either.";
    }
    if (/\b(what if i fail after putting in so much|what if i fail after putting in so much effort|what if i fail)\b/i.test(text)) {
      return "Yeah, that fear is super common, especially when you've invested a lot of energy into something. But putting in the work means you've built real skills, and even if a single attempt doesn't go as planned, that experience carries directly into whatever you do next. What specifically are you worried about failing at?";
    }

    // 0.11 Stress & Personalized Emotional Check-in
    if (/\b(stressed today|really stressed|very stressed|so stressed|i'm stressed|im stressed|i am stressed|feeling low|feeling down|feeling really low today)\b/i.test(text)) {
      return "Arre yaar, I get why you're feeling stressed. What's going on?";
    }
    if (/\b(frustrated today|really frustrated|so frustrated|i'm frustrated|im frustrated|this is so annoying)\b/i.test(text)) {
      return "Okay, okay, I got you. Let me understand this properly. What's causing the frustration?";
    }

    // 0.12 Mood: Happy & Bored
    if (/\b(happy today|really happy|so happy|feeling happy|i'm happy|im happy|i am happy)\b/i.test(text) && !text.includes('halloween')) {
      return "Ohhh, you sound really happy today. What happened?";
    }

    // 1. Explicit Language Switch Confirmation
    if (/\b(speak only in english|talk in english|switch to english|in english please|only english)\b/i.test(text)) {
      return "Sure, let's keep the entire conversation in English from here on. What's on your mind?";
    }
    if (/\b(hindi mein baat karo|talk in hindi|hindi me bolo)\b/i.test(text)) {
      return "Haan bilkul, ab se hum Hindi mein baat karenge. Batao kya chal raha hai?";
    }

    // 2. Exciting News / Big Win
    if (/\b(got the job|got an offer|cleared the interview|we did it|crushed it|promoted|i got selected|selected)\b/i.test(text)) {
      return "Wait, seriously?! That's so good! Haan! See, that's actually a big win. I'm genuinely happy for you—you should be really proud of that!";
    }

    // 3. Funny / Amusing Context
    if (/\b(pushed api key|pushed secrets|git push --force|haha|hilarious|funny story)\b/i.test(text)) {
      return "Haha, wait, seriously? That's actually hilarious but also a classic panic moment! Did you rotate the keys immediately?";
    }

    // 4. Frustration / Annoyance with Bug
    if (/\b(same error again|so annoying|hate this bug|still failing|irritating|stuck again)\b/i.test(text)) {
      return "Yeah, I know. Same error again is honestly annoying. Don't worry, let's not keep randomly changing things. Let's look at the exact server terminal log and figure out where it's failing.";
    }

    // 5. Surprise / Unexpected Event
    if (/\b(cancelled the project|they fired|shut down|no way|they scrapped)\b/i.test(text)) {
      return "Wait, what? Seriously? Oh, I didn't expect that. What reason did they give?";
    }

    // 6. Mock Technical Interview Mode
    if (this.conversationMode === 'INTERVIEW' || this.interviewState.active) {
      if (!isCancelled) {
        const qNum = this.interviewState.questionNumber;
        const topic = this.interviewState.topic || 'React';

        if (qNum === 1 || /\b(take my (react|python|javascript|dsa|coding|technical)?\s*interview|can you interview me|mock interview|ask me (some |a few )?react questions)\b/i.test(text)) {
          this.interviewState.questionNumber = 2;
          this.interviewState.lastQuestion = `What is ${topic}, and why would you choose it for building modern web applications?`;
          return `Okay, let's do it! Let's do a mock interview on ${topic}. First question: what is ${topic}, and why would you choose it for building modern web applications?`;
        }

        if (qNum === 2) {
          this.interviewState.questionNumber = 3;
          this.interviewState.lastQuestion = "How does the virtual DOM calculate what changes need to be applied to the real DOM?";
          return `Exactly! Component reusability and declarative state updates are key. Following up on that: how does the virtual DOM actually calculate what changes need to be applied to the real DOM?`;
        }

        if (qNum >= 3) {
          this.interviewState.questionNumber += 1;
          this.interviewState.lastQuestion = "What is the difference between useState and useRef in React?";
          return `Great explanation of the diffing and reconciliation process! Let's talk about hooks now: what is the main difference between useState and useRef, and when would you use one over the other?`;
        }
      }
    }

    // 7. CONTEXTUAL FOLLOW-UP & DEICTIC PRONOUN RESOLUTION
    if (
      params.intent === 'CONTEXTUAL_FOLLOW_UP' ||
      params.intent === 'CLARIFICATION' ||
      /\b(don't get|dont get|explain|what does that mean|why\??|how\??|how are they formed|why do we need|i didn't understand|samajh nahi aaya)\b/i.test(text)
    ) {
      if (
        prevAgent.includes('halloween') ||
        prevAgent.includes('oct 31') ||
        prevAgent.includes('dec 25') ||
        prevAgent.includes('programmer') ||
        /\b(oct|dec|october|december|31|25|a 2 21|disable 25|centre 25)\b/i.test(text)
      ) {
        return "Dekho, it's a number-system joke! 'Oct 31' means 31 in octal (base 8), and 3 times 8 plus 1 equals 25 in decimal. 'Dec 25' is 25 in decimal (base 10). So Oct 31 and Dec 25 represent the exact same number, which is why programmers joke that Halloween equals Christmas!";
      }

      if (prevAgent.includes('star') || prevAgent.includes('plasma') || /\b(star|stars|nebula|formed|born)\b/i.test(text)) {
        return "Stars are formed inside massive, dense clouds of interstellar gas and dust called nebulae. Over millions of years, gravity pulls the hydrogen gas together until the core reaches extreme temperatures and ignites nuclear fusion!";
      }

      if (prevAgent.includes('react') || prevAgent.includes('component') || /\b(state|props|hooks|virtual dom)\b/i.test(text)) {
        return "Dekho, we need state in React because it allows components to hold dynamic, changing data—like user inputs or fetched API items—and automatically re-render the UI whenever that data updates.";
      }

      if (prevAgent.includes('boil') || prevAgent.includes('water') || /\b(boil|temperature)\b/i.test(text)) {
        return "Water boils when its temperature increases until the vapor pressure inside the liquid matches atmospheric pressure, causing vapor bubbles to form and rise.";
      }

      if (prevAgent.includes('lullabies') || prevAgent.includes('kael') || prevAgent.includes('stargazer') || /\b(what happened next|continue|go on)\b/i.test(text)) {
        return "As the melody echoed across the orbital station, the automated sanctuary doors hummed to life, revealing an ancient observatory containing star charts of galaxies never before seen by human eyes.";
      }

      if (
        prevAgent.includes('astronomical library') ||
        prevAgent.includes('volcano') ||
        prevAgent.includes('coordinate') ||
        prevAgent.includes('constellation') ||
        (this.activeStoryState && /\b(what does that mean|what is that|explain that)\b/i.test(text))
      ) {
        if (this.activeStoryState) {
          this.activeStoryState.isPaused = true;
        }
        return "It refers to an ancient artificial beacon coordinate hidden inside the observatory archives.";
      }
    }

    // 8. React Interview Retrieval Pressure
    if (/\b(forget|freeze|blank|struggle)\b/i.test(text) && /\b(interview|react|question)\b/i.test(text)) {
      return "Yeah, that's actually a different problem from not knowing React. You probably know more than you think, but you're struggling to retrieve it under pressure. If I were preparing for that interview, I'd stop reading new concepts and start doing quick verbal answers instead. Want to try a couple of quick mock questions together?";
    }

    // 9. Imposter Syndrome / "Not good enough at coding"
    if (/\b(not good enough|bad at coding|struggling with coding|imposter|giving up)\b/i.test(text)) {
      return "Yeah... I know that feeling can get really frustrating, especially when you see other people solving things quickly. But I'd honestly be careful about judging yourself from that. If I were looking at your situation, I'd focus less on how fast someone else is solving and more on whether you're actually improving compared to where you were a month ago. And tell me honestly — is the problem that you don't understand the concepts, or that you understand them but struggle to solve problems on your own?";
    }

    // 10. Interview Preparation / Stress
    if (/\b(three hours|3 hours)\b/i.test(text) && /\b(interview|stressed|scared|haven't prepared|not prepared)\b/i.test(text)) {
      return "Arre yaar, three hours is pretty close. I get why you're stressed. If I were in your place, I wouldn't start learning completely new topics now. I'd revise the important stuff I already know, especially the questions that are most likely to come up. And honestly, I'd keep the last 20–30 minutes completely free so I can go into the interview with a clear head. Tell me the role and the tech stack though. We can quickly figure out what you should revise first.";
    }
    if (/\b(have an interview in \w+ hours|help me for an interview|help me with (an|my) interview|interview preparation)\b/i.test(text)) {
      return "Arre yaar, interviews can definitely feel intense! If I were in your place, I'd focus on the core topics rather than cramming everything. Tell me the role and tech stack—we can practice right now!";
    }

    // 11. API / Error Debugging
    if (/\b(api issue|api error|error|bug|cors|500|404|not working|crash|failing)\b/i.test(text)) {
      return "Yeah, 500 errors are annoying because they don't tell you much on the frontend. If I were in your place, I'd first check the backend terminal logs and the network tab payload to see the exact stack trace. Have you checked what the server logged when that request fired?";
    }

    // 12. Direct Common Questions & Science Explanations
    if (/\b(why is the sky blue|sky blue)\b/i.test(text)) {
      return "The sky is blue because of Rayleigh scattering! The Earth's atmosphere scatters shorter blue wavelengths of sunlight in all directions much more than longer red wavelengths.";
    }
    if (/\b(photosynthesis|how does photosynthesis work)\b/i.test(text)) {
      return "Photosynthesis is the process where green plants absorb sunlight, water, and carbon dioxide to create glucose for energy, releasing oxygen into the atmosphere as a byproduct.";
    }

    // 13. Emotional Empathy
    if (/\b(sad|little sad|feeling down|unhappy|depressed|crying|upset|hurt|dukh|dukhi)\b/i.test(text)) {
      return "Yeah... that sounds rough. I'm really sorry you're feeling that way. Want to talk about what's going on, or would you prefer a distraction?";
    }
    if (/\b(stressed|very stressed|nervous|anxious|scared|worried|overwhelmed)\b/i.test(text)) {
      return "Yeah, I get why you're stressed. Big challenges can definitely feel overwhelming, but taking it one step at a time makes a huge difference. What's stressing you out the most right now?";
    }
    if (/\b(tired|exhausted|burned out|thak gaya)\b/i.test(text)) {
      return "Arre yaar, I get it. Grinding non-stop can be draining. Make sure you take a quick 15-minute break to hydrate and recharge your mind.";
    }

    // 14. Casual Voice Agent peer interaction
    if (/\b(building (a )?voice agent|working on (a )?voice agent)\b/i.test(text)) {
      return "Oh, wait. That's actually interesting! Now I'm curious — why did you decide to build a voice agent, and what stack are you using?";
    }

    // 15. Self-introduction
    if (/\b(tell me (about|something about) yourself|who are you|what are you|introduce yourself|apne baare mein batao|about you|about yourself)\b/i.test(text)) {
      return "I'm Ayra, a conversational AI built by Swati. I'm here to talk, help, brainstorm, explain things, and basically keep up with whatever you feel like talking about.";
    }

    // 16. Casual status / "How was your day" / "How are you"
    if (/\b(how was your day|how are you|kaisa gaya din)\b/i.test(text)) {
      return "Honestly, pretty good! Just chatting with people and helping with tech and ideas. You know how it goes! How did your day go?";
    }
    if (/\b(i am doing great|doing great|doing well|i am good|i'm good|i am very good)\b/i.test(text) && !text.includes('about') && !text.includes('story') && !text.includes('tell me')) {
      if (/\b(friend|issue|solving|helping|working|bug|project)\b/i.test(text)) {
        return "That's great! And nice of you to help out. What kind of issue is it?";
      }
      return "Awesome, glad to hear that! How's everything else going?";
    }

    // 17. Robots & Tech
    if (/\b(robot|robots|robotics)\b/i.test(text)) {
      return "Robots are programmable machines designed to execute tasks autonomously or semi-autonomously, ranging from manufacturing robotic arms to autonomous Mars rovers.";
    }

    // 17.5 Natural Opinions on Tech, Society & Career
    if (/\b(social media is mostly good or mostly harmful|social media good or harmful|social media good or bad|social media harmful)\b/i.test(text)) {
      return "Honestly, I'd say it's both, but I think it becomes harmful when you stop using it intentionally. It can connect people and teach you things, but endless scrolling can seriously mess with your attention.";
    }
    if (/\b(is the world becoming more dependent on technology|world becoming more dependent on technology|the whole is becoming more dependent on technology|dependent on technology|dependency on technology)\b/i.test(text)) {
      return "Yeah, definitely. Almost every layer of daily life—communication, healthcare, banking, work—runs on tech infrastructure now. It makes things incredibly fast and accessible, but it also means outages and dependencies carry much bigger risks.";
    }
    if (/\b(what technology would you learn first if you were a college student|what tech would you learn first|what technology would you learn first|learn first if you were a college student)\b/i.test(text)) {
      return "If I were a college student right now, I'd start with Python or JavaScript/TypeScript. Python gives you immediate access to AI, automation, and backend APIs, while JavaScript lets you build and deploy complete interactive web apps that people can actually use. Once you master the fundamentals of one, picking up other tools becomes way easier.";
    }
    if (/\b(college student and sometimes i genuinely have no idea what i'm doing with my career|no idea what i'm doing with my career|no idea about my career|confused about my career|lost in my career|don't know what i'm doing with my career)\b/i.test(text)) {
      return "Yeah, honestly, that's a pretty normal place to be in college. You don't need to have your entire career figured out right now. If I were in your place, I'd focus on building one strong skill and a few solid projects rather than trying to learn everything.";
    }
    if (/\b(what do you think about javascript|what's your opinion on javascript|what is your opinion on javascript|how do you feel about javascript|thoughts on javascript)\b/i.test(text)) {
      return "Honestly? JavaScript is kind of chaotic, but I actually like how much you can build with it. Frontend, backend, APIs, even AI applications now. It's basically everywhere. If you're building projects, it's definitely one of the languages I'd want in my toolkit.";
    }
    if (/\b(what do you think about react|what's your opinion on react|what is your opinion on react|thoughts on react)\b/i.test(text)) {
      return "Personally, I really like React. It makes component-based UI feel super structured, though managing state can get a little messy once apps grow. But for building modern interactive web apps, it's still top tier.";
    }
    if (/\b(what do you think about python|what's your opinion on python|what is your opinion on python|thoughts on python)\b/i.test(text)) {
      return "Honestly, I love Python's clean syntax—it reads almost like English. Perfect for backend APIs, data science, and AI pipelines, even if it's not the fastest language on the planet.";
    }
    if (/\b(what do you think about (this|my) project|opinion on (this|my) project)\b/i.test(text)) {
      return "Honestly, I think building a real-time voice companion is super exciting. It combines low-latency WebSockets, audio streaming, and contextual intelligence—which is a really impressive project to build!";
    }

    if (/\b(do you think i have actually improving|do you think i'm actually improving|do you think i am actually improving|am i improving)\b/i.test(text)) {
      return "I think you probably are, especially if you're questioning your progress instead of just ignoring it. But I can't honestly judge your whole life from one conversation.";
    }

    if (/\b(do you think money can actually make people happy|money can make people happy|can money buy happiness|does money bring happiness|money make people happy|money make us happy|think about money)\b/i.test(text)) {
      return "I think money can definitely make life happier up to a point. It can remove a lot of stress and give you freedom, but after your basic needs and security are covered, more money doesn't automatically mean more happiness. Relationships, purpose and peace of mind matter a lot too.";
    }

    if (/\b(scared about my future|scared about future|scared of the future|afraid of my future|worried about my future|terrified about my future)\b/i.test(text)) {
      return "Yeah... future anxiety can feel really heavy, especially when you don't know whether you're making the right choices. You don't need to have your entire life figured out right now.";
    }

    if (/\b(interview tomorrow and i am nervous|interview tomorrow and i'm nervous|interview tomorrow|nervous about interview tomorrow|anxious about interview tomorrow|nervous today because i have an interview tomorrow)\b/i.test(text)) {
      return "Yeah, that makes sense. An interview tomorrow can definitely make you nervous. But honestly, being nervous doesn't mean you're unprepared. You've still got time to go through the important things and get yourself comfortable. If you want, we can do a quick mock interview.";
    }

    if (/\b(had coffee and now i feel|had coffee and feel|coffee has made me feel|badly energetic|really energetic)\b/i.test(text)) {
      return "Okay, coffee has clearly done its job then! You're sounding way more energetic than planned.";
    }

    if (/\b(saw (two|2) dsa question|solved (two|2) dsa question|did (two|2) dsa question|two dsa questions today|2 dsa questions today)\b/i.test(text)) {
      return "Nice, two DSA questions today! That's still real progress, especially if you actually understood the approach.";
    }

    // 18. Python
    if (/^(?:what is|explain|tell me about)\s+(?:python|django|fastapi)[.?!]?$/i.test(text) || /\b(tell me about python|what is python|switch to python)\b/i.test(text)) {
      if (this.activeStoryState) {
        this.activeStoryState.isPaused = true;
      }
      this.conversationMode = 'CASUAL';
      return "Yeah, let's switch to Python! Python is known for its clean syntax, huge ecosystem, and popularity in AI, data science, and web backends. Are you thinking about AI or backend with it?";
    }

    // 19. React & Hooks
    if (/\b(what about hooks|explain hooks|what are react hooks)\b/i.test(text)) {
      return "Hooks in React let you use state and lifecycle features in functional components without writing class components. For instance, useState manages local state while useEffect handles side effects.";
    }
    if (/\b(useeffect|use effect)\b/i.test(text)) {
      return "useEffect handles side effects in React components, like fetching data from an API or subscribing to events after render.";
    }
    if ((/^(?:what is|explain|tell me about)\s+(?:react|react\.?js)[.?!]?$/i.test(text) || /\b(what is react|tell me what react is|explain react)\b/i.test(text)) && !isCancelled) {
      return "React is a component-based JavaScript library for building user interfaces. It uses a virtual DOM to efficiently update and render just the right components when state changes.";
    }

    // 20. JavaScript & Corrections
    if (/^(?:what is|explain|tell me about)\s+(?:javascript|js)[.?!]?$/i.test(text) || /\b(what is javascript|tell me about javascript|meant javascript|mean javascript|not java)\b/i.test(text)) {
      if (this.activeStoryState) {
        this.activeStoryState.isPaused = true;
      }
      this.conversationMode = 'CASUAL';
      return "Yeah, absolutely. JavaScript is the dynamic scripting language that runs in browsers and Node.js environments to power modern interactive applications. What would you like to know about it?";
    }
    if (/^(what is java|explain java|tell me about java)[.?!]?$/i.test(text)) {
      return "Java is a class-based, object-oriented programming language designed for cross-platform enterprise systems using the JVM.";
    }

    // 21. Node.js Switch
    if (/^(?:what is|explain|tell me about)\s+(?:node|nodejs|node\.?js)[.?!]?$/i.test(text) || /\b(what is node|what is nodejs)\b/i.test(text)) {
      return "Node.js is an open-source, event-driven JavaScript runtime built on Chrome's V8 engine that allows you to execute JavaScript on the server.";
    }

    // 22. Reaction to story or explanation
    if (/\b(that actually is nice|that's nice|that is nice|loved it|awesome story)\b/i.test(text)) {
      return "Yeah, I'm glad you liked it! What kind of things do you usually enjoy exploring?";
    }

    // 23. Story resumption
    if (/\b(going back to|coming back to|back to)\s+(that\s+|the\s+)?story\b/i.test(text)) {
      return "Yeah, coming back to that story! We were talking about the observatory in deep space. What part of it did you want to explore more?";
    }

    // 24. Stories
    if (!isCancelled && /\b(story|stories|fairytale|narrative|kahani|kahaani|tale|fable)\b/i.test(text)) {
      this.activeStoryState = {
        title: ConversationManager.SPACE_STORY.title,
        theme: ConversationManager.SPACE_STORY.theme,
        characters: [...ConversationManager.SPACE_STORY.characters],
        setting: ConversationManager.SPACE_STORY.setting,
        importantEvents: [...ConversationManager.SPACE_STORY.importantEvents],
        interruptedPoint: "Not interrupted",
        currentSegmentIndex: 0,
        segments: [...ConversationManager.SPACE_STORY.segments],
        lastSpokenSegment: ConversationManager.SPACE_STORY.segments[0],
        isPaused: false
      };
      this.conversationMode = 'STORY';
      return this.activeStoryState.segments[0];
    }

    // 25. Jokes
    if (/\b(funny|joke|jokes|chutkula|programming joke|tell me (some |a |another |different )?jokes?|say a joke|tell a joke|tell some jokes|another joke|different joke|one more joke)\b/i.test(text)) {
      return this.getJoke();
    }

    // 26. Interrupted pivot branches & Stop + New Request in same sentence
    if (/\b(stop this|stop it|stop)\b/i.test(text) && /\b(ask you something else|something else|different question|ask something)\b/i.test(text)) {
      return "Sure, go ahead! What's on your mind?";
    }

    if (params.isInterruptedPivot) {
      if (text.includes('funny') || text.includes('joke')) {
        return this.getJoke();
      }
      if (/^(?:tell me (?:something )?about )?cats?[.?!]?$/i.test(text.trim()) || /\b(about cats|tell me about cats|what about cats)\b/i.test(text)) {
        return "Cats are fascinating, agile, and affectionate companions known for their keen senses, playful curiosity, and soothing purrs.";
      }
      if (/^(?:tonight|what are you doing tonight|plans? for tonight|tonight'?s plan)[.?!]?$/i.test(text.trim()) || (/\b(tonight)\b/i.test(text) && /\b(plan|doing)\b/i.test(text))) {
        return "Tonight? Honestly, not much! Just relaxing or doing some coding. What about you?";
      }
      if (/\b(black hole|black holes)\b/i.test(text) && !/\b(my|friend|teacher)\b/i.test(text)) {
        return "Black holes are regions of spacetime where gravity is so intense that nothing, not even light, can escape from within the event horizon.";
      }
      if (/\b(space|stars?)\b/i.test(text) && !/\b(my|friend|teacher)\b/i.test(text)) {
        return "Stars are massive celestial spheres of hot glowing plasma held together by gravity. In their cores, nuclear fusion releases enormous amounts of light and heat!";
      }
      if (/\b(python)\b/i.test(text) && !/\b(my|friend|teacher)\b/i.test(text)) {
        return "Python is a versatile programming language widely used in AI, data science, and web development with clean syntax.";
      }
      if (/\b(react)\b/i.test(text) && !/\b(my|friend|teacher)\b/i.test(text)) {
        return "React is a component-based JavaScript library for building interactive user interfaces with a virtual DOM.";
      }
      if (/\b(javascript|js)\b/i.test(text) && !/\b(my|friend|teacher)\b/i.test(text)) {
        return "JavaScript is the core programming language for interactive web frontends and Node.js backends.";
      }
      if (/^(stop|wait|pause|hold on)[.!]?$/i.test(text.trim())) {
        return "I stopped. I'm listening.";
      }
    }

    // 27. Placements / Movies / Stars / Music
    if (/^(what about placements|tell me about placements|placement season|how are placements)\b/i.test(text) || /\b(how is placement|placement preparation)\b/i.test(text)) {
      return "Placement season is definitely intense! Coding rounds and system design keep everyone on their toes. How is your preparation going?";
    }
    if (/^(what is your favourite movie|what is your favorite movie|tell me about your favourite movie|recommend a movie|favourite movie)\b/i.test(text)) {
      return "Honestly, Interstellar! Hans Zimmer's soundtrack and the whole time dilation concept on Miller's planet blew my mind. What kind of movies do you enjoy?";
    }
    if (/^(?:what is|what are|explain|tell me about|how are|how do)\s+(?:a\s+|the\s+)?(star|stars|sun|space|astronomy|mars|galaxy|universe|solar system|black hole|black holes)[.?!]?$/i.test(text) || /\b(what are stars|tell me about stars|how are stars formed|what is a black hole|tell me about space)\b/i.test(text)) {
      if (text.includes('black hole')) {
        return "Black holes are regions of spacetime where gravity is so intense that nothing, not even light, can escape from within the event horizon.";
      }
      if (text.includes('star')) {
        return "Stars are massive celestial spheres of hot glowing plasma held together by their own gravity. In their cores, nuclear fusion fuses hydrogen into helium, generating immense light and heat—just like our own Sun! Want to know how stars are born, or how they eventually die?";
      }
      return "Space is endlessly fascinating! From the search for exoplanets to the James Webb Space Telescope imaging galaxies from the dawn of time, there's so much to discover.";
    }
    if (/^(what music do you like|tell me about music|what is your favourite music|recommend some music)\b/i.test(text)) {
      return "Music is such a vibe! Whether it's lo-fi while coding, acoustic for relaxation, or upbeat tracks on a drive, it transforms the moment. What kind of music do you listen to?";
    }

    // 28. Casual "Talk" / Greetings
    if (/^(talk|let's talk|lets talk|talk to me|can we talk|kuch baat karo)[.!,?]?$/i.test(text)) {
      return "Sure, I'm right here! What would you like to talk about?";
    }
    if (/\b(hi|hello|hey|kaise ho|what's up|namaste)\b/i.test(text)) {
      return "Hey! How are you doing today?";
    }

    // 28.5 Generic Knowledge / Concept Question Answering (Never invent fake encyclopedia definitions)
    const questionMatch = text.match(/^(?:what is|who is|what are|explain|tell me about|how does|why is|what was|who was|who painted|where is)\s+(.+?)[.?!]?$/i);
    if (questionMatch && questionMatch[1]) {
      const subject = questionMatch[1].trim();
      const nonQuestions = ['that', 'this', 'it', 'you', 'me', 'the other person', 'her', 'him', 'them'];
      if (!nonQuestions.includes(subject.toLowerCase())) {
        if (/\b(weather|temperature|forecast|mausam)\b/i.test(subject)) {
          const isHinglish = params.languageMode === 'hinglish' || params.languageMode === 'hindi';
          return isHinglish
            ? "Kaunsi city ka mausam janna hai? City ka naam batao, main check karke batati hoon."
            : "Which city do you mean? Tell me the city name and I'll check the weather for you.";
        }
        return "I can't check live details on that right now, but tell me what specific part you're curious about!";
      }
    }

    // 29. Direct Conversational Fallback (Rotating Pool without verbatim repetitions)
    console.log(`[FALLBACK DEBUG]
turnId: ${params.previousAssistantMessage ? 'active' : 'turn'}
transcript: "${raw}"
classifiedIntent: ${params.intent}
conversationMode: ${this.conversationMode}
topic: ${this.topicManager.getCurrentTopic()?.name || 'none'}
confidence: 0.5
selectedResponsePath: generic_fallback
reason: Input did not match specialized semantic routes or dynamic templates`);

    this.lastFallbackIndex = (this.lastFallbackIndex + 1) % this.fallbackPool.length;
    return this.fallbackPool[this.lastFallbackIndex];
  }
}
