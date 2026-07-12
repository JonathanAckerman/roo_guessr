# Contributing to RooGuessr

Thanks for helping expand the RooGuessr location pool.

## Submit a location

1. Fork the repository.
2. Create a branch for your location.
3. Open **Add your own** on the RooGuessr website. Choose a question screenshot
   and an answer screenshot, position each crop independently, and mark the
   location's position on the map.
4. Export the generated ZIP, create `src/locations/<zip-name>/`, and extract the
   ZIP's three files directly into that folder: `question.webp`, `answer.webp`,
   and `pin.txt`.
5. Open a pull request using the provided template.

The builder accepts PNG, JPG, and WebP inputs that are at least 1400×1000.
Each draggable crop creates a 1400×1000 WebP, and the builder creates
`pin.txt` automatically. It runs entirely in the browser and does not upload
your source images. If you have the development tools installed, run
`pnpm check` before submitting; GitHub Actions performs the same validation on
the pull request.

See the documented [location format](src/locations/README.md) for the exact
files accepted by the repository.

Please use consistent Dota graphics and camera settings. Hide the HUD, minimap,
cursor, heroes, particles, and other temporary clues. The question should be
recognizable without making the answer immediate.

The maintainer may adjust coordinates or image framing during review.
Submissions that are visually ambiguous or too similar to existing locations
may be declined.

Locations created before answer-image support temporarily fall back to their
question image after a guess. New submissions must include all three files;
the legacy exception will be removed as those older locations receive authored
answer images.

## Code contributions

Bug fixes and focused improvements are welcome. For larger features, open an
issue first so the design can be discussed before substantial work begins.
