'use client';

import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div className="p-8 border rounded-2xl bg-card text-card-foreground shadow-lg flex flex-col items-center gap-6 min-w-[300px]">
      <h2 className="text-xl font-semibold tracking-tight">Interactive Counter</h2>
      <div className="text-7xl font-black tabular-nums transition-all">
        {count}
      </div>
      <div className="flex gap-4 w-full">
        <button
          onClick={() => setCount(prev => prev - 1)}
          className="flex-1 px-4 py-3 bg-secondary text-secondary-foreground rounded-lg font-medium hover:opacity-80 transition-all active:scale-95 border"
        >
          Decrement
        </button>
        <button
          onClick={() => setCount(prev => prev + 1)}
          className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-all active:scale-95"
        >
          Increment
        </button>
      </div>
      <button 
        onClick={() => setCount(0)}
        className="text-xs text-muted-foreground hover:underline"
      >
        Reset Counter
      </button>
    </div>
  );
}