import { createMahjongTileElement, getMahjongTileLabel } from "./mahjongTileRenderer.js";
import { formatFanTotal, formatPaymentDelta, getMahjongHandTypeLabel } from "./mahjongScoreRenderer.js";

export const createMahjongRenderer = ({ onDiscard, onClaim, onWin, onKong, onReady, onLeave }) => {
  const byId = (id) => document.getElementById(id);
  let view = null; let selectedId = null; let connected = true; let busy = false; let timer = null; let offset = 0;
  const tileRow = (tiles, state = "normal") => tiles.map((tile) => createMahjongTileElement(tile, { state }));
  const act = async (operation) => {
    if (busy || !connected) return;
    busy = true; render();
    const response = await operation(); busy = false;
    if (!response?.ok) byId("mahjong-notice").textContent = response?.error?.message ?? "Action rejected.";
    render();
  };
  const renderDeadline = () => {
    if (!view) return;
    const deadline = view.claimDeadline ?? view.turnDeadline;
    byId("mahjong-deadline").textContent = deadline ? `${view.claimDeadline ? "Claims" : "Turn"}: ${Math.max(0, Math.ceil((deadline - (Date.now() + offset)) / 1000))}s` : "Round complete";
  };
  const renderResult = () => {
    const panel = byId("mahjong-live-result"); const result = view.roundResult;
    panel.hidden = !result;
    if (!result) return;
    const winner = view.players.find(({ id }) => id === result.winnerPlayerId);
    const items = (result.scoringItems ?? []).map(({ name, fan }) => `<li>${name}: ${fan} fan</li>`).join("");
    const deltas = Object.entries(result.paymentDeltas ?? {}).map(([id, delta]) => `<li>${view.players.find((p) => p.id === id)?.name ?? id}: ${formatPaymentDelta(delta)}</li>`).join("");
    panel.innerHTML = `<h3>${result.outcome === "draw" ? "Round drawn" : `${winner?.name ?? "Player"} wins`}</h3>
      ${result.handType ? `<p>${getMahjongHandTypeLabel(result.handType)} · ${formatFanTotal(result.fan)}</p>` : ""}
      <ul>${items}</ul><h4>Payments</h4><ul>${deltas || "<li>No point changes</li>"}</ul>
      <p>${result.dealerContinues ? "Dealer continues." : "Dealer rotates."}</p>`;
  };
  const render = () => {
    if (!view?.you) return;
    offset = view.serverTime - Date.now();
    const dealer = view.players.find(({ id }) => id === view.dealerPlayerId);
    byId("mahjong-heading").textContent = view.matchComplete ? "Match complete" : `${view.players.find(({ id }) => id === view.currentPlayerId)?.name ?? "Waiting"}'s turn`;
    byId("mahjong-dealer").textContent = `${dealer?.name ?? "—"} (${dealer?.seatWind ?? "east"})`;
    byId("mahjong-prevailing").textContent = view.prevailingWind;
    byId("mahjong-live-count").textContent = view.liveWallCount;
    byId("mahjong-dead-count").textContent = view.deadWallCount;
    byId("mahjong-pending-label").textContent = view.pendingDiscard ? getMahjongTileLabel(view.pendingDiscard.tile) : "None";
    byId("mahjong-opponents").replaceChildren(...view.players.filter(({ id }) => id !== view.you.id).map((player) => {
      const article = document.createElement("article");
      article.innerHTML = `<strong></strong><span></span>`;
      article.querySelector("strong").textContent = `${player.name} · ${player.seatWind} · ${player.points} pts`;
      article.querySelector("span").textContent = `${player.concealedTileCount} tiles${player.connected ? "" : " · disconnected"}${player.active ? "" : " · forfeited"}`;
      return article;
    }));
    const publicDiscards = view.players.flatMap(({ discards }) => discards.filter(({ claimed }) => !claimed).map(({ tile }) => tile));
    byId("mahjong-discards").replaceChildren(...tileRow(publicDiscards, "discarded"));
    const ownPublic = view.players.find(({ id }) => id === view.you.id);
    byId("mahjong-bonuses").replaceChildren(...tileRow(ownPublic.bonusTiles, "bonus"));
    const byType = (type) => ownPublic.exposedMelds.filter((meld) => meld.type === type).flatMap(({ tiles }) => tiles);
    byId("mahjong-chow").replaceChildren(...tileRow(byType("chow"), "exposed"));
    byId("mahjong-pung").replaceChildren(...tileRow(byType("pung"), "exposed"));
    byId("mahjong-kong").replaceChildren(...tileRow(byType("kong"), "exposed"));
    byId("mahjong-hand").replaceChildren(...view.you.concealedTiles.map((tile, index) => {
      const element = createMahjongTileElement(tile, { interactive: true, selected: tile.id === selectedId, disabled: !tile.discardable || busy || !connected, state: tile.newlyDrawn ? "newly-drawn" : "normal", stackIndex: index });
      element.addEventListener("click", () => { selectedId = selectedId === tile.id ? null : tile.id; render(); });
      return element;
    }));
    const claims = view.you.claimOptions;
    byId("mahjong-claim-actions").hidden = !claims;
    for (const [id, enabled] of [["mahjong-claim-win", claims?.mahjong?.available], ["mahjong-claim-pung", claims?.pung], ["mahjong-claim-kong", claims?.kong], ["mahjong-claim-chow", claims?.chows?.length], ["mahjong-claim-pass", claims?.pass]]) {
      byId(id).hidden = !enabled; byId(id).disabled = busy || !connected;
    }
    byId("mahjong-chow-options").replaceChildren(...(claims?.chows ?? []).map((ids, index) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "button button-secondary";
      button.textContent = `Chow option ${index + 1}`; button.addEventListener("click", () => act(() => onClaim("chow", ids))); return button;
    }));
    byId("mahjong-discard-action").hidden = !view.you.canDiscard;
    byId("mahjong-discard-action").disabled = !selectedId || busy || !connected;
    byId("mahjong-win-action").hidden = !view.you.mahjong?.available;
    byId("mahjong-win-action").disabled = busy || !connected;
    byId("mahjong-kong-action").hidden = !(view.you.concealedKongs.length || view.you.addedKongs.length);
    byId("mahjong-kong-action").disabled = busy || !connected;
    byId("mahjong-next-ready").hidden = !view.roundResult;
    byId("mahjong-leave").disabled = busy || !connected;
    byId("mahjong-notice").textContent = view.you.privateMessage?.message ?? (!connected ? "Reconnecting; your seat and deadline are preserved." : "");
    renderResult(); renderDeadline();
  };
  byId("mahjong-sort").addEventListener("click", () => { selectedId = null; render(); });
  byId("mahjong-discard-action").addEventListener("click", () => act(() => onDiscard(selectedId)));
  byId("mahjong-win-action").addEventListener("click", () => act(onWin));
  byId("mahjong-kong-action").addEventListener("click", () => {
    const concealed = view.you.concealedKongs[0]; const added = view.you.addedKongs[0];
    act(() => onKong(concealed ? { type: "concealed", tileIds: concealed } : { type: "added", ...added }));
  });
  byId("mahjong-claim-win").addEventListener("click", () => act(() => onClaim("mahjong")));
  byId("mahjong-claim-pung").addEventListener("click", () => act(() => onClaim("pung", view.you.claimOptions.pung)));
  byId("mahjong-claim-kong").addEventListener("click", () => act(() => onClaim("kong", view.you.claimOptions.kong)));
  byId("mahjong-claim-chow").addEventListener("click", () => {
    const candidate = view.you.claimOptions.chows[0];
    if (candidate) act(() => onClaim("chow", candidate));
  });
  byId("mahjong-claim-pass").addEventListener("click", () => act(() => onClaim("pass")));
  byId("mahjong-next-ready").addEventListener("click", () => act(() => onReady(true)));
  byId("mahjong-leave").addEventListener("click", onLeave);
  return {
    update(next) { view = next; selectedId = next.you?.concealedTiles.some(({ id }) => id === selectedId) ? selectedId : null; render(); },
    setConnected(value) { connected = value; render(); },
    setBusy(value) { busy = value; render(); },
    startTimer() { if (!timer) timer = window.setInterval(renderDeadline, 250); },
    stopTimer() { window.clearInterval(timer); timer = null; },
  };
};
