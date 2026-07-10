/** editorBridge — polished editor ops + smooth banner + elegant flash */
export interface EditorOps { getText():string; getHTML():string; insert(c:string):boolean; replaceAll(h:string):boolean; findAndReplace(s:string,r:string):boolean; getSelection():string; }
type ET='document'|'ppt'|'whiteboard'|'mindmap';const reg=new Map<ET,EditorOps>();
export function registerEditor(t:ET,o:EditorOps):void{reg.set(t,o)}export function unregisterEditor(t:ET):void{reg.delete(t)}
export interface ActionResult{success:boolean;message:string}

/* ── Banner ────────────────────────────────────────────────── */
var bEl:HTMLDivElement|null=null;var bTmr:any=null;
export function showEditorBanner(text:string):void{
  if(!bEl){bEl=document.createElement('div');bEl.className='pn-edit-banner';bEl.innerHTML='<span></span>';document.body.appendChild(bEl)}
  var s=bEl.querySelector('span');if(s)s.textContent=text;bEl.style.opacity='1';bEl.style.transform='translateX(-50%) translateY(0)';
}
export function hideEditorBanner():void{if(bTmr)clearTimeout(bTmr);bTmr=setTimeout(function(){if(bEl){bEl.style.opacity='0';bEl.style.transform='translateX(-50%) translateY(-8px)'}},400)}

/* ── Flash highlight ───────────────────────────────────────── */
var fTmr:any=null;
export function flashEditorChange():void{
  var el=document.querySelector('.ProseMirror')as HTMLElement|null;if(!el)return
  el.style.transition='box-shadow .35s cubic-bezier(.22,1,.36,1)';el.style.boxShadow='0 0 0 4px var(--pn-accent,var(--accent,#c8a96e))';
  if(fTmr)clearTimeout(fTmr);fTmr=setTimeout(function(){el.style.boxShadow='0 0 0 0px transparent';fTmr=null},900)
}
export function scrollToChange():void{
  var el=document.querySelector('.ProseMirror')as HTMLElement|null;if(!el)return
  el.scrollIntoView({behavior:'smooth',block:'nearest'})
}

export function actionAppend(title:string,content:string):ActionResult{var ed=reg.get('document');if(!ed)return{success:false,message:'文档编辑器未就绪'};try{var h=title?'<h2>'+title+'</h2>\n':'';ed.insert(h+content+'\n\n');flashEditorChange();scrollToChange();return{success:true,message:'已追加：'+(title||'内容')}}catch(e:any){return{success:false,message:(e&&e.message)||'追加失败'}}}
export function actionInsert(content:string):ActionResult{var ed=reg.get('document');if(!ed)return{success:false,message:'文档编辑器未就绪'};try{ed.insert(content);flashEditorChange();scrollToChange();return{success:true,message:'已插入'}}catch(e:any){return{success:false,message:(e&&e.message)||'插入失败'}}}
export function actionReplace(search:string,replacement:string):ActionResult{var ed=reg.get('document');if(!ed)return{success:false,message:'文档编辑器未就绪'};try{if(ed.findAndReplace(search,replacement)){flashEditorChange();return{success:true,message:'已替换'}}return{success:false,message:'未找到匹配文本'}}catch(e:any){return{success:false,message:(e&&e.message)||'替换失败'}}}
export function actionRewrite(target:string,content:string):ActionResult{var ed=reg.get('document');if(!ed)return{success:false,message:'文档编辑器未就绪'};try{if(ed.findAndReplace(target,content)){flashEditorChange();return{success:true,message:'已改写'}}ed.insert('\n'+content+'\n');flashEditorChange();return{success:true,message:'未找到原文，已追加'}}catch(e:any){return{success:false,message:(e&&e.message)||'改写失败'}}}
export function actionDelete(target:string):ActionResult{var ed=reg.get('document');if(!ed)return{success:false,message:'文档编辑器未就绪'};try{if(ed.findAndReplace(target,'')){flashEditorChange();return{success:true,message:'已删除'}}return{success:false,message:'未找到匹配文本'}}catch(e:any){return{success:false,message:(e&&e.message)||'删除失败'}}}
