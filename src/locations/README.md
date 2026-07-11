# Location format

Each playable location lives in its own lowercase UUID v4 directory:

```text
src/locations/67672370-d5cc-4898-825c-26789890240a/
  answer.txt
  question.webp
```

Location directories must contain exactly these two files. **Edit answers** on
the RooGuessr website downloads a UUID-named ZIP with both files at its root.
Create a directory using the ZIP filename without `.zip`, then extract the files
into it.

`question.webp` is the 1400×1000 image shown to the player. Submit only this
single question image.

`answer.txt` contains the normalized map coordinate on one line:

```text
0.25, 0.70
```

Coordinates are normalized from `0` to `1`, measured from the bottom-left
corner: `(0, 0)` is the bottom-left and `(1, 1)` is the top-right. The directory
UUID is the location ID.

Run `pnpm validate:locations` before opening a pull request.
