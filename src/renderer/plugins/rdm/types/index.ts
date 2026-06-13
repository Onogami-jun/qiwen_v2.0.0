// ════════════════════════════════════════════════════════════
// 科研数据管理平台 — 完整类型定义
// ════════════════════════════════════════════════════════════

// ── 用户 & 权限 ──────────────────────────────────────────────
export type UserRole = 'admin' | 'pi' | 'member' | 'guest';

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface ProjectMember {
  projectId: string;
  userId: string;
  permissionLevel: 'read' | 'write' | 'admin';
}

// ── 实验记录 (ELN) ───────────────────────────────────────────
export type ExperimentStatus = 'draft' | 'in_progress' | 'completed' | 'archived';

export interface Experiment {
  id: string;
  title: string;
  content: string; // HTML/Markdown
  projectId?: string;
  status: ExperimentStatus;
  tags: string[];
  isSigned: boolean;
  signer?: string;
  signedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];
}

export interface ExperimentVersion {
  id: string;
  experimentId: string;
  version: number;
  content: string;
  savedAt: string;
  savedBy?: string;
}

export interface Attachment {
  id: string;
  experimentId: string;
  filename: string;
  mimeType: string;
  size: number;
  path: string;
  uploadedAt: string;
}

// ── 样品 & 库存 ──────────────────────────────────────────────
export interface Sample {
  id: string;
  name: string;
  type: string;
  batchNo: string;
  casNo?: string;
  supplier?: string;
  storageCondition?: string;
  quantity: number;
  unit: string;
  expiryDate?: string;
  location?: string;
  barcode?: string;
  isHazardous: boolean;
  certificatePath?: string;
  lowStockThreshold?: number;
  createdAt: string;
  updatedAt: string;
}

export type SampleLogOperation = 'in' | 'out' | 'return' | 'dispose' | 'adjust';

export interface SampleLog {
  id: string;
  sampleId: string;
  operation: SampleLogOperation;
  quantityChange: number;
  quantityAfter: number;
  operator: string;
  operatedAt: string;
  remark?: string;
  experimentId?: string;
}

// ── 项目 & 任务 ──────────────────────────────────────────────
export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  status: 'active' | 'paused' | 'completed' | 'archived';
  createdAt: string;
  members?: ProjectMember[];
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  projectId: string;
  parentTaskId?: string;
  title: string;
  description?: string;
  assigneeId?: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimatedHours?: number;
  actualHours?: number;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  children?: Task[];
}

// ── 仪器 & 预约 ──────────────────────────────────────────────
export type InstrumentStatus = 'normal' | 'maintenance' | 'retired' | 'unavailable';

export interface Instrument {
  id: string;
  name: string;
  model?: string;
  location?: string;
  status: InstrumentStatus;
  lastMaintenance?: string;
  nextMaintenance?: string;
  manualPath?: string;
  description?: string;
  createdAt: string;
}

export type ReservationStatus = 'reserved' | 'in_use' | 'completed' | 'cancelled';

export interface InstrumentReservation {
  id: string;
  instrumentId: string;
  userId: string;
  startTime: string;
  endTime: string;
  purpose?: string;
  status: ReservationStatus;
  createdAt: string;
}

// ── 审批 ─────────────────────────────────────────────────────
export type ApprovalTargetType = 'sample_out' | 'purchase_request';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Approval {
  id: string;
  targetType: ApprovalTargetType;
  targetId: string;
  requesterId: string;
  approverId?: string;
  status: ApprovalStatus;
  appliedAt: string;
  resolvedAt?: string;
  remark?: string;
}

export interface PurchaseRequest {
  id: string;
  sampleId: string;
  quantity: number;
  unit: string;
  urgency: 'low' | 'medium' | 'high';
  reason: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'ordered';
  createdBy: string;
  createdAt: string;
}

// ── 审计日志 ─────────────────────────────────────────────────
export interface AuditLog {
  id: string;
  userId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'VIEW';
  tableName: string;
  recordId: string;
  oldData?: any;
  newData?: any;
  createdAt: string;
}

// ── 操作日志 (基础) ──────────────────────────────────────────
export interface OperationLog {
  id: string;
  userId?: string;
  tableName: string;
  recordId: string;
  action: string;
  oldValue?: string;
  newValue?: string;
  operatedAt: string;
}

// ── 仪器统计 ─────────────────────────────────────────────────
export interface InstrumentUsageStat {
  instrumentId: string;
  instrumentName: string;
  totalHours: number;
  reservationCount: number;
  period: string;
}

// ── 看板统计 ─────────────────────────────────────────────────
export interface DashboardStats {
  totalExperiments: number;
  activeExperiments: number;
  totalSamples: number;
  lowStockCount: number;
  expiringSoonCount: number;
  pendingTasks: number;
  pendingApprovals: number;
  todayReservations: number;
  recentExperiments: Experiment[];
  recentLogs: SampleLog[];
}

// ── 系统设置 ─────────────────────────────────────────────────
export interface SystemSettings {
  lowStockAlertDays: number;
  expiryAlertDays: number;
  autoBackupEnabled: boolean;
  autoBackupInterval: number;
  autoBackupPath: string;
  language: 'zh' | 'en';
  theme: 'dark' | 'light';
  webApiEnabled: boolean;
  webApiPort: number;
  teamMode: boolean;
  dbConnectionString?: string;
}

// ── 报表 ─────────────────────────────────────────────────────
export interface ReportConfig {
  id: string;
  name: string;
  type: 'experiment' | 'inventory' | 'task' | 'instrument';
  filters: Record<string, any>;
  fields: string[];
  chartType?: 'bar' | 'line' | 'pie' | 'none';
  createdAt: string;
}
