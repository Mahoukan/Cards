export const createLobbyRenderer = ({ onReady, onKick, onLeave }) => {
  const byId = (id) => document.getElementById(id);
  let room = null;
  let playerId = null;
  let connected = true;
  let busy = false;

  const render = () => {
    if (!room) return;
    document.querySelectorAll("[data-room-code]").forEach((node) => { node.textContent = room.code; });
    byId("player-count").textContent = `${room.playerCount} / ${room.maximumPlayers}`;
    byId("lobby-game-name").textContent = room.gameName;
    byId("lobby-game-description").textContent = room.gameDescription;
    byId("lobby-how-to-play").dataset.instructions = room.gameId;
    const current = room.players.find(({ id }) => id === playerId);
    const isHost = room.hostPlayerId === playerId;
    byId("player-list").replaceChildren(...room.players.map((player) => {
      const item = document.createElement("li");
      item.className = `player-row${player.id === playerId ? " is-you" : ""}`;
      const labels = [
        player.id === playerId ? "You" : "",
        player.isHost ? "Host" : "",
        player.connected ? "Connected" : "Disconnected",
        player.ready ? "Ready" : "Not ready",
      ].filter(Boolean);
      const details = document.createElement("div");
      const name = document.createElement("strong"); name.textContent = player.name;
      const status = document.createElement("span"); status.textContent = labels.join(" · ");
      details.append(name, status); item.append(details);
      if (isHost && player.id !== playerId) {
        const remove = document.createElement("button");
        remove.type = "button"; remove.className = "remove-button"; remove.textContent = `Remove ${player.name}`;
        remove.disabled = busy || !connected;
        remove.addEventListener("click", () => onKick(player.id));
        item.append(remove);
      }
      return item;
    }));
    byId("ready-button").textContent = current?.ready ? "Unready" : "I’m Ready";
    byId("ready-button").setAttribute("aria-pressed", String(current?.ready ?? false));
    byId("ready-button").disabled = busy || !connected || !current?.connected;
    byId("leave-button").disabled = busy || !connected;
    byId("lobby-status").textContent = !connected
      ? "Connection lost. Your seat is reserved for 60 seconds; trying to reconnect…"
      : room.canStart
        ? `Everyone is ready. Starting ${room.gameName}…`
        : `At least ${room.minimumPlayers} players are required. Every player must be connected and ready.`;
    byId("lobby-status").classList.toggle("is-ready", room.canStart);
  };

  byId("ready-button").addEventListener("click", () => {
    const current = room?.players.find(({ id }) => id === playerId);
    if (current) onReady(!current.ready);
  });
  byId("leave-button").addEventListener("click", onLeave);

  return {
    update(nextRoom, currentPlayerId) { room = nextRoom; playerId = currentPlayerId; render(); },
    setConnected(value) { connected = value; render(); },
    setBusy(value) { busy = value; render(); },
    clear() { room = null; playerId = null; },
  };
};
