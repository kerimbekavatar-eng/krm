// === GAME STATE ===
let peer = null;
let conn = null;
let mySide = null;
let isMyTurn = false;
let gameActive = false;
let boardState = Array(9).fill(null);
let currentTurn = 'X';
let players = { X: 'Хост', O: 'Гость' };
let myRoomCode = '';

// === DOM ELEMENTS ===
const $ = id => document.getElementById(id);
const lobbyScreen = $('lobby');
const waitingScreen = $('waiting');
const gameScreen = $('game');
const playerNameInput = $('playerName');
const roomCodeInput = $('roomCodeInput');
const createBtn = $('createBtn');
const joinBtn = $('joinBtn');
const copyBtn = $('copyBtn');
const displayCode = $('displayCode');
const cells = document.querySelectorAll('.cell');
const status = $('status');
const rematchBtn = $('rematchBtn');
const playerXName = $('playerXName');
const playerOName = $('playerOName');
const toast = $('toast');

// === UI HELPERS ===
function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function updateStatus(text, cls = '') {
    status.textContent = text;
    status.className = 'status ' + cls;
}

function renderBoard() {
    cells.forEach((cell, i) => {
        const val = boardState[i];
        cell.textContent = val || '';
        cell.className = 'cell' + (val ? ` ${val.toLowerCase()} filled` : '');
    });
}

function checkWinner() {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    for (const [a, b, c] of lines) {
        if (boardState[a] && boardState[a] === boardState[b] && boardState[a] === boardState[c]) {
            return { winner: boardState[a], line: [a, b, c] };
        }
    }
    if (boardState.every(c => c !== null)) return { winner: 'draw', line: null };
    return null;
}

function endGame(result) {
    gameActive = false;
    if (result.winner === 'draw') {
        updateStatus('Ничья! 🤝', 'draw');
    } else {
        updateStatus(result.winner === mySide ? 'Ты победил! 🎉' : 'Ты проиграл 😢', 'winner');
        if (result.line) result.line.forEach(i => cells[i].classList.add('winning'));
    }
    rematchBtn.classList.remove('hidden');
}

// === PEER SETUP ===
function generateIP() {
    const a = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    return `192.168.${a}.${b}`;
}

function ipToPeerId(ip) {
    return 'ttt-' + ip.replace(/\./g, '-');
}

function peerIdToIp(id) {
    return id.replace('ttt-', '').replace(/-/g, '.');
}

// === HOST (X) ===
createBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim() || 'Хост';
    players.X = name;
    myRoomCode = generateIP();
    const peerId = ipToPeerId(myRoomCode);

    peer = new Peer(peerId);

    peer.on('open', () => {
        mySide = 'X';
        displayCode.textContent = myRoomCode;
        showScreen(waitingScreen);
    });

    peer.on('connection', (connection) => {
        conn = connection;
        conn.on('open', () => {
            conn.on('data', handleData);
        });
        conn.on('close', () => {
            showToast('Противник отключился');
            setTimeout(() => location.reload(), 2000);
        });
    });

    peer.on('error', (err) => {
        console.error(err);
        if (err.type === 'unavailable-id') {
            showToast('IP занят, попробуй ещё раз');
            setTimeout(() => location.reload(), 1500);
        } else {
            showToast('Ошибка: ' + err.type);
        }
    });
});

// === GUEST (O) ===
joinBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim() || 'Гость';
    const ip = roomCodeInput.value.trim();

    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
        showToast('Введи правильный IP (192.168.x.x)');
        return;
    }

    players.O = name;
    const hostId = ipToPeerId(ip);

    peer = new Peer();

    peer.on('open', () => {
        mySide = 'O';
        conn = peer.connect(hostId, { reliable: true });

        conn.on('open', () => {
            conn.send({ type: 'join', name: name });
            conn.on('data', handleData);
        });

        conn.on('error', () => showToast('Не удалось подключиться'));
        conn.on('close', () => {
            showToast('Соединение потеряно');
            setTimeout(() => location.reload(), 2000);
        });
    });

    peer.on('error', (err) => {
        console.error(err);
        showToast('Ошибка подключения');
    });
});

// === DATA HANDLER ===
function handleData(data) {
    console.log('Got:', data);

    switch (data.type) {
        case 'join':
            // Host receives this
            players.O = data.name;
            startGame();
            break;

        case 'start':
            players = data.players;
            boardState = data.board;
            currentTurn = data.turn;
            gameActive = true;
            rematchBtn.classList.add('hidden');
            playerXName.textContent = players.X;
            playerOName.textContent = players.O;
            isMyTurn = (currentTurn === mySide);
            showScreen(gameScreen);
            renderBoard();
            updateTurnStatus();
            break;

        case 'move':
            // Host receives guest move
            if (mySide === 'X' && currentTurn === 'O') {
                makeMove(data.index, 'O');
            }
            break;

        case 'update':
            boardState = data.board;
            currentTurn = data.turn;
            renderBoard();
            isMyTurn = (currentTurn === mySide);
            updateTurnStatus();
            if (data.result) endGame(data.result);
            break;

        case 'rematch':
            if (mySide === 'X') startGame();
            break;
    }
}

function updateTurnStatus() {
    if (!gameActive) return;
    if (isMyTurn) {
        updateStatus(`Твой ход! (${mySide})`, mySide.toLowerCase() + '-turn');
    } else {
        updateStatus('Ход противника...', currentTurn.toLowerCase() + '-turn');
    }
}

function startGame() {
    boardState = Array(9).fill(null);
    currentTurn = 'X';
    gameActive = true;
    isMyTurn = (mySide === 'X');

    const msg = { type: 'start', players, board: boardState, turn: currentTurn };
    handleData(msg);
    if (conn && conn.open) conn.send(msg);
}

function makeMove(index, symbol) {
    boardState[index] = symbol;
    currentTurn = symbol === 'X' ? 'O' : 'X';
    const result = checkWinner();

    const msg = { type: 'update', board: boardState, turn: currentTurn, result };
    handleData(msg);
    if (conn && conn.open) conn.send(msg);
}

// === CELL CLICKS ===
cells.forEach((cell, i) => {
    cell.addEventListener('click', () => {
        if (!gameActive || !isMyTurn || boardState[i]) return;

        if (mySide === 'X') {
            makeMove(i, 'X');
        } else {
            // Guest sends move to host
            conn.send({ type: 'move', index: i });
            // Optimistic UI
            boardState[i] = 'O';
            isMyTurn = false;
            renderBoard();
            updateTurnStatus();
        }
    });
});

// === OTHER BUTTONS ===
rematchBtn.addEventListener('click', () => {
    if (conn && conn.open) conn.send({ type: 'rematch' });
    if (mySide === 'X') startGame();
});

copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(displayCode.textContent);
    copyBtn.textContent = '✅ Скопировано!';
    setTimeout(() => copyBtn.textContent = '📋 Копировать', 2000);
});

playerNameInput.addEventListener('keypress', e => e.key === 'Enter' && createBtn.click());
roomCodeInput.addEventListener('keypress', e => e.key === 'Enter' && joinBtn.click());
