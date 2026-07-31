import { createMahjongTileElement } from "../ui/mahjongTileRenderer.js";
import { renderMahjongScoringScenario } from "../ui/mahjongScoreRenderer.js";

const suit = (name, rank, copy = 1) => ({
  id: `${name}-${rank}-${copy}`, faceId: `${name}-${rank}`, category: "suit", suit: name, rank,
  assetPath: `/assets/mahjong/${name}-${rank}.svg`,
});
const honor = (faceId, honorType, value, copy = 1) => ({
  id: `${faceId}-${copy}`, faceId, category: "honor", honorType, [honorType]: value,
  assetPath: `/assets/mahjong/${faceId}.svg`,
});
const bonus = (faceId, bonusType) => ({
  id: `${faceId}-1`, faceId, category: "bonus", bonusType,
  assetPath: `/assets/mahjong/${faceId}.svg`,
});

const demoHand = [
  suit("characters", 1), suit("characters", 2), suit("characters", 3),
  suit("dots", 2), suit("dots", 3), suit("dots", 4),
  suit("bamboo", 5, 1), suit("bamboo", 5, 2), suit("bamboo", 5, 3),
  honor("east-wind", "wind", "east", 1), honor("east-wind", "wind", "east", 2),
  honor("red-dragon", "dragon", "red", 1), honor("red-dragon", "dragon", "red", 2),
  honor("red-dragon", "dragon", "red", 3),
];

const renderGroup = (id, tiles, state) => {
  document.getElementById(id).replaceChildren(...tiles.map((tile) => createMahjongTileElement(tile, { state })));
};

const renderScoringPanel = async () => {
  const select = document.getElementById("mahjong-score-example");
  const output = document.getElementById("mahjong-score-output");
  try {
    const response = await fetch("/demo/mahjong-scoring");
    if (!response.ok) throw new Error("Scoring examples are available only in development.");
    const { scenarios } = await response.json();
    select.replaceChildren(...scenarios.map((scenario) => {
      const option = document.createElement("option");
      option.value = scenario.id;
      option.textContent = scenario.name;
      return option;
    }));
    const show = () => renderMahjongScoringScenario(
      output,
      scenarios.find(({ id }) => id === select.value) ?? scenarios[0],
    );
    select.addEventListener("change", show);
    show();
  } catch (error) {
    output.textContent = error.message;
  }
};

export const renderMahjongDemo = () => {
  const hand = document.getElementById("mahjong-hand");
  hand.replaceChildren(...demoHand.map((tile, index) => createMahjongTileElement(tile, {
    interactive: true, state: index === demoHand.length - 1 ? "newly-drawn" : "normal",
    selected: index === 4, stackIndex: index,
  })));
  renderGroup("mahjong-bonuses", [bonus("spring", "season"), bonus("plum", "flower"), bonus("orchid", "flower")], "bonus");
  renderGroup("mahjong-chow", [suit("characters", 4), suit("characters", 5), suit("characters", 6)], "exposed");
  renderGroup("mahjong-pung", [honor("green-dragon", "dragon", "green", 1), honor("green-dragon", "dragon", "green", 2), honor("green-dragon", "dragon", "green", 3)], "exposed");
  renderGroup("mahjong-kong", [suit("dots", 8, 1), suit("dots", 8, 2), suit("dots", 8, 3), suit("dots", 8, 4)], "exposed");
  renderGroup("mahjong-discards", [
    suit("bamboo", 1), honor("south-wind", "wind", "south"), suit("dots", 7),
    honor("white-dragon", "dragon", "white"), suit("characters", 9), suit("bamboo", 3),
  ], "discarded");
  void renderScoringPanel();
};
