import React, { useState, useEffect } from 'react';
import { db, routeAndAssignTicket } from '../services/db';
import type { Ticket, TicketComment, TicketEscalation, TicketRCA } from '../services/db';
import { 
  ArrowLeft, UserPlus, FileCheck, CheckCircle, 
  Shield, Paperclip, Send, AlertOctagon
} from 'lucide-react';

interface TicketDetailProps {
  ticketId: string;
  currentUserId: string;
  onBack: () => void;
  onNavigate: (page: string, ticketId?: string) => void;
}

export const TicketDetail: React.FC<TicketDetailProps> = ({ ticketId, currentUserId, onBack, onNavigate: _onNavigate }) => {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [_escalations, setEscalations] = useState<TicketEscalation[]>([]);
  const [rca, setRca] = useState<TicketRCA | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Form states
  const [commentText, setCommentText] = useState('');
  const [commentInternal, setCommentInternal] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignGroupId, setReassignGroupId] = useState('');
  const [reassignAgentId, setReassignAgentId] = useState('');
  
  // Manual Escalate State
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [escalateGroupId, setEscalateGroupId] = useState('');

  // Resolve State
  const [resolveOpen, setResolveOpen] = useState(false);
  const [rcaRootCause, setRcaRootCause] = useState('');
  const [rcaFactors, setRcaFactors] = useState('');
  const [rcaCorrective, setRcaCorrective] = useState('');
  const [rcaPreventive, setRcaPreventive] = useState('');
  const [rcaSystems, setRcaSystems] = useState<string[]>([]);
  const [rcaCustSummary, setRcaCustSummary] = useState('');
  const [rcaCustActions, setRcaCustActions] = useState('');

  // SLA ticker
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadTicketData = () => {
    const tkt = db.getTickets().find(t => t.id === ticketId);
    if (!tkt) return;
    setTicket(tkt);

    const usr = db.getUsers().find(u => u.id === currentUserId);
    setCurrentUser(usr);

    // Comments - role filter
    // Transporters should not see internal comments
    const allComments = db.getComments(ticketId);
    if (usr?.role === 'ticket_raiser') {
      setComments(allComments.filter(c => !c.is_internal));
    } else {
      setComments(allComments);
    }

    setEscalations(db.getTicketEscalations(ticketId));
    
    const ticketRca = db.getRCAs().find(r => r.ticket_id === ticketId);
    setRca(ticketRca || null);
  };

  useEffect(() => {
    loadTicketData();
  }, [ticketId, currentUserId]);

  if (!ticket) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
        <p>Ticket not found or has been deleted.</p>
        <button className="btn btn-secondary" onClick={onBack} style={{ marginTop: '15px' }}>Go Back</button>
      </div>
    );
  }

  const isRaiser = currentUser?.role === 'ticket_raiser';
  const isAgent = ['l1_agent', 'l2_agent', 'group_lead', 'admin', 'l3_senior'].includes(currentUser?.role || '');
  const isAssignedToMe = ticket.assigned_to === currentUserId;

  const handleAcknowledge = () => {
    const all = db.getTickets();
    const target = all.find(t => t.id === ticket.id);
    if (target) {
      target.status = 'in_progress';
      target.assigned_to = currentUserId;
      target.updated_at = new Date().toISOString();
      db.saveTickets(all);

      // Audit Comment
      const coms = db.getComments();
      coms.push({
        id: `com-detail-ack-${Date.now()}`,
        ticket_id: ticket.id,
        author_id: currentUserId,
        comment: `[TICKET ACKNOWLEDGED]: Picked up by support agent ${currentUser?.name}.`,
        is_internal: true,
        attachments: [],
        created_at: new Date().toISOString()
      });
      db.saveComments(coms);
      loadTicketData();
    }
  };

  const handleAddCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const coms = db.getComments();
    coms.push({
      id: `com-detail-add-${Date.now()}`,
      ticket_id: ticket.id,
      author_id: currentUserId,
      comment: commentText,
      is_internal: commentInternal,
      attachments: [],
      created_at: new Date().toISOString()
    });
    db.saveComments(coms);

    // Update ticket time
    const all = db.getTickets();
    const target = all.find(t => t.id === ticket.id);
    if (target) {
      target.updated_at = new Date().toISOString();
      db.saveTickets(all);
    }

    setCommentText('');
    setCommentInternal(false);
    loadTicketData();
  };

  const handleReassignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignGroupId) return;

    const all = db.getTickets();
    const target = all.find(t => t.id === ticket.id);
    if (target) {
      target.assigned_group = reassignGroupId;
      target.assigned_to = reassignAgentId || null;
      target.updated_at = new Date().toISOString();
      db.saveTickets(all);

      const gName = db.getGroups().find(g => g.id === reassignGroupId)?.name || 'Group';
      const aName = db.getUsers().find(u => u.id === reassignAgentId)?.name || 'Queue';

      const coms = db.getComments();
      coms.push({
        id: `com-detail-re-${Date.now()}`,
        ticket_id: ticket.id,
        author_id: currentUserId,
        comment: `[TICKET REASSIGNED]: Assigned to group "${gName}" (Agent: ${aName}).`,
        is_internal: true,
        attachments: [],
        created_at: new Date().toISOString()
      });
      db.saveComments(coms);

      setReassignOpen(false);
      loadTicketData();
    }
  };

  const handleManualEscalateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalateGroupId || !escalateReason.trim()) return;

    const all = db.getTickets();
    const target = all.find(t => t.id === ticket.id);
    if (target) {
      const prevGroup = target.assigned_group;
      const prevAssignee = target.assigned_to;
      const escList = db.getTicketEscalations();
      const nextLevel = escList.filter(e => e.ticket_id === ticket.id).length + 1;

      // Assign round robin in new group
      const { assigneeId, shiftId } = routeAndAssignTicket(target, escalateGroupId);

      target.assigned_group = escalateGroupId;
      target.assigned_to = assigneeId;
      target.shift_id = shiftId;
      target.status = 'open'; // Send back to open queue
      target.updated_at = new Date().toISOString();
      db.saveTickets(all);

      // Save Escalation
      escList.push({
        id: `esc-man-${Date.now()}`,
        ticket_id: ticket.id,
        escalated_from: prevAssignee,
        escalated_to: assigneeId,
        from_group: prevGroup,
        to_group: escalateGroupId,
        level: nextLevel,
        reason: escalateReason,
        auto_triggered: false,
        created_at: new Date().toISOString()
      });
      db.saveTicketEscalations(escList);

      // Audit comment
      const gName = db.getGroups().find(g => g.id === escalateGroupId)?.name || 'Next Tier';
      const aName = db.getUsers().find(u => u.id === assigneeId)?.name || 'Queue';
      const coms = db.getComments();
      coms.push({
        id: `com-detail-esc-${Date.now()}`,
        ticket_id: ticket.id,
        author_id: currentUserId,
        comment: `[MANUAL ESCALATION Level ${nextLevel}]: Escalated to "${gName}" (Assigned: ${aName}). Reason: "${escalateReason}"`,
        is_internal: true,
        attachments: [],
        created_at: new Date().toISOString()
      });
      db.saveComments(coms);

      setEscalateOpen(false);
      setEscalateReason('');
      loadTicketData();
    }
  };

  const handleResolveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rcaRootCause.trim() || !rcaCustSummary.trim()) return;

    const all = db.getTickets();
    const target = all.find(t => t.id === ticket.id);
    if (target) {
      const now = new Date();
      target.status = 'resolved';
      target.resolved_at = now.toISOString();
      target.updated_at = now.toISOString();
      db.saveTickets(all);

      const rcas = db.getRCAs();
      rcas.push({
        id: `rca-dt-${Date.now()}`,
        ticket_id: ticket.id,
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

      // Audit
      const coms = db.getComments();
      coms.push({
        id: `com-detail-resol-${Date.now()}`,
        ticket_id: ticket.id,
        author_id: currentUserId,
        comment: `[TICKET RESOLVED]: Resolved by ${currentUser?.name}. Customer summary shared publicly.`,
        is_internal: false,
        attachments: [],
        created_at: now.toISOString()
      });
      db.saveComments(coms);

      setResolveOpen(false);
      loadTicketData();
    }
  };

  const handleCloseTicket = () => {
    const all = db.getTickets();
    const target = all.find(t => t.id === ticket.id);
    if (target) {
      const now = new Date();
      target.status = 'closed';
      target.closed_at = now.toISOString();
      target.updated_at = now.toISOString();
      db.saveTickets(all);

      const coms = db.getComments();
      coms.push({
        id: `com-detail-close-${Date.now()}`,
        ticket_id: ticket.id,
        author_id: currentUserId,
        comment: `[TICKET CLOSED]: Confirmed resolved and closed by raiser.`,
        is_internal: false,
        attachments: [],
        created_at: now.toISOString()
      });
      db.saveComments(coms);
      loadTicketData();
    }
  };

  // Calculate SLA countdown
  const getSlaClock = () => {
    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      return { text: 'Resolved', css: 'var(--status-resolved)', remaining: 1 };
    }
    const now = new Date().getTime();
    const due = new Date(ticket.sla_due_at).getTime();
    const remaining = due - now;

    if (remaining < 0) {
      const absDiff = Math.abs(remaining);
      const hrs = Math.floor(absDiff / 3600000);
      const mins = Math.floor((absDiff % 3600000) / 60000);
      const secs = Math.floor((absDiff % 60000) / 1000);
      return { 
        text: `Breached by -${hrs}h ${mins}m ${secs}s`, 
        css: 'var(--sla-red)',
        remaining 
      };
    } else {
      const hrs = Math.floor(remaining / 3600000);
      const mins = Math.floor((remaining % 3600000) / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      
      const totalSla = due - new Date(ticket.created_at).getTime();
      const ratio = remaining / totalSla;
      const color = ratio > 0.5 ? 'var(--sla-green)' : ratio > 0.25 ? 'var(--sla-amber)' : 'var(--sla-red)';

      return { 
        text: `${hrs}h ${mins}m ${secs}s remaining`, 
        css: color,
        remaining 
      };
    }
  };

  const slaClock = getSlaClock();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Back button */}
      <div>
        <button 
          className="btn btn-secondary" 
          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
          onClick={onBack}
        >
          <ArrowLeft size={14} /> Back to Worklist/Portal
        </button>
      </div>

      {/* Header Panel */}
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--accent-primary)' }}>{ticket.ticket_number}</span>
            <span className={`badge badge-${ticket.status.replace('_', '')}`}>{ticket.status}</span>
            <span className={`badge badge-priority-${ticket.priority}`}>{ticket.priority}</span>
            {ticket.sla_breached && <span className="badge badge-priority-critical" style={{ animation: 'none' }}>SLA Breached</span>}
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{ticket.title}</h2>
        </div>

        {/* SLA Clock Surface */}
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          padding: '12px 20px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)',
          textAlign: 'right'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SLA Due Countdown</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: slaClock.css, marginTop: '4px' }}>{slaClock.text}</div>
        </div>
      </div>

      {/* Main Split Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '3fr 2fr',
        gap: '24px',
        alignItems: 'start'
      }}>
        {/* Left Side: Ticket description, comments input, timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Description Card */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '12px' }}>Description</h3>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
              {ticket.description || 'No description provided.'}
            </p>

            {ticket.metadata && Object.keys(ticket.metadata).length > 0 && (
              <div style={{
                marginTop: '16px',
                padding: '12px',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                fontSize: '0.85rem'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Linked ITMS Core Metadata</div>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  {Object.entries(ticket.metadata).map(([key, val]) => (
                    <div key={key}>
                      <span style={{ color: 'var(--text-muted)' }}>{key}: </span>
                      <span style={{ fontWeight: 500 }}>{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action bar and Comments Panel */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Resolution Updates & Timeline</h3>

            {/* Comment form */}
            {['open', 'in_progress', 'pending'].includes(ticket.status) && (
              <form onSubmit={handleAddCommentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <textarea 
                  className="form-control" rows={3} placeholder="Type a message or response update..."
                  value={commentText} onChange={e => setCommentText(e.target.value)} required
                />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  {isAgent ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="checkbox" id="comment_internal"
                        checked={commentInternal} onChange={e => setCommentInternal(e.target.checked)}
                      />
                      <label htmlFor="comment_internal" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        Internal support-only note
                      </label>
                    </div>
                  ) : <div />}

                  <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px' }}>
                    <Send size={14} /> Send Comment
                  </button>
                </div>
              </form>
            )}

            {/* Timeline log */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
              {comments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(c => {
                const author = db.getUsers().find(u => u.id === c.author_id);
                const isAudit = c.comment.startsWith('[');
                const isInternalNote = c.is_internal;

                return (
                  <div 
                    key={c.id}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-sm)',
                      background: isInternalNote 
                        ? 'rgba(157, 78, 221, 0.06)' 
                        : isAudit 
                          ? 'rgba(0,0,0,0.1)' 
                          : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isInternalNote ? 'rgba(157, 78, 221, 0.2)' : 'var(--border-color)'}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: isAudit ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                          {author?.name || 'System'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          ({author?.role.replace('_', ' ') || 'Process Service'})
                        </span>
                        {isInternalNote && (
                          <span style={{ fontSize: '0.65rem', background: 'rgba(157,78,221,0.2)', color: 'var(--accent-secondary)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 700 }}>
                            Internal Note
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(c.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p style={{ 
                      fontSize: '0.9rem', 
                      color: isAudit ? 'var(--text-secondary)' : 'var(--text-primary)',
                      fontStyle: isAudit ? 'italic' : 'normal',
                      lineHeight: '1.4',
                      wordBreak: 'break-word'
                    }}>
                      {c.comment}
                    </p>

                    {c.attachments && c.attachments.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        {c.attachments.map((att, idx) => (
                          <a 
                            key={idx} href={att.url} 
                            style={{ 
                              display: 'inline-flex', alignItems: 'center', gap: '6px', 
                              background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)',
                              padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--accent-primary)',
                              textDecoration: 'none'
                            }}
                          >
                            <Paperclip size={12} /> {att.name}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Info Panel, Assignment panel, RCA panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Action Console (CONTEXT SENSITIVE BUTTONS) */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>Action Console</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Pick Up Acknowledge (Available to agents on shift for this queue) */}
              {isAgent && (ticket.status === 'open' || ticket.assigned_to === null) && (
                <button className="btn btn-success" style={{ width: '100%' }} onClick={handleAcknowledge}>
                  <CheckCircle size={16} /> Acknowledge (Pick Up)
                </button>
              )}

              {/* Reassign (Visible to agents/leads/admins) */}
              {isAgent && (
                <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setReassignOpen(!reassignOpen)}>
                  <UserPlus size={16} /> Reassign Owner / Group
                </button>
              )}

              {/* Manual Escalate */}
              {isAgent && ['open', 'in_progress'].includes(ticket.status) && (
                <button className="btn btn-danger" style={{ width: '100%' }} onClick={() => setEscalateOpen(!escalateOpen)}>
                  <AlertOctagon size={16} /> Escalate Ticket Manually
                </button>
              )}

              {/* Resolve Ticket (For current assignee) */}
              {isAgent && isAssignedToMe && ['open', 'in_progress'].includes(ticket.status) && (
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setResolveOpen(!resolveOpen)}>
                  <FileCheck size={16} /> Resolve Issue (Submit RCA)
                </button>
              )}

              {/* Close Ticket (For raiser or admin) */}
              {(isRaiser || currentUser?.role === 'admin') && ticket.status === 'resolved' && (
                <button className="btn btn-primary" style={{ width: '100%', background: 'linear-gradient(135deg, #06d6a0 0%, #00d2ff 100%)' }} onClick={handleCloseTicket}>
                  <CheckCircle size={16} /> Confirm & Close Ticket
                </button>
              )}

              {/* Status Notice if resolved/closed */}
              {ticket.status === 'closed' && (
                <div style={{
                  padding: '12px', background: 'rgba(6,214,160,0.06)', border: '1px solid rgba(6,214,160,0.2)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--sla-green)', fontSize: '0.85rem', textAlign: 'center', fontWeight: 600
                }}>
                  This ticket is fully closed and resolved.
                </div>
              )}
            </div>
          </div>

          {/* Details Card */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Ticket Info</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Category</div>
                <div style={{ fontWeight: 600 }}>{db.getCategories().find(c => c.id === ticket.category_id)?.name}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Subcategory</div>
                <div style={{ fontWeight: 600 }}>{db.getSubcategories().find(s => s.id === ticket.subcategory_id)?.name}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Location Type</div>
                <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{ticket.location_type}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Specific Location</div>
                <div style={{ fontWeight: 600 }}>{db.getLocations().find(l => l.id === ticket.location_id)?.name}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Intake Source</div>
                <div style={{ fontWeight: 600, textTransform: 'uppercase' }}>{ticket.source}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Raised By</div>
                <div style={{ fontWeight: 600 }}>{db.getUsers().find(u => u.id === ticket.raised_by)?.name}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Shift Context</div>
                <div style={{ fontWeight: 600 }}>{ticket.shift_id ? db.getShifts().find(s => s.id === ticket.shift_id)?.name : 'None'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Created At</div>
                <div style={{ fontWeight: 600 }}>{new Date(ticket.created_at).toLocaleDateString()}</div>
              </div>
            </div>
          </div>

          {/* Roster & Assignment Card */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Assignment & Roster</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Assigned Group</div>
                <div style={{ fontWeight: 600 }}>{db.getGroups().find(g => g.id === ticket.assigned_group)?.name || 'None'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Assigned Support Owner</div>
                <div style={{ fontWeight: 600, color: ticket.assigned_to ? 'var(--text-primary)' : 'var(--sla-red)' }}>
                  {ticket.assigned_to ? db.getUsers().find(u => u.id === ticket.assigned_to)?.name : 'Unassigned (Group Queue)'}
                </div>
              </div>
            </div>
          </div>

          {/* RCA Details Card (Role Filtered display) */}
          {rca && (
            <div className="glass-card" style={{ 
              display: 'flex', flexDirection: 'column', gap: '14px', 
              border: '1px solid rgba(6, 214, 160, 0.25)', background: 'rgba(6, 214, 160, 0.04)' 
            }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid rgba(6,214,160,0.2)', paddingBottom: '10px', color: 'var(--status-resolved)' }}>
                Root Cause Analysis (RCA)
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Customer Summary (Public)</div>
                  <p style={{ marginTop: '4px', lineHeight: '1.4' }}>{rca.customer_summary}</p>
                </div>

                {rca.customer_actions && (
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Transporter Actions</div>
                    <p style={{ marginTop: '4px', lineHeight: '1.4' }}>{rca.customer_actions}</p>
                  </div>
                )}

                {/* Technical RCA Section - Hidden for Transporters! */}
                {!isRaiser ? (
                  <div style={{ 
                    marginTop: '10px', borderTop: '1px dashed var(--border-color)', paddingTop: '10px',
                    display: 'flex', flexDirection: 'column', gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-secondary)', fontWeight: 600 }}>
                      <Shield size={14} /> Technical RCA (Internal Only)
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>Technical Root Cause</div>
                      <p style={{ marginTop: '4px', lineHeight: '1.4', fontStyle: 'italic' }}>{rca.root_cause}</p>
                    </div>
                    {rca.contributing_factors && (
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Contributing Factors</div>
                        <p style={{ marginTop: '4px', lineHeight: '1.4' }}>{rca.contributing_factors}</p>
                      </div>
                    )}
                    {(rca.corrective_actions || rca.preventive_actions) && (
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Corrective & Preventive Action</div>
                        <p style={{ marginTop: '4px', lineHeight: '1.4' }}>
                          {rca.corrective_actions} / {rca.preventive_actions}
                        </p>
                      </div>
                    )}
                    {rca.affected_systems && rca.affected_systems.length > 0 && (
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Affected Systems</div>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                          {rca.affected_systems.map(sys => (
                            <span key={sys} style={{ fontSize: '0.7rem', background: 'rgba(157,78,221,0.15)', color: 'var(--accent-secondary)', padding: '2px 6px', borderRadius: '4px' }}>{sys}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* MODALS INLINE */}

      {/* 1. Reassign Dialog */}
      {reassignOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleReassignSubmit} className="glass-card" style={{ width: '450px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Reassign {ticket.ticket_number}</h3>
            
            <div className="form-group">
              <label className="form-label">Assignment Group</label>
              <select 
                className="form-control" value={reassignGroupId} 
                onChange={e => {
                  setReassignGroupId(e.target.value);
                  setReassignAgentId(''); 
                }} required
              >
                <option value="">Select Group</option>
                {db.getGroups().map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Assign Agent</label>
              <select 
                className="form-control" value={reassignAgentId} 
                onChange={e => setReassignAgentId(e.target.value)}
              >
                <option value="">Group Queue (Assignee = None)</option>
                {db.getUsers()
                  .filter(u => {
                    const isAgentUser = ['l1_agent', 'l2_agent', 'group_lead', 'admin'].includes(u.role);
                    if (reassignGroupId) {
                      return isAgentUser && db.getMembers().some(m => m.group_id === reassignGroupId && m.user_id === u.id);
                    }
                    return isAgentUser;
                  })
                  .map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))
                }
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setReassignOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      )}

      {/* 2. Manual Escalate Dialog */}
      {escalateOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleManualEscalateSubmit} className="glass-card" style={{ width: '450px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Manual Escalation Console</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '-8px' }}>
              Manually transfer the ticket to a specialized or higher tier team.
            </p>

            <div className="form-group">
              <label className="form-label">Escalate to Group</label>
              <select 
                className="form-control" value={escalateGroupId} 
                onChange={e => setEscalateGroupId(e.target.value)} required
              >
                <option value="">Select Target Group</option>
                {db.getGroups()
                  .filter(g => g.id !== ticket.assigned_group) // Don't escalate to same group
                  .map(g => <option key={g.id} value={g.id}>{g.name}</option>)
                }
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Escalation Reason *</label>
              <textarea 
                className="form-control" rows={3} placeholder="Please detail why you are manual escalating (e.g. requires network engineer expertise)..."
                value={escalateReason} onChange={e => setEscalateReason(e.target.value)} required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEscalateOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-danger">Trigger Manual Escalation</button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Resolve & RCA Modal */}
      {resolveOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          overflowY: 'auto'
        }}>
          <form onSubmit={handleResolveSubmit} className="glass-card" style={{ width: '600px', display: 'flex', flexDirection: 'column', gap: '15px', margin: '40px 0' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              Resolve {ticket.ticket_number} - RCA Submission
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              {/* Technical RCA */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent-secondary)' }}>1. Technical RCA (Internal)</h4>
                
                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Root Cause *</label>
                  <textarea 
                    className="form-control" rows={3} placeholder="Technical root cause details..."
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
                          key={sys} onClick={() => {
                            if (rcaSystems.includes(sys)) {
                              setRcaSystems(rcaSystems.filter(s => s !== sys));
                            } else {
                              setRcaSystems([...rcaSystems, sys]);
                            }
                          }}
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
                    className="form-control" rows={4} placeholder="Plain-language explanation shared with the transporter..."
                    value={rcaCustSummary} onChange={e => setRcaCustSummary(e.target.value)} required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Customer Actions / Next Steps</label>
                  <textarea 
                    className="form-control" rows={3} placeholder="Steps customer should perform if any..."
                    value={rcaCustActions} onChange={e => setRcaCustActions(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setResolveOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Resolve & Submit RCA</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
