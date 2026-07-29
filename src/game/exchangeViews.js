const cardView = (card) => ({ id: card.id, rank: card.rank, suit: card.suit, value: card.value });

export const createExchangeView = ({ room, session, playerId, serverTime }) => {
  const roomPlayers = new Map(room.players.map((player) => [player.id, player]));
  const participantNames = new Map(session.participants.map((player) => [player.id, player.name]));
  const roles = new Map(session.roles.map((assignment) => [assignment.playerId, assignment.role]));
  const ownState = session.roundState.players.find((player) => player.id === playerId);
  const requirementForHigher = session.requirements.find((item) => item.higherPlayerId === playerId && !item.complete);
  const requirementForLower = session.requirements.find((item) => item.lowerPlayerId === playerId);
  const relevantRequirement = requirementForHigher ?? requirementForLower ?? null;
  const receivedCards = requirementForHigher
    ? requirementForHigher.givenCardIds
      .map((id) => ownState.hand.find((card) => card.id === id))
      .filter(Boolean)
      .map(cardView)
    : [];
  const givenCards = requirementForLower
    ? requirementForLower.givenCards.map(cardView)
    : [];
  const waitingForPlayerIds = session.requirements
    .filter((requirement) => !requirement.complete)
    .map((requirement) => requirement.higherPlayerId);

  return {
    roomCode: room.code,
    roomStatus: room.status,
    roundNumber: session.roundState.roundNumber,
    revision: session.revision,
    serverTime,
    you: ownState ? {
      id: ownState.id,
      name: participantNames.get(ownState.id),
      role: roles.get(ownState.id),
      hand: ownState.hand.map(cardView),
      connected: roomPlayers.get(ownState.id)?.connected ?? false,
      isHost: room.hostPlayerId === ownState.id,
    } : null,
    players: session.participants.map((participant) => {
      const roomPlayer = roomPlayers.get(participant.id);
      const pending = session.requirements.some((item) => item.higherPlayerId === participant.id && !item.complete);
      const complete = session.requirements.some((item) =>
        (item.higherPlayerId === participant.id || item.lowerPlayerId === participant.id) && item.complete);
      return {
        id: participant.id,
        name: participant.name,
        role: roles.get(participant.id),
        connected: roomPlayer?.connected ?? false,
        isHost: room.hostPlayerId === participant.id,
        exchangeStatus: pending ? "choosing_return" : complete ? "complete" : "waiting",
      };
    }),
    yourExchange: relevantRequirement ? {
      type: requirementForHigher ? "return_cards" : "waiting_for_return",
      otherPlayerId: requirementForHigher ? requirementForHigher.lowerPlayerId : requirementForLower.higherPlayerId,
      otherPlayerName: participantNames.get(requirementForHigher ? requirementForHigher.lowerPlayerId : requirementForLower.higherPlayerId),
      requiredCardCount: requirementForHigher?.returnCardCount ?? 0,
      receivedCards,
      givenCards,
      complete: relevantRequirement.complete,
    } : null,
    waitingForPlayerIds,
    allExchangesComplete: session.allComplete,
    message: null,
  };
};
