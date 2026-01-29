// Connect to server
const socket = io();

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

// Game state
let mySymbol = null;
let isMyTurn = false;
let gameActive = false;

// Helper functions
function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function getPlayerName() {
    return playerNameInput.value.trim() || 'Игрок';
}

function updateStatus(text, className = '') {
    status.textContent = text;
    status.className = 'status ' + className;
}

function updateBoard(boardState) {
    cells.forEach((cell, index) => {
        const value = boardState[index];
        cell.textContent = value || '';
        cell.className = 'cell';
        if (value) {
            cell.classList.add(value.toLowerCase(), 'filled');
        }
    });
}

function highlightWinningCells(line) {
    if (!line) return;
    line.forEach(index => {
        cells[index].classList.add('winning');
    });
}

// Event Listeners
createBtn.addEventListener('click', () => {
    socket.emit('createRoom', getPlayerName());
});

joinBtn.addEventListener('click', () => {
    const code = roomCodeInput.value.trim();
    if (code.length !== 4) {
        showToast('Введите 4-значный код');
        return;
    }
    socket.emit('joinRoom', { roomCode: code, playerName: getPlayerName() });
});

copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(displayCode.textContent);
    copyBtn.textContent = '✅ Скопировано!';
    setTimeout(() => copyBtn.textContent = '📋 Копировать', 2000);
});

cells.forEach(cell => {
    cell.addEventListener('click', () => {
        if (!gameActive || !isMyTurn) return;

        const index = parseInt(cell.dataset.index);
        if (cell.classList.contains('filled')) return;

        socket.emit('makeMove', index);
    });
});

rematchBtn.addEventListener('click', () => {
    socket.emit('rematch');
    rematchBtn.classList.add('hidden');
});

// Socket Events
socket.on('roomCreated', ({ roomCode, symbol }) => {
    mySymbol = symbol;
    displayCode.textContent = roomCode;
    showScreen(waitingScreen);
});

socket.on('roomJoined', ({ roomCode, symbol }) => {
    mySymbol = symbol;
});

socket.on('gameStart', ({ players, currentTurn, board: boardState }) => {
    gameActive = true;
    rematchBtn.classList.add('hidden');

    const xPlayer = players.find(p => p.symbol === 'X');
    const oPlayer = players.find(p => p.symbol === 'O');

    playerXName.textContent = xPlayer ? xPlayer.name : 'Игрок X';
    playerOName.textContent = oPlayer ? oPlayer.name : 'Игрок O';

    updateBoard(boardState);
    showScreen(gameScreen);

    isMyTurn = currentTurn === mySymbol;

    if (isMyTurn) {
        updateStatus('Твой ход! (' + mySymbol + ')', mySymbol.toLowerCase() + '-turn');
    } else {
        updateStatus('Ход противника...', currentTurn.toLowerCase() + '-turn');
    }
});

socket.on('moveMade', ({ cellIndex, symbol, board: boardState, currentTurn, result }) => {
    updateBoard(boardState);

    if (result) {
        gameActive = false;

        if (result.winner === 'draw') {
            updateStatus('Ничья! 🤝', 'draw');
        } else {
            const isWinner = result.winner === mySymbol;
            updateStatus(isWinner ? 'Ты победил! 🎉' : 'Ты проиграл 😢', 'winner');
            highlightWinningCells(result.line);
        }

        rematchBtn.classList.remove('hidden');
    } else {
        isMyTurn = currentTurn === mySymbol;

        if (isMyTurn) {
            updateStatus('Твой ход! (' + mySymbol + ')', mySymbol.toLowerCase() + '-turn');
        } else {
            updateStatus('Ход противника...', currentTurn.toLowerCase() + '-turn');
        }
    }
});

socket.on('playerLeft', () => {
    showToast('Противник покинул игру');
    gameActive = false;
    setTimeout(() => {
        showScreen(lobbyScreen);
    }, 2000);
});

socket.on('error', (message) => {
    showToast(message);
});

// Enter key support
playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') createBtn.click();
});

roomCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinBtn.click();
});
