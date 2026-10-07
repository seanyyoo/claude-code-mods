# Build Alone mods for Claude Code

Five Claude Code mods built for one solo creator's real workflow: checking AI credit balances, watching a YouTube channel, keeping an eye on scheduled routines, keeping private details out of published work, and hiding personal info while recording the screen. I built them for the Build Alone video "I Installed 15 Claude Code Mods. I Deleted 10." because nobody had made them yet. The community mods I kept from that test are listed at https://buildalone.co/mods. Nothing personal is baked in; you point each one at your own channel, database or word list in its settings.

| Mod | What it does | Command |
| --- | --- | --- |
| [credit-meter](plugins/credit-meter) | Shows ElevenLabs characters and Higgsfield credits left, and toasts before and after a tool call that spends them. | `/credits` |
| [youtube-pulse](plugins/youtube-pulse) | Lists your latest videos with view counts and the gain since you last looked, from the channel's public RSS feed. | `/pulse` |
| [routine-watch](plugins/routine-watch) | Reads the Notion database your scheduled routines write to: today's count by source, the last 7 days, sources that went quiet, next run times. | `/routine-watch` |
| [publish-guard](plugins/publish-guard) | Stops Claude from typing your blocked terms into the browser or writing them into publishing files, and logs every block. | `/pubguard` |
| [record-mode](plugins/record-mode) | Masks emails, phone numbers, money and your own terms in the transcript while you record. Display only. | `/record on` |

Each mod also gives Claude a small tool to open its pane, so you can say "show my credits" instead of typing the command.

## Install

```sh
claude plugin marketplace add seanyyoo/claude-code-mods
claude plugin install <name>@buildalone-mods
```

For example `claude plugin install youtube-pulse@buildalone-mods`. Install only the ones you want; they don't depend on each other. You can do the same from inside Claude Code with `/plugin`.

## Settings

Most mods need a value or two before they show anything useful (your channel ID, your Notion view, your blocked terms). A mod with a required value missing still loads and tells you what to set.

- **In Claude Code:** open `/plugin`, pick `buildalone-mods`, then the mod. Each setting is a row there, and saving reloads the mod.
- **From the shell:** `claude plugin configure youtube-pulse@buildalone-mods` lists the settings and which are unset. To set them, pipe JSON in:
  ```sh
  echo '{"channel_id":"UCxxxxxxxxxxxxxxxxxxxxxx"}' | claude plugin configure youtube-pulse@buildalone-mods --values-stdin
  ```
- **In settings.json:** values live under `pluginConfigs`, keyed by the plugin:
  ```json
  {
    "pluginConfigs": {
      "youtube-pulse@buildalone-mods": { "options": { "channel_id": "UCxxxxxxxxxxxxxxxxxxxxxx", "count": 6 } }
    }
  }
  ```

Lists (terms, paths, sources) are comma-separated strings. Each mod's README lists its settings.

## Before you install any mod

A mod runs inside Claude Code with your permissions. It can read files, call the network, call your MCP servers, and change what Claude sees or does. That includes these five. Before installing any mod, from here or anywhere else, run:

```sh
claude plugin validate <folder>
```

on its folder. It lists every event the mod hooks, every `$` call it makes, and every environment variable it reads, so you can check that matches what the README says. Read the `hooks/register.tsx` file too; each of these is one short file.

## Requirements

- Claude Code 2.1.287 or later, in the terminal or the Code tab of the Claude desktop app.
- Per mod: an ElevenLabs key and/or a Higgsfield MCP connection (credit-meter), a public YouTube channel (youtube-pulse), the Notion MCP connector (routine-watch). publish-guard and record-mode need nothing extra.

## License

MIT. See [LICENSE](LICENSE).
