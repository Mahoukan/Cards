# Card assets

Standard card SVGs are stored in `public/assets/cards/` and map directly to engine card IDs:

```text
<rank>-<suit>.svg
```

Valid ranks are `A`, `2`–`10`, `J`, `Q`, and `K`. Valid suits are `clubs`, `diamonds`, `hearts`, and `spades`. Examples include `3-clubs.svg`, `10-hearts.svg`, and `K-spades.svg`.

The shared browser mapper accepts only this exact allowlisted pattern. It rejects paths, URLs, extensions, traversal segments, and joker IDs. The two joker files remain available in the folder but President does not use them.

Each rendered card starts with its CSS/text face. Its decorative SVG is loaded through a normal `<img>` request and browser cache. After a successful load the image replaces the visible fallback while the containing card retains its accessible rank-and-suit label. On failure the image is hidden and the fallback remains visible; no manual fetching, inlining, preloading, or retry loop is used.
