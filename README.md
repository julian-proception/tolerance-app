# Hole & Pin Fit Calculator

Enter a pin diameter and tolerance; get a ranked ladder of hole tolerances
spanning interference → transition → clearance, the exact limits and interference
range for whichever you pick, a 2D visualisation of both tolerance bands, and an
RSS bell curve predicting how a production run will actually distribute.

Static HTML, CSS and vanilla JavaScript. No build step, no dependencies.

## Running it

Open `index.html` directly in a browser, or serve it:

```sh
python3 -m http.server 8000     # then open http://localhost:8000
```

State lives in the URL hash, so a fit can be bookmarked or shared:
`index.html#d=3&pin=m6&hole=JS6`

## Verifying it

The tolerance data is the whole value of this tool, so it ships with 188 checks
against published values.

```sh
./tools/verify.sh               # headless, via the JavaScriptCore shell in macOS
```

Or open `verify.html` in a browser for the same suite as a page. Both run the one
suite in `js/verify-run.js`, so they cannot drift apart.

The checks cover: the IT grade matrix; the fully corroborated `>3–6 mm` hole row;
widely published classes at 25/50/30/10/6 mm; the r/s/t/u sub-range boundaries;
classes that must be *rejected*; `erf`/Φ accuracy; RSS arithmetic; a
2 028-combination self-consistency sweep; fit-classification boundaries; the
suggestion ladder's ordering and trimming; circle-view geometry against
hand-computed pixel values; axis tick labelling; and an initialisation run of
`app.js` against a stub DOM.

## Layout

| File | Role |
|---|---|
| `js/iso286.js` | Size ranges, IT matrix, shaft fundamental deviations, and the rules that derive hole deviations from them |
| `js/fits.js` | Interference, fit classification, RSS statistics, `erf` |
| `js/suggest.js` | The interference / transition / clearance ladder |
| `js/viz.js` | Inline SVG: circle view, tolerance zone chart, bell curve |
| `js/app.js` | State, rendering, event wiring |
| `js/verify-cases.js` | Published spot-check fixtures, each tagged with its source |
| `js/verify-run.js` | The assertion suite, shared by `verify.html` and `tools/verify.sh` |
| `REFERENCES.md` | Which values rest on which source, and the caveats |

## Two things to know before trusting a number

**Interference is `pin size − hole size`** throughout — positive means the pin is
larger than the hole. Nothing in the app deviates from that convention.

**The bell curve is a model.** It assumes both dimensions are independent, normal
and centred, with the tolerance limits at ±3σ (adjustable). Real machining often
runs offset or skewed, so the percentages estimate process capability rather than
guarantee it. The worst-case limits are what the drawing has to survive.

Coverage is 1–500 mm, hole classes A–U and shaft a–u, grades IT5–IT11. See
`REFERENCES.md` for omissions and for the one rule that is applied rather than
corroborated (Δ = 0 below 3 mm, which affects K/M/N/P only).
