'use client';

import { useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';

export default function Page() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [systemState, setSystemState] = useState('PLAN');

  return (
    <DashboardLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="space-y-6">
        {/* State Control Card */}
        <section className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">System Control</h3>
              <p className="text-sm text-slate-500">Manage the execution lifecycle</p>
            </div>
            <div className={`status-badge status-${systemState.toLowerCase()}`}>
              {systemState}
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {['PLAN', 'IMPLEMENT', 'VERIFY', 'DONE', 'FAIL'].map((state) => (
              <button
                key={state}
                onClick={() => setSystemState(state)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                  systemState === state
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
                }`}
              >
                {state}
              </button>
            ))}
          </div>
        </section>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity Feed / Logs */}
          <div className="lg:col-span-2 card flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h4 className="font-bold text-slate-800">Execution Logs</h4>
              <button className="text-xs text-indigo-600 font-medium hover:underline">Clear</button>
            </div>
            <div className="p-4 bg-slate-900 text-slate-300 font-mono text-xs h-96 overflow-auto">
              <div className="mb-1"><span className="text-slate-500">[2023-10-27 10:00:01]</span> <span className="text-blue-400">[INFO]</span> Initializing system...</div>
              <div className="mb-1"><span className="text-slate-500">[2023-10-27 10:00:05]</span> <span className="text-blue-400">[INFO]</span> Reading intent.md...</div>
              <div className="mb-1"><span className="text-slate-500">[2023-10-27 10:00:08]</span> <span className="text-amber-400">[WARN]</span> No plan.md found, switching to PLAN state.</div>
              <div className="mb-1 text-green-400"><span className="text-slate-500">[2023-10-27 10:01:12]</span> [SUCCESS] State updated to PLAN</div>
            </div>
          </div>

          {/* Stats / Info Sidebar */}
          <div className="space-y-6">
            <div className="card p-6">
              <h4 className="font-bold text-slate-800 mb-4">Token Budget</h4>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500">Usage</span>
                    <span className="font-medium">$0.42 / $5.00</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-indigo-600 h-2 rounded-full" style={{ width: '8.4%' }}></div>
                  </div>
                </div>
                <button className="w-full btn-secondary text-sm py-2">Reset Budget</button>
              </div>
            </div>

            <div className="card p-6 bg-indigo-600 text-white">
              <h4 className="font-bold mb-2">Ready to build?</h4>
              <p className="text-indigo-100 text-sm mb-4">Set your project intent in the Assistant tab to get started.</p>
              <button className="w-full bg-white text-indigo-600 font-bold py-2 rounded-lg hover:bg-indigo-50 transition-colors">
                Open Assistant
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}