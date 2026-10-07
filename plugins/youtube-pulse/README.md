# youtube-pulse

`/pulse` opens a card with your channel's latest videos, a bar per video for its views, and the gain since the last time you opened it (kept across sessions). It refreshes every 10 minutes while Claude Code is open.

It reads YouTube's public RSS feed for the channel, so it needs no API key or login.

## Settings

| Setting | Default | What it is |
| --- | --- | --- |
| `channel_id` | empty | Required. Your channel ID, starting with `UC`. Find it in YouTube Studio under Settings → Channel → Advanced settings. A @handle won't work. |
| `count` | `6` | How many videos to show, 1 to 15. |

Until `channel_id` is set, the pane shows a one-line reminder instead.

## What it touches

Fetches `https://www.youtube.com/feeds/videos.xml?channel_id=…` and stores the last view counts it showed you in the mod's own store.
