import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom';
import Sidebar from './Sidebar';
import { ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, Menu } from 'lucide-react';
import { sidebarGroups } from '../../config/mastersConfig';

export default function AppLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleToggle = () => {
    if (window.innerWidth <= 900) {
      setMobileSidebarOpen(prev => !prev);
    } else {
      setDesktopSidebarCollapsed(prev => !prev);
    }
  };

  const isSidebarOpen = window.innerWidth <= 900 ? mobileSidebarOpen : !desktopSidebarCollapsed;

  return (
    <div className={`app-shell ${desktopSidebarCollapsed ? 'desktop-sidebar-collapsed' : ''} ${mobileSidebarOpen ? 'mobile-sidebar-open' : ''}`}>
      {/* Floating Sidebar Toggle Button */}
      <button
        onClick={handleToggle}
        className="sidebar-toggle-btn"
        aria-label="Toggle Navigation"
      >
        {isMobile && !isSidebarOpen ? (
          <Menu size={14} />
        ) : isSidebarOpen ? (
          <ChevronLeft size={14} />
        ) : (
          <ChevronRight size={14} />
        )}
      </button>

      <Sidebar open={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} collapsed={desktopSidebarCollapsed && !isMobile} isMobile={isMobile} />
      <div className="app-main" id="app-main-target" style={{ position: 'relative' }}>
        {/* Navigation History Control Bar */}
        <div className="navigation-history-bar" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '0 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
          height: '52px',
          position: 'sticky',
          top: 0,
          zIndex: 90,
          flexWrap: 'nowrap',
          overflow: 'hidden'
        }}>
          {/* Back & Forward History Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => navigate(-1)}
              title="Go Back"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'none',
                color: 'var(--text-h)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseOut={e => e.currentTarget.style.background = 'none'}
            >
              <ArrowLeft size={14} />
            </button>
            <button
              onClick={() => navigate(1)}
              title="Go Forward"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'none',
                color: 'var(--text-h)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseOut={e => e.currentTarget.style.background = 'none'}
            >
              <ArrowRight size={14} />
            </button>
          </div>

          <div id="header-title-target" style={{ marginLeft: '16px', display: 'flex', alignItems: 'center' }} />

          {/* Master Tabs as Breadcrumb-style links */}
          {(() => {
            const loc = location.pathname;
            let activeItems = null;

            for (const group of sidebarGroups) {
              if (group.items && group.items.some(i => loc.startsWith(i.path))) {
                activeItems = group.items;
                break;
              }
              if (group.subgroups) {
                for (const sub of group.subgroups) {
                  if (sub.items && sub.items.some(i => loc.startsWith(i.path))) {
                    activeItems = sub.items;
                    break;
                  }
                }
              }
              if (activeItems) break;
            }

            if (!activeItems) return null;

            if (isMobile) return null; // Hide top tabs on mobile, sidebar handles it

            return (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                marginLeft: '12px', 
                fontSize: '13px',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                scrollbarWidth: 'none'
              }}>
                {activeItems.map((item, index) => (
                  <span key={item.path} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) => `nav-text-link ${isActive ? 'active' : ''}`}
                      style={({ isActive }) => ({
                        color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                        fontWeight: isActive ? '600' : '500',
                        textDecoration: 'none',
                        transition: 'color 0.2s ease'
                      })}
                    >
                      {item.label}
                    </NavLink>
                    {index < activeItems.length - 1 && (
                      <span style={{ color: 'var(--border-color)' }}>/</span>
                    )}
                  </span>
                ))}
              </div>
            );
          })()}

          {/* Portal target for page actions (search & add button) */}
          <div id="header-actions-target" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }} />
        </div>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// HeaderFilter removed: global filter option disabled across pages
