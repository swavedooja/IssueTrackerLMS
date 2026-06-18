import React, { useState, useEffect } from 'react';
import { db, getOnDutyAgents } from '../services/db';
import type { Ticket } from '../services/db';
import { 
  ShieldCheck, TrendingUp, AlertTriangle, 
  Clock, Users, Award, Download
} from 'lucide-react';

export const Reports: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [kpis, setKpis] = useState({
    open: 0,
    breaches: 0,
    avgTimeText: 'N/A',
    raisedToday: 0,
    raisedYesterday: 0,
    coverageGaps: 0
  });

  useEffect(() => {
    const all = db.getTickets();
    setTickets(all);

    // Open Backlog
    const openCount = all.filter(t => ['open', 'in_progress'].includes(t.status)).length;
    
    // SLA Breach Count
    const breachedCount = all.filter(t => t.sla_breached).length;

    // MTTR calculation
    const resolved = all.filter(t => t.resolved_at);
    let avgText = 'N/A';
    if (resolved.length > 0) {
      const totalMs = resolved.reduce((acc, t) => {
        const start = new Date(t.created_at).getTime();
        const end = new Date(t.resolved_at!).getTime();
        return acc + (end - start);
      }, 0);
      const avgMins = Math.round((totalMs / resolved.length) / 60000);
      avgText = avgMins < 60 ? `${avgMins}m` : `${(avgMins / 60).toFixed(1)}h`;
    }

    // Today vs Yesterday
    const startOfToday = new Date();
    startOfToday.setHours(0,0,0,0);
    const startOfYesterday = new Date(startOfToday.getTime() - 86400000);

    const todayCount = all.filter(t => new Date(t.created_at).getTime() >= startOfToday.getTime()).length;
    const yesterdayCount = all.filter(t => {
      const time = new Date(t.created_at).getTime();
      return time >= startOfYesterday.getTime() && time < startOfToday.getTime();
    }).length;

    // Coverage gaps (Groups without active agents on shift right now)
    let gapCount = 0;
    db.getGroups().forEach(g => {
      const onDuty = getOnDutyAgents(g.id);
      if (onDuty.length === 0) gapCount++;
    });

    setKpis({
      open: openCount,
      breaches: breachedCount,
      avgTimeText: avgText,
      raisedToday: todayCount,
      raisedYesterday: yesterdayCount,
      coverageGaps: gapCount
    });
  }, []);

  // 1. SLA Compliance rate per Category
  const categories = db.getCategories();
  const slaComplianceList = categories.map(cat => {
    const catTickets = tickets.filter(t => t.category_id === cat.id);
    const resolved = catTickets.filter(t => t.resolved_at !== null);
    if (resolved.length === 0) {
      return { name: cat.name, rate: 100, total: 0 }; // default 100% compliance if no tickets
    }
    const compliant = resolved.filter(t => {
      const resolvedTime = new Date(t.resolved_at!).getTime();
      const dueTime = new Date(t.sla_due_at).getTime();
      return resolvedTime <= dueTime;
    }).length;
    const rate = Math.round((compliant / resolved.length) * 100);
    return { name: cat.name, rate, total: catTickets.length };
  });

  // 2. Agent Performance
  // Find all agent roles and compute total tickets resolved and avg MTTR
  const agents = db.getUsers().filter(u => ['l1_agent', 'l2_agent', 'group_lead', 'admin', 'l3_senior'].includes(u.role));
  const agentPerformance = agents.map(agent => {
    const handled = tickets.filter(t => t.assigned_to === agent.id);
    const resolved = handled.filter(t => t.resolved_at !== null);
    const open = handled.filter(t => ['open', 'in_progress'].includes(t.status)).length;
    
    let mttrText = 'N/A';
    if (resolved.length > 0) {
      const totalMs = resolved.reduce((acc, t) => {
        const start = new Date(t.created_at).getTime();
        const end = new Date(t.resolved_at!).getTime();
        return acc + (end - start);
      }, 0);
      const avgMins = Math.round((totalMs / resolved.length) / 60000);
      mttrText = avgMins < 60 ? `${avgMins}m` : `${(avgMins / 60).toFixed(1)}h`;
    }

    return {
      name: agent.name,
      role: agent.role.replace('_', ' '),
      open,
      resolved: resolved.length,
      mttr: mttrText
    };
  });

  // 3. Escalations Breakdown
  const totalEscalated = db.getTicketEscalations().length;
  const autoEscalated = db.getTicketEscalations().filter(e => e.auto_triggered).length;
  const manualEscalated = totalEscalated - autoEscalated;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '6px' }}>Reports & Analytics</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Historical performance analytics, SLA compliance auditing, and support trends.</p>
        </div>
        <button 
          className="btn btn-secondary" 
          onClick={() => alert('Mock Download: PDF report generated!')}
          style={{ fontSize: '0.85rem' }}
        >
          <Download size={16} /> Export PDF Report
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '20px'
      }}>
        {/* Card 1: Backlog */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Active Backlog</span>
            <AlertTriangle size={18} className="text-cyan-400" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{kpis.open}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Raised today: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{kpis.raisedToday}</span> (vs yesterday: {kpis.raisedYesterday})
          </div>
        </div>

        {/* Card 2: SLA compliance */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>SLA Compliance</span>
            <ShieldCheck size={18} className="text-emerald-400" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--sla-green)' }}>
            {(() => {
              const totalResolved = tickets.filter(t => t.resolved_at).length;
              if (totalResolved === 0) return '100%';
              const compliant = tickets.filter(t => {
                if (!t.resolved_at) return false;
                return new Date(t.resolved_at).getTime() <= new Date(t.sla_due_at).getTime();
              }).length;
              return `${Math.round((compliant / totalResolved) * 100)}%`;
            })()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Total breached tickets: <span style={{ color: 'var(--sla-red)', fontWeight: 600 }}>{kpis.breaches}</span>
          </div>
        </div>

        {/* Card 3: MTTR */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Mean Time to Resolve</span>
            <Clock size={18} className="text-amber-400" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{kpis.avgTimeText}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Average speed of resolved issues</div>
        </div>

        {/* Card 4: Roster Shifts Gaps */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Coverage Gaps</span>
            <Users size={18} className={kpis.coverageGaps > 0 ? 'text-red-400' : 'text-slate-400'} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: kpis.coverageGaps > 0 ? 'var(--sla-red)' : 'var(--text-primary)' }}>
            {kpis.coverageGaps} Groups
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {kpis.coverageGaps > 0 ? 'Have NO active roster agents right now!' : 'All support groups fully covered'}
          </div>
        </div>
      </div>

      {/* SLA Breakdown and Escalation Trends */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '30px'
      }}>
        {/* SLA compliance breakdown */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <ShieldCheck size={18} className="text-emerald-400" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>SLA Compliance Rate by Category</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {slaComplianceList.map(item => {
              const color = item.rate > 80 ? 'var(--sla-green)' : item.rate > 50 ? 'var(--sla-amber)' : 'var(--sla-red)';
              return (
                <div key={item.name} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 500 }}>{item.name} ({item.total} tickets)</span>
                    <span style={{ fontWeight: 600, color }}>{item.rate}% Compliant</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${item.rate}%`,
                      backgroundColor: color,
                      borderRadius: '10px'
                    }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Escalation trends */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <TrendingUp size={18} className="text-cyan-400" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Escalation Rate Analysis</h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '20px', flexWrap: 'wrap', height: '100%' }}>
            {/* Visual breakdown ring */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>{totalEscalated}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Escalations</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '150px' }}>
              <div style={{
                background: 'rgba(0,0,0,0.2)', padding: '12px', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)'
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auto SLA Rules Triggered</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '4px' }}>
                  {autoEscalated} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>({totalEscalated > 0 ? Math.round((autoEscalated / totalEscalated) * 100) : 0}%)</span>
                </div>
              </div>

              <div style={{
                background: 'rgba(0,0,0,0.2)', padding: '12px', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)'
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Manual Agent Redirects</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-secondary)', marginTop: '4px' }}>
                  {manualEscalated} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>({totalEscalated > 0 ? Math.round((manualEscalated / totalEscalated) * 100) : 0}%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Performance Leaderboard */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Award size={18} className="text-cyan-400" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Agent Performance & Load Index</h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <th style={{ padding: '12px 16px' }}>Agent Name</th>
                <th style={{ padding: '12px 16px' }}>Tier / Role</th>
                <th style={{ padding: '12px 16px' }}>Open Backlog</th>
                <th style={{ padding: '12px 16px' }}>Resolved Tickets</th>
                <th style={{ padding: '12px 16px' }}>Avg MTTR</th>
              </tr>
            </thead>
            <tbody>
              {agentPerformance.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                  <td style={{ padding: '16px', fontWeight: 600 }}>{item.name}</td>
                  <td style={{ padding: '16px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{item.role}</td>
                  <td style={{ padding: '16px', fontWeight: 600, color: item.open > 0 ? 'var(--status-inprogress)' : 'var(--text-muted)' }}>{item.open}</td>
                  <td style={{ padding: '16px', fontWeight: 600, color: 'var(--status-resolved)' }}>{item.resolved}</td>
                  <td style={{ padding: '16px', color: 'var(--accent-primary)', fontWeight: 600 }}>{item.mttr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
