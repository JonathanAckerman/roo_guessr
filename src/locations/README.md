# Location format

Each location lives in a folder named with a lowercase UUID v4:

```text
src/locations/<uuid>/
  answer.txt
  answer.webp
  question.webp
```

`question.webp` is the close-up shown while the player guesses. `answer.webp`
is a higher-context view revealed after the guess. Both files must be authored
images exported by the location builder at 1400×1000 (7:5).

`answer.txt` contains the answer pin as normalized `x, y` coordinates. The map's
bottom-left is `0, 0` and its top-right is `1, 1`. The location builder writes
this file automatically.

The exported ZIP contains these three files at its root. Extract them directly
into a folder named after the ZIP; do not add another nested UUID folder.

Twenty locations created before answer-image support are temporarily allowed to
omit `answer.webp` and fall back to their question image in the game. This is a
legacy migration exception only; all new locations require all three files.
