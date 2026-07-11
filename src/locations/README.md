# Location format

Each playable location lives in its own kebab-case directory:

```text
src/locations/radiant-secret-shop/
  answer.txt
  question.webp
```

`question.webp` is the full 7:5 Easy-mode image. Medium and Hard are generated
by cropping the same image at runtime, so do not submit separate difficulty
images.

`answer.txt` contains the normalized map coordinate on one line:

```text
0.25, 0.70
```

Coordinates are normalized from `0` to `1`, measured from the bottom-left
corner: `(0, 0)` is the bottom-left and `(1, 1)` is the top-right. The directory
name is the location ID.

Run `pnpm validate:locations` before opening a pull request.
