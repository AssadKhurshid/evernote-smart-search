# Evernote Smart Search: query parser findings

Target: `C:\Users\assad\AppData\Local\Programs\Evernote\resources\app.asar`
(SHA-256 `2f3797be…f2d436`, about 25.4k files). Static analysis only. Nothing in the
Evernote install was changed or run.

## How the parser was found

| Step | Tool | Result |
|---|---|---|
| Map rare strings to files | own read-only Node script (ASAR header + byte search, **not REA**) | `created:day` only in renderer bundles `3173.js` and `5619.js`; `reminderOrder` led to `conduit-core/.../offline/Parsers/Advanced/` |
| Static analysis of 5 files | **REA `analyze_javascript_application`** (`source_paths` = 5 files, `detail: summary`) | 5/5 parsed, 0 failures, 72 findings. Parent Evidence `ev_70e6b241b52a176881f7425d5086f12726d811e1a87d7d8eb31e5674c945d97d` |
| Module exports and line ranges | **REA `inspect_analysis_view`** (`javascript-facts`) | Evidence `ev_9682dcb1…ce70dd` and one oversized page saved locally |
| Operator strings and logic | direct read of the same 5 files' text (**not REA**: REA's facts view does not expose string literals) | see below |

Parser folder in the ASAR:
`node_modules/conduit-core/dist/repositories/search/LegacyPlugin/offline/Parsers/Advanced/`

## Modules (REA `inspect_analysis_view`)

| File | Exports (line) | Role |
|---|---|---|
| `QueryStringParser.js` | `QueryStringParser` (364), `ParsedQuery` (22), `QSPNode`, `QSPMoveNotOperatorDown` (200), `SimplePrinter` (97), `HighlightTermCollector` (139) | tokenizes the query, adds implied AND/OR, builds a boolean tree |
| `QueryToken.js` | `QSPQueryToken` (36), `QSPTokenType` (24), `QSPTokenConstructorParam` (26) | one token: word, quoted phrase or `field:value`; validates values and dates |
| `FieldOperator.js` | `QSPFieldOperator` (6/113), `QSPFieldOperatorContext` (115–188) | operator enum, aliases, operator groups |
| `GlobalOperator.js` | `QSPGlobalOperator`, `QSPInTrash`, `QSPGeoDistance`, `QSPGeoBoundingBox` | query-wide filters (trash, geo) |
| `ESQueryStringBuilder.js` | `ESQueryStringBuilder` (281), `ESQueryPrinter` (13) | prints the tree as a search-index query string |

Note: `created:day` also appears in renderer chunks `3173.js` and `5619.js`. These are
probably UI and autocomplete strings. **Unverified:** they were not analysed.

## How a query becomes a filter (`QueryStringParser.parseWithParams`)

1. Queries over 4096 chars are rejected: `'Search query is too long'`.
2. `tokenizeSearchStrWithSeparateParentheses` splits on spaces and keeps `"..."` together.
3. A leading minus becomes a separate NOT token:
   `if (term.startsWith('-') && term.length > 1)`.
4. `QSPQueryToken.fromDefault` → `analyseStructure`:
   - trailing `*` → `prefixed = true` (prefix search)
   - `"…"` → `quoted = true` (`isQuoted`: length > 2, starts and ends with `"`)
   - `name:value` with colon index > 0 → operator lookup, ignoring case:
     `fromStrIgnoreCase(fieldNameCandidate)`, then `validateAndSetFieldValue(value)`.
     An unknown operator name stays a plain word.
5. `validateAnyOperator`; on error: `'Invalid usage of "any:" operator'`.
6. `addImpliedOperators`: puts `AND` between adjacent terms, or `OR` after `any:`:
   `QSPQueryToken.fromTokenStr(insideAny ? 'OR' : 'AND')`.
7. With boolean mode on, parentheses are checked (`'Unbalanced or empty parentheses'`).
   The result is a binary tree, and `QSPMoveNotOperatorDown` pushes NOTs to the leaves.
8. `ESQueryStringBuilder` / `ESQueryPrinter.processFieldOperator` prints index syntax,
   e.g. todo → `_en_todo_` + `true` / `false` / `*`.

Token types (`QSPTokenType`): `NOT, AND, OR, OPENPAREN, CLOSEPAREN, ARGUMENT`.

## Supported operators (from `QSPFieldOperator` + aliases)

Aliases: `strlwr2enum.set('intitle', QSPFieldOperator.title)`; `resource` → `resourceMime`;
`filename` → `resourceFileName`; `_id` → `noteId`. All names are case-insensitive.

| Query | Meaning | Value rule |
|---|---|---|
| `notebook:X`, `stack:X`, `space:X` | scope | text |
| `tag:X`, `-tag:X` | tag / not tag | text; `tag:*` = any tag (prefixed) |
| `intitle:X` / `title:X` | title contains | text |
| `created:` / `updated:` | date ≥ value | `day`, `week`, `month`, `year` with optional `±N`, or ISO `YYYYMMDD[THHMMSS][Z]` |
| `todo:true` / `todo:false` / `todo:*` | has checked / unchecked / any checkbox | `VALID_BOOLEAN_ARGUMENTS = new Set(['true', 'false'])`; `*` through prefix |
| `resource:image/png`, `filename:` | attachment MIME / file name | text |
| `reminderOrder:*` | has reminder | non-negative integer or `*` |
| `encryption:`, `author:`, `source:`, `sourceURL:`, `contains:`, `latitude:` … | other metadata | per-field validation |
| `any:` | following terms joined with OR | `QueryStringParser.ANY = 'any:'` |
| `"exact phrase"` | words in order | quoted |
| `word*` | prefix match | trailing `*` |
| `AND`, `OR`, `NOT`, `( )` | boolean grammar | only when `booleanOperatorsEnabled` |

Date math (`convertDateString`): the date starts at local midnight today. Then
`day` adds the delta in days, `week` goes to `startOfWeek` and adds 7×delta days,
`month` to `startOfMonth`, and `year` to `startOfYear`. The delta regex is
`DATETIME_DELTA_PATTERN = new RegExp('[+-][0-9]+')`. So `created:day-3` means
created on or after midnight three days ago.

Global operators (`QSPGlobalOperatorType`): `GeoDistance`, `GeoBoundingBox`, `InTrash`.
They apply to the whole query.

## Unknowns and limits

- Static reading only. The live app's UI behaviour, the exact comparison (≥ vs >) done by
  the search index, and which operators the online (server) search adds were **not verified**.
- REA coverage is `partial` because only 5 of 25,421 files were selected. Relationships to
  `conduit-utils`, `date-fns` and other callers are unknown.
- The renderer bundles `3173.js` and `5619.js` (UI strings for `created:day`) were not analysed.
