'use client';

import React, { useState } from 'react';
import { Activity } from 'lucide-react';

export default function MetricDisplay() {
  const [value, setValue] = useState<number>(0);

  const handleTrigger = () => {
    // Simulate a metric update
    setValue(Math.floor(Math.random() * 100));
  };

  return (
    <div className="p-6 max-w-sm bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center space-x-4 mb-6">
        <div className="p-3 bg-indigo-50 rounded-lg">
          <Activity className="h-6 w-6 text-indigo-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">System Performance</p>
          <p className="text-2xl font-bold text-gray-900">{value}%</p>
        </div>
      </div>
      
      <button
        onClick={handleTrigger}
        className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
      >
        Update Metric
      </button>
    </div>
  );
}