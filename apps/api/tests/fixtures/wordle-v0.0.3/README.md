# Wordle PostgreSQL fixture for v0.0.3

Pinned from tag `v0.0.3`, resolved commit `44e8394be8fdb8dd11fec7c27e9476d02629470a`. These are the tag's first three PostgreSQL migrations and its historical Drizzle journal. The fixture intentionally excludes current migrations so tests exercise the deployed schema before global tables exist.

SHA-256:

- `0000_baseline.sql`: `9e573a6433295a6f3b53063769b9f2b32e252768c31af7988b4ce86996811e07`
- `0001_updated_at_triggers.sql`: `521fb9dd93e4b681e5ece800aae37d42801ac7bfc81aac07a5bac93be9401539`
- `0002_legacy_sqlite_import.sql`: `06c4a6d420d1c52e2328f3cd1c2f651e9800b6876eea89b8288e4e33fe44ac01`
- `_journal.json`: `7193cc2737267ec5a076094aa0445362ccd0b635b82ac7ca43cee4f4a2c6661d`
