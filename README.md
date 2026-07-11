# RooGuessr

RooGuessr is a Dota map-location guessing game. Study the cropped
image, place a pin on the full map to guess its location, then score points based on the distance from
the actual location.

The game is designed as a community-curated public project. Contributors can
submit new locations through pull requests.

## Planned game loop

1. Choose Easy, Medium, or Hard.
2. Play ten randomly selected locations.
3. Place a pin on the full map for each location.
4. Reveal the answer and award up to 5,000 points per round.
5. Show the final score after all ten rounds.

Difficulty changes the crop rather than the underlying question. Easy shows the
full 7:5 scene, Medium shows 70%, and Hard shows 45%.

## Development

RooGuessr requires Node.js 24 or newer and pnpm 11.

```powershell
pnpm install
pnpm dev
```

Before submitting changes:

```powershell
pnpm check
```

## Adding locations

You do not need permission to propose a location. The short version is:

1. Fork this repository and create a branch.
2. Add a kebab-case directory under `src/locations/`.
3. Put `question.webp` and `answer.txt` in that directory.
4. Run `pnpm check`.
5. Open a pull request for review.

```text
src/locations/radiant-secret-shop/
  answer.txt
  question.webp
```

The Easy image is the full submitted scene. RooGuessr derives the Medium and
Hard crops from it automatically, and it discovers location directories without
a central manifest to update.

Read [the location format](src/locations/README.md) for the coordinate format and
[the contribution guide](CONTRIBUTING.md) for capture and review expectations.

## Editing answers locally

Run `pnpm dev`, then choose **Edit answers** from the main page. The authoring
page shows the master map and selected question side-by-side. Left-click the
map to place the answer pin, then save it directly to `answer.txt`.

Saving a staged image creates its `src/locations/<id>/` directory and moves the
image into it as `question.webp`. Browsers cannot modify a Git checkout from the
deployed website, so saving is available only through the local development
server.

## Deployment

Merges to `main` are built and deployed automatically with GitHub Actions. The
production site is configured for `https://rooguessr.peasantroad.com`.

## License and Dota content

The original RooGuessr code is available under the [MIT License](LICENSE).
RooGuessr does not own Dota, Dota 2, or their screenshots, map imagery, names,
logos, artwork, or other game content. Those materials belong to Valve
Corporation and their respective rights holders and are not covered by the MIT
License. RooGuessr is an unofficial community fan project.
