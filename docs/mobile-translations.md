# Mobile translations

`apps/mobile` owns the English and German UI catalogs. The app selects a
bundled catalog from the device language and falls back to English. This
workflow does not translate stored recipes or API prompts.

## Connect p6t

Run `pnpm install --frozen-lockfile` from the Magpie root. The mobile
workspace pins `@p6t/cli@0.2.0`, which includes the MCP server.

For OpenCode, add this to the ignored `.opencode/opencode.json` at the
Magpie root.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "p6t": {
        "type": "local",
        "cwd": "apps/mobile",
        "command": ["pnpm", "exec", "p6t", "mcp"]
      }
    }
  }
}
```

Run `opencode mcp list` to check the connection. `inspect_project` should
find `apps/mobile/i18n.json`. Do not initialize over that config. No
provider key is needed.

## Update copy

1. Follow `translatability` for source copy. Keep messages and descriptions
   by their use sites. Use complete phrases for each meal slot; don't
   interpolate an already translated slot label.
2. Run `pnpm --filter mobile i18n:extract`. Review the English catalog diff
   before allowing p6t to remove obsolete entries.
3. Call `prepare_locale` for `de`. Use the product brief, German style guide,
   glossary and referenced UI to draft wording. Review the proposed wording
   and removals, then call `apply_locale` with the returned revision. Propose
   glossary changes separately; don’t silently change approved terms.
4. Run `pnpm --filter mobile i18n:check` and
   `pnpm --filter mobile i18n:compile`. Include extracted and compiled
   catalogs in the same PR as the copy. The repository's check workflow
   validates coverage, ICU arguments and generated-file freshness offline.
