export const GAME_CATALOG = Object.freeze([
  Object.freeze({
    id: "president",
    name: "President",
    description: "Climb the ranks by emptying your hand first.",
    minimumPlayers: 2,
    maximumPlayers: 6,
    status: "available",
  }),
  Object.freeze({
    id: "crazy-eights",
    name: "Crazy Eights",
    description: "Match the suit or rank and use eights to change suit.",
    minimumPlayers: 2,
    maximumPlayers: 6,
    status: "in-development",
  }),
]);

export const getGameById = (gameId) =>
  typeof gameId === "string" ? GAME_CATALOG.find(({ id }) => id === gameId) ?? null : null;

export const getAvailableGames = () => GAME_CATALOG.filter(({ status }) => status === "available");
export const isKnownGameId = (gameId) => getGameById(gameId) !== null;
