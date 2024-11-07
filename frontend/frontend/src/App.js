// App.js

import React, { useState, useEffect, useRef } from "react";
import "./App.css";

function App() {
  const [ws, setWs] = useState(null);
  const [sessionId, setSessionId] = useState("");
  const [playerIndex, setPlayerIndex] = useState(null);
  const [board, setBoard] = useState(Array(9).fill(null));
  const [logs, setLogs] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [gameOverMessage, setGameOverMessage] = useState("");
  const logRef = useRef();

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080");
    setWs(socket);

    socket.onopen = () => {
      addLog("Conectado ao servidor WebSocket");
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      addLog(`Mensagem recebida: ${event.data}`);

      switch (data.type) {
        case "session-created":
          setSessionId(data.sessionId);
          setPlayerIndex(0);
          addLog(`Sessão criada com ID: ${data.sessionId}`);
          break;

        case "player-joined":
          setPlayerIndex(data.playerIndex);
          addLog(`Jogador entrou na sessão como Player ${data.playerIndex}`);
          break;

        case "move-made":
          setBoard(data.board);
          setCurrentPlayer(data.currentPlayer);
          break;

        case "game-over":
          if (data.winner !== undefined) {
            const winner = data.winner;
            setGameOverMessage(`Jogador ${winner === 0 ? "❌" : "⭕"} venceu!`);
            addLog(`Jogador ${winner} venceu o jogo.`);
          } else if (data.tie) {
            setGameOverMessage("O jogo terminou em empate!");
            addLog("O jogo terminou em empate.");
          }
          break;

        case "error":
          alert(data.message);
          addLog(`Erro: ${data.message}`);
          break;

        default:
          addLog(`Tipo de mensagem desconhecido: ${data.type}`);
          break;
      }
    };

    socket.onclose = () => {
      addLog("Desconectado do servidor WebSocket");
      setIsConnected(false);
    };

    return () => {
      socket.close();
    };
  }, []);

  const addLog = (message) => {
    setLogs((prevLogs) => prevLogs + message + "\n");
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  };

  const createSession = () => {
    ws.send(JSON.stringify({ type: "create-session" }));
    addLog("Solicitado criação de sessão");
  };

  const joinSession = () => {
    const id = prompt("Digite o ID da sessão:");
    if (id) {
      ws.send(JSON.stringify({ type: "join-session", sessionId: id }));
      addLog(`Solicitado ingresso na sessão: ${id}`);
    }
  };

  const handleClick = (index) => {
    if (
      board[index] !== null ||
      currentPlayer !== playerIndex ||
      gameOverMessage
    )
      return;
    ws.send(
      JSON.stringify({
        type: "make-move",
        index,
        player: playerIndex,
      })
    );
    addLog(`Enviada jogada na posição ${index}`);
  };

  const renderCell = (index) => {
    return (
      <button key={index} className="cell" onClick={() => handleClick(index)}>
        {board[index] === 0 ? "❌" : board[index] === 1 ? "⭕" : ""}
      </button>
    );
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setGameOverMessage("");
    setSessionId("");
    setPlayerIndex(null);
    addLog("Jogo reiniciado. Crie uma nova sessão ou entre em uma existente.");
  };

  return (
    <div className="App">
      <header>
        <h1>Jogo da Velha</h1>
      </header>
      <div className="game-container">
        {!isConnected && <p>Conectando ao servidor...</p>}
        {isConnected && (
          <div>
            <div className="buttons">
              <button onClick={createSession}>Criar Sessão</button>
              <button onClick={joinSession}>Entrar na Sessão</button>
              {gameOverMessage && (
                <button onClick={resetGame}>Reiniciar Jogo</button>
              )}
            </div>
            {sessionId && (
              <p className="session-info">
                ID da Sessão: <strong>{sessionId}</strong>
              </p>
            )}
            <div className="board">
              {board.map((_, index) => renderCell(index))}
            </div>
            {playerIndex !== null && (
              <div className="player-info">
                Você é o jogador{" "}
                <strong>{playerIndex === 0 ? "❌" : "⭕"}</strong>{" "}
                {currentPlayer === playerIndex ? "(Sua vez)" : "(Aguarde)"}
              </div>
            )}
            {gameOverMessage && (
              <div className="game-over">{gameOverMessage}</div>
            )}
          </div>
        )}
        <div className="logs">
          <h2>Logs</h2>
          <textarea ref={logRef} value={logs} readOnly />
        </div>
      </div>
    </div>
  );
}

export default App;
