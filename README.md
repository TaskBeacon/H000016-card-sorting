# H000016 Card Sorting

HTML/browser preview of the WCST-style Card Sorting task built with `psyflow-web`.
The block rule schedule (`color` -> `shape` -> `number`), seeded target-card generation, key mapping (`1/2/3/4`), and stage logic are aligned to local `T000016-card-sorting`; block trial counts are shortened for preview.

## Layout

- `main.ts`: task orchestration
- `config/config.yaml`: declarative config
- `src/run_trial.ts`: trial logic
- `src/utils.ts`: deterministic trial sampling and block summary helpers

## Run

From `e:\xhmhc\TaskBeacon\psyflow-web`:

```powershell
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:4173/?task=H000016-card-sorting
```
