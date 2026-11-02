window.__ModuleLoader__.load({
  id: 'dsh-wetflow',
  factory: (require) => {
    const React = require('react')
    const { useState, useEffect, useCallback, useLayoutEffect, useRef, useSyncExternalStore } = React
    const h = React.createElement
    const TAB_ID = 'dsh-wetflow/workbench'
    const TAB_KIND = 'wetflow-workbench'
    const css = `
      .wf-left-dock{position:absolute;top:0;bottom:0;z-index:1;border-right:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1);overflow:hidden;pointer-events:auto}
      .wf-dock-close{position:absolute;right:12px;top:13px;z-index:2;width:27px;height:27px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:19px;line-height:1;cursor:pointer}.wf-dock-close:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .wf-launcher{display:flex;align-items:center;gap:9px;width:100%;min-height:32px;padding:6px 9px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;text-align:left;cursor:pointer}.wf-launcher:hover,.wf-launcher[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.wf-launcher svg{flex:none}.wf-launcher--collapsed{justify-content:center;padding:6px 0}
      .wf-panel{height:100%;overflow:auto;box-sizing:border-box;padding:20px 20px 32px;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:1.5;background:var(--dsw-alias-bg-layer-1)}
      .wf-panel *{box-sizing:border-box}.wf-panel h2,.wf-panel h3,.wf-panel p{margin:0}.wf-panel button,.wf-panel input,.wf-panel select{font:inherit;color:inherit}
      .wf-panel button,.wf-panel select,.wf-panel input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:8px}
      .wf-panel button{cursor:pointer;padding:7px 10px}.wf-panel button:hover{background:var(--dsw-alias-interactive-bg-hover)}.wf-panel button:disabled{opacity:.45;cursor:default}
      .wf-panel button:focus-visible,.wf-panel input:focus-visible,.wf-panel select:focus-visible{outline:2px solid var(--dsw-static-deepseek-500);outline-offset:2px}
      .wf-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:18px}.wf-heading h2{font-size:17px;font-weight:650;line-height:1.35}.wf-muted{color:var(--dsw-alias-label-secondary);font-size:12px}.wf-heading .wf-muted{margin-top:4px}
      .wf-iconbtn{border:0!important;padding:5px!important;background:transparent!important;color:var(--dsw-alias-label-secondary)!important}.wf-tabs{display:flex;gap:16px;border-bottom:1px solid var(--dsw-alias-border-l3);margin:0 -20px 18px;padding:0 20px}.wf-tabs button{padding:0 1px 9px;border:0;border-radius:0;background:transparent;white-space:nowrap;color:var(--dsw-alias-label-secondary)}.wf-tabs button[aria-selected=true]{color:var(--dsw-alias-label-primary);box-shadow:0 2px var(--dsw-static-deepseek-500);font-weight:600}
      .wf-section{margin:0 0 22px}.wf-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.wf-row h3{font-size:13px;font-weight:600}.wf-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.wf-panel select,.wf-panel input{width:100%;padding:8px 10px;margin-top:7px;min-width:0}.wf-box{border:1px solid var(--dsw-alias-border-l3);border-radius:10px;padding:13px;margin-top:10px}.wf-box .wf-muted{margin-top:5px}.wf-chip{font-size:12px;color:var(--dsw-alias-label-secondary)}.wf-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--dsw-static-deepseek-500);margin-right:7px}.wf-stage{font-size:16px;font-weight:650;margin-top:8px}.wf-divider{border-top:1px solid var(--dsw-alias-border-l3);margin:16px 0}.wf-list{padding:0;margin:10px 0 0;list-style:none}.wf-list li{padding:9px 0;border-bottom:1px solid var(--dsw-alias-border-l3);overflow-wrap:anywhere}.wf-list li:last-child{border-bottom:0}.wf-error{padding:10px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-static-red-600);margin:0 0 14px}.wf-approval{white-space:pre-wrap;overflow-wrap:anywhere}.wf-file{display:none}.wf-tool{padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l3)}.wf-tool strong{font-weight:600}.wf-tool .wf-muted{margin-top:3px}.wf-header-action{width:28px;height:28px;padding:5px;border:0;border-radius:6px;color:var(--dsw-alias-label-secondary);background:transparent;cursor:pointer}.wf-header-action:hover{background:var(--dsw-alias-interactive-bg-hover)}
      /* Match the host's quiet navigation rather than creating a second dashboard. */
      .wf-left-dock{background:var(--dsw-specific-sidebar-fill)}
      .wf-panel{padding:18px 16px 28px;font-size:13px;background:var(--dsw-specific-sidebar-fill)}
      .wf-heading{margin:0 0 20px;padding-right:28px;min-height:36px;align-items:center}
      .wf-title{display:flex;align-items:center;gap:10px;min-width:0}
      .wf-title-icon{width:32px;height:32px;display:grid;place-items:center;border-radius:9px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);flex:none}
      .wf-heading h2{font-size:14px;font-weight:650;line-height:1.25}
      .wf-heading .wf-muted{font-size:11px;margin-top:2px}
      .wf-dock-close{top:17px;right:12px;font-size:18px}
      .wf-tabs{gap:3px;border:0;padding:3px;margin:0 0 22px;background:var(--dsw-alias-bg-layer-2);border-radius:8px}
      .wf-tabs button{flex:1;text-align:center;padding:6px 2px;border-radius:6px;font-size:12px;box-shadow:none}
      .wf-tabs button[aria-selected=true]{background:var(--dsw-alias-bg-layer-1);box-shadow:0 1px 3px rgba(0,0,0,.08);font-weight:600}
      .wf-section{margin-bottom:25px}.wf-row h3{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary)}
      .wf-panel select{height:36px;margin-top:5px;padding:0 9px;border-color:var(--dsw-alias-border-l3);border-radius:7px;font-size:13px}
      .wf-iconbtn{font-size:12px!important}.wf-box{border-color:var(--dsw-alias-border-l3);border-radius:8px}
      .wf-flow{display:flex;gap:10px;align-items:flex-start;margin-top:10px;padding:10px 11px;background:var(--dsw-alias-bg-layer-2);border-radius:8px}
      .wf-flow-mark{display:grid;place-items:center;width:23px;height:23px;border-radius:7px;background:var(--dsw-alias-bg-layer-1);flex:none}
      .wf-flow-mark .wf-dot{margin:0;width:7px;height:7px}.wf-stage{font-size:13px;font-weight:600;margin:1px 0 3px}.wf-flow .wf-muted{line-height:1.55}
      .wf-list li,.wf-tool{padding:10px 0}
      .wf-picker{position:relative;margin-top:5px}
      .wf-panel .wf-picker-trigger{display:flex;justify-content:space-between;align-items:center;width:100%;height:36px;padding:0 10px;border:1px solid var(--dsw-alias-border-l3);border-radius:7px;text-align:left;font-size:13px}
      .wf-picker-trigger span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .wf-chevron{font-size:17px;line-height:1;color:var(--dsw-alias-label-secondary);padding-left:8px}
      .wf-picker-menu{position:absolute;z-index:10;top:calc(100% + 5px);left:0;right:0;max-height:220px;overflow:auto;padding:4px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l3);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.16)}
      .wf-panel .wf-picker-option{display:flex;justify-content:space-between;gap:8px;align-items:center;width:100%;padding:8px;border:0;border-radius:5px;background:transparent;text-align:left;font-size:13px}
      .wf-panel .wf-picker-option:hover,.wf-panel .wf-picker-option:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}
      .wf-panel .wf-picker-option[aria-selected=true]{color:var(--dsw-alias-label-primary)}
      .wf-panel{padding:19px 18px 30px}
      .wf-heading{margin-bottom:20px}.wf-heading h2{font-size:15px}.wf-heading .wf-muted{font-size:12px}
      .wf-title-icon{width:34px;height:34px}
      .wf-tabs{border:1px solid var(--dsw-alias-border-l3);background:transparent;padding:0;gap:0;overflow:hidden}
      .wf-tabs button{padding:9px 0;border-radius:0;font-size:12px}
      .wf-tabs button[aria-selected=true]{color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-static-deepseek-500) 14%,transparent);box-shadow:inset 0 -2px var(--dsw-static-deepseek-500)}
      .wf-row h3{color:var(--dsw-alias-label-primary);font-size:13px}
      .wf-panel .wf-iconbtn{padding:4px 7px!important;border-radius:7px!important}.wf-panel .wf-iconbtn:hover{background:var(--dsw-alias-interactive-bg-hover)!important}
      .wf-picker{margin-top:8px}.wf-panel .wf-picker-trigger{height:42px;border-radius:9px;padding:0 12px}
      .wf-picker-trigger[aria-expanded=true]{border-color:var(--dsw-static-deepseek-500);box-shadow:0 0 0 1px var(--dsw-static-deepseek-500)}
      .wf-picker-value{display:flex;align-items:center;gap:10px;min-width:0}.wf-picker-value svg{flex:none;color:var(--dsw-alias-label-secondary)}.wf-picker-value span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .wf-chevron{padding:0;flex:none;transition:transform .15s}.wf-chevron.is-open{transform:rotate(180deg)}
      .wf-picker-menu{position:static;max-height:none;overflow:visible;margin-top:4px;padding:6px;border-radius:10px;box-shadow:none;background:var(--dsw-alias-bg-layer-2)}
      .wf-picker-search{display:flex;align-items:center;gap:8px;height:36px;padding:0 9px;border:1px solid var(--dsw-alias-border-l3);border-radius:7px;color:var(--dsw-alias-label-secondary)}
      .wf-panel .wf-search-input{width:100%;height:auto;min-width:0;margin:0;padding:0;background:transparent;border:0;outline:none;font-size:12px}
      .wf-panel .wf-search-input:focus-visible{outline:none}.wf-picker-search:focus-within{border-color:var(--dsw-static-deepseek-500)}
      .wf-picker-options{max-height:190px;overflow:auto;margin-top:5px}
      .wf-panel .wf-picker-option{min-height:36px;padding:8px 9px;border-radius:7px}
      .wf-panel .wf-picker-option[aria-selected=true]{background:color-mix(in srgb,var(--dsw-static-deepseek-500) 25%,transparent)}
      .wf-picker-option[aria-selected=true] svg,.wf-picker-check{color:var(--dsw-static-deepseek-500)}
      .wf-picker-empty{padding:12px 9px;color:var(--dsw-alias-label-secondary);font-size:12px}
      .wf-panel .wf-picker-create{display:flex;gap:8px;align-items:center;width:100%;margin-top:5px;padding:9px;border:0;border-top:1px solid var(--dsw-alias-border-l3);border-radius:0;background:transparent;text-align:left;color:var(--dsw-static-deepseek-500)}
      .wf-picker-create span{font-size:16px;line-height:1}
      .wf-panel .wf-flow{width:100%;display:flex;align-items:center;text-align:left;border:1px solid var(--dsw-alias-border-l3);padding:11px;border-radius:8px;background:var(--dsw-alias-bg-layer-2)}
      .wf-flow-content{display:flex;flex:1;min-width:0;flex-direction:column}.wf-flow-arrow{font-size:20px;color:var(--dsw-alias-label-secondary)}
      .wf-panel .wf-feature{display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;padding:13px 2px;border:0;border-bottom:1px solid var(--dsw-alias-border-l3);border-radius:0;background:transparent;text-align:left}
      .wf-feature>span:first-child{display:flex;flex-direction:column;gap:3px}.wf-feature-status{color:var(--dsw-alias-label-secondary);font-size:12px;white-space:nowrap}
      .wf-panel .wf-back{padding:0;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12px}.wf-feature-title{font-size:15px;margin-top:17px!important}.wf-feature-description{margin:5px 0 18px!important}
      .wf-provider-group{display:flex;gap:5px;flex-wrap:wrap}.wf-panel .wf-provider-group button{padding:6px 7px;border:1px solid var(--dsw-alias-border-l3);font-size:11px}.wf-panel .wf-provider-group button[aria-pressed=true]{border-color:var(--dsw-static-deepseek-500);background:color-mix(in srgb,var(--dsw-static-deepseek-500) 14%,transparent)}
      .wf-research-query{display:block;margin-top:18px}.wf-panel .wf-primary{width:100%;margin-top:12px;background:var(--dsw-static-deepseek-500);border-color:transparent;color:white;font-weight:600}.wf-panel .wf-primary:hover{filter:brightness(1.1)}
      .wf-statusline{margin-top:14px;font-size:12px}.wf-research-list a{color:var(--dsw-alias-label-primary);text-decoration:none}.wf-research-list a:hover{text-decoration:underline}.wf-research-list p{margin-top:4px}
      .wf-md-inputs{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}.wf-md-result{margin-top:18px;border:1px solid var(--dsw-alias-border-l3);padding:12px;border-radius:9px}.wf-md-numbers{display:flex;gap:30px;margin:15px 0}.wf-md-numbers div{display:flex;flex-direction:column;gap:4px}.wf-md-numbers strong{font-size:20px}
      .wf-solvate{display:flex;align-items:center;gap:8px;margin-top:14px;font-size:12px}.wf-panel .wf-solvate input{width:auto;margin:0}
      .wf-task-list li strong{font-size:12px;overflow-wrap:anywhere}.wf-task-list p{margin-top:5px;overflow-wrap:anywhere}.wf-task-list .wf-back{margin-top:8px}
      .wf-project-switch{padding-bottom:18px;border-bottom:1px solid var(--dsw-alias-border-l3)}
      .wf-project-heading{padding:19px 0 5px}.wf-project-name{font-size:15px;font-weight:650;overflow-wrap:anywhere}.wf-project-heading p{margin-top:3px}
      .wf-unified-section{padding:17px 0;border-bottom:1px solid var(--dsw-alias-border-l3)}.wf-unified-section:last-child{border:0}.wf-unified-section h3{font-size:13px}
      .wf-import{font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer}.wf-import:hover{color:var(--dsw-alias-label-primary)}
      .wf-panel .wf-section-toggle{display:flex;align-items:center;justify-content:space-between;text-align:left;width:100%;padding:0;border:0;background:transparent}.wf-section-toggle>span:first-child{display:flex;flex-direction:column;gap:4px}.wf-section-toggle strong{font-size:13px}.wf-toggle-arrow{font-size:20px;color:var(--dsw-alias-label-secondary)}
      .wf-inline-content{margin-top:16px}.wf-inline-content .wf-feature-description{margin:0 0 14px!important}
      .wf-security-note{padding:10px 11px;margin:0 0 16px;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;font-size:12px;font-weight:600}.wf-security-note p{font-weight:400;color:var(--dsw-alias-label-secondary);margin-top:4px;line-height:1.5}
      @media (prefers-reduced-motion:reduce){.wf-chevron{transition:none}}
    
    `
    function LabIcon({ size = 16 }) { return h('svg', { width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true },h('path',{d:'M9 3h6M10 3v6l-5 8.5A2.3 2.3 0 0 0 7 21h10a2.3 2.3 0 0 0 2-3.5L14 9V3M8 15h8'}),h('path',{d:'M10 18h.01M14 17h.01'})) }
    function FolderIcon() {
      return h('svg',{width:16,height:16,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:'M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z'}))
    }
    function SearchIcon() {
      return h('svg',{width:15,height:15,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round','aria-hidden':true},h('circle',{cx:10.5,cy:10.5,r:6.5}),h('path',{d:'m16 16 4 4'}))
    }
    function Picker({label, value, items, disabled, onChange, onCreate, kind}) {
      const [open,setOpen]=useState(false), [query,setQuery]=useState('')
      const root=useRef(null), trigger=useRef(null), search=useRef(null)
      const current=items.find(item=>item.id===value)
      const matches=items.filter(item=>item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
      useEffect(()=>{
        if(!open)return
        const close=e=>{if(!root.current?.contains(e.target)){setOpen(false);setQuery('')}}
        document.addEventListener('pointerdown',close)
        return()=>document.removeEventListener('pointerdown',close)
      },[open])
      const dismiss=()=>{setOpen(false);setQuery('');trigger.current?.focus()}
      const choose=item=>{onChange(item.id);dismiss()}
      const openMenu=()=>{setOpen(true);requestAnimationFrame(()=>search.current?.focus())}
      const icon=()=>kind==='project'?h(FolderIcon):h(LabIcon,{size:16})
      return h('div',{className:'wf-picker',ref:root,onKeyDown:e=>{if(e.key==='Escape'&&open){e.preventDefault();dismiss()}}},
        h('button',{type:'button',ref:trigger,className:'wf-picker-trigger',disabled,'aria-label':label,'aria-expanded':open,'aria-haspopup':'listbox',onClick:()=>open?dismiss():openMenu(),onKeyDown:e=>{if((e.key==='ArrowDown'||e.key==='ArrowUp')&&!open){e.preventDefault();openMenu()}}},
          h('span',{className:'wf-picker-value'},icon(),h('span',null,current?.name||'请选择')),
          h('svg',{className:'wf-chevron'+(open?' is-open':''),width:16,height:16,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:'m7 10 5 5 5-5'}))),
        open&&h('div',{className:'wf-picker-menu'},
          h('label',{className:'wf-picker-search'},h(SearchIcon),h('input',{ref:search,className:'wf-search-input',value:query,placeholder:kind==='project'?'搜索项目':kind==='run'?'搜索实验运行':'搜索报告','aria-label':kind==='project'?'搜索项目':kind==='run'?'搜索实验运行':'搜索报告',onChange:e=>setQuery(e.target.value),onKeyDown:e=>{if(e.key==='ArrowDown'){e.preventDefault();root.current?.querySelector('[role=option]')?.focus()}}})),
          h('div',{className:'wf-picker-options',role:'listbox','aria-label':label},matches.length?matches.map((item,i)=>h('button',{type:'button',key:item.id,role:'option','aria-selected':item.id===value,tabIndex:-1,className:'wf-picker-option',onClick:()=>choose(item),onKeyDown:e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const options=root.current.querySelectorAll('[role=option]');if(e.key==='ArrowUp'&&i===0){search.current?.focus();return}options[(i+(e.key==='ArrowDown'?1:-1)+options.length)%options.length]?.focus()}}},h('span',{className:'wf-picker-value'},icon(),h('span',null,item.name)),item.id===value&&h('span',{className:'wf-picker-check','aria-hidden':true},'✓'))):h('div',{className:'wf-picker-empty'},'没有匹配的结果')),
          onCreate&&h('button',{type:'button',className:'wf-picker-create',onClick:()=>{dismiss();onCreate()}},h('span',{'aria-hidden':true},'＋'),kind==='project'?'新建项目':'新建实验运行')))
    }
    async function request(path, options={}) {
      const method=(options.method||'GET').toUpperCase()
      const endpoint=method==='GET'||method==='HEAD'?'/api/wetflow':'/api/wetflow-write'
      const response=await fetch(endpoint+'?'+new URLSearchParams({path}), {...options,credentials:'same-origin'})
      const result=await response.json()
      if(!response.ok) throw new Error(result.error || '操作失败，请重试。')
      return result
    }
    function Workbench({ctx}) {
      const sessionSource=ctx.uiSession.adapter.current, workspaceSource=ctx.workspaces.list
      const dshSession=useSyncExternalStore(useCallback(fn=>sessionSource.subscribe(fn),[sessionSource]),useCallback(()=>sessionSource.getSnapshot(),[sessionSource]))
      const dshWorkspaces=useSyncExternalStore(useCallback(fn=>workspaceSource.subscribe(fn),[workspaceSource]),useCallback(()=>workspaceSource.getSnapshot(),[workspaceSource]))
      const dshWorkspace=dshWorkspaces.items.find(item=>item.sessionIds.includes(dshSession.key))
      const [snapshot,setSnapshot]=useState(null), [workspace,setWorkspace]=useState(null), [sources,setSources]=useState([]), [legacySources,setLegacySources]=useState([]), [security,setSecurity]=useState(null)
      const [researchOpen,setResearchOpen]=useState(false), [mdOpen,setMdOpen]=useState(false), [flowOpen,setFlowOpen]=useState(false), [edit,setEdit]=useState(''), [name,setName]=useState(''), [error,setError]=useState(''), [busy,setBusy]=useState(false)
      const refresh=useCallback(async()=>{
        try { const [s,w,e,legacy,secure]=await Promise.all([request('/api/snapshot'),request('/api/workspace'),dshWorkspace?request('/api/workspace-files?workspaceId='+encodeURIComponent(dshWorkspace.workspaceId)):Promise.resolve({items:[]}),request('/api/evidence'),request('/api/wetflow-security')]);setSnapshot(s);setWorkspace(w);setSources(e.items);setLegacySources(legacy.items);setSecurity(secure);setError('') }
        catch(e){setError(e instanceof Error?e.message:'无法连接生物工作台。')}
      },[dshWorkspace?.workspaceId])
      useEffect(()=>{ void refresh();const timer=setInterval(()=>void refresh(),3500);return()=>clearInterval(timer) },[refresh])
      const action=async(fn)=>{setBusy(true);setError('');try{await fn();await refresh()}catch(e){setError(e instanceof Error?e.message:'操作失败，请重试。')}finally{setBusy(false)}}
      const post=(path,body)=>request(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      const create=()=>action(async()=>{const value=name.trim();if(!value)throw new Error('请填写名称。');if(edit==='project')await post('/api/projects',{name:value});else await post('/api/workflow-runs',{name:value,projectId:workspace.activeProjectId});setEdit('');setName('')})
      const upload=(event)=>{const files=Array.from(event.target.files||[]);event.target.value='';if(!files.length)return;void action(async()=>{if(!dshWorkspace)throw new Error('请先在 DSH 选择工作区。');for(const file of files){const query=new URLSearchParams({workspaceId:dshWorkspace.workspaceId,name:file.name});await request('/api/workspace-files?'+query,{method:'PUT',headers:{'Content-Type':'application/octet-stream','X-WetFlow-Run':snapshot.workflow.id},body:file})}})}
      const w=snapshot?.workflow, plan=w?.plan, stages=plan?.stages||[], pending=(snapshot?.approvals||[]).filter(a=>a.status==='PENDING')
      const runList=workspace?.runs?.filter(r=>r.projectId===workspace.activeProjectId)||[]
      const projectName=workspace?.projects?.find(p=>p.id===workspace.activeProjectId)?.name||w?.project||'未选择项目'
      const current=stages.find(s=>s.key===w?.currentStage)
      const stageName=plan?.status==='confirmed' ? (current?.label||w?.currentStage) : '流程待定'
      return h('div',{className:'wf-panel'},
        h('div',{className:'wf-heading'},h('div',{className:'wf-title'},h('span',{className:'wf-title-icon'},h(LabIcon,{size:16})),h('div',null,h('h2',null,'生物工作台'),h('p',{className:'wf-muted'},'WetFlow 研究空间')))),
        error&&h('div',{className:'wf-error',role:'alert'},error),security&&h('div',{className:'wf-security-note',role:'status'},security.status==='active'?'实验门禁已启用':'实验门禁未完全启用',h('p',null,security.message)),!snapshot&&h('p',{className:'wf-muted'},'正在连接工作台…'),
        snapshot&&h(React.Fragment,null,
          h('section',{className:'wf-project-switch'},h('div',{className:'wf-row'},h('h3',null,'项目管理'),h('button',{className:'wf-iconbtn',onClick:()=>{setEdit('project');setName('')},'aria-label':'新建项目'},'＋')),
            h(Picker,{disabled:busy,value:workspace?.activeProjectId||'',onChange:id=>{const r=workspace.runs.find(r=>r.projectId===id);if(r)void action(()=>post('/api/workflow-runs/'+encodeURIComponent(r.id)+'/activate',{}))},label:'选择项目',items:workspace?.projects||[],kind:'project',onCreate:()=>{setEdit('project');setName('')}}),
            h('div',{className:'wf-row',style:{marginTop:14}},h('h3',null,'实验运行'),h('button',{className:'wf-iconbtn',onClick:()=>{setEdit('run');setName('')},'aria-label':'新建实验运行'},'＋')),
            h(Picker,{disabled:busy,value:workspace?.activeWorkflowRunId||'',onChange:id=>void action(()=>post('/api/workflow-runs/'+encodeURIComponent(id)+'/activate',{})),label:'选择实验运行',items:runList,kind:'run',onCreate:()=>{setEdit('run');setName('')}}),
            edit&&h('div',{className:'wf-box'},h('label',null,edit==='project'?'新项目名称':'新实验运行名称',h('input',{value:name,onChange:e=>setName(e.target.value),placeholder:'输入名称',onKeyDown:e=>{if(e.key==='Enter')void create()}})),h('div',{className:'wf-actions'},h('button',{onClick:()=>void create(),disabled:busy},'创建'),h('button',{onClick:()=>setEdit('')},'取消')))),
          h('div',{className:'wf-project-heading'},h('div',{className:'wf-project-name'},projectName),h('p',{className:'wf-muted'},w.name)),
          h('section',{className:'wf-unified-section'},h('div',{className:'wf-row'},h('h3',null,'当前流程'),h('button',{className:'wf-iconbtn',onClick:()=>setFlowOpen(!flowOpen),'aria-expanded':flowOpen},flowOpen?'收起':'查看')),
            h('button',{type:'button',className:'wf-flow',onClick:()=>setFlowOpen(!flowOpen),'aria-label':'查看当前流程','aria-expanded':flowOpen},h('span',{className:'wf-flow-mark'},h('span',{className:'wf-dot'})),h('span',{className:'wf-flow-content'},h('span',{className:'wf-stage'},stageName),h('span',{className:'wf-muted'},current?.description||(pending.length?'等待研究者确认':'与 Agent 一起商讨实验阶段'))),h('span',{className:'wf-flow-arrow','aria-hidden':true},flowOpen?'⌄':'›')),
            flowOpen&&(plan?.status==='confirmed'?h('ul',{className:'wf-list'},stages.map((step,i)=>h('li',{key:step.key},h('div',null,`${i+1}. ${step.label}`,step.key===w.currentStage?'　当前':''),h('div',{className:'wf-muted'},step.description)))):h('p',{className:'wf-muted',style:{marginTop:10}},'在对话中说明目标，Agent 可提出阶段安排，确认后显示在这里。')),
            pending.map(a=>h('div',{key:a.id,className:'wf-box'},h('div',{className:'wf-row'},h('strong',null,a.title),h('span',{className:'wf-chip'},'待确认')),h('p',{className:'wf-muted wf-approval'},a.summary),h('p',{className:'wf-muted',style:{marginTop:8}},'请在 DSH 对话中的审批卡片中确认；若卡片未显示，请让 Agent 重新发起该提案的审批。')))),
          h('section',{className:'wf-unified-section'},h('div',{className:'wf-row'},h('h3',null,'工作区资料'),h('label',{htmlFor:'wf-source-file',className:'wf-import'},'＋ 导入')),h('input',{id:'wf-source-file',className:'wf-file',type:'file',multiple:true,onChange:upload}),
            !dshWorkspace?h('p',{className:'wf-muted',style:{marginTop:10}},'请先在 DSH 选择工作区，再导入资料。'):sources.length?h('ul',{className:'wf-list'},sources.map(x=>h('li',{key:x.path},h('div',null,x.name),h('div',{className:'wf-muted'},x.path)))):h('p',{className:'wf-muted',style:{marginTop:10}},'暂无资料，导入后 Agent 可按需读取。'),
            legacySources.length>0&&h('div',{style:{marginTop:14}},h('p',{className:'wf-muted'},'原证据库资料'),h('ul',{className:'wf-list'},legacySources.map(x=>h('li',{key:x.id},x.name))))),
          h('section',{className:'wf-unified-section'},h('button',{className:'wf-section-toggle','aria-expanded':researchOpen,onClick:()=>setResearchOpen(!researchOpen)},h('span',null,h('strong',null,'生物数据库'),h('span',{className:'wf-muted'},'检索并管理文献与公共数据集')),h('span',{className:'wf-toggle-arrow','aria-hidden':true},researchOpen?'⌄':'›')),
            researchOpen&&h(ResearchPanel,{runId:w.id})),
          h('section',{className:'wf-unified-section'},h('button',{className:'wf-section-toggle','aria-expanded':mdOpen,onClick:()=>setMdOpen(!mdOpen)},h('span',null,h('strong',null,'分子动力学'),h('span',{className:'wf-muted'},'运行模拟与分析结果')),h('span',{className:'wf-toggle-arrow','aria-hidden':true},mdOpen?'⌄':'›')),
            mdOpen&&h(MdPanel,{runId:w.id,workspaceId:dshWorkspace?.workspaceId,files:sources}))
        )
      )
    }

    function ResearchPanel({runId}) {
      const [query,setQuery]=useState(''),[provider,setProvider]=useState('europepmc'),[jobs,setJobs]=useState([]),[items,setItems]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false)
      const refresh=useCallback(async()=>{
        const q='?runId='+encodeURIComponent(runId)
        const [j,s]=await Promise.all([request('/api/research/jobs'+q),request('/api/research/sources'+q)])
        setJobs(j.items);setItems(s.items)
      },[runId])
      useEffect(()=>{let active=true;setJobs([]);setItems([]);setError('');const load=()=>refresh().catch(e=>{if(active)setError(e.message)});void load();const timer=setInterval(load,3500);return()=>{active=false;clearInterval(timer)}},[refresh])
      const search=async()=>{if(!query.trim())return;setBusy(true);setError('');try{await request('/api/research/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId,query:query.trim(),providers:[provider],limit:10})});await refresh()}catch(e){setError(e.message)}finally{setBusy(false)}}
      const latest=jobs[0]
      const statuses={QUEUED:'排队中',SEARCHING:'正在检索',COMPLETED:'已完成',PARTIAL:'部分完成',FAILED:'检索失败',CANCELLED:'已取消',INTERRUPTED:'已中断'}
      return h('div',{className:'wf-inline-content'},h('p',{className:'wf-muted wf-feature-description'},'检索结果保存到当前实验运行。'),
        h('div',{className:'wf-provider-group','aria-label':'选择数据库'},[['europepmc','Europe PMC'],['geo','NCBI GEO'],['arxiv','arXiv']].map(([id,label])=>h('button',{key:id,'aria-pressed':provider===id,onClick:()=>setProvider(id)},label))),
        h('label',{className:'wf-research-query'},h('span',{className:'wf-muted'},'关键词'),h('input',{value:query,onChange:e=>setQuery(e.target.value),onKeyDown:e=>{if(e.key==='Enter')void search()},placeholder:'例如 dopamine adhesive','aria-label':'检索关键词'})),h('button',{className:'wf-primary',disabled:busy||!query.trim(),onClick:()=>void search()},busy?'正在提交…':'开始检索'),
        error&&h('p',{className:'wf-error',role:'alert'},error),latest&&h('div',{className:'wf-statusline'},h('span',{className:'wf-dot'}),`${statuses[latest.status]||latest.status} · ${latest.found} 条`,latest.errors?.length>0&&h('p',{className:'wf-muted'},latest.errors.join('；'))),
        h('div',{className:'wf-row',style:{marginTop:20}},h('h3',null,'已保存来源'),h('span',{className:'wf-chip'},`${items.length} 条`)),items.length?h('ul',{className:'wf-list wf-research-list'},items.map(item=>h('li',{key:item.id},h('a',{href:item.url,target:'_blank',rel:'noopener noreferrer'},item.title),h('p',{className:'wf-muted'},[item.provider,item.year,item.documentLevel].filter(Boolean).join(' · '))))):h('p',{className:'wf-muted',style:{marginTop:10}},'暂无来源。'))
    }
    function MdPanel({runId,workspaceId,files}) {
      const [view,setView]=useState('run')
      return h('div',{className:'wf-inline-content'},
        h('div',{className:'wf-provider-group',style:{margin:'16px 0 18px'}},h('button',{'aria-pressed':view==='run',onClick:()=>setView('run')},'运行模拟'),h('button',{'aria-pressed':view==='compare',onClick:()=>setView('compare')},'分析已有结果')),
        view==='run'?h(MdRunPanel,{runId,workspaceId,files}):h(MdComparisonPanel,{runId,workspaceId,files}))
    }
    function MdRunPanel({runId,workspaceId,files}) {
      const [mode,setMode]=useState('system'),[pdb,setPdb]=useState(''),[system,setSystem]=useState(''),[platform,setPlatform]=useState('CPU'),[platforms,setPlatforms]=useState(null)
      const [steps,setSteps]=useState('1000'),[interval,setIntervalValue]=useState('100'),[temp,setTemp]=useState('300'),[stepFs,setStepFs]=useState('2'),[solvate,setSolvate]=useState(false)
      const [tasks,setTasks]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('')
      const pdbs=files.filter(x=>/\.pdb$/i.test(x.name)).map(x=>({id:x.path,name:x.name}))
      const systems=files.filter(x=>/\.xml$/i.test(x.name)).map(x=>({id:x.path,name:x.name}))
      const refresh=useCallback(async()=>{if(!workspaceId){setTasks([]);return}const q=new URLSearchParams({workspaceId,runId});const result=await request('/api/wetflow-md/tasks?'+q);setTasks(result.items)},[workspaceId,runId])
      useEffect(()=>{let live=true;setPdb('');setSystem('');setTasks([]);setError('');request('/api/wetflow-md/platforms').then(x=>{if(live){setPlatforms(x);if(x.available&&!x.platforms.includes('CPU'))setPlatform(x.platforms[0]||'CPU')}}).catch(e=>{if(live)setError(e.message)});const load=()=>refresh().catch(e=>{if(live)setError(e.message)});void load();const timer=setInterval(load,2500);return()=>{live=false;clearInterval(timer)}},[refresh])
      const start=async()=>{setBusy(true);setError('');try{await request('/api/wetflow-md/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workspaceId,runId,parameters:{pdbPath:pdb,systemPath:system,inputMode:mode,platform,steps:Number(steps),reportEvery:Number(interval),temperatureK:Number(temp),timestepFs:Number(stepFs),solvate:mode==='amber14'&&solvate}})});await refresh()}catch(e){setError(e.message)}finally{setBusy(false)}}
      const cancel=async task=>{setError('');try{await request('/api/wetflow-md/tasks/'+encodeURIComponent(task.id)+'/cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workspaceId,runId})});await refresh()}catch(e){setError(e.message)}}
      const status={queued:'等待启动',preparing:'准备体系',minimizing:'能量最小化',running:'模拟中',completed:'已完成',failed:'失败',cancelled:'已取消',cancelling:'正在取消',interrupted:'已中断'}
      return h('div',null,h('p',{className:'wf-muted wf-feature-description'},'可以上传结构与参数，也可以让 Agent 在工作区编写准备脚本、运行并导入生成的文件，再提交 OpenMM 任务。'),
        !workspaceId&&h('div',{className:'wf-box wf-muted'},'请先在 DSH 选择工作区。'),platforms&&!platforms.available&&h('div',{className:'wf-error',role:'alert'},`OpenMM 不可用：${platforms.error}`),
        h('div',{className:'wf-row'},h('h3',null,'输入方式')),h('div',{className:'wf-provider-group',style:{marginTop:8}},h('button',{'aria-pressed':mode==='system',onClick:()=>setMode('system')},'PDB + System XML'),h('button',{'aria-pressed':mode==='amber14',onClick:()=>setMode('amber14')},'Amber14 标准体系')),
        h('div',{className:'wf-row',style:{marginTop:18}},h('h3',null,'结构文件'),h('span',{className:'wf-chip'},'PDB')),h(Picker,{label:'选择结构文件',value:pdb,items:pdbs,kind:'file',onChange:setPdb}),
        mode==='system'&&h(React.Fragment,null,h('div',{className:'wf-row',style:{marginTop:16}},h('h3',null,'参数化体系'),h('span',{className:'wf-chip'},'System XML')),h(Picker,{label:'选择参数体系',value:system,items:systems,kind:'file',onChange:setSystem})),
        mode==='amber14'&&h('label',{className:'wf-solvate'},h('input',{type:'checkbox',checked:solvate,onChange:e=>setSolvate(e.target.checked)}),'添加 TIP3P 水盒'),
        h('div',{className:'wf-row',style:{marginTop:18}},h('h3',null,'计算平台'),h('span',{className:'wf-chip'},platforms?.version?`OpenMM ${platforms.version}`:'')),h(Picker,{label:'选择计算平台',value:platform,items:(platforms?.platforms||['CPU']).map(x=>({id:x,name:x})),kind:'platform',onChange:setPlatform}),
        h('div',{className:'wf-md-inputs'},h('label',null,h('span',{className:'wf-muted'},'温度 (K)'),h('input',{type:'number',value:temp,onChange:e=>setTemp(e.target.value),'aria-label':'温度 K'})),h('label',null,h('span',{className:'wf-muted'},'时间步长 (fs)'),h('input',{type:'number',step:'any',value:stepFs,onChange:e=>setStepFs(e.target.value),'aria-label':'时间步长 fs'})),h('label',null,h('span',{className:'wf-muted'},'模拟步数'),h('input',{type:'number',step:'1',value:steps,onChange:e=>setSteps(e.target.value),'aria-label':'模拟步数'})),h('label',null,h('span',{className:'wf-muted'},'输出间隔 (步)'),h('input',{type:'number',step:'1',value:interval,onChange:e=>setIntervalValue(e.target.value),'aria-label':'输出间隔'}))),
        h('button',{className:'wf-primary',disabled:busy||!workspaceId||!pdb||(mode==='system'&&!system)||platforms?.available===false,onClick:()=>void start()},busy?'正在提交…':'开始模拟'),error&&h('p',{className:'wf-error',role:'alert'},error),
        h('div',{className:'wf-row',style:{marginTop:22}},h('h3',null,'模拟任务'),h('span',{className:'wf-chip'},`${tasks.length} 项`)),tasks.length?h('ul',{className:'wf-list wf-task-list'},tasks.map(task=>h('li',{key:task.id},h('div',{className:'wf-row'},h('strong',null,task.inputPdb),h('span',{className:'wf-chip'},status[task.status]||task.status)),h('p',{className:'wf-muted'},`${task.settings.platform} · ${task.stepsDone||0} / ${task.stepsTotal} 步`),task.error&&h('p',{className:'wf-error'},task.error),task.status==='completed'&&h('p',{className:'wf-muted'},`结果目录：${task.outputDirectory}（轨迹、结构、状态及参数）`),['queued','preparing','minimizing','running'].includes(task.status)&&h('button',{className:'wf-back',onClick:()=>void cancel(task)},'取消任务')))):h('p',{className:'wf-muted',style:{marginTop:10}},'还没有模拟任务。'))
    }
    function MdComparisonPanel({runId,workspaceId,files}) {
      const reports=[{id:'example',name:'PMA–DA 示例报告'},...files.filter(file=>/\.json$/i.test(file.name)).map(file=>({id:file.path,name:file.name}))]
      const [report,setReport]=useState('example'),[baseline,setBaseline]=useState('1.00'),[comparison,setComparison]=useState('1.25'),[result,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
      useEffect(()=>{setReport('example');setResult(null);setError('')},[runId,workspaceId])
      const compare=async()=>{setBusy(true);setError('');try{const value=await request('/api/wetflow-md/compare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId,workspaceId,reportPath:report,baselineFeed:Number(baseline),comparisonFeed:Number(comparison)})});setResult(value)}catch(e){setResult(null);setError(e.message)}finally{setBusy(false)}}
      return h('div',null,h('p',{className:'wf-muted wf-feature-description'},'比较已保存的 PMA–DA 接触汇总报告。'),
        h('div',{className:'wf-row'},h('h3',null,'报告'),h('span',{className:'wf-chip'},'JSON')),h(Picker,{label:'选择 MD 报告',value:report,items:reports,kind:'report',onChange:id=>{setReport(id);setResult(null)}}),
        h('div',{className:'wf-md-inputs'},h('label',null,h('span',{className:'wf-muted'},'基准投料比'),h('input',{type:'number',step:'any',min:0,value:baseline,onChange:e=>setBaseline(e.target.value),'aria-label':'基准投料比'})),h('label',null,h('span',{className:'wf-muted'},'比较投料比'),h('input',{type:'number',step:'any',min:0,value:comparison,onChange:e=>setComparison(e.target.value),'aria-label':'比较投料比'}))),
        h('button',{className:'wf-primary',disabled:busy||!baseline||!comparison,onClick:()=>void compare()},busy?'正在分析…':'比较结果'),error&&h('p',{className:'wf-error',role:'alert'},error),
        result&&h('div',{className:'wf-md-result'},h('div',{className:'wf-row'},h('strong',null,'有效接触比例'),h('span',{className:'wf-chip'},result.source==='example'?'示例报告':'工作区报告')),h('div',{className:'wf-md-numbers'},h('div',null,h('span',{className:'wf-muted'},`投料比 ${result.baseline.feed}`),h('strong',null,`${result.baseline.compatibleFractionPercent}%`)),h('div',null,h('span',{className:'wf-muted'},`投料比 ${result.comparison.feed}`),h('strong',null,`${result.comparison.compatibleFractionPercent}%`))),h('p',{className:'wf-muted'},`差值 ${result.fractionChangePercentagePoints} 个百分点 · 假定活化率 ${result.activationFractionAssumption*100}% · 时间窗口 ${result.windowPs[0]}–${result.windowPs[1]} ps`)),
        h('p',{className:'wf-muted',style:{marginTop:14}},'此功能读取已有汇总结果，不会启动新的分子动力学模拟。'))
    }
    function apply(ctx) {
      ctx.effect(()=>{const node=document.createElement('style');node.textContent=css;document.head.appendChild(node);return()=>node.remove()},'WetFlow sidebar style')
      let opened = true
      const listeners = new Set()
      const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener) }
      const snapshot = () => opened
      const setOpen = value => { if (opened === value) return; opened = value; for (const listener of listeners) listener() }
      function Launcher({wide}) {
        const visible = useSyncExternalStore(subscribe, snapshot, snapshot)
        const button=useRef(null)
        useLayoutEffect(()=>{
          const el=button.current
          const root=el?.parentElement?.parentElement?.parentElement?.parentElement
          const nav=root?.querySelector('nav')
          if(!el||!nav)return
          const oldPadding=nav.style.paddingBottom
          const initialPadding=parseFloat(getComputedStyle(nav).paddingBottom)||0
          nav.style.paddingBottom=`${initialPadding+40}px`
          const place=()=>{const r=nav.getBoundingClientRect();el.style.position='fixed';el.style.left=`${r.left}px`;el.style.top=`${r.bottom-initialPadding-36}px`;el.style.width=`${r.width}px`;el.style.zIndex='20'}
          const observer=new ResizeObserver(place);observer.observe(nav);window.addEventListener('resize',place);place()
          return()=>{observer.disconnect();window.removeEventListener('resize',place);nav.style.paddingBottom=oldPadding;el.style.position='';el.style.left='';el.style.top='';el.style.width='';el.style.zIndex=''}
        },[wide])
        return h('button',{ref:button,className:'wf-launcher'+(wide?'':' wf-launcher--collapsed'),title:'生物工作台','aria-label':'生物工作台','aria-expanded':visible,onClick:()=>setOpen(!visible)},h(LabIcon,{size:16}),wide&&h('span',null,'生物工作台'))
      }
      function Dock() {
        const visible = useSyncExternalStore(subscribe, snapshot, snapshot)
        const dock = useRef(null)
        useLayoutEffect(()=>{
          if (!visible || !dock.current) return
          const layer=dock.current.closest('[data-shell-overlay]')
          const frame=layer?.parentElement
          const sidebar=frame?.children[0], center=frame?.children[1]
          if (!(sidebar instanceof HTMLElement) || !(center instanceof HTMLElement)) return
          const oldPadding=center.style.paddingLeft, oldBox=center.style.boxSizing
          const place=()=>{
            if (!dock.current || !frame.isConnected) return
            const left=sidebar.getBoundingClientRect().right-frame.getBoundingClientRect().left
            const width=Math.min(292,Math.max(220,center.getBoundingClientRect().width-300))
            dock.current.style.left=`${left}px`;dock.current.style.width=`${width}px`
            center.style.boxSizing='border-box';center.style.paddingLeft=`${width}px`
          }
          const observer=new ResizeObserver(place);observer.observe(frame);observer.observe(sidebar);observer.observe(center)
          window.addEventListener('resize',place);place()
          return()=>{observer.disconnect();window.removeEventListener('resize',place);center.style.paddingLeft=oldPadding;center.style.boxSizing=oldBox}
        },[visible])
        if (!visible) return null
        return h('aside',{className:'wf-left-dock',ref:dock,'aria-label':'生物工作台侧栏'},
          h('button',{className:'wf-dock-close',onClick:()=>setOpen(false),'aria-label':'收起生物工作台',title:'收起'},'×'),h(Workbench,{ctx}))
      }
      ctx.effect(()=>ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'wetflow-dock'},Dock)),'WetFlow left dock')
      ctx.effect(()=>ctx.slots.inject('sidebar.footer.action',()=>ctx.slots.register({name:'sidebar.footer.action',id:'wetflow-launcher',order:5},Launcher)),'WetFlow left launcher')
      // Remove this plugin's obsolete right-side tab, leaving other tabs intact.
      ctx.effect(()=>{
        let timer
        const sync=()=>{
          const active=ctx.sidebarRight.mounted.getSnapshot()
          if (!active) return
          clearTimeout(timer)
          timer=setTimeout(()=>{try{const tab=ctx.sidebarRight.active();if(tab?.kind===TAB_KIND){ctx.sidebarRight.close(tab.id);const next=ctx.sidebarRight.active();if((!next||next.kind==='guide')&&ctx.sidebarRight.isExpanded())ctx.sidebarRight.toggleExpanded()}}catch{}},100)
        }
        const stop=ctx.sidebarRight.mounted.subscribe(sync);sync()
        return()=>{clearTimeout(timer);stop()}
      },'Remove old WetFlow right tab')
    }
    return { inject:['slots','sidebarRight','uiSession','workspaces'], apply }
  },
})
