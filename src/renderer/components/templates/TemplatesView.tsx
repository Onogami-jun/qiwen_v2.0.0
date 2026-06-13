import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { RootState, AppDispatch } from '../../store';
import {
  fetchTemplates, createTemplate, deleteTemplate, updateTemplate, useTemplate as applyTemplate,
  setActiveCategory, Template,
} from '../../store/slices/templatesSlice';
import { openTab, setView } from '../../store/slices/appSlice';
import { createDocument, updateDocument } from '../../store/slices/documentsSlice';

const CATEGORIES = [
  { id: 'all',       label: '全部',    icon: '🗂' },
  { id: 'academic',  label: '学术研究',icon: '🔬' },
  { id: 'legal',     label: '法律工作',icon: '⚖️' },
  { id: 'education', label: '教育培训',icon: '📚' },
  { id: 'medical',   label: '医疗健康',icon: '🩺' },
  { id: 'writing',   label: '内容创作',icon: '✍️' },
  { id: 'general',   label: '通用办公',icon: '💼' },
];

const actionBtn = (accent=false, danger=false): React.CSSProperties => ({
  padding:'6px 12px', borderRadius:7, fontSize:12, fontFamily:'inherit',
  border: accent ? 'none' : `0.5px solid ${danger?'rgba(232,122,122,0.4)':'var(--border)'}`,
  background: accent ? 'linear-gradient(135deg,#c8a96e,#9a7040)' : danger ? 'rgba(232,122,122,0.1)' : 'var(--bg-surface2)',
  color: accent ? '#fff' : danger ? '#e87a7a' : 'var(--text-secondary)',
  cursor:'pointer',
});

const inputS: React.CSSProperties = {
  width:'100%', padding:'9px 12px', borderRadius:9,
  background:'var(--bg-surface3)', border:'0.5px solid var(--border)',
  color:'var(--text-primary)', fontSize:13.5, outline:'none',
  fontFamily:'inherit', boxSizing:'border-box' as const,
};

// ── 模板卡片 ─────────────────────────────────────────────────
const TemplateCard: React.FC<{
  template: Template;
  onUse:(t:Template)=>void; onEdit:(t:Template)=>void;
  onDelete:(id:string)=>void; onPreview:(t:Template)=>void;
}> = ({ template, onUse, onEdit, onDelete, onPreview }) => {
  const [hovered, setHovered] = useState(false);
  const cat = CATEGORIES.find(c=>c.id===template.category);
  return (
    <motion.div layout initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.18}}
      onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
      onClick={()=>onPreview(template)}
      style={{ background:'var(--bg-surface)', border:`0.5px solid ${hovered?'rgba(200,169,110,0.4)':'var(--border)'}`, borderRadius:14, padding:20, cursor:'pointer', transition:'border-color 0.15s, box-shadow 0.15s', boxShadow:hovered?'0 4px 20px rgba(0,0,0,0.25)':'none', display:'flex', flexDirection:'column' as const, gap:10, position:'relative' as const, minHeight:160 }}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:6,background:'rgba(200,169,110,0.12)',border:'0.5px solid rgba(200,169,110,0.25)',fontSize:11,color:'var(--accent)'}}>
          {cat?.icon} {cat?.label||template.category}
        </span>
        {!template.isBuiltin && <span style={{fontSize:10,color:'var(--text-tertiary)'}}>自定义</span>}
      </div>
      <div style={{fontSize:15,fontWeight:500,color:'var(--text-primary)',lineHeight:1.4}}>{template.title}</div>
      {template.description && <div style={{fontSize:12.5,color:'var(--text-tertiary)',lineHeight:1.6}}>{template.description}</div>}
      {template.tags?.length>0 && (
        <div style={{display:'flex',flexWrap:'wrap' as const,gap:5}}>
          {template.tags.map(tag=><span key={tag} style={{padding:'2px 7px',borderRadius:4,background:'var(--bg-surface3)',fontSize:11,color:'var(--text-tertiary)'}}>{tag}</span>)}
        </div>
      )}
      <div style={{fontSize:11,color:'var(--text-tertiary)',marginTop:'auto' as const}}>已使用 {template.use_count||0} 次</div>
      <AnimatePresence>
        {hovered && (
          <motion.div initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:0.1}}
            style={{position:'absolute' as const,bottom:14,right:14,display:'flex',gap:6}} onClick={e=>e.stopPropagation()}>
            {!template.isBuiltin && <>
              <button onClick={()=>onEdit(template)} style={actionBtn()}>编辑</button>
              <button onClick={()=>onDelete(template.id)} style={actionBtn(false,true)}>删除</button>
            </>}
            <button onClick={()=>onUse(template)} style={actionBtn(true)}>使用模板</button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ── 预览面板 ─────────────────────────────────────────────────
const PreviewPanel: React.FC<{
  template:Template|null; onClose:()=>void;
  onUse:(t:Template)=>void; onEdit:(t:Template)=>void; onDelete:(id:string)=>void;
}> = ({ template, onClose, onUse, onEdit, onDelete }) => {
  if (!template) return null;
  const cat = CATEGORIES.find(c=>c.id===template.category);
  return (
    <motion.div initial={{x:32,opacity:0}} animate={{x:0,opacity:1}} exit={{x:32,opacity:0}} transition={{duration:0.22,ease:[0.22,1,0.36,1]}}
      style={{width:380,flexShrink:0,borderLeft:'0.5px solid var(--border)',background:'var(--bg-surface)',display:'flex',flexDirection:'column' as const,overflow:'hidden'}}>
      <div style={{padding:'16px 20px',borderBottom:'0.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{fontSize:14,fontWeight:500,color:'var(--text-primary)'}}>预览</span>
        <button onClick={onClose} style={{width:26,height:26,border:'none',background:'none',cursor:'pointer',color:'var(--text-tertiary)',fontSize:18,borderRadius:6,lineHeight:1}}>×</button>
      </div>
      <div style={{flex:1,overflowY:'auto' as const,padding:20}}>
        <span style={{display:'inline-flex',alignItems:'center',gap:4,marginBottom:10,padding:'3px 8px',borderRadius:6,background:'rgba(200,169,110,0.12)',border:'0.5px solid rgba(200,169,110,0.25)',fontSize:11,color:'var(--accent)'}}>
          {cat?.icon} {cat?.label}
        </span>
        <div style={{fontSize:18,fontWeight:600,color:'var(--text-primary)',lineHeight:1.4,marginBottom:6}}>{template.title}</div>
        {template.description && <div style={{fontSize:13,color:'var(--text-tertiary)',lineHeight:1.6,marginBottom:14}}>{template.description}</div>}
        <div style={{background:'var(--bg-surface2)',borderRadius:10,border:'0.5px solid var(--border)',padding:14,marginBottom:14,maxHeight:340,overflowY:'auto' as const}}>
          <div className="preview-content" dangerouslySetInnerHTML={{__html:template.content}} style={{fontSize:12.5,lineHeight:1.8,color:'var(--text-secondary)'}}/>
        </div>
        {template.tags?.length>0 && (
          <div style={{display:'flex',flexWrap:'wrap' as const,gap:6}}>
            {template.tags.map(tag=><span key={tag} style={{padding:'3px 8px',borderRadius:5,background:'var(--bg-surface3)',fontSize:11.5,color:'var(--text-tertiary)'}}>{tag}</span>)}
          </div>
        )}
      </div>
      <div style={{padding:'16px 20px',borderTop:'0.5px solid var(--border)',display:'flex',flexDirection:'column' as const,gap:8}}>
        <button onClick={()=>onUse(template)} style={{width:'100%',padding:11,borderRadius:10,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#c8a96e,#9a7040)',color:'#fff',fontSize:14,fontWeight:500,fontFamily:'inherit'}}>
          📄 使用此模板新建文档
        </button>
        {!template.isBuiltin && (
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>onEdit(template)} style={{flex:1,padding:9,borderRadius:9,border:'0.5px solid var(--border)',background:'var(--bg-surface2)',color:'var(--text-secondary)',fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>编辑</button>
            <button onClick={()=>onDelete(template.id)} style={{flex:1,padding:9,borderRadius:9,border:'0.5px solid rgba(232,122,122,0.4)',background:'rgba(232,122,122,0.08)',color:'#e87a7a',fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>删除</button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ── 编辑/新建模态框 ──────────────────────────────────────────
const EditModal: React.FC<{template:Template|null; onSave:(d:any)=>void; onClose:()=>void}> = ({ template, onSave, onClose }) => {
  const [title, setTitle] = useState(template?.title||'');
  const [description, setDescription] = useState(template?.description||'');
  const [category, setCategory] = useState(template?.category||'general');
  const [tags, setTags] = useState((template?.tags||[]).join(', '));
  const [content, setContent] = useState(template?.content||'');
  const ok = title.trim().length > 0;
  return (
    <div style={{position:'fixed',inset:0,zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.6)',backdropFilter:'blur(6px)'}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}}
        style={{background:'var(--bg-surface2)',border:'0.5px solid var(--border-md)',borderRadius:18,padding:28,width:560,maxHeight:'85vh',display:'flex',flexDirection:'column' as const,gap:14,boxShadow:'0 32px 80px rgba(0,0,0,0.5)',overflowY:'auto' as const}}>
        <div style={{fontSize:16,fontWeight:600,color:'var(--text-primary)'}}>{template?'编辑模板':'新建模板'}</div>
        <div>
          <div style={{fontSize:12,color:'var(--text-tertiary)',marginBottom:5}}>模板标题 *</div>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="模板名称" style={inputS}/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div>
            <div style={{fontSize:12,color:'var(--text-tertiary)',marginBottom:5}}>分类</div>
            <select value={category} onChange={e=>setCategory(e.target.value)} style={{...inputS,appearance:'none' as const}}>
              {CATEGORIES.filter(c=>c.id!=='all').map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:12,color:'var(--text-tertiary)',marginBottom:5}}>标签（逗号分隔）</div>
            <input value={tags} onChange={e=>setTags(e.target.value)} placeholder="研究, 论文" style={inputS}/>
          </div>
        </div>
        <div>
          <div style={{fontSize:12,color:'var(--text-tertiary)',marginBottom:5}}>描述</div>
          <input value={description} onChange={e=>setDescription(e.target.value)} placeholder="简要说明用途" style={inputS}/>
        </div>
        <div>
          <div style={{fontSize:12,color:'var(--text-tertiary)',marginBottom:5}}>模板内容（HTML 格式）</div>
          <textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="<h1>标题</h1><p>内容...</p>"
            style={{...inputS,height:200,resize:'vertical' as const,fontFamily:'monospace',fontSize:12}}/>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{padding:'9px 20px',borderRadius:9,border:'0.5px solid var(--border)',background:'transparent',color:'var(--text-secondary)',cursor:'pointer',fontSize:13.5,fontFamily:'inherit'}}>取消</button>
          <button onClick={()=>ok&&onSave({title:title.trim(),description:description.trim(),category,tags:tags.split(',').map(t=>t.trim()).filter(Boolean),content})} disabled={!ok}
            style={{padding:'9px 24px',borderRadius:9,border:'none',background:'linear-gradient(135deg,#c8a96e,#9a7040)',color:'#fff',cursor:ok?'pointer':'not-allowed',fontSize:13.5,fontWeight:500,fontFamily:'inherit',opacity:ok?1:0.5}}>
            {template?'保存修改':'创建模板'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── 主视图 ───────────────────────────────────────────────────
export const TemplatesView: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { items, loading, activeCategory } = useSelector((s: RootState) => s.templates);
  const activeWorkspaceId = useSelector((s: RootState) => s.app.activeWorkspaceId);
  const [search, setSearch] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState<Template|null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editTarget, setEditTarget] = useState<Template|null>(null);

  useEffect(() => {
    dispatch(fetchTemplates(activeCategory==='all'?undefined:activeCategory));
  }, [activeCategory, dispatch]);

  const filtered = (items||[]).filter((t:Template) =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase()) ||
    (t.tags||[]).some((tag:string)=>tag.toLowerCase().includes(search.toLowerCase()))
  );

  const handleUse = useCallback(async (template:Template) => {
    if (!activeWorkspaceId) { alert('请先选择或创建工作区'); return; }
    try {
      // 1. 获取模板内容
      const result = await dispatch(applyTemplate(template.id)).unwrap();
      const templateContent: string = typeof result === 'string' ? result : (result as any)?.content || '';
      // 2. 创建文档并直接传入内容
      const doc = await dispatch(createDocument({
        workspaceId: activeWorkspaceId,
        title: template.title,
      })).unwrap();
      // 3. 写入模板内容
      if (templateContent) {
        await dispatch(updateDocument({ id: doc.id, content: templateContent })).unwrap();
      }
      setPreviewTemplate(null);
      dispatch(openTab({ documentId: doc.id, title: doc.title }));
      dispatch(setView('workbench'));
    } catch (err: any) {
      alert('使用模板失败：' + (err?.message || '未知错误'));
    }
  }, [dispatch, activeWorkspaceId]);

  const handleDelete = useCallback(async (id:string) => {
    if (!window.confirm('确定删除这个模板？')) return;
    dispatch(deleteTemplate(id));
    if (previewTemplate?.id===id) setPreviewTemplate(null);
  }, [dispatch, previewTemplate]);

  const handleSave = useCallback(async (data:any) => {
    if (editTarget) { await dispatch(updateTemplate({id:editTarget.id,...data})); await dispatch(fetchTemplates()); }
    else await dispatch(createTemplate(data));
    setShowEdit(false); setEditTarget(null);
  }, [dispatch, editTarget]);

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column' as const,height:'100%',overflow:'hidden',background:'var(--bg-editor)'}}>
      <AnimatePresence>
        {showEdit && <EditModal template={editTarget} onSave={handleSave} onClose={()=>{setShowEdit(false);setEditTarget(null);}}/>}
      </AnimatePresence>

      <div style={{padding:'24px 32px 0',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
          <div>
            <div style={{fontSize:22,fontWeight:600,color:'var(--text-primary)',marginBottom:4}}>模板库</div>
            <div style={{fontSize:13,color:'var(--text-tertiary)'}}>{(items||[]).length} 个模板，覆盖 6 大职业场景</div>
          </div>
          <button onClick={()=>{setEditTarget(null);setShowEdit(true);}} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 18px',background:'linear-gradient(135deg,#c8a96e,#9a7040)',color:'#fff',border:'none',borderRadius:10,fontSize:13.5,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            新建模板
          </button>
        </div>
        <div style={{position:'relative' as const,marginBottom:14}}>
          <svg style={{position:'absolute' as const,left:12,top:'50%',transform:'translateY(-50%)',color:'var(--text-tertiary)',pointerEvents:'none' as const}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索模板名称、描述、标签..."
            style={{width:'100%',padding:'9px 14px 9px 36px',background:'var(--bg-surface2)',border:'0.5px solid var(--border)',borderRadius:10,fontSize:13.5,color:'var(--text-primary)',outline:'none',fontFamily:'inherit',boxSizing:'border-box' as const}}/>
        </div>
        <div style={{display:'flex',gap:6,overflowX:'auto' as const,paddingBottom:4}}>
          {CATEGORIES.map(cat=>(
            <button key={cat.id} onClick={()=>dispatch(setActiveCategory(cat.id))} style={{
              display:'flex',alignItems:'center',gap:5,padding:'6px 12px',borderRadius:8,cursor:'pointer',
              fontFamily:'inherit',fontSize:12.5,whiteSpace:'nowrap' as const,flexShrink:0,
              background:activeCategory===cat.id?'rgba(200,169,110,0.15)':'var(--bg-surface2)',
              color:activeCategory===cat.id?'var(--accent)':'var(--text-secondary)',
              border:activeCategory===cat.id?'0.5px solid rgba(200,169,110,0.3)':'0.5px solid var(--border)',
            }}>
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        <div style={{flex:1,overflowY:'auto' as const,padding:'16px 32px 32px'}}>
          {loading ? (
            <div style={{textAlign:'center' as const,padding:'60px 0',color:'var(--text-tertiary)'}}>加载中...</div>
          ) : filtered.length===0 ? (
            <div style={{textAlign:'center' as const,padding:'60px 0'}}>
              <div style={{fontSize:40,marginBottom:12}}>📄</div>
              <div style={{fontSize:15,color:'var(--text-tertiary)'}}>{search?'没有找到匹配的模板':'暂无模板'}</div>
            </div>
          ) : (
            <motion.div layout style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(255px,1fr))',gap:14}}>
              <AnimatePresence>
                {filtered.map((t:Template)=>(
                  <TemplateCard key={t.id} template={t}
                    onUse={handleUse}
                    onEdit={(tmpl)=>{setEditTarget(tmpl);setShowEdit(true);}}
                    onDelete={handleDelete}
                    onPreview={setPreviewTemplate}/>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
        <AnimatePresence>
          {previewTemplate && (
            <PreviewPanel template={previewTemplate} onClose={()=>setPreviewTemplate(null)}
              onUse={handleUse}
              onEdit={(tmpl)=>{setEditTarget(tmpl);setShowEdit(true);}}
              onDelete={handleDelete}/>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
