import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { InterruptionEvent } from '../state/types.js';

export interface InterruptionEvaluationResult {
  isRealInterruption: boolean;
  event: InterruptionEvent;
}

export class InterruptionHandler extends EventEmitter {
  private eventsLog: InterruptionEvent[] = [];
  private readonly minSpeechDurationMs = 260; // Min speech to confirm barge-in
  private readonly confirmationWindowMs = 200;

  // Non-interruption noise tokens / sounds that shouldn't interrupt agent mid-flow
  private static NOISE_TOKENS = new Set([
    'uh', 'um', 'er', 'ah', 'cough', '[cough]', '[throat-clearing]',
    'throat-clearing', '[snort]', 'mm', 'hmm', 'huh', 'shh', 'psst',
    '*cough*', '*throat clear*', '[applause]', '[laughter]'
  ]);

  /**
   * Evaluate whether detected sound during AGENT_SPEAKING is a genuine interruption
   * or rejected transient noise (cough, throat-clear, mic bump, brief filler).
   */
  public evaluateInterruption(params: {
    durationMs: number;
    transcriptSnippet: string;
    energyRms?: number;
    agentSpeechProgress?: number;
  }): InterruptionEvaluationResult {
    const { durationMs, transcriptSnippet, agentSpeechProgress } = params;
    const cleanText = transcriptSnippet.trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');
    const tokens = cleanText.split(/\s+/).filter(Boolean);
    const tokenCount = tokens.length;

    let isReal = false;
    let reason = '';

    // Condition 0: Explicit stop or interruption command (Highest priority, 0 duration threshold)
    if (
      /^(stop|stop stop|stop it|stop please|please stop|okay stop|ok stop|no stop|wait stop|bas stop|yeah stop|yes stop|okay okay stop|just stop|stop now|stop talking|stop speaking|wait|wait wait|wait a minute|wait a sec|wait a second|wait please|just wait|hold on|hold on a second|hold on a sec|hold up|bas|bas karo|bas bas|bas bas karo|bas abhi|ruk|ruko|ruk ja|ruk jao|ruko ruko|ruko ek second|ruko zara|rukna|ruko please|ek second|one second|1 second|one sec|1 sec|ek minute|one minute|1 minute|pause|pause it|pause please|don't continue|dont continue|do not continue|stop continuing|that's enough|thats enough|that is enough|enough|enough now|it's enough|its enough|shut up|chup|chup raho|chup ho jao|i don't want to hear this|dont want to hear this|i don't want to listen|dont want to listen|don't want to hear)\b/i.test(cleanText) ||
      /^(okay|ok|yeah|yes|no|wait|bas|arre|yaar|please)?\s*(stop|wait|pause|ruko|bas|enough)\b/i.test(cleanText)
    ) {
      isReal = true;
      reason = `Explicit user stop/interruption command confirmed ("${transcriptSnippet}")`;
    }
    // Condition 1: Duration check
    else if (durationMs < this.minSpeechDurationMs && tokenCount <= 1) {
      isReal = false;
      reason = `Sound burst too short (${durationMs}ms < ${this.minSpeechDurationMs}ms threshold) with only ${tokenCount} token(s)`;
    } 
    // Condition 2: Known noise token check (cough, throat clear, solitary "uh"/"hmm")
    else if (tokenCount === 1 && InterruptionHandler.NOISE_TOKENS.has(tokens[0])) {
      isReal = false;
      reason = `Single filler/noise token ignored ("${tokens[0]}")`;
    }
    // Condition 3: Empty or pure punctuation snippet
    else if (tokenCount === 0) {
      isReal = false;
      reason = 'No speech tokens recognized in confirmation window (acoustic blip/noise)';
    }
    // Condition 4: Real speech recognized with sustained duration
    else {
      isReal = true;
      reason = `Real speech confirmed (${tokenCount} words: "${transcriptSnippet.slice(0, 40)}...", ${durationMs}ms duration)`;
    }

    const event: InterruptionEvent = {
      id: uuidv4(),
      timestamp: Date.now(),
      type: isReal ? 'REAL_INTERRUPTION' : 'REJECTED_NOISE',
      reason,
      durationMs,
      tokenCount,
      partialTranscript: transcriptSnippet,
      agentSpeechProgress
    };

    this.eventsLog.unshift(event);
    if (this.eventsLog.length > 50) {
      this.eventsLog.pop();
    }

    this.emit('interruption_evaluated', event);

    return {
      isRealInterruption: isReal,
      event
    };
  }

  public getEventsLog(): InterruptionEvent[] {
    return this.eventsLog;
  }

  public clearLog(): void {
    this.eventsLog = [];
  }
}
