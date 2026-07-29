export const canAddToSelection = (selectedCards, candidate) => {
  // This is visual-selection guidance only; the server rules engine remains
  // authoritative when the interface is integrated with live games.
  if (!candidate || !candidate.rank) return { allowed: false, reason: "Choose a valid card." };
  if (!selectedCards.length || selectedCards[0].rank === candidate.rank) return { allowed: true, reason: "" };
  return { allowed: false, reason: `Choose only ${selectedCards[0].rank}s for this play.` };
};

export const toggleCardSelection = (selectedIds, card, cards) => {
  if (selectedIds.includes(card.id)) return { ids: selectedIds.filter((id) => id !== card.id), reason: "" };
  const selectedCards = cards.filter((item) => selectedIds.includes(item.id));
  const check = canAddToSelection(selectedCards, card);
  return check.allowed ? { ids: [...selectedIds, card.id], reason: "" } : { ids: selectedIds, reason: check.reason };
};
