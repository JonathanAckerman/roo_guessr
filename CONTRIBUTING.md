# Contributing to RooGuessr

Thanks for helping expand the RooGuessr location pool.

## Submit a location

1. Fork the repository.
2. Create a branch for your location.
3. Add one directory under `src/locations/` following the documented
   [location format](src/locations/README.md).
4. Run `pnpm check`.
5. Open a pull request using the provided template.

Use **Edit answers** on the RooGuessr website to select your local
`question.webp`, mark its position on the master map, and copy the generated
coordinate line. Paste that line into the location's `answer.txt` file. The
tool runs entirely in the browser and does not upload or modify your files.

Please use consistent Dota graphics and camera settings. Hide the HUD, minimap,
cursor, heroes, particles, and other temporary clues. The Easy crop should be
recognizable without being immediate; Medium and Hard must remain meaningfully
guessable.

The maintainer may adjust coordinates or image framing during review.
Submissions that are visually ambiguous or too similar to existing locations
may be declined.

## Code contributions

Bug fixes and focused improvements are welcome. For larger features, open an
issue first so the design can be discussed before substantial work begins.
