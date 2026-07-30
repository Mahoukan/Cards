const RANKS = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];

export const selectionNeedsDirection = (selectedIds, hand) => {
  const selected = selectedIds.map((id) => hand.find((card) => card.id === id)).filter(Boolean);
  return selected.length > 0 && selected.every((card) => card.rank === "10" && !card.isJoker);
};

export const canCallConsecutive = (selectedIds, hand, view) => {
  if (!view?.consecutiveAvailable || !view.currentPlay || selectedIds.length !== view.currentPlay.count) return false;
  const selected = selectedIds.map((id) => hand.find((card) => card.id === id)).filter(Boolean);
  if (selected.length !== selectedIds.length || selected.some((card) => card.isJoker)) return false;
  const expected = RANKS[RANKS.indexOf(view.currentPlay.rank) + 1];
  return Boolean(expected && selected.every((card) => card.rank === expected));
};

export const reconcileSpecialSelection = ({ selectedIds, hand, direction, consecutive, view }) => ({
  direction: selectionNeedsDirection(selectedIds, hand) ? direction : null,
  consecutive: canCallConsecutive(selectedIds, hand, view) ? consecutive : false,
});
