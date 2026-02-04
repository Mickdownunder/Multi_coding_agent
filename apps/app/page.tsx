import SecurityTelemetry from '@/components/SecurityTelemetry';

/**
 * Main Dashboard Page (Server Component)
 * Integrates the SecurityTelemetry component into the control system layout.
 */
export default async function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-8 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">Control System v1.0</h1>
          <div className="flex items-center space-x-2">
            <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-500 font-medium">System Active</span>
          </div>
        </div>
      </header>
      
      <main className="flex-1 p-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Embedding SecurityTelemetry at the top of the dashboard for high visibility */}
          <SecurityTelemetry />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 min-h-[400px]">
                <h2 className="text-lg font-semibold mb-4">Execution Monitor</h2>
                <p className="text-gray-500">Real-time agent execution logs will appear here.</p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4">Control Files</h2>
                <ul className="space-y-3 text-sm">
                  <li className="flex justify-between"><span>state.txt</span><span className="text-blue-600">PLAN</span></li>
                  <li className="flex justify-between"><span>intent.md</span><span className="text-green-600">READY</span></li>
                  <li className="flex justify-between"><span>rules.md</span><span className="text-green-600">READY</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}