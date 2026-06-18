import React, { useState, useEffect } from 'react';
import { db, getOnDutyAgents } from '../services/db';
import type { Ticket } from '../services/db';
import { 
  Check, MessageSquare, UserPlus, FileCheck, Award
} from 'lucide-react';

interface WorklistProps {
  currentUserId: string;
  onNavigate: (page: string, ticketId?: string) => void;
}

export const Worklist: React.FC<WorklistProps> = ({ currentUserId, onNavigate }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  // Quick Action Modal states
  const [activeModal, setActiveModal] = useState<'comment' | 'reassign' | 'resolve' | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentInternal, setCommentInternal] = useState(false);
  
  // Reassign Modal State
  const [reassignGroupId, setReassignGroupId] = useState('');
  const [reassignAgentId, setReassignAgentId] = useState('');

  // RCA Modal state
  const [rcaRootCause, setRcaRootCause] = useState('');
  const [rcaFactors, setRcaFactors] = useState('');
  const [rcaCorrective, setRcaCorrective] = useState('');
  const [rcaPreventive, setRcaPreventive] = useState('');
  const [rcaSystems, setRcaSystems] = useState<string[]>([]);
  const [rcaCustSummary, setRcaCustSummary] = useState('');
  const [rcaCustActions, setRcaCustActions] = useState('');

  // Ticking state for SLA countdowns
  const [, setTick] = useState(0);

  useEffect(() => {
    // 1-second interval to tick down SLA timers in real time!
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadWorklist = () => {
      const user = db.getUsers().find(u => u.id === currentUserId);
      if (!user) return;
      setCurrentUser(user);

      // Find user assignment groups
      const members = db.getMembers().filter(m => m.user_id === currentUserId && m.is_active);
      const groupIds = members.map(m => m.group_id);

      // Filter tickets:
      // Show tickets assigned to this agent OR assigned to group queues that they are members of
      let workTickets = db.getTickets().filter(t => {
        const isAssignedToMe = t.assigned_to === currentUserId;
        const isAssignedToMyGroup = t.assigned_group && groupIds.includes(t.assigned_group) && t.assigned_to === null;
        const isSupervisorOrAdmin = ['admin', 'l3_senior'].includes(user.role);
        
        return (isAssignedToMe || isAssignedToMyGroup || isSupervisorOrAdmin) && ['open', 'in_progress', 'pending'].includes(t.status);
      });

      // Sort by Priority: Critical -> High -> Medium -> Low
      // Then by SLA Due time ascending
      const priorityWeights = { critical: 4, high: 3, medium: 2, low: 1 };
      workTickets.sort((a, b) => {
        const pwA = priorityWeights[a.priority] || 0;
        const pwB = priorityWeights[b.priority] || 0;
        if (pwA !== pwB) return pwB - pwA; // higher priority first
        return new Date(a.sla_due_at).getTime() - new Date(b.sla_due_at).getTime(); // nearest due time first
      });

      setTickets(workTickets);
    };

    loadWorklist();
    // Poll list updates every 5 seconds
    const interval = setInterval(loadWorklist, 5000);
    return () => clearInterval(interval);
  }, [currentUserId, activeModal]);

  const handleAcknowledge = (ticket: Ticket) => {
    const allTickets = db.getTickets();
    const target = allTickets.find(t => t.id === ticket.id);
    if (target) {
      target.status = 'in_progress';
      target.assigned_to = currentUserId; // Pick it up
      target.updated_at = new Date().toISOString();
      db.saveTickets(allTickets);

      // System comment audit
      const comments = db.getComments();
      comments.push({
        id: `com-ack-${Date.now()}`,
        ticket_id: ticket.id,
        author_id: currentUserId,
        comment: `[TICKET ACKNOWLEDGED]: Picked up by L1/L2 agent ${currentUser?.name}. Status set to IN PROGRESS.`,
        is_internal: true,
        attachments: [],
        created_at: new Date().toISOString()
      });
      db.saveComments(comments);
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !commentText.trim()) return;

    const comments = db.getComments();
    comments.push({
      id: `com-act-${Date.now()}`,
      ticket_id: selectedTicket.id,
      author_id: currentUserId,
      comment: commentText,
      is_internal: commentInternal,
      attachments: [],
      created_at: new Date().toISOString()
    });
    db.saveComments(comments);

    setCommentText('');
    setCommentInternal(false);
    setActiveModal(null);
    setSelectedTicket(null);
  };

  const handleReassign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !reassignGroupId) return;

    const allTickets = db.getTickets();
    const target = allTickets.find(t => t.id === selectedTicket.id);
    if (target) {

      // Assign dynamically or manually
      target.assigned_group = reassignGroupId;
      target.assigned_to = reassignAgentId || null; // standard assignment
      target.updated_at = new Date().toISOString();
      db.saveTickets(allTickets);

      // Audit log
      const gName = db.getGroups().find(g => g.id === reassignGroupId)?.name || 'New Group';
      const aName = db.getUsers().find(u => u.id === reassignAgentId)?.name || 'Group Queue';
      const comments = db.getComments();
      comments.push({
        id: `com-reassign-${Date.now()}`,
        ticket_id: selectedTicket.id,
        author_id: currentUserId,
        comment: `[TICKET REASSIGNED]: Reassigned to group "${gName}" (Agent: ${aName}).`,
        is_internal: true,
        attachments: [],
        created_at: new Date().toISOString()
      });
      db.saveComments(comments);
    }

    setReassignGroupId('');
    setReassignAgentId('');
    setActiveModal(null);
    setSelectedTicket(null);
  };

  const handleResolve = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !rcaRootCause.trim() || !rcaCustSummary.trim()) {
      alert('RCA root cause and customer summary are required fields.');
      return;
    }

    const allTickets = db.getTickets();
    const target = allTickets.find(t => t.id === selectedTicket.id);
    if (target) {
      const now = new Date();
      target.status = 'resolved';
      target.resolved_at = now.toISOString();
      target.updated_at = now.toISOString();
      db.saveTickets(allTickets);

      // Save RCA
      const rcas = db.getRCAs();
      rcas.push({
        id: `rca-${Date.now()}`,
        ticket_id: selectedTicket.id,
        root_cause: rcaRootCause,
        contributing_factors: rcaFactors,
        corrective_actions: rcaCorrective,
        preventive_actions: rcaPreventive,
        affected_systems: rcaSystems,
        customer_summary: rcaCustSummary,
        customer_actions: rcaCustActions,
        prepared_by: currentUserId,
        submitted_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      });
      db.saveRCAs(rcas);

      // Add audit comment
      const comments = db.getComments();
      comments.push({
        id: `com-resolve-${Date.now()}`,
        ticket_id: selectedTicket.id,
        author_id: currentUserId,
        comment: `[TICKET RESOLVED]: Resolved by ${currentUser?.name}. Dual Root Cause Analysis (RCA) submitted successfully. Customer summary shared.`,
        is_internal: false,
        attachments: [],
        created_at: now.toISOString()
      });
      db.saveComments(comments);
    }

    // Reset fields
    setRcaRootCause('');
    setRcaFactors('');
    setRcaCorrective('');
    setRcaPreventive('');
    setRcaSystems([]);
    setRcaCustSummary('');
    setRcaCustActions('');
    setActiveModal(null);
    setSelectedTicket(null);
  };

  // SLA math helper
  const getSlaInfo = (ticket: Ticket) => {
    const now = new Date().getTime();
    const created = new Date(ticket.created_at).getTime();
    const due = new Date(ticket.sla_due_at).getTime();
    
    const totalSla = due - created;
    const remaining = due - now;
    const ratio = remaining / totalSla;

    let text = '';
    let statusClass = 'green';
    let breached = false;

    if (remaining < 0) {
      breached = true;
      statusClass = 'grey';
      const diffMins = Math.round(Math.abs(remaining) / 60000);
      if (diffMins < 60) {
        text = `Breached by ${diffMins}m`;
      } else {
        text = `Breached by ${(diffMins / 60).toFixed(1)}h`;
      }
    } else {
      const diffMins = Math.round(remaining / 60000);
      if (ratio > 0.5) {
        statusClass = 'green';
      } else if (ratio > 0.25) {
        statusClass = 'amber';
      } else {
        statusClass = 'red';
      }

      if (diffMins < 60) {
        text = `${diffMins}m remaining`;
      } else {
        text = `${(diffMins / 60).toFixed(1)}h remaining`;
      }
    }

    return { text, statusClass, breached };
  };

  const toggleAffectedSystem = (sys: string) => {
    if (rcaSystems.includes(sys)) {
      setRcaSystems(rcaSystems.filter(s => s !== sys));
    } else {
      setRcaSystems([...rcaSystems, sys]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '6px' }}>Agent Worklist</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Shift-aware active ticket allocation queue. Items are sorted by severity and deadline.</p>
      </div>

      <div className="glass-card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px' }}>Tickets Queue ({tickets.length})</h3>
        
        {tickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <Award size={48} style={{ marginBottom: '12px', color: 'var(--accent-primary)' }} />
            <p>Inbox zero! There are no tickets in your queue right now.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '12px 16px' }}>Ticket Info</th>
                  <th style={{ padding: '12px 16px' }}>Assigned Group</th>
                  <th style={{ padding: '12px 16px' }}>Assignee</th>
                  <th style={{ padding: '12px 16px' }}>SLA Deadline</th>
                  <th style={{ padding: '12px 16px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => {
                  const sla = getSlaInfo(t);
                  const isAssignedToMe = t.assigned_to === currentUserId;
                  const borderClass = `sla-row-${sla.statusClass}`;

                  return (
                    <tr 
                      key={t.id}
                      className={`interactive ${borderClass}`}
                      style={{ 
                        borderBottom: '1px solid var(--border-color)', 
                        fontSize: '0.9rem',
                        transition: 'background 0.2s',
                      }}
                    >
                      {/* Ticket Info */}
                      <td 
                        style={{ padding: '16px', cursor: 'pointer' }}
                        onClick={() => onNavigate('ticket_detail', t.id)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{t.ticket_number}</span>
                          <span className={`badge badge-priority-${t.priority}`}>{t.priority}</span>
                          <span className={`badge badge-${t.status.replace('_', '')}`}>{t.status}</span>
                        </div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Raised: {new Date(t.created_at).toLocaleDateString()} at {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({t.source} intake)
                        </div>
                      </td>

                      {/* Group */}
                      <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                        {db.getGroups().find(g => g.id === t.assigned_group)?.name || 'Unassigned'}
                      </td>

                      {/* Assignee */}
                      <td style={{ padding: '16px' }}>
                        {t.assigned_to ? (
                          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                            {db.getUsers().find(u => u.id === t.assigned_to)?.name}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--sla-red)', fontWeight: 600 }}>Unassigned (Queue)</span>
                        )}
                      </td>

                      {/* SLA */}
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`sla-dot ${sla.statusClass}`}></span>
                          <span style={{ 
                            fontWeight: 600, 
                            color: sla.breached ? 'var(--sla-red)' : 'var(--text-primary)'
                          }}>
                            {sla.text}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Due: {new Date(t.sla_due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                          {!isAssignedToMe && (t.status === 'open' || t.assigned_to === null) && (
                            <button 
                              className="btn btn-success" 
                              style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                              onClick={() => handleAcknowledge(t)}
                            >
                              <Check size={12} /> Pick Up
                            </button>
                          )}
                          
                          {isAssignedToMe && (
                            <>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                onClick={() => {
                                  setSelectedTicket(t);
                                  setActiveModal('comment');
                                }}
                              >
                                <MessageSquare size={12} /> Comment
                              </button>
                              
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                onClick={() => {
                                  setSelectedTicket(t);
                                  setReassignGroupId(t.assigned_group || '');
                                  setReassignAgentId(t.assigned_to || '');
                                  setActiveModal('reassign');
                                }}
                              >
                                <UserPlus size={12} /> Reassign
                              </button>

                              <button 
                                className="btn btn-primary" 
                                style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                onClick={() => {
                                  setSelectedTicket(t);
                                  // Seed defaults for RCA
                                  setRcaCustSummary(`The issue regarding ${t.title.toLowerCase()} was resolved successfully.`);
                                  setActiveModal('resolve');
                                }}
                              >
                                <FileCheck size={12} /> Resolve
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QUICK ACTION MODALS (Comment, Reassign, Resolve) */}
      
      {/* 1. Comment Modal */}
      {activeModal === 'comment' && selectedTicket && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleAddComment} className="glass-card" style={{ width: '450px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Add Comment on {selectedTicket.ticket_number}</h3>
            
            <div className="form-group">
              <label className="form-label">Comment text</label>
              <textarea 
                className="form-control" rows={4} placeholder="Type comment..."
                value={commentText} onChange={e => setCommentText(e.target.value)} required
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" id="is_internal"
                checked={commentInternal} onChange={e => setCommentInternal(e.target.checked)}
              />
              <label htmlFor="is_internal" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Internal Note (only visible to L1/L2/Admin support)
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setActiveModal(null); setSelectedTicket(null); }}>Cancel</button>
              <button type="submit" className="btn btn-primary">Add Comment</button>
            </div>
          </form>
        </div>
      )}

      {/* 2. Reassign Modal */}
      {activeModal === 'reassign' && selectedTicket && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleReassign} className="glass-card" style={{ width: '450px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Reassign {selectedTicket.ticket_number}</h3>
            
            <div className="form-group">
              <label className="form-label">Assignment Group</label>
              <select 
                className="form-control" value={reassignGroupId} 
                onChange={e => {
                  setReassignGroupId(e.target.value);
                  setReassignAgentId(''); // Reset agent
                }} required
              >
                <option value="">Select Group</option>
                {db.getGroups().map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Assign Agent (On Shift / Queue)</label>
              <select 
                className="form-control" value={reassignAgentId} 
                onChange={e => setReassignAgentId(e.target.value)}
              >
                <option value="">Group Queue (Assignee = None)</option>
                {db.getUsers()
                  .filter(u => {
                    const isAgent = ['l1_agent', 'l2_agent', 'group_lead', 'admin'].includes(u.role);
                    // Filter members if group is selected
                    if (reassignGroupId) {
                      const isMember = db.getMembers().some(m => m.group_id === reassignGroupId && m.user_id === u.id);
                      return isAgent && isMember;
                    }
                    return isAgent;
                  })
                  .map(u => {
                    // Check if agent is on duty right now for this group
                    const onDuty = reassignGroupId ? getOnDutyAgents(reassignGroupId).some(od => od.id === u.id) : false;
                    return (
                      <option key={u.id} value={u.id}>
                        {u.name} {onDuty ? '🟢 (ON SHIFT)' : '⚪ (OFF SHIFT)'}
                      </option>
                    );
                  })
                }
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setActiveModal(null); setSelectedTicket(null); }}>Cancel</button>
              <button type="submit" className="btn btn-primary">Reassign</button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Resolve & RCA Modal */}
      {activeModal === 'resolve' && selectedTicket && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          overflowY: 'auto'
        }}>
          <form onSubmit={handleResolve} className="glass-card" style={{ width: '600px', display: 'flex', flexDirection: 'column', gap: '15px', margin: '40px 0' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              Resolve {selectedTicket.ticket_number} - RCA Submission
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '-8px' }}>
              Submit Root Cause Analysis to resolve ticket.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              {/* Technical RCA */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent-secondary)' }}>1. Technical RCA (Internal)</h4>
                
                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Root Cause *</label>
                  <textarea 
                    className="form-control" rows={3} placeholder="Technical/Internal root cause description..."
                    value={rcaRootCause} onChange={e => setRcaRootCause(e.target.value)} required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Contributing Factors</label>
                  <textarea 
                    className="form-control" rows={2} placeholder="Any secondary contributing factors..."
                    value={rcaFactors} onChange={e => setRcaFactors(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Corrective Actions</label>
                  <textarea 
                    className="form-control" rows={2} placeholder="Action taken to fix the immediate issue..."
                    value={rcaCorrective} onChange={e => setRcaCorrective(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Preventive Actions</label>
                  <textarea 
                    className="form-control" rows={2} placeholder="Steps taken to prevent recurrence..."
                    value={rcaPreventive} onChange={e => setRcaPreventive(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Affected Systems</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {['Hardware RFID', 'Spring Gateway', 'Database Sync', 'Boom Barrier Controller', 'Weighbridge Serial Interface'].map(sys => {
                      const selected = rcaSystems.includes(sys);
                      return (
                        <span 
                          key={sys} onClick={() => toggleAffectedSystem(sys)}
                          style={{
                            fontSize: '0.7rem', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer',
                            border: '1px solid var(--border-color)',
                            backgroundColor: selected ? 'var(--accent-secondary-glow)' : 'transparent',
                            color: selected ? 'var(--accent-secondary)' : 'var(--text-secondary)'
                          }}
                        >
                          {sys}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Customer RCA */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '1px solid var(--border-color)', paddingLeft: '15px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent-primary)' }}>2. Customer RCA (Public)</h4>

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Customer Summary *</label>
                  <textarea 
                    className="form-control" rows={4} placeholder="Plain-language explanation shared with the ticket raiser..."
                    value={rcaCustSummary} onChange={e => setRcaCustSummary(e.target.value)} required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Customer Actions / Next Steps</label>
                  <textarea 
                    className="form-control" rows={3} placeholder="What the transporter/plant user needs to do next..."
                    value={rcaCustActions} onChange={e => setRcaCustActions(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setActiveModal(null); setSelectedTicket(null); }}>Cancel</button>
              <button type="submit" className="btn btn-primary">Resolve & Submit RCA</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
