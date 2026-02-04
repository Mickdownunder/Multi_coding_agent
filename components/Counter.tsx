import React, { useState } from 'react';
import { Plus, RotateCcw } from 'lucide-react';

export const Counter: React.FC = () => {
  const [count, setCount] = useState<number>(0);

  const increment = () => setCount((prev) => prev + 1);
  const reset = () => setCount(0);

  return (
    <div className="p-6 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 max-w-sm mx-auto">
      <div className="text-center">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Current Count
        </h3>
        <div className="mt-2 text-5xl font-bold text-slate-900 dark:text-white">
          {count}
        </div>
      </div>

      <div className="mt-8 flex items-center justify-center gap-4">
        <button
          onClick={increment}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all active:scale-95 shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-5 h-5" />
          Increment
        </button>
        
        <button
          onClick={reset}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg transition-all active:scale-95"
        >
          <RotateCcw className="w-5 h-5" />
          Reset
        </button>
      </div>
    </div>
  );
};