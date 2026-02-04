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
    <div className="flex h-screen" style={{ background: 'var(--bg-void)' }}>
      {/* Sidebar with Glasmorphism */}
      <aside className="w-64 flex flex-col glass-surface" style={{ 
        background: 'rgba(26, 31, 46, 0.8)',
        backdropFilter: 'blur(12px) saturate(180%)',
        borderRight: '1px solid rgba(51, 65, 85, 0.3)',
        boxShadow: '4px 0 32px rgba(0, 0, 0, 0.3)'
      }}>
        <div className="p-6 border-b" style={{ borderColor: 'rgba(51, 65, 85, 0.3)' }}>
          <h1 className="text-xl font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
            <span className="px-3 py-1.5 font-bold" style={{ 
              background: 'linear-gradient(135deg, var(--atomic-blue) 0%, var(--atomic-blue-dark) 100%)',
              color: 'var(--bg-void)',
              borderRadius: 0,
              boxShadow: '0 0 15px var(--atomic-blue-glow)',
              border: '1px solid var(--atomic-blue)',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              fontSize: '12px'
            }}>
              CS
            </span>
            <span style={{ 
              color: 'var(--text-primary)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontSize: '14px',
              fontFamily: 'Inter, sans-serif'
            }}>Control System</span>
          </h1>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all"
              style={{
                background: activeTab === tab.id 
                  ? 'rgba(0, 212, 255, 0.15)'
                  : 'transparent',
                color: activeTab === tab.id ? 'var(--atomic-blue)' : 'var(--text-secondary)',
                border: activeTab === tab.id 
                  ? '1px solid var(--atomic-blue)' 
                  : '1px solid transparent',
                borderRadius: 0,
                boxShadow: activeTab === tab.id 
                  ? '0 0 15px var(--atomic-blue-glow), inset 0 0 10px rgba(0, 212, 255, 0.1)' 
                  : 'none',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontSize: '11px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.background = 'rgba(51, 65, 85, 0.3)';
                  e.currentTarget.style.borderColor = 'var(--border-accent)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                }
              }}
            >
              <span className="text-lg">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t" style={{ borderColor: 'rgba(51, 65, 85, 0.3)' }}>
          <div className="p-3 glass-surface" style={{ 
            background: 'rgba(11, 15, 26, 0.6)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 0
          }}>
            <div className="text-xs mb-2" style={{ 
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontFamily: 'monospace',
              fontSize: '10px'
            }}>System Status</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 animate-pulse" style={{ 
                background: '#00ff88',
                boxShadow: '0 0 8px #00ff88',
                borderRadius: 0
              }}></div>
              <span className="text-sm font-medium" style={{ 
                color: 'var(--text-secondary)',
                fontFamily: 'monospace',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>Connected</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto" style={{ background: 'var(--bg-void)' }}>
        <header 
          className="h-16 flex items-center justify-between px-8 sticky top-0 z-10 glass-surface"
          style={{ 
            background: 'rgba(26, 31, 46, 0.8)',
            backdropFilter: 'blur(12px) saturate(180%)',
            borderBottom: '1px solid rgba(51, 65, 85, 0.3)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
          }}
        >
          <h2 className="text-lg font-semibold" style={{ 
            color: 'var(--text-primary)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            fontFamily: 'Inter, sans-serif'
          }}>
            {tabs.find(t => t.id === activeTab)?.label}
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-xs" style={{ 
              color: 'var(--text-muted)',
              fontFamily: 'monospace',
              fontSize: '10px'
            }}>v1.0.0</span>
            <div style={{
              padding: '4px 8px',
              background: 'var(--bg-void)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 0,
              fontSize: '10px',
              color: 'var(--text-muted)',
              fontFamily: 'monospace',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              CMD+K
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
