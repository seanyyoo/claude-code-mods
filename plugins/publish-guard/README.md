# publish-guard

Checks text before Claude sends it anywhere public:

- typing into the browser and filling forms through a browser MCP (`computer` type actions, `form_input`, and both inside `browser_batch`)
- `Write` and `Edit` to files whose path contains one of your guarded paths

If the text contains one of your blocked terms, or Korean text when that option is on, the call is denied and Claude is told to remove it. The deny message, the toast and the log only ever say "a blocked term" or "Korean text", never the term itself, so the guard doesn't leak what it guards. `/pubguard` shows the last blocks.

## Settings

| Setting | Default | What it is |
| --- | --- | --- |
| `blocked_terms` | empty | Comma-separated words, names or domains that must never go out. Case-insensitive. |
| `allowed_terms` | empty | Comma-separated exceptions, removed before checking. Useful for a name you credit on purpose. |
| `guarded_paths` | `/publishing/` | Comma-separated pieces of a path. Writes and edits to matching paths are checked. |
| `block_non_latin` | `off` | `korean` also blocks Korean text. |

With no blocked terms and Korean off, the guard has nothing to check and the pane says so.

## What it touches

Reads tool calls only. Keeps the last 50 blocks (what kind, and where) in the mod's own store.
