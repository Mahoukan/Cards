import test from "node:test";
import assert from "node:assert/strict";
import {
  assignRoles,
  createDeck,
  getExchangeRequirements,
  selectHighestCards,
} from "../../src/game/index.js";

const expectedRoles = {
  2: ["President", "Scum"],
  3: ["President", "Citizen", "Scum"],
  4: ["President", "Vice President", "Vice Scum", "Scum"],
  5: ["President", "Vice President", "Citizen", "Vice Scum", "Scum"],
  6: ["President", "Vice President", "Citizen", "Citizen", "Vice Scum", "Scum"],
};

for (const [countText, roles] of Object.entries(expectedRoles)) {
  test(`assignRoles assigns the agreed roles for ${countText} players`, () => {
    const finishOrder = Array.from(
      { length: Number(countText) },
      (_, index) => `p${index + 1}`,
    );
    assert.deepEqual(assignRoles(finishOrder).map(({ role }) => role), roles);
  });
}

test("President and Scum always exchange two cards", () => {
  for (let count = 2; count <= 6; count += 1) {
    const finishOrder = Array.from({ length: count }, (_, index) => `p${index + 1}`);
    assert.deepEqual(getExchangeRequirements(finishOrder)[0], {
      lowerPlayerId: `p${count}`,
      higherPlayerId: "p1",
      requiredHighestCardCount: 2,
      returnCardCount: 2,
    });
  }
});

test("the vice exchange appears only for four to six players", () => {
  for (let count = 2; count <= 6; count += 1) {
    const finishOrder = Array.from({ length: count }, (_, index) => `p${index + 1}`);
    const requirements = getExchangeRequirements(finishOrder);
    assert.equal(requirements.length, count >= 4 ? 2 : 1);
    if (count >= 4) {
      assert.deepEqual(requirements[1], {
        lowerPlayerId: `p${count - 1}`,
        higherPlayerId: "p2",
        requiredHighestCardCount: 1,
        returnCardCount: 1,
      });
    }
  }
});

test("highest-card selection breaks rank ties by suit deterministically", () => {
  const byId = new Map(createDeck().map((card) => [card.id, card]));
  const hand = ["A-clubs", "2-clubs", "2-spades", "2-diamonds"].map((id) => byId.get(id));
  assert.deepEqual(
    selectHighestCards(hand, 2).map(({ id }) => id),
    ["2-spades", "2-diamonds"],
  );
});
