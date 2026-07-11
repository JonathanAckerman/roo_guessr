# Contributing to RooGuessr

Thanks for helping expand the RooGuessr location pool.

## Submit a location

1. Fork the repository.
2. Create a branch for your location.
3. Open **Edit answers** on the RooGuessr website, choose your screenshot, and
   mark its position on the map.
4. Download the generated ZIP, create `src/locations/<zip-name>/`, and extract
   the ZIP's two files into that folder.
5. Open a pull request using the provided template.

The builder accepts PNG, JPG, and WebP inputs that are at least 1400×1000. Its
draggable crop box creates the required 1400×1000 WebP, and it creates
`answer.txt` automatically. It runs entirely in the browser and does not upload
your source image. If you have the development tools installed, run `pnpm check`
before submitting; GitHub Actions performs the same validation on the pull
request.

See the documented [location format](src/locations/README.md) for the exact
files accepted by the repository.

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
