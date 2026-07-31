import { isCardPlayable } from "./rules.js";

const serialiseCard = ({ id, rank, suit, value }) => ({ id, rank, suit, value });

export const createCrazyEightsView = ({ room, session, playerId, serverTime }) => {
  const ownPlayer = session.state.players.find(({ id }) => id === playerId);
  const roomPlayers = new Map(room.players.map((player) => [player.id, player]));
  const topDiscard = session.state.discardPile.at(-1);
  const participants = session.participants.map((participant) => {
    const statePlayer = session.state.players.find(({ id }) => id === participant.id);
    const roomPlayer = roomPlayers.get(participant.id);
    return {
      id: participant.id,
      name: participant.name,
      cardCount: statePlayer?.hand.length ?? 0,
      connected: roomPlayer?.connected ?? false,
      isHost: room.hostPlayerId === participant.id,
      isCurrentPlayer: session.state.currentPlayerId === participant.id,
      forfeited: !statePlayer,
    };
  });
  const hand = ownPlayer?.hand.map((card) => ({
    ...serialiseCard(card),
    playable: session.state.turnState === "drawn-card-decision"
      ? card.id === session.state.drawnCardId
      : isCardPlayable(card, topDiscard, session.state.activeSuit),
    newlyDrawn: card.id === session.state.drawnCardId,
  })) ?? [];
  return {
    gameId: "crazy-eights",
    roomCode: room.code,
    roomStatus: room.status,
    roundNumber: session.state.roundNumber,
    revision: session.state.revision,
    serverTime,
    turnDeadline: session.turnDeadline,
    currentPlayerId: session.state.currentPlayerId,
    activeSuit: session.state.activeSuit,
    topDiscard: topDiscard ? serialiseCard(topDiscard) : null,
    drawPileCount: session.state.drawPile.length,
    discardPileCount: session.state.discardPile.length,
    players: participants,
    you: ownPlayer ? {
      id: ownPlayer.id,
      name: ownPlayer.name,
      hand,
      isHost: room.hostPlayerId === ownPlayer.id,
      turnState: session.state.turnState,
      drawnCardId: session.state.drawnCardId,
      canDraw: session.state.phase === "playing"
        && session.state.currentPlayerId === ownPlayer.id
        && session.state.turnState === "normal",
      canKeepDrawn: session.state.phase === "playing"
        && session.state.currentPlayerId === ownPlayer.id
        && session.state.turnState === "drawn-card-decision",
    } : null,
    winnerPlayerId: session.state.winnerPlayerId,
    winnerName: session.participants.find(({ id }) => id === session.state.winnerPlayerId)?.name ?? null,
    results: session.results,
    lastAction: session.lastAction,
  };
};
