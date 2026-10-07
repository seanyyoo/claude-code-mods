# routine-watch

For people who run scheduled routines (Claude scheduled tasks, cron jobs, automations) that write rows into a Notion database. `/routine-watch` opens a dashboard with:

- how many rows came in today, split by source
- a bar per day for the last 7 days
- sources with no rows this week, flagged as possibly broken
- when each routine runs next

## Settings

| Setting | Default | What it is |
| --- | --- | --- |
| `notion_view_url` | empty | Required. A saved view of the database, as `view://…`. Ask Claude to fetch your database with the Notion MCP and it will show the view URLs. Sort that view newest first. |
| `notion_server` | `claude.ai Notion` | The Notion MCP server name as `/mcp` shows it. `notion` is tried too. |
| `date_property` | `Date Collected` | The date property rows are counted by. |
| `source_property` | `Source` | The property that says where a row came from. |
| `sources` | `YouTube,Reddit,News,X,LinkedIn` | Comma-separated source values to chart and watch. |
| `routines` | empty | Comma-separated `Name@HH:MM` (24-hour, local time), e.g. `Daily Collector@06:00,Writer@21:00`. |

## Why a saved view

On Notion plans below Business, direct data-source queries through the MCP have a quota, and your routines probably use the same quota. Saved-view queries don't count against it. So the mod reads the view 20 rows at a time, newest first, and stops as soon as it reaches rows older than 7 days.

## What it touches

Calls `notion-query-data-sources` (view mode) on your Notion MCP server. Nothing is written.
