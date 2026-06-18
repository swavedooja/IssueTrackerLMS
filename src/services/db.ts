// ITMS Ticketing System Local Storage Database Service
// This service simulates the Supabase + PostgreSQL backend.

export interface Org {
  id: string;
  name: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ticket_raiser' | 'l1_agent' | 'l2_agent' | 'l3_senior' | 'group_lead' | 'admin' | 'report_viewer';
  phone?: string;
}

export interface Location {
  id: string;
  name: string;
  type: 'plant' | 'site' | 'remote';
}

export interface TicketCategory {
  id: string;
  org_id: string;
  name: string;
  code: string;
  icon: string;
  is_active: boolean;
  sort_order: number;
}

export interface TicketSubcategory {
  id: string;
  category_id: string;
  org_id: string;
  name: string;
  code: string;
  default_priority: 'critical' | 'high' | 'medium' | 'low';
  default_group: string; // group_id
  sla_hours?: number;
  rca_required: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface AssignmentGroup {
  id: string;
  org_id: string;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'member' | 'lead';
  is_active: boolean;
}

export interface EscalationRule {
  id: string;
  org_id: string;
  name: string;
  category_id: string | null;
  subcategory_id: string | null;
  priority: 'critical' | 'high' | 'medium' | 'low' | null;
  level: number; // 1, 2, 3
  trigger_after_min: number;
  escalate_to_group: string; // group_id
  notify_emails: string[];
  is_active: boolean;
}

export interface ShiftDefinition {
  id: string;
  org_id: string;
  name: string;
  code: string;
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  crosses_midnight: boolean;
  is_active: boolean;
}

export interface ShiftRoster {
  id: string;
  org_id: string;
  user_id: string;
  group_id: string;
  shift_id: string;
  roster_date: string; // YYYY-MM-DD
  level: 'agent' | 'lead' | 'supervisor';
  is_active: boolean;
}

export interface Ticket {
  id: string;
  ticket_number: string;
  org_id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';
  priority: 'critical' | 'high' | 'medium' | 'low';
  category_id: string;
  subcategory_id: string;
  location_type: 'plant' | 'site' | 'remote';
  location_id: string;
  source: 'web' | 'mobile' | 'email' | 'whatsapp' | 'telegram' | 'chatbot';
  raised_by: string; // user_id
  assigned_to: string | null; // user_id
  assigned_group: string | null; // group_id
  shift_id: string | null;
  sla_due_at: string; // ISO String
  sla_breached: boolean;
  resolved_at: string | null;
  closed_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  author_id: string;
  comment: string;
  is_internal: boolean;
  attachments: { name: string; url: string; mime_type: string }[];
  created_at: string;
}

export interface TicketEscalation {
  id: string;
  ticket_id: string;
  escalated_from: string | null; // user_id
  escalated_to: string | null; // user_id
  from_group: string | null; // group_id
  to_group: string | null; // group_id
  level: number;
  reason: string;
  auto_triggered: boolean;
  created_at: string;
}

export interface TicketRCA {
  id: string;
  ticket_id: string;
  root_cause: string;
  contributing_factors: string;
  corrective_actions: string;
  preventive_actions: string;
  affected_systems: string[];
  customer_summary: string;
  customer_actions: string;
  internal_doc_url?: string;
  customer_doc_url?: string;
  prepared_by: string;
  reviewed_by?: string;
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

export interface SLAPolicy {
  id: string;
  org_id: string;
  name: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category_id: string | null;
  response_min: number;
  resolution_hrs: number;
  is_active: boolean;
}

export interface ChatSession {
  id: string;
  channel: 'whatsapp' | 'telegram' | 'web_chatbot';
  channel_id: string;
  user_id: string | null;
  state: string;
  context: Record<string, any>;
  last_active: string;
  created_at: string;
}

// ---------------------------------------------------------------------
// IN-MEMORY & LOCAL STORAGE MANAGEMENT
// ---------------------------------------------------------------------

const STORAGE_KEYS = {
  ORGS: 'itms_orgs',
  USERS: 'itms_users',
  LOCATIONS: 'itms_locations',
  CATEGORIES: 'itms_categories',
  SUBCATEGORIES: 'itms_subcategories',
  GROUPS: 'itms_groups',
  MEMBERS: 'itms_members',
  ESCALATIONS: 'itms_escalations',
  SHIFTS: 'itms_shifts',
  ROSTERS: 'itms_rosters',
  TICKETS: 'itms_tickets',
  COMMENTS: 'itms_comments',
  TICKET_ESCALATIONS: 'itms_ticket_escalations',
  RCA: 'itms_rcas',
  SLA_POLICIES: 'itms_sla_policies',
  CHAT_SESSIONS: 'itms_chat_sessions'
};

// Seed Helper Data
const SEED_ORG_ID = 'org-111';

const DEFAULT_ORGS: Org[] = [{ id: SEED_ORG_ID, name: 'ITMS Global Logistics' }];

const DEFAULT_USERS: User[] = [
  { id: 'usr-1', name: 'John Doe (L1 Support)', email: 'john@company.com', role: 'l1_agent' },
  { id: 'usr-2', name: 'Jane Smith (L1 Lead)', email: 'jane@company.com', role: 'group_lead' },
  { id: 'usr-3', name: 'Ravi Kumar (Network Spec)', email: 'ravi@company.com', role: 'l2_agent' },
  { id: 'usr-4', name: 'Sarah Connor (Java Expert)', email: 'sarah@company.com', role: 'l2_agent' },
  { id: 'usr-5', name: 'Alex Mercer (L3 Senior)', email: 'alex@company.com', role: 'l3_senior' },
  { id: 'usr-6', name: 'Bob Transporter', email: 'bob@transporter.com', role: 'ticket_raiser', phone: '+919876543210' },
  { id: 'usr-7', name: 'Alice Supervisor', email: 'alice@company.com', role: 'admin' },
  { id: 'usr-8', name: 'Tom Logistics', email: 'tom@company.com', role: 'report_viewer' }
];

const DEFAULT_LOCATIONS: Location[] = [
  { id: 'loc-1', name: 'Plant - Pune Hub 01', type: 'plant' },
  { id: 'loc-2', name: 'Plant - Mumbai Gateway', type: 'plant' },
  { id: 'loc-3', name: 'Site - Chennai Port', type: 'site' },
  { id: 'loc-4', name: 'Remote Logistics Office', type: 'remote' }
];

const DEFAULT_CATEGORIES: TicketCategory[] = [
  { id: 'cat-hw', org_id: SEED_ORG_ID, name: 'Hardware', code: 'HW', icon: 'HardDrive', is_active: true, sort_order: 1 },
  { id: 'cat-sw', org_id: SEED_ORG_ID, name: 'Software', code: 'SW', icon: 'Cpu', is_active: true, sort_order: 2 },
  { id: 'cat-nw', org_id: SEED_ORG_ID, name: 'Network', code: 'NW', icon: 'Wifi', is_active: true, sort_order: 3 },
  { id: 'cat-op', org_id: SEED_ORG_ID, name: 'Operational', code: 'OP', icon: 'Settings', is_active: true, sort_order: 4 }
];

// Group IDs
const G_L1 = 'grp-l1';
const G_NET = 'grp-net';
const G_BACK = 'grp-back';
const G_DATA = 'grp-data';
const G_L3 = 'grp-l3';

const DEFAULT_GROUPS: AssignmentGroup[] = [
  { id: G_L1, org_id: SEED_ORG_ID, name: 'L1 Support Team', code: 'L1', description: 'Primary triaging and common hardware/software issue resolution', is_active: true },
  { id: G_NET, org_id: SEED_ORG_ID, name: 'Network Operations Team', code: 'NETWORK', description: 'Network switch, routing, and connectivity specialist team', is_active: true },
  { id: G_BACK, org_id: SEED_ORG_ID, name: 'Java Backend Team', code: 'BACKEND', description: 'Core API, SAP Integration, database operations support', is_active: true },
  { id: G_DATA, org_id: SEED_ORG_ID, name: 'Data & Sync Team', code: 'DATA', description: 'Data reconciliation, reporting pipelines, and DB syncing', is_active: true },
  { id: G_L3, org_id: SEED_ORG_ID, name: 'L3 Senior Experts', code: 'L3_SENIOR', description: 'Highest resolution escalations and architectural bugs', is_active: true }
];

const DEFAULT_MEMBERS: GroupMember[] = [
  { id: 'mem-1', group_id: G_L1, user_id: 'usr-1', role: 'member', is_active: true },
  { id: 'mem-2', group_id: G_L1, user_id: 'usr-2', role: 'lead', is_active: true },
  { id: 'mem-3', group_id: G_NET, user_id: 'usr-3', role: 'member', is_active: true },
  { id: 'mem-4', group_id: G_BACK, user_id: 'usr-4', role: 'member', is_active: true },
  { id: 'mem-5', group_id: G_L3, user_id: 'usr-5', role: 'member', is_active: true }
];

const DEFAULT_SUBCATEGORIES: TicketSubcategory[] = [
  // HW
  { id: 'sub-hw-rfid', category_id: 'cat-hw', org_id: SEED_ORG_ID, name: 'RFID Reader', code: 'HW_RFID', default_priority: 'high', default_group: G_L1, sla_hours: 4, rca_required: true, is_active: true, sort_order: 1 },
  { id: 'sub-hw-boom', category_id: 'cat-hw', org_id: SEED_ORG_ID, name: 'Boom Barrier', code: 'HW_BOOM', default_priority: 'critical', default_group: G_L1, sla_hours: 2, rca_required: true, is_active: true, sort_order: 2 },
  { id: 'sub-hw-weigh', category_id: 'cat-hw', org_id: SEED_ORG_ID, name: 'Weighbridge', code: 'HW_WEIGH', default_priority: 'high', default_group: G_L1, sla_hours: 4, rca_required: true, is_active: true, sort_order: 3 },
  // SW
  { id: 'sub-sw-reg', category_id: 'cat-sw', org_id: SEED_ORG_ID, name: 'Vehicle Registration', code: 'SW_REG', default_priority: 'medium', default_group: G_L1, sla_hours: 8, rca_required: false, is_active: true, sort_order: 1 },
  { id: 'sub-sw-sap', category_id: 'cat-sw', org_id: SEED_ORG_ID, name: 'SAP Integration / EGP', code: 'SW_SAP', default_priority: 'high', default_group: G_BACK, sla_hours: 6, rca_required: true, is_active: true, sort_order: 2 },
  { id: 'sub-sw-trip', category_id: 'cat-sw', org_id: SEED_ORG_ID, name: 'Trip Creation', code: 'SW_TRIP', default_priority: 'medium', default_group: G_L1, sla_hours: 12, rca_required: false, is_active: true, sort_order: 3 },
  // NW
  { id: 'sub-nw-internet', category_id: 'cat-nw', org_id: SEED_ORG_ID, name: 'Internet Connectivity', code: 'NW_INT', default_priority: 'high', default_group: G_NET, sla_hours: 4, rca_required: true, is_active: true, sort_order: 1 },
  { id: 'sub-nw-rfidnet', category_id: 'cat-nw', org_id: SEED_ORG_ID, name: 'RFID Network Outage', code: 'NW_RFID', default_priority: 'critical', default_group: G_NET, sla_hours: 2, rca_required: true, is_active: true, sort_order: 2 },
  // OP
  { id: 'sub-op-gate', category_id: 'cat-op', org_id: SEED_ORG_ID, name: 'Gate Entry Rejected', code: 'OP_GATE', default_priority: 'high', default_group: G_L1, sla_hours: 4, rca_required: false, is_active: true, sort_order: 1 },
  { id: 'sub-op-sync', category_id: 'cat-op', org_id: SEED_ORG_ID, name: 'Data Sync Issue', code: 'OP_SYNC', default_priority: 'high', default_group: G_DATA, sla_hours: 6, rca_required: true, is_active: true, sort_order: 2 }
];

const DEFAULT_SLA_POLICIES: SLAPolicy[] = [
  { id: 'sla-crit', org_id: SEED_ORG_ID, name: 'Critical SLA', priority: 'critical', category_id: null, response_min: 15, resolution_hrs: 2, is_active: true },
  { id: 'sla-high', org_id: SEED_ORG_ID, name: 'High SLA', priority: 'high', category_id: null, response_min: 30, resolution_hrs: 4, is_active: true },
  { id: 'sla-med', org_id: SEED_ORG_ID, name: 'Medium SLA', priority: 'medium', category_id: null, response_min: 60, resolution_hrs: 12, is_active: true },
  { id: 'sla-low', org_id: SEED_ORG_ID, name: 'Low SLA', priority: 'low', category_id: null, response_min: 120, resolution_hrs: 24, is_active: true }
];

// Shifts definitions
const DEFAULT_SHIFTS: ShiftDefinition[] = [
  { id: 'sh-a', org_id: SEED_ORG_ID, name: 'Morning Shift (A)', code: 'A', start_time: '06:00', end_time: '14:00', crosses_midnight: false, is_active: true },
  { id: 'sh-b', org_id: SEED_ORG_ID, name: 'Afternoon Shift (B)', code: 'B', start_time: '14:00', end_time: '22:00', crosses_midnight: false, is_active: true },
  { id: 'sh-c', org_id: SEED_ORG_ID, name: 'Night Shift (C)', code: 'C', start_time: '22:00', end_time: '06:00', crosses_midnight: true, is_active: true }
];

// Roster: Assign John to A, Jane to B, Ravi to A, Sarah to B.
const getDynamicRoster = (): ShiftRoster[] => {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const rosterDays = [yesterday, today, tomorrow];
  const rosters: ShiftRoster[] = [];

  rosterDays.forEach((date, index) => {
    // L1 Support
    rosters.push({ id: `ros-l1-a-${index}`, org_id: SEED_ORG_ID, user_id: 'usr-1', group_id: G_L1, shift_id: 'sh-a', roster_date: date, level: 'agent', is_active: true });
    rosters.push({ id: `ros-l1-b-${index}`, org_id: SEED_ORG_ID, user_id: 'usr-2', group_id: G_L1, shift_id: 'sh-b', roster_date: date, level: 'lead', is_active: true });
    // Network Team
    rosters.push({ id: `ros-net-a-${index}`, org_id: SEED_ORG_ID, user_id: 'usr-3', group_id: G_NET, shift_id: 'sh-a', roster_date: date, level: 'agent', is_active: true });
    rosters.push({ id: `ros-net-b-${index}`, org_id: SEED_ORG_ID, user_id: 'usr-3', group_id: G_NET, shift_id: 'sh-b', roster_date: date, level: 'agent', is_active: true });
    // Java Backend Team
    rosters.push({ id: `ros-back-b-${index}`, org_id: SEED_ORG_ID, user_id: 'usr-4', group_id: G_BACK, shift_id: 'sh-b', roster_date: date, level: 'agent', is_active: true });
  });

  return rosters;
};

const DEFAULT_ESCALATION_RULES: EscalationRule[] = [
  { id: 'er-1', org_id: SEED_ORG_ID, name: 'L1 to L2 Escalation (RFID Outage)', category_id: 'cat-nw', subcategory_id: 'sub-nw-rfidnet', priority: 'critical', level: 1, trigger_after_min: 2, escalate_to_group: G_NET, notify_emails: ['network-head@company.com'], is_active: true },
  { id: 'er-2', org_id: SEED_ORG_ID, name: 'L1 to L2 Escalation (SAP Errors)', category_id: 'cat-sw', subcategory_id: 'sub-sw-sap', priority: 'high', level: 1, trigger_after_min: 3, escalate_to_group: G_BACK, notify_emails: ['dev-leads@company.com'], is_active: true },
  { id: 'er-3', org_id: SEED_ORG_ID, name: 'L2 to L3 Escalation (Critical)', category_id: null, subcategory_id: null, priority: 'critical', level: 2, trigger_after_min: 4, escalate_to_group: G_L3, notify_emails: ['ops-director@company.com'], is_active: true }
];

// Preseeded tickets
const getDynamicTickets = (): Ticket[] => {
  const now = new Date();
  const t1 = new Date(now.getTime() - 10 * 60 * 1000); // 10 mins ago
  const t2 = new Date(now.getTime() - 40 * 60 * 1000); // 40 mins ago
  const t3 = new Date(now.getTime() - 5 * 3600 * 1000); // 5 hours ago (breached SLA)
  const t4 = new Date(now.getTime() - 2 * 24 * 3600 * 1000); // 2 days ago

  return [
    {
      id: 'tkt-001',
      ticket_number: 'TKT-2026-00001',
      org_id: SEED_ORG_ID,
      title: 'Boom barrier not opening at Pune Gate 2',
      description: 'The boom barrier at Pune Hub Gate 2 is not responding to RFID tag scans. Vehicles are getting rejected and blocked at the entry point.',
      status: 'open',
      priority: 'critical',
      category_id: 'cat-hw',
      subcategory_id: 'sub-hw-boom',
      location_type: 'plant',
      location_id: 'loc-1',
      source: 'web',
      raised_by: 'usr-6', // Bob Transporter
      assigned_to: null,
      assigned_group: G_L1,
      shift_id: 'sh-a',
      sla_due_at: new Date(t1.getTime() + 2 * 3600 * 1000).toISOString(), // 2 hours SLA
      sla_breached: false,
      resolved_at: null,
      closed_at: null,
      metadata: { vehicle_no: 'MH-12-PQ-9876' },
      created_at: t1.toISOString(),
      updated_at: t1.toISOString()
    },
    {
      id: 'tkt-002',
      ticket_number: 'TKT-2026-00002',
      org_id: SEED_ORG_ID,
      title: 'SAP integration sync timeout error',
      description: 'SAP payload transmission failed with status 504. EGP generation is blocked for critical plant dispatches.',
      status: 'in_progress',
      priority: 'high',
      category_id: 'cat-sw',
      subcategory_id: 'sub-sw-sap',
      location_type: 'remote',
      location_id: 'loc-4',
      source: 'email',
      raised_by: 'usr-7', // Alice Admin
      assigned_to: 'usr-4', // Sarah Backend Agent
      assigned_group: G_BACK,
      shift_id: 'sh-b',
      sla_due_at: new Date(t2.getTime() + 6 * 3600 * 1000).toISOString(),
      sla_breached: false,
      resolved_at: null,
      closed_at: null,
      metadata: { sap_payload_id: 'PAYLOAD-55291-A' },
      created_at: t2.toISOString(),
      updated_at: t2.toISOString()
    },
    {
      id: 'tkt-003',
      ticket_number: 'TKT-2026-00003',
      org_id: SEED_ORG_ID,
      title: 'RFID reader failure at weighing bridge',
      description: 'RFID reader at weighbridge #3 is completely dead. Network connectivity looks fine, but reader is not booting up.',
      status: 'open',
      priority: 'high',
      category_id: 'cat-hw',
      subcategory_id: 'sub-hw-rfid',
      location_type: 'plant',
      location_id: 'loc-2',
      source: 'chatbot',
      raised_by: 'usr-6',
      assigned_to: null,
      assigned_group: G_L1,
      shift_id: null,
      // Seeding as breached
      sla_due_at: new Date(t3.getTime() + 4 * 3600 * 1000).toISOString(),
      sla_breached: true,
      resolved_at: null,
      closed_at: null,
      metadata: { reader_id: 'READER-PUNE-3' },
      created_at: t3.toISOString(),
      updated_at: t3.toISOString()
    },
    {
      id: 'tkt-004',
      ticket_number: 'TKT-2026-00004',
      org_id: SEED_ORG_ID,
      title: 'Vehicle registration error for driver rejection',
      description: 'System rejects registration for driver Sanjay Dutt claiming license expired. Checked database, license valid till 2029.',
      status: 'closed',
      priority: 'medium',
      category_id: 'cat-sw',
      subcategory_id: 'sub-sw-reg',
      location_type: 'plant',
      location_id: 'loc-1',
      source: 'whatsapp',
      raised_by: 'usr-6',
      assigned_to: 'usr-1', // John Agent
      assigned_group: G_L1,
      shift_id: 'sh-a',
      sla_due_at: new Date(t4.getTime() + 8 * 3600 * 1000).toISOString(),
      sla_breached: false,
      resolved_at: new Date(t4.getTime() + 1.5 * 3600 * 1000).toISOString(),
      closed_at: new Date(t4.getTime() + 2 * 3600 * 1000).toISOString(),
      metadata: { driver_license: 'DL-142019829' },
      created_at: t4.toISOString(),
      updated_at: t4.toISOString()
    }
  ];
};

const DEFAULT_COMMENTS = (_tickets: Ticket[]): TicketComment[] => {
  return [
    {
      id: 'com-1',
      ticket_id: 'tkt-002',
      author_id: 'usr-4', // Sarah
      comment: 'Analyzing SAP integration log. It seems the API endpoint for billing was throwing 500 error before timing out. Looking into the Spring container logs.',
      is_internal: true,
      attachments: [],
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString()
    },
    {
      id: 'com-2',
      ticket_id: 'tkt-002',
      author_id: 'usr-7', // Alice
      comment: 'Thanks Sarah. Please prioritize, this is delaying 5 trucks loaded with copper sheets.',
      is_internal: false,
      attachments: [],
      created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString()
    },
    {
      id: 'com-3',
      ticket_id: 'tkt-004',
      author_id: 'usr-1', // John L1
      comment: 'Verified license document. The driver had entered an incorrect License Number format. Corrected in Driver Master table and approved registration.',
      is_internal: false,
      attachments: [],
      created_at: new Date(Date.now() - 47 * 3600 * 1000).toISOString()
    }
  ];
};

const DEFAULT_RCAS: TicketRCA[] = [
  {
    id: 'rca-1',
    ticket_id: 'tkt-004',
    root_cause: 'Driver entered a double space in the license number text field in transporter portal. RegEx validator failed silently but database schema threw a uniqueness format validation warning in L1 sync.',
    contributing_factors: 'Lack of input trim sanitation on registration form fields.',
    corrective_actions: 'Manually updated the cell in driver profiles table. Trimmed leading/trailing and double whitespaces.',
    preventive_actions: 'Update registration form frontend input component to automatically trim whitespaces on submit. Modify database regex trigger to raise client-friendly exception.',
    affected_systems: ['Driver Registration Module', 'Database Sync Scheduler'],
    customer_summary: 'Typographical error in the license number caused a format validation failure. The licensing details have been verified and corrected.',
    customer_actions: 'No further action required. The driver registration is now fully active.',
    prepared_by: 'usr-1',
    reviewed_by: 'usr-2',
    submitted_at: new Date(Date.now() - 47 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 47 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 47 * 3600 * 1000).toISOString()
  }
];

const setItem = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

const getItem = <T>(key: string, fallback: T): T => {
  const data = localStorage.getItem(key);
  if (!data) return fallback;
  try {
    return JSON.parse(data) as T;
  } catch {
    return fallback;
  }
};

export function initializeDB(forceReset = false) {
  if (forceReset || !localStorage.getItem(STORAGE_KEYS.USERS)) {
    setItem(STORAGE_KEYS.ORGS, DEFAULT_ORGS);
    setItem(STORAGE_KEYS.USERS, DEFAULT_USERS);
    setItem(STORAGE_KEYS.LOCATIONS, DEFAULT_LOCATIONS);
    setItem(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
    setItem(STORAGE_KEYS.SUBCATEGORIES, DEFAULT_SUBCATEGORIES);
    setItem(STORAGE_KEYS.GROUPS, DEFAULT_GROUPS);
    setItem(STORAGE_KEYS.MEMBERS, DEFAULT_MEMBERS);
    setItem(STORAGE_KEYS.ESCALATIONS, DEFAULT_ESCALATION_RULES);
    setItem(STORAGE_KEYS.SHIFTS, DEFAULT_SHIFTS);
    setItem(STORAGE_KEYS.ROSTERS, getDynamicRoster());
    
    const tickets = getDynamicTickets();
    setItem(STORAGE_KEYS.TICKETS, tickets);
    setItem(STORAGE_KEYS.COMMENTS, DEFAULT_COMMENTS(tickets));
    setItem(STORAGE_KEYS.RCA, DEFAULT_RCAS);
    setItem(STORAGE_KEYS.SLA_POLICIES, DEFAULT_SLA_POLICIES);
    setItem(STORAGE_KEYS.TICKET_ESCALATIONS, []);
    setItem(STORAGE_KEYS.CHAT_SESSIONS, []);
  }
}

export const db = {
  getOrgs: (): Org[] => getItem(STORAGE_KEYS.ORGS, []),
  getUsers: (): User[] => getItem(STORAGE_KEYS.USERS, []),
  getLocations: (): Location[] => getItem(STORAGE_KEYS.LOCATIONS, []),
  getCategories: (): TicketCategory[] => getItem(STORAGE_KEYS.CATEGORIES, []),
  getSubcategories: (): TicketSubcategory[] => getItem(STORAGE_KEYS.SUBCATEGORIES, []),
  getGroups: (): AssignmentGroup[] => getItem(STORAGE_KEYS.GROUPS, []),
  getMembers: (): GroupMember[] => getItem(STORAGE_KEYS.MEMBERS, []),
  getEscalationRules: (): EscalationRule[] => getItem(STORAGE_KEYS.ESCALATIONS, []),
  getShifts: (): ShiftDefinition[] => getItem(STORAGE_KEYS.SHIFTS, []),
  getRosters: (): ShiftRoster[] => getItem(STORAGE_KEYS.ROSTERS, []),
  getTickets: (): Ticket[] => getItem(STORAGE_KEYS.TICKETS, []),
  getComments: (ticketId?: string): TicketComment[] => {
    const comments = getItem<TicketComment[]>(STORAGE_KEYS.COMMENTS, []);
    if (ticketId) return comments.filter(c => c.ticket_id === ticketId);
    return comments;
  },
  getTicketEscalations: (ticketId?: string): TicketEscalation[] => {
    const esc = getItem<TicketEscalation[]>(STORAGE_KEYS.TICKET_ESCALATIONS, []);
    if (ticketId) return esc.filter(e => e.ticket_id === ticketId);
    return esc;
  },
  getRCAs: (): TicketRCA[] => getItem(STORAGE_KEYS.RCA, []),
  getSLAPolicies: (): SLAPolicy[] => getItem(STORAGE_KEYS.SLA_POLICIES, []),
  getChatSessions: (): ChatSession[] => getItem(STORAGE_KEYS.CHAT_SESSIONS, []),

  saveTickets: (tickets: Ticket[]) => setItem(STORAGE_KEYS.TICKETS, tickets),
  saveComments: (comments: TicketComment[]) => setItem(STORAGE_KEYS.COMMENTS, comments),
  saveTicketEscalations: (esc: TicketEscalation[]) => setItem(STORAGE_KEYS.TICKET_ESCALATIONS, esc),
  saveRCAs: (rcas: TicketRCA[]) => setItem(STORAGE_KEYS.RCA, rcas),
  saveRosters: (rosters: ShiftRoster[]) => setItem(STORAGE_KEYS.ROSTERS, rosters),
  saveCategories: (cats: TicketCategory[]) => setItem(STORAGE_KEYS.CATEGORIES, cats),
  saveSubcategories: (subs: TicketSubcategory[]) => setItem(STORAGE_KEYS.SUBCATEGORIES, subs),
  saveGroups: (grps: AssignmentGroup[]) => setItem(STORAGE_KEYS.GROUPS, grps),
  saveEscalationRules: (rules: EscalationRule[]) => setItem(STORAGE_KEYS.ESCALATIONS, rules),
  saveSLAPolicies: (pols: SLAPolicy[]) => setItem(STORAGE_KEYS.SLA_POLICIES, pols),
  saveShifts: (shifts: ShiftDefinition[]) => setItem(STORAGE_KEYS.SHIFTS, shifts),

  reset: () => initializeDB(true)
};

export function getOnDutyAgents(groupId: string, orgId: string = SEED_ORG_ID): User[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const dateVal = String(now.getDate()).padStart(2, '0');
  const todayDate = `${year}-${month}-${dateVal}`;

  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${currentHours}:${currentMinutes}`;

  const shifts = db.getShifts().filter(s => s.org_id === orgId && s.is_active);

  const activeShifts = shifts.filter(shift => {
    if (!shift.crosses_midnight) {
      return currentTime >= shift.start_time && currentTime < shift.end_time;
    } else {
      return currentTime >= shift.start_time || currentTime < shift.end_time;
    }
  });

  if (activeShifts.length === 0) return [];

  const shiftIds = activeShifts.map(s => s.id);
  const rosters = db.getRosters().filter(
    r => r.group_id === groupId &&
         r.org_id === orgId &&
         r.roster_date === todayDate &&
         shiftIds.includes(r.shift_id) &&
         r.is_active
  );

  const rosteredUserIds = rosters.map(r => r.user_id);
  return db.getUsers().filter(u => rosteredUserIds.includes(u.id));
}

export function routeAndAssignTicket(ticket: Ticket, groupId: string): { assigneeId: string | null; shiftId: string | null } {
  const onDuty = getOnDutyAgents(groupId, ticket.org_id);
  
  const now = new Date();
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${currentHours}:${currentMinutes}`;
  const activeShift = db.getShifts().find(s => {
    if (!s.crosses_midnight) {
      return currentTime >= s.start_time && currentTime < s.end_time;
    } else {
      return currentTime >= s.start_time || currentTime < s.end_time;
    }
  });
  const shiftId = activeShift ? activeShift.id : null;

  if (onDuty.length === 0) {
    return { assigneeId: null, shiftId };
  }

  if (onDuty.length === 1) {
    return { assigneeId: onDuty[0].id, shiftId };
  }

  const tickets = db.getTickets();
  const agentWorkloads = onDuty.map(agent => {
    const openTicketsCount = tickets.filter(
      t => t.assigned_to === agent.id && ['open', 'in_progress'].includes(t.status)
    ).length;
    return { agentId: agent.id, count: openTicketsCount };
  });

  agentWorkloads.sort((a, b) => a.count - b.count);
  return { assigneeId: agentWorkloads[0].agentId, shiftId };
}

export function runEscalationEngine(): { escalatedCount: number; messages: string[] } {
  const now = new Date();
  const tickets = db.getTickets();
  const escalations = db.getTicketEscalations();
  const rules = db.getEscalationRules().filter(r => r.is_active);
  const groups = db.getGroups();
  const comments = db.getComments();
  
  let escalatedCount = 0;
  const messages: string[] = [];
  let ticketsChanged = false;
  let commentsChanged = false;
  let escalationsChanged = false;

  const activeTickets = tickets.filter(t => ['open', 'in_progress'].includes(t.status));

  activeTickets.forEach(ticket => {
    const ticketEscs = escalations.filter(e => e.ticket_id === ticket.id);
    const currentLevel = ticketEscs.length;
    const targetLevel = currentLevel + 1;

    const lastEventTime = currentLevel > 0
      ? new Date(ticketEscs[ticketEscs.length - 1].created_at)
      : new Date(ticket.created_at);

    const minutesSinceLastEvent = (now.getTime() - lastEventTime.getTime()) / 60000;

    const applicableRules = rules.filter(r => {
      if (r.level !== targetLevel) return false;
      if (r.category_id && r.category_id !== ticket.category_id) return false;
      if (r.subcategory_id && r.subcategory_id !== ticket.subcategory_id) return false;
      if (r.priority && r.priority !== ticket.priority) return false;
      return true;
    });

    applicableRules.sort((a, b) => a.trigger_after_min - b.trigger_after_min);

    for (const rule of applicableRules) {
      if (minutesSinceLastEvent >= rule.trigger_after_min) {
        const fromGroup = ticket.assigned_group;
        const fromAssignee = ticket.assigned_to;
        const toGroup = rule.escalate_to_group;

        const { assigneeId, shiftId } = routeAndAssignTicket(ticket, toGroup);

        ticket.assigned_group = toGroup;
        ticket.assigned_to = assigneeId;
        ticket.shift_id = shiftId;
        ticket.status = 'open'; 
        ticket.updated_at = now.toISOString();

        const newEsc: TicketEscalation = {
          id: `esc-log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          ticket_id: ticket.id,
          escalated_from: fromAssignee,
          escalated_to: assigneeId,
          from_group: fromGroup,
          to_group: toGroup,
          level: targetLevel,
          reason: `Auto-escalation Level ${targetLevel}: SLA breach alert. Triggered after ${rule.trigger_after_min} minutes.`,
          auto_triggered: true,
          created_at: now.toISOString()
        };

        const groupName = groups.find(g => g.id === toGroup)?.name || 'Next Group';
        const assigneeUser = db.getUsers().find(u => u.id === assigneeId);
        const assigneeName = assigneeUser ? assigneeUser.name : 'Group Queue';

        const auditComment: TicketComment = {
          id: `com-audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          ticket_id: ticket.id,
          author_id: 'usr-7', 
          comment: `[SYSTEM AUTO-ESCALATION Level ${targetLevel}]: Escalated from group to "${groupName}". Ticket auto-assigned to: ${assigneeName}. Rationale: SLA trigger rule "${rule.name}" triggered after ${rule.trigger_after_min} mins.`,
          is_internal: true,
          attachments: [],
          created_at: now.toISOString()
        };

        escalations.push(newEsc);
        comments.push(auditComment);

        messages.push(`Ticket ${ticket.ticket_number} auto-escalated to Level ${targetLevel} (${groupName}).`);
        escalatedCount++;
        ticketsChanged = true;
        commentsChanged = true;
        escalationsChanged = true;
        break; 
      }
    }

    if (!ticket.sla_breached) {
      const slaDue = new Date(ticket.sla_due_at);
      if (now.getTime() > slaDue.getTime()) {
        ticket.sla_breached = true;
        ticket.updated_at = now.toISOString();

        const breachComment: TicketComment = {
          id: `com-audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          ticket_id: ticket.id,
          author_id: 'usr-7', 
          comment: `[SYSTEM SLA BREACH]: Ticket breached its SLA due time of ${new Date(ticket.sla_due_at).toLocaleString()}.`,
          is_internal: false, 
          attachments: [],
          created_at: now.toISOString()
        };

        comments.push(breachComment);
        messages.push(`Ticket ${ticket.ticket_number} breached SLA due time.`);
        ticketsChanged = true;
        commentsChanged = true;
      }
    }
  });

  if (ticketsChanged) db.saveTickets(tickets);
  if (commentsChanged) db.saveComments(comments);
  if (escalationsChanged) db.saveTicketEscalations(escalations);

  return { escalatedCount, messages };
}

export const CHATBOT_STATES = {
  START: 'START',
  CATEGORY_SELECTED: 'CATEGORY_SELECTED',
  SUBCATEGORY_SELECTED: 'SUBCATEGORY_SELECTED',
  LOCATION_SELECTED: 'LOCATION_SELECTED',
  PRIORITY_SELECTED: 'PRIORITY_SELECTED',
  DESCRIPTION_CAPTURED: 'DESCRIPTION_CAPTURED',
  ATTACHMENT_DONE: 'ATTACHMENT_DONE',
  COMPLETED: 'COMPLETED'
};

export interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  options?: { label: string; value: string }[];
  file?: { name: string; size: string; type: string };
  created_at: string;
}

export function handleChatbotInput(
  _sessionId: string,
  state: string,
  context: Record<string, any>,
  userInput: string,
  userFile?: { name: string; size: string; type: string }
): {
  nextState: string;
  nextContext: Record<string, any>;
  botResponse: string;
  botOptions?: { label: string; value: string }[];
  ticketCreated?: Ticket;
} {
  const nextContext = { ...context };
  let nextState = state;
  let botResponse = '';
  let botOptions: { label: string; value: string }[] = [];
  let ticketCreated: Ticket | undefined;

  switch (state) {
    case CHATBOT_STATES.START: {
      const categories = db.getCategories().filter(c => c.is_active);
      nextState = CHATBOT_STATES.CATEGORY_SELECTED;
      botResponse = "Hi! I'll help you raise a support ticket. What category best describes the issue?";
      botOptions = categories.map(c => ({ label: c.name, value: c.id }));
      break;
    }

    case CHATBOT_STATES.CATEGORY_SELECTED: {
      const catId = userInput;
      const category = db.getCategories().find(c => c.id === catId);
      if (!category) {
        botResponse = "Please select one of the category options below:";
        botOptions = db.getCategories().filter(c => c.is_active).map(c => ({ label: c.name, value: c.id }));
        break;
      }
      nextContext.category_id = catId;
      nextContext.category_name = category.name;

      const subcategories = db.getSubcategories().filter(s => s.category_id === catId && s.is_active);
      nextState = CHATBOT_STATES.SUBCATEGORY_SELECTED;
      botResponse = `Got it, ${category.name}. Can you tell me more specifically what the problem is?`;
      botOptions = subcategories.map(s => ({ label: s.name, value: s.id }));
      break;
    }

    case CHATBOT_STATES.SUBCATEGORY_SELECTED: {
      const subId = userInput;
      const subcategory = db.getSubcategories().find(s => s.id === subId);
      if (!subcategory) {
        botResponse = "Please select one of the subcategory options:";
        const subcategories = db.getSubcategories().filter(s => s.category_id === context.category_id && s.is_active);
        botOptions = subcategories.map(s => ({ label: s.name, value: s.id }));
        break;
      }
      nextContext.subcategory_id = subId;
      nextContext.subcategory_name = subcategory.name;
      nextContext.default_priority = subcategory.default_priority;

      nextState = CHATBOT_STATES.LOCATION_SELECTED;
      botResponse = "Where is this issue occurring?";
      botOptions = [
        { label: 'Plant (Warehouse / Hub)', value: 'plant' },
        { label: 'Site (Dock / External)', value: 'site' },
        { label: 'Remote / Not Applicable', value: 'remote' }
      ];
      break;
    }

    case CHATBOT_STATES.LOCATION_SELECTED: {
      const locType = userInput as 'plant' | 'site' | 'remote';
      nextContext.location_type = locType;

      if (locType === 'remote') {
        const remoteLoc = db.getLocations().find(l => l.type === 'remote') || db.getLocations()[0];
        nextContext.location_id = remoteLoc.id;
        nextContext.location_name = remoteLoc.name;

        nextState = CHATBOT_STATES.PRIORITY_SELECTED;
        botResponse = `Suggesting priority based on subcategory: **${nextContext.default_priority.toUpperCase()}**. Do you want to keep or override this severity?`;
        botOptions = [
          { label: `Keep ${nextContext.default_priority.toUpperCase()}`, value: nextContext.default_priority },
          { label: 'Override to CRITICAL', value: 'critical' },
          { label: 'Override to HIGH', value: 'high' },
          { label: 'Override to MEDIUM', value: 'medium' },
          { label: 'Override to LOW', value: 'low' }
        ];
      } else {
        const filteredLocs = db.getLocations().filter(l => l.type === locType);
        nextState = CHATBOT_STATES.LOCATION_SELECTED + '_SPECIFIC';
        botResponse = `Please select which specific ${locType} this is happening at:`;
        botOptions = filteredLocs.map(l => ({ label: l.name, value: l.id }));
      }
      break;
    }

    case CHATBOT_STATES.LOCATION_SELECTED + '_SPECIFIC': {
      const locId = userInput;
      const location = db.getLocations().find(l => l.id === locId);
      if (!location) {
        botResponse = "Please select a valid location from the list:";
        const filteredLocs = db.getLocations().filter(l => l.type === context.location_type);
        botOptions = filteredLocs.map(l => ({ label: l.name, value: l.id }));
        break;
      }
      nextContext.location_id = locId;
      nextContext.location_name = location.name;

      nextState = CHATBOT_STATES.PRIORITY_SELECTED;
      botResponse = `Suggested severity: **${context.default_priority.toUpperCase()}**. Confirm or choose a different priority:`;
      botOptions = [
        { label: `Keep ${context.default_priority.toUpperCase()}`, value: context.default_priority },
        { label: 'CRITICAL (Ops Blocked)', value: 'critical' },
        { label: 'HIGH (Major Impact)', value: 'high' },
        { label: 'MEDIUM (Minor Block)', value: 'medium' },
        { label: 'LOW (General Inquiry)', value: 'low' }
      ];
      break;
    }

    case CHATBOT_STATES.PRIORITY_SELECTED: {
      const priority = userInput as 'critical' | 'high' | 'medium' | 'low';
      nextContext.priority = priority;

      nextState = CHATBOT_STATES.DESCRIPTION_CAPTURED;
      botResponse = "Please describe the issue in one or two sentences (e.g. details of failure, errors).";
      break;
    }

    case CHATBOT_STATES.DESCRIPTION_CAPTURED: {
      nextContext.description = userInput;

      nextState = CHATBOT_STATES.ATTACHMENT_DONE;
      botResponse = "Would you like to attach a photo or file? Please upload one now or type 'skip' to skip.";
      botOptions = [{ label: 'Skip Attachment', value: 'skip' }];
      break;
    }

    case CHATBOT_STATES.ATTACHMENT_DONE: {
      if (userInput.toLowerCase() !== 'skip' && userFile) {
        nextContext.attachment = {
          name: userFile.name,
          url: '#',
          mime_type: userFile.type
        };
      } else {
        nextContext.attachment = null;
      }

      nextState = CHATBOT_STATES.ATTACHMENT_DONE + '_CONFIRM';
      botResponse = `### Ticket Summary Review
* **Category:** ${context.category_name} > ${context.subcategory_name}
* **Location:** ${context.location_name}
* **Priority:** ${nextContext.priority.toUpperCase()}
* **Description:** ${nextContext.description}
* **Attachment:** ${nextContext.attachment ? nextContext.attachment.name : 'None'}

Shall I submit this ticket now?`;
      botOptions = [
        { label: 'Yes, Submit Ticket', value: 'submit' },
        { label: 'Restart Flow', value: 'restart' }
      ];
      break;
    }

    case CHATBOT_STATES.ATTACHMENT_DONE + '_CONFIRM': {
      if (userInput === 'restart') {
        const categories = db.getCategories().filter(c => c.is_active);
        nextState = CHATBOT_STATES.CATEGORY_SELECTED;
        botResponse = "Let's start over. What category is the issue about?";
        botOptions = categories.map(c => ({ label: c.name, value: c.id }));
        nextContext.category_id = undefined;
        nextContext.subcategory_id = undefined;
        nextContext.location_type = undefined;
        nextContext.location_id = undefined;
        nextContext.priority = undefined;
        nextContext.description = undefined;
        nextContext.attachment = undefined;
        break;
      }

      const subId = context.subcategory_id;
      const sub = db.getSubcategories().find(s => s.id === subId);
      const groupId = sub ? sub.default_group : G_L1;
      
      const newTicketId = `tkt-${Date.now()}`;
      const ticketNum = `TKT-2026-${String(db.getTickets().length + 1).padStart(5, '0')}`;

      const dummyTicket: Partial<Ticket> = {
        org_id: SEED_ORG_ID,
        priority: context.priority,
        category_id: context.category_id,
        subcategory_id: context.subcategory_id
      };
      
      const { assigneeId, shiftId } = routeAndAssignTicket(dummyTicket as Ticket, groupId);

      const slaHours = sub?.sla_hours || (context.priority === 'critical' ? 2 : context.priority === 'high' ? 4 : context.priority === 'medium' ? 12 : 24);
      const slaDueDate = new Date(Date.now() + slaHours * 3600 * 1000);

      const newTicket: Ticket = {
        id: newTicketId,
        ticket_number: ticketNum,
        org_id: SEED_ORG_ID,
        title: `${context.subcategory_name} issue at ${context.location_name}`,
        description: context.description,
        status: 'open',
        priority: context.priority,
        category_id: context.category_id,
        subcategory_id: context.subcategory_id,
        location_type: context.location_type,
        location_id: context.location_id,
        source: 'chatbot',
        raised_by: 'usr-6', 
        assigned_to: assigneeId,
        assigned_group: groupId,
        shift_id: shiftId,
        sla_due_at: slaDueDate.toISOString(),
        sla_breached: false,
        resolved_at: null,
        closed_at: null,
        metadata: context.attachment ? { file_name: context.attachment.name } : {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const tickets = db.getTickets();
      tickets.push(newTicket);
      db.saveTickets(tickets);

      const comments = db.getComments();
      const groupName = db.getGroups().find(g => g.id === groupId)?.name || 'Support';
      const assigneeName = db.getUsers().find(u => u.id === assigneeId)?.name || 'Group Queue';
      
      comments.push({
        id: `com-init-${Date.now()}`,
        ticket_id: newTicketId,
        author_id: 'usr-7', 
        comment: `[TICKET INITIALIZED]: Raised via Chatbot. Routed to group "${groupName}". Auto-assigned to: ${assigneeName} (Shift: ${shiftId ? db.getShifts().find(s => s.id === shiftId)?.name : 'None'}).`,
        is_internal: true,
        attachments: [],
        created_at: new Date().toISOString()
      });

      if (context.attachment) {
        comments.push({
          id: `com-att-${Date.now()}`,
          ticket_id: newTicketId,
          author_id: 'usr-6',
          comment: `Attached file: ${context.attachment.name}`,
          is_internal: false,
          attachments: [context.attachment],
          created_at: new Date().toISOString()
        });
      }

      db.saveComments(comments);

      ticketCreated = newTicket;
      nextState = CHATBOT_STATES.COMPLETED;
      botResponse = `### Ticket Created Successfully! 🎉
Your ticket **${ticketNum}** has been raised. 
* **Assigned Group:** ${groupName}
* **Assignee:** ${assigneeName}
* **SLA Due:** ${slaDueDate.toLocaleString()}

Our agents will update you shortly. You can track this in the **My Tickets** tab.`;
      botOptions = [
        { label: 'Raise another ticket', value: 'restart' }
      ];
      break;
    }

    case CHATBOT_STATES.COMPLETED: {
      const categories = db.getCategories().filter(c => c.is_active);
      nextState = CHATBOT_STATES.CATEGORY_SELECTED;
      botResponse = "What category is the new issue about?";
      botOptions = categories.map(c => ({ label: c.name, value: c.id }));
      nextContext.category_id = undefined;
      nextContext.subcategory_id = undefined;
      nextContext.location_type = undefined;
      nextContext.location_id = undefined;
      nextContext.priority = undefined;
      nextContext.description = undefined;
      nextContext.attachment = undefined;
      break;
    }
  }

  return {
    nextState,
    nextContext,
    botResponse,
    botOptions,
    ticketCreated
  };
}
