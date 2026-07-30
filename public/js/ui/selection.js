export const canAddToSelection = (selectedCards, candidate, { mode = "gameplay", max = Infinity } = {}) => {
  // This is visual-selection guidance only; the server rules engine remains
  // authoritative when the interface is integrated with live games.
  if (!candidate || !candidate.rank) return { allowed: false, reason: "Choose a valid card." };
  if (selectedCards.length >= max) return { allowed: false, reason: `Choose ${max} card${max === 1 ? "" : "s"}.` };
  if (mode === "exchange") return { allowed: true, reason: "" };
  if (candidate.isJoker || selectedCards.some((card) => card.isJoker)) {
    return selectedCards.length
      ? { allowed: false, reason: "A joker must be played alone." }
      : { allowed: true, reason: "" };
  }
  if (!selectedCards.length || selectedCards[0].rank === candidate.rank) return { allowed: true, reason: "" };
  return { allowed: false, reason: `Choose only ${selectedCards[0].rank}s for this play.` };
};

export const toggleCardSelection = (selectedIds, card, cards, options = {}) => {
  if (selectedIds.includes(card.id)) return { ids: selectedIds.filter((id) => id !== card.id), reason: "" };
  const selectedCards = cards.filter((item) => selectedIds.includes(item.id));
  if (options.mode !== "exchange" && card.isJoker) {
    return { ids: [card.id], reason: "" };
  }
  if (options.mode !== "exchange" && selectedCards.some((item) => item.isJoker)) {
    return { ids: [card.id], reason: "" };
  }
  const check = canAddToSelection(selectedCards, card, options);
  return check.allowed ? { ids: [...selectedIds, card.id], reason: "" } : { ids: selectedIds, reason: check.reason };
};
