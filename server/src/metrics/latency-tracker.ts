import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { TurnMetrics, UserIntent, LanguageMode } from '../state/types.js';

export class LatencyTracker extends EventEmitter {
  private metricsHistory: TurnMetrics[] = [];
  private currentTurnTimestamps: {
    turnId: string;
    speechEnd: number;
    sttEnd: number;
    intentResolved: number;
    geminiRequestStart: number;
    llmFirstToken: number;
    geminiFirstChunk: number;
    ttsFirstAudio: number;
    intent: UserIntent;
    languageMode: LanguageMode;
    interrupted: boolean;
  } | null = null;

  public startTurn(intent: UserIntent = 'NORMAL_TURN', languageMode: LanguageMode = 'english'): string {
    const turnId = uuidv4();
    this.currentTurnTimestamps = {
      turnId,
      speechEnd: Date.now(),
      sttEnd: 0,
      intentResolved: 0,
      geminiRequestStart: 0,
      llmFirstToken: 0,
      geminiFirstChunk: 0,
      ttsFirstAudio: 0,
      intent,
      languageMode,
      interrupted: false
    };
    return turnId;
  }

  public recordSpeechEnd(turnId?: string): void {
    if (this.currentTurnTimestamps) {
      this.currentTurnTimestamps.speechEnd = Date.now();
    }
  }

  public recordSTTEnd(): void {
    if (this.currentTurnTimestamps && this.currentTurnTimestamps.sttEnd === 0) {
      this.currentTurnTimestamps.sttEnd = Date.now();
    }
  }

  public recordIntentResolved(): void {
    if (this.currentTurnTimestamps && this.currentTurnTimestamps.intentResolved === 0) {
      this.currentTurnTimestamps.intentResolved = Date.now();
    }
  }

  public recordGeminiRequestStart(): void {
    if (this.currentTurnTimestamps && this.currentTurnTimestamps.geminiRequestStart === 0) {
      this.currentTurnTimestamps.geminiRequestStart = Date.now();
    }
  }

  public recordLLMFirstToken(): void {
    if (this.currentTurnTimestamps && this.currentTurnTimestamps.llmFirstToken === 0) {
      this.currentTurnTimestamps.llmFirstToken = Date.now();
    }
  }

  public recordGeminiFirstChunk(): void {
    if (this.currentTurnTimestamps && this.currentTurnTimestamps.geminiFirstChunk === 0) {
      this.currentTurnTimestamps.geminiFirstChunk = Date.now();
    }
  }

  public recordTTSFirstAudio(): void {
    if (this.currentTurnTimestamps && this.currentTurnTimestamps.ttsFirstAudio === 0) {
      this.currentTurnTimestamps.ttsFirstAudio = Date.now();
    }
  }

  public recordInterrupted(): void {
    if (this.currentTurnTimestamps) {
      this.currentTurnTimestamps.interrupted = true;
    }
  }

  public finalizeTurn(): TurnMetrics | null {
    if (!this.currentTurnTimestamps) return null;

    const now = Date.now();
    const speechEnd = this.currentTurnTimestamps.speechEnd;
    const sttEnd = this.currentTurnTimestamps.sttEnd || now;
    const intentResolved = this.currentTurnTimestamps.intentResolved || sttEnd;
    const geminiReqStart = this.currentTurnTimestamps.geminiRequestStart || intentResolved;
    const llmFirst = this.currentTurnTimestamps.llmFirstToken || now;
    const geminiChunk = this.currentTurnTimestamps.geminiFirstChunk || llmFirst;
    const ttsFirst = this.currentTurnTimestamps.ttsFirstAudio || now;

    const sttLatencyMs = Math.max(10, sttEnd - speechEnd);
    const intentLatencyMs = Math.max(0, intentResolved - sttEnd);
    const llmTTFTMs = Math.max(15, llmFirst - geminiReqStart);
    const firstChunkLatencyMs = Math.max(0, geminiChunk - llmFirst);
    const ttsTTFAMs = Math.max(15, ttsFirst - (geminiChunk || llmFirst));
    const totalLatencyMs = Math.max(25, ttsFirst - speechEnd);

    const metric: TurnMetrics = {
      turnId: this.currentTurnTimestamps.turnId,
      userSpeechEndTime: speechEnd,
      sttEndTime: sttEnd,
      sttLatencyMs,
      intentResolvedTime: intentResolved,
      geminiRequestStartTime: geminiReqStart,
      llmFirstTokenTime: llmFirst,
      llmTTFTMs,
      geminiFirstChunkTime: geminiChunk,
      ttsFirstAudioTime: ttsFirst,
      ttsTTFAMs,
      totalLatencyMs,
      interrupted: this.currentTurnTimestamps.interrupted,
      intent: this.currentTurnTimestamps.intent,
      languageMode: this.currentTurnTimestamps.languageMode
    };

    console.log(`[LATENCY] STT: ${sttLatencyMs}ms | Intent: ${intentLatencyMs}ms | Gemini TTFT: ${llmTTFTMs}ms | First Chunk: ${firstChunkLatencyMs}ms | TTS TTFA: ${ttsTTFAMs}ms | TOTAL_TTFA: ${totalLatencyMs}ms`);

    this.metricsHistory.push(metric);
    if (this.metricsHistory.length > 50) {
      this.metricsHistory.shift();
    }

    this.emit('turn_metric', metric);
    this.currentTurnTimestamps = null;
    return metric;
  }

  public getAverages(lastN = 10): {
    avgSTTLatencyMs: number;
    avgLLMTTFTMs: number;
    avgTTSTTFAMs: number;
    avgTotalLatencyMs: number;
    turnCount: number;
  } {
    const slice = this.metricsHistory.slice(-lastN);
    if (slice.length === 0) {
      return {
        avgSTTLatencyMs: 0,
        avgLLMTTFTMs: 0,
        avgTTSTTFAMs: 0,
        avgTotalLatencyMs: 0,
        turnCount: 0
      };
    }

    const sum = slice.reduce(
      (acc, m) => {
        acc.stt += m.sttLatencyMs;
        acc.llm += m.llmTTFTMs;
        acc.tts += m.ttsTTFAMs;
        acc.total += m.totalLatencyMs;
        return acc;
      },
      { stt: 0, llm: 0, tts: 0, total: 0 }
    );

    const count = slice.length;
    return {
      avgSTTLatencyMs: Math.round(sum.stt / count),
      avgLLMTTFTMs: Math.round(sum.llm / count),
      avgTTSTTFAMs: Math.round(sum.tts / count),
      avgTotalLatencyMs: Math.round(sum.total / count),
      turnCount: count
    };
  }

  public getHistory(): TurnMetrics[] {
    return this.metricsHistory;
  }

  public clear(): void {
    this.metricsHistory = [];
    this.currentTurnTimestamps = null;
  }
}
