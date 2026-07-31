import { readdir } from "node:fs/promises";
import path from "node:path";

const suits = ["characters", "dots", "bamboo"];
const expected = [
  ...suits.flatMap((suit) => Array.from({ length: 9 }, (_, index) => `${suit}-${index + 1}.svg`)),
  ..."east south west north".split(" ").map((wind) => `${wind}-wind.svg`),
  ..."red green white".split(" ").map((dragon) => `${dragon}-dragon.svg`),
  ..."spring summer autumn winter plum orchid chrysanthemum bamboo-flower".split(" ").map((name) => `${name}.svg`),
];
const directory = path.resolve("public/assets/mahjong");
let discovered = [];
try {
  discovered = (await readdir(directory)).filter((name) => name.toLowerCase().endsWith(".svg"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const expectedSet = new Set(expected);
const missing = expected.filter((name) => !discovered.includes(name));
const unexpected = discovered.filter((name) => !expectedSet.has(name));
const duplicates = discovered.filter((name, index) =>
  discovered.findIndex((candidate) => candidate.toLowerCase() === name.toLowerCase()) !== index);
console.log(`Expected: ${expected.length}`);
console.log(`Found: ${discovered.length}`);
console.log(`Missing: ${missing.length}`);
console.log(`Unexpected: ${unexpected.length}`);
console.log(`Duplicate canonical names: ${duplicates.length}`);
if (missing.length) console.log(`Missing files:\n- ${missing.join("\n- ")}`);
if (unexpected.length) console.log(`Unexpected files:\n- ${unexpected.join("\n- ")}`);
console.log("Informational validation only; missing assets use accessible browser fallbacks.");
