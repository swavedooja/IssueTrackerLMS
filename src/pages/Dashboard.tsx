import React, { useState, useEffect } from 'react';
import { db, getOnDutyAgents } from '../services/db';
import type { Ticket } from '../services/db';
import { 
  AlertCircle, CheckCircle, Clock, Users, HardDrive, 
  Cpu, Wifi, Settings, BarChart2
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (page: string, ticketId?: string) => void;
  currentUserRole: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, currentUserRole: _currentUserRole }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState({
    open: 0,
    breached: 0,
    avgResolveTime: '0h',
    activeShifts: 0,
    activeAgentsCount: 0
  });

  useEffect(() => {
    const loadData = () => {
      const allTickets = db.getTickets();
      setTickets(allTickets);

      // Open/In Progress Count
      const openCount = allTickets.filter(t => ['open', 'in_progress'].includes(t.status)).length;
      
      // SLA Breached Count
      const breachedCount = allTickets.filter(t => t.sla_breached).length;

      // Avg Resolution Time (for resolved/closed tickets)
      const resolved = allTickets.filter(t => t.resolved_at);
      let avgText = 'N/A';
      if (resolved.length > 0) {
        const totalDurationMs = resolved.reduce((acc, t) => {
          const start = new Date(t.created_at).getTime();
          const end = new Date(t.resolved_at!).getTime();
          return acc + (end - start);
        }, 0);
        const avgMins = Math.round((totalDurationMs / resolved.length) / 60000);
        if (avgMins < 60) {
          avgText = `${avgMins}m`;
        } else {
          avgText = `${(avgMins / 60).toFixed(1)}h`;
        }
      }

      // Current shifts & Active agents
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${currentHours}:${currentMinutes}`;
      const activeShifts = db.getShifts().filter(s => {
        if (!s.crosses_midnight) {
          return currentTime >= s.start_time && currentTime < s.end_time;
        }
        return currentTime >= s.start_time || currentTime < s.end_time;
      });

      let agentsCount = 0;
      db.getGroups().forEach(g => {
        agentsCount += getOnDutyAgents(g.id).length;
      });

      setStats({
        open: openCount,
        breached: breachedCount,
        avgResolveTime: avgText,
        activeShifts: activeShifts.length,
        activeAgentsCount: agentsCount
      });
    };

    loadData();
    // Poll every 5 seconds to stay updated with background rules
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Calculate Volume By Category for chart
  const categories = db.getCategories();
  const categoryCounts = categories.map(cat => {
    const count = tickets.filter(t => t.category_id === cat.id).length;
    return { name: cat.name, code: cat.code, count };
  });
  const maxCategoryCount = Math.max(...categoryCounts.map(c => c.count), 1);

  // Status counts for pie chart simulation
  const statusCounts = {
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    pending: tickets.filter(t => t.status === 'pending').length,
    resolved: tickets.filter(t => t.status === 'resolved').length
  };
  const totalActive = statusCounts.open + statusCounts.in_progress + statusCounts.pending + statusCounts.resolved || 1;

  // Recent Comments / Activity feed
  const recentActivities = db.getComments()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const getCategoryIcon = (code: string) => {
    switch (code) {
      case 'HW': return <HardDrive size={18} className="text-cyan-400" />;
      case 'SW': return <Cpu size={18} className="text-violet-400" />;
      case 'NW': return <Wifi size={18} className="text-emerald-400" />;
      default: return <Settings size={18} className="text-amber-400" />;
    }
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '6px' }}>Operations Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Real-time overview of ITMS issue queues, SLA health, and active shifts.</p>
      </div>

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '20px'
      }}>
        {/* Card 1 */}
        <div className="glass-card interactive" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            background: 'rgba(0, 210, 255, 0.1)',
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--accent-primary)'
          }}>
            <AlertCircle size={28} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Active Backlog</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '2px 0' }}>{stats.open}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Open / In Progress</div>
          </div>
        </div>

        {/* Card 2 */}
        <div className="glass-card interactive" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            background: 'rgba(239, 71, 111, 0.1)',
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--sla-red)'
          }}>
            <Clock size={28} className={stats.breached > 0 ? 'animate-pulse' : ''} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>SLA Breaches</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '2px 0', color: stats.breached > 0 ? 'var(--sla-red)' : 'var(--text-primary)' }}>{stats.breached}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Require immediate action</div>
          </div>
        </div>

        {/* Card 3 */}
        <div className="glass-card interactive" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            background: 'rgba(6, 214, 160, 0.1)',
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--sla-green)'
          }}>
            <CheckCircle size={28} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>MTTR (Resolved)</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '2px 0' }}>{stats.avgResolveTime}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Avg resolution speed</div>
          </div>
        </div>

        {/* Card 4 */}
        <div className="glass-card interactive" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            background: 'rgba(157, 78, 221, 0.1)',
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--accent-secondary)'
          }}>
            <Users size={28} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Agents On Shift</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '2px 0' }}>{stats.activeAgentsCount}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Across {stats.activeShifts} active shifts</div>
          </div>
        </div>
      </div>

      {/* Main Charts & Analytics Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '30px'
      }}>
        {/* Chart 1: Volume by Category */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <BarChart2 size={20} className="text-cyan-400" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Ticket Volume by Category</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {categoryCounts.map(cat => {
              const percentage = Math.round((cat.count / maxCategoryCount) * 100);
              return (
                <div key={cat.code} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {getCategoryIcon(cat.code)}
                      <span style={{ fontWeight: 500 }}>{cat.name}</span>
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{cat.count} tickets</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${percentage}%`,
                      background: 'linear-gradient(90deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
                      borderRadius: '10px',
                      transition: 'width 1s ease-out'
                    }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 2: Status Breakdown Ring */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <div className="sla-dot green"></div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Backlog Status Split</h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flex: 1, gap: '20px', flexWrap: 'wrap' }}>
            {/* SVG Ring Chart */}
            <div style={{ position: 'relative', width: '130px', height: '130px' }}>
              <svg width="100%" height="100%" viewBox="0 0 42 42" className="donut">
                <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--bg-surface-hover)" strokeWidth="3"></circle>
                
                {/* Simulated Segment Rings */}
                {/* For mock visualization, we just draw standard overlapping dashed strokes or simple circle representations */}
                {/* Let's draw standard SVG rings based on status ratios */}
                {(() => {
                  const pctOpen = (statusCounts.open / totalActive) * 100;
                  const pctProg = (statusCounts.in_progress / totalActive) * 100;
                  const pctPend = (statusCounts.pending / totalActive) * 100;
                  const pctResol = (statusCounts.resolved / totalActive) * 100;

                  let accumulated = 0;

                  return (
                    <>
                      {pctOpen > 0 && (
                        <circle cx="21" cy="21" r="15.915" fill="transparent" 
                                stroke="var(--status-open)" strokeWidth="3"
                                strokeDasharray={`${pctOpen} ${100 - pctOpen}`}
                                strokeDashoffset={100 - accumulated + 25} />
                      )}
                      {(() => { accumulated += pctOpen; return null; })()}

                      {pctProg > 0 && (
                        <circle cx="21" cy="21" r="15.915" fill="transparent" 
                                stroke="var(--status-inprogress)" strokeWidth="3"
                                strokeDasharray={`${pctProg} ${100 - pctProg}`}
                                strokeDashoffset={100 - accumulated + 25} />
                      )}
                      {(() => { accumulated += pctProg; return null; })()}

                      {pctPend > 0 && (
                        <circle cx="21" cy="21" r="15.915" fill="transparent" 
                                stroke="var(--status-pending)" strokeWidth="3"
                                strokeDasharray={`${pctPend} ${100 - pctPend}`}
                                strokeDashoffset={100 - accumulated + 25} />
                      )}
                      {(() => { accumulated += pctPend; return null; })()}

                      {pctResol > 0 && (
                        <circle cx="21" cy="21" r="15.915" fill="transparent" 
                                stroke="var(--status-resolved)" strokeWidth="3"
                                strokeDasharray={`${pctResol} ${100 - pctResol}`}
                                strokeDashoffset={100 - accumulated + 25} />
                      )}
                    </>
                  );
                })()}
              </svg>
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center'
              }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>{tickets.filter(t => t.status !== 'closed').length}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active</span>
              </div>
            </div>

            {/* Labels */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '120px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--status-open)' }}></span>
                <span style={{ color: 'var(--text-secondary)' }}>Open:</span>
                <span style={{ fontWeight: 600 }}>{statusCounts.open}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--status-inprogress)' }}></span>
                <span style={{ color: 'var(--text-secondary)' }}>In Progress:</span>
                <span style={{ fontWeight: 600 }}>{statusCounts.in_progress}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--status-pending)' }}></span>
                <span style={{ color: 'var(--text-secondary)' }}>Pending:</span>
                <span style={{ fontWeight: 600 }}>{statusCounts.pending}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--status-resolved)' }}></span>
                <span style={{ color: 'var(--text-secondary)' }}>Resolved:</span>
                <span style={{ fontWeight: 600 }}>{statusCounts.resolved}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Timeline */}
      <div className="glass-card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px' }}>Recent Resolution Activity Feed</h3>
        {recentActivities.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No recent audit comments or actions found.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {recentActivities.map(act => {
              const ticket = tickets.find(t => t.id === act.ticket_id);
              const author = db.getUsers().find(u => u.id === act.author_id);
              return (
                <div key={act.id} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '85%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span 
                        onClick={() => ticket && onNavigate('ticket_detail', ticket.id)}
                        style={{ color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        {ticket?.ticket_number || 'TKT-????'}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>•</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {author?.name || 'System'}
                      </span>
                      {act.is_internal && (
                        <span style={{ fontSize: '0.65rem', background: 'rgba(157,78,221,0.2)', color: 'var(--accent-secondary)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 700 }}>
                          Internal
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                      {act.comment}
                    </p>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
