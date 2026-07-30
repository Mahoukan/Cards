export const GAME_INSTRUCTIONS = Object.freeze({
  president: Object.freeze({
    id: "president",
    title: "How to Play President",
    sections: Object.freeze([
      ["Objective", ["Be the first player to empty your hand. Finishing order determines President, Vice President, Citizens, Vice Scum, and Scum."]],
      ["Card order", ["From lowest to highest: 3, 4, 5, 6, 7, 8, 9, 10, Jack, Queen, King, Ace, 2, Jokers.", "Black and red jokers are equivalent during play."]],
      ["Round 1 opening", ["The holder of the 3 of Clubs starts.", "Their opening play must contain the 3 of Clubs.", "If they time out, the 3 of Clubs is automatically played alone."]],
      ["Normal play", ["Play a single, pair, triple, or four of a kind.", "All normal cards in one play must have the same rank.", "Match the active card quantity and beat its rank.", "Suits have no gameplay ranking."]],
      ["Passing", ["A player who passes is out until the pile clears.", "When all eligible opponents have passed, the last successful player leads again."]],
      ["Twos", ["Twos are the highest standard rank.", "A valid play of twos clears the pile.", "Twos must still match the active quantity."]],
      ["Tens", ["Playing 10s requires choosing Higher or Lower for the next player's turn only.", "The choice expires after that player plays, passes, or times out.", "Afterward, normal comparison resumes from the card actually played. Example: 10 Lower, then 3, then normal play resumes above 3."]],
      ["Consecutive", ["After three ascending, same-sized plays, the third player may call Consecutive.", "Each next play must normally be exactly one rank higher.", "A 10 can make the next step Higher or Lower once; Consecutive then resumes upward from the card actually played.", "Example: 9, 10 Lower, 9, 10 Higher, Jack, Queen.", "Passing does not immediately end Consecutive. Clearing the pile ends it, and a joker overrides and clears everything."]],
      ["Jokers", ["A joker must be played alone.", "A joker beats a single, pair, triple, or four of a kind and immediately clears the pile.", "The joker player leads again if they still have cards.", "A joker does not replace the required Round 1 opening 3 of Clubs."]],
      ["Finishing", ["Emptying a hand records that player's position.", "The last remaining player receives the final position automatically."]],
      ["Later rounds and exchanges", ["Scum gives two highest cards to President; President returns any two cards.", "With four or more players, Vice Scum gives their highest card to Vice President; Vice President returns one card.", "Scum starts Round 2 and later. Later rounds do not require the 3 of Clubs opening play."]],
      ["Timer and connection", ["Each turn lasts 30 seconds.", "An active-pile timeout counts as a pass; an empty-pile timeout normally skips that turn.", "A disconnected player's timer continues, and players keep the existing reconnect grace period."]],
    ]),
  }),
});

export const getGameInstructions = (gameId) => GAME_INSTRUCTIONS[gameId] ?? null;
export const nextInstructionDialogState = (state, action) => action === "open"
  ? { open: true, gameId: "president" }
  : { open: false, gameId: state.gameId ?? "president" };

export const createInstructionsDialog = ({ dialog, content, closeButton }) => {
  let opener = null;
  const close = () => { if (dialog.open) dialog.close(); };
  const open = (gameId = "president", trigger = document.activeElement) => {
    const game = getGameInstructions(gameId);
    if (!game) return false;
    opener = trigger;
    content.replaceChildren(...game.sections.map(([heading, items]) => {
      const section = document.createElement("section");
      const title = document.createElement("h3"); title.textContent = heading;
      const list = document.createElement("ul");
      list.replaceChildren(...items.map((text) => {
        const item = document.createElement("li"); item.textContent = text; return item;
      }));
      section.append(title, list); return section;
    }));
    if (!dialog.open) dialog.showModal();
    closeButton.focus();
    return true;
  };
  closeButton.addEventListener("click", close);
  dialog.addEventListener("close", () => opener?.focus());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) close(); });
  return { open, close, get isOpen() { return dialog.open; } };
};
