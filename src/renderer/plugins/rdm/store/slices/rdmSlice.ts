import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { Experiment, Sample, Project, Task, Instrument, InstrumentReservation, Approval, DashboardStats, AuditLog } from '../../types';

// IPC bridge — 插件版通过 window.electronAPI 调 IPC
const ipc = {
  invoke: (ch: string, ...args: any[]) => (window as any).electronAPI?.invoke(ch, ...args),
};

// ── State ─────────────────────────────────────────────────────
interface RdmState {
  // ELN
  experiments: Experiment[];
  currentExperiment: Experiment | null;
  // Inventory
  samples: Sample[];
  currentSample: Sample | null;
  // Projects
  projects: Project[];
  currentProject: Project | null;
  tasks: Task[];
  // Instruments
  instruments: Instrument[];
  reservations: InstrumentReservation[];
  // Approvals
  approvals: Approval[];
  // Dashboard
  dashboard: DashboardStats | null;
  // Audit
  auditLogs: AuditLog[];
  // UI
  loading: boolean;
  error: string | null;
}

const initial: RdmState = {
  experiments: [], currentExperiment: null,
  samples: [], currentSample: null,
  projects: [], currentProject: null, tasks: [],
  instruments: [], reservations: [],
  approvals: [],
  dashboard: null,
  auditLogs: [],
  loading: false, error: null,
};

// ── Thunks ────────────────────────────────────────────────────
export const fetchExperiments = createAsyncThunk('rdm/fetchExperiments',
  async (opts: { projectId?: string; status?: string; search?: string } = {}) =>
    ipc.invoke('rdm:experiments:list', opts) as Promise<Experiment[]>);

export const createExperiment = createAsyncThunk('rdm/createExperiment',
  async (data: any) => ipc.invoke('rdm:experiments:create', data) as Promise<Experiment>);

export const updateExperiment = createAsyncThunk('rdm/updateExperiment',
  async ({ id, data }: { id: string; data: any }) => ipc.invoke('rdm:experiments:update', { id, data }) as Promise<Experiment>);

export const deleteExperiment = createAsyncThunk('rdm/deleteExperiment',
  async (id: string) => { await ipc.invoke('rdm:experiments:delete', { id }); return id; });

export const fetchSamples = createAsyncThunk('rdm/fetchSamples',
  async (opts: any = {}) => ipc.invoke('rdm:samples:list', opts) as Promise<Sample[]>);

export const createSample = createAsyncThunk('rdm/createSample',
  async (data: any) => ipc.invoke('rdm:samples:create', data) as Promise<Sample>);

export const updateSampleQty = createAsyncThunk('rdm/updateSampleQty',
  async (data: { sampleId: string; delta: number; operation: string; operator: string; remark?: string }) =>
    ipc.invoke('rdm:samples:updateQty', data));

export const fetchProjects = createAsyncThunk('rdm/fetchProjects',
  async () => ipc.invoke('rdm:projects:list') as Promise<Project[]>);

export const createProject = createAsyncThunk('rdm/createProject',
  async (data: any) => ipc.invoke('rdm:projects:create', data) as Promise<Project>);

export const fetchTasks = createAsyncThunk('rdm/fetchTasks',
  async (projectId: string) => ipc.invoke('rdm:tasks:list', { projectId }) as Promise<Task[]>);

export const createTask = createAsyncThunk('rdm/createTask',
  async (data: any) => ipc.invoke('rdm:tasks:create', data) as Promise<Task>);

export const moveTask = createAsyncThunk('rdm/moveTask',
  async ({ id, status }: { id: string; status: Task['status'] }) => {
    await ipc.invoke('rdm:tasks:updateStatus', { id, status });
    return { id, status };
  });

export const fetchInstruments = createAsyncThunk('rdm/fetchInstruments',
  async () => ipc.invoke('rdm:instruments:list') as Promise<Instrument[]>);

export const createInstrument = createAsyncThunk('rdm/createInstrument',
  async (data: any) => ipc.invoke('rdm:instruments:create', data) as Promise<Instrument>);

export const fetchReservations = createAsyncThunk('rdm/fetchReservations',
  async (opts: { instrumentId?: string; date?: string } = {}) =>
    ipc.invoke('rdm:instruments:reservations', opts) as Promise<InstrumentReservation[]>);

export const createReservation = createAsyncThunk('rdm/createReservation',
  async (data: any) => ipc.invoke('rdm:instruments:createReservation', data) as Promise<InstrumentReservation>);

export const fetchApprovals = createAsyncThunk('rdm/fetchApprovals',
  async (status?: string) => ipc.invoke('rdm:approvals:list', { status }) as Promise<Approval[]>);

export const resolveApproval = createAsyncThunk('rdm/resolveApproval',
  async (data: { id: string; approverId: string; approved: boolean; remark?: string }) =>
    ipc.invoke('rdm:approvals:resolve', data));

export const fetchDashboard = createAsyncThunk('rdm/fetchDashboard',
  async () => ipc.invoke('rdm:dashboard:stats') as Promise<DashboardStats>);

export const fetchAuditLogs = createAsyncThunk('rdm/fetchAuditLogs',
  async (opts: any = {}) => ipc.invoke('rdm:audit:list', opts) as Promise<AuditLog[]>);

// ── Slice ─────────────────────────────────────────────────────
const rdmSlice = createSlice({
  name: 'rdm',
  initialState: initial,
  reducers: {
    setCurrentExperiment: (s, a: PayloadAction<Experiment | null>) => { s.currentExperiment = a.payload; },
    setCurrentSample: (s, a: PayloadAction<Sample | null>) => { s.currentSample = a.payload; },
    setCurrentProject: (s, a: PayloadAction<Project | null>) => { s.currentProject = a.payload; },
    clearError: (s) => { s.error = null; },
  },
  extraReducers: (b) => {
    const pend = (s: RdmState) => { s.loading = true; s.error = null; };
    const rej = (s: RdmState, a: any) => { s.loading = false; s.error = a.error.message || '操作失败'; };

    b.addCase(fetchExperiments.pending, pend)
     .addCase(fetchExperiments.fulfilled, (s, a) => { s.loading=false; s.experiments=a.payload; })
     .addCase(fetchExperiments.rejected, rej);

    b.addCase(createExperiment.fulfilled, (s, a) => { s.experiments.unshift(a.payload); s.currentExperiment=a.payload; });
    b.addCase(updateExperiment.fulfilled, (s, a) => {
      const i = s.experiments.findIndex(e => e.id === a.payload.id);
      if (i >= 0) s.experiments[i] = a.payload;
      s.currentExperiment = a.payload;
    });
    b.addCase(deleteExperiment.fulfilled, (s, a) => {
      s.experiments = s.experiments.filter(e => e.id !== a.payload);
      if (s.currentExperiment?.id === a.payload) s.currentExperiment = null;
    });

    b.addCase(fetchSamples.pending, pend)
     .addCase(fetchSamples.fulfilled, (s, a) => { s.loading=false; s.samples=a.payload; })
     .addCase(fetchSamples.rejected, rej);
    b.addCase(createSample.fulfilled, (s, a) => { s.samples.unshift(a.payload); });

    b.addCase(fetchProjects.fulfilled, (s, a) => { s.projects=a.payload; });
    b.addCase(createProject.fulfilled, (s, a) => { s.projects.unshift(a.payload); });

    b.addCase(fetchTasks.fulfilled, (s, a) => { s.tasks=a.payload; });
    b.addCase(createTask.fulfilled, (s, a) => { s.tasks.unshift(a.payload); });
    b.addCase(moveTask.fulfilled, (s, a) => {
      const t = s.tasks.find(t => t.id === a.payload.id);
      if (t) t.status = a.payload.status;
    });

    b.addCase(fetchInstruments.fulfilled, (s, a) => { s.instruments=a.payload; });
    b.addCase(createInstrument.fulfilled, (s, a) => { s.instruments.unshift(a.payload); });
    b.addCase(fetchReservations.fulfilled, (s, a) => { s.reservations=a.payload; });
    b.addCase(createReservation.fulfilled, (s, a) => { s.reservations.push(a.payload); });

    b.addCase(fetchApprovals.fulfilled, (s, a) => { s.approvals=a.payload; });
    b.addCase(fetchDashboard.fulfilled, (s, a) => { s.dashboard=a.payload; });
    b.addCase(fetchAuditLogs.fulfilled, (s, a) => { s.auditLogs=a.payload; });
  },
});

export const { setCurrentExperiment, setCurrentSample, setCurrentProject, clearError } = rdmSlice.actions;
export default rdmSlice.reducer;
