export const createResultsRenderer = ({ onReady, onKick } = {}) => {
  let view = null;
  let room = null;
  let busy = false;
  let connected = true;

  const render = () => {
    if (!view) return;
    const list = document.getElementById("results-list");
    list.replaceChildren(...(view.results ?? []).map((result) => {
      const item = document.createElement("li");
      const detail = `${result.role}${result.forfeited ? " - Forfeited" : ""}${result.isHost ? " - Host" : ""}`;
      item.innerHTML = `<span>${result.position}</span><strong></strong><em></em>`;
      item.querySelector("strong").textContent = result.name;
      item.querySelector("em").textContent = detail;
      return item;
    }));

    document.getElementById("results-round-label").textContent = `Round ${view.roundNumber}`;
    document.querySelector(".result-hero > p:last-child").textContent = room?.players?.length < 2
      ? "Another current room player is required for the next round."
      : `Ready up for Round ${view.roundNumber + 1}.`;

    const current = room?.players?.find((player) => player.id === view.you?.id);
    const ready = current?.nextRoundReady ?? false;
    const button = document.getElementById("next-ready-button");
    button.textContent = ready ? "Cancel Readiness" : `Ready for Round ${view.roundNumber + 1}`;
    button.disabled = busy || !connected || !room || room.status !== "round_complete";
    button.setAttribute("aria-pressed", String(ready));

    document.getElementById("next-ready-list").replaceChildren(...(room?.players ?? []).map((player) => {
      const item = document.createElement("li");
      item.innerHTML = `<span></span><strong></strong><em></em>`;
      item.querySelector("span").textContent = player.nextRoundReady ? "Ready" : "Waiting";
      item.querySelector("strong").textContent = player.name;
      item.querySelector("em").textContent = [player.isHost ? "Host" : "", !player.connected ? "Disconnected" : ""].filter(Boolean).join(" - ");
      if (view.you?.isHost && player.id !== view.you.id) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "opponent-remove";
        remove.textContent = "Remove";
        remove.disabled = busy || !connected;
        remove.addEventListener("click", () => onKick?.(player.id));
        item.append(remove);
      }
      return item;
    }));
  };

  document.getElementById("next-ready-button").addEventListener("click", async () => {
    if (!view || busy) return;
    const current = room?.players?.find((player) => player.id === view.you?.id);
    busy = true; render();
    const response = await onReady?.(!(current?.nextRoundReady ?? false));
    busy = false;
    if (!response?.ok) {
      document.getElementById("results-notice").textContent = response?.error?.message ?? "Unable to update readiness.";
    }
    render();
  });

  return {
    update(nextView, nextRoom = room) { view = nextView; room = nextRoom; render(); },
    updateRoom(nextRoom) { room = nextRoom; render(); },
    setConnected(value) { connected = value; render(); },
    setBusy(value) { busy = value; render(); },
  };
};
