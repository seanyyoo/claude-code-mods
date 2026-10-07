# record-mode

`/record on` before you start a screen recording, `/record off` after. While it's on, the transcript draws these as ▇▇▇ masks:

- email addresses
- phone numbers
- dollar amounts
- your extra terms
- Korean text, if you turn that on

A red "● REC" shows in the prompt footer so you know it's on. It stays on across sessions until you turn it off. Claude can also turn it on or off for you.

It's display only. Claude still reads the real text, and nothing in your files or messages changes. Check a test recording before you rely on it: anything drawn outside the transcript (tool output panes, other mods) isn't masked.

## Settings

| Setting | Default | What it is |
| --- | --- | --- |
| `extra_terms` | empty | Comma-separated words, names or domains to mask too. Case-insensitive. |
| `mask_korean` | `off` | `on` also masks Korean text. |
