import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import test from "node:test";

const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const suits = ["clubs", "diamonds", "hearts", "spades"];

test("card asset directory contains all 52 unique standard SVGs and two unused jokers", async () => {
  const files = await readdir(new URL("../public/assets/cards/", import.meta.url));
  const svgFiles = files.filter((name) => name.endsWith(".svg"));
  const expected = ranks.flatMap((rank) => suits.map((suit) => `${rank}-${suit}.svg`));
  assert.equal(new Set(svgFiles).size, svgFiles.length);
  assert.deepEqual(expected.filter((name) => !svgFiles.includes(name)), []);
  assert.deepEqual(svgFiles.filter((name) => name.startsWith("joker-")).sort(), ["joker-black.svg", "joker-red.svg"]);
  assert.equal(svgFiles.filter((name) => !name.startsWith("joker-")).length, 52);
});
