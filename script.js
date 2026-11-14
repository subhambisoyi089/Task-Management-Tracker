// ─────────────────────────────────────────
//  PARTICLES
// ─────────────────────────────────────────
(function() {
  const canvas = document.getElementById('particles-canvas');
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  resize();
  window.addEventListener('resize', resize);

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * W;
      this.y = Math.random() * H;
      this.r = Math.random() * 1.5 + 0.3;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = (Math.random() - 0.5) * 0.3;
      this.alpha = Math.random() * 0.5 + 0.1;
      const colors = ['rgba(124,58,237,', 'rgba(6,182,212,', 'rgba(245,158,11,'];
      this.color = colors[Math.floor(Math.random() * colors.length)];
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = this.color + this.alpha + ')';
      ctx.fill();
    }
  }

  for (let i = 0; i < 120; i++) particles.push(new Particle());

  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 80) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(124,58,237,${0.08 * (1 - dist/80)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    drawConnections();
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(loop);
  }

  loop();
})();

// ─────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────
let tasks = JSON.parse(localStorage.getItem('tm_tasks') || '[]');
let alarms = JSON.parse(localStorage.getItem('tm_alarms') || '[]');
let ttEvents = JSON.parse(localStorage.getItem('tm_ttEvents') || '[]');
let editingTaskId = null;
let currentFilter = 'all';
let currentCat = 'all';
let currentSubtasks = [];
let ttSelectedColor = 'purple';
let ttCellDay = null, ttCellTime = null;
let ringingAlarmId = null;
let snoozeTimeout = null;

function save() {
  localStorage.setItem('tm_tasks', JSON.stringify(tasks));
  localStorage.setItem('tm_alarms', JSON.stringify(alarms));
  localStorage.setItem('tm_ttEvents', JSON.stringify(ttEvents));
}

// ─────────────────────────────────────────
//  CLOCK
// ─────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  const s = String(now.getSeconds()).padStart(2,'0');
  document.getElementById('liveClock').textContent = `${h}:${m}:${s}`;

  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  document.getElementById('liveDate').textContent =
    `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

  // Welcome message
  const hr = now.getHours();
  let msg, emoji;
  if (hr < 12) { msg = 'Good Morning!'; emoji = '☀️'; }
  else if (hr < 17) { msg = 'Good Afternoon!'; emoji = '🌤️'; }
  else if (hr < 21) { msg = 'Good Evening!'; emoji = '🌇'; }
  else { msg = 'Good Night!'; emoji = '🌙'; }
  const el = document.getElementById('welcomeMsg');
  if (el) el.textContent = `${msg}`;
  const el2 = document.getElementById('welcomeEmoji');
  if (el2) el2.textContent = emoji;

  checkAlarms(now);
}

setInterval(updateClock, 1000);
updateClock();

// ─────────────────────────────────────────
//  VIEWS
// ─────────────────────────────────────────
const viewTitles = {
  dashboard: ['Dashboard', 'Overview of your tasks & schedules'],
  tasks: ['All Tasks', 'Manage and track your tasks'],
  timetable: ['Timetable', 'Weekly schedule planner'],
  alarms: ['Alarms', 'Manage your reminders & alarms']
};

function switchView(name, navEl) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const view = document.getElementById('view-' + name);
  if (view) view.classList.add('active');
  if (navEl) navEl.classList.add('active');
  const [title, sub] = viewTitles[name] || ['', ''];
  document.getElementById('pageTitle').textContent = title;
  document.getElementById('pageSubtitle').textContent = sub;
  renderAll();
}

// ─────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────
function toast(title, msg, type = 'default') {
  const icons = { success: 'fa-circle-check', warning: 'fa-triangle-exclamation', danger: 'fa-circle-xmark', default: 'fa-bell', 'alarm-toast': 'fa-bell' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.default} toast-icon"></i>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${msg}</div>
    </div>
    <button class="toast-close" onclick="this.closest('.toast').remove()"><i class="fa-solid fa-xmark"></i></button>
  `;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => { el.classList.add('toast-out'); setTimeout(() => el.remove(), 300); }, 3000);
}

// ─────────────────────────────────────────
//  MODAL
// ─────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// ─────────────────────────────────────────
//  TASKS
// ─────────────────────────────────────────
function openTaskModal(id = null) {
  editingTaskId = id;
  currentSubtasks = [];
  const modal = document.getElementById('taskModal');
  document.getElementById('taskModalTitle').textContent = id ? '✏️ Edit Task' : '✨ Add New Task';

  if (id) {
    const t = tasks.find(t => t.id === id);
    document.getElementById('taskTitleInput').value = t.title;
    document.getElementById('taskDescInput').value = t.desc || '';
    document.getElementById('taskPriorityInput').value = t.priority;
    document.getElementById('taskCategoryInput').value = t.category;
    document.getElementById('taskDateInput').value = t.date || '';
    document.getElementById('taskTimeInput').value = t.time || '';
    document.getElementById('taskAlarmInput').value = t.alarm || '';
    if (t.alarm) document.getElementById('taskAlarmToggle').classList.add('on');
    else document.getElementById('taskAlarmToggle').classList.remove('on');
    currentSubtasks = t.subtasks ? [...t.subtasks] : [];
  } else {
    document.getElementById('taskTitleInput').value = '';
    document.getElementById('taskDescInput').value = '';
    document.getElementById('taskPriorityInput').value = 'medium';
    document.getElementById('taskCategoryInput').value = 'work';
    document.getElementById('taskDateInput').value = '';
    document.getElementById('taskTimeInput').value = '';
    document.getElementById('taskAlarmInput').value = '';
    document.getElementById('taskAlarmToggle').classList.remove('on');
  }
  renderSubtaskList();
  openModal('taskModal');
  setTimeout(() => document.getElementById('taskTitleInput').focus(), 300);
}

function saveTask() {
  const title = document.getElementById('taskTitleInput').value.trim();
  if (!title) { toast('Required', 'Please enter a task title.', 'danger'); return; }

  const alarmOn = document.getElementById('taskAlarmToggle').classList.contains('on');
  const alarmTime = document.getElementById('taskAlarmInput').value;

  const data = {
    id: editingTaskId || Date.now().toString(),
    title,
    desc: document.getElementById('taskDescInput').value.trim(),
    priority: document.getElementById('taskPriorityInput').value,
    category: document.getElementById('taskCategoryInput').value,
    date: document.getElementById('taskDateInput').value,
    time: document.getElementById('taskTimeInput').value,
    alarm: (alarmOn && alarmTime) ? alarmTime : '',
    subtasks: currentSubtasks,
    completed: false,
    createdAt: new Date().toISOString()
  };

  if (editingTaskId) {
    const idx = tasks.findIndex(t => t.id === editingTaskId);
    data.completed = tasks[idx].completed;
    data.createdAt = tasks[idx].createdAt;
    tasks[idx] = data;
    toast('Updated!', 'Task has been updated.', 'success');
  } else {
    tasks.unshift(data);
    toast('Task Added!', `"${title}" added to your list.`, 'success');

    // Auto-create alarm if set
    if (data.alarm) {
      alarms.push({ id: Date.now().toString() + 'a', time: data.alarm, label: `Reminder: ${title}`, days: [], on: true });
    }
  }

  save(); closeModal('taskModal'); renderAll();
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  save(); renderAll();
  toast('Deleted', 'Task removed.', 'warning');
}

function toggleTask(id) {
  const t = tasks.find(t => t.id === id);
  if (t) {
    t.completed = !t.completed;
    if (t.completed) toast('Great job! 🎉', `"${t.title}" completed!`, 'success');
    save(); renderAll();
  }
}

function getFilteredTasks() {
  let list = [...tasks];
  const today = new Date().toISOString().split('T')[0];
  if (currentFilter === 'active') list = list.filter(t => !t.completed);
  else if (currentFilter === 'completed') list = list.filter(t => t.completed);
  else if (currentFilter === 'high') list = list.filter(t => t.priority === 'high');
  else if (currentFilter === 'today') list = list.filter(t => t.date === today);
  if (currentCat !== 'all') list = list.filter(t => t.category === currentCat);
  const q = document.getElementById('searchInput').value.toLowerCase();
  if (q) list = list.filter(t => t.title.toLowerCase().includes(q) || (t.desc || '').toLowerCase().includes(q));
  return list;
}

function setFilter(f, el) {
  currentFilter = f;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  renderAll();
}

function setCat(c, el) {
  currentCat = c;
  document.querySelectorAll('.cat-chip').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  renderAll();
}

function filterByCategory(cat) {
  switchView('tasks', document.querySelector('[data-view=tasks]'));
  currentCat = cat;
  document.querySelectorAll('.cat-chip').forEach(t => t.classList.remove('active'));
  const el = document.querySelector(`[data-cat="${cat}"]`);
  if (el) el.classList.add('active');
  renderAll();
}

function handleSearch() {
  const q = document.getElementById('searchInput')?.value.trim();
  if (q && q.length > 0) {
    const taskView = document.getElementById('view-tasks');
    if (taskView && !taskView.classList.contains('active')) {
      switchView('tasks', document.querySelector('[data-view=tasks]'));
    }
  }
  renderAll();
}

function buildTaskCard(t) {
  const catColors = { work: 'work', personal: 'personal', study: 'study', health: 'health', other: 'other' };
  const catLabels = { work: '💼 Work', personal: '🏠 Personal', study: '📚 Study', health: '💪 Health', other: '📌 Other' };
  const prioClass = { high: 'prio-high', medium: 'prio-medium', low: 'prio-low' };
  const prioLabel = { high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low' };

  const today = new Date().toISOString().split('T')[0];
  const isOverdue = t.date && t.date < today && !t.completed;

  let timeMeta = '';
  if (t.date || t.time) {
    const d = t.date ? new Date(t.date + 'T00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '';
    timeMeta = `<span class="task-time" style="${isOverdue?'color:var(--danger);':''}"><i class="fa-regular fa-clock"></i> ${d}${t.date && t.time ? ' · ' : ''}${t.time || ''}</span>`;
  }

  const subtasks = t.subtasks || [];
  const doneCount = subtasks.filter(s => s.done).length;
  let subtaskMeta = '';
  if (subtasks.length > 0) {
    const pct = Math.round(doneCount / subtasks.length * 100);
    subtaskMeta = `
      <div style="margin-top:8px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="font-size:11px;color:var(--text3);">Sub-tasks: ${doneCount}/${subtasks.length}</span>
          <span style="font-size:11px;color:var(--accent2);">${pct}%</span>
        </div>
        <div style="height:3px;background:var(--surface3);border-radius:2px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--accent),var(--accent2));transition:width 0.5s;"></div>
        </div>
      </div>`;
  }

  return `
    <div class="task-card ${t.completed ? 'completed' : ''} priority-${t.priority}" id="tc-${t.id}">
      <div class="task-check ${t.completed ? 'checked' : ''}" onclick="toggleTask('${t.id}')"></div>
      <div class="task-body">
        <div class="task-title">${t.title}</div>
        ${t.desc ? `<div class="task-desc">${t.desc}</div>` : ''}
        <div class="task-meta">
          <span class="task-tag tag-${catColors[t.category] || 'work'}">${catLabels[t.category] || '📌 Other'}</span>
          <span class="priority-badge ${prioClass[t.priority]}">${prioLabel[t.priority]}</span>
          ${timeMeta}
          ${isOverdue ? `<span class="overdue-badge">⚠️ Overdue</span>` : ''}
          ${t.alarm ? `<span class="task-time"><i class="fa-solid fa-bell" style="color:var(--accent3)"></i> ${t.alarm}</span>` : ''}
        </div>
        ${subtaskMeta}
      </div>
      <div class="task-actions">
        <button class="task-action-btn" onclick="openTaskModal('${t.id}')" data-tooltip="Edit"><i class="fa-solid fa-pencil"></i></button>
        <button class="task-action-btn delete" onclick="deleteTask('${t.id}')" data-tooltip="Delete"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────
//  ALARMS
// ─────────────────────────────────────────
function toggleDay(el) { el.classList.toggle('active'); }

function saveAlarm() {
  const time = document.getElementById('alarmTimeInput').value;
  if (!time) { toast('Required', 'Please set an alarm time.', 'danger'); return; }
  const label = document.getElementById('alarmLabelInput').value.trim() || 'Alarm';
  const days = [...document.querySelectorAll('#alarmDayPicker .alarm-day.active')].map(d => d.dataset.day);

  alarms.push({ id: Date.now().toString(), time, label, days, on: true });
  save(); closeModal('alarmModal');
  renderAll();
  toast('Alarm Set!', `Alarm set for ${time}.`, 'success');

  // reset
  document.getElementById('alarmTimeInput').value = '';
  document.getElementById('alarmLabelInput').value = '';
  document.querySelectorAll('#alarmDayPicker .alarm-day').forEach(d => d.classList.remove('active'));
}

function toggleAlarm(id) {
  const a = alarms.find(a => a.id === id);
  if (a) { a.on = !a.on; save(); renderAll(); }
}

function deleteAlarm(id) {
  alarms = alarms.filter(a => a.id !== id);
  save(); renderAll();
  toast('Alarm removed', '', 'warning');
}

function checkAlarms(now) {
  if (ringingAlarmId) return;
  const hm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const sec = now.getSeconds();
  if (sec !== 0) return; // only trigger on exact minute

  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const todayDay = days[now.getDay()];

  for (const a of alarms) {
    if (!a.on) continue;
    if (a.time !== hm) continue;
    if (a.days && a.days.length > 0 && !a.days.includes(todayDay)) continue;
    triggerAlarm(a);
    break;
  }
}

function triggerAlarm(a) {
  ringingAlarmId = a.id;
  document.getElementById('ringTimeDisplay').textContent = a.time;
  document.getElementById('ringLabelDisplay').textContent = a.label || 'Alarm';
  document.getElementById('alarmRingModal').classList.add('show');

  // find card and pulse
  const card = document.getElementById('alc-' + a.id);
  if (card) card.classList.add('ringing');

  // Play audio beep
  playBeep();
}

function dismissAlarm() {
  document.getElementById('alarmRingModal').classList.remove('show');
  if (ringingAlarmId) {
    const card = document.getElementById('alc-' + ringingAlarmId);
    if (card) card.classList.remove('ringing');
  }
  ringingAlarmId = null;
  toast('Alarm Dismissed', 'Have a productive day!', 'success');
}

function snoozeAlarm() {
  const id = ringingAlarmId;
  dismissAlarm();
  toast('Snoozed', 'Alarm will ring again in 5 minutes.', 'warning');
  // Snooze: just trigger again after 5 mins (in demo: 5 seconds for testing)
  clearTimeout(snoozeTimeout);
  snoozeTimeout = setTimeout(() => {
    const a = alarms.find(x => x.id === id);
    if (a && a.on) { triggerAlarm(a); }
  }, 5 * 60 * 1000); // 5 minutes
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const pattern = [0, 200, 400, 600, 800];
    pattern.forEach(delay => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + delay / 1000);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay / 1000 + 0.15);
      osc.start(ctx.currentTime + delay / 1000);
      osc.stop(ctx.currentTime + delay / 1000 + 0.2);
    });
  } catch(e) {}
}

function buildAlarmCard(a) {
  const [h, m] = a.time.split(':');
  const hr = parseInt(h);
  const ampm = hr >= 12 ? 'PM' : 'AM';
  const h12 = hr > 12 ? hr - 12 : (hr === 0 ? 12 : hr);
  const daysAll = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const daysFull = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const daysHtml = daysAll.map((d, i) => {
    const active = a.days && a.days.includes(daysFull[i]) ? 'active' : '';
    return `<div class="alarm-day ${active}">${d}</div>`;
  }).join('');

  return `
    <div class="alarm-card" id="alc-${a.id}">
      <div class="alarm-time-big">${String(h12).padStart(2,'0')}:${m}<span class="alarm-ampm"> ${ampm}</span></div>
      <div class="alarm-label-text">${a.label}</div>
      <div class="alarm-days">${daysHtml}</div>
      <div class="alarm-footer">
        <div class="toggle ${a.on ? 'on' : ''}" onclick="toggleAlarm('${a.id}')"></div>
        <button class="task-action-btn delete" onclick="deleteAlarm('${a.id}')" style="opacity:1"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────
//  TIMETABLE
// ─────────────────────────────────────────
const TT_TIMES = ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00'];
const TT_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function selectColor(el) {
  document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
  el.classList.add('selected');
  ttSelectedColor = el.dataset.color;
}

function openTTCell(day, time) {
  ttCellDay = day; ttCellTime = time;
  document.getElementById('ttDayInput').value = day;
  document.getElementById('ttTimeInput').value = time;
  openModal('ttModal');
}

function saveTTEvent() {
  const title = document.getElementById('ttTitleInput').value.trim();
  if (!title) { toast('Required', 'Please enter an event title.', 'danger'); return; }
  const day = document.getElementById('ttDayInput').value;
  const time = document.getElementById('ttTimeInput').value;

  ttEvents.push({ id: Date.now().toString(), title, day, time, color: ttSelectedColor });
  save(); closeModal('ttModal');
  document.getElementById('ttTitleInput').value = '';
  renderAll();
  toast('Event Added!', `"${title}" added to ${day} at ${time}.`, 'success');
}

function deleteTTEvent(id) {
  ttEvents = ttEvents.filter(e => e.id !== id);
  save(); renderAll();
}

function renderTimetable() {
  const body = document.getElementById('timetableBody');
  if (!body) return;

  const today = TT_DAYS[new Date().getDay()];
  TT_DAYS.forEach((d, i) => {
    const el = document.getElementById(`ttH${i}`);
    if (el) el.className = `timetable-day-header${d === today ? ' today' : ''}`;
  });

  body.innerHTML = TT_TIMES.map(t => {
    const cells = TT_DAYS.map(d => {
      const evts = ttEvents.filter(e => e.day === d && e.time === t);
      const evtsHtml = evts.map(e => `
        <div class="timetable-event ${e.color !== 'purple' ? e.color : ''}" onclick="if(confirm('Delete this event?'))deleteTTEvent('${e.id}')">
          ${e.title}
        </div>
      `).join('');
      return `
        <div class="timetable-cell" onclick="openTTCell('${d}','${t}')">
          ${evtsHtml}
          ${evts.length === 0 ? '<div class="timetable-add-slot"><i class="fa-solid fa-plus"></i></div>' : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="timetable-row">
        <div class="timetable-time-cell">${t}</div>
        ${cells}
      </div>
    `;
  }).join('');
}

// ─────────────────────────────────────────
//  STATS & PROGRESS
// ─────────────────────────────────────────
function updateStats() {
  const total = tasks.length;
  const done = tasks.filter(t => t.completed).length;
  const pending = total - done;
  const high = tasks.filter(t => t.priority === 'high' && !t.completed).length;

  // Dashboard stats
  const sd = document.getElementById('statTotal'); if (sd) animCount(sd, total);
  const sd2 = document.getElementById('statDone'); if (sd2) animCount(sd2, done);
  const sd3 = document.getElementById('statPending'); if (sd3) animCount(sd3, pending);
  const sd4 = document.getElementById('statHigh'); if (sd4) animCount(sd4, high);

  // Sidebar stats
  document.getElementById('sideStatDone').textContent = done;
  document.getElementById('sideStatPending').textContent = pending;
  document.getElementById('sideStatTotal').textContent = total;

  // Progress ring
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const circumference = 2 * Math.PI * 26;
  const offset = circumference - (pct / 100) * circumference;
  document.getElementById('ringFg').style.strokeDashoffset = offset;
  document.getElementById('ringPct').textContent = pct + '%';

  // Badges
  document.getElementById('navBadgeTasks').textContent = pending;
  document.getElementById('navBadgeAlarms').textContent = alarms.filter(a => a.on).length;
}

function animCount(el, target) {
  const current = parseInt(el.textContent) || 0;
  if (current === target) return;
  const step = target > current ? 1 : -1;
  const interval = setInterval(() => {
    const v = parseInt(el.textContent) || 0;
    if (v === target) { clearInterval(interval); return; }
    el.textContent = v + step;
  }, 30);
}

// ─────────────────────────────────────────
//  RENDER ALL
// ─────────────────────────────────────────
function renderAll() {
  updateStats();

  // Dashboard tasks
  const dtl = document.getElementById('dashTaskList');
  if (dtl) {
    const recent = tasks.filter(t => !t.completed).slice(0, 5);
    if (recent.length === 0) {
      dtl.innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><div class="empty-title">All Caught Up!</div><div class="empty-sub">No pending tasks. Add a new one to get started.</div></div>`;
    } else {
      dtl.innerHTML = recent.map(buildTaskCard).join('');
    }
  }

  // Dashboard alarms
  const dal = document.getElementById('dashAlarmList');
  if (dal) {
    const active = alarms.filter(a => a.on).slice(0, 4);
    if (active.length === 0) {
      dal.innerHTML = `<div class="empty-state"><div class="empty-icon">⏰</div><div class="empty-title">No Active Alarms</div><div class="empty-sub">Add alarms to stay on track.</div></div>`;
    } else {
      dal.innerHTML = active.map(buildAlarmCard).join('');
    }
  }

  // All tasks
  const atl = document.getElementById('allTaskList');
  if (atl) {
    const filtered = getFilteredTasks();
    if (filtered.length === 0) {
      atl.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">No Tasks Found</div><div class="empty-sub">Try a different filter or add a new task.</div></div>`;
    } else {
      atl.innerHTML = filtered.map(buildTaskCard).join('');
    }
  }

  // Alarms
  const al = document.getElementById('alarmsList');
  if (al) {
    if (alarms.length === 0) {
      al.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">⏰</div><div class="empty-title">No Alarms Yet</div><div class="empty-sub">Click "Add Alarm" to create your first alarm.</div></div>`;
    } else {
      al.innerHTML = alarms.map(buildAlarmCard).join('');
    }
  }

  // Sidebar alarms
  const sal = document.getElementById('sideAlarmList');
  if (sal) {
    const active = alarms.filter(a => a.on).slice(0, 3);
    if (active.length === 0) {
      sal.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:4px 0;">No active alarms</div>`;
    } else {
      sal.innerHTML = active.map(a => `
        <div class="alarm-mini-item">
          <span class="alarm-mini-time">${a.time}</span>
          <span class="alarm-mini-name">${a.label}</span>
          <i class="fa-solid fa-bell alarm-mini-toggle on"></i>
        </div>
      `).join('');
    }
  }

  renderTimetable();
  // Allow drag-sort on task lists
  setTimeout(attachDragSort, 50);
}

// ─────────────────────────────────────────
//  SEED DEMO DATA
// ─────────────────────────────────────────
if (tasks.length === 0) {
  const today = new Date().toISOString().split('T')[0];
  tasks = [
    { id: '1', title: 'Design new project wireframes', desc: 'Create wireframes for the client dashboard redesign', priority: 'high', category: 'work', date: today, time: '10:00', alarm: '', completed: false, createdAt: new Date().toISOString() },
    { id: '2', title: 'Complete JavaScript assignment', desc: 'Finish the DOM manipulation exercises', priority: 'high', category: 'study', date: today, time: '14:00', alarm: '13:45', completed: false, createdAt: new Date().toISOString() },
    { id: '3', title: 'Morning jog 5km', desc: 'Run in the park for cardio', priority: 'medium', category: 'health', date: today, time: '07:00', alarm: '', completed: true, createdAt: new Date().toISOString() },
    { id: '4', title: 'Team standup meeting', desc: 'Daily sync with dev team', priority: 'medium', category: 'work', date: today, time: '09:30', alarm: '', completed: true, createdAt: new Date().toISOString() },
    { id: '5', title: 'Read "Atomic Habits" – ch.5-8', desc: '', priority: 'low', category: 'personal', date: '', time: '', alarm: '', completed: false, createdAt: new Date().toISOString() },
  ];

  alarms = [
    { id: 'a1', time: '07:00', label: 'Wake Up & Stretch', days: ['Mon','Tue','Wed','Thu','Fri'], on: true },
    { id: 'a2', time: '09:00', label: 'Morning Meeting', days: ['Mon','Wed','Fri'], on: true },
    { id: 'a3', time: '22:00', label: 'Sleep Reminder', days: [], on: false },
  ];

  ttEvents = [
    { id: 'tt1', title: 'Math Class', day: 'Mon', time: '09:00', color: 'cyan' },
    { id: 'tt2', title: 'Physics Lab', day: 'Mon', time: '11:00', color: 'amber' },
    { id: 'tt3', title: 'English Lit', day: 'Tue', time: '10:00', color: 'green' },
    { id: 'tt4', title: 'Team Meeting', day: 'Wed', time: '09:00', color: 'purple' },
    { id: 'tt5', title: 'Gym Session', day: 'Wed', time: '18:00', color: 'amber' },
    { id: 'tt6', title: 'CS Lecture', day: 'Thu', time: '13:00', color: 'cyan' },
    { id: 'tt7', title: 'Project Work', day: 'Fri', time: '14:00', color: 'green' },
  ];

  save();
}

// ─────────────────────────────────────────
//  AUTH SYSTEM
// ─────────────────────────────────────────
let currentUser = null;
const USERS_KEY = 'tmt_users';
const SESSION_KEY = 'tmt_session';

function getUsers() { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); }
function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }

// Auth canvas particles
(function() {
  const c = document.getElementById('auth-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  let W, H, pts = [];
  function resize() {
    W = c.width = c.offsetWidth;
    H = c.height = c.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);
  for (let i = 0; i < 60; i++) {
    pts.push({ x: Math.random()*W, y: Math.random()*H,
      vx: (Math.random()-.5)*.4, vy: (Math.random()-.5)*.4,
      r: Math.random()*1.2+.3 });
  }
  function frame() {
    ctx.clearRect(0,0,W,H);
    pts.forEach(p => {
      p.x+=p.vx; p.y+=p.vy;
      if(p.x<0||p.x>W) p.vx*=-1;
      if(p.y<0||p.y>H) p.vy*=-1;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle='rgba(124,58,237,0.6)'; ctx.fill();
    });
    requestAnimationFrame(frame);
  }
  frame();
})();

function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('tabLogin').className = 'auth-tab' + (isLogin ? ' active' : '');
  document.getElementById('tabRegister').className = 'auth-tab' + (!isLogin ? ' active' : '');
  const body = document.getElementById('authFormBody');
  body.classList.add('sliding');
  setTimeout(() => {
    document.getElementById('loginForm').style.display = isLogin ? 'block' : 'none';
    document.getElementById('registerForm').style.display = isLogin ? 'none' : 'block';
    clearAuthMsgs();
    body.classList.remove('sliding');
  }, 200);
}

function clearAuthMsgs() {
  ['loginMsg','registerMsg'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.className = 'auth-msg'; }
  });
}

function showAuthMsg(type, msgId, text) {
  const el = document.getElementById(msgId);
  const textEl = document.getElementById(msgId + 'Text');
  if (el && textEl) {
    el.className = 'auth-msg ' + type;
    textEl.textContent = text;
    el.querySelector('i').className = type === 'error'
      ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle-check';
  }
}

function togglePass(inputId, btn) {
  const inp = document.getElementById(inputId);
  const icon = btn.querySelector('i');
  if (inp.type === 'password') {
    inp.type = 'text';
    icon.className = 'fa-regular fa-eye-slash';
  } else {
    inp.type = 'password';
    icon.className = 'fa-regular fa-eye';
  }
}

function validateEmail(inp) {
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inp.value);
  inp.style.borderColor = inp.value ? (valid ? 'var(--accent4)' : 'var(--danger)') : '';
}

function updateStrength(pwd) {
  const bars = ['sb1','sb2','sb3','sb4'];
  const text = document.getElementById('strengthText');
  bars.forEach(b => { const el=document.getElementById(b); el.className='strength-bar'; });

  let score = 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  const labels = ['','Weak','Fair','Strong','Very Strong'];
  const classes = ['','weak','fair','strong','strong'];
  const colors = ['','#ef4444','#f59e0b','#10b981','#06b6d4'];

  for (let i = 0; i < score; i++) {
    document.getElementById(bars[i]).className = 'strength-bar ' + classes[score];
  }
  text.textContent = pwd ? labels[score] || 'Very Strong' : 'Enter a password';
  text.style.color = colors[score] || 'var(--text3)';
}

function setLoading(btnId, loading, text, icon) {
  const btn = document.getElementById(btnId);
  if (loading) {
    btn.classList.add('loading');
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Please wait...`;
  } else {
    btn.classList.remove('loading');
    btn.innerHTML = `<i class="${icon}"></i> ${text}`;
  }
}

function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showAuthMsg('error', 'loginMsg', 'Please fill in all fields.');
    return;
  }

  setLoading('loginBtn', true);
  setTimeout(() => {
    const users = getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === btoa(password));

    if (!user) {
      setLoading('loginBtn', false, 'Sign In', 'fa-solid fa-arrow-right-to-bracket');
      showAuthMsg('error', 'loginMsg', 'Invalid email or password. Try again.');
      document.getElementById('loginPassword').value = '';
      return;
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify({ email: user.email, name: user.name, loginAt: Date.now() }));
    showAuthMsg('success', 'loginMsg', `Welcome back, ${user.name}! Signing in...`);
    setTimeout(() => enterApp(user), 700);
  }, 900);
}

function doRegister() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regConfirm').value;

  if (!name || !email || !password || !confirm) {
    showAuthMsg('error', 'registerMsg', 'Please fill in all fields.');
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showAuthMsg('error', 'registerMsg', 'Please enter a valid email address.');
    return;
  }

  if (password.length < 6) {
    showAuthMsg('error', 'registerMsg', 'Password must be at least 6 characters.');
    return;
  }

  if (password !== confirm) {
    showAuthMsg('error', 'registerMsg', 'Passwords do not match.');
    return;
  }

  setLoading('registerBtn', true);
  setTimeout(() => {
    const users = getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      setLoading('registerBtn', false, 'Create Account', 'fa-solid fa-user-plus');
      showAuthMsg('error', 'registerMsg', 'An account with this email already exists.');
      return;
    }

    const newUser = { name, email, password: btoa(password), createdAt: Date.now() };
    users.push(newUser);
    saveUsers(users);

    localStorage.setItem(SESSION_KEY, JSON.stringify({ email, name, loginAt: Date.now() }));
    showAuthMsg('success', 'registerMsg', `Account created! Welcome, ${name}! 🎉`);
    setTimeout(() => enterApp(newUser), 800);
  }, 1000);
}

function demoLogin() {
  const users = getUsers();
  let demo = users.find(u => u.email === 'demo@tasktracker.com');
  if (!demo) {
    demo = { name: 'Demo User', email: 'demo@tasktracker.com', password: btoa('demo123'), createdAt: Date.now() };
    users.push(demo);
    saveUsers(users);
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify({ email: demo.email, name: demo.name, loginAt: Date.now() }));
  showAuthMsg('success', 'loginMsg', 'Loading demo account...');
  setTimeout(() => enterApp(demo), 600);
}

function enterApp(user) {
  currentUser = user;
  // Update UI
  const initial = (user.name || user.email || 'U')[0].toUpperCase();
  document.getElementById('userAvatarInitial').textContent = initial;
  document.getElementById('dropUserName').textContent = user.name || 'User';
  document.getElementById('dropUserEmail').textContent = user.email;

  // Animate out auth screen
  const authScreen = document.getElementById('authScreen');
  authScreen.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  authScreen.style.opacity = '0';
  authScreen.style.transform = 'scale(1.04)';
  setTimeout(() => {
    authScreen.classList.add('hidden');
    authScreen.style.transform = '';
    toast(`Welcome, ${user.name || 'User'}! 🎉`, 'Your workspace is ready.', 'success');
  }, 600);
}

function doLogout() {
  localStorage.removeItem(SESSION_KEY);
  currentUser = null;
  const authScreen = document.getElementById('authScreen');
  authScreen.style.opacity = '0';
  authScreen.style.transform = 'scale(0.96)';
  authScreen.classList.remove('hidden');
  setTimeout(() => {
    authScreen.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    authScreen.style.opacity = '1';
    authScreen.style.transform = 'scale(1)';
  }, 10);
  // Reset login form
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPassword').value = '';
  clearAuthMsgs();
  switchAuthTab('login');
  document.getElementById('loginBtn').innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Sign In';
  toast('Signed out', 'See you soon!', 'default');
}

// ─── CHECK SESSION ON LOAD ───
function checkSession() {
  const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  if (session && session.email) {
    const users = getUsers();
    const user = users.find(u => u.email === session.email);
    if (user) {
      enterApp(user);
      return;
    }
  }
  // Show auth screen (default)
}

// ─────────────────────────────────────────
//  PREMIUM SYSTEM
// ─────────────────────────────────────────
const FREE_LIMIT = 5;
const UNLOCK_CODES = ['TASKPRO2025', 'PROAI2025', 'UPGRADE99', 'SUBHAM2025'];
let isPremium = localStorage.getItem('tm_premium') === 'true';
let freeMessagesUsed = parseInt(localStorage.getItem('tm_free_used') || '0');

function updateFreeCounter() {
  const remaining = Math.max(0, FREE_LIMIT - freeMessagesUsed);
  const counter = document.getElementById('aiFreeCounter');
  const display = document.getElementById('freeCountDisplay');
  const badge = document.getElementById('premiumBadge');
  const sub = document.getElementById('aiPanelSub');

  if (isPremium) {
    if (counter) counter.style.display = 'none';
    if (badge) badge.style.display = 'inline-flex';
    if (sub) sub.textContent = 'Pro Plan · Unlimited AI Messages ✦';
    return;
  }
  if (display) display.textContent = remaining;
  if (counter) {
    counter.style.display = 'block';
    if (remaining === 0) {
      counter.style.background = 'rgba(239,68,68,0.1)';
      counter.style.borderTop = '1px solid rgba(239,68,68,0.2)';
      counter.style.color = '#fca5a5';
      counter.innerHTML = `🔒 Free limit reached · <strong style="color:#ef4444;">0 messages left</strong> &nbsp;·&nbsp; <span style="color:#67e8f9;cursor:pointer;font-weight:700;" onclick="showUpgradeModal('limit')">Upgrade Now ✦</span>`;
    } else if (remaining === 1) {
      counter.style.background = 'rgba(239,68,68,0.07)';
      counter.innerHTML = `⚠️ Last free message: <strong id="freeCountDisplay" style="color:#ef4444;">${remaining}</strong> / ${FREE_LIMIT} &nbsp;·&nbsp; <span style="color:var(--accent2);cursor:pointer;font-weight:700;" onclick="showUpgradeModal('counter')">Upgrade ✦</span>`;
    } else {
      counter.style.background = 'rgba(245,158,11,0.08)';
      counter.style.borderTop = '1px solid rgba(245,158,11,0.15)';
      counter.style.color = 'var(--accent3)';
      counter.innerHTML = `🆓 Free messages remaining: <strong style="color:var(--accent3);">${remaining}</strong> / ${FREE_LIMIT} &nbsp;·&nbsp; <span style="color:var(--accent2);cursor:pointer;font-weight:700;" onclick="showUpgradeModal('counter')">Upgrade to Pro ✦</span>`;
    }
  }
}

function showUpgradeModal(source) {
  const overlay = document.getElementById('upgradeModal');
  const msg = document.getElementById('upgradeLimitMsg');
  if (source === 'limit') {
    msg.textContent = '⚠️ Free limit reached — upgrade to continue chatting with AI';
    msg.style.display = 'block';
  } else if (source === 'intro') {
    msg.textContent = '✨ Get unlimited AI access + all Pro features';
    msg.style.display = 'block';
  } else {
    msg.style.display = 'none';
  }
  document.getElementById('upgradeCodeInput').value = '';
  document.getElementById('upgradeMsg').textContent = '';
  overlay.classList.add('open');
}

function closeUpgradeModal() {
  document.getElementById('upgradeModal').classList.remove('open');
}

function submitUpgradeCode() {
  const code = document.getElementById('upgradeCodeInput').value.trim().toUpperCase();
  const msgEl = document.getElementById('upgradeMsg');

  if (!code) {
    msgEl.className = 'upgrade-msg error';
    msgEl.textContent = '⚠️ Please enter your unlock code.';
    return;
  }

  if (UNLOCK_CODES.includes(code)) {
    msgEl.className = 'upgrade-msg success';
    msgEl.textContent = '✅ Code accepted! Unlocking Pro features...';
    setTimeout(() => {
      isPremium = true;
      localStorage.setItem('tm_premium', 'true');
      closeUpgradeModal();
      updateFreeCounter();
      fireConfetti();
      toast('🎉 Pro Unlocked!', 'Welcome to Task Tracker Pro. Enjoy unlimited AI!', 'success');
      // Re-enable input
      const aiInput = document.getElementById('aiInput');
      const aiBtn = document.getElementById('aiSendBtn');
      if (aiInput) aiInput.disabled = false;
      if (aiBtn) aiBtn.disabled = false;
    }, 1200);
  } else {
    msgEl.className = 'upgrade-msg error';
    msgEl.textContent = '❌ Invalid code. Check your payment confirmation.';
    const input = document.getElementById('upgradeCodeInput');
    input.style.borderColor = 'var(--danger)';
    setTimeout(() => input.style.borderColor = '', 1500);
  }
}

function fireConfetti() {
  const colors = ['#7c3aed','#06b6d4','#f59e0b','#10b981','#ec4899','#a78bfa','#67e8f9'];
  for (let i = 0; i < 80; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.cssText = `
      left: ${Math.random() * 100}vw;
      top: -10px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      width: ${4 + Math.random() * 8}px;
      height: ${4 + Math.random() * 8}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation-duration: ${1.5 + Math.random() * 2}s;
      animation-delay: ${Math.random() * 0.8}s;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
}

// ─────────────────────────────────────────
//  AI ASSISTANT
// ─────────────────────────────────────────
let aiOpen = false;
let aiLoading = false;
let aiHistory = [];

function toggleAIPanel() {
  aiOpen = !aiOpen;
  document.getElementById('aiPanel').classList.toggle('open', aiOpen);
  document.getElementById('aiOverlay').classList.toggle('open', aiOpen);
  if (aiOpen) {
    updateFreeCounter();
    document.getElementById('aiInput').focus();
  }
}

function aiQuickPrompt(text) {
  if (!isPremium && freeMessagesUsed >= FREE_LIMIT) {
    showUpgradeModal('limit'); return;
  }
  document.getElementById('aiInput').value = text;
  sendAIMessage();
}

function addAIMessage(role, content) {
  const container = document.getElementById('aiMessages');
  const div = document.createElement('div');
  div.className = `ai-msg ${role}`;
  const initial = (currentUser?.name || 'U')[0].toUpperCase();
  div.innerHTML = `
    <div class="ai-msg-avatar">${role === 'assistant' ? '🤖' : initial}</div>
    <div class="ai-msg-bubble">${content.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/`(.*?)`/g,'<code style="background:var(--surface3);padding:1px 5px;border-radius:4px;font-family:monospace;">$1</code>')}</div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function addAITyping() {
  const container = document.getElementById('aiMessages');
  const div = document.createElement('div');
  div.className = 'ai-msg assistant';
  div.id = 'aiTypingEl';
  div.innerHTML = `
    <div class="ai-msg-avatar">🤖</div>
    <div class="ai-msg-bubble"><div class="ai-typing"><span></span><span></span><span></span></div></div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

async function sendAIMessage() {
  if (aiLoading) return;

  // Check free limit
  if (!isPremium && freeMessagesUsed >= FREE_LIMIT) {
    showUpgradeModal('limit');
    return;
  }

  const input = document.getElementById('aiInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';
  addAIMessage('user', text);
  aiHistory.push({ role: 'user', content: text });

  const btn = document.getElementById('aiSendBtn');
  btn.disabled = true;
  aiLoading = true;
  addAITyping();

  // Increment usage (before request so user can't spam)
  if (!isPremium) {
    freeMessagesUsed++;
    localStorage.setItem('tm_free_used', freeMessagesUsed);
    updateFreeCounter();
  }

  // Build task context
  const taskSummary = tasks.length
    ? tasks.map(t => `- [${t.completed ? '✓' : ' '}] ${t.title} (${t.priority} priority, ${t.category}, due: ${t.date || 'no date'})`).join('\n')
    : 'No tasks yet.';
  const stats = {
    total: tasks.length,
    completed: tasks.filter(t=>t.completed).length,
    pending: tasks.filter(t=>!t.completed).length,
    highPriority: tasks.filter(t=>t.priority==='high'&&!t.completed).length
  };

  const systemPrompt = `You are a helpful AI productivity assistant inside a Task Management Tracker app.
The user's name is ${currentUser?.name || 'User'}.
Plan: ${isPremium ? 'Pro (unlimited)' : `Free (${freeMessagesUsed}/${FREE_LIMIT} messages used)`}

Task overview:
- Total: ${stats.total} | Completed: ${stats.completed} | Pending: ${stats.pending} | High priority: ${stats.highPriority}

Task list:
${taskSummary}

Be concise, friendly, and practical. Use bullet points and bold for clarity.
Keep responses under 250 words unless asked for detail.`;

  try {
    const messages = aiHistory.length > 12 ? aiHistory.slice(-12) : aiHistory;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: messages
      })
    });

    const data = await response.json();
    const reply = data.content?.[0]?.text || 'Sorry, I could not get a response. Please try again.';

    document.getElementById('aiTypingEl')?.remove();
    addAIMessage('assistant', reply);
    aiHistory.push({ role: 'assistant', content: reply });

    // After last free message, add upgrade nudge
    if (!isPremium && freeMessagesUsed >= FREE_LIMIT) {
      setTimeout(() => {
        const container = document.getElementById('aiMessages');
        const nudge = document.createElement('div');
        nudge.style.cssText = 'text-align:center;padding:14px 20px;';
        nudge.innerHTML = `
          <div style="background:linear-gradient(135deg,rgba(124,58,237,0.15),rgba(6,182,212,0.1));border:1px solid rgba(124,58,237,0.3);border-radius:14px;padding:16px 20px;">
            <div style="font-size:22px;margin-bottom:6px;">🔒</div>
            <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:14px;margin-bottom:4px;">Free limit reached</div>
            <div style="font-size:12px;color:var(--text3);margin-bottom:12px;">You've used all 5 free messages. Upgrade to Pro for unlimited AI access.</div>
            <button onclick="showUpgradeModal('limit')" style="background:linear-gradient(135deg,#7c3aed,#06b6d4);color:white;border:none;padding:9px 22px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">
              ✦ Upgrade to Pro — ₹99/mo
            </button>
          </div>`;
        container.appendChild(nudge);
        container.scrollTop = container.scrollHeight;
        // Disable input
        input.disabled = true;
        input.placeholder = '🔒 Upgrade to Pro to continue...';
        btn.disabled = true;
      }, 800);
    }

  } catch (err) {
    document.getElementById('aiTypingEl')?.remove();
    addAIMessage('assistant', '⚠️ Connection error. Please check your network and try again.');
    // Refund the message if error
    if (!isPremium) {
      freeMessagesUsed = Math.max(0, freeMessagesUsed - 1);
      localStorage.setItem('tm_free_used', freeMessagesUsed);
      updateFreeCounter();
    }
  }

  btn.disabled = isPremium ? false : freeMessagesUsed >= FREE_LIMIT;
  aiLoading = false;
}

// ─────────────────────────────────────────
//  POMODORO TIMER
// ─────────────────────────────────────────
let pomoInterval = null;
let pomoRunning = false;
let pomoSeconds = 25 * 60;
let pomoMode = 'focus'; // focus | short | long
let pomoSession = 0;
const POMO_DURATIONS = { focus: 25*60, short: 5*60, long: 15*60 };

function pomoUpdate() {
  const m = Math.floor(pomoSeconds/60).toString().padStart(2,'0');
  const s = (pomoSeconds%60).toString().padStart(2,'0');
  const timeStr = `${m}:${s}`;
  document.getElementById('pomoTime').textContent = timeStr;
  // Update browser tab
  if (pomoRunning) {
    const modeEmoji = pomoMode === 'focus' ? '🍅' : '☕';
    document.title = `${modeEmoji} ${timeStr} — Task Tracker`;
  } else {
    document.title = 'Task-Management Tracker';
  }
  // Update circular progress on modal if visible
  const total = POMO_DURATIONS[pomoMode];
  const pct = ((total - pomoSeconds) / total) * 100;
  const ring = document.getElementById('pomoRing');
  if (ring) {
    const circ = 2 * Math.PI * 54;
    ring.style.strokeDashoffset = circ - (pct / 100) * circ;
  }
}

function togglePomo() {
  const btn = document.getElementById('pomoBtn');
  if (pomoRunning) {
    clearInterval(pomoInterval);
    pomoRunning = false;
    btn.innerHTML = '<i class="fa-solid fa-play"></i> Resume';
  } else {
    pomoRunning = true;
    btn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
    pomoInterval = setInterval(() => {
      pomoSeconds--;
      pomoUpdate();
      if (pomoSeconds <= 0) {
        clearInterval(pomoInterval);
        pomoRunning = false;
        handlePomoEnd();
      }
    }, 1000);
  }
}

function handlePomoEnd() {
  if (pomoMode === 'focus') {
    pomoSession++;
    document.getElementById(`pd${Math.min(pomoSession-1,3)}`)?.classList.replace('active','done');
    const isLong = pomoSession % 4 === 0;
    pomoMode = isLong ? 'long' : 'short';
    document.getElementById('pomoLabel').textContent = isLong ? 'Long Break 🎉' : 'Short Break ☕';
    toast('🍅 Focus Complete!', isLong ? 'Time for a long break!' : 'Take a 5 min break.', 'success');
  } else {
    pomoMode = 'focus';
    document.getElementById('pomoLabel').textContent = 'Focus Session';
    if (pomoSession < 4) document.getElementById(`pd${pomoSession}`)?.classList.add('active');
    toast('⏰ Break Over!', 'Back to focus mode.', 'default');
  }
  pomoSeconds = POMO_DURATIONS[pomoMode];
  pomoUpdate();
  document.getElementById('pomoBtn').innerHTML = '<i class="fa-solid fa-play"></i> Start';
}

function resetPomo() {
  clearInterval(pomoInterval);
  pomoRunning = false;
  pomoMode = 'focus'; pomoSession = 0; pomoSeconds = 25*60;
  pomoUpdate();
  document.getElementById('pomoLabel').textContent = 'Focus Session';
  document.getElementById('pomoBtn').innerHTML = '<i class="fa-solid fa-play"></i> Start';
  document.title = 'Task Management Tracker';
  const ring = document.getElementById('pomoRing');
  if (ring) ring.style.strokeDashoffset = '339.3';
  ['pd0','pd1','pd2','pd3'].forEach((id,i) => {
    const el = document.getElementById(id);
    if (el) el.className = 'pomo-dot' + (i===0?' active':'');
  });
}

function skipPomo() {
  clearInterval(pomoInterval);
  pomoRunning = false;
  pomoSeconds = 0;
  handlePomoEnd();
}

function stopPomo() {
  clearInterval(pomoInterval);
  pomoRunning = false;
}

// ─────────────────────────────────────────
//  SUB-TASKS
// ─────────────────────────────────────────

function addSubtask() {
  const input = document.getElementById('subtaskInput');
  const text = input.value.trim();
  if (!text) return;
  currentSubtasks.push({ id: Date.now(), text, done: false });
  renderSubtaskList();
  input.value = '';
  input.focus();
}

function renderSubtaskList() {
  const container = document.getElementById('subtaskList');
  if (!container) return;
  container.innerHTML = currentSubtasks.map(st => `
    <div class="subtask-item">
      <div class="subtask-check ${st.done ? 'done' : ''}" onclick="toggleSubtask(${st.id})">
        ${st.done ? '✓' : ''}
      </div>
      <span class="subtask-text ${st.done ? 'done' : ''}">${st.text}</span>
      <span class="subtask-del" onclick="deleteSubtask(${st.id})"><i class="fa-solid fa-xmark"></i></span>
    </div>
  `).join('');
}

function toggleSubtask(id) {
  const st = currentSubtasks.find(s => s.id === id);
  if (st) st.done = !st.done;
  renderSubtaskList();
}

function deleteSubtask(id) {
  currentSubtasks = currentSubtasks.filter(s => s.id !== id);
  renderSubtaskList();
}

// ─────────────────────────────────────────
//  EXPORT TASKS
// ─────────────────────────────────────────
function exportTasks() {
  const data = {
    exportedAt: new Date().toISOString(),
    user: currentUser?.name || 'User',
    stats: {
      total: tasks.length,
      completed: tasks.filter(t=>t.completed).length,
      pending: tasks.filter(t=>!t.completed).length
    },
    tasks: tasks
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tasks-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  toast('✅ Exported!', `${tasks.length} tasks saved as JSON.`, 'success');
}

// ─────────────────────────────────────────
//  USER AVATAR DROPDOWN
// ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const avatarBtn = document.getElementById('userAvatarBtn');
  const dropdown = document.getElementById('userDropdown');
  if (avatarBtn && dropdown) {
    avatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
    document.addEventListener('click', () => dropdown.classList.remove('open'));
  }
});

// ─────────────────────────────────────────
//  DRAG-TO-SORT TASKS (smooth UX)
// ─────────────────────────────────────────
let dragSrcId = null;

function enableDragSort(container) {
  if (!container) return;
  // Remove previous listeners by cloning (clean slate)
  const fresh = container.cloneNode(true);
  container.parentNode.replaceChild(fresh, container);
  const el = fresh;
  el.addEventListener('dragstart', e => {
    const card = e.target.closest('.task-card');
    if (!card) return;
    dragSrcId = card.id.replace('tc-', '');
    setTimeout(() => card.style.opacity = '0.4', 0);
    e.dataTransfer.effectAllowed = 'move';
  });
  el.addEventListener('dragend', e => {
    const card = e.target.closest('.task-card');
    if (card) card.style.opacity = '';
    el.querySelectorAll('.task-card').forEach(c => c.classList.remove('drag-over'));
  });
  el.addEventListener('dragover', e => {
    e.preventDefault();
    const card = e.target.closest('.task-card');
    el.querySelectorAll('.task-card').forEach(c => c.classList.remove('drag-over'));
    if (card && card.id !== 'tc-' + dragSrcId) card.classList.add('drag-over');
  });
  el.addEventListener('drop', e => {
    e.preventDefault();
    const card = e.target.closest('.task-card');
    if (!card || !dragSrcId) return;
    const targetId = card.id.replace('tc-', '');
    if (targetId === dragSrcId) return;
    const srcIdx = tasks.findIndex(t => t.id === dragSrcId);
    const tgtIdx = tasks.findIndex(t => t.id === targetId);
    if (srcIdx < 0 || tgtIdx < 0) return;
    const [moved] = tasks.splice(srcIdx, 1);
    tasks.splice(tgtIdx, 0, moved);
    save(); renderAll(); dragSrcId = null;
  });
}

function attachDragSort() {
  ['dashTaskList','allTaskList'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.querySelectorAll('.task-card').forEach(c => c.setAttribute('draggable', 'true'));
      enableDragSort(el);
    }
  });
}

// ─────────────────────────────────────────
//  KEYBOARD SHORTCUTS
// ─────────────────────────────────────────
document.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName;
  const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    closeUpgradeModal();
    if (aiOpen) toggleAIPanel();
    return;
  }
  if (!inInput && (e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault(); openTaskModal();
  }
  if (!inInput && (e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault(); toggleAIPanel();
  }
});

// ─────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────
renderAll();
checkSession();
updateFreeCounter();

// Close upgrade modal on outside click
document.getElementById('upgradeModal').addEventListener('click', e => {
  if (e.target === document.getElementById('upgradeModal')) closeUpgradeModal();
});

// Restore AI input state if already premium on page load
if (isPremium) {
  const aiInput = document.getElementById('aiInput');
  if (aiInput) aiInput.disabled = false;
}
// If free limit already hit on load, disable input
if (!isPremium && freeMessagesUsed >= FREE_LIMIT) {
  const aiInput = document.getElementById('aiInput');
  const aiBtn = document.getElementById('aiSendBtn');
  if (aiInput) { aiInput.disabled = true; aiInput.placeholder = '🔒 Upgrade to Pro to continue...'; }
  if (aiBtn) aiBtn.disabled = true;
}
