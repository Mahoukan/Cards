# Mahjong SVG assets

Place the 42 canonical face SVGs in `public/assets/mahjong/`. Four physical
engine copies reference one suited or honour face file. Missing files render as
accessible text in the demo.

Canonical names are the three suit ranges (`characters-1.svg` through
`bamboo-9.svg`), four `{direction}-wind.svg` files, three `{colour}-dragon.svg`
files, four named seasons, and `plum.svg`, `orchid.svg`,
`chrysanthemum.svg`, and `bamboo-flower.svg`.

The source-number mapping and licensing warning are in
`public/assets/mahjong/ATTRIBUTION.md`. Run `npm run
validate:mahjong-assets` for an informational report; it succeeds before
assets are copied.
