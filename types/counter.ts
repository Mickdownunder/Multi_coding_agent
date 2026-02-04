/**
 * Represents the state of the counter component.
 */
export interface CounterState {
  /** The current numeric value of the counter */
  count: number;
  /** ISO timestamp of the last change */
  lastUpdated: string;
  /** Current status of the counter operation */
  status: 'idle' | 'updating';
}

/**
 * Actions that can be performed on the counter state.
 */
export type CounterAction =
  | { type: 'INCREMENT' }
  | { type: 'DECREMENT' }
  | { type: 'RESET' }
  | { type: 'SET'; payload: number };
