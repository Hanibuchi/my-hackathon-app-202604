// ── State ────────────────────────────────────────────────────────────────────
const ST = {
  goals: JSON.parse(localStorage.getItem('gm_goals') || '[]'),
  logs:  JSON.parse(localStorage.getItem('gm_logs')  || '{}'),
  chatHistory: [{ role: 'ai', text: 'こんにちは！今日の進捗を教えてください。どんな小さなことでも記録できますよ。' }],
  activeChatGoalId: null,
  mood: 'logical',
  wizardData: { goal: '', category: '', deadline: '' },
  selectedSubtasks: new Set(),
};

function save() {
  localStorage.setItem('gm_goals', JSON.stringify(ST.goals));
  localStorage.setItem('gm_logs',  JSON.stringify(ST.logs));
}

// ── Navigation ────────────────────────────────────────────────────────────────
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelector(`.nav-btn[data-page="${page}"]`).classList.add('active');

  if (page === 'dashboard') renderDashboard();
  if (page === 'create')    initWizard();
  if (page === 'chat')      initChat();
  if (page === 'detail')    initDetail();
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function renderDashboard() {
  const cards = document.getElementById('goal-cards');
  const empty = document.getElementById('dash-empty');
  document.getElementById('stat-goals').textContent = ST.goals.length;

  const weekStart = Date.now() - 7 * 86400000;
  let weekLogs = 0;
  Object.values(ST.logs).forEach(arr => {
    arr.forEach(l => { if (new Date(l.ts) >= weekStart) weekLogs++; });
  });
  document.getElementById('stat-logs').textContent = weekLogs;

  if (!ST.goals.length) {
    cards.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  const catTag = {
    'フィットネス': 'tag-green',
    '学習': 'tag-blue',
    '仕事': 'tag-blue',
    '創作': 'tag-rose',
    '健康': 'tag-green',
    'その他': 'tag-amber',
  };

  cards.innerHTML = ST.goals.map(g => `
    <div class="card" onclick="navigate('detail');setDetailGoal(${g.id})" style="cursor:pointer">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span class="card-title">${esc(g.name)}</span>
        <span class="tag ${catTag[g.category] || 'tag-amber'}">${esc(g.category)}</span>
      </div>
      <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px">
        期間: ${esc(g.deadline)} ・ 記録: ${(ST.logs[g.id] || []).length}回
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
        <span>進捗</span><span style="font-weight:500;color:var(--blue)">${g.progress}%</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${g.progress}%"></div></div>
    </div>
  `).join('');
}

// ── Wizard ────────────────────────────────────────────────────────────────────
function initWizard() {
  document.getElementById('wizard-content').innerHTML = `
    <div class="step-block">
      <div class="step-label">STEP 1 / 3 — 目標を入力</div>
      <p class="step-desc mb-10">達成したいことを自由に書いてください</p>
      <input class="input mb-10" id="goal-input" placeholder="例：本を10冊読む、毎日5km走る...">
      <div class="row-wrap mb-10" style="gap:8px">
        <select id="goal-category" class="select">
          <option value="フィットネス">フィットネス</option>
          <option value="学習">学習</option>
          <option value="仕事">仕事</option>
          <option value="創作">創作</option>
          <option value="健康">健康</option>
          <option value="その他">その他</option>
        </select>
        <input class="input" id="goal-deadline" type="text" placeholder="期限（例：1ヶ月）" style="flex:1">
      </div>
      <button class="btn btn-primary" onclick="wizardStep1()">AIに分解してもらう →</button>
    </div>
    <div id="wizard-step2" style="display:none">
      <div class="step-block mt-12">
        <div class="step-label">STEP 2 / 3 — AIが提案するサブタスク</div>
        <div id="ai-loading" class="ai-loading">
          <div class="spinner"></div><span>AIが計画を分析中...</span>
        </div>
        <div id="subtask-area" style="display:none">
          <p class="step-desc mb-8">クリックで選択・解除できます</p>
          <div id="subtask-chips"></div>
          <div id="ai-advice" class="ai-advice"></div>
          <button class="btn btn-primary mt-12" onclick="wizardStep3()">この計画で決定 ✓</button>
        </div>
      </div>
    </div>`;
}

async function wizardStep1() {
  const goal     = document.getElementById('goal-input').value.trim();
  const category = document.getElementById('goal-category').value;
  const deadline = document.getElementById('goal-deadline').value.trim() || '1ヶ月';
  if (!goal) { alert('目標を入力してください'); return; }

  ST.wizardData = { goal, category, deadline };
  ST.selectedSubtasks = new Set();

  document.getElementById('wizard-step2').style.display = 'block';
  document.getElementById('ai-loading').style.display = 'flex';
  document.getElementById('subtask-area').style.display = 'none';

  try {
    const data = await apiBreakdown(goal, category, deadline);
    renderSubtasks(data.subtasks || [], data.advice || '');
  } catch {
    renderSubtasks(
      ['毎日15分取り組む', '週1回の振り返り', '進捗を記録する', '仲間に話す', '小さな成功を祝う'],
      '継続が力なり！一歩ずつ着実に進みましょう。'
    );
  }
}

function renderSubtasks(tasks, advice) {
  document.getElementById('ai-loading').style.display = 'none';
  document.getElementById('subtask-area').style.display = 'block';

  ST.selectedSubtasks = new Set([0, 1, 2]);
  const chips = document.getElementById('subtask-chips');
  chips.innerHTML = tasks.map((t, i) => `
    <span class="subtask-chip ${ST.selectedSubtasks.has(i) ? 'selected' : ''}"
          id="chip-${i}" onclick="toggleChip(${i}, ${JSON.stringify(t)})">
      ${ST.selectedSubtasks.has(i) ? '✓ ' : ''}${esc(t)}
    </span>
  `).join('');

  document.getElementById('ai-advice').innerHTML =
    `<strong>AIのアドバイス:</strong> ${esc(advice)}`;
}

function toggleChip(i, text) {
  const chip = document.getElementById('chip-' + i);
  if (ST.selectedSubtasks.has(i)) {
    ST.selectedSubtasks.delete(i);
    chip.classList.remove('selected');
    chip.textContent = text;
  } else {
    ST.selectedSubtasks.add(i);
    chip.classList.add('selected');
    chip.textContent = '✓ ' + text;
  }
}

function wizardStep3() {
  const id = Date.now();
  const newGoal = {
    id,
    name: ST.wizardData.goal.slice(0, 40),
    category: ST.wizardData.category,
    deadline: ST.wizardData.deadline,
    progress: 0,
    createdAt: new Date().toISOString(),
  };
  ST.goals.push(newGoal);
  ST.logs[id] = [];
  save();

  document.getElementById('wizard-content').innerHTML = `
    <div class="card" style="text-align:center;padding:32px 20px">
      <div style="font-size:36px;margin-bottom:14px;color:var(--blue)">✦</div>
      <div style="font-size:16px;font-weight:600;margin-bottom:8px">目標を設定しました！</div>
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:20px">「${esc(newGoal.name)}」の追跡を開始します</div>
      <button class="btn btn-primary" onclick="navigate('chat')">AIと話してみる →</button>
    </div>`;
}

// ── GeoVisualizer ─────────────────────────────────────────────────────────────
class GeoVisualizer {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.ctx    = canvasEl.getContext('2d');
    this.mood   = 'logical';
    this.t      = 0;
    this.particles = [];
    this.raf    = null;
    this.w = 0; this.h = 0; this.cx = 0; this.cy = 0;
  }

  resize() {
    const r  = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width  = r.width  * dpr;
    this.canvas.height = r.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.w  = r.width;
    this.h  = r.height;
    this.cx = this.w / 2;
    this.cy = this.h / 2;
  }

  setMood(mood) {
    this.mood = mood;
    this.spawnParticles();
  }

  spawnParticles() {
    this.particles = Array.from({ length: 30 }, () => this.newParticle(true));
  }

  newParticle(random = false) {
    const isPos = this.mood === 'positive';
    return {
      x:     this.cx + (Math.random() - 0.5) * this.w * 0.9,
      y:     random ? Math.random() * this.h : (isPos ? this.h + 10 : this.cy + (Math.random() - 0.5) * this.h),
      vx:    (Math.random() - 0.5) * (this.mood === 'logical' ? 0.3 : 1.0),
      vy:    isPos ? -(Math.random() * 1.4 + 0.4) : (Math.random() - 0.5) * 0.6,
      r:     Math.random() * 2.5 + 0.8,
      alpha: Math.random() * 0.45 + 0.15,
      life:  random ? Math.random() : 1,
      speed: Math.random() * 0.5 + 0.5,
    };
  }

  updateParticle(p) {
    p.x += p.vx; p.y += p.vy;
    p.life -= 0.004 * p.speed;
    if (p.life <= 0 || p.y < -20 || p.x < -10 || p.x > this.w + 10) {
      Object.assign(p, this.newParticle());
    }
  }

  drawBg() {
    const { ctx, w, h, mood } = this;
    const G = { logical: ['#E6F1FB','#C5DEFA'], positive: ['#FEF3DC','#FBDEAA'], encouraging: ['#FBEAF0','#F7CCDB'] };
    const [c1, c2] = G[mood];
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  drawParticles() {
    const { ctx, mood } = this;
    const C = { logical: '#185FA5', positive: '#EF9F27', encouraging: '#D4537E' };
    const col = C[mood];
    this.particles.forEach(p => {
      this.updateParticle(p);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.globalAlpha = p.life * p.alpha;
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  drawLogical() {
    const { ctx, cx, cy, t } = this;
    const a = t * 0.005;

    ctx.strokeStyle = 'rgba(24,95,165,0.1)';
    ctx.lineWidth = 0.5;
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(cx + i * 32, 0);       ctx.lineTo(cx + i * 32, this.h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, cy + i * 28);       ctx.lineTo(this.w, cy + i * 28); ctx.stroke();
    }

    ctx.save(); ctx.translate(cx, cy);
    [3, 2, 1].forEach(i => {
      ctx.save();
      ctx.rotate(a * i * (i % 2 ? 1 : -1));
      const s = i * 27;
      ctx.strokeStyle = `rgba(24,95,165,${0.18 + i * 0.14})`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-s, -s, s * 2, s * 2);
      ctx.restore();
    });
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(24,95,165,0.85)'; ctx.fill();
    ctx.restore();
  }

  drawPositive() {
    const { ctx, cx, cy, t } = this;
    const a = t * 0.012;

    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);

    const star = (r1, r2, pts, color, al) => {
      ctx.beginPath();
      for (let i = 0; i < pts * 2; i++) {
        const ang = (i * Math.PI) / pts - Math.PI / 2;
        const r   = i % 2 === 0 ? r1 : r2;
        if (!i) ctx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
        else    ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
      }
      ctx.closePath();
      ctx.strokeStyle = color; ctx.globalAlpha = al;
      ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1;
    };
    star(56, 28, 6, '#BA7517', 0.3);
    star(40, 20, 6, '#EF9F27', 0.7);

    const pulse = 1 + Math.sin(t * 0.08) * 0.18;
    ctx.beginPath(); ctx.arc(0, 0, 11 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = '#BA7517'; ctx.globalAlpha = 0.82; ctx.fill();
    ctx.globalAlpha = 1; ctx.restore();
  }

  drawEncouraging() {
    const { ctx, cx, cy, t } = this;
    const pulse = Math.sin(t * 0.07);

    [3, 2, 1].forEach(i => {
      const r = 19 * i + pulse * 5 * i;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(212,83,126,${0.12 + (4 - i) * 0.16})`;
      ctx.lineWidth = 2; ctx.stroke();
    });

    const pr = 11 + pulse * 2;
    ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(212,83,126,0.85)'; ctx.fill();
  }

  frame() {
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    this.drawBg();
    this.drawParticles();
    if (this.mood === 'logical')      this.drawLogical();
    else if (this.mood === 'positive') this.drawPositive();
    else                               this.drawEncouraging();
    this.t++;
    this.raf = requestAnimationFrame(() => this.frame());
  }

  start() {
    this.stop();
    this.resize();
    this.spawnParticles();
    this.frame();
  }

  stop() {
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
  }
}

let geo = null;

// ── Chat ──────────────────────────────────────────────────────────────────────
function initChat() {
  if (!geo) {
    geo = new GeoVisualizer(document.getElementById('geo-canvas'));
  }
  geo.start();
  geo.setMood(ST.mood);

  updateMoodBadge(ST.mood);
  populateChatGoalSelect();
  renderMessages();

  const inp = document.getElementById('chat-input');
  inp.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } };
}

function populateChatGoalSelect() {
  const sel = document.getElementById('chat-goal-select');
  sel.innerHTML = '<option value="">— 全体 —</option>' +
    ST.goals.map(g => `<option value="${g.id}">${esc(g.name.slice(0, 16))}</option>`).join('');
  if (ST.activeChatGoalId !== null) sel.value = ST.activeChatGoalId;
  sel.onchange = () => { ST.activeChatGoalId = sel.value ? Number(sel.value) : null; };
}

async function sendChat() {
  const inp  = document.getElementById('chat-input');
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  inp.disabled = true;

  ST.chatHistory.push({ role: 'user', text });
  renderMessages();
  showTyping();

  const goals = ST.activeChatGoalId !== null
    ? ST.goals.filter(g => g.id === ST.activeChatGoalId)
    : ST.goals;

  try {
    const data = await apiChat(text, goals, ST.chatHistory.slice(0, -1));
    hideTyping();
    ST.chatHistory.push({ role: 'ai', text: data.text });
    setMood(data.mood || 'logical');
    renderMessages();

    const goalId = ST.activeChatGoalId || (ST.goals[0] && ST.goals[0].id);
    if (goalId != null) {
      const now = new Date();
      const log = {
        ts:      now.toISOString(),
        date:    `${now.getMonth() + 1}/${now.getDate()}`,
        userMsg: text,
        summary: data.summary || text.slice(0, 20),
        value:   data.value ?? null,
      };
      if (!ST.logs[goalId]) ST.logs[goalId] = [];
      ST.logs[goalId].unshift(log);

      if (data.value != null) {
        const goal = ST.goals.find(g => g.id === goalId);
        if (goal) {
          goal.progress = Math.min(100, goal.progress + Math.floor(data.value / 10));
        }
      }
      save();
    }

    if (window.speechSynthesis) speakText(data.text);
  } catch (err) {
    hideTyping();
    ST.chatHistory.push({ role: 'ai', text: `エラーが発生しました: ${err.message}` });
    renderMessages();
  }

  inp.disabled = false;
  inp.focus();
}

function renderMessages() {
  const c = document.getElementById('chat-messages');
  c.innerHTML = ST.chatHistory.map(m =>
    `<div class="msg msg-${m.role}">${esc(m.text)}</div>`
  ).join('');
  c.scrollTop = c.scrollHeight;
}

function showTyping() {
  const c = document.getElementById('chat-messages');
  c.insertAdjacentHTML('beforeend', '<div class="msg msg-ai msg-typing" id="typing-indicator">...</div>');
  c.scrollTop = c.scrollHeight;
}
function hideTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

function setMood(mood) {
  ST.mood = mood;
  updateMoodBadge(mood);
  if (geo) geo.setMood(mood);
}

function updateMoodBadge(mood) {
  const badge = document.getElementById('mood-badge');
  if (!badge) return;
  const labels = { positive: 'ポジティブ', logical: '論理的', encouraging: '応援中' };
  const classes = { positive: 'mood-positive', logical: 'mood-logical', encouraging: 'mood-encouraging' };
  badge.textContent = labels[mood] || '論理的';
  badge.className = 'mood-badge ' + (classes[mood] || 'mood-logical');
}

// ── Voice ─────────────────────────────────────────────────────────────────────
let recognition = null;
let isListening  = false;

function toggleVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert('音声入力はChromeブラウザで利用できます。'); return; }

  if (isListening) {
    recognition && recognition.stop();
    return;
  }

  recognition = new SR();
  recognition.lang = 'ja-JP';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    isListening = true;
    document.getElementById('voice-btn').classList.add('active');
  };
  recognition.onresult = (e) => {
    document.getElementById('chat-input').value = e.results[0][0].transcript;
  };
  recognition.onend = () => {
    isListening = false;
    document.getElementById('voice-btn').classList.remove('active');
  };
  recognition.onerror = () => {
    isListening = false;
    document.getElementById('voice-btn').classList.remove('active');
  };

  recognition.start();
}

function speakText(text) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP'; u.rate = 0.92; u.pitch = 1.05;
  speechSynthesis.speak(u);
}

// ── Detail ────────────────────────────────────────────────────────────────────
function initDetail() {
  const sel   = document.getElementById('detail-select');
  const empty = document.getElementById('detail-empty');
  const body  = document.getElementById('detail-body');

  if (!ST.goals.length) {
    sel.style.display = 'none';
    empty.style.display = '';
    body.style.display = 'none';
    return;
  }

  sel.style.display = '';
  empty.style.display = 'none';
  body.style.display = '';

  sel.innerHTML = ST.goals.map(g =>
    `<option value="${g.id}">${esc(g.name)}</option>`
  ).join('');

  if (ST.activeChatGoalId !== null) {
    sel.value = ST.activeChatGoalId;
  }

  renderDetail();
}

function setDetailGoal(id) {
  ST.activeChatGoalId = id;
}

function renderDetail() {
  const sel  = document.getElementById('detail-select');
  const id   = Number(sel.value);
  const goal = ST.goals.find(g => g.id === id);
  if (!goal) return;

  document.getElementById('detail-pct').textContent = goal.progress + '%';
  document.getElementById('detail-fill').style.width = goal.progress + '%';

  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const firstDay = new Date(year, month, 1).getDay();
  const offset   = (firstDay + 6) % 7;

  document.getElementById('cal-month-label').textContent =
    `${year}年${month + 1}月のカレンダー`;

  const logDates = new Set(
    (ST.logs[id] || []).map(l => {
      const d = new Date(l.ts);
      return d.getFullYear() === year && d.getMonth() === month ? d.getDate() : null;
    }).filter(Boolean)
  );

  const today = now.getDate();
  let html = '';
  for (let i = 0; i < offset; i++) html += `<div class="cal-day empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const cls = d === today ? 'today' : logDates.has(d) ? 'has-log' : '';
    html += `<div class="cal-day ${cls}">${d}</div>`;
  }
  document.getElementById('cal-grid').innerHTML = html;

  const logs = ST.logs[id] || [];
  const tl   = document.getElementById('timeline');
  if (!logs.length) {
    tl.innerHTML = '<div style="font-size:13px;color:var(--text-secondary)">まだ記録がありません。チャットで進捗を報告してみましょう！</div>';
    return;
  }
  tl.innerHTML = logs.slice(0, 20).map(l => `
    <div class="timeline-item">
      <div class="timeline-date">${esc(l.date)}</div>
      <div class="timeline-goal">${esc(goal.name)}</div>
      <div class="timeline-summary">${esc(l.summary)}${l.value != null ? ` [値: ${l.value}]` : ''}</div>
    </div>
  `).join('');
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiChat(message, goals, history) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, goals, history }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'サーバーエラー');
  return res.json();
}

async function apiBreakdown(goal, category, deadline) {
  const res = await fetch('/api/breakdown', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, category, deadline }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'サーバーエラー');
  return res.json();
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
renderDashboard();
