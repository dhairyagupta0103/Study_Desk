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
  let saveStatusTimeout;
  let quickAddPending = false;
  let currentPuzzle = null;
  let currentPuzzleIndex = 0;
  let quizState = null;

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
      return {
        tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
        flashcards: Array.isArray(saved.flashcards) ? saved.flashcards : [],
        topic: typeof saved.topic === 'string' ? saved.topic : '',
        profileName: typeof saved.profileName === 'string' ? saved.profileName : ''
      };
    } catch { return { tasks: [], flashcards: [], topic: '', profileName: '' }; }
  }
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      updateSaveIndicator('Saved just now');
      clearTimeout(saveStatusTimeout);
      saveStatusTimeout = setTimeout(() => updateSaveIndicator('Saved on this device'), 2400);
    } catch {
      updateSaveIndicator('Could not save');
      showToast('This browser could not save your changes.');
    }
  }
  function updateSaveIndicator(message) {
    const indicator = $('#save-indicator');
    if (!indicator) return;
    $('#save-text').textContent = message;
    indicator.classList.toggle('is-saving', message === 'Saving…' || message === 'Could not save');
  }
  function updateProfileButton() {
    const button = $('#profile-open');
    if (!button) return;
    const name = state.profileName.trim();
    button.textContent = name ? name.charAt(0).toUpperCase() : '✿';
    button.setAttribute('aria-label', name ? `Manage ${name}'s profile` : 'Create or manage profile');
  }
  function refreshFromStorage() {
    const latest = loadState();
    if (JSON.stringify(latest) === JSON.stringify(state)) return;
    state = latest;
    drawTasks();
    drawFlashcards();
    updateProfileButton();
    const topicInput = $('#topic-input');
    if (document.activeElement !== topicInput) topicInput.value = state.topic;
    updateSaveIndicator('Updated in another tab');
    clearTimeout(saveStatusTimeout);
    saveStatusTimeout = setTimeout(() => updateSaveIndicator('Saved on this device'), 2400);
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
  function guessSubject(text) {
    const value = text.toLowerCase();
    const rules = [
      ['Maths', /\b(math|maths|algebra|fraction|fractions|geometry|multiplication|division|equation)\b/],
      ['Science', /\b(science|planet|planets|water cycle|solar system|gravity|experiment|ecosystem)\b/],
      ['Social Studies', /\b(history|geography|social studies|civics|map|country)\b/],
      ['Languages', /\b(hindi|spanish|french|language|verb conjugation)\b/],
      ['English', /\b(english|essay|poem|poetry|grammar|reading|book report|story|vocabulary)\b/],
      ['Art', /\b(art|drawing|painting|poster|craft)\b/]
    ];
    return rules.find(([, pattern]) => pattern.test(value))?.[0] || 'Other';
  }
  function guessDueDate(text) {
    const value = text.toLowerCase();
    const iso = value.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (iso && !Number.isNaN(new Date(`${iso[1]}T12:00:00`).getTime())) return iso[1];
    if (/\btoday\b/.test(value)) return isoToday;
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    if (/\btomorrow\b/.test(value)) return localDate(tomorrow);
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayMatch = value.match(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
    if (dayMatch) {
      const target = days.indexOf(dayMatch[2]);
      let offset = (target - today.getDay() + 7) % 7;
      if (dayMatch[1]) offset += offset === 0 ? 7 : 7;
      const due = new Date(today); due.setDate(due.getDate() + offset);
      return localDate(due);
    }
    const monthMatch = value.match(/\b(?:due|by)\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})\b/);
    if (monthMatch) {
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const month = months.indexOf(monthMatch[1].slice(0, 3)); const day = Number(monthMatch[2]);
      const candidate = new Date(today.getFullYear(), month, day, 12);
      if (candidate.getMonth() === month && candidate.getDate() === day) {
        if (candidate < today) candidate.setFullYear(candidate.getFullYear() + 1);
        return localDate(candidate);
      }
    }
    return '';
  }
  function organizeQuickAdd() {
    const raw = $('#quick-add-input').value.trim();
    if (!raw) { showToast('Type or paste your schoolwork first.'); $('#quick-add-input').focus(); return; }
    const duePattern = /\s+\b(?:due|by)\s+(?:today|tomorrow|(?:next\s+)?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday))\b[^.!?]*/i;
    const isoPattern = /\s+\b(?:due|by)\s+20\d{2}-\d{2}-\d{2}\b/i;
    const monthPattern = /\s+\b(?:due|by)\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}\b/i;
    let title = raw.replace(duePattern, '').replace(isoPattern, '').replace(monthPattern, '').replace(/[\s,;:.!?]+$/, '').trim();
    if (!title) title = raw;
    if (title.length > 100) title = `${title.slice(0, 97).trimEnd()}…`;
    $('#task-title').value = title;
    $('#task-subject').value = guessSubject(raw);
    $('#task-due').value = guessDueDate(raw);
    $('#task-notes').value = raw;
    quickAddPending = true;
    openAddDialog();
  }
  const puzzleData = {
    number: [
      { kind: 'NUMBER PATTERN', question: 'What number comes next?  2, 4, 8, 16, ___', answers: ['32'], hint: 'Each number is double the one before.' },
      { kind: 'NUMBER PATTERN', question: 'What number comes next?  3, 6, 9, 12, ___', answers: ['15'], hint: 'Add the same amount each time.' },
      { kind: 'NUMBER PATTERN', question: 'What number comes next?  1, 3, 6, 10, 15, ___', answers: ['21'], hint: 'The amount added goes up by one each time.' },
      { kind: 'NUMBER PATTERN', question: 'What number comes next?  5, 10, 20, 40, ___', answers: ['80'], hint: 'Each number is double the one before.' },
      { kind: 'NUMBER PATTERN', question: 'What number comes next?  100, 90, 80, ___', answers: ['70'], hint: 'Subtract ten each time.' }
    ],
    word: [
      { kind: 'WORD SCRAMBLE', question: 'Put these letters in order to make a word:  L P A E N', answers: ['plane'], hint: 'It can fly through the sky.' },
      { kind: 'WORD SCRAMBLE', question: 'Put these letters in order to make a word:  E L P P A', answers: ['apple'], hint: 'It is a crunchy fruit.' },
      { kind: 'WORD SCRAMBLE', question: 'Put these letters in order to make a word:  O O B K', answers: ['book'], hint: 'You can read a story in one.' },
      { kind: 'WORD SCRAMBLE', question: 'Put these letters in order to make a word:  T A E R W', answers: ['water'], hint: 'You drink it when you are thirsty.' },
      { kind: 'WORD SCRAMBLE', question: 'Put these letters in order to make a word:  O H C O S L', answers: ['school'], hint: 'A place where you learn.' }
    ],
    riddle: [
      { kind: 'MINI RIDDLE', question: 'What gets wetter the more it dries?', answers: ['towel', 'a towel'], hint: 'You might use one after a bath.' },
      { kind: 'MINI RIDDLE', question: 'What has many keys but cannot open a lock?', answers: ['piano', 'a piano'], hint: 'You can play music on it.' },
      { kind: 'MINI RIDDLE', question: 'What has to be broken before you can use it?', answers: ['egg', 'an egg'], hint: 'You might eat one for breakfast.' },
      { kind: 'MINI RIDDLE', question: 'What has one eye but cannot see?', answers: ['needle', 'a needle'], hint: 'It helps sew clothes.' },
      { kind: 'MINI RIDDLE', question: 'What has a neck but no head?', answers: ['bottle', 'a bottle'], hint: 'You can pour water from it.' }
    ]
  };
  function openPuzzle(key, index = 0) {
    const puzzles = puzzleData[key]; if (!puzzles) return;
    currentPuzzle = key;
    currentPuzzleIndex = index % puzzles.length;
    const puzzle = puzzles[currentPuzzleIndex];
    $('#puzzle-kind').textContent = `${puzzle.kind} · ${currentPuzzleIndex + 1} OF ${puzzles.length}`;
    $('#puzzle-prompt').textContent = puzzle.question;
    $('#puzzle-answer').value = '';
    $('#puzzle-feedback').textContent = '';
    $('#puzzle-feedback').classList.remove('is-correct');
    $('#puzzle-next').textContent = currentPuzzle === 'riddle' ? 'Next riddle →' : 'Next puzzle →';
    $('#puzzle-next').hidden = false;
    $('#puzzle-picker').hidden = true;
    $('#puzzle-play').hidden = false;
    $('#puzzle-answer').focus();
  }
  function resetPuzzlePicker() {
    currentPuzzle = null;
    currentPuzzleIndex = 0;
    $('#puzzle-picker').hidden = false;
    $('#puzzle-play').hidden = true;
    $('#puzzle-next').hidden = true;
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
    const remove = document.createElement('button'); remove.className = 'delete-task'; remove.type = 'button'; remove.textContent = 'Delete';
    remove.setAttribute('aria-label', `Delete ${task.title}`);
    remove.addEventListener('click', () => deleteTask(task.id));
    row.append(icon, main, subject, due, check, remove);
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
  function drawFlashcards() {
    const deck = $('#flashcard-deck');
    const cards = Array.isArray(state.flashcards) ? state.flashcards : [];
    $('#flashcard-count').textContent = String(cards.length);
    $('#flashcard-nav-count').textContent = String(cards.length);
    $('#quiz-start').disabled = cards.length === 0;
    deck.replaceChildren();
    if (!cards.length) {
      const empty = document.createElement('div'); empty.className = 'flashcard-empty';
      const title = document.createElement('strong'); title.textContent = 'Your deck is empty for now.';
      const copy = document.createElement('p'); copy.textContent = 'Make a card with a question on the front and an answer on the back.';
      empty.append(title, copy); deck.append(empty); return;
    }
    cards.forEach(card => {
      const item = document.createElement('article'); item.className = 'flashcard-entry';
      const face = document.createElement('button'); face.type = 'button'; face.className = 'flashcard-face'; face.setAttribute('aria-expanded', 'false');
      const side = document.createElement('span'); side.className = 'flashcard-side'; side.textContent = 'QUESTION · TAP TO FLIP';
      const text = document.createElement('span'); text.className = 'flashcard-face-text'; text.textContent = card.question;
      face.append(side, text);
      let showingAnswer = false;
      face.addEventListener('click', () => {
        showingAnswer = !showingAnswer;
        face.classList.toggle('is-flipped', showingAnswer);
        face.setAttribute('aria-expanded', String(showingAnswer));
        side.textContent = showingAnswer ? 'ANSWER · TAP TO FLIP BACK' : 'QUESTION · TAP TO FLIP';
        text.textContent = showingAnswer ? card.answer : card.question;
      });
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'flashcard-delete'; remove.textContent = '×';
      remove.setAttribute('aria-label', `Delete flashcard: ${card.question}`);
      remove.addEventListener('click', () => {
        state.flashcards = state.flashcards.filter(savedCard => savedCard.id !== card.id);
        saveState(); drawFlashcards(); showToast('Flashcard removed.');
      });
      item.append(face, remove); deck.append(item);
    });
  }
  function shuffledCards(cards) {
    const result = [...cards];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function startFlashcardQuiz() {
    if (!state.flashcards.length) { showToast('Add a flashcard first, then start a quiz.'); return; }
    quizState = { cards: shuffledCards(state.flashcards).slice(0, 5), index: 0, score: 0 };
    $('#flashcard-workspace').classList.add('hidden');
    $('#flashcard-quiz').hidden = false;
    renderQuizCard();
  }
  function renderQuizCard() {
    if (!quizState) return;
    const { cards, index, score } = quizState;
    const form = $('#quiz-form');
    const next = $('#quiz-next');
    const restart = $('#quiz-restart');
    $('#quiz-feedback').textContent = '';
    $('#quiz-feedback').classList.remove('is-correct');
    next.hidden = true; restart.hidden = true;
    if (index >= cards.length) {
      $('#quiz-progress').textContent = 'QUIZ FINISHED';
      $('#quiz-question').textContent = `You got ${score} out of ${cards.length} right.`;
      $('#quiz-feedback').textContent = score === cards.length ? 'Brilliant remembering! You can try again or make more cards.' : 'Nice practice. Try the cards again and see what sticks.';
      form.hidden = true; restart.hidden = false; return;
    }
    form.hidden = false;
    $('#quiz-progress').textContent = `CARD ${index + 1} OF ${cards.length}`;
    $('#quiz-question').textContent = cards[index].question;
    $('#quiz-answer').value = '';
    $('#quiz-check').disabled = false;
    $('#quiz-answer').focus();
  }
  function leaveFlashcardQuiz() {
    quizState = null;
    $('#flashcard-quiz').hidden = true;
    $('#flashcard-workspace').classList.remove('hidden');
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
  function closeAddDialog() {
    const dialog = $('#add-dialog');
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    quickAddPending = false;
  }
  function toggleTask(id) {
    const task = state.tasks.find(item => item.id === id); if (!task) return;
    task.done = !task.done; task.completedAt = task.done ? new Date().toISOString() : null;
    saveState(); drawTasks(); showToast(task.done ? 'Marked done. Nice work!' : 'Back on your list.');
  }
  function deleteTask(id) {
    const task = state.tasks.find(item => item.id === id); if (!task) return;
    if (!window.confirm(`Delete “${task.title}” from your schoolwork?`)) return;
    state.tasks = state.tasks.filter(item => item.id !== id);
    saveState(); drawTasks(); showToast('Schoolwork deleted.');
  }
  function showView(name) {
    if (name !== 'games' && currentPuzzle) resetPuzzlePicker();
    $$('.view').forEach(view => view.classList.toggle('active', view.id === `view-${name}`));
    $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === name));
    const labels = { overview: 'Overview', work: 'My work', study: 'Study room', flashcards: 'Flashcards', games: 'Mind games' };
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
  $('#task-dialog-close').addEventListener('click', closeAddDialog);
  $('#task-cancel').addEventListener('click', closeAddDialog);
  $('#add-dialog').addEventListener('cancel', () => { quickAddPending = false; });
  $('#tip-start').addEventListener('click', () => { showView('study'); startTimer(); });
  $$('.filter-pill').forEach(button => button.addEventListener('click', () => {
    currentFilter = button.dataset.filter;
    $$('.filter-pill').forEach(pill => pill.classList.toggle('active', pill === button)); drawTasks();
  }));
  $('#sort-select').addEventListener('change', event => { sortMode = event.target.value; drawTasks(); });
  $('#flashcard-form').addEventListener('submit', event => {
    event.preventDefault();
    const question = $('#flashcard-question').value.trim();
    const answer = $('#flashcard-answer').value.trim();
    if (!question || !answer) return;
    state.flashcards.unshift({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, question, answer, created: Date.now() });
    saveState(); drawFlashcards(); event.target.reset(); $('#flashcard-question').focus();
    showToast('Flashcard saved on this device.');
  });
  $('#quiz-start').addEventListener('click', startFlashcardQuiz);
  $('#quiz-back').addEventListener('click', leaveFlashcardQuiz);
  $('#quiz-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!quizState) return;
    const card = quizState.cards[quizState.index];
    const normalize = value => value.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    const guess = normalize($('#quiz-answer').value);
    if (!guess) return;
    const correct = guess === normalize(card.answer);
    if (correct) quizState.score += 1;
    const feedback = $('#quiz-feedback');
    feedback.textContent = correct ? 'That’s right! Nice remembering. ✨' : `Good try. The answer is: ${card.answer}`;
    feedback.classList.toggle('is-correct', correct);
    $('#quiz-check').disabled = true;
    $('#quiz-next').textContent = quizState.index + 1 === quizState.cards.length ? 'See my score →' : 'Next card →';
    $('#quiz-next').hidden = false;
  });
  $('#quiz-next').addEventListener('click', () => { if (!quizState) return; quizState.index += 1; renderQuizCard(); });
  $('#quiz-restart').addEventListener('click', startFlashcardQuiz);
  $('#task-form').addEventListener('submit', event => {
    event.preventDefault();
    const title = $('#task-title').value.trim(); if (!title) return;
    state.tasks.push({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, title, subject: $('#task-subject').value, due: $('#task-due').value, notes: $('#task-notes').value.trim(), done: false, created: Date.now(), steps: [] });
    saveState(); drawTasks(); $('#add-dialog').close(); event.target.reset();
    if (quickAddPending) $('#quick-add-input').value = '';
    quickAddPending = false;
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
  $('#quick-add-organize').addEventListener('click', organizeQuickAdd);
  $('#quick-add-input').addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') organizeQuickAdd();
  });
  $('#puzzle-back').addEventListener('click', resetPuzzlePicker);
  $$('[data-puzzle]').forEach(button => button.addEventListener('click', () => openPuzzle(button.dataset.puzzle)));
  $('#puzzle-next').addEventListener('click', () => {
    if (!currentPuzzle) return;
    openPuzzle(currentPuzzle, (currentPuzzleIndex + 1) % puzzleData[currentPuzzle].length);
  });
  $('#puzzle-answer-form').addEventListener('submit', event => {
    event.preventDefault();
    const puzzle = puzzleData[currentPuzzle]?.[currentPuzzleIndex]; if (!puzzle) return;
    const answer = $('#puzzle-answer').value.trim().toLowerCase().replace(/[.!?]+$/, '');
    const feedback = $('#puzzle-feedback');
    if (puzzle.answers.includes(answer)) {
      feedback.textContent = 'That’s right! Nice solving. ✨';
      feedback.classList.add('is-correct');
    } else {
      feedback.textContent = `Not quite—try again. Hint: ${puzzle.hint}`;
      feedback.classList.remove('is-correct');
    }
  });
  $('#profile-open').addEventListener('click', () => {
    $('#profile-name').value = state.profileName;
    $('#profile-dialog').showModal();
    $('#profile-name').focus();
  });
  $('#profile-close').addEventListener('click', () => $('#profile-dialog').close());
  $('#profile-cancel').addEventListener('click', () => $('#profile-dialog').close());
  $('#profile-form').addEventListener('submit', event => {
    event.preventDefault();
    state.profileName = $('#profile-name').value.trim();
    saveState();
    updateProfileButton();
    $('#profile-dialog').close();
    showToast(state.profileName ? 'Profile name saved on this device.' : 'Profile name cleared.');
  });
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY || event.key === null) refreshFromStorage();
  });
  window.addEventListener('focus', refreshFromStorage);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshFromStorage(); });

  const initialView = location.hash.replace('#', '');
  showView(['overview', 'work', 'study', 'flashcards', 'games'].includes(initialView) ? initialView : 'overview');
  if (state.topic) $('#topic-input').value = state.topic;
  updateProfileButton(); drawTasks(); drawFlashcards(); setTimerDisplay();
})();

