import http from 'http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from './config/index.js';
import { ConversationManager } from './agent/conversation-manager.js';
import { PERSONAS } from './persona/persona-config.js';
import { TEST_SCENARIOS, runScenario } from './scenarios/test-scenarios.js';

const app = express();

// -------------------------------------------------------------
// 1. PRODUCTION CORS & REQUEST LIMITS
// -------------------------------------------------------------
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS policy'));
      }
    },
    credentials: true
  })
);

app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 65536 });

// Global default conversation manager instance
const defaultManager = new ConversationManager({ userId: 'default-user', personaName: config.defaultPersona });

// Map of active WebSocket client sessions & rate-limit timestamps
const clientSessions = new Map<WebSocket, ConversationManager>();
const clientMessageHistory = new Map<WebSocket, number[]>();

// -------------------------------------------------------------
// 2. REST API & HEALTH CHECK ROUTES
// -------------------------------------------------------------

app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'ayra-voice-agent',
    persona: defaultManager.getPersona().name,
    geminiConfigured: Boolean(config.geminiApiKey),
    mem0Configured: defaultManager.memoryManager.mem0Service.isAvailable(),
    timestamp: Date.now()
  });
});

app.get('/api/personas', (req, res) => {
  res.json({
    personas: Object.values(PERSONAS),
    defaultPersona: config.defaultPersona
  });
});

app.get('/api/scenarios', (req, res) => {
  res.json({ scenarios: TEST_SCENARIOS });
});

app.post('/api/scenarios/run/:id', async (req, res) => {
  const scenarioId = req.params.id;
  const scenario = TEST_SCENARIOS.find((s) => s.id === scenarioId);
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' });
  }

  try {
    const result = await runScenario(scenario);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Scenario execution failed' });
  }
});

app.get('/api/memories', async (req, res) => {
  const userId = (req.query.userId as string) || 'default-user';
  const data = await defaultManager.memoryManager.getInspectorDataWithMem0(userId);
  res.json(data);
});

app.post('/api/memories/fact', (req, res) => {
  const { userId = 'default-user', fact, category = 'general' } = req.body;
  if (!fact || typeof fact !== 'string' || fact.length > 500) {
    return res.status(400).json({ error: 'Fact is required and must be under 500 characters' });
  }
  const created = defaultManager.memoryManager.addFact(userId, fact.trim(), category);
  res.json({ fact: created });
});

app.get('/api/metrics', (req, res) => {
  const averages = defaultManager.latencyTracker.getAverages(10);
  const history = defaultManager.latencyTracker.getHistory();
  const interruptions = defaultManager.interruptionHandler.getEventsLog();
  res.json({ averages, history, interruptions });
});

app.get('/api/topics', (req, res) => {
  res.json({
    currentTopic: defaultManager.topicManager.getCurrentTopic(),
    topicStack: defaultManager.topicManager.getTopicStack()
  });
});

// Centralized error-handling middleware preventing stack leak
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[HTTP ERROR]', err?.message || err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// -------------------------------------------------------------
// 3. WEBSOCKET REAL-TIME GATEWAY WITH RATE LIMITING & VALIDATION
// -------------------------------------------------------------

wss.on('connection', (ws: WebSocket) => {
  console.log('[WebSocket] Client connected');
  const manager = new ConversationManager({ userId: 'default-user', personaName: config.defaultPersona });
  clientSessions.set(ws, manager);
  clientMessageHistory.set(ws, []);

  // Forward manager events to WebSocket client
  const send = (type: string, payload: any) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
    }
  };

  manager.on('state_change', (evt) => send('STATE_CHANGE', evt));
  manager.on('response_start', (data) => send('RESPONSE_START', data));
  manager.on('agent_speech_chunk', (chunk) => send('AGENT_SPEECH_CHUNK', chunk));
  manager.on('response_end', (data) => send('RESPONSE_END', data));
  manager.on('cancel_audio_playback', (data) => send('CANCEL_AUDIO', data));
  manager.on('backchannel_uttered', (data) => send('BACKCHANNEL', data));
  manager.on('tool_in_flight', (data) => send('TOOL_IN_FLIGHT', data));
  manager.on('tool_completed', (data) => send('TOOL_COMPLETED', data));
  manager.on('metrics_update', (metric) => send('METRICS_UPDATE', metric));
  manager.on('interruption_event', (evt) => send('INTERRUPTION_EVENT', evt));
  manager.on('transcript_turn', (turn) => send('TRANSCRIPT_TURN', turn));
  manager.on('persona_changed', (persona) => send('PERSONA_CHANGED', persona));

  // Send initial state snapshot
  send('INIT_SYNC', {
    state: manager.stateMachine.getState(),
    persona: manager.getPersona(),
    currentTopic: manager.topicManager.getCurrentTopic(),
    topicStack: manager.topicManager.getTopicStack(),
    memories: manager.memoryManager.getAllDataForInspector(manager.getUserId()),
    metricsAverages: manager.latencyTracker.getAverages(10),
    interruptionLogs: manager.interruptionHandler.getEventsLog()
  });

  // Handle incoming messages with Rate Limiting & Strict Validation
  ws.on('message', async (data: string | Buffer) => {
    try {
      // 1. Rate limiting check: max 25 messages per 3 seconds per connection
      const now = Date.now();
      const history = clientMessageHistory.get(ws) || [];
      const recentHistory = history.filter((t) => now - t < 3000);
      if (recentHistory.length >= 25) {
        console.warn('[RATE LIMIT] Excess client messages dropped');
        send('RATE_LIMIT_WARNING', { message: 'Too many messages. Please slow down.' });
        return;
      }
      recentHistory.push(now);
      clientMessageHistory.set(ws, recentHistory);

      // 2. Safe JSON Parsing
      let parsed: any;
      if (typeof data === 'string') {
        parsed = JSON.parse(data);
      } else {
        parsed = JSON.parse(data.toString());
      }

      if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') {
        console.warn('[WebSocket] Malformed message rejected');
        return;
      }

      const { type, payload } = parsed;

      switch (type) {
        case 'START_CALL':
          if (payload?.personaName && typeof payload.personaName === 'string') {
            manager.setPersona(payload.personaName);
          }
          if (payload?.userId && typeof payload.userId === 'string') {
            manager.setUserId(payload.userId);
          }
          manager.startCall();
          break;

        case 'END_CALL':
          manager.endCall();
          break;

        case 'USER_SPEECH_START':
          manager.backchannelManager.onUserSpeechStarted();
          if (manager.stateMachine.getState() === 'LISTENING') {
            manager.stateMachine.transitionTo('USER_SPEAKING', 'VAD_SPEECH_START');
          }
          break;

        case 'USER_SPEECH_FINAL':
          if (!payload || typeof payload.text !== 'string') break;
          // Sanitize & length clamp transcript (max 2000 chars)
          const cleanText = payload.text.trim().slice(0, 2000);
          if (!cleanText) break;

          await manager.handleUserSpeech({
            text: cleanText,
            durationMs: typeof payload.durationMs === 'number' ? Math.max(50, payload.durationMs) : 300,
            isInterruptionCheck: Boolean(payload.isInterruption),
            generationId: typeof payload.generationId === 'number' ? payload.generationId : undefined,
            prosody: payload.prosody
          });
          break;

        case 'STOP_COMMAND':
          await manager.handleStopCommand({
            text: typeof payload?.text === 'string' ? payload.text.slice(0, 100) : 'stop',
            generationId: typeof payload?.generationId === 'number' ? payload.generationId : undefined
          });
          break;

        case 'CHECK_INTERRUPTION':
          manager.cancelInFlightResponse('USER_BARGE_IN');
          if (manager.stateMachine.getState() === 'AGENT_SPEAKING' || manager.stateMachine.getState() === 'PROCESSING') {
            manager.stateMachine.transitionTo('LISTENING', 'USER_BARGE_IN');
          }
          break;

        case 'TRIGGER_BACKCHANNEL':
          manager.triggerBackchannel(payload?.languageMode || 'english');
          break;

        case 'SWITCH_PERSONA':
          if (payload?.personaName && typeof payload.personaName === 'string') {
            manager.setPersona(payload.personaName);
          }
          break;

        case 'ADD_FACT':
          if (payload?.fact && typeof payload.fact === 'string') {
            manager.memoryManager.addFact(manager.getUserId(), payload.fact.slice(0, 500), payload.category);
            send('MEMORY_UPDATED', manager.memoryManager.getAllDataForInspector(manager.getUserId()));
          }
          break;

        default:
          break;
      }
    } catch (err) {
      console.error('[WebSocket] Message handling error:', err);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`[WebSocket] Client disconnected. code=${code} reason="${reason ? reason.toString() : ''}"`);
    manager.cancelInFlightResponse('CLIENT_DISCONNECTED');
    clientSessions.delete(ws);
    clientMessageHistory.delete(ws);
  });
});

// -------------------------------------------------------------
// 4. GRACEFUL PROCESS SHUTDOWN
// -------------------------------------------------------------

const gracefulShutdown = (signal: string) => {
  console.log(`[SERVER] Received ${signal}, initiating graceful shutdown...`);
  wss.clients.forEach((client) => {
    const manager = clientSessions.get(client);
    if (manager) {
      manager.cancelInFlightResponse('SERVER_SHUTDOWN');
    }
    client.close(1001, 'Server shutting down');
  });
  clientSessions.clear();
  clientMessageHistory.clear();

  server.close(() => {
    console.log('[SERVER] HTTP and WebSocket gateways closed cleanly.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[SERVER] Forced shutdown after timeout.');
    process.exit(1);
  }, 3000);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

server.listen(config.port, config.host, () => {
  console.log(`=============================================================`);
  console.log(`🚀 Voice Agent Server running on http://${config.host}:${config.port}`);
  console.log(`📡 WebSocket Gateway ready at ws://${config.host}:${config.port}/ws`);
  console.log(`🎭 Default Persona: ${config.defaultPersona}`);
  console.log(`=============================================================`);
});
