# credit-meter

`/credits` opens a pane with two balances: ElevenLabs characters left (with a ring and the reset date) and Higgsfield credits left. Before Claude runs a tool that spends either one, a toast shows what you have; after it runs, a second toast shows what the call cost.

Calls it watches: ElevenLabs text-to-speech, sound effects, music and voice cloning (through the ElevenLabs MCP server or a `curl` to the API), and Higgsfield image, video, audio, 3D, upscale, preset and motion tools.

## Settings

| Setting | Default | What it is |
| --- | --- | --- |
| `elevenlabs_api_key` | empty | Optional, stored as a secret. If empty, the mod uses `$ELEVENLABS_API_KEY`, then the key your `elevenlabs` MCP server has in `~/.claude.json`. |
| `higgsfield_server` | `claude.ai Higgsfield` | The Higgsfield MCP server name as `/mcp` shows it. `higgsfield` is tried too. |

A secret setting is not a row in the `/plugin` menu. Set it with `claude plugin configure credit-meter@buildalone-mods --values-stdin`, or just export `ELEVENLABS_API_KEY`.

If a provider isn't set up, its half of the card says "not connected" and the rest works.

## What it touches

Reads `ELEVENLABS_API_KEY` and `HOME` from the environment and `~/.claude.json` (only for the ElevenLabs key). Calls `api.elevenlabs.io/v1/user/subscription` and the Higgsfield `balance` tool. Run `claude plugin validate` on this folder to see the full list.
