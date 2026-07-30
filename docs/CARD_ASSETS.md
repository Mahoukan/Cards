# Card assets

Standard card SVGs are stored in `public/assets/cards/` and map directly to engine card IDs:

```text
<rank>-<suit>.svg
```

Valid ranks are `A`, `2`–`10`, `J`, `Q`, and `K`. Valid suits are `clubs`, `diamonds`, `hearts`, and `spades`. Examples include `3-clubs.svg`, `10-hearts.svg`, and `K-spades.svg`.

The shared browser mapper accepts the standard-card pattern plus exactly `joker-black` and `joker-red`, mapping them to `/assets/cards/joker-black.svg` and `/assets/cards/joker-red.svg`. It rejects every other joker name, paths, URLs, extensions, slashes, backslashes, and traversal segments.

Each rendered card starts with its CSS/text face. Its decorative SVG is loaded through a normal `<img>` request and browser cache. After a successful load the image replaces the visible fallback while the containing card retains its accessible label, including “Black Joker” or “Red Joker”. On failure the image is hidden and the fallback remains visible; no manual fetching, inlining, preloading, or retry loop is used.
