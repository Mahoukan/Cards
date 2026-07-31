import { DEAD_WALL_SIZE } from "./constants.js";
import { createMahjongTileSet } from "./tiles.js";

export const shuffleTiles = (tiles, random = Math.random) => {
  const shuffled = [...tiles];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
};

export const createWall = ({
  tiles = createMahjongTileSet(), random = Math.random, shuffle = true,
  deadWallSize = DEAD_WALL_SIZE,
} = {}) => {
  const ordered = shuffle ? shuffleTiles(tiles, random) : [...tiles];
  const split = Math.max(0, ordered.length - deadWallSize);
  return { liveWall: ordered.slice(0, split), deadWall: ordered.slice(split) };
};

export const drawFromLiveWall = (wall) => {
  if (!wall.liveWall.length) return { wall, tile: null };
  return {
    tile: wall.liveWall[0],
    wall: { ...wall, liveWall: wall.liveWall.slice(1), deadWall: [...wall.deadWall] },
  };
};

export const drawReplacementTile = (wall) => {
  if (!wall.deadWall.length) return { wall, tile: null, replenished: false };
  const tile = wall.deadWall.at(-1);
  const remainingDeadWall = wall.deadWall.slice(0, -1);
  const replenishment = wall.liveWall[0] ?? null;
  return {
    tile,
    replenished: replenishment !== null,
    wall: {
      ...wall,
      liveWall: replenishment ? wall.liveWall.slice(1) : [...wall.liveWall],
      deadWall: replenishment ? [replenishment, ...remainingDeadWall] : remainingDeadWall,
    },
  };
};
