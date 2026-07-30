const serialisableCard = (card) => ({
  id: card.id,
  rank: card.rank,
  suit: card.suit,
  value: card.value,
  ...(card.isJoker ? { color: card.color, isJoker: true } : {}),
});
const RANKS = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];

const consecutiveOpportunity = (state) => {
  if (state.consecutiveActive) return false;
  const history = state.pilePlayHistory ?? [];
  const [first, second] = history.slice(-2);
  return Boolean(first && second && first.count === second.count && second.rankValue === first.rankValue + 1 && second.rankValue < RANKS.length - 1);
};

export const createGameView = ({ room, session, playerId, serverTime }) => {
  const ownState = session.state.players.find(({ id }) => id === playerId);
  const roomPlayers = new Map(room.players.map((player) => [player.id, player]));
  const forfeited = new Set(session.state.forfeitedPlayerIds ?? []);
  const passed = new Set(session.state.passedPlayerIds);
  const participantName = new Map(session.participants.map((player) => [player.id, player.name]));
  const positionById = new Map(session.state.players.map((player) => [player.id, player.finishPosition]));
  const players = session.participants.map((participant) => {
    const statePlayer = session.state.players.find(({ id }) => id === participant.id);
    const roomPlayer = roomPlayers.get(participant.id);
    return {
      id: participant.id,
      name: participant.name,
      cardCount: statePlayer?.hand.length ?? 0,
      connected: roomPlayer?.connected ?? false,
      passed: passed.has(participant.id),
      finished: statePlayer?.finishPosition !== null && !forfeited.has(participant.id),
      forfeited: forfeited.has(participant.id),
      finishPosition: positionById.get(participant.id) ?? null,
      isHost: room.hostPlayerId === participant.id,
      isCurrentPlayer: session.state.currentPlayerId === participant.id,
    };
  });
  return {
    roomCode: room.code,
    roomStatus: room.status,
    roundNumber: session.state.roundNumber,
    revision: session.revision,
    you: ownState ? {
      id: ownState.id,
      name: participantName.get(ownState.id),
      hand: ownState.hand.map(serialisableCard),
      connected: roomPlayers.get(ownState.id)?.connected ?? false,
      passed: passed.has(ownState.id),
      finished: ownState.finishPosition !== null && !forfeited.has(ownState.id),
      forfeited: forfeited.has(ownState.id),
      finishPosition: ownState.finishPosition,
      isHost: room.hostPlayerId === ownState.id,
    } : null,
    players,
    currentPlayerId: session.state.currentPlayerId,
    currentPlay: session.state.currentPlay ? {
      rank: session.state.currentPlay.rank,
      count: session.state.currentPlay.count,
      playerId: session.state.currentPlay.playerId,
      cards: session.state.currentPlay.cards.map(serialisableCard),
    } : null,
    lastAction: session.state.lastAction?.type === "joker_clear" ? {
      type: "joker_clear", playerId: session.state.lastAction.playerId,
      cards: session.state.lastAction.cards.map(serialisableCard),
    } : session.state.lastAction?.type === "opening_timeout" ? {
      type: "opening_timeout", playerId: session.state.lastAction.playerId, cardId: "3-clubs",
    } : null,
    openingPlayRequired: session.state.openingPlayRequired,
    consecutiveActive: session.state.consecutiveActive ?? false,
    requiredNextRank: session.state.consecutiveActive && session.state.currentPlay
      ? RANKS[session.state.currentPlay.value + (
          session.state.nextPlayOverride?.playerId === playerId
            && session.state.nextPlayOverride.direction === "lower" ? -1 : 1
        )] ?? null
      : null,
    nextPlayOverride: session.state.nextPlayOverride ? {
      direction: session.state.nextPlayOverride.direction,
      appliesToYou: session.state.nextPlayOverride.playerId === playerId,
    } : null,
    consecutiveAvailable: consecutiveOpportunity(session.state),
    turnDeadline: session.turnDeadline,
    serverTime,
    finishOrder: session.state.finishOrder.map((id) => ({ playerId: id, name: participantName.get(id) })),
    results: session.results?.map((result) => ({
      ...result,
      isHost: room.hostPlayerId === result.playerId,
    })) ?? null,
    message: null,
  };
};
