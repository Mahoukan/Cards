import { MAX_PLAYERS, MIN_PLAYERS, ROLE_NAMES } from "./constants.js";
import { selectHighestCards } from "./deck.js";

const rolesByPlayerCount = Object.freeze({
  2: [ROLE_NAMES.PRESIDENT, ROLE_NAMES.SCUM],
  3: [ROLE_NAMES.PRESIDENT, ROLE_NAMES.CITIZEN, ROLE_NAMES.SCUM],
  4: [ROLE_NAMES.PRESIDENT, ROLE_NAMES.VICE_PRESIDENT, ROLE_NAMES.VICE_SCUM, ROLE_NAMES.SCUM],
  5: [ROLE_NAMES.PRESIDENT, ROLE_NAMES.VICE_PRESIDENT, ROLE_NAMES.CITIZEN, ROLE_NAMES.VICE_SCUM, ROLE_NAMES.SCUM],
  6: [ROLE_NAMES.PRESIDENT, ROLE_NAMES.VICE_PRESIDENT, ROLE_NAMES.CITIZEN, ROLE_NAMES.CITIZEN, ROLE_NAMES.VICE_SCUM, ROLE_NAMES.SCUM],
});

function validateFinishOrder(finishOrder) {
  if (!Array.isArray(finishOrder) || finishOrder.length < MIN_PLAYERS || finishOrder.length > MAX_PLAYERS) {
    throw new RangeError(`finishOrder must contain ${MIN_PLAYERS} to ${MAX_PLAYERS} player IDs.`);
  }
  if (new Set(finishOrder).size !== finishOrder.length) {
    throw new Error("finishOrder must contain unique player IDs.");
  }
}

export function assignRoles(finishOrder) {
  validateFinishOrder(finishOrder);
  return finishOrder.map((playerId, index) => ({
    playerId,
    finishPosition: index + 1,
    role: rolesByPlayerCount[finishOrder.length][index],
  }));
}

export function getExchangeRequirements(finishOrder) {
  const assignments = assignRoles(finishOrder);
  const playerWithRole = (role) =>
    assignments.find((assignment) => assignment.role === role)?.playerId;

  const requirements = [{
    lowerPlayerId: playerWithRole(ROLE_NAMES.SCUM),
    higherPlayerId: playerWithRole(ROLE_NAMES.PRESIDENT),
    requiredHighestCardCount: 2,
    returnCardCount: 2,
  }];

  if (finishOrder.length >= 4) {
    requirements.push({
      lowerPlayerId: playerWithRole(ROLE_NAMES.VICE_SCUM),
      higherPlayerId: playerWithRole(ROLE_NAMES.VICE_PRESIDENT),
      requiredHighestCardCount: 1,
      returnCardCount: 1,
    });
  }

  return requirements;
}

export { selectHighestCards };
