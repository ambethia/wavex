WAVEx — full code & feature review

Gate results (actually run)

- [x] pnpm typecheck ✅ — all 8 projects pass
- [x] pnpm test ✅ — 56/56 tests across 6 files
- [x] pnpm docs:check ✅ — passes on a clean run (it failed once while my review agents were building concurrently; not reproducible in
isolation)
- [x] pnpm build ✅ — all packages plus both apps build

Note pnpm --filter @wavex/compiler test exits 0 without running anything — the package has no test script; tests only run via the root
runner. Easy to be fooled in CI filters.

1. Verdict

The architecture is sound and the happy path is genuinely good — clean package boundaries, Lit fully hidden behind the runtime, a docs
pipeline whose drift gate really does byte-diff regenerated output, and high-quality demo .wx code. But the review found a wide band of
verified correctness bugs concentrated in three places: the parser's heuristic attribute/text grammar (which silently mangles ordinary
prose and contradicts the language guides), the compiler's escaping/codegen (template content can inject live JS into generated modules,
and the headline type Attrs feature can emit a SyntaxError), and the just-shipped navigation/View Transitions path (swallowed errors,
stuck pending states, hijacked hash anchors). The single biggest structural risk is that the AST carries no sub-line source ranges —
every downstream consumer (LSP anchoring, error overlays) reconstructs positions by string search, and that class of bug has already been
patched once (ced2905) and is still broken in five verified ways. The documented Convex safety story (bare $$ = public queries only,
internal-function diagnostics) is entirely unenforced at every layer, and the docs' own inline-args example is an end-to-end no-op. Test
coverage is the enabler: zero tests for vite-plugin and CLI, zero span/offset assertions in core, and compiler tests that never check the
generated code even parses.

2. Bugs / correctness issues (verified first, deduped across packages)

Critical

- [ ] B1. CRLF input corrupts every offset — the LSP is wrong on all Windows-authored files. packages/core/src/parser.ts:63 splits on /\r?\n/
but computeLineStartOffsets (parser.ts:569-577) assumes 1-char terminators, so offsets drift +1 per line. Verified independently by two
agents: a main node's range slices to "\r\nma"; an LSP mapping for talk.title lands on "= talk.tit". The function already receives source
and ignores it — fix it there. (Also: prelude/body are re-joined with "\n" at parser.ts:78,82, normalizing the text the LSP later maps
against.)

- [ ] B2. type Attrs keys collide with built-in locals → generated module is a SyntaxError. packages/compiler/src/compiler.ts:73-76: type Attrs
= { route: string } emits const route = … twice (node --check confirms "already been declared"). Same for state, attrs, navigation,
actionStates, and — most likely in practice — any attr key matching a $$ resource binding name in the same file. The marquee feature of
commit 4e8385b has no compiler or core test. Fix: collision detection + diagnostic.

- [ ] B3. Literal ${ in prose becomes live JS in the generated module. compiler.ts:564-571 escapes per-character, so the two-char ${ pattern
can never match: p Costs ${price} today compiles to a real interpolation that evaluates (or ReferenceErrors) at module scope. Attribute
values and +head titles escape correctly — only inline text is exposed. This is an injection class, not just a rendering glitch.

- [ ] B4. {{ … }} in text truncates at the first }}. compiler.ts:554,221 use a lazy regex, so {{ ({a:{b:1}}).a.b }} emits syntactically invalid
TS. The attribute path brace-counts correctly (parser.ts tokenizer) — parser and compiler disagree about the same construct. Fix:
brace-aware scan in the text path.

Major — the attribute/text grammar (one root cause, several verified manifestations)

The parser classifies tokens lexically and the guides describe a different grammar (packages/core/docs/template-syntax.md "Attributes and
values", "Boolean attributes"). Verified fallout:

- [ ] B5. p Total: {{ n }} → Total: parsed as a same-name attribute, compiled to .Total=${Total} → ReferenceError at render
(parser.ts:416-424, compiler.ts:546-549). Ordinary prose with a colon-word breaks pages silently.
- [ ] B6. Boolean attributes are a 14-entry hardcoded whitelist (parser.ts:35-50): video autoplay muted loop parses zero attributes and
renders them as text; conversely p easy-going folks… steals easy-going as a boolean attribute.
- [ ] B7. looksLikeExpression (parser.ts:459-466) classifies bare identifiers as string literals — checked:isDone passes the string "isDone"
(truthy!) although template-syntax.md:110 and the ast.ts:152-155 doc comment both say identifiers are expressions. Numbers are
inconsistent too (value:3.14 expression, count:42 literal).
- [ ] B8. Utility-group extraction (parser.ts:468-513) strips any whitespace-preceded […] anywhere on any line including directives: +if
[1,2].includes(x) → expression ".includes(x)"; p Read the [draft] note loses "[draft]". No diagnostics in any of these cases.

- [ ] Fix direction is shared: make the attribute/expression grammar positional and explicit (per the guides), restrict bracket groups to the
element head, and emit diagnostics instead of silently reinterpreting.

Major — Convex semantics unenforced

- [ ] B9. Bare $$module:fn is compiled kind: "query" unconditionally (compiler.ts:135); nothing in core, compiler, vite-plugin, or LSP
enforces convex-and-forms.md:36-38 ("valid only for public queries") or reserved-and-deferred.md:14-15 ("internal function … is a
diagnostic"). $$tasks:create silently subscribes to a mutation. The data to validate exists (capabilities.ts discoverConvexFunctionKinds)
— it's just never consulted.
- [ ] B10. The guide's own inline-args example :click:$$ai:summarize({ id: task._id }) (convex-and-forms.md:54-62) is an end-to-end no-op:
compiler emits the raw string (compiler.ts:526), runtime's parseConvexActionTarget (runtime/src/index.ts:582-590) does lastIndexOf(":")
into the args object and rejects it. No call, no pending state, no error. The swell app works around it with data-slug: — evidence the
team already hit this.
- [ ] B11. Typo'd $$ refs are silent in the editor too: the LSP emits the typed scaffolding unmapped (packages/lsp/src/language.ts:157-162),
so the TS error is dropped and the binding degrades to any. Verified: bogus ref → zero diagnostics; valid ref → correct typed diagnostics
(the 99d3b83 happy path genuinely works).

Major — runtime/router (the 8046e0c feature area)

All verified with DOM-level repros:

- [ ] B12. Navigation to an unmatched path that supersedes a pending navigation never clears state: data-wx-navigating and navigation.pending
stick forever (runtime/src/router.ts:198-203 — the !match branch never calls setNavigation).
- [ ] B13. Under View Transitions, commit errors are swallowed (router.ts:169 .catch(() => undefined)): URL pushed, nothing rendered, no
+error.wx, navigate() resolves. The same error correctly reaches the error route without VT. Also current is mutated before
applyCurrent() can throw (router.ts:216-222).
- [ ] B14. In-page <a href="#section"> anchors are intercepted, preventDefaulted, and the hash discarded (router.ts:260-277,183-189) — anchor
links are broken on every routed page. The README's scroll-management deferral doesn't cover this.
- [ ] B15. A synchronously-throwing analytics client (Safari private mode localStorage.setItem, runtime/src/analytics.ts:41-50) blocks the
Convex action entirely and strands actionStates in pending — capture is called outside the try at runtime/src/index.ts:410-419. Analytics
must never gate the action.
- [ ] B16. applyHead adopts static index.html head nodes (selector at runtime/src/index.ts:482 not filtered by [data-wx-head]) and later
deletes them on navigation — directly contradicting its own contract comment at index.ts:467-470.

Major — tooling

- [ ] B17. Component .wx edits are a silent HMR no-op — packages/vite-plugin/src/index.ts:400-421 emits {path: importer, acceptedPath:
changed}, which the Vite+ client ignores (verified against a live dev server). Stale UI until manual refresh; page edits work only by an
accidental self-import edge. Added/deleted page files send nothing at all (only change is watched, index.ts:94-99).
- [ ] B18. Catch-all routes beat sibling static index pages: /info matches info/[...slug].wx over info/index.wx
(packages/core/src/model.ts:180-207), contradicting the function's own doc comment at model.ts:159-164. Verified.
- [ ] B19. LSP attribute anchoring (the ced2905 fix) still fails on substring collisions: talk: anchors inside data-talk; the second of two
same-expression attributes is silently dropped from type checking (language.ts:203,206,233); whitespace collapse in the parser
(parser.ts:512) makes +if a  &&  b unmappable, so it's silently unchecked. Verified with direct mapping repros.
- [ ] B20. wavex check apps/swell/src from the repo root → 57 false WX101 errors and exit 1 (packages/wavex/src/cli.ts:59 checks node_modules
only at the given root). The CI/agent gate fails on correct code. Verified.
- [ ] B21. wavex prerender is not idempotent: the / route overwrites dist/index.html, which is also the shell for every other route — a
second run nests prerendered bodies and duplicates head tags (packages/wavex/src/prerender.ts:52,74). Traced, not executed.

Major — the silent-failure class

- [ ] Address silent-failure class: The compiler emits zero diagnostics of its own despite the README's "problems are reported on result.ast.diagnostics" contract, and the
parser drops malformed input without diagnosing. Verified instances: malformed attribute tokens vanish (parser.ts:377-414); malformed
+for renders children once, unconditionally, with the loop var unbound (parser.ts:272-290 + compiler.ts:430); unknown +directives
accepted silently (parser.ts:256-258); semantic events on local components silently discarded (compiler.ts:319); getArgs scope omits
actionStates so documented-looking args ReferenceError (compiler.ts:177-184); duplicate as: binding names clobber silently
(compiler.ts:135); the vite plugin surfaces only the first error and drops all warnings (vite-plugin/src/index.ts:158-165).

3. Design concerns

- [ ] D1. No sub-line source ranges in the AST — the root cause behind B19 and the whole anchoring class. Attributes, inline text, directive
expressions, and interpolations are raw strings; the LSP reconstructs positions with raw.indexOf(...). This contradicts the core README's
"AST with source ranges (so LSP features can map back)". One fix (parser records real per-token offsets) eliminates B19, hardens
overlays, and unblocks .wx sourcemaps — which don't exist (browser stacks land in generated code; not a documented deferral anywhere).
- [ ] D2. Three documents describe three different attribute grammars — template-syntax.md:110, the ast.ts:152-155 doc comment, and the parser's
actual heuristics. Pick one (the guides, per CLAUDE.md) and make the parser match.
- [ ] D3. Load-bearing undocumented surface. actionStates, state, and data-*→Convex-args are the actual mechanisms the validation apps run on
(apps/swell/src/pages/talks/[slug].wx:35-43, apps/todo/src/pages/index.wx:51-56) and appear in no guide. The swell app reading
actionStates["$$ai/summarize:run"]?.result is the validation app telling you the language can't express "render an action's result."
- [ ] D4. Dead-letter deferrals. "No inline arbitrary JavaScript" (reserved-and-deferred.md:18-19) is contradicted by demos and a parser test
(+if tasks.some((t) => t.done)); the internal-function diagnostic is promised but unimplemented (B9). Either implement or rewrite the
deferral docs.
- [ ] D5. "Full-feature validation app" has feature holes exactly where the newest code is. Navigation progress + View Transitions — the latest
commit's headline — has zero usage in either app (swell even has orphaned .nav-progress CSS at apps/swell/src/style.css:75-92 wired to
nothing). Prerender, $module:fn single-sigil refs (compile to "" — inert feature), reveal:progressive, refresh:background (parsed
nowhere, silently ignored), @wa/ lookup, and nested component paths also have zero app usage.
- [ ] D6. Doc drift, smaller items: README claims "targeted wavex:update HMR events" (actual: standard js-update); LSP README claims
semantic-token highlighting (actual: TextMate grammar); wavex README claims "JSON-friendly commands" (no JSON output exists) and
oversells prerender; language-overview.md:161 claims Doc/Id are ambient (only api is injected — swell imports Doc manually, proving it).
- [ ] D7. Dependency hygiene: vite-plugin peer vite: ">=5.0.0" is unmet by the workspace's own Vite+ alias (resolves 0.1.24); root devDeps and
both pnpm.overrides float latest (non-reproducible); compiler-generated code imports @wavex/runtime which the compiler doesn't declare
even as a peer (while lit is). A fresh clone without FONTAWESOME_NPM_TOKEN/WEBAWESOME_NPM_TOKEN cannot install — and
@awesome.me/kit-bb4fac79fe is a personal FA kit no other license holder can install; none of this is in the README (only in agent
guidance).
- [ ] D8. Minor but security-relevant: wavex dev silently forces --host (cli.ts:21), binding the dev server to all interfaces with no opt-out.

4. Coverage gaps

- [ ] @wavex/vite-plugin and the wavex CLI have zero tests. Both produced verified majors (B17, B20, B21) that basic tests would have caught.
- [ ] Zero span/offset/position assertions in core — the parser's core LSP contract is completely untested (no CRLF, tabs, or unicode cases).
B1 and B19 live here.
- [ ] Compiler tests are all toContain substring checks; nothing validates the generated module even parses. A node --check/transpileModule
harness would have caught B2, B3, B4 immediately. type Attrs (4e8385b) has no test in compiler or core.
- [ ] Typed Convex LSP resources (99d3b83) have zero tests — no fixture with a convex/_generated api.
- [ ] Untested diagnostics: WX001–WX004 and WX020 have no tests (only WX005/WX101 do).
- [ ] Runtime: lit.ts (mount/dispose — has a verified re-render-after-dispose hole at lit.ts:102-109,177-183), applyHead, and analytics.ts
entirely untested; router tests miss click interception, popstate, and the B12/B13 interleavings.
- [ ] TSDoc: 50 of 134 exported symbols undocumented (core 32/62, runtime 15/52 — full lists available), directly thinning the generated
skill, contra CLAUDE.md's "new exported APIs get TSDoc."

5. Low-stakes cleanups

- [ ] Dead ternary candidates.has(direct) ? direct : direct — compiler.ts:305 (and it makes @components/ghost resolve unconditionally;
meanwhile componentReferenceToTag maps the same ref to a wx-* tag — internal inconsistency).
- [ ] Per-request invalidation defeats the transform cache, plus an unconditional 300ms setInterval stat-poll of all .wx files —
vite-plugin/src/index.ts:88-92,101-110.
- [ ] computeLineStartOffsets(source, lines) ignores source; makeRange ends include trailing whitespace; WX003 column wrong with tabs —
parser.ts:569,585,128.
- [ ] singularize mangles address→addres, houses→hous — model.ts:243-248; extractAttrsTypeKeys matches type Attrs inside comments —
model.ts:326-358.
- [ ] WX020 recovery leaks a missing:missing sentinel resource into the AST — parser.ts:335-352.
- [ ] client.d.ts omits the named render/wxFile exports compiled modules actually have.
- [ ] wavex check/routes on a nonexistent root exit 0 ("Checked 0 files"); check prints to stdout while compile uses stderr; wavex compile on
a missing file dumps a raw ENOENT stack — cli.ts:78,110,112.
- [ ] Add a test script to @wavex/compiler so --filter invocations aren't silent no-ops.
- [ ] LSP: @wa/button gets no attribute completions/hover (prefix not stripped, service.ts:141-142,203); project-context cache never
invalidates (server.ts:49,64-77).