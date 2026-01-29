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

function showToast(msg, duration = 3000) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
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
function generateCode() {
    // Simple 6-character code
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function codeToPeerId(code) {
    return 'xo-game-' + code.toLowerCase();
}

// === HOST (X) ===
createBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim() || 'Хост';
    players.X = name;
    myRoomCode = generateCode();
    const peerId = codeToPeerId(myRoomCode);

    showToast('Подключение...', 10000);

    peer = new Peer(peerId, {
        debug: 2
    });

    peer.on('open', (id) => {
        console.log('Host peer opened with ID:', id);
        mySide = 'X';
        displayCode.textContent = myRoomCode;
        showScreen(waitingScreen);
        showToast('Комната создана! Жди друга', 3000);
    });

    peer.on('connection', (connection) => {
        console.log('Guest connected!');
        conn = connection;

        conn.on('open', () => {
            console.log('Connection opened');
            showToast('Игрок подключился!', 2000);
        });

        conn.on('data', (data) => {
            console.log('Host received:', data);
            handleData(data);
        });

        conn.on('close', () => {
            showToast('Противник отключился');
            setTimeout(() => location.reload(), 2000);
        });

        conn.on('error', (err) => {
            console.error('Connection error:', err);
            showToast('Ошибка соединения');
        });
    });

    peer.on('error', (err) => {
        console.error('Peer error:', err);
        if (err.type === 'unavailable-id') {
            showToast('Код занят, создаю новый...');
            setTimeout(() => {
                peer.destroy();
                createBtn.click();
            }, 1000);
        } else {
            showToast('Ошибка: ' + err.type);
        }
    });

    peer.on('disconnected', () => {
        console.log('Peer disconnected, reconnecting...');
        peer.reconnect();
    });
});

// === GUEST (O) ===
joinBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim() || 'Гость';
    const code = roomCodeInput.value.trim().toUpperCase();

    if (code.length < 4) {
        showToast('Введи код комнаты (6 символов)');
        return;
    }

    players.O = name;
    const hostId = codeToPeerId(code);

    showToast('Подключение к ' + code + '...', 10000);
    console.log('Connecting to host:', hostId);

    peer = new Peer(undefined, {
        debug: 2
    });

    peer.on('open', (myId) => {
        console.log('Guest peer opened with ID:', myId);
        mySide = 'O';

        conn = peer.connect(hostId, {
            reliable: true,
            serialization: 'json'
        });

        conn.on('open', () => {
            console.log('Connected to host!');
            showToast('Подключено! Начинаем игру', 2000);
            conn.send({ type: 'join', name: name });
        });

        conn.on('data', (data) => {
            console.log('Guest received:', data);
            handleData(data);
        });

        conn.on('error', (err) => {
            console.error('Connection error:', err);
            showToast('Не удалось подключиться');
        });

        conn.on('close', () => {
            showToast('Соединение потеряно');
            setTimeout(() => location.reload(), 2000);
        });
    });

    peer.on('error', (err) => {
        console.error('Peer error:', err);
        if (err.type === 'peer-unavailable') {
            showToast('Комната не найдена. Проверь код!');
        } else {
            showToast('Ошибка: ' + err.type);
        }
    });
});

// === DATA HANDLER ===
function handleData(data) {
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
            conn.send({ type: 'move', index: i });
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

console.log('Game loaded! PeerJS version.');
