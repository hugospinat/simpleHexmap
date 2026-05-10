# SimpleHex Notes Obsidian plugin

Source-only plugin scaffold for the SimpleHex note bridge.

## What it does

- handles `obsidian://simplehex-note?...` launches from the SimpleHex web editor
- opens or focuses one Obsidian file per `(mapId, q, r)` note
- polls the SimpleHex server for remote note updates
- pushes local file edits back through the dedicated Obsidian note HTTP API
- creates a visible `.conflict-<timestamp>.md` copy when local and remote edits diverge

## Expected plugin settings

- `rootFolder`: optional vault prefix for synchronized notes
- `pollIntervalMs`: remote refresh interval
- per-map bearer tokens learned from launch links

## Notes

This repository does not compile the Obsidian plugin as part of the main app build. The plugin source lives here so the web app, server contract, and plugin logic stay versioned together.
