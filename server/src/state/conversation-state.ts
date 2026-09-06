import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { ConversationState, StateTransitionEvent } from './types.js';

export class ConversationStateMachine extends EventEmitter {
  private currentState: ConversationState = 'IDLE';
  private history: StateTransitionEvent[] = [];
  private maxHistory = 100;
  private stateEntryTimestamp = Date.now();

  constructor(initialState: ConversationState = 'IDLE') {
    super();
    this.currentState = initialState;
    this.stateEntryTimestamp = Date.now();
  }

  public getState(): ConversationState {
    return this.currentState;
  }

  public getStateDurationMs(): number {
    return Date.now() - this.stateEntryTimestamp;
  }

  public transitionTo(toState: ConversationState, trigger: string, metadata?: Record<string, any>): StateTransitionEvent {
    const fromState = this.currentState;
    
    // Even if fromState === toState, update trigger & timestamp if explicitly transitioned
    const event: StateTransitionEvent = {
      id: uuidv4(),
      fromState,
      toState,
      trigger,
      timestamp: Date.now(),
      metadata
    };

    this.currentState = toState;
    this.stateEntryTimestamp = event.timestamp;
    
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.emit('transition', event);
    this.emit(`state:${toState}`, event);

    return event;
  }

  public getRecentTransitions(limit = 20): StateTransitionEvent[] {
    return this.history.slice(-limit);
  }

  public reset(): void {
    this.transitionTo('IDLE', 'SYSTEM_RESET');
  }
}
