// Game State
let board = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = 'X';
let gameActive = true;
let difficulty = 'medium';
let scores = {
    player: 0,
    ai: 0,
    draws: 0
};

// DOM Elements
const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const boardElement = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const statusElement = document.getElementById('status');
const resultModal = document.getElementById('result-modal');
const resultIcon = document.getElementById('result-icon');
const resultTitle = document.getElementById('result-title');
const resultMessage = document.getElementById('result-message');
const currentDifficultyElement = document.getElementById('current-difficulty');

// Difficulty Buttons
const difficultyBtns = document.querySelectorAll('.difficulty-btn');

// Action Buttons
const startBtn = document.getElementById('start-btn');
const backBtn = document.getElementById('back-btn');
const restartBtn = document.getElementById('restart-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const menuBtn = document.getElementById('menu-btn');

// Score Elements
const playerWinsElement = document.getElementById('player-wins');
const aiWinsElement = document.getElementById('ai-wins');
const drawsElement = document.getElementById('draws');

// Winning Combinations
const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6] // Diagonals
];

// Difficulty Settings
const difficultySettings = {
    easy: { icon: '🌱', name: 'Лёгкий' },
    medium: { icon: '⚡', name: 'Средний' },
    hard: { icon: '🔥', name: 'Сложный' },
    impossible: { icon: '💀', name: 'Невозможный' }
};

// Event Listeners
difficultyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        difficultyBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        difficulty = btn.dataset.difficulty;
    });
});

startBtn.addEventListener('click', startGame);
backBtn.addEventListener('click', goToMenu);
restartBtn.addEventListener('click', resetGame);
playAgainBtn.addEventListener('click', () => {
    hideModal();
    resetGame();
});
menuBtn.addEventListener('click', () => {
    hideModal();
    goToMenu();
});

cells.forEach(cell => {
    cell.addEventListener('click', () => handleCellClick(cell));
});

// Functions
function startGame() {
    menuScreen.classList.remove('active');
    gameScreen.classList.add('active');
    updateDifficultyIndicator();
    resetGame();
}

function goToMenu() {
    gameScreen.classList.remove('active');
    menuScreen.classList.add('active');
}

function updateDifficultyIndicator() {
    const settings = difficultySettings[difficulty];
    currentDifficultyElement.innerHTML = `
        <span class="diff-icon">${settings.icon}</span>
        <span>${settings.name}</span>
    `;
}

function handleCellClick(cell) {
    const index = parseInt(cell.dataset.index);

    if (board[index] !== '' || !gameActive || currentPlayer !== 'X') {
        return;
    }

    makeMove(index, 'X');

    if (gameActive) {
        currentPlayer = 'O';
        statusElement.textContent = 'ИИ думает...';

        // AI move with slight delay for better UX
        setTimeout(() => {
            if (gameActive) {
                const aiMove = getAIMove();
                makeMove(aiMove, 'O');
                if (gameActive) {
                    currentPlayer = 'X';
                    statusElement.textContent = 'Твой ход!';
                }
            }
        }, 500);
    }
}

function makeMove(index, player) {
    board[index] = player;
    const cell = cells[index];
    cell.textContent = player;
    cell.classList.add(player.toLowerCase(), 'taken');

    const winner = checkWinner();
    if (winner) {
        gameActive = false;
        handleGameEnd(winner);
    } else if (board.every(cell => cell !== '')) {
        gameActive = false;
        handleGameEnd('draw');
    }
}

function checkWinner() {
    for (const pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            // Highlight winning cells
            cells[a].classList.add('win');
            cells[b].classList.add('win');
            cells[c].classList.add('win');
            return board[a];
        }
    }
    return null;
}

function handleGameEnd(result) {
    setTimeout(() => {
        if (result === 'X') {
            scores.player++;
            playerWinsElement.textContent = scores.player;
            showModal('🎉', 'Победа!', 'Ты победил ИИ!');
        } else if (result === 'O') {
            scores.ai++;
            aiWinsElement.textContent = scores.ai;
            showModal('😢', 'Поражение', 'ИИ победил. Попробуй ещё раз!');
        } else {
            scores.draws++;
            drawsElement.textContent = scores.draws;
            showModal('🤝', 'Ничья!', 'Никто не победил.');
        }
    }, 500);
}

function showModal(icon, title, message) {
    resultIcon.textContent = icon;
    resultTitle.textContent = title;
    resultMessage.textContent = message;
    resultModal.classList.add('active');
}

function hideModal() {
    resultModal.classList.remove('active');
}

function resetGame() {
    board = ['', '', '', '', '', '', '', '', ''];
    currentPlayer = 'X';
    gameActive = true;
    statusElement.textContent = 'Твой ход!';

    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('x', 'o', 'taken', 'win');
    });
}

// AI Logic
function getAIMove() {
    switch (difficulty) {
        case 'easy':
            return getEasyMove();
        case 'medium':
            return getMediumMove();
        case 'hard':
            return getHardMove();
        case 'impossible':
            return getImpossibleMove();
        default:
            return getMediumMove();
    }
}

function getEasyMove() {
    // Random move
    const availableMoves = getAvailableMoves();
    return availableMoves[Math.floor(Math.random() * availableMoves.length)];
}

function getMediumMove() {
    // 50% chance of making the best move, 50% random
    if (Math.random() < 0.5) {
        return getImpossibleMove();
    }
    return getEasyMove();
}

function getHardMove() {
    // 80% chance of making the best move, 20% random
    if (Math.random() < 0.8) {
        return getImpossibleMove();
    }
    return getEasyMove();
}

function getImpossibleMove() {
    // Minimax algorithm for perfect play
    let bestScore = -Infinity;
    let bestMove = null;

    for (const move of getAvailableMoves()) {
        board[move] = 'O';
        const score = minimax(board, 0, false, -Infinity, Infinity);
        board[move] = '';

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    return bestMove;
}

function minimax(board, depth, isMaximizing, alpha, beta) {
    const winner = checkWinnerForMinimax(board);

    if (winner === 'O') return 10 - depth;
    if (winner === 'X') return depth - 10;
    if (getAvailableMoves().length === 0) return 0;

    if (isMaximizing) {
        let maxScore = -Infinity;
        for (const move of getAvailableMoves()) {
            board[move] = 'O';
            const score = minimax(board, depth + 1, false, alpha, beta);
            board[move] = '';
            maxScore = Math.max(score, maxScore);
            alpha = Math.max(alpha, score);
            if (beta <= alpha) break;
        }
        return maxScore;
    } else {
        let minScore = Infinity;
        for (const move of getAvailableMoves()) {
            board[move] = 'X';
            const score = minimax(board, depth + 1, true, alpha, beta);
            board[move] = '';
            minScore = Math.min(score, minScore);
            beta = Math.min(beta, score);
            if (beta <= alpha) break;
        }
        return minScore;
    }
}

function checkWinnerForMinimax(board) {
    for (const pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return null;
}

function getAvailableMoves() {
    return board.map((cell, index) => cell === '' ? index : null).filter(x => x !== null);
}

// Update scores display on load
playerWinsElement.textContent = scores.player;
aiWinsElement.textContent = scores.ai;
drawsElement.textContent = scores.draws;
