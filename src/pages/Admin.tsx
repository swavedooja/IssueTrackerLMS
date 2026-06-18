import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import type { 
  TicketCategory, TicketSubcategory, AssignmentGroup, 
  ShiftDefinition, ShiftRoster, EscalationRule, SLAPolicy, User 
} from '../services/db';
import { 
  Settings, FolderTree, Users, Clock, Calendar, 
  Upload, AlertTriangle, Check, AlertCircle, Edit2
} from 'lucide-react';

export const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'categories' | 'groups' | 'escalation' | 'sla' | 'rosters'>('categories');
  
  // Lists
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [subcategories, setSubcategories] = useState<TicketSubcategory[]>([]);
  const [groups, setGroups] = useState<AssignmentGroup[]>([]);
  const [rules, setRules] = useState<EscalationRule[]>([]);
  const [policies, setPolicies] = useState<SLAPolicy[]>([]);
  const [shifts, setShifts] = useState<ShiftDefinition[]>([]);
  const [rosters, setRosters] = useState<ShiftRoster[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // CSV Upload State
  const [csvText, setCsvText] = useState('');
  const [uploadPreview, setUploadPreview] = useState<any[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Policy Edit State
  const [editingPolicy, setEditingPolicy] = useState<string | null>(null);
  const [policyResponseMin, setPolicyResponseMin] = useState(0);
  const [policyResolveHrs, setPolicyResolveHrs] = useState(0);

  useEffect(() => {
    loadAdminData();
  }, [activeTab]);

  const loadAdminData = () => {
    setCategories(db.getCategories());
    setSubcategories(db.getSubcategories());
    setGroups(db.getGroups());
    setRules(db.getEscalationRules());
    setPolicies(db.getSLAPolicies());
    setShifts(db.getShifts());
    setRosters(db.getRosters());
    setUsers(db.getUsers());
  };

  // CSV Parsing simulation
  const handleCSVParse = () => {
    setUploadErrors([]);
    setUploadPreview([]);
    setUploadSuccess(false);

    if (!csvText.trim()) {
      setUploadErrors(['CSV text is empty.']);
      return;
    }

    const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      setUploadErrors(['CSV must contain a header and at least one data row.']);
      return;
    }

    const header = lines[0].toLowerCase().split(',');
    const expectedHeaders = ['user_email', 'group_code', 'shift_code', 'roster_date', 'level'];
    const headersMatch = expectedHeaders.every(h => header.includes(h));

    if (!headersMatch) {
      setUploadErrors([`Invalid header format. Expected exactly: ${expectedHeaders.join(',')}`]);
      return;
    }

    const emailIdx = header.indexOf('user_email');
    const groupIdx = header.indexOf('group_code');
    const shiftIdx = header.indexOf('shift_code');
    const dateIdx = header.indexOf('roster_date');
    const levelIdx = header.indexOf('level');

    const parsedRows: any[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length < 5) {
        errors.push(`Row ${i + 1}: Insufficient columns. Skip.`);
        continue;
      }

      const email = cols[emailIdx];
      const gCode = cols[groupIdx].toUpperCase();
      const sCode = cols[shiftIdx].toUpperCase();
      const dateStr = cols[dateIdx];
      const level = cols[levelIdx].toLowerCase();

      // Validations
      const user = users.find(u => u.email === email);
      if (!user) {
        errors.push(`Row ${i + 1}: User email not registered: "${email}"`);
        continue;
      }

      const group = groups.find(g => g.code === gCode);
      if (!group) {
        errors.push(`Row ${i + 1}: Assignment Group code not found: "${gCode}"`);
        continue;
      }

      const shift = shifts.find(s => s.code === sCode);
      if (!shift) {
        errors.push(`Row ${i + 1}: Shift code not found: "${sCode}"`);
        continue;
      }

      // Validate date YYYY-MM-DD
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateStr)) {
        errors.push(`Row ${i + 1}: Date format must be YYYY-MM-DD, found: "${dateStr}"`);
        continue;
      }

      if (!['agent', 'lead', 'supervisor'].includes(level)) {
        errors.push(`Row ${i + 1}: Level must be agent, lead or supervisor. Found: "${level}"`);
        continue;
      }

      parsedRows.push({
        id: `ros-csv-${Date.now()}-${i}`,
        org_id: 'org-111',
        user_id: user.id,
        user_name: user.name,
        user_email: user.email,
        group_id: group.id,
        group_name: group.name,
        shift_id: shift.id,
        shift_name: shift.name,
        roster_date: dateStr,
        level,
        is_active: true
      });
    }

    setUploadErrors(errors);
    setUploadPreview(parsedRows);
  };

  const handleCommitRosters = () => {
    if (uploadPreview.length === 0) return;

    // Append to existing rosters
    const updatedRosters = [...rosters];
    uploadPreview.forEach(row => {
      // Remove duplication if exists
      const dupIdx = updatedRosters.findIndex(
        r => r.user_id === row.user_id && r.roster_date === row.roster_date && r.shift_id === row.shift_id
      );
      const dbRow: ShiftRoster = {
        id: row.id,
        org_id: row.org_id,
        user_id: row.user_id,
        group_id: row.group_id,
        shift_id: row.shift_id,
        roster_date: row.roster_date,
        level: row.level,
        is_active: row.is_active
      };
      if (dupIdx > -1) {
        updatedRosters[dupIdx] = dbRow;
      } else {
        updatedRosters.push(dbRow);
      }
    });

    db.saveRosters(updatedRosters);
    setUploadPreview([]);
    setCsvText('');
    setUploadSuccess(true);
    loadAdminData();
  };

  const loadMockCSVExample = () => {
    const today = new Date().toISOString().split('T')[0];
    const csvContent = `user_email,group_code,shift_code,roster_date,level
john@company.com,L1,A,${today},agent
jane@company.com,L1,B,${today},lead
ravi@company.com,NETWORK,A,${today},agent
sarah@company.com,BACKEND,B,${today},agent
unknown@company.com,L1,A,${today},agent
john@company.com,INVALID,C,${today},agent`;
    
    setCsvText(csvContent);
  };

  // Calendar mapping helpers
  const getNext7Days = () => {
    const days = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(now.getTime() + i * 24 * 3600 * 1000);
      days.push(date.toISOString().split('T')[0]);
    }
    return days;
  };

  const next7Days = getNext7Days();

  // Policy Edit Handler
  const handleSavePolicy = (id: string) => {
    const updated = policies.map(p => {
      if (p.id === id) {
        return { ...p, response_min: policyResponseMin, resolution_hrs: policyResolveHrs };
      }
      return p;
    });
    db.saveSLAPolicies(updated);
    setEditingPolicy(null);
    loadAdminData();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      {/* Title */}
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '6px' }}>Ticketing Administration</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Configure master metadata databases, SLA parameters, escalation logic triggers, and rosters.</p>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '8px' }}>
        <button 
          className={`btn ${activeTab === 'categories' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('categories')}
        >
          <FolderTree size={16} /> Categories & Subcategories
        </button>
        <button 
          className={`btn ${activeTab === 'groups' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('groups')}
        >
          <Users size={16} /> Groups & Members
        </button>
        <button 
          className={`btn ${activeTab === 'escalation' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('escalation')}
        >
          <Settings size={16} /> Escalation Rules
        </button>
        <button 
          className={`btn ${activeTab === 'sla' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('sla')}
        >
          <Clock size={16} /> SLA Configuration
        </button>
        <button 
          className={`btn ${activeTab === 'rosters' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('rosters')}
        >
          <Calendar size={16} /> Shifts & Rosters
        </button>
      </div>

      {/* TAB CONTENTS */}

      {/* 1. Categories */}
      {activeTab === 'categories' && (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Category Configuration Master</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {categories.map(cat => (
              <div key={cat.id} style={{
                background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)', padding: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    <span style={{ color: 'var(--accent-primary)' }}>[{cat.code}]</span>
                    <span>{cat.name}</span>
                  </div>
                  <span className="badge badge-resolved" style={{ fontSize: '0.65rem' }}>Active Category</span>
                </div>

                {/* Subcategories list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '15px' }}>
                  {subcategories.filter(s => s.category_id === cat.id).map(sub => {
                    const defaultGrpName = groups.find(g => g.id === sub.default_group)?.name || 'Default L1 Support';
                    return (
                      <div key={sub.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontSize: '0.85rem', padding: '8px 12px', background: 'rgba(255,255,255,0.01)',
                        border: '1px solid rgba(255,255,255,0.03)', borderRadius: '4px'
                      }}>
                        <div>
                          <span style={{ fontWeight: 600 }}>{sub.name}</span>
                          <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>({sub.code})</span>
                        </div>
                        <div style={{ display: 'flex', gap: '15px', color: 'var(--text-secondary)' }}>
                          <span>Priority: <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{sub.default_priority.toUpperCase()}</span></span>
                          <span>Auto Group: <span style={{ fontWeight: 600 }}>{defaultGrpName}</span></span>
                          <span>SLA Override: <span style={{ fontWeight: 600 }}>{sub.sla_hours ? `${sub.sla_hours} hrs` : 'Default'}</span></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Groups & Members */}
      {activeTab === 'groups' && (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Support Assignment Groups</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {groups.map(grp => (
              <div key={grp.id} style={{
                background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px'
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--accent-primary)' }}>{grp.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Code: {grp.code}</div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>{grp.description}</p>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Active Members:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {db.getMembers().filter(m => m.group_id === grp.id && m.is_active).map(mem => {
                      const u = users.find(usr => usr.id === mem.user_id);
                      return (
                        <div key={mem.id} style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                          <span>• {u?.name}</span>
                          <span style={{ color: mem.role === 'lead' ? 'var(--status-pending)' : 'var(--text-muted)', fontWeight: 600, textTransform: 'capitalize' }}>
                            {mem.role}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Escalation Rules */}
      {activeTab === 'escalation' && (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Cron-Triggered Escalation Rules</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px 8px' }}>Rule Name</th>
                <th style={{ padding: '12px 8px' }}>Triggers On</th>
                <th style={{ padding: '12px 8px' }}>Escalation Level</th>
                <th style={{ padding: '12px 8px' }}>Delay (Cron Timer)</th>
                <th style={{ padding: '12px 8px' }}>Routes To Group</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => (
                <tr key={rule.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '14px 8px', fontWeight: 600 }}>{rule.name}</td>
                  <td style={{ padding: '14px 8px', color: 'var(--text-secondary)' }}>
                    {rule.priority ? `Priority: ${rule.priority.toUpperCase()}` : 'All priorities'}
                    {rule.subcategory_id && ` | Subcat: ${subcategories.find(s => s.id === rule.subcategory_id)?.name}`}
                  </td>
                  <td style={{ padding: '14px 8px' }}>
                    <span className="badge badge-inprogress">Lvl {rule.level} Escalation</span>
                  </td>
                  <td style={{ padding: '14px 8px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                    {rule.trigger_after_min} min elapsed
                  </td>
                  <td style={{ padding: '14px 8px', fontWeight: 600 }}>
                    {groups.find(g => g.id === rule.escalate_to_group)?.name}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. SLA Policies */}
      {activeTab === 'sla' && (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>SLA Policy Matrix Configurations</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {policies.map(pol => (
              <div key={pol.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)', padding: '16px', flexWrap: 'wrap', gap: '15px'
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', textTransform: 'uppercase', color: 'var(--accent-primary)' }}>{pol.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Target Severity priority: <span style={{ fontWeight: 600 }}>{pol.priority.toUpperCase()}</span>
                  </div>
                </div>

                {editingPolicy === pol.id ? (
                  /* Edit Mode Inputs */
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.7rem' }}>Response Target (min)</label>
                      <input 
                        type="number" className="form-control" style={{ width: '90px', padding: '6px' }}
                        value={policyResponseMin} onChange={e => setPolicyResponseMin(Number(e.target.value))}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.7rem' }}>Resolution Target (hrs)</label>
                      <input 
                        type="number" className="form-control" style={{ width: '90px', padding: '6px' }}
                        value={policyResolveHrs} onChange={e => setPolicyResolveHrs(Number(e.target.value))}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '16px' }}>
                      <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => setEditingPolicy(null)}>Cancel</button>
                      <button type="button" className="btn btn-success" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => handleSavePolicy(pol.id)}>Save</button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div style={{ display: 'flex', alignItems: 'center', gap: '40px', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Response SLA</div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{pol.response_min} minutes</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Resolution SLA</div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{pol.resolution_hrs} hours</div>
                    </div>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                      onClick={() => {
                        setEditingPolicy(pol.id);
                        setPolicyResponseMin(pol.response_min);
                        setPolicyResolveHrs(pol.resolution_hrs);
                      }}
                    >
                      <Edit2 size={12} /> Customize
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Shift definitions & Roster Upload */}
      {activeTab === 'rosters' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* Calendar visualizer showing coverage maps & gaps */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px' }}>Roster Shift Coverage Calendar</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '-12px', marginBottom: '20px' }}>
              Next 7 days coverage mapping. Outlines on-duty agents rostered. Gaps highlighted in red.
            </p>

            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '150px repeat(7, 1fr)', gap: '10px', minWidth: '800px' }}>
                
                {/* Header Row */}
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '10px' }}>Shifts / Date</div>
                {next7Days.map(date => {
                  const d = new Date(date);
                  const label = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                  const dayName = d.toLocaleDateString([], { weekday: 'short' });
                  return (
                    <div key={date} style={{ textAlign: 'center', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{dayName}</div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{label}</div>
                    </div>
                  );
                })}

                {/* Data rows per Shift definition */}
                {shifts.map(shift => (
                  <React.Fragment key={shift.id}>
                    {/* Shift details cell */}
                    <div style={{
                      padding: '12px 8px', background: 'rgba(255,255,255,0.01)', borderRadius: '4px',
                      display: 'flex', flexDirection: 'column', justifySelf: 'stretch', justifyContent: 'center'
                    }}>
                      <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{shift.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>({shift.start_time} - {shift.end_time})</div>
                    </div>

                    {/* Next 7 days cells */}
                    {next7Days.map(date => {
                      // Find agents assigned to this shift on this date
                      const cellRosters = rosters.filter(r => r.shift_id === shift.id && r.roster_date === date && r.is_active);
                      const rosteredAgents = cellRosters.map(r => users.find(u => u.id === r.user_id)).filter(Boolean);
                      const hasGap = rosteredAgents.length === 0;

                      return (
                        <div 
                          key={date}
                          style={{
                            padding: '10px',
                            background: hasGap ? 'rgba(239, 71, 111, 0.04)' : 'rgba(255,255,255,0.01)',
                            border: `1px solid ${hasGap ? 'rgba(239, 71, 111, 0.15)' : 'var(--border-color)'}`,
                            borderRadius: '4px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '80px',
                            fontSize: '0.75rem'
                          }}
                        >
                          {hasGap ? (
                            <div style={{ color: 'var(--sla-red)', textAlign: 'center', fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <AlertTriangle size={14} /> GAP DETECTED
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                              {rosteredAgents.map((agent: any) => {
                                const groupCode = groups.find(g => g.id === cellRosters.find(r => r.user_id === agent.id)?.group_id)?.code || 'L1';
                                return (
                                  <div 
                                    key={agent.id} 
                                    style={{ 
                                      background: 'rgba(0, 210, 255, 0.08)', color: 'var(--accent-primary)',
                                      padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem',
                                      display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', fontWeight: 500
                                    }}
                                  >
                                    <span>{agent.name.split(' ')[0]}</span>
                                    <span style={{ opacity: 0.7 }}>{groupCode}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}

              </div>
            </div>
          </div>

          {/* Roster CSV Upload Form */}
          <div className="glass-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
            
            {/* Input area */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Roster CSV Upload Simulation</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '-8px' }}>
                Simulate bulk roster deployment upload via CSV parsing engine. Matches user email schemas, active shifts, and target groups.
              </p>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Roster Raw CSV Text</label>
                  <button type="button" className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.7rem' }} onClick={loadMockCSVExample}>
                    Load Sample CSV
                  </button>
                </div>
                <textarea 
                  className="form-control" rows={8} style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                  placeholder="user_email,group_code,shift_code,roster_date,level&#10;john@company.com,L1,A,2026-06-18,agent"
                  value={csvText} onChange={e => setCsvText(e.target.value)}
                />
              </div>

              <button type="button" className="btn btn-primary" onClick={handleCSVParse}>
                <Upload size={14} /> Parse & Validate CSV
              </button>

              {uploadSuccess && (
                <div style={{
                  padding: '12px', background: 'rgba(6,214,160,0.06)', border: '1px solid rgba(6,214,160,0.2)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--sla-green)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <Check size={16} /> Rostered schedules uploaded successfully! Coverage updated.
                </div>
              )}
            </div>

            {/* Validation Feedback & Preview area */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', borderLeft: '1px solid var(--border-color)', paddingLeft: '24px', minHeight: '300px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Validation Feedback Console</h4>

              {/* Error messages log */}
              {uploadErrors.length > 0 && (
                <div style={{
                  padding: '12px', background: 'rgba(239, 71, 111, 0.06)', border: '1px solid rgba(239, 71, 111, 0.2)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--sla-red)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '6px'
                }}>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={14} /> Inline Parsing Warnings:
                  </div>
                  <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '8px' }}>
                    {uploadErrors.map((err, idx) => <div key={idx}>• {err}</div>)}
                  </div>
                </div>
              )}

              {/* Preview table */}
              {uploadPreview.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--sla-green)' }}>
                    🟢 Parsed successfully: {uploadPreview.length} rows ready to commit
                  </div>
                  
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '6px' }}>Email</th>
                          <th style={{ padding: '6px' }}>Group</th>
                          <th style={{ padding: '6px' }}>Shift</th>
                          <th style={{ padding: '6px' }}>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadPreview.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '6px' }}>{row.user_email}</td>
                            <td style={{ padding: '6px' }}>{row.group_name.split(' ')[0]}</td>
                            <td style={{ padding: '6px' }}>{row.shift_name.split(' ')[0]}</td>
                            <td style={{ padding: '6px' }}>{row.roster_date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button type="button" className="btn btn-success" onClick={handleCommitRosters}>
                    Commit Rostered Schedule to DB
                  </button>
                </div>
              ) : (
                <div style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-muted)', fontSize: '0.85rem', border: '1px dashed var(--border-color)',
                  borderRadius: 'var(--radius-sm)', padding: '20px', textAlign: 'center'
                }}>
                  Load and validate a CSV file to preview schedule deployment updates.
                </div>
              )}

            </div>

          </div>

        </div>
      )}

    </div>
  );
};
