import React, { useState, useEffect, useRef } from 'react';
import { 
  db, CHATBOT_STATES, handleChatbotInput, routeAndAssignTicket 
} from '../services/db';
import type { 
  Ticket, TicketCategory, TicketSubcategory, Location, ChatMessage 
} from '../services/db';
import { 
  Plus, MessageSquare, List, Send, Paperclip, 
  AlertTriangle, ArrowRight
} from 'lucide-react';

interface TicketsProps {
  currentUserId: string;
  onNavigate: (page: string, ticketId?: string) => void;
  subView?: 'list' | 'new';
}

export const Tickets: React.FC<TicketsProps> = ({ currentUserId, onNavigate, subView = 'list' }) => {
  const [view, setView] = useState<'list' | 'new'>(subView);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [subcategories, setSubcategories] = useState<TicketSubcategory[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Standard Form State
  const [formType, setFormType] = useState<'standard' | 'chatbot'>('standard');
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCat, setFormCat] = useState('');
  const [formSub, setFormSub] = useState('');
  const [formLocType, setFormLocType] = useState<'plant' | 'site' | 'remote'>('plant');
  const [formLocId, setFormLocId] = useState('');
  const [formPriority, setFormPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');
  const [formFile, setFormFile] = useState<File | null>(null);

  // Chatbot State
  const [chatState, setChatState] = useState(CHATBOT_STATES.START);
  const [chatContext, setChatContext] = useState<Record<string, any>>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setView(subView);
  }, [subView]);

  useEffect(() => {
    // Load lists
    setTickets(db.getTickets().filter(t => t.raised_by === currentUserId));
    setCategories(db.getCategories().filter(c => c.is_active));
    setSubcategories(db.getSubcategories().filter(s => s.is_active));
    setLocations(db.getLocations());
  }, [currentUserId, view]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Start Chatbot on Toggle
  useEffect(() => {
    if (formType === 'chatbot' && chatMessages.length === 0) {
      triggerChatbotReset();
    }
  }, [formType]);

  const triggerChatbotReset = () => {
    const { nextState, nextContext, botResponse, botOptions } = handleChatbotInput(
      'session-web',
      CHATBOT_STATES.START,
      {},
      ''
    );
    setChatState(nextState);
    setChatContext(nextContext);
    setChatMessages([
      {
        id: 'msg-init',
        sender: 'bot',
        text: botResponse,
        options: botOptions,
        created_at: new Date().toISOString()
      }
    ]);
  };

  // Standard Form Category change
  const handleCatChange = (catId: string) => {
    setFormCat(catId);
    // Auto-select first subcategory
    const subs = subcategories.filter(s => s.category_id === catId);
    if (subs.length > 0) {
      setFormSub(subs[0].id);
      setFormPriority(subs[0].default_priority);
    } else {
      setFormSub('');
    }
  };

  const handleSubChange = (subId: string) => {
    setFormSub(subId);
    const sub = subcategories.find(s => s.id === subId);
    if (sub) {
      setFormPriority(sub.default_priority);
    }
  };

  const handleStandardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formCat || !formSub || !formLocId) {
      alert('Please fill out all required fields');
      return;
    }

    const sub = subcategories.find(s => s.id === formSub);
    const groupId = sub ? sub.default_group : 'grp-l1';
    
    // Routing & SLA
    const dummyTicket: Partial<Ticket> = {
      org_id: 'org-111',
      priority: formPriority,
      category_id: formCat,
      subcategory_id: formSub
    };
    const { assigneeId, shiftId } = routeAndAssignTicket(dummyTicket as Ticket, groupId);

    const slaHours = sub?.sla_hours || (formPriority === 'critical' ? 2 : formPriority === 'high' ? 4 : formPriority === 'medium' ? 12 : 24);
    const slaDueDate = new Date(Date.now() + slaHours * 3600 * 1000);

    const newTicketId = `tkt-${Date.now()}`;
    const newTicketNum = `TKT-2026-${String(db.getTickets().length + 1).padStart(5, '0')}`;

    const newTicket: Ticket = {
      id: newTicketId,
      ticket_number: newTicketNum,
      org_id: 'org-111',
      title: formTitle,
      description: formDesc,
      status: 'open',
      priority: formPriority,
      category_id: formCat,
      subcategory_id: formSub,
      location_type: formLocType,
      location_id: formLocId,
      source: 'web',
      raised_by: currentUserId,
      assigned_to: assigneeId,
      assigned_group: groupId,
      shift_id: shiftId,
      sla_due_at: slaDueDate.toISOString(),
      sla_breached: false,
      resolved_at: null,
      closed_at: null,
      metadata: formFile ? { file_name: formFile.name } : {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const ticketsList = db.getTickets();
    ticketsList.push(newTicket);
    db.saveTickets(ticketsList);

    // Initial audit log
    const commentsList = db.getComments();
    const groupName = db.getGroups().find(g => g.id === groupId)?.name || 'Support';
    const assigneeName = db.getUsers().find(u => u.id === assigneeId)?.name || 'Group Queue';

    commentsList.push({
      id: `com-init-${Date.now()}`,
      ticket_id: newTicketId,
      author_id: 'usr-7', // system
      comment: `[TICKET INITIALIZED]: Raised via Web Portal Form. Routed to group "${groupName}". Auto-assigned to: ${assigneeName} (Shift: ${shiftId ? db.getShifts().find(s => s.id === shiftId)?.name : 'None'}).`,
      is_internal: true,
      attachments: [],
      created_at: new Date().toISOString()
    });

    if (formFile) {
      commentsList.push({
        id: `com-att-${Date.now()}`,
        ticket_id: newTicketId,
        author_id: currentUserId,
        comment: `Attached file: ${formFile.name}`,
        is_internal: false,
        attachments: [{ name: formFile.name, url: '#', mime_type: formFile.type }],
        created_at: new Date().toISOString()
      });
    }

    db.saveComments(commentsList);

    // Reset Form
    setFormTitle('');
    setFormDesc('');
    setFormCat('');
    setFormSub('');
    setFormFile(null);
    setView('list');
  };

  // Chatbot Send Input
  const handleChatSend = (inputVal: string, optionLabel?: string, mockFile?: { name: string; size: string; type: string }) => {
    const textToSend = optionLabel || inputVal;
    if (!textToSend && !mockFile) return;

    // 1. Add User Message
    const userMsg: ChatMessage = {
      id: `usr-msg-${Date.now()}`,
      sender: 'user',
      text: mockFile ? `Uploaded attachment: ${mockFile.name}` : textToSend,
      created_at: new Date().toISOString()
    };
    
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInput('');

    // 2. Call Chatbot engine
    const { nextState, nextContext, botResponse, botOptions, ticketCreated: _ticketCreated } = handleChatbotInput(
      'session-web',
      chatState,
      chatContext,
      inputVal,
      mockFile
    );

    setChatState(nextState);
    setChatContext(nextContext);

    // 3. Append Bot Message
    setTimeout(() => {
      setChatMessages(prev => [
        ...prev,
        {
          id: `bot-msg-${Date.now()}`,
          sender: 'bot',
          text: botResponse,
          options: botOptions,
          created_at: new Date().toISOString()
        }
      ]);
    }, 400);
  };

  const getPriorityBadgeClass = (priority: string) => {
    return `badge badge-priority-${priority}`;
  };

  const getStatusBadgeClass = (status: string) => {
    return `badge badge-${status.replace('_', '')}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      {/* Header section with toggle tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '6px' }}>My Tickets Portal</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Transporter & Stakeholder self-service issue submission area.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className={`btn ${view === 'list' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setView('list')}
          >
            <List size={16} /> My Tickets
          </button>
          <button 
            className={`btn ${view === 'new' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setView('new');
              // Initialize default values for form
              const cats = db.getCategories().filter(c => c.is_active);
              if (cats.length > 0) {
                setFormCat(cats[0].id);
                const subs = db.getSubcategories().filter(s => s.category_id === cats[0].id);
                if (subs.length > 0) {
                  setFormSub(subs[0].id);
                  setFormPriority(subs[0].default_priority);
                }
              }
              const locs = db.getLocations();
              if (locs.length > 0) {
                setFormLocId(locs[0].id);
              }
            }}
          >
            <Plus size={16} /> Raise Ticket
          </button>
        </div>
      </div>

      {view === 'list' ? (
        /* ================= TICKET LIST VIEW ================= */
        <div className="glass-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px' }}>Your Filed Tickets</h3>
          {tickets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <AlertTriangle size={48} style={{ marginBottom: '12px' }} />
              <p>You haven't raised any tickets yet.</p>
              <button 
                className="btn btn-primary" 
                style={{ marginTop: '16px' }}
                onClick={() => setView('new')}
              >
                Raise your first ticket
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '12px 16px' }}>Ticket No.</th>
                    <th style={{ padding: '12px 16px' }}>Title</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                    <th style={{ padding: '12px 16px' }}>Priority</th>
                    <th style={{ padding: '12px 16px' }}>Created At</th>
                    <th style={{ padding: '12px 16px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(t => (
                    <tr 
                      key={t.id} 
                      className="interactive"
                      style={{ 
                        borderBottom: '1px solid var(--border-color)', 
                        fontSize: '0.9rem',
                        transition: 'background 0.2s',
                        cursor: 'pointer'
                      }}
                      onClick={() => onNavigate('ticket_detail', t.id)}
                    >
                      <td style={{ padding: '16px', fontWeight: 600, color: 'var(--accent-primary)' }}>{t.ticket_number}</td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontWeight: 500 }}>{t.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Category: {categories.find(c => c.id === t.category_id)?.name} &gt; {subcategories.find(s => s.id === t.subcategory_id)?.name}
                        </div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span className={getStatusBadgeClass(t.status)}>{t.status.replace('_', ' ')}</span>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span className={getPriorityBadgeClass(t.priority)}>{t.priority}</span>
                      </td>
                      <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                        {new Date(t.created_at).toLocaleDateString()} {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 600 }}>
                          View Details <ArrowRight size={14} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ================= RAISE A TICKET VIEW ================= */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '30px',
          alignItems: 'start'
        }}>
          {/* Intake Selection Banner */}
          <div className="glass-card" style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 25px', flexWrap: 'wrap', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MessageSquare size={20} className="text-cyan-400" />
              <span style={{ fontWeight: 600 }}>Choose Intake Mode:</span>
            </div>
            <div style={{ display: 'flex', gap: '10px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
              <button 
                className={`btn ${formType === 'standard' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                onClick={() => setFormType('standard')}
              >
                Standard Form
              </button>
              <button 
                className={`btn ${formType === 'chatbot' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                onClick={() => setFormType('chatbot')}
              >
                Conversational Chatbot
              </button>
            </div>
          </div>

          {formType === 'standard' ? (
            /* Standard Form */
            <form onSubmit={handleStandardSubmit} className="glass-card" style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>Raise New Ticket (Structured Form)</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Issue Title *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Short summary of the issue (e.g. RFID scanner error Gate 1)" 
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select 
                    className="form-control" 
                    value={formCat} 
                    onChange={e => handleCatChange(e.target.value)}
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Subcategory *</label>
                  <select 
                    className="form-control" 
                    value={formSub} 
                    onChange={e => handleSubChange(e.target.value)}
                    required
                    disabled={!formCat}
                  >
                    <option value="">Select Subcategory</option>
                    {subcategories.filter(s => s.category_id === formCat).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Severity / Priority (Suggested)</label>
                  <select 
                    className="form-control"
                    value={formPriority}
                    onChange={e => setFormPriority(e.target.value as any)}
                  >
                    <option value="critical">CRITICAL (Operations Stopped)</option>
                    <option value="high">HIGH (Major Disturbance)</option>
                    <option value="medium">MEDIUM (Normal Operational issue)</option>
                    <option value="low">LOW (Minor/Cosmetic Inquiry)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Location Type *</label>
                  <select 
                    className="form-control"
                    value={formLocType}
                    onChange={e => {
                      const val = e.target.value as any;
                      setFormLocType(val);
                      // Auto-select first location of that type
                      const filtered = locations.filter(l => l.type === val);
                      if (filtered.length > 0) setFormLocId(filtered[0].id);
                    }}
                  >
                    <option value="plant">Plant (Warehouse / Hub)</option>
                    <option value="site">Site (Gate / Dock)</option>
                    <option value="remote">Remote Logistics Office</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Specific Location *</label>
                  <select 
                    className="form-control"
                    value={formLocId}
                    onChange={e => setFormLocId(e.target.value)}
                    required
                  >
                    <option value="">Select Location</option>
                    {locations.filter(l => l.type === formLocType).map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Detailed Description</label>
                <textarea 
                  className="form-control" 
                  rows={4} 
                  placeholder="Provide a detailed description of the error, logs, vehicle license number, or driver info affected..."
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Attachment (Photos / Documents)</label>
                <div style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  position: 'relative'
                }}>
                  <input 
                    type="file" 
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                    onChange={e => e.target.files && setFormFile(e.target.files[0])}
                  />
                  <Paperclip size={24} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {formFile ? `Selected file: ${formFile.name}` : 'Drag & drop screenshots or click here to upload'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setView('list')}>Cancel</button>
                <button type="submit" className="btn btn-primary">Raise Ticket</button>
              </div>
            </form>
          ) : (
            /* Conversational Chatbot Widget */
            <div className="glass-card" style={{ gridColumn: '1 / -1', height: '560px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
              {/* Chatbot Header */}
              <div style={{
                background: 'rgba(0,0,0,0.2)',
                borderBottom: '1px solid var(--border-color)',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="sla-dot green animate-pulse"></div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>ITMS Support Assistant</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Interactive Ticket Assistant (Deterministic Rules)</div>
                  </div>
                </div>
                <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={triggerChatbotReset}>
                  Restart Chat
                </button>
              </div>

              {/* Chat Messages Log */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '15px'
              }}>
                {chatMessages.map(msg => (
                  <div 
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <div style={{
                      background: msg.sender === 'user' 
                        ? 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)' 
                        : 'var(--bg-surface-hover)',
                      color: msg.sender === 'user' ? '#fff' : 'var(--text-primary)',
                      padding: '12px 16px',
                      borderRadius: msg.sender === 'user' ? '18px 18px 0px 18px' : '18px 18px 18px 0px',
                      border: msg.sender === 'bot' ? '1px solid var(--border-color)' : 'none',
                      fontSize: '0.9rem',
                      lineHeight: '1.4',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
                    }}>
                      {/* Render simple markdown lists or headings */}
                      {msg.text.split('\n').map((line, idx) => {
                        if (line.startsWith('* **')) {
                          return <div key={idx} style={{ marginLeft: '12px', margin: '4px 0' }}>• {line.replace(/^\*\s*/, '')}</div>;
                        }
                        if (line.startsWith('###')) {
                          return <h4 key={idx} style={{ fontSize: '0.95rem', fontWeight: 700, margin: '8px 0 4px 0' }}>{line.replace(/^###\s*/, '')}</h4>;
                        }
                        return <p key={idx}>{line}</p>;
                      })}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {/* Bot Option Chips */}
                    {msg.sender === 'bot' && msg.options && msg.options.length > 0 && chatState !== CHATBOT_STATES.COMPLETED && (
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        marginTop: '10px',
                        justifyContent: 'flex-start'
                      }}>
                        {msg.options.map((opt, idx) => (
                          <button
                            key={opt.value + '-' + idx}
                            className="btn btn-secondary"
                            style={{ 
                              padding: '6px 12px', 
                              borderRadius: '50px', 
                              fontSize: '0.8rem',
                              borderColor: 'var(--accent-primary-glow)',
                              color: 'var(--accent-primary)'
                            }}
                            onClick={() => handleChatSend(opt.value, opt.label)}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div style={{
                padding: '16px 20px',
                background: 'rgba(0,0,0,0.1)',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                gap: '12px',
                alignItems: 'center'
              }}>
                <input 
                  type="text"
                  className="form-control"
                  placeholder={
                    chatState === CHATBOT_STATES.ATTACHMENT_DONE 
                      ? "Type 'skip' or upload a file below..." 
                      : "Type your message or click options above..."
                  }
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleChatSend(chatInput);
                    }
                  }}
                  disabled={chatState === CHATBOT_STATES.COMPLETED}
                />
                
                {/* Mock Attachment button inside Chatbot */}
                {chatState === CHATBOT_STATES.ATTACHMENT_DONE && (
                  <button 
                    className="btn btn-secondary"
                    style={{ position: 'relative', padding: '10px' }}
                  >
                    <input 
                      type="file" 
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                      onChange={e => {
                        if (e.target.files && e.target.files[0]) {
                          const fileObj = e.target.files[0];
                          handleChatSend('', '', {
                            name: fileObj.name,
                            size: `${Math.round(fileObj.size / 1024)} KB`,
                            type: fileObj.type
                          });
                        }
                      }}
                    />
                    <Paperclip size={18} />
                  </button>
                )}

                <button 
                  className="btn btn-primary"
                  style={{ padding: '10px 14px' }}
                  onClick={() => handleChatSend(chatInput)}
                  disabled={!chatInput.trim() || chatState === CHATBOT_STATES.COMPLETED}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
