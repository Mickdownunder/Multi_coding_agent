export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'failed';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}