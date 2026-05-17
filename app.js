
const STORAGE_KEY = 'mafia_ultra_ai_state_v1';

const state = {
  phase: 'day',
  players: [],
  edges: [],
  selectedNodeId: null,
  speechText: '',
  dialogueText: '',
  onlineMode: navigator.onLine ? 'online' : 'offline'
};

const graph = document.getElementById('graph');
const svgNS = 'http://www.w3.org/2000/svg';

function createSvgEl(tag){
  return document.createElementNS(svgNS, tag);
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw) return;
  try{
    const loaded = JSON.parse(raw);
    Object.assign(state, loaded);
  }catch(err){}
}

function toast(msg){
  const wrap = document.getElementById('toast');
  wrap.innerHTML = `<div class="bubble show">${msg}</div>`;
  setTimeout(()=>{ wrap.innerHTML = ''; }, 2200);
}

function updateNetStatus(){
  const el = document.getElementById('netStatus');
  if(navigator.onLine){
    el.textContent = '🟢 Online';
  }else{
    el.textContent = '🔴 Offline';
  }
}

window.addEventListener('online', ()=>{ updateNetStatus(); state.onlineMode='online'; });
window.addEventListener('offline', ()=>{ updateNetStatus(); state.onlineMode='offline'; });

function phaseLabel(){
  return state.phase === 'day' ? 'روز' : 'شب';
}

function playerColorBySuspicion(score){
  if(score >= 70) return '#ef4444';
  if(score >= 40) return '#f59e0b';
  return '#22c55e';
}

function edgeColorByType(type){
  switch(type){
    case 'attack': return '#ef4444';
    case 'support': return '#22c55e';
    case 'suspect': return '#8b5cf6';
    case 'vote': return '#f59e0b';
    default: return '#60a5fa';
  }
}

function edgeLabel(type){
  switch(type){
    case 'attack': return 'حمله';
    case 'support': return 'حمایت';
    case 'suspect': return 'شک';
    case 'vote': return 'رأی';
    default: return type;
  }
}

function recalcSuspicion(){
  state.players.forEach(p => {
    let incomingAttack = 0;
    let incomingSupport = 0;
    let incomingSuspect = 0;
    let incomingVote = 0;

    state.edges.forEach(e => {
      if(e.to === p.id){
        if(e.type === 'attack') incomingAttack++;
        if(e.type === 'support') incomingSupport++;
        if(e.type === 'suspect') incomingSuspect++;
        if(e.type === 'vote') incomingVote++;
      }
    });

    let base = 20;
    base += incomingAttack * 18;
    base += incomingSuspect * 10;
    base += incomingVote * 8;
    base -= incomingSupport * 12;

    if(state.phase === 'night') base += 5;
    p.suspicion = Math.max(0, Math.min(100, base));
  });
}

function renderPlayers(){
  const list = document.getElementById('playersList');
  const filter = (document.getElementById('filter')?.value || '').trim().toLowerCase();
  const sortBy = document.getElementById('sortBy')?.value || 'score_desc';

  let arr = [...state.players];

  if(filter){
    arr = arr.filter(p =>
      p.name.toLowerCase().includes(filter) ||
      p.role.toLowerCase().includes(filter) ||
      (p.note || '').toLowerCase().includes(filter)
    );
  }

  arr.sort((a,b)=>{
    if(sortBy === 'score_desc') return b.suspicion - a.suspicion;
    if(sortBy === 'score_asc') return a.suspicion - b.suspicion;
    if(sortBy === 'name_asc') return a.name.localeCompare(b.name, 'fa');
    if(sortBy === 'name_desc') return b.name.localeCompare(a.name, 'fa');
    if(sortBy === 'alive_first') return (b.alive === true) - (a.alive === true);
    return 0;
  });

  list.innerHTML = '';
  arr.forEach(p => {
    const card = document.createElement('div');
    const scoreClass = p.suspicion >= 70 ? 'score-high' : (p.suspicion >= 40 ? 'score-mid' : 'score-low');
    card.className = 'player-card';

    card.innerHTML = `
      <div class="player-left">
        <div class="player-name">${escapeHtml(p.name)}</div>
        <div class="player-meta">
          <span class="role-badge">🎭 ${escapeHtml(p.role)}</span>
          <span class="phase-badge">⏳ ${phaseLabel()}</span>
          <span class="phase-badge">${p.alive ? '🟢 زنده' : '⚫ حذف‌شده'}</span>
        </div>
        <div class="player-meta">${escapeHtml(p.note || 'بدون یادداشت')}</div>
        <div class="player-actions">
          <button class="btn btn-green" data-act="alive" data-id="${p.id}">${p.alive ? 'Alive' : 'Revive'}</button>
          <button class="btn btn-red" data-act="dead" data-id="${p.id}">حذف</button>
          <button class="btn btn-purple" data-act="edit" data-id="${p.id}">ویرایش</button>
        </div>
      </div>
      <div class="player-score ${scoreClass}">${p.suspicion}% شک</div>
    `;
    list.appendChild(card);
  });

  document.getElementById('playersCount').textContent = state.players.length;
  document.getElementById('topSuspect').textContent = state.players.length
    ? [...state.players].sort((a,b)=>b.suspicion-a.suspicion)[0].name
    : '—';
}

function renderSelectors(){
  const selects = ['fromPlayer','toPlayer','cSpeaker','cTarget'];
  for(const id of selects){
    const el = document.getElementById(id);
    if(!el) continue;
    const prev = el.value;
    el.innerHTML = '<option value="">انتخاب بازیکن</option>';
    state.players.forEach(p=>{
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      el.appendChild(opt);
    });
    el.value = prev || '';
  }
}

function renderAnalysis(){
  recalcSuspicion();
  const box = document.getElementById('analysisBox');
  const sorted = [...state.players].sort((a,b)=>b.suspicion-a.suspicion);
  const top = sorted[0];
  const online = navigator.onLine;

  const lines = [];
  lines.push(`فاز فعلی: ${phaseLabel()} · وضعیت: ${online ? 'آنلاین' : 'آفلاین'}`);
  if(top){
    lines.push(`بالاترین مظنون: ${top.name} با ${top.suspicion}% شک.`);
  }
  if(state.edges.length){
    const counts = state.edges.reduce((acc,e)=>{ acc[e.type]=(acc[e.type]||0)+1; return acc; }, {});
    lines.push(`تارگت‌ها: ${state.edges.length} · حمله ${counts.attack||0} · حمایت ${counts.support||0} · شک ${counts.suspect||0} · رأی ${counts.vote||0}.`);
  }
  if(top && top.suspicion >= 70){
    lines.push(`الگو نشان می‌دهد ${top.name} زیر فشار شدید قرار دارد؛ این‌جا باید reaction، دفاع و زمان رأی‌گیری او را دقیق‌تر دید.`);
  }else{
    lines.push('هنوز الگوی قطعی برای فشار نهایی دیده نشده؛ روی timeline و edge history تمرکز کن.');
  }

  const contradictions = [];
  state.players.forEach(p=>{
    if((p.note||'').includes('تناقض')) contradictions.push(`• ${p.name}: در یادداشت، تناقض ثبت شده.`);
    if((p.note||'').includes('دروغ')) contradictions.push(`• ${p.name}: کلمه‌ی «دروغ» در یادداشت دیده شده.`);
  });

  document.getElementById('contradictionsCount').textContent = contradictions.length;
  document.getElementById('contradictionsBox').innerHTML = contradictions.length ? contradictions.join('<br>') : 'هنوز تناقضی ثبت نشده است.';
  box.innerHTML = lines.join('<br><br>');
  document.getElementById('edgesCount').textContent = state.edges.length;
}

function renderSpeech(){
  document.getElementById('speechBox').textContent = state.speechText || 'هنوز چیزی ثبت نشده';
}

function renderDialogue(){
  document.getElementById('dialogueBox').textContent = state.dialogueText || 'هنوز دیالوگی ساخته نشده';
}

function renderPhaseUI(){
  document.getElementById('gamePhase').value = state.phase === 'day' ? 'روز' : 'شب';
}

function addPlayer(){
  const name = document.getElementById('playerName').value.trim();
  const role = document.getElementById('playerRole').value;
  const phase = document.getElementById('gameMode').value;

  if(!name){
    toast('اسم بازیکن را وارد کن.');
    return;
  }
  if(state.players.some(p => p.name === name)){
    toast('این بازیکن قبلاً اضافه شده.');
    return;
  }
  if(state.players.length >= 12){
    toast('حداکثر ۱۲ بازیکن.');
    return;
  }

  const player = {
    id: 'p-' + Date.now() + '-' + Math.floor(Math.random()*1000),
    name,
    role,
    note: '',
    phase,
    alive: true,
    suspicion: 20
  };
  state.players.push(player);
  recalcSuspicion();
  renderAll();
  saveState();
  toast(`بازیکن ${name} اضافه شد.`);
  document.getElementById('playerName').value = '';
}

function editPlayer(id){
  const p = state.players.find(x=>x.id===id);
  if(!p) return;
  const newName = prompt('اسم جدید', p.name);
  if(newName && newName.trim()) p.name = newName.trim();
  const newRole = prompt('نقش جدید', p.role);
  if(newRole && newRole.trim()) p.role = newRole.trim();
  const newNote = prompt('یادداشت/رفتار', p.note || '');
  if(newNote !== null) p.note = newNote;
  recalcSuspicion();
  renderAll();
  saveState();
  toast('بازیکن ویرایش شد.');
}

function setAlive(id, alive){
  const p = state.players.find(x=>x.id===id);
  if(!p) return;
  p.alive = alive;
  renderAll();
  saveState();
}

function connectPlayers(){
  const from = document.getElementById('fromPlayer').value;
  const to = document.getElementById('toPlayer').value;
  const type = document.getElementById('edgeType').value;

  if(!from || !to || from === to){
    toast('از/به را درست انتخاب کن.');
    return;
  }

  const colors = {
    attack: '#ef4444',
    support: '#22c55e',
    suspect: '#8b5cf6',
    vote: '#f59e0b'
  };

  state.edges.push({
    id: 'e-' + Date.now() + '-' + Math.floor(Math.random()*1000),
    from,
    to,
    type,
    weight: Math.floor(40 + Math.random()*60),
    color: colors[type] || '#60a5fa'
  });

  recalcSuspicion();
  renderAll();
  saveState();
  toast('تارگت ثبت شد.');
}

function clearEdges(){
  state.edges = [];
  recalcSuspicion();
  renderAll();
  saveState();
  toast('همه خطوط پاک شد.');
}

function generateDialogue(){
  const packs = [
    ...dialogues.default,
    ...(state.phase === 'day' ? dialogues.day : dialogues.night)
  ];

  const top = [...state.players].sort((a,b)=>b.suspicion-a.suspicion)[0];
  let text = packs[Math.floor(Math.random()*packs.length)];

  if(top){
    text += `\n\nتحلیل روی میز: ${top.name} با ${top.suspicion}% شک در مرکز توجه قرار دارد.`;
  }

  if(state.phase === 'night' && state.players.length){
    const nightPack = dialogues.night[Math.floor(Math.random()*dialogues.night.length)];
    text += `\n\nفاز شب: ${nightPack}`;
  }

  if(state.onlineMode === 'online'){
    text += `\n\nحالت آنلاین فعال است؛ می‌توانی بعداً موتور AI واقعی را وصل کنی.`;
  }

  state.dialogueText = text;
  renderDialogue();
  saveState();
  toast('دیالوگ ساخته شد.');
}

function startSpeech(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){
    toast('SpeechRecognition پشتیبانی نمی‌شود.');
    return;
  }

  const rec = new SR();
  rec.lang = 'fa-IR';
  rec.continuous = false;
  rec.interimResults = false;

  rec.onresult = (e)=>{
    const text = e.results[0][0].transcript;
    state.speechText = text;
    renderSpeech();
    analyzeTranscript(text);
    saveState();
  };

  rec.onerror = ()=>{
    toast('خطا در میکروفون.');
  };

  rec.start();
  toast('شنود شروع شد.');
}

function stopSpeech(){
  state.speechText = '⛔ ضبط متوقف شد';
  renderSpeech();
  saveState();
  toast('ضبط متوقف شد.');
}

function analyzeTranscript(text){
  const lower = text.toLowerCase();
  const suspicionHits = [];
  state.players.forEach(p=>{
    if(lower.includes(p.name.toLowerCase())){
      p.suspicion = Math.min(100, p.suspicion + 8);
      suspicionHits.push(p.name);
    }
  });

  if(lower.includes('تناقض') || lower.includes('دروغ')){
    state.players.forEach(p=>{
      p.suspicion = Math.min(100, p.suspicion + 2);
    });
  }

  if(suspicionHits.length){
    toast(`اسامی در گفتار: ${suspicionHits.join('، ')}`);
  }

  recalcSuspicion();
  renderAll();
}

function togglePhase(){
  state.phase = state.phase === 'day' ? 'night' : 'day';
  renderAll();
  saveState();
  toast(`فاز ${phaseLabel()} شد.`);
}

function exportJSON(){
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mafia-ultra-state.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importJSONFile(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(reader.result);
      state.players = data.players || [];
      state.edges = data.edges || [];
      state.phase = data.phase || 'day';
      state.speechText = data.speechText || '';
      state.dialogueText = data.dialogueText || '';
      state.onlineMode = data.onlineMode || (navigator.onLine ? 'online' : 'offline');
      recalcSuspicion();
      renderAll();
      saveState();
      toast('فایل JSON وارد شد.');
    }catch(e){
      toast('JSON نامعتبر است.');
    }
  };
  reader.readAsText(file);
}

function renderGraph(){
  while(graph.firstChild) graph.removeChild(graph.firstChild);

  const defs = createSvgEl('defs');
  graph.appendChild(defs);

  const marker = (id, color) => {
    const m = createSvgEl('marker');
    m.setAttribute('id', id);
    m.setAttribute('viewBox', '0 0 10 10');
    m.setAttribute('refX', '8');
    m.setAttribute('refY', '5');
    m.setAttribute('markerWidth', '7');
    m.setAttribute('markerHeight', '7');
    m.setAttribute('orient', 'auto-start-reverse');
    const path = createSvgEl('path');
    path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    path.setAttribute('fill', color);
    m.appendChild(path);
    defs.appendChild(m);
  };

  marker('arrow-attack', '#ef4444');
  marker('arrow-support', '#22c55e');
  marker('arrow-suspect', '#8b5cf6');
  marker('arrow-vote', '#f59e0b');

  // edges
  state.edges.forEach(edge=>{
    const from = state.players.find(p=>p.id === edge.from);
    const to = state.players.find(p=>p.id === edge.to);
    if(!from || !to) return;

    const line = createSvgEl('path');
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    const startX = from.x + nx * 44;
    const startY = from.y + ny * 44;
    const endX = to.x - nx * 44;
    const endY = to.y - ny * 44;

    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    const bend = 0.15 * dist;
    const cx = midX - ny * bend;
    const cy = midY + nx * bend;

    line.setAttribute('d', `M ${startX} ${startY} Q ${cx} ${cy} ${endX} ${endY}`);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', edge.color);
    line.setAttribute('stroke-width', Math.max(3, Math.min(12, edge.weight / 10)));
    line.setAttribute('marker-end', `url(#arrow-${edge.type})`);
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('opacity', '0.95');
    graph.appendChild(line);

    const label = createSvgEl('text');
    label.textContent = edgeLabel(edge.type);
    label.setAttribute('x', cx);
    label.setAttribute('y', cy - 7);
    label.setAttribute('fill', edge.color);
    label.setAttribute('font-size', '12');
    label.setAttribute('font-weight', '800');
    label.setAttribute('text-anchor', 'middle');
    graph.appendChild(label);
  });

  // nodes
  state.players.forEach(p=>{
    const group = createSvgEl('g');
    group.setAttribute('class', 'graph-node');
    group.setAttribute('data-id', p.id);
    group.style.cursor = 'grab';

    const circle = createSvgEl('circle');
    circle.setAttribute('cx', p.x);
    circle.setAttribute('cy', p.y);
    circle.setAttribute('r', 40);
    circle.setAttribute('fill', p.alive ? playerColorBySuspicion(p.suspicion) : '#64748b');
    circle.setAttribute('stroke', p.id === state.selectedNodeId ? '#ffffff' : 'rgba(255,255,255,.75)');
    circle.setAttribute('stroke-width', p.id === state.selectedNodeId ? '6' : '2');
    circle.setAttribute('filter', 'url(#softGlow)');

    const glow = createSvgEl('circle');
    glow.setAttribute('cx', p.x);
    glow.setAttribute('cy', p.y);
    glow.setAttribute('r', 46);
    glow.setAttribute('fill', 'transparent');
    glow.setAttribute('stroke', p.alive ? playerColorBySuspicion(p.suspicion) : '#64748b');
    glow.setAttribute('stroke-opacity', '0.18');
    glow.setAttribute('stroke-width', '14');

    const text = createSvgEl('text');
    text.setAttribute('x', p.x);
    text.setAttribute('y', p.y - 2);
    text.setAttribute('fill', '#fff');
    text.setAttribute('font-size', '16');
    text.setAttribute('font-weight', '900');
    text.setAttribute('text-anchor', 'middle');
    text.textContent = p.name;

    const sub = createSvgEl('text');
    sub.setAttribute('x', p.x);
    sub.setAttribute('y', p.y + 18);
    sub.setAttribute('fill', '#fff');
    sub.setAttribute('font-size', '11');
    sub.setAttribute('text-anchor', 'middle');
    sub.textContent = `${p.suspicion}%`;

    group.appendChild(glow);
    group.appendChild(circle);
    group.appendChild(text);
    group.appendChild(sub);
    group.setAttribute('tabindex', '0');

    group.addEventListener('pointerdown', (ev)=>onNodePointerDown(ev, p.id));
    group.addEventListener('click', ()=>onNodeClick(p.id));

    graph.appendChild(group);
  });

  const softGlow = createSvgEl('filter');
  softGlow.setAttribute('id', 'softGlow');
  const blur = createSvgEl('feGaussianBlur');
  blur.setAttribute('stdDeviation', '4');
  softGlow.appendChild(blur);
  defs.appendChild(softGlow);
}

let dragInfo = null;

function getGraphPoint(evt){
  const svgRect = graph.getBoundingClientRect();
  const viewBox = graph.viewBox.baseVal;
  const scaleX = viewBox.width / svgRect.width;
  const scaleY = viewBox.height / svgRect.height;
  return {
    x: (evt.clientX - svgRect.left) * scaleX,
    y: (evt.clientY - svgRect.top) * scaleY
  };
}

function onNodePointerDown(evt, id){
  const node = state.players.find(p=>p.id===id);
  if(!node) return;

  graph.setPointerCapture?.(evt.pointerId);
  dragInfo = {
    id,
    offsetX: node.x - getGraphPoint(evt).x,
    offsetY: node.y - getGraphPoint(evt).y
  };

  const move = e=>{
    if(!dragInfo) return;
    const p = getGraphPoint(e);
    node.x = Math.max(70, Math.min(830, p.x + dragInfo.offsetX));
    node.y = Math.max(70, Math.min(550, p.y + dragInfo.offsetY));
    renderGraph();
  };

  const up = ()=>{
    dragInfo = null;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    saveState();
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once:true });
}

function onNodeClick(id){
  if(!state.selectedNodeId){
    state.selectedNodeId = id;
    renderGraph();
    toast('نود اول انتخاب شد. حالا نود دوم را بزن.');
  }else if(state.selectedNodeId === id){
    state.selectedNodeId = null;
    renderGraph();
  }else{
    document.getElementById('fromPlayer').value = state.selectedNodeId;
    document.getElementById('toPlayer').value = id;
    state.selectedNodeId = null;
    renderGraph();
    toast('بازیکن‌ها برای اتصال آماده شدند.');
  }
}

function renderAll(){
  renderPhaseUI();
  renderPlayers();
  renderSelectors();
  renderAnalysis();
  renderSpeech();
  renderDialogue();
  renderGraph();
  updateNetStatus();
}

function escapeHtml(str){
  return String(str)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

function initPositions(){
  if(state.players.some(p=>typeof p.x === 'number' && typeof p.y === 'number')) return;

  const positions = [
    [190,120],[420,120],[650,110],[770,260],
    [660,430],[430,500],[220,430],[110,260],
    [320,260],[560,260],[240,330],[520,360]
  ];

  state.players.forEach((p, idx)=>{
    const pos = positions[idx % positions.length];
    p.x = pos[0];
    p.y = pos[1];
  });
}

document.getElementById('btnAddPlayer').addEventListener('click', addPlayer);
document.getElementById('btnConnect').addEventListener('click', connectPlayers);
document.getElementById('btnClearEdges').addEventListener('click', clearEdges);
document.getElementById('btnGenerateDialogue').addEventListener('click', generateDialogue);
document.getElementById('btnStartSpeech').addEventListener('click', startSpeech);
document.getElementById('btnStopSpeech').addEventListener('click', stopSpeech);
document.getElementById('btnExport').addEventListener('click', exportJSON);

document.getElementById('gamePhase').addEventListener('change', (e)=>{
  state.phase = e.target.value === 'شب' ? 'night' : 'day';
  recalcSuspicion();
  renderAll();
  saveState();
});

document.getElementById('sortBy').addEventListener('change', renderAll);
document.getElementById('filter').addEventListener('input', renderAll);

document.getElementById('playersList').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-act]');
  if(!btn) return;
  const {act,id} = btn.dataset;
  if(act === 'edit') editPlayer(id);
  if(act === 'alive') setAlive(id, true);
  if(act === 'dead') setAlive(id, false);
  recalcSuspicion();
  renderAll();
  saveState();
});

document.addEventListener('change', (e)=>{
  if(e.target?.id === 'pImage'){
    const f = e.target.files?.[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = ()=> {
      state.speechText = 'عکس بازیکن بارگذاری شد.';
      toast('عکس انتخاب شد.');
    };
    reader.readAsDataURL(f);
  }
});

window.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape'){
    state.selectedNodeId = null;
    renderGraph();
  }
});

loadState();
if(!state.players.length){
  state.players = [
    {id:'p1', name:'امیر', role:'شهروند', note:'', phase:'day', alive:true, suspicion:20, x:190, y:120},
    {id:'p2', name:'رضا', role:'مافیا', note:'', phase:'day', alive:true, suspicion:56, x:420, y:120},
    {id:'p3', name:'محمد', role:'گادفادر', note:'', phase:'day', alive:true, suspicion:89, x:650, y:110}
  ];
}
initPositions();
recalcSuspicion();
renderAll();

setInterval(saveState, 15000);
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
