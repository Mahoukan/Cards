const HAND_TYPES = Object.freeze({
  standard: "Standard hand",
  "seven-pairs": "Seven Pairs",
  "thirteen-orphans": "Thirteen Orphans",
});

const DECLARATION_MESSAGES = Object.freeze({
  MAHJONG_VALID: "Valid Mahjong declaration",
  HAND_NOT_COMPLETE: "The hand is not complete",
  INSUFFICIENT_FAN: "Complete hand, but below the 3-fan minimum",
  INVALID_TILE_COUNT: "The hand has an invalid tile count",
  INVALID_EXPOSED_MELD: "An exposed meld is invalid",
  IMPOSSIBLE_TILE_COUNT: "The hand contains an impossible tile count",
});

export const getMahjongHandTypeLabel = (handType) => HAND_TYPES[handType] ?? "No valid hand";
export const getMahjongDeclarationMessage = (code) => DECLARATION_MESSAGES[code] ?? "Invalid Mahjong declaration";
export const formatFanTotal = (fan) => `${fan} fan`;
export const formatPaymentDelta = (delta) => `${delta > 0 ? "+" : ""}${delta}`;

export const renderMahjongScoringScenario = (container, scenario) => {
  const scoringItems = scenario.scoring?.items ?? [];
  const deltas = scenario.payment?.deltas ?? {};
  container.replaceChildren();
  const summary = document.createElement("dl");
  summary.className = "mahjong-score-summary";
  const rows = [
    ["Hand", getMahjongHandTypeLabel(scenario.handType)],
    ["Structure", scenario.structurallyValid ? "Valid" : "Invalid"],
    ["Declaration", getMahjongDeclarationMessage(scenario.code)],
    ["Total", formatFanTotal(scenario.scoring?.totalFan ?? 0)],
    ["Minimum", scenario.qualifiesToWin ? "Met" : "Not met"],
  ];
  for (const [term, description] of rows) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = term;
    dd.textContent = description;
    summary.append(dt, dd);
  }
  const fanList = document.createElement("ul");
  fanList.className = "mahjong-score-list";
  if (!scoringItems.length) {
    const empty = document.createElement("li");
    empty.textContent = "No fan-scoring patterns";
    fanList.append(empty);
  } else {
    for (const scoringItem of scoringItems) {
      const row = document.createElement("li");
      row.textContent = `${scoringItem.name}: ${formatFanTotal(scoringItem.fan)}`;
      fanList.append(row);
    }
  }
  const paymentList = document.createElement("ul");
  paymentList.className = "mahjong-payment-list";
  if (!scenario.payment) {
    const unavailable = document.createElement("li");
    unavailable.textContent = "No payment: declaration does not meet 3 fan";
    paymentList.append(unavailable);
  } else {
    for (const [playerId, delta] of Object.entries(deltas)) {
      const row = document.createElement("li");
      row.textContent = `${playerId}: ${formatPaymentDelta(delta)} points`;
      paymentList.append(row);
    }
  }
  container.append(summary, fanList, paymentList);
};
