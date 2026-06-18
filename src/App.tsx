import { useState, useEffect } from 'react';
import { db, initializeDB, runEscalationEngine } from './services/db';
import type { User } from './services/db';
import { Dashboard } from './pages/Dashboard';
import { Tickets } from './pages/Tickets';
import { Worklist } from './pages/Worklist';
import { TicketDetail } from './pages/TicketDetail';
import { Reports } from './pages/Reports';
import { Admin } from './pages/Admin';

import { 
  LayoutDashboard, ListTodo, ClipboardList, BarChart3, 
  ShieldCheck, Bell, RefreshCw, AlertTriangle, Plus, Settings,
  Sun, Moon
} from 'lucide-react';

export default function App() {
  const [initialized, setInitialized] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Routing State
  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [currentTicketId, setCurrentTicketId] = useState<string | null>(null);
  const [ticketsSubView, setTicketsSubView] = useState<'list' | 'new'>('list');

  // Background System Cron Alerts
  const [alerts, setAlerts] = useState<string[]>([]);
  const [notificationLog, setNotificationLog] = useState<string[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Toggle theme class on body
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }, [theme]);

  // Initialize Local Storage Database
  useEffect(() => {
    initializeDB();
    const loadedUsers = db.getUsers();
    setUsers(loadedUsers);
    
    // Default logged-in user: John Doe (L1 Support Agent)
    const defaultUser = loadedUsers.find(u => u.role === 'l1_agent') || loadedUsers[0];
    setCurrentUser(defaultUser);
    
    setInitialized(true);

    // Initial seed notification log
    setNotificationLog([
      'Ticketing database initialized with default org ITMS Global Logistics.',
      'Active Morning Shift (A) clock synchronized (06:00 - 14:00).',
      'L1 Support Team, Network Operations Team, Java Backend Team shifts loaded.',
      'Roster definitions populated. John Doe (L1), Ravi Kumar (NET) on shift.'
    ]);
  }, []);

  // Background Engine Simulation (SLA & Escalation check every 10 seconds!)
  useEffect(() => {
    if (!initialized) return;

    const runEngineCheck = () => {
      const result = runEscalationEngine();
      if (result.escalatedCount > 0 || result.messages.length > 0) {
        // Accumulate alerts and notification logs
        setAlerts(prev => [...prev, ...result.messages]);
        setNotificationLog(prev => [...result.messages, ...prev]);
        
        // Auto remove alert toast after 6 seconds
        setTimeout(() => {
          setAlerts(prev => prev.slice(result.messages.length));
        }, 6000);
      }
    };

    // Run immediately and then poll every 10s
    runEngineCheck();
    const interval = setInterval(runEngineCheck, 10000);
    return () => clearInterval(interval);
  }, [initialized]);

  if (!initialized || !currentUser) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100vh',
        alignItems: 'center', justifyContent: 'center', backgroundColor: '#080c14',
        color: '#fff', fontFamily: 'sans-serif'
      }}>
        <RefreshCw className="animate-spin" size={32} style={{ color: 'var(--accent-primary)', marginBottom: '12px' }} />
        <p>Loading ITMS Ticketing System...</p>
      </div>
    );
  }

  const handleResetDatabase = () => {
    if (window.confirm('Are you sure you want to reset the database? This will clear all changes and restore original preseeded tickets.')) {
      db.reset();
      window.location.reload();
    }
  };

  const handleUserChange = (userId: string) => {
    const usr = users.find(u => u.id === userId);
    if (usr) {
      setCurrentUser(usr);
      // Auto redirect to appropriate page
      if (usr.role === 'ticket_raiser') {
        setCurrentPage('tickets');
        setTicketsSubView('list');
      } else if (['l1_agent', 'l2_agent'].includes(usr.role)) {
        setCurrentPage('worklist');
      } else {
        setCurrentPage('dashboard');
      }
    }
  };

  const handleNavigate = (page: string, ticketId?: string) => {
    if (page === 'ticket_detail' && ticketId) {
      setCurrentTicketId(ticketId);
    }
    
    // Set tickets subview if raising ticket
    if (page === 'tickets_new') {
      setCurrentPage('tickets');
      setTicketsSubView('new');
    } else {
      setCurrentPage(page);
    }
  };

  // Nav access permission filters
  const hasAccess = (pageName: string) => {
    const role = currentUser.role;
    if (pageName === 'worklist') {
      return ['l1_agent', 'l2_agent', 'l3_senior', 'group_lead', 'admin'].includes(role);
    }
    if (pageName === 'admin') {
      return ['admin', 'group_lead'].includes(role);
    }
    if (pageName === 'reports') {
      return ['admin', 'group_lead', 'report_viewer', 'l1_agent', 'l2_agent', 'l3_senior'].includes(role);
    }
    return true;
  };

  return (
    <div className="app-container">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="sidebar">
        <div className="logo">
          <ShieldCheck className="logo-icon" size={24} />
          <span>ITMS Ticketing</span>
        </div>

        <nav className="nav-group">
          <a 
            className={`nav-link ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleNavigate('dashboard')}
          >
            <LayoutDashboard size={18} /> Dashboard
          </a>

          <a 
            className={`nav-link ${currentPage === 'tickets' && ticketsSubView === 'list' ? 'active' : ''}`}
            onClick={() => handleNavigate('tickets')}
          >
            <ListTodo size={18} /> My Tickets
          </a>

          <a 
            className={`nav-link ${currentPage === 'tickets' && ticketsSubView === 'new' ? 'active' : ''}`}
            onClick={() => handleNavigate('tickets_new')}
          >
            <Plus size={18} /> Raise a Ticket
          </a>

          {hasAccess('worklist') && (
            <a 
              className={`nav-link ${currentPage === 'worklist' ? 'active' : ''}`}
              onClick={() => handleNavigate('worklist')}
            >
              <ClipboardList size={18} /> Agent Worklist
            </a>
          )}

          {hasAccess('reports') && (
            <a 
              className={`nav-link ${currentPage === 'reports' ? 'active' : ''}`}
              onClick={() => handleNavigate('reports')}
            >
              <BarChart3 size={18} /> Reports
            </a>
          )}

          {hasAccess('admin') && (
            <a 
              className={`nav-link ${currentPage === 'admin' ? 'active' : ''}`}
              onClick={() => handleNavigate('admin')}
            >
              <Settings size={18} /> Admin Panel
            </a>
          )}
        </nav>

        {/* Sidebar Footer info */}
        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '16px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <div>Org: ITMS Global Logistics</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
            <span className="sla-dot green"></span>
            <span>Background check: Running</span>
          </div>
        </div>
      </aside>

      {/* MAIN LAYOUT WRAPPER */}
      <main className="main-content">
        
        {/* HEADER BAR */}
        <header className="header">
          {/* Active view title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <span>ITMS Portal</span>
            <span>/</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'capitalize' }}>
              {currentPage.replace('_', ' ')}
            </span>
          </div>

          {/* Action Bar: User persona switcher, reset database, notifications */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            
            {/* Database seed reset */}
            <button 
              className="btn btn-secondary" 
              style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={handleResetDatabase}
              title="Reset database to fresh seeded state"
            >
              <RefreshCw size={12} /> Reset Data
            </button>

            {/* Theme Toggle Button */}
            <button 
              className="btn btn-secondary" 
              style={{ padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            >
              {theme === 'dark' ? <Sun size={16} style={{ color: '#ffd166' }} /> : <Moon size={16} style={{ color: '#7c3aed' }} />}
            </button>

            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '8px', borderRadius: '50%' }}
                onClick={() => setShowNotifications(!showNotifications)}
                title="System event logs & notifications"
              >
                <Bell size={16} />
                {notificationLog.length > 0 && (
                  <span style={{
                    position: 'absolute', top: '-4px', right: '-4px',
                    background: 'var(--status-inprogress)', color: '#fff',
                    borderRadius: '50%', width: '16px', height: '16px',
                    fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700
                  }}>
                    {notificationLog.length}
                  </span>
                )}
              </button>

              {/* Notification dropdown dropdown log */}
              {showNotifications && (
                <div 
                  className="glass-card"
                  style={{
                    position: 'absolute', right: 0, top: '45px', width: '350px',
                    maxHeight: '300px', overflowY: 'auto', zIndex: 1000, padding: '16px',
                    display: 'flex', flexDirection: 'column', gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Notification Event Log</span>
                    <button 
                      className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                      onClick={() => setNotificationLog([])}
                    >
                      Clear
                    </button>
                  </div>

                  {notificationLog.length === 0 ? (
                    <div style={{ padding: '10px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No new notifications</div>
                  ) : (
                    notificationLog.map((log, idx) => (
                      <div 
                        key={idx} 
                        style={{ 
                          fontSize: '0.75rem', padding: '6px 8px', background: 'rgba(0,0,0,0.2)',
                          borderLeft: '2px solid var(--accent-primary)', borderRadius: '2px'
                        }}
                      >
                        {log}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Persona Switcher widget */}
            <div className="persona-switcher">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Role Switcher:</span>
              <select 
                className="persona-select"
                value={currentUser.id}
                onChange={e => handleUserChange(e.target.value)}
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>
            
          </div>
        </header>

        {/* ACTIVE PAGE PORTAL BODY */}
        <section className="page-body">
          {currentPage === 'dashboard' && (
            <Dashboard 
              onNavigate={handleNavigate}
              currentUserRole={currentUser.role}
            />
          )}

          {currentPage === 'tickets' && (
            <Tickets 
              currentUserId={currentUser.id}
              onNavigate={handleNavigate}
              subView={ticketsSubView}
            />
          )}

          {currentPage === 'worklist' && (
            <Worklist 
              currentUserId={currentUser.id}
              onNavigate={handleNavigate}
            />
          )}

          {currentPage === 'ticket_detail' && currentTicketId && (
            <TicketDetail 
              ticketId={currentTicketId}
              currentUserId={currentUser.id}
              onBack={() => {
                if (['l1_agent', 'l2_agent', 'group_lead', 'admin'].includes(currentUser.role)) {
                  setCurrentPage('worklist');
                } else {
                  setCurrentPage('tickets');
                }
              }}
              onNavigate={handleNavigate}
            />
          )}

          {currentPage === 'reports' && <Reports />}

          {currentPage === 'admin' && <Admin />}
        </section>

        {/* LIVE SYSTEM AUTO-ESCALATION ALERTS TOAST WRAPPER */}
        {alerts.length > 0 && (
          <div style={{
            position: 'fixed', bottom: '24px', right: '24px',
            display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 9999
          }}>
            {alerts.map((alert, idx) => (
              <div 
                key={idx}
                className="glass-card"
                style={{
                  background: 'rgba(239, 71, 111, 0.95)',
                  border: '1px solid #ef476f',
                  padding: '12px 18px',
                  borderRadius: 'var(--radius-sm)',
                  color: '#fff',
                  boxShadow: '0 8px 24px rgba(239, 71, 111, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  maxWidth: '350px',
                  animation: 'pulse-glow-red 2s infinite'
                }}
              >
                <AlertTriangle size={20} />
                <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{alert}</div>
              </div>
            ))}
          </div>
        )}

      </main>

    </div>
  );
}
