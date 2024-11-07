const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const port = 8080;
const wss = new WebSocket.Server({ port });

console.log(`Servidor WebSocket rodando na porta ${port}`);

let sessions = {}; // Armazena as sessões ativas

function checkGameState(board) {
  const winningCombinations = [
    [0, 1, 2], // Linhas
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6], // Colunas
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8], // Diagonais
    [2, 4, 6],
  ];

  for (let combination of winningCombinations) {
    const [a, b, c] = combination;
    if (board[a] !== null && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a] };
    }
  }

  if (board.every((cell) => cell !== null)) {
    return { tie: true };
  }

  return null;
}

wss.on("connection", (ws) => {
  console.log("Novo cliente conectado");

  ws.on("message", (message) => {
    console.log("Mensagem recebida:", message);
    const data = JSON.parse(message);

    switch (data.type) {
      case "create-session":
        const sessionId = uuidv4();
        sessions[sessionId] = {
          players: [ws],
          board: Array(9).fill(null),
          currentPlayer: 0,
        };
        ws.sessionId = sessionId;
        ws.send(
          JSON.stringify({
            type: "session-created",
            sessionId,
          })
        );
        console.log(`Sessão criada: ${sessionId}`);
        break;

      case "join-session":
        const joinSession = sessions[data.sessionId];
        if (joinSession && joinSession.players.length < 2) {
          joinSession.players.push(ws);
          ws.sessionId = data.sessionId;
          joinSession.players.forEach((client, index) => {
            client.send(
              JSON.stringify({
                type: "player-joined",
                playerIndex: index,
              })
            );
          });
          console.log(`Jogador entrou na sessão: ${data.sessionId}`);
        } else {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Sessão inválida ou cheia.",
            })
          );
        }
        break;

      case "make-move":
        const session = sessions[ws.sessionId];
        if (session) {
          const { index, player } = data;
          if (
            session.currentPlayer === player &&
            session.board[index] === null
          ) {
            session.board[index] = player;

            // Verificar o estado do jogo
            const gameState = checkGameState(session.board);

            if (gameState) {
              // Enviar o estado atualizado do tabuleiro antes de enviar 'game-over'
              session.players.forEach((client) => {
                client.send(
                  JSON.stringify({
                    type: "move-made",
                    board: session.board,
                    currentPlayer: session.currentPlayer,
                  })
                );
              });

              if (gameState.winner !== undefined) {
                // Informar aos jogadores quem venceu
                session.players.forEach((client) => {
                  client.send(
                    JSON.stringify({
                      type: "game-over",
                      winner: gameState.winner,
                      board: session.board,
                    })
                  );
                });
                console.log(
                  `Jogador ${gameState.winner} venceu o jogo na sessão ${ws.sessionId}`
                );
                // Remover a sessão após o jogo terminar
                delete sessions[ws.sessionId];
              } else if (gameState.tie) {
                // Informar aos jogadores que o jogo empatou
                session.players.forEach((client) => {
                  client.send(
                    JSON.stringify({
                      type: "game-over",
                      tie: true,
                      board: session.board,
                    })
                  );
                });
                console.log(`O jogo empatou na sessão ${ws.sessionId}`);
                // Remover a sessão após o jogo terminar
                delete sessions[ws.sessionId];
              }
            } else {
              // Alternar o jogador atual
              session.currentPlayer = 1 - session.currentPlayer;
              // Enviar atualização para ambos os jogadores
              session.players.forEach((client) => {
                client.send(
                  JSON.stringify({
                    type: "move-made",
                    board: session.board,
                    currentPlayer: session.currentPlayer,
                  })
                );
              });
              console.log(
                `Jogador ${player} fez uma jogada na posição ${index}`
              );
            }
          }
        }
        break;

      default:
        console.log("Tipo de mensagem desconhecido:", data.type);
        break;
    }
  });

  ws.on("close", () => {
    console.log("Cliente desconectado");
    // Remover jogador da sessão
    if (ws.sessionId && sessions[ws.sessionId]) {
      const session = sessions[ws.sessionId];
      session.players = session.players.filter((client) => client !== ws);
      if (session.players.length === 0) {
        delete sessions[ws.sessionId];
        console.log(`Sessão encerrada: ${ws.sessionId}`);
      }
    }
  });
});
