import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const CONTROL_DIR = join(process.cwd(), 'control');
const TASKS_FILE = join(CONTROL_DIR, 'tasks.json');

interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

async function ensureTasksFile() {
  if (!existsSync(CONTROL_DIR)) {
    await mkdir(CONTROL_DIR, { recursive: true });
  }
  if (!existsSync(TASKS_FILE)) {
    await writeFile(TASKS_FILE, JSON.stringify([], null, 2));
  }
}

export async function GET() {
  try {
    await ensureTasksFile();
    const content = await readFile(TASKS_FILE, 'utf-8');
    const tasks = JSON.parse(content);
    return NextResponse.json(tasks);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch tasks', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTasksFile();
    const body = await request.json();
    
    if (!body.title || typeof body.title !== 'string') {
      return NextResponse.json(
        { error: 'Title is required and must be a string' },
        { status: 400 }
      );
    }

    const content = await readFile(TASKS_FILE, 'utf-8');
    const tasks: Task[] = JSON.parse(content);

    const newTask: Task = {
      id: crypto.randomUUID(),
      title: body.title,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    tasks.push(newTask);
    await writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2));

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create task', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}