import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  defaultPersona: process.env.DEFAULT_PERSONA || 'Ayra',
  
  // Google Gemini API Configuration (Gemini Only)
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  
  // Storage & Cloud Memory
  memoryStoragePath: process.env.MEMORY_STORAGE_PATH || path.resolve(process.cwd(), 'src/data/memory.json'),
  mem0ApiKey: process.env.MEM0_API_KEY || process.env.Mem0_API_KEY || '',
  mongoUri: process.env.MONGODB_URI || '',

  // Latency & Behavior Tuning
  vad: {
    speechThresholdMs: 250,        // Min sustained speech to confirm turn
    noiseRejectionWindowMs: 200,   // Confirmation window to discriminate coughs/blips vs real words
    pauseBackchannelThresholdMs: 8000, // 8s continuous speech before eligible for backchannel
    incompleteThoughtPauseMs: 750, // Extra wait if thought syntactically incomplete
    completeThoughtPauseMs: 380,   // Endpoint silence for complete sentences
  }
};
