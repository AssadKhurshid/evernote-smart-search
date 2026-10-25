// Runs the parser from index.html (the <script id="parser"> block) against a few queries.
// Usage: node check.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const src = /<script id="parser">([\s\S]*?)<\/script>/.exec(html)[1];
const { parseQuery, matchNote } = new Function(`${src}; return { parseQuery, matchNote };`)();

const now = new Date(2026, 9, 25, 15, 0); // fixed "today" so date math is stable
const note = (title, opts = {}) => ({ title, body: '', tags: [], notebook: 'Work', todos: [], resources: [],
  created: now, updated: now, ...opts });
const notes = [
  note('Sprint planning', { tags: ['work'], todos: [{ done: false, text: 'agenda' }], created: new Date(2026, 9, 24) }),
  note('Old report', { tags: ['work', 'done'], body: 'search crash fixed', created: new Date(2026, 8, 1) }),
  note('Holiday photos', { tags: ['travel'], notebook: 'Personal', resources: ['image/jpeg'], todos: [{ done: true, text: 'x' }] }),
];
const search = (q) => notes.filter(n => matchNote(n, parseQuery(q, now))).map(n => n.title);

// negation
assert.deepEqual(search('tag:work -tag:done'), ['Sprint planning']);
// quoted phrase: words must be adjacent and in order
assert.deepEqual(search('"search crash"'), ['Old report']);
assert.deepEqual(search('"crash search"'), []);
// created:day-N = on or after local midnight N days ago
const t = parseQuery('created:day-3', now).terms[0];
assert.equal(t.since.getTime(), new Date(2026, 9, 22).getTime());
assert.deepEqual(search('created:day-3'), ['Sprint planning', 'Holiday photos']);
// intitle alias, case-insensitive operator name
assert.deepEqual(search('INTITLE:report'), ['Old report']);
// todo values
assert.deepEqual(search('todo:false'), ['Sprint planning']);
assert.deepEqual(search('todo:true'), ['Holiday photos']);
assert.deepEqual(search('todo:*'), ['Sprint planning', 'Holiday photos']);
// invalid value falls back to text search
assert.equal(parseQuery('todo:maybe', now).terms[0].valid, false);
// resource prefix, notebook, any:
assert.deepEqual(search('resource:image/*'), ['Holiday photos']);
assert.deepEqual(search('notebook:personal'), ['Holiday photos']);
assert.deepEqual(search('any: sprint holiday'), ['Sprint planning', 'Holiday photos']);

console.log('all checks passed');
