// components/layout/ReportTabs.js
// Tab navigation in uppercase terminal style with sticky top offset

const TABS = [
  { id: 'overview', label: 'OVERVIEW' },
  { id: 'financials', label: 'FINANCIALS' },
  { id: 'valuation', label: 'VALUATION' },
  { id: 'forensics', label: 'FORENSICS' },
  { id: 'shareholding', label: 'SHAREHOLDING' },
  { id: 'risks', label: 'RISKS' },
];

export default function ReportTabs({ activeTab, onTabChange }) {
  return (
    <div style={{
      position: 'sticky',
      top: '48px',
      backgroundColor: 'var(--bg-0)',
      borderBottom: '1px solid var(--border-subtle)',
      zIndex: 90,
      width: '100%'
    }}>
      <div className="no-scrollbar" style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 16px',
        display: 'flex',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                background: 'none',
                border: 'none',
                padding: '12px 16px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 500,
                color: isActive ? 'var(--text-0)' : 'var(--text-1)',
                cursor: 'pointer',
                borderBottom: isActive ? '2px solid var(--accent-yellow)' : '2px solid transparent',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap'
              }}
              onMouseOver={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--text-0)';
              }}
              onMouseOut={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--text-1)';
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { TABS };
