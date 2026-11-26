(() => {
  const STORAGE_KEY = 'study-desk-v1';
  const subjects = {
    Maths: ['∑', 'tone-blue'], Science: ['✳', 'tone-mint'], English: ['Aa', 'tone-peach'],
    'Social Studies': ['◎', 'tone-lilac'], Languages: ['文', 'tone-yellow'], Art: ['✎', 'tone-pink'], Other: ['✧', 'tone-blue']
  };
  const today = new Date();
  const isoToday = localDate(today);
  let state = loadState();
  let currentFilter = 'all';
  let sortMode = 'due';
  let timerSeconds = 20 * 60;
  let timerRunning = false;
  let timerInterval = null;
  let toastTimeout;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const overviewWork = $('#overview-work');
  const fullWork = $('#full-work');

  function localDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { tasks: Array.isArray(saved.tasks) ? saved.tasks : [], topic: typeof saved.topic === 'string' ? saved.topic : '' };
    } catch { return { tasks: [], topic: '' }; }
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { showToast('This browser could not save your changes.'); }
  }
  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 2300);
  }
  function dueLabel(due) {
    if (!due) return 'No due date';
    if (due === isoToday) return 'Due today';
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    if (due === localDate(tomorrow)) return 'Due tomorrow';
    const parsed = new Date(`${due}T12:00:00`);
    const daysAway = Math.round((new Date(`${due}T00:00:00`) - new Date(`${isoToday}T00:00:00`)) / 86400000);
    if (daysAway < 0) return `${Math.abs(daysAway)} day${Math.abs(daysAway) === 1 ? '' : 's'} overdue`;
    return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function makeEmpty(message, detail, action = true) {
    const wrap = document.createElement('div'); wrap.className = 'empty-state';
    const inner = document.createElement('div');
    const icon = document.createElement('div'); icon.className = 'empty-icon'; icon.textContent = '✳';
    const title = document.createElement('h3'); title.textContent = message;
    const copy = document.createElement('p'); copy.textContent = detail;
    inner.append(icon, title, copy);
    if (action) {
      const button = document.createElement('button'); button.className = 'button button-primary'; button.textContent = '＋ Add schoolwork';
      button.addEventListener('click', openAddDialog); inner.append(button);
    }
    wrap.append(inner); return wrap;
  }
  function taskElement(task) {
    const row = document.createElement('article');
    row.className = `work-item${task.done ? ' is-done' : ''}`;
    const [symbol, tone] = subjects[task.subject] || subjects.Other;
    const icon = document.createElement('div'); icon.className = `subject-icon ${tone}`; icon.textContent = symbol; icon.setAttribute('aria-hidden', 'true');
    const main = document.createElement('div'); main.className = 'work-main';
    const title = document.createElement('div'); title.className = 'work-title'; title.textContent = task.title;
    const meta = document.createElement('div'); meta.className = 'work-meta';
    meta.textContent = task.notes ? task.notes : (task.done ? 'Nicely done' : 'Click the circle when finished');
    main.append(title, meta);
    const subject = document.createElement('span'); subject.className = 'subject-tag'; subject.textContent = task.subject;
    const due = document.createElement('span'); due.className = `due-tag${task.due && task.due < isoToday && !task.done ? ' urgent' : ''}`; due.textContent = dueLabel(task.due);
    const check = document.createElement('button'); check.className = `done-check${task.done ? ' checked' : ''}`; check.type = 'button';
    check.textContent = task.done ? '✓' : ''; check.setAttribute('aria-label', task.done ? `Mark ${task.title} as to do` : `Mark ${task.title} as done`);
    check.addEventListener('click', () => toggleTask(task.id));
    row.append(icon, main, subject, due, check);
    const details = document.createElement('details'); details.className = 'task-steps';
    const summary = document.createElement('summary'); summary.textContent = 'Break it into small steps';
    const list = document.createElement('div'); list.className = 'task-step-list';
    const steps = [
      'Get your books, notes, and anything else you need.',
      `Look over “${task.title}” and decide on one small part to start with.`,
      'Work on that part for 10 minutes, then take a short stretch break.',
      'Check your work and note what you want to do next.'
    ];
    steps.forEach((label, index) => {
      const item = document.createElement('label'); item.className = 'task-step';
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = !!(task.steps && task.steps[index]);
      checkbox.addEventListener('change', () => {
        task.steps ||= []; task.steps[index] = checkbox.checked; saveState();
      });
      const text = document.createElement('span'); text.textContent = label; item.append(checkbox, text); list.append(item);
    });
    details.append(summary, list); row.append(details);
    return row;
  }
  function sortedTasks(tasks) {
    return [...tasks].sort((a, b) => {
      if (sortMode === 'created') return (b.created || 0) - (a.created || 0);
      const da = a.due || '9999-12-31'; const db = b.due || '9999-12-31';
      return da.localeCompare(db) || (b.created || 0) - (a.created || 0);
    });
  }
  function drawTasks() {
    const open = sortedTasks(state.tasks.filter(task => !task.done));
    const done = sortedTasks(state.tasks.filter(task => task.done));
    const visible = currentFilter === 'open' ? open : currentFilter === 'done' ? done : sortedTasks(state.tasks);
    $('#nav-count').textContent = String(open.length);
    $('#work-count').textContent = String(open.length);
    $('#filter-all').textContent = String(state.tasks.length);
    $('#filter-open').textContent = String(open.length);
    $('#filter-done').textContent = String(done.length);
    overviewWork.replaceChildren();
    const next = open.slice(0, 3);
    if (next.length) next.forEach(task => overviewWork.append(taskElement(task)));
    else overviewWork.append(makeEmpty(state.tasks.length ? 'Everything is done for now.' : 'Your list is ready when you are.', state.tasks.length ? 'Take a breather, or add a new task whenever one comes up.' : 'Add a task, a project, or a little reminder to get started.'));
    fullWork.replaceChildren();
    if (visible.length) visible.forEach(task => fullWork.append(taskElement(task)));
    else if (!state.tasks.length) fullWork.append(makeEmpty('Your schoolwork will show up here.', 'Add an assignment or a project to give it a home.'));
    else fullWork.append(makeEmpty(currentFilter === 'done' ? 'No finished work just yet.' : 'No tasks in this view.', currentFilter === 'done' ? 'When you finish something, mark it done with the circle.' : 'Everything on your list is finished. Nice work!', false));
    drawWeek();
  }
  function drawWeek() {
    const chart = $('#week-chart'); chart.replaceChildren();
    const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const start = new Date(today); const day = (start.getDay() + 6) % 7; start.setDate(start.getDate() - day);
    const counts = Array(7).fill(0);
    state.tasks.filter(task => task.done && task.completedAt).forEach(task => {
      const completed = new Date(task.completedAt); const offset = Math.floor((new Date(localDate(completed)) - new Date(localDate(start))) / 86400000);
      if (offset >= 0 && offset < 7) counts[offset] += 1;
    });
    const max = Math.max(3, ...counts);
    counts.forEach((count, i) => {
      const bar = document.createElement('div'); bar.className = 'day-bar';
      const fill = document.createElement('span'); fill.className = `bar-fill${localDate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)) === isoToday ? ' today' : ''}`;
      fill.style.height = `${Math.max(4, Math.round(count / max * 62))}px`;
      fill.title = `${count} task${count === 1 ? '' : 's'} done`;
      const label = document.createElement('span'); label.className = 'day-label'; label.textContent = dayNames[i];
      bar.append(fill, label); chart.append(bar);
    });
    const completedThisWeek = counts.reduce((sum, n) => sum + n, 0);
    $('#week-done').textContent = String(completedThisWeek);
  }
  function openAddDialog() {
    const dialog = $('#add-dialog');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    setTimeout(() => $('#task-title').focus(), 40);
  }
  function toggleTask(id) {
    const task = state.tasks.find(item => item.id === id); if (!task) return;
    task.done = !task.done; task.completedAt = task.done ? new Date().toISOString() : null;
    saveState(); drawTasks(); showToast(task.done ? 'Marked done. Nice work!' : 'Back on your list.');
  }
  function showView(name) {
    $$('.view').forEach(view => view.classList.toggle('active', view.id === `view-${name}`));
    $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === name));
    const labels = { overview: 'Overview', work: 'My work', study: 'Study room' };
    $('#crumb-current').textContent = labels[name] || labels.overview;
    history.replaceState(null, '', `#${name}`);
    $('#sidebar').classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function buildPlan(topic) {
    const steps = [
      ['Warm up · 3 min', `Write down what you already know about ${topic}. Add one thing you are unsure about.`],
      ['Learn · 8 min', 'Read your class notes or book slowly. Stop after each small section and explain the main idea in your own words.'],
      ['Remember · 5 min', 'Close your notes. Write or say the key ideas from memory, then open your notes and check what you missed.'],
      ['Practise · 4 min', 'Try a question from your work without looking at the answer. If you get stuck, ask for a hint and try again.']
    ];
    const questions = [
      `How would you explain ${topic} to a friend in two sentences?`,
      `What is one example of ${topic}, and why does it fit?`,
      `Which part of ${topic} still feels confusing? What clue could help you figure it out?`
    ];
    const plan = $('#study-plan'); plan.replaceChildren(); plan.classList.remove('hidden');
    const top = document.createElement('div'); top.className = 'plan-heading';
    const titleWrap = document.createElement('div');
    const tag = document.createElement('div'); tag.className = 'eyebrow'; tag.textContent = 'YOUR 20-MINUTE PLAN';
    const title = document.createElement('h3'); title.textContent = topic;
    const sub = document.createElement('p'); sub.textContent = 'A simple path from “I’m learning this” to “I can explain this.”';
    titleWrap.append(tag, title, sub);
    const close = document.createElement('button'); close.className = 'plan-close'; close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', 'Close study plan');
    close.addEventListener('click', () => plan.classList.add('hidden'));
    top.append(titleWrap, close);
    const stepList = document.createElement('div'); stepList.className = 'plan-steps';
    steps.forEach(([heading, copy], i) => {
      const item = document.createElement('div'); item.className = 'plan-step';
      const number = document.createElement('span'); number.className = 'plan-step-num'; number.textContent = String(i + 1);
      const body = document.createElement('div'); const strong = document.createElement('strong'); strong.textContent = heading; const text = document.createElement('p'); text.textContent = copy;
      body.append(strong, text); item.append(number, body); stepList.append(item);
    });
    const practice = document.createElement('div'); practice.className = 'practice-questions';
    const practiceTitle = document.createElement('strong'); practiceTitle.textContent = 'Check what you know';
    const list = document.createElement('ol'); questions.forEach(question => { const item = document.createElement('li'); item.textContent = question; list.append(item); });
    practice.append(practiceTitle, list); plan.append(top, stepList, practice);
    plan.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function setTimerDisplay() {
    const minutes = Math.floor(timerSeconds / 60); const seconds = timerSeconds % 60;
    $('#timer-display').innerHTML = `${String(minutes).padStart(2, '0')}<span>:${String(seconds).padStart(2, '0')}</span>`;
    $('#timer-progress').style.width = `${((20 * 60 - timerSeconds) / (20 * 60)) * 100}%`;
    $('#timer-caption').textContent = timerSeconds === 0 ? 'Time for a little break' : timerRunning ? 'You’ve got this — keep going' : '20 minutes of focus';
    $('#timer-toggle').textContent = timerRunning ? 'Pause focus' : timerSeconds === 0 ? 'Start again' : 'Start focus';
  }
  function startTimer() {
    if (timerRunning) return;
    if (timerSeconds <= 0) timerSeconds = 20 * 60;
    timerRunning = true; setTimerDisplay();
    timerInterval = setInterval(() => {
      timerSeconds -= 1;
      if (timerSeconds <= 0) { timerSeconds = 0; timerRunning = false; clearInterval(timerInterval); showToast('Focus time is up. Take a little break!'); }
      setTimerDisplay();
    }, 1000);
  }

  $('#today-label').textContent = today.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  $$('.nav-item').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
  $$('[data-view-link]').forEach(button => button.addEventListener('click', () => showView(button.dataset.viewLink)));
  $$('[data-open-add]').forEach(button => button.addEventListener('click', openAddDialog));
  $('#mobile-menu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $('#tip-start').addEventListener('click', () => { showView('study'); startTimer(); });
  $$('.filter-pill').forEach(button => button.addEventListener('click', () => {
    currentFilter = button.dataset.filter;
    $$('.filter-pill').forEach(pill => pill.classList.toggle('active', pill === button)); drawTasks();
  }));
  $('#sort-select').addEventListener('change', event => { sortMode = event.target.value; drawTasks(); });
  $('#task-form').addEventListener('submit', event => {
    event.preventDefault();
    if (event.submitter && event.submitter.value === 'cancel') { $('#add-dialog').close(); return; }
    const title = $('#task-title').value.trim(); if (!title) return;
    state.tasks.push({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, title, subject: $('#task-subject').value, due: $('#task-due').value, notes: $('#task-notes').value.trim(), done: false, created: Date.now(), steps: [] });
    saveState(); drawTasks(); $('#add-dialog').close(); event.target.reset();
    showView('work'); showToast('Added to your schoolwork.');
  });
  $('#topic-form').addEventListener('submit', event => {
    event.preventDefault(); const topic = $('#topic-input').value.trim(); if (!topic) return;
    state.topic = topic; saveState(); buildPlan(topic);
  });
  $('#timer-toggle').addEventListener('click', () => {
    if (timerRunning) { timerRunning = false; clearInterval(timerInterval); setTimerDisplay(); }
    else startTimer();
  });
  $('#timer-reset').addEventListener('click', () => { timerRunning = false; clearInterval(timerInterval); timerSeconds = 20 * 60; setTimerDisplay(); });

  const initialView = location.hash.replace('#', '');
  showView(['overview', 'work', 'study'].includes(initialView) ? initialView : 'overview');
  if (state.topic) $('#topic-input').value = state.topic;
  drawTasks(); setTimerDisplay();
})();

