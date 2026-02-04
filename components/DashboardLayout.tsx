import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const DashboardLayout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'assistant', label: 'Intent Assistant', icon: '🤖' },
    { id: 'monitor', label: 'Monitor', icon: '🖥️' },
    { id: 'files', label: 'Files', icon: '📁' },
  ];

  return (
    <div className="flex h-screen" style={{ background: '#0f172a' }}>
      {/* Sidebar */}
      <aside className="w-64 flex flex-col" style={{ 
        background: '#1e293b', 
        borderRight: '1px solid #334155' 
      }}>
        <div className="p-6 border-b" style={{ borderColor: '#334155' }}>
          <h1 className="text-xl font-bold flex items-center gap-3" style={{ color: '#f1f5f9' }}>
            <span className="px-3 py-1.5 rounded-lg font-bold" style={{ 
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}>
              CS
            </span>
            <span style={{ color: '#f1f5f9' }}>Control System</span>
          </h1>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all"
              style={{
                background: activeTab === tab.id 
                  ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.1) 100%)'
                  : 'transparent',
                color: activeTab === tab.id ? '#60a5fa' : '#cbd5e1',
                border: activeTab === tab.id ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                boxShadow: activeTab === tab.id ? '0 2px 8px rgba(59, 130, 246, 0.2)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.background = '#334155';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span className="text-lg">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t" style={{ borderColor: '#334155' }}>
          <div className="rounded-lg p-3" style={{ background: '#0f172a' }}>
            <div className="text-xs mb-2" style={{ color: '#94a3b8' }}>System Status</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#10b981' }}></div>
              <span className="text-sm font-medium" style={{ color: '#cbd5e1' }}>Connected</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto" style={{ background: '#0f172a' }}>
        <header 
          className="h-16 flex items-center justify-between px-8 sticky top-0 z-10"
          style={{ 
            background: '#1e293b',
            borderBottom: '1px solid #334155',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
          }}
        >
          <h2 className="text-lg font-semibold" style={{ color: '#f1f5f9' }}>
            {tabs.find(t => t.id === activeTab)?.label}
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-xs" style={{ color: '#94a3b8' }}>v1.0.0</span>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
