import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const rawModel = process.env.GEMINI_MODEL;
const geminiModel = (!rawModel || rawModel.includes('3.6')) ? 'gemini-3.7-flash' : rawModel;

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  defaultPersona: process.env.DEFAULT_PERSONA || 'Ayra',
  
  // Google Gemini API Configuration (Gemini Only)
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel,
  
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
