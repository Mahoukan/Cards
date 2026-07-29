import { MAX_CODE_ATTEMPTS, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "./constants.js";

export const generateRoomCode = ({
  exists = () => false,
  random = Math.random,
  maxAttempts = MAX_CODE_ATTEMPTS,
} = {}) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let code = "";
    for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
      const randomIndex = Math.min(ROOM_CODE_ALPHABET.length - 1, Math.floor(Math.max(0, random()) * ROOM_CODE_ALPHABET.length));
      code += ROOM_CODE_ALPHABET[randomIndex];
    }
    if (!exists(code)) return code;
  }
  throw new Error("Unable to generate a unique room code.");
};
