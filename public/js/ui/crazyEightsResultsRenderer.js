export const createCrazyEightsResultsRenderer = ({ onReady, onKick, onLeave }) => {
  const byId = (id) => document.getElementById(id);
  let view = null;
  let room = null;
  let busy = false;
  let connected = true;
  const render = () => {
    if (!view) return;
    byId("ce-results-round").textContent = `Round ${view.roundNumber}`;
    byId("ce-results-title").textContent = view.winnerName ? `${view.winnerName} wins!` : "Round complete";
    byId("ce-results-list").replaceChildren(...(view.results ?? []).map((result) => {
      const item = document.createElement("li");
      const marker = document.createElement("span"); marker.textContent = result.winner ? "★" : "•";
      const name = document.createElement("strong"); name.textContent = result.name;
      const detail = document.createElement("em"); detail.textContent = result.forfeited ? "Forfeited" : `${result.cardCount} cards remaining`;
      item.append(marker, name, detail); return item;
    }));
    const current = room?.players.find(({ id }) => id === view.you?.id);
    const button = byId("ce-next-ready");
    button.textContent = current?.nextRoundReady ? "Cancel Readiness" : "Ready for another round";
    button.setAttribute("aria-pressed", String(current?.nextRoundReady ?? false));
    button.disabled = busy || !connected || room?.status !== "round_complete";
    byId("ce-ready-list").replaceChildren(...(room?.players ?? []).map((player) => {
      const item = document.createElement("li");
      const status = document.createElement("span"); status.textContent = player.nextRoundReady ? "Ready" : "Waiting";
      const name = document.createElement("strong"); name.textContent = player.name;
      item.append(status, name);
      if (view.you?.isHost && player.id !== view.you.id) {
        const remove = document.createElement("button");
        remove.type = "button"; remove.className = "remove-button"; remove.textContent = `Remove ${player.name}`;
        remove.disabled = busy || !connected;
        remove.addEventListener("click", () => onKick(player.id));
        item.append(remove);
      }
      return item;
    }));
  };
  byId("ce-next-ready").addEventListener("click", async () => {
    const current = room?.players.find(({ id }) => id === view?.you?.id);
    busy = true; render(); await onReady(!(current?.nextRoundReady ?? false)); busy = false; render();
  });
  byId("ce-results-leave").addEventListener("click", () => onLeave(false));
  return {
    update(nextView, nextRoom = room) { view = nextView; room = nextRoom; render(); },
    updateRoom(nextRoom) { room = nextRoom; render(); },
    setConnected(value) { connected = value; render(); },
    setBusy(value) { busy = value; render(); },
  };
};
