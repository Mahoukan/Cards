import { DISPLAY_NAME_MAX_LENGTH, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "./constants.js";

export const normaliseDisplayName = (value) => {
  if (typeof value !== "string" || /[\p{Cc}\p{Cf}]/u.test(value)) return null;
  const name = value.trim().replace(/\s+/gu, " ");
  if (!name || name.length > DISPLAY_NAME_MAX_LENGTH) return null;
  return name;
};

export const normaliseRoomCode = (value) => {
  if (typeof value !== "string") return null;
  const code = value.replace(/\s+/gu, "").toUpperCase();
  if (code.length !== ROOM_CODE_LENGTH || [...code].some((character) => !ROOM_CODE_ALPHABET.includes(character))) return null;
  return code;
};

export const namesMatch = (first, second) =>
  first.localeCompare(second, undefined, { sensitivity: "accent" }) === 0;
