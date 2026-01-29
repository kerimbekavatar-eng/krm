// Game State
let peer = null;
let conn = null;
let mySide = null; // 'X' (Host) or 'O' (Guest)
let isMyTurn = false;
let gameActive = false;
let boardState = Array(9).fill(null);
let currentTurn = 'X';
let players = { X: 'Host', O: 'Guest' };

// DOM Elements
const lobbyScreen = document.getElementById('lobby');
const waitingScreen = document.getElementById('waiting');
const gameScreen = document.getElementById('game');
const playerNameInput = document.getElementById('playerName');
const roomCodeInput = document.getElementById('roomCodeInput');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const copyBtn = document.getElementById('copyBtn');
const displayCode = document.getElementById('displayCode');
const board = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const status = document.getElementById('status');
const rematchBtn = document.getElementById('rematchBtn');
const playerXName = document.getElementById('playerXName');
const playerOName = document.getElementById('playerOName');
const toast = document.getElementById('toast');

// UI Helpers
function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function updateStatus(text, className = '') {
    status.textContent = text;
    status.className = 'status ' + className;
}

function updateBoardUI() {
    cells.forEach((cell, index) => {
        const value = boardState[index];
        cell.textContent = value || '';
        cell.className = 'cell';
        if (value) {
            cell.classList.add(value.toLowerCase(), 'filled');
            cell.classList.add(value.toLowerCase());
        }
    });

    // Determine turn status
    if (!gameActive) return;

    if (isMyTurn) {
        updateStatus(`Твой ход! (${mySide})`, `${mySide.toLowerCase()}-turn`);
    } else {
        updateStatus(`Ход противника (${currentTurn})`, `${currentTurn.toLowerCase()}-turn`);
    }
}

function checkWinner(board) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    for (const [a, b, c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return { winner: board[a], line: [a, b, c] };
        }
    }

    if (board.every(cell => cell !== null)) {
        return { winner: 'draw', line: null };
    }

    return null;
}

function endGame(result) {
    gameActive = false;
    updateBoardUI(); // Refresh UI to ensure sync

    if (result.winner === 'draw') {
        updateStatus('Ничья! 🤝', 'draw');
    } else {
        const isWinner = result.winner === mySide;
        updateStatus(isWinner ? 'Ты победил! 🎉' : 'Ты проиграл 😢', 'winner');

        if (result.line) {
            result.line.forEach(idx => cells[idx].classList.add('winning'));
        }
    }

    // Only Host can initiate rematch for simplicity, or we can sync it.
    // Let's allow both to click, but Host logic drives the reset.
    rematchBtn.classList.remove('hidden');
}

// PeerJS Setup
function initPeer(id = null) {
    peer = new Peer(id, {
        debug: 2
    });

    peer.on('open', (id) => {
        console.log('My ID:', id);
    });

    peer.on('error', (err) => {
        console.error(err);
        showToast('Ошибка соединения: ' + err.type);
    });
}

// --- HOST LOGIC (Player X) ---
createBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim() || 'Игрок 1';
    players.X = name;

    // Create random 4-char ID for simplicity
    const roomId = 'tt-' + Math.random().toString(36).substr(2, 4).toUpperCase();

    initPeer(roomId);

    peer.on('open', (id) => {
        displayCode.textContent = id.replace('tt-', ''); // Show distinct code
        showScreen(waitingScreen);
        mySide = 'X';
    });

    peer.on('connection', (connection) => {
        conn = connection;
        setupConnection();

        // Wait for guest name
        conn.on('data', (data) => {
            if (data.type === 'join') {
                players.O = data.name;
                startGame();
            } else {
                handleData(data);
            }
        });
    });
});

// --- GUEST LOGIC (Player O) ---
joinBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim() || 'Игрок 2';
    const code = roomCodeInput.value.trim().toUpperCase();

    if (code.length < 4) {
        showToast('Введите правильный код');
        return;
    }

    // Guest gets auto ID
    initPeer();

    peer.on('open', () => {
        const hostId = 'tt-' + code;
        conn = peer.connect(hostId);

        conn.on('open', () => {
            mySide = 'O';
            players.O = name; // We are O
            setupConnection();
            conn.send({ type: 'join', name: name });
        });

        conn.on('error', () => {
            showToast('Не удалось подключиться к комнате');
        });
    });
});

// --- SHARED LOGIC ---
function setupConnection() {
    conn.on('data', (data) => handleData(data));
    conn.on('close', () => {
        showToast('Соединение разорвано');
        setTimeout(() => location.reload(), 2000);
    });
}

function handleData(data) {
    console.log('Received:', data);

    switch (data.type) {
        case 'start':
            players = data.players;
            currentTurn = data.currentTurn;
            boardState = data.board;
            gameActive = true;
            rematchBtn.classList.add('hidden');

            playerXName.textContent = players.X;
            playerOName.textContent = players.O;

            isMyTurn = (currentTurn === mySide);
            showScreen(gameScreen);
            updateBoardUI();
            break;

        case 'update':
            boardState = data.board;
            currentTurn = data.currentTurn;

            // Should we animate the move?
            updateBoardUI();
            isMyTurn = (currentTurn === mySide);

            if (data.result) {
                endGame(data.result);
            }
            break;

        case 'rematch':
            // Host sent rematch signal (or Guest requested it and Host approved)
            // Ideally Host resets state and sends 'start' again.
            // If we receive 'rematch' as Guest, it means Host restarted.
            // If we receive it as Host, it means Guest wants to restart.
            if (mySide === 'X') {
                startGame(); // Host restarts
            }
            break;
    }
}

function startGame() {
    // Only Host initializes game state
    boardState = Array(9).fill(null);
    currentTurn = 'X';
    gameActive = true;

    const state = {
        type: 'start',
        players: players,
        currentTurn: currentTurn,
        board: boardState
    };

    // Update local
    handleData(state);

    // Send to guest
    if (conn) conn.send(state);
}

// Game Actions
cells.forEach((cell, index) => {
    cell.addEventListener('click', () => {
        if (!gameActive || !isMyTurn) return;
        if (boardState[index]) return; // Cell occupied

        // Optimistic update
        boardState[index] = mySide;
        isMyTurn = false;
        updateBoardUI();

        // Determine Next Turn
        const nextTurn = mySide === 'X' ? 'O' : 'X';

        // Check Win (Host checks usually, but for P2P we can check locally and sync)
        // To be safe, Host is authority. But simpler: both check logic is same.
        // Let's let Host be authority for Truth.

        if (mySide === 'X') {
            // I am Host. I validate and send update.
            processMove(index, 'X');
        } else {
            // I am Guest. I send move to Host.
            conn.send({ type: 'move', index: index });
        }
    });
});

// Host Logic for processing all moves (including its own)
function processMove(index, symbol) {
    // Logic only runs on Host
    boardState[index] = symbol;
    currentTurn = symbol === 'X' ? 'O' : 'X';

    const result = checkWinner(boardState);

    const update = {
        type: 'update',
        board: boardState,
        currentTurn: currentTurn,
        result: result
    };

    // Update self (Host)
    handleData(update);

    // Send to Guest
    conn.send(update);
}

// If I am Host, I need to listen for 'move' from Guest in handleData? 
// No, create specific listener or add case to handleData if I want unified.
// A cleaner way for Host is:
// Warning: I overwrote handleData above. I need to add 'move' case there if I'm Host.

// Re-defining handleData to include 'move' case for Host
const originalHandleData = handleData;
handleData = function (data) {
    if (mySide === 'X' && data.type === 'move') {
        // Guest sent a move
        if (currentTurn !== 'O') return; // Not their turn
        if (boardState[data.index]) return; // Occupied

        processMove(data.index, 'O');
    } else if (data.type === 'rematch') {
        if (mySide === 'X') startGame();
        // If guest sent rematch, host restarts.
    } else {
        originalHandleData(data);
    }
};

rematchBtn.addEventListener('click', () => {
    conn.send({ type: 'rematch' });
    if (mySide === 'X') startGame();
});

copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(displayCode.textContent);
    copyBtn.textContent = '✅';
    setTimeout(() => copyBtn.textContent = '📋 Копировать', 2000);
});

// Input handling
playerNameInput.addEventListener('keypress', e => e.key === 'Enter' && createBtn.click());
roomCodeInput.addEventListener('keypress', e => e.key === 'Enter' && joinBtn.click());
