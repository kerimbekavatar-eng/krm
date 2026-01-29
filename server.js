const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Store game rooms
const rooms = new Map();

// Generate random room code
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

// Check for winner
function checkWinner(board) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
        [0, 4, 8], [2, 4, 6]             // diagonals
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

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Create a new room
    socket.on('createRoom', (playerName) => {
        const roomCode = generateRoomCode();
        const room = {
            code: roomCode,
            players: [{ id: socket.id, name: playerName, symbol: 'X' }],
            board: Array(9).fill(null),
            currentTurn: 'X',
            gameStarted: false
        };
        rooms.set(roomCode, room);
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.emit('roomCreated', { roomCode, symbol: 'X' });
        console.log(`Room ${roomCode} created by ${playerName}`);
    });

    // Join existing room
    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const room = rooms.get(roomCode.toUpperCase());
        
        if (!room) {
            socket.emit('error', 'Комната не найдена');
            return;
        }
        
        if (room.players.length >= 2) {
            socket.emit('error', 'Комната заполнена');
            return;
        }

        room.players.push({ id: socket.id, name: playerName, symbol: 'O' });
        room.gameStarted = true;
        socket.join(roomCode.toUpperCase());
        socket.roomCode = roomCode.toUpperCase();
        
        socket.emit('roomJoined', { roomCode: room.code, symbol: 'O' });
        
        // Notify both players that game is starting
        io.to(room.code).emit('gameStart', {
            players: room.players.map(p => ({ name: p.name, symbol: p.symbol })),
            currentTurn: room.currentTurn,
            board: room.board
        });
        
        console.log(`${playerName} joined room ${roomCode}`);
    });

    // Handle player move
    socket.on('makeMove', (cellIndex) => {
        const room = rooms.get(socket.roomCode);
        
        if (!room || !room.gameStarted) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;
        
        // Check if it's player's turn
        if (player.symbol !== room.currentTurn) {
            socket.emit('error', 'Не ваш ход');
            return;
        }
        
        // Check if cell is empty
        if (room.board[cellIndex] !== null) {
            socket.emit('error', 'Клетка занята');
            return;
        }
        
        // Make move
        room.board[cellIndex] = player.symbol;
        room.currentTurn = room.currentTurn === 'X' ? 'O' : 'X';
        
        // Check for winner
        const result = checkWinner(room.board);
        
        io.to(room.code).emit('moveMade', {
            cellIndex,
            symbol: player.symbol,
            board: room.board,
            currentTurn: room.currentTurn,
            result
        });
        
        if (result) {
            room.gameStarted = false;
        }
    });

    // Handle rematch request
    socket.on('rematch', () => {
        const room = rooms.get(socket.roomCode);
        if (!room) return;
        
        room.board = Array(9).fill(null);
        room.currentTurn = 'X';
        room.gameStarted = true;
        
        io.to(room.code).emit('gameStart', {
            players: room.players.map(p => ({ name: p.name, symbol: p.symbol })),
            currentTurn: room.currentTurn,
            board: room.board
        });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        const room = rooms.get(socket.roomCode);
        if (room) {
            io.to(room.code).emit('playerLeft');
            rooms.delete(socket.roomCode);
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🎮 Сервер запущен на http://localhost:${PORT}`);
});
