const values = { "3": 0, "4": 1, "5": 2, "6": 3, "7": 4, "8": 5, "9": 6, "10": 7, J: 8, Q: 9, K: 10, A: 11, "2": 12 };
const makeCard = (rank, suit) => ({ id: `${rank}-${suit}`, rank, suit, value: values[rank] });
const makeJoker = (color) => ({ id: `joker-${color}`, rank: "JOKER", suit: null, color, value: 13, isJoker: true });

export const createDemoState = () => ({
  roomCode: "ABCD",
  isHost: true,
  players: [
    { id: "you", name: "You", connected: true, ready: false, host: true, current: true, cards: 12 },
    { id: "alex", name: "Alex", connected: true, ready: true, cards: 9, turn: false },
    { id: "morgan", name: "Morgan", connected: true, ready: true, cards: 11 },
    { id: "jamie", name: "Jamie", connected: false, ready: false, cards: 8 },
  ],
  hand: [
    makeCard("3", "clubs"), makeCard("3", "hearts"), makeCard("4", "diamonds"),
    makeCard("5", "spades"), makeCard("5", "hearts"), makeCard("7", "clubs"),
    makeCard("8", "diamonds"), makeCard("9", "spades"), makeCard("10", "hearts"),
    makeCard("J", "clubs"), makeCard("A", "diamonds"), makeCard("2", "spades"), makeJoker("black"),
  ],
  pile: { cards: [makeCard("7", "diamonds"), makeCard("7", "spades")], player: "Morgan" },
  selectedIds: [],
  turnId: "you",
  youPassed: false,
  youFinished: false,
  seconds: 30,
});

export const results = [
  ["Jamie", "President"], ["You", "Vice President"], ["Alex", "Citizen"],
  ["Morgan", "Citizen"], ["Taylor", "Vice Scum"], ["Casey", "Scum"],
];
