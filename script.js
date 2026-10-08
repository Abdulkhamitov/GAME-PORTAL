// ==========================================================
// ===== МЕНЕДЖЕР ХРАНИЛИЩА (localStorage) =====
// ==========================================================
const Store = {
    KEYS: {
        THEME: 'gp_theme',
        MUSIC: 'gp_music',
        USERS: 'gp_users',
        CURRENT_USER: 'gp_current_user',
        LEADERBOARDS: 'gp_leaderboards'
    },

    get(key, def = null) {
        try {
            const v = localStorage.getItem(key);
            return v ? JSON.parse(v) : def;
        } catch { return def; }
    },

    set(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
    }
};

// ==========================================================
// ===== АВТОРИЗАЦИЯ =====
// ==========================================================
const Auth = {
    // Получить всех пользователей
    getUsers() {
        return Store.get(Store.KEYS.USERS, {});
    },

    // Текущий пользователь
    getCurrent() {
        return Store.get(Store.KEYS.CURRENT_USER, null);
    },

    // Регистрация
    register(nickname, password) {
        const users = this.getUsers();
        const key = nickname.toLowerCase();

        if (users[key]) {
            return { ok: false, error: 'Такой никнейм уже занят' };
        }

        const avatar = nickname.charAt(0).toUpperCase();
        users[key] = {
            nickname,
            password, // ВАЖНО: для демо, в реальном проекте используйте хеширование
            avatar,
            registered: Date.now(),
            totalScore: 0,
            gamesPlayed: 0,
            records: {} // { gameId: score }
        };

        Store.set(Store.KEYS.USERS, users);
        Store.set(Store.KEYS.CURRENT_USER, key);
        return { ok: true, user: users[key] };
    },

    // Вход
    login(nickname, password) {
        const users = this.getUsers();
        const key = nickname.toLowerCase();

        if (!users[key]) {
            return { ok: false, error: 'Игрок не найден' };
        }
        if (users[key].password !== password) {
            return { ok: false, error: 'Неверный пароль' };
        }

        Store.set(Store.KEYS.CURRENT_USER, key);
        return { ok: true, user: users[key] };
    },

    // Выход
    logout() {
        Store.set(Store.KEYS.CURRENT_USER, null);
    },

    // Обновить данные пользователя
    updateUser(callback) {
        const current = this.getCurrent();
        if (!current) return;

        const users = this.getUsers();
        callback(users[current]);
        Store.set(Store.KEYS.USERS, users);
    }
};

// ==========================================================
// ===== ТАБЛИЦА ЛИДЕРОВ =====
// ==========================================================
const Leaderboard = {
    // Получить все таблицы
    getAll() {
        return Store.get(Store.KEYS.LEADERBOARDS, {});
    },

    // Получить таблицу по игре
    get(gameId) {
        const all = this.getAll();
        return all[gameId] || [];
    },

    // Записать результат
    submit(gameId, score, type = 'high') {
        // type: 'high' — чем больше, тем лучше (snake, shooter, memory, puzzle)
        //       'low'  — чем меньше, тем лучше (reaction)
        //       'moves' — чем меньше, тем лучше (guess - попытки)

        const all = this.getAll();
        if (!all[gameId]) all[gameId] = [];

        const current = Auth.getCurrent();
        const users = Auth.getUsers();
        const user = current ? users[current] : null;

        const nickname = user ? user.nickname : 'Гость';
        const avatar = user ? user.avatar : 'Г';
        const date = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });

        const record = {
            nickname,
            avatar,
            score,
            date,
            timestamp: Date.now(),
            isCurrentUser: !!user,
            userId: current || null
        };

        all[gameId].push(record);

        // Сортировка
        all[gameId].sort((a, b) => {
            if (type === 'low' || type === 'moves') {
                return a.score - b.score;
            }
            return b.score - a.score;
        });

        // Оставляем только топ-20
        all[gameId] = all[gameId].slice(0, 20);

        Store.set(Store.KEYS.LEADERBOARDS, all);

        // Обновляем личный рекорд игрока
        if (user) {
            Auth.updateUser(u => {
                const prev = u.records[gameId];
                const isBetter = type === 'high'
                    ? (!prev || score > prev)
                    : (!prev || score < prev);

                if (isBetter) {
                    u.records[gameId] = score;
                }
                u.gamesPlayed = (u.gamesPlayed || 0) + 1;
                u.totalScore = (u.totalScore || 0) + (type === 'high' ? score : Math.max(0, 1000 - score));
            });
        }

        // Перерисовываем таблицу, если открыта
        if (currentBoard === gameId) {
            renderLeaderboard();
        }

        return record;
    },

    // Очистить таблицу
    clear(gameId) {
        const all = this.getAll();
        all[gameId] = [];
        Store.set(Store.KEYS.LEADERBOARDS, all);
        renderLeaderboard();
    }
};

// Какая таблица сейчас открыта
let currentBoard = 'snake';

// ==========================================================
// ===== РЕНДЕР ТАБЛИЦЫ ЛИДЕРОВ =====
// ==========================================================
function renderLeaderboard() {
    const body = document.getElementById('leaderboardBody');
    const data = Leaderboard.get(currentBoard);

    if (data.length === 0) {
        body.innerHTML = `
            <div class="leaderboard-empty">
                <span class="empty-icon">🏆</span>
                <p>Пока нет рекордов. Стань первым!</p>
            </div>`;
        return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    const current = Auth.getCurrent();

    body.innerHTML = data.map((r, i) => {
        const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        const rankContent = i < 3 ? medals[i] : `${i + 1}`;
        const isCurrent = current && r.userId === current;

        return `
            <div class="leader-row ${isCurrent ? 'current' : ''}">
                <span class="leader-rank ${rankClass}">${rankContent}</span>
                <span class="leader-name">
                    <span class="leader-avatar">${r.avatar}</span>
                    ${r.nickname}${isCurrent ? ' <span style="color:var(--neon-pink);font-size:12px;">(вы)</span>' : ''}
                </span>
                <span class="leader-score">${r.score}</span>
                <span class="leader-date">${r.date}</span>
            </div>
        `;
    }).join('');
}

// Обработчики переключения таблиц
document.querySelectorAll('.leader-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.leader-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentBoard = tab.dataset.board;
        renderLeaderboard();
    });
});

document.getElementById('clearBoard').addEventListener('click', () => {
    if (confirm('Уверены, что хотите очистить эту таблицу лидеров?')) {
        Leaderboard.clear(currentBoard);
    }
});

// ==========================================================
// ===== ЗВЁЗДНЫЙ ФОН =====
// ==========================================================
const bg = document.getElementById('bg');
const ctx = bg.getContext('2d');
let particles = [];

function resize() {
    bg.width = window.innerWidth;
    bg.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

function createParticles() {
    particles = [];
    const count = Math.min(120, window.innerWidth / 15);
    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * bg.width,
            y: Math.random() * bg.height,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            r: Math.random() * 2 + 0.5,
            color: Math.random() > 0.5 ? '0, 212, 255' : '255, 0, 110'
        });
    }
}
createParticles();
window.addEventListener('resize', createParticles);

function animateBg() {
    ctx.clearRect(0, 0, bg.width, bg.height);
    particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > bg.width) p.vx *= -1;
        if (p.y < 0 || p.y > bg.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, 0.7)`;
        ctx.fill();

        particles.slice(i + 1).forEach(p2 => {
            const dx = p.x - p2.x;
            const dy = p.y - p2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 130) {
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.strokeStyle = `rgba(0, 212, 255, ${0.15 * (1 - dist / 130)})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        });
    });
    requestAnimationFrame(animateBg);
}
animateBg();

// ==========================================================
// ===== СЧЁТЧИКИ =====
// ==========================================================
function animateCounter(el, target, duration = 2000) {
    let current = 0;
    const step = target / (duration / 16);
    const update = () => {
        current += step;
        if (current < target) {
            el.textContent = Math.floor(current).toLocaleString('ru-RU');
            requestAnimationFrame(update);
        } else {
            el.textContent = target.toLocaleString('ru-RU');
        }
    };
    update();
}

window.addEventListener('load', () => {
    animateCounter(document.getElementById('statPlayers'), 1247);
    animateCounter(document.getElementById('statGames'), 1000);
});

// ==========================================================
// ===== ТЕМА =====
// ==========================================================
const themeBtn = document.getElementById('themeBtn');
const savedTheme = Store.get(Store.KEYS.THEME, 'dark');
document.body.dataset.theme = savedTheme;
themeBtn.textContent = savedTheme === 'dark' ? '🌙' : '☀️';

themeBtn.addEventListener('click', () => {
    const newTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    document.body.dataset.theme = newTheme;
    themeBtn.textContent = newTheme === 'dark' ? '🌙' : '☀️';
    Store.set(Store.KEYS.THEME, newTheme);
});

// ==========================================================
// ===== ФОНОВАЯ МУЗЫКА =====
// ==========================================================
const musicBtn = document.getElementById('musicBtn');
const musicIndicator = document.getElementById('musicIndicator');

// Синтезируем фоновую музыку через Web Audio API (не требует mp3-файла)
let audioCtx = null;
let musicPlaying = false;
let musicTimer = null;
let musicNodes = [];

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Простая мелодия — генерируем ноты
function playNote(freq, time, duration, volume = 0.08, type = 'sine') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(time);
    osc.stop(time + duration);

    musicNodes.push(osc);
}

// Мелодия (frequencies в Гц)
const NOTES = {
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00,
    C3: 130.81, E3: 164.81, G3: 196.00, A3: 220.00
};

// Простая чиллаут-мелодия (зацикленная)
const melody = [
    { note: 'C4', dur: 0.4 },
    { note: 'E4', dur: 0.4 },
    { note: 'G4', dur: 0.4 },
    { note: 'E4', dur: 0.4 },
    { note: 'A4', dur: 0.4 },
    { note: 'G4', dur: 0.4 },
    { note: 'E4', dur: 0.8 },
    { note: 'D4', dur: 0.4 },
    { note: 'F4', dur: 0.4 },
    { note: 'A4', dur: 0.4 },
    { note: 'F4', dur: 0.4 },
    { note: 'G4', dur: 0.4 },
    { note: 'E4', dur: 0.4 },
    { note: 'C4', dur: 0.8 },
];

// Басовая линия
const bassLine = [
    { note: 'C3', dur: 1.6 },
    { note: 'A3', dur: 1.6 },
    { note: 'F3', dur: 1.6 },
    { note: 'G3', dur: 1.6 },
];

function playLoop() {
    if (!musicPlaying) return;
    const now = audioCtx.currentTime;
    let t = 0;

    // Мелодия
    melody.forEach(n => {
        playNote(NOTES[n.note], now + t, n.dur * 0.9, 0.06, 'sine');
        t += n.dur;
    });

    const melodyDuration = t;

    // Бас (играет параллельно)
    let bt = 0;
    bassLine.forEach(n => {
        playNote(NOTES[n.note], now + bt, n.dur * 0.9, 0.04, 'triangle');
        bt += n.dur;
    });

    // Повторяем через длительность мелодии
    musicTimer = setTimeout(() => playLoop(), melodyDuration * 1000);
}

function startMusic() {
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    musicPlaying = true;
    playLoop();
    musicIndicator.classList.add('active');
    musicBtn.textContent = '🔊';
    Store.set(Store.KEYS.MUSIC, true);
}

function stopMusic() {
    musicPlaying = false;
    if (musicTimer) clearTimeout(musicTimer);
    musicNodes.forEach(n => { try { n.stop(); } catch {} });
    musicNodes = [];
    musicIndicator.classList.remove('active');
    musicBtn.textContent = '🎵';
    Store.set(Store.KEYS.MUSIC, false);
}

// Восстанавливаем состояние музыки при загрузке
const musicWasOn = Store.get(Store.KEYS.MUSIC, false);
if (musicWasOn) {
    // Автовоспроизведение требует взаимодействия пользователя — ждём первый клик
    const autoStart = () => {
        startMusic();
        document.removeEventListener('click', autoStart);
    };
    document.addEventListener('click', autoStart, { once: true });
    musicBtn.textContent = '🔊';
    musicIndicator.classList.add('active');
}

musicBtn.addEventListener('click', () => {
    if (musicPlaying) stopMusic();
    else startMusic();
});

// ==========================================================
// ===== АВТОРИЗАЦИЯ (UI) =====
// ==========================================================
const authModal = document.getElementById('authModal');
const profileModal = document.getElementById('profileModal');
const userBtn = document.getElementById('userBtn');
const authForm = document.getElementById('authForm');
const authTitle = document.getElementById('authTitle');
const authSubtitle = document.getElementById('authSubtitle');
const authSubmit = document.getElementById('authSubmit');
const authMessage = document.getElementById('authMessage');
const authToggleText = document.getElementById('authToggleText');
const authToggleLink = document.getElementById('authToggleLink');

let authMode = 'register'; // 'register' | 'login'

function openAuthModal(mode = 'register') {
    authMode = mode;
    authMessage.textContent = '';
    authForm.reset();

    if (mode === 'register') {
        authTitle.textContent = 'Регистрация';
        authSubtitle.textContent = 'Создай аккаунт, чтобы сохранять рекорды';
        authSubmit.textContent = 'Зарегистрироваться';
        authToggleText.textContent = 'Уже есть аккаунт?';
        authToggleLink.textContent = 'Войти';
    } else {
        authTitle.textContent = 'Вход';
        authSubtitle.textContent = 'Войди, чтобы продолжить игру';
        authSubmit.textContent = 'Войти';
        authToggleText.textContent = 'Нет аккаунта?';
        authToggleLink.textContent = 'Создать';
    }

    authModal.classList.add('active');
    setTimeout(() => document.getElementById('authNickname').focus(), 300);
}

function closeModal(modal) {
    modal.classList.remove('active');
}

authToggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    openAuthModal(authMode === 'register' ? 'login' : 'register');
});

document.getElementById('authClose').addEventListener('click', () => closeModal(authModal));
document.getElementById('profileClose').addEventListener('click', () => closeModal(profileModal));

authModal.addEventListener('click', (e) => {
    if (e.target === authModal) closeModal(authModal);
});
profileModal.addEventListener('click', (e) => {
    if (e.target === profileModal) closeModal(profileModal);
});

// Отправка формы регистрации/входа
authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const nickname = document.getElementById('authNickname').value.trim();
    const password = document.getElementById('authPassword').value;

    if (!nickname || !password) {
        authMessage.textContent = 'Заполни все поля';
        return;
    }

    let result;
    if (authMode === 'register') {
        result = Auth.register(nickname, password);
    } else {
        result = Auth.login(nickname, password);
    }

    if (result.ok) {
        authMessage.style.color = 'var(--neon-green)';
        authMessage.textContent = authMode === 'register' ? '🎉 Аккаунт создан!' : '✅ Вход выполнен!';
        updateAuthUI();
        setTimeout(() => {
            closeModal(authModal);
            renderLeaderboard();
        }, 800);
    } else {
        authMessage.style.color = 'var(--neon-pink)';
        authMessage.textContent = '❌ ' + result.error;
    }
});

// Кнопка "Профиль"
userBtn.addEventListener('click', () => {
    const user = Auth.getCurrent();
    if (user) {
        openProfile();
    } else {
        openAuthModal('register');
    }
});

function updateAuthUI() {
    const user = Auth.getCurrent();
    if (user) {
        userBtn.classList.add('active');
        userBtn.textContent = user.avatar;
        userBtn.title = user.nickname;
    } else {
        userBtn.classList.remove('active');
        userBtn.textContent = '👤';
        userBtn.title = 'Войти';
    }
}

// Профиль
function openProfile() {
    const current = Auth.getCurrent();
    if (!current) return;
    const users = Auth.getUsers();
    const user = users[current];
    if (!user) return;

    document.getElementById('profileAvatar').textContent = user.avatar;
    document.getElementById('profileName').textContent = user.nickname;
    document.getElementById('profileTotalScore').textContent = user.totalScore || 0;
    document.getElementById('profileGamesPlayed').textContent = user.gamesPlayed || 0;

    // Достижения (за каждую игру с рекордом)
    const achievements = Object.keys(user.records || {}).length;
    document.getElementById('profileAchievements').textContent = achievements;

    // Рекорды
    const gameNames = {
        snake: '🐍 Змейка',
        guess: '🧠 Угадай число',
        reaction: '🎯 Реакция',
        puzzle: '🧩 Пятнашки',
        memory: '🃏 Память',
        shooter: '👾 Шутер'
    };

    const recordsEl = document.getElementById('profileRecords');
    const records = user.records || {};
    const keys = Object.keys(records);

    if (keys.length === 0) {
        recordsEl.innerHTML = '<div class="profile-record-empty">Пока нет рекордов. Играй!</div>';
    } else {
        recordsEl.innerHTML = keys.map(g => `
            <div class="profile-record-item">
                <span>${gameNames[g] || g}</span>
                <strong>${records[g]}</strong>
            </div>
        `).join('');
    }

    profileModal.classList.add('active');
}

// Выход
document.getElementById('logoutBtn').addEventListener('click', () => {
    Auth.logout();
    updateAuthUI();
    closeModal(profileModal);
    renderLeaderboard();
});

// ==========================================================
// ===== БУРГЕР-МЕНЮ =====
// ==========================================================
const burger = document.getElementById('burger');
const navLinks = document.querySelector('.nav-links');

burger.addEventListener('click', () => navLinks.classList.toggle('active'));
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => navLinks.classList.remove('active'));
});

// ==========================================================
// ===== ПЛАВНАЯ ПРОКРУТКА =====
// ==========================================================
document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
});

// ==========================================================
// ===== ФИЛЬТРЫ КАТАЛОГА =====
// ==========================================================
document.querySelectorAll('.filter').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        document.querySelectorAll('.game-card').forEach(card => {
            if (filter === 'all' || card.dataset.category === filter) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        });
    });
});

// ==========================================================
// ===== NAVBAR ПРИ СКРОЛЛЕ =====
// ==========================================================
window.addEventListener('scroll', () => {
    const nav = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        nav.style.padding = window.innerWidth < 900 ? '12px 20px' : '12px 50px';
    } else {
        nav.style.padding = window.innerWidth < 900 ? '15px 20px' : '18px 50px';
    }
});

// ==========================================================
// ===== ФОРМА КОНТАКТОВ =====
// ==========================================================
const form = document.getElementById('contactForm');
const formMsg = document.getElementById('formMessage');
form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nick = form.querySelector('input[type="text"]').value;
    formMsg.textContent = `Спасибо, ${nick}! Твоё сообщение отправлено в штаб GAMEPORTAL 🎮`;
    form.reset();
    setTimeout(() => formMsg.textContent = '', 4000);
});

// ==========================================================
// ===== ИГРОВАЯ ЗОНА =====
// ==========================================================
const gameBody = document.getElementById('gameBody');
const gameTitle = document.getElementById('gameTitle');
const gameScoreEl = document.getElementById('gameScore');
const gameBestEl = document.getElementById('gameBest');
const closeBtn = document.getElementById('closeGame');

let currentGame = null;
let gameScore = 0;
let gameBest = 0;

// Типы таблиц: 'high' — больше = лучше, 'low' — меньше = лучше
const GAME_TYPES = {
    snake: 'high',
    guess: 'low',     // меньше попыток = лучше
    reaction: 'low',  // меньше время = лучше
    puzzle: 'low',    // меньше ходов = лучше
    memory: 'low',    // меньше ходов = лучше
    shooter: 'high'
};

function setScore(v) {
    gameScore = v;
    gameScoreEl.textContent = v;
    if (v > gameBest) {
        gameBest = v;
        gameBestEl.textContent = v;
    }
}

function resetScore() {
    // Показываем личный рекорд, если пользователь залогинен
    const user = Auth.getCurrent();
    const users = Auth.getUsers();
    const u = user ? users[user] : null;

    gameBest = (u && u.records && u.records[currentGame]) || 0;
    gameBestEl.textContent = gameBest;

    gameScore = 0;
    gameScoreEl.textContent = 0;
}

// Отправить результат в таблицу лидеров
function submitScore(gameId, score) {
    const type = GAME_TYPES[gameId] || 'high';
    Leaderboard.submit(gameId, score, type);
}

closeBtn.addEventListener('click', () => {
    currentGame = null;
    resetScore();
    gameTitle.textContent = '🎮 Выбери игру';
    gameBody.innerHTML = `
        <div class="game-placeholder">
            <div class="placeholder-icon">🎮</div>
            <p>Нажми <strong>«Играть»</strong> на любой карточке, чтобы запустить игру</p>
        </div>`;
});

document.querySelectorAll('.play-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const game = btn.dataset.game;
        document.getElementById('play').scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => startGame(game), 500);
    });
});

function startGame(game) {
    currentGame = game;
    resetScore();

    if (game === 'snake') startSnake();
    else if (game === 'guess') startGuess();
    else if (game === 'reaction') startReaction();
    else if (game === 'puzzle') startPuzzle();
    else if (game === 'memory') startMemory();
    else if (game === 'shooter') startShooter();
}

// ========== 🐍 ЗМЕЙКА ==========
function startSnake() {
    gameTitle.textContent = '🐍 Змейка';
    gameBody.innerHTML = `
        <div style="text-align:center;">
            <canvas id="snakeCanvas" class="game-canvas" width="400" height="400"></canvas>
            <div class="game-controls">
                <div class="game-message" id="snakeMsg">Управление: стрелки или WASD</div>
                <button class="game-btn" id="snakeRestart">Начать заново</button>
            </div>
        </div>`;

    const canvas = document.getElementById('snakeCanvas');
    const c = canvas.getContext('2d');
    const size = 20;
    const cells = canvas.width / size;

    let snake = [{ x: 10, y: 10 }];
    let dir = { x: 1, y: 0 };
    let nextDir = { x: 1, y: 0 };
    let food = randFood();
    let score = 0;
    let alive = true;
    let loop;

    function randFood() {
        let f;
        do {
            f = { x: Math.floor(Math.random() * cells), y: Math.floor(Math.random() * cells) };
        } while (snake.some(s => s.x === f.x && s.y === f.y));
        return f;
    }

    function draw() {
        c.fillStyle = '#050510';
        c.fillRect(0, 0, canvas.width, canvas.height);
        c.strokeStyle = 'rgba(0, 212, 255, 0.06)';
        for (let i = 0; i <= cells; i++) {
            c.beginPath();
            c.moveTo(i * size, 0); c.lineTo(i * size, canvas.height);
            c.moveTo(0, i * size); c.lineTo(canvas.width, i * size);
            c.stroke();
        }
        c.fillStyle = '#ff006e';
        c.shadowBlur = 20;
        c.shadowColor = '#ff006e';
        c.beginPath();
        c.arc(food.x * size + size / 2, food.y * size + size / 2, size / 2 - 2, 0, Math.PI * 2);
        c.fill();
        c.shadowBlur = 0;
        snake.forEach((s, i) => {
            c.fillStyle = i === 0 ? '#00ff9d' : '#00d4ff';
            c.shadowBlur = i === 0 ? 20 : 10;
            c.shadowColor = i === 0 ? '#00ff9d' : '#00d4ff';
            c.fillRect(s.x * size + 1, s.y * size + 1, size - 2, size - 2);
        });
        c.shadowBlur = 0;
    }

    function step() {
        if (!alive) return;
        dir = nextDir;
        const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

        if (head.x < 0 || head.x >= cells || head.y < 0 || head.y >= cells ||
            snake.some(s => s.x === head.x && s.y === head.y)) {
            alive = false;
            document.getElementById('snakeMsg').textContent = `💀 Игра окончена! Счёт: ${score}`;
            submitScore('snake', score);
            return;
        }

        snake.unshift(head);
        if (head.x === food.x && head.y === food.y) {
            score += 10;
            setScore(score);
            food = randFood();
        } else {
            snake.pop();
        }
        draw();
    }

    function onKey(e) {
        const k = e.key.toLowerCase();
        if ((k === 'arrowup' || k === 'w') && dir.y === 0) nextDir = { x: 0, y: -1 };
        else if ((k === 'arrowdown' || k === 's') && dir.y === 0) nextDir = { x: 0, y: 1 };
        else if ((k === 'arrowleft' || k === 'a') && dir.x === 0) nextDir = { x: -1, y: 0 };
        else if ((k === 'arrowright' || k === 'd') && dir.x === 0) nextDir = { x: 1, y: 0 };
        else return;
        e.preventDefault();
    }

    document.addEventListener('keydown', onKey);

    document.getElementById('snakeRestart').addEventListener('click', () => {
        clearInterval(loop);
        document.removeEventListener('keydown', onKey);
        startSnake();
    });

    draw();
    loop = setInterval(step, 120);
}

// ========== 🧠 УГАДАЙ ЧИСЛО ==========
function startGuess() {
    gameTitle.textContent = '🧠 Угадай число';
    const secret = Math.floor(Math.random() * 100) + 1;
    let tries = 0;

    gameBody.innerHTML = `
        <div style="text-align:center;">
            <p style="color:var(--text-secondary); margin-bottom:20px;">Я загадал число от 1 до 100. Попробуй угадать!</p>
            <div class="guess-input">
                <input type="number" id="guessInput" min="1" max="100" placeholder="?" autofocus>
                <button class="game-btn" id="guessBtn">Проверить</button>
            </div>
            <div class="game-message" id="guessMsg" style="margin-top:20px;"></div>
            <button class="game-btn" id="guessRestart" style="margin-top:15px;">Новая игра</button>
        </div>`;

    const input = document.getElementById('guessInput');
    const msg = document.getElementById('guessMsg');
    const btn = document.getElementById('guessBtn');

    function check() {
        const val = parseInt(input.value);
        if (!val || val < 1 || val > 100) {
            msg.textContent = '⚠ Введи число от 1 до 100';
            msg.style.color = '#ffd93d';
            return;
        }
        tries++;
        setScore(tries);

        if (val === secret) {
            msg.textContent = `🎉 Угадал! Число ${secret}. Попыток: ${tries}`;
            msg.style.color = '#00ff9d';
            btn.disabled = true;
            submitScore('guess', tries);
        } else if (val < secret) {
            msg.textContent = `📈 Больше! (попытка ${tries})`;
            msg.style.color = '#00d4ff';
        } else {
            msg.textContent = `📉 Меньше! (попытка ${tries})`;
            msg.style.color = '#ff006e';
        }
        input.value = '';
        input.focus();
    }

    btn.addEventListener('click', check);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') check();
    });
    document.getElementById('guessRestart').addEventListener('click', startGuess);
}

// ========== 🎯 РЕАКЦИЯ ==========
function startReaction() {
    gameTitle.textContent = '🎯 Реакция';
    gameBody.innerHTML = `
        <div style="text-align:center;">
            <p style="color:var(--text-secondary); margin-bottom:20px;">Кликни, когда экран станет зелёным!</p>
            <div class="reaction-box" id="reactionBox" style="background:#ff006e;">
                Нажми, чтобы начать
            </div>
            <div class="game-message" id="reactionMsg" style="margin-top:15px;"></div>
            <button class="game-btn" id="reactionRestart" style="margin-top:15px;">Заново</button>
        </div>`;

    const box = document.getElementById('reactionBox');
    const msg = document.getElementById('reactionMsg');
    let state = 'idle';
    let startTime = 0;
    let timeout;

    box.addEventListener('click', () => {
        if (state === 'idle') {
            state = 'waiting';
            box.style.background = '#ffaa00';
            box.textContent = 'Жди зелёного...';
            msg.textContent = '';
            const delay = 1500 + Math.random() * 3000;
            timeout = setTimeout(() => {
                state = 'ready';
                box.style.background = '#00ff9d';
                box.textContent = 'ЖМИ!';
                startTime = performance.now();
            }, delay);
        } else if (state === 'waiting') {
            clearTimeout(timeout);
            state = 'idle';
            box.style.background = '#ff006e';
            box.textContent = 'Слишком рано! Нажми, чтобы начать';
            msg.textContent = '❌ Поспешил!';
            msg.style.color = '#ff006e';
        } else if (state === 'ready') {
            const time = Math.round(performance.now() - startTime);
            setScore(time);
            state = 'idle';
            box.style.background = '#8338ec';
            box.textContent = `${time} мс`;
            msg.textContent = time < 250 ? '🔥 Молния!' : time < 400 ? '⚡ Отлично!' : '👍 Неплохо!';
            msg.style.color = '#00ff9d';
            submitScore('reaction', time);
        }
    });

    document.getElementById('reactionRestart').addEventListener('click', startReaction);
}

// ========== 🧩 ПЯТНАШКИ ==========
function startPuzzle() {
    gameTitle.textContent = '🧩 Пятнашки';
    let tiles = [...Array(9).keys()].slice(1).concat(0);
    tiles = shuffle(tiles);

    function shuffle(a) {
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function render() {
        gameBody.innerHTML = `
            <div style="text-align:center;">
                <p style="color:var(--text-secondary); margin-bottom:20px;">Собери числа от 1 до 8 по порядку</p>
                <div class="puzzle-grid" id="puzzleGrid"></div>
                <div class="game-message" id="puzzleMsg" style="margin-top:20px;"></div>
                <button class="game-btn" id="puzzleRestart" style="margin-top:15px;">Перемешать</button>
            </div>`;
        const grid = document.getElementById('puzzleGrid');
        tiles.forEach((t, i) => {
            const b = document.createElement('button');
            b.className = 'puzzle-tile' + (t === 0 ? ' empty' : '');
            b.textContent = t === 0 ? '' : t;
            b.addEventListener('click', () => moveTile(i));
            grid.appendChild(b);
        });
        checkWin();
    }

    function moveTile(i) {
        const emptyIdx = tiles.indexOf(0);
        const [r1, c1] = [Math.floor(i / 3), i % 3];
        const [r2, c2] = [Math.floor(emptyIdx / 3), emptyIdx % 3];
        const dist = Math.abs(r1 - r2) + Math.abs(c1 - c2);
        if (dist === 1) {
            [tiles[i], tiles[emptyIdx]] = [tiles[emptyIdx], tiles[i]];
            setScore(gameScore + 1);
            render();
        }
    }

    function checkWin() {
        const solved = tiles.every((v, i) => v === (i + 1) % 9);
        if (solved) {
            const msg = document.getElementById('puzzleMsg');
            if (msg) {
                msg.textContent = `🎉 Победа! Ходов: ${gameScore}`;
                msg.style.color = '#00ff9d';
                submitScore('puzzle', gameScore);
            }
        }
    }

    render();
    document.getElementById('puzzleRestart')?.addEventListener('click', () => {
        tiles = shuffle(tiles);
        setScore(0);
        startPuzzle();
    });
}

// ========== 🃏 ПАМЯТЬ ==========
function startMemory() {
    gameTitle.textContent = '🃏 Память';
    const icons = ['🎮', '🎲', '🕹️', '👾', '🏆', '⭐', '🚀', '💎'];
    const deck = [...icons, ...icons].sort(() => Math.random() - 0.5);

    let flipped = [];
    let matched = 0;
    let moves = 0;

    gameBody.innerHTML = `
        <div style="text-align:center;">
            <p style="color:var(--text-secondary); margin-bottom:20px;">Найди все пары карточек</p>
            <div class="memory-grid" id="memoryGrid"></div>
            <div class="game-message" id="memoryMsg" style="margin-top:20px;"></div>
            <button class="game-btn" id="memoryRestart" style="margin-top:15px;">Заново</button>
        </div>`;

    const grid = document.getElementById('memoryGrid');
    deck.forEach((icon, i) => {
        const card = document.createElement('div');
        card.className = 'memory-card';
        card.dataset.icon = icon;
        card.dataset.index = i;
        card.textContent = '?';
        card.addEventListener('click', () => flipCard(card));
        grid.appendChild(card);
    });

    function flipCard(card) {
        if (card.classList.contains('flipped') || card.classList.contains('matched')) return;
        if (flipped.length === 2) return;

        card.classList.add('flipped');
        card.textContent = card.dataset.icon;
        flipped.push(card);

        if (flipped.length === 2) {
            moves++;
            setScore(moves);
            if (flipped[0].dataset.icon === flipped[1].dataset.icon) {
                flipped.forEach(c => c.classList.add('matched'));
                matched++;
                flipped = [];
                if (matched === 8) {
                    const msg = document.getElementById('memoryMsg');
                    msg.textContent = `🎉 Победа! Ходов: ${moves}`;
                    msg.style.color = '#00ff9d';
                    submitScore('memory', moves);
                }
            } else {
                setTimeout(() => {
                    flipped.forEach(c => {
                        c.classList.remove('flipped');
                        c.textContent = '?';
                    });
                    flipped = [];
                }, 800);
            }
        }
    }

    document.getElementById('memoryRestart').addEventListener('click', () => {
        setScore(0);
        startMemory();
    });
}

// ========== 👾 КОСМИЧЕСКИЙ ШУТЕР ==========
function startShooter() {
    gameTitle.textContent = '👾 Космический шутер';
    gameBody.innerHTML = `
        <div style="text-align:center;">
            <canvas id="shooterCanvas" class="game-canvas" width="500" height="500"></canvas>
            <div class="game-controls">
                <div class="game-message" id="shooterMsg">← → для движения, ПРОБЕЛ для выстрела</div>
                <button class="game-btn" id="shooterRestart">Начать заново</button>
            </div>
        </div>`;

    const canvas = document.getElementById('shooterCanvas');
    const c = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    const player = { x: W / 2, y: H - 40, w: 40, h: 30, speed: 6 };
    let bullets = [];
    let enemies = [];
    let particles = [];
    let keys = {};
    let score = 0;
    let alive = true;
    let spawnTimer = 0;
    let loop;

    function spawnEnemy() {
        enemies.push({
            x: Math.random() * (W - 30) + 15,
            y: -20,
            r: 15,
            vy: 1.5 + Math.random() * 1.5,
            vx: (Math.random() - 0.5) * 1.5
        });
    }

    function explode(x, y, color) {
        for (let i = 0; i < 15; i++) {
            particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                life: 30,
                color
            });
        }
    }

    function update() {
        if (!alive) return;

        if (keys['arrowleft'] || keys['a']) player.x -= player.speed;
        if (keys['arrowright'] || keys['d']) player.x += player.speed;
        player.x = Math.max(player.w / 2, Math.min(W - player.w / 2, player.x));

        bullets = bullets.filter(b => {
            b.y -= 8;
            return b.y > -10;
        });

        spawnTimer++;
        if (spawnTimer > 40) { spawnEnemy(); spawnTimer = 0; }

        enemies.forEach(e => {
            e.y += e.vy;
            e.x += e.vx;
            if (e.x < e.r || e.x > W - e.r) e.vx *= -1;

            if (e.y + e.r > player.y - player.h / 2 &&
                Math.abs(e.x - player.x) < player.w / 2 + e.r) {
                alive = false;
                explode(e.x, e.y, '#ff006e');
                document.getElementById('shooterMsg').textContent = `💀 Игра окончена! Счёт: ${score}`;
                submitScore('shooter', score);
            }
        });

        bullets.forEach((b, bi) => {
            enemies.forEach((e, ei) => {
                const dx = b.x - e.x, dy = b.y - e.y;
                if (Math.sqrt(dx * dx + dy * dy) < e.r + 3) {
                    explode(e.x, e.y, '#00ff9d');
                    enemies.splice(ei, 1);
                    bullets.splice(bi, 1);
                    score += 10;
                    setScore(score);
                }
            });
        });

        enemies = enemies.filter(e => e.y < H + 30);

        particles = particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            return p.life > 0;
        });
    }

    function draw() {
        c.fillStyle = '#050510';
        c.fillRect(0, 0, W, H);

        for (let i = 0; i < 50; i++) {
            c.fillStyle = `rgba(255,255,255,${Math.random() * 0.5})`;
            c.fillRect((i * 97) % W, (i * 53 + Date.now() * 0.05) % H, 1, 1);
        }

        c.fillStyle = '#00d4ff';
        c.shadowBlur = 20;
        c.shadowColor = '#00d4ff';
        c.beginPath();
        c.moveTo(player.x, player.y - player.h / 2);
        c.lineTo(player.x - player.w / 2, player.y + player.h / 2);
        c.lineTo(player.x + player.w / 2, player.y + player.h / 2);
        c.closePath();
        c.fill();

        c.shadowColor = '#00ff9d';
        bullets.forEach(b => {
            c.fillStyle = '#00ff9d';
            c.shadowBlur = 15;
            c.fillRect(b.x - 2, b.y - 8, 4, 12);
        });

        c.shadowColor = '#ff006e';
        enemies.forEach(e => {
            c.fillStyle = '#ff006e';
            c.shadowBlur = 15;
            c.beginPath();
            c.arc(e.x, e.y, e.r, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = '#fff';
            c.shadowBlur = 0;
            c.beginPath();
            c.arc(e.x, e.y, 4, 0, Math.PI * 2);
            c.fill();
        });

        particles.forEach(p => {
            c.fillStyle = p.color;
            c.globalAlpha = p.life / 30;
            c.fillRect(p.x, p.y, 3, 3);
            c.globalAlpha = 1;
        });
        c.shadowBlur = 0;
    }

    function loopFn() {
        update();
        draw();
        if (alive) loop = requestAnimationFrame(loopFn);
    }

    function onKeyDown(e) {
        keys[e.key.toLowerCase()] = true;
        if (e.key === ' ') {
            e.preventDefault();
            if (alive) bullets.push({ x: player.x, y: player.y - player.h / 2 });
        }
    }
    function onKeyUp(e) { keys[e.key.toLowerCase()] = false; }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    document.getElementById('shooterRestart').addEventListener('click', () => {
        cancelAnimationFrame(loop);
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('keyup', onKeyUp);
        setScore(0);
        startShooter();
    });

    loopFn();
}

// ==========================================================
// ===== ИНИЦИАЛИЗАЦИЯ =====
// ==========================================================
updateAuthUI();
renderLeaderboard();

// Подсказка для новых пользователей
if (!Auth.getCurrent()) {
    setTimeout(() => {
        const hint = document.createElement('div');
        hint.style.cssText = `
            position: fixed; bottom: 20px; left: 20px;
            background: linear-gradient(135deg, var(--neon-blue), var(--neon-purple));
            color: #fff; padding: 15px 25px; border-radius: 12px;
            font-weight: 600; z-index: 500; max-width: 300px;
            box-shadow: 0 10px 40px var(--shadow-color);
            animation: fadeUp 0.6s ease; cursor: pointer;
        `;
        hint.innerHTML = '👋 Зарегистрируйся, чтобы твои рекорды попали в таблицу лидеров!';
        hint.addEventListener('click', () => {
            hint.remove();
            openAuthModal('register');
        });
        document.body.appendChild(hint);
        setTimeout(() => hint.remove(), 8000);
    }, 3000);
}
