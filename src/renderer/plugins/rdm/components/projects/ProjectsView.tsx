import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProjects, fetchTasks, createProject, createTask, moveTask, setCurrentProject } from '../../store/slices/rdmSlice';
import type { Project, Task, TaskStatus, TaskPriority } from '../../types';

const COLS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'pending',     label: '待办',   color: '#8a8a84' },
  { status: 'in_progress', label: '进行中', color: '#3b82f6' },
  { status: 'completed',   label: '已完成', color: '#52c97a' },
];
const PRIORITY_COLORS: Record<TaskPriority, string> = { low: '#52c97a', medium: '#e8a020', high: '#e87a7a', urgent: '#ff3b30' };

const S = {
  wrap: { display: 'flex', height: '100%', overflow: 'hidden' },
  sidebar: { width: 220, borderRight: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  sHead: { padding: '12px 12px 8px', borderBottom: '0.5px solid var(--border)', flexShrink: 0 },
  sBody: { flex: 1, overflowY: 'auto' as const },
  pItem: (active: boolean) => ({ padding: '9px 14px', cursor: 'pointer', borderBottom: '0.5px solid var(--border)', background: active ? 'var(--bg-surface2)' : 'transparent' }),
  main: { flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  mainHead: { padding: '12px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  kanban: { flex: 1, display: 'flex', gap: 12, padding: 16, overflow: 'auto' as const },
  col: { width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column' as const },
  colHead: { fontSize: 12, fontWeight: 500, padding: '8px 12px', borderRadius: '10px 10px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  colBody: { flex: 1, background: 'var(--bg-surface)', borderRadius: '0 0 10px 10px', border: '0.5px solid var(--border)', padding: 8, minHeight: 200, overflowY: 'auto' as const },
  taskCard: { background: 'var(--bg-surface2)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 8, cursor: 'pointer' },
  inp: { background: 'var(--bg-surface3)', border: '0.5px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12, padding: '6px 10px', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  btn: (v = 'ghost') => ({ padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', border: '0.5px solid var(--border)', background: v === 'primary' ? 'linear-gradient(135deg,#c8a96e,#9a7040)' : 'transparent', color: v === 'primary' ? '#fff' : 'var(--text-secondary)' }),
  modal: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  mBox: { background: 'var(--bg-surface)', borderRadius: 16, padding: '24px', width: 400, border: '0.5px solid var(--border)' },
  mInp: { width: '100%', background: 'var(--bg-surface3)', border: '0.5px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, padding: '8px 12px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, marginBottom: 10 },
};

export const ProjectsView: React.FC<{ currentUser?: string }> = ({ currentUser = 'user' }) => {
  const dispatch = useDispatch<any>();
  const { projects, currentProject, tasks } = useSelector((s: any) => s.rdm);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [pForm, setPForm] = useState({ name: '', description: '' });
  const [tForm, setTForm] = useState({ title: '', description: '', priority: 'medium', dueDate: '' });
  const [dragTask, setDragTask] = useState<Task | null>(null);

  useEffect(() => { dispatch(fetchProjects()); }, []);
  useEffect(() => { if (currentProject) dispatch(fetchTasks(currentProject.id)); }, [currentProject]);

  const handleCreateProject = async () => {
    if (!pForm.name.trim()) return;
    await dispatch(createProject({ ...pForm, ownerId: currentUser }));
    setShowNewProject(false); setPForm({ name: '', description: '' });
  };

  const handleCreateTask = async () => {
    if (!tForm.title.trim() || !currentProject) return;
    await dispatch(createTask({ ...tForm, projectId: currentProject.id, assigneeId: currentUser }));
    setShowNewTask(false); setTForm({ title: '', description: '', priority: 'medium', dueDate: '' });
  };

  const handleDrop = async (status: TaskStatus) => {
    if (!dragTask || dragTask.status === status) return;
    await dispatch(moveTask({ id: dragTask.id, status }));
    setDragTask(null);
  };

  const colTasks = (status: TaskStatus) => tasks.filter((t: Task) => t.status === status);

  return (
    <div style={S.wrap}>
      {/* 项目列表 */}
      <div style={S.sidebar}>
        <div style={S.sHead}>
          <button onClick={() => setShowNewProject(true)} style={{ ...S.btn('primary'), width: '100%', textAlign: 'center' }}>+ 新建项目</button>
        </div>
        <div style={S.sBody}>
          {projects.map((p: Project) => (
            <div key={p.id} style={S.pItem(currentProject?.id === p.id)} onClick={() => dispatch(setCurrentProject(p))}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {tasks.filter((t: Task) => t.projectId === p.id).length} 个任务
              </div>
            </div>
          ))}
          {projects.length === 0 && (
            <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>暂无项目</div>
          )}
        </div>
      </div>

      {/* 看板主区 */}
      <div style={S.main}>
        <div style={S.mainHead}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            {currentProject ? currentProject.name : '选择项目'}
          </div>
          {currentProject && (
            <button onClick={() => setShowNewTask(true)} style={{ ...S.btn('primary'), marginLeft: 'auto' }}>+ 新建任务</button>
          )}
        </div>

        {!currentProject ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 32 }}>📋</div>
            <div style={{ fontSize: 14 }}>选择一个项目查看看板</div>
          </div>
        ) : (
          <div style={S.kanban}>
            {COLS.map((col: any) => (
              <div key={col.status} style={S.col}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(col.status)}>
                <div style={{ ...S.colHead, background: `${col.color}22`, color: col.color }}>
                  <span>{col.label}</span>
                  <span style={{ background: `${col.color}44`, padding: '1px 7px', borderRadius: 10, fontSize: 11 }}>{colTasks(col.status).length}</span>
                </div>
                <div style={S.colBody}>
                  {colTasks(col.status).map((task: Task) => (
                    <div key={task.id} style={S.taskCard}
                      draggable
                      onDragStart={() => setDragTask(task)}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>{task.title}</div>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_COLORS[task.priority], flexShrink: 0, marginTop: 3 }} />
                      </div>
                      {task.description && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, lineHeight: 1.5 }}>{task.description.slice(0, 60)}{task.description.length > 60 && '...'}</div>}
                      {task.dueDate && <div style={{ fontSize: 11, color: new Date(task.dueDate) < new Date() ? '#e87a7a' : 'var(--text-tertiary)' }}>截止：{task.dueDate}</div>}
                    </div>
                  ))}
                  {colTasks(col.status).length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 0' }}>拖入任务</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 新建项目弹窗 */}
      {showNewProject && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowNewProject(false)}>
          <div style={S.mBox}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 16 }}>新建项目</div>
            <input placeholder="项目名称 *" value={pForm.name} onChange={e => setPForm(f => ({ ...f, name: e.target.value }))} style={S.mInp} />
            <input placeholder="描述（可选）" value={pForm.description} onChange={e => setPForm(f => ({ ...f, description: e.target.value }))} style={S.mInp} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewProject(false)} style={S.btn()}>取消</button>
              <button onClick={handleCreateProject} style={S.btn('primary')}>创建</button>
            </div>
          </div>
        </div>
      )}

      {/* 新建任务弹窗 */}
      {showNewTask && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setShowNewTask(false)}>
          <div style={S.mBox}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 16 }}>新建任务</div>
            <input placeholder="任务标题 *" value={tForm.title} onChange={e => setTForm(f => ({ ...f, title: e.target.value }))} style={S.mInp} />
            <input placeholder="描述（可选）" value={tForm.description} onChange={e => setTForm(f => ({ ...f, description: e.target.value }))} style={S.mInp} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 3 }}>优先级</label>
                <select value={tForm.priority} onChange={e => setTForm(f => ({ ...f, priority: e.target.value }))} style={{ ...S.mInp, marginBottom: 0 }}>
                  <option value="low">低</option><option value="medium">中</option><option value="high">高</option><option value="urgent">紧急</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 3 }}>截止日期</label>
                <input type="date" value={tForm.dueDate} onChange={e => setTForm(f => ({ ...f, dueDate: e.target.value }))} style={{ ...S.mInp, marginBottom: 0 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewTask(false)} style={S.btn()}>取消</button>
              <button onClick={handleCreateTask} style={S.btn('primary')}>创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
