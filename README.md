# RooGuessr

RooGuessr is a Dota map-location guessing game. Players study a tightly cropped
scene, place a pin on the full map, and score points based on the distance from
the real location.

The game is designed as a community-curated public project. Contributors can
submit new locations through pull requests while the repository owner retains
control over everything that reaches the live site.

## Planned game loop

1. Choose Easy, Medium, or Hard.
2. Play ten randomly selected locations.
3. Place a pin on the full map for each location.
4. Reveal the answer and award up to 5,000 points per round.
5. Show the final score after all ten rounds.

Difficulty changes the crop rather than the underlying question. Easy shows the
full 500 px scene, Medium shows 70%, and Hard shows 45%.

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

See [the location format](src/locations/README.md) and
[the contribution guide](CONTRIBUTING.md). A location is discovered
automatically when its directory is added; there is no central manifest to
update.

## Deployment

Merges to `main` are built and deployed automatically with GitHub Actions. The
production site is configured for `https://rooguessr.peasantroad.com`.
