# Asset folder

Organized, predictable placeholders. **Replace any file with a real PNG of the
same name and path** — the UI picks it up automatically, no code change needed.

```
assets/
├── packs/            booster-pack artwork, 600×900 portrait
│   ├── pokemon.png
│   ├── onepiece.png
│   ├── yugioh.png
│   ├── nfl.png
│   ├── nba.png
│   └── tcg.png
└── cards/            graded-slab card artwork, 500×700
    ├── pokemon-1.png  pokemon-2.png
    ├── onepiece-1.png onepiece-2.png
    ├── yugioh-1.png   yugioh-2.png
    ├── nfl-1.png      nfl-2.png
    ├── nba-1.png      nba-2.png
    └── tcg-1.png      tcg-2.png
```

The current files are auto-generated placeholders. Regenerate them anytime with:

```
node scripts/generate-placeholder-assets.mjs
```

To add a new branch: add it to `BRANCHES` in that script **and** in
`apps/web/src/lib/branches.ts`.
