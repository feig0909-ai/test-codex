const CONFIG = {
  easy: { rows: 10, cols: 10, mines: 15 },
  normal: { rows: 14, cols: 14, mines: 32 },
  hard: { rows: 18, cols: 18, mines: 58 },
};

const boardEl = document.getElementById('board');
const timerEl = document.getElementById('timer');
const minesLeftEl = document.getElementById('mines-left');
const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const energyEl = document.getElementById('energy');
const eventsEl = document.getElementById('events');
const difficultyEl = document.getElementById('difficulty');
const newGameBtn = document.getElementById('new-game');
const scanBtn = document.getElementById('scan');
const pulseBtn = document.getElementById('pulse');
const cellTpl = document.getElementById('cell-template');

let state = null;

function message(text) {
  eventsEl.textContent = text;
}

function neighbors(r, c) {
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < state.rows && nc >= 0 && nc < state.cols) out.push([nr, nc]);
    }
  }
  return out;
}

function createCell(r, c) {
  return {
    r, c,
    mine: false,
    revealed: false,
    flagged: false,
    number: 0,
    el: null,
  };
}

function initGame() {
  const conf = CONFIG[difficultyEl.value];
  clearInterval(state?.timerId);
  state = {
    ...conf,
    board: [],
    started: false,
    over: false,
    time: 0,
    score: 0,
    combo: 1,
    energy: 0,
    flags: 0,
    safeRevealed: 0,
    timerId: null,
  };

  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${state.cols}, auto)`;

  for (let r = 0; r < state.rows; r++) {
    const row = [];
    for (let c = 0; c < state.cols; c++) {
      const cell = createCell(r, c);
      const el = cellTpl.content.firstElementChild.cloneNode(true);
      el.addEventListener('click', () => onLeftClick(cell));
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        onRightClick(cell);
      });
      cell.el = el;
      row.push(cell);
      boardEl.appendChild(el);
    }
    state.board.push(row);
  }

  updateHUD();
  message('新游戏开始：首击必定安全。右键可插旗。');
}

function layMines(safeR, safeC) {
  const forbidden = new Set([`${safeR},${safeC}`, ...neighbors(safeR, safeC).map(([r, c]) => `${r},${c}`)]);
  let placed = 0;
  while (placed < state.mines) {
    const r = Math.floor(Math.random() * state.rows);
    const c = Math.floor(Math.random() * state.cols);
    const cell = state.board[r][c];
    if (cell.mine || forbidden.has(`${r},${c}`)) continue;
    cell.mine = true;
    placed++;
  }
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = state.board[r][c];
      cell.number = neighbors(r, c).filter(([nr, nc]) => state.board[nr][nc].mine).length;
    }
  }
}

function startTimer() {
  state.timerId = setInterval(() => {
    state.time++;
    timerEl.textContent = state.time;
  }, 1000);
}

function updateHUD() {
  timerEl.textContent = state.time;
  minesLeftEl.textContent = Math.max(0, state.mines - state.flags);
  scoreEl.textContent = state.score;
  comboEl.textContent = `x${state.combo}`;
  energyEl.textContent = state.energy;
  scanBtn.disabled = state.energy < 100 || state.over;
  pulseBtn.disabled = state.energy < 160 || state.over;
}

function reveal(cell, byFlood = false) {
  if (cell.revealed || cell.flagged || state.over) return 0;
  cell.revealed = true;
  cell.el.classList.add('revealed');

  if (cell.mine) {
    cell.el.textContent = '💣';
    cell.el.classList.add('mine-hit');
    gameOver(false);
    return 0;
  }

  if (cell.number > 0) {
    cell.el.dataset.num = String(cell.number);
    cell.el.textContent = cell.number;
  }

  let gained = byFlood ? 5 : 12;
  if (cell.number === 0) gained += 6;
  state.score += gained * state.combo;
  state.energy = Math.min(200, state.energy + (byFlood ? 1 : 8));
  state.safeRevealed++;

  if (cell.number === 0) {
    for (const [nr, nc] of neighbors(cell.r, cell.c)) {
      reveal(state.board[nr][nc], true);
    }
  }

  return gained;
}

function onLeftClick(cell) {
  if (state.over || cell.flagged) return;
  if (!state.started) {
    layMines(cell.r, cell.c);
    state.started = true;
    startTimer();
  }

  const before = state.safeRevealed;
  reveal(cell);
  const delta = state.safeRevealed - before;

  if (!state.over) {
    if (delta >= 5) {
      state.combo = Math.min(9, state.combo + 1);
      message(`连锁揭开 ${delta} 格！连击提升到 x${state.combo}。`);
    } else if (delta === 0) {
      state.combo = 1;
    }
    randomEvent();
    checkWin();
  }

  updateHUD();
}

function onRightClick(cell) {
  if (state.over || cell.revealed) return;
  cell.flagged = !cell.flagged;
  cell.el.classList.toggle('flagged', cell.flagged);
  cell.el.textContent = cell.flagged ? '🚩' : '';
  state.flags += cell.flagged ? 1 : -1;
  state.score += cell.flagged ? 3 : -1;
  updateHUD();
}

function randomEvent() {
  // 小概率触发“量子扰动”：随机显示一个安全格提示
  if (Math.random() < 0.12) {
    const candidates = [];
    for (const row of state.board) {
      for (const cell of row) {
        if (!cell.revealed && !cell.flagged && !cell.mine) candidates.push(cell);
      }
    }
    if (candidates.length) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      pick.el.classList.add('safe-hint');
      setTimeout(() => pick.el.classList.remove('safe-hint'), 1200);
      message('✨ 量子扰动：检测到一个安全区域闪烁提示！');
    }
  }
}

function revealAllMines() {
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.mine) {
        cell.el.textContent = '💣';
        cell.el.classList.add('revealed');
      }
    }
  }
}

function gameOver(win) {
  state.over = true;
  clearInterval(state.timerId);

  if (win) {
    state.score += Math.max(0, 1500 - state.time * 4) + state.combo * 60;
    message('🏆 胜利！你成功稳定了雷区，获得时间与连击奖励。');
  } else {
    revealAllMines();
    state.score = Math.max(0, state.score - 120);
    message('💥 触雷了！小技巧：多利用扫描技能稳住局势。');
  }

  updateHUD();
}

function checkWin() {
  const target = state.rows * state.cols - state.mines;
  if (state.safeRevealed >= target) {
    gameOver(true);
  }
}

function useScan() {
  if (state.energy < 100 || state.over) return;
  state.energy -= 100;

  const hidden = [];
  for (const row of state.board) {
    for (const cell of row) {
      if (!cell.revealed) hidden.push(cell);
    }
  }
  if (!hidden.length) return;

  const center = hidden[Math.floor(Math.random() * hidden.length)];
  const area = [[center.r, center.c], ...neighbors(center.r, center.c)];
  let mines = 0;
  let safe = 0;
  for (const [r, c] of area) {
    const cell = state.board[r][c];
    if (cell.mine) mines++;
    else safe++;
    cell.el.classList.add('safe-hint');
    setTimeout(() => cell.el.classList.remove('safe-hint'), 900);
  }
  message(`🔍 扫描完成：附近3x3中大约 ${mines} 雷 / ${safe} 安全格。`);
  updateHUD();
}

function usePulse() {
  if (state.energy < 160 || state.over) return;
  const mines = [];
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.mine && !cell.revealed) mines.push(cell);
    }
  }
  if (!mines.length) {
    message('⚡ 脉冲未找到可净化地雷。');
    return;
  }

  state.energy -= 160;
  const target = mines[Math.floor(Math.random() * mines.length)];
  target.mine = false;
  state.mines = Math.max(0, state.mines - 1);

  // 重新计算数字
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      state.board[r][c].number = neighbors(r, c).filter(([nr, nc]) => state.board[nr][nc].mine).length;
    }
  }

  message('⚡ 脉冲成功：一个地雷被净化成安全格！');
  state.score += 55;
  updateHUD();
  checkWin();
}

newGameBtn.addEventListener('click', initGame);
scanBtn.addEventListener('click', useScan);
pulseBtn.addEventListener('click', usePulse);
difficultyEl.addEventListener('change', initGame);

initGame();
