import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');
const TASKS_FILE = join(DATA_DIR, 'tasks.json');

interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

async function getTasks(): Promise<Task[]> {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    const content = await readFile(TASKS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return [];
  }
}

async function saveTasks(tasks: Task[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const tasks = await getTasks();
    
    const taskIndex = tasks.findIndex(t => t.id === id);
    
    if (taskIndex === -1) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    tasks[taskIndex] = {
      ...tasks[taskIndex],
      ...body
    };

    await saveTasks(tasks);

    return NextResponse.json(tasks[taskIndex]);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tasks = await getTasks();
    
    const taskExists = tasks.some(t => t.id === id);
    if (!taskExists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const filteredTasks = tasks.filter(t => t.id !== id);
    await saveTasks(filteredTasks);

    return NextResponse.json({ message: 'Task deleted successfully' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}