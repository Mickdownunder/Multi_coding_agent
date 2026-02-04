import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { Task, TaskStatus } from '../types/task';
import { randomUUID } from 'crypto';

export class TaskService {
  private readonly storagePath: string;
  private readonly controlDir: string;

  constructor() {
    this.controlDir = join(process.cwd(), 'control');
    this.storagePath = join(this.controlDir, 'tasks.json');
  }

  private async ensureDirectory(): Promise<void> {
    try {
      await mkdir(this.controlDir, { recursive: true });
    } catch (error) {
      // Directory already exists or cannot be created
    }
  }

  async getAllTasks(): Promise<Task[]> {
    try {
      const data = await readFile(this.storagePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // Return empty array if file doesn't exist
      return [];
    }
  }

  async getTaskById(id: string): Promise<Task | undefined> {
    const tasks = await this.getAllTasks();
    return tasks.find(t => t.id === id);
  }

  async createTask(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    await this.ensureDirectory();
    const tasks = await this.getAllTasks();
    
    const newTask: Task = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    tasks.push(newTask);
    await this.saveTasks(tasks);
    return newTask;
  }

  async updateTask(id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<Task | null> {
    const tasks = await this.getAllTasks();
    const index = tasks.findIndex(t => t.id === id);

    if (index === -1) return null;

    const updatedTask: Task = {
      ...tasks[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    tasks[index] = updatedTask;
    await this.saveTasks(tasks);
    return updatedTask;
  }

  async deleteTask(id: string): Promise<boolean> {
    const tasks = await this.getAllTasks();
    const filteredTasks = tasks.filter(t => t.id !== id);

    if (filteredTasks.length === tasks.length) return false;

    await this.saveTasks(filteredTasks);
    return true;
  }

  private async saveTasks(tasks: Task[]): Promise<void> {
    await writeFile(this.storagePath, JSON.stringify(tasks, null, 2), 'utf-8');
  }
}