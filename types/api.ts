export interface StatusResponse {
  state: string;
  progress: {
    completedSteps: string[];
    totalSteps: number;
    progressPercent: number;
  };
  running: boolean;
}

export interface BudgetResponse {
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  remaining: number;
  warning: boolean;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  raw: string;
}

export interface CreatedFile {
  path: string;
  size: number;
  createdAt: string;
}