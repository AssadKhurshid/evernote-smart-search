# Smart Search, rebuilt

A small reverse-engineering demo. We studied how the Evernote desktop app parses its
search query syntax ("Smart Search"), then wrote **our own** tiny parser and a live
demo page that supports the same operators.

No Evernote code, assets or branding are included. The analysis was static and
read-only, and the app was never modified.

## What's here

| File | What it is |
|---|---|
| [`index.html`](index.html) | Demo: 15 fake notes, a search box, live results and chips that explain how the query was parsed. One file, no build, no dependencies. |
| [`findings.md`](findings.md) | Analysis report: where the parser lives in the app package, its class names, the parse flow and the supported operators, with evidence. |
| [`check.mjs`](check.mjs) | Assert-based check of the parser in `index.html`. |

## Try it

Open `index.html` in any browser, then type a query or click an example.

Run the check (Node 18+):

```bash
node check.mjs
```

## Supported syntax

| Query | Meaning |
|---|---|
| `word`, `plan*` | text match, prefix match |
| `"exact phrase"` | words in this order |
| `-word`, `-tag:done` | exclude |
| `intitle:report` | title contains |
| `tag:work`, `tag:*` | has tag, has any tag |
| `notebook:personal` | in notebook |
| `todo:true` / `todo:false` / `todo:*` | has checked / unchecked / any checkbox |
| `created:day-3`, `updated:week` | since a relative date (`day`, `week`, `month`, `year`, with `±N`) or `YYYYMMDD` |
| `resource:image/*` | has an attachment of this MIME type |
| `any: a b` | match any term (OR) instead of all (AND) |

Terms are joined with AND by default. An invalid value (e.g. `todo:maybe`) is searched
as plain text, which matches the behaviour seen in the analysis.

## How the analysis was done

1. The app's `app.asar` package was searched for rare operator strings such as `intitle:`
   and `created:day`. That led to a handful of parser modules.
2. Only those five files were analysed with
   [REA](https://www.npmjs.com/package/rea-agents) (`analyze_javascript_application` with
   selected `source_paths`, then `inspect_analysis_view`), not the whole 570 MB app.
3. The confirmed behaviour was written up in `findings.md`, and the parser here was
   written from scratch from those notes.

See `findings.md` for details and for what remains unverified.

## Disclaimer

An independent educational project, not affiliated with or endorsed by Evernote.
"Evernote" is a trademark of its owner and is used only to name the app that was studied.
