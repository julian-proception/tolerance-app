# Hole & Pin Fit Calculator

Enter a pin diameter and tolerance class, then dial in a hole along the two axes
ISO actually uses — **grade** sets the tolerance band's width, and **nominal
diameter** sets its position, which is what moves the fit through interference,
transition and clearance. The ISO hole class is the output. Limits, interference
range, a 2D visualisation of both tolerance bands and an RSS bell curve all update
live.

The whole tool fits one screen; secondary detail sits behind `more` panels.

Static HTML, CSS and vanilla JavaScript. No build step, no dependencies.

## Running it

Open `index.html` directly in a browser, or serve it:

```sh
python3 -m http.server 8000     # then open http://localhost:8000
```

State lives in the URL hash, so a fit can be bookmarked or shared:
`index.html#d=3&pin=m6&hole=JS6`

## Verifying it

The tolerance data is the whole value of this tool, so it ships with 231 checks
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
monotonicity of both hole axes and the painted slider track; circle-view geometry
against hand-computed pixel values; axis tick labelling; and — since there is no
browser here — an initialisation *and interaction* run of `app.js` against a stub
DOM that fires the real event handlers (sliders, dropdowns, the view toggle,
custom deviations, the RSS controls and hostile input).

## Layout

| File | Role |
|---|---|
| `js/iso286.js` | Size ranges, IT matrix, shaft fundamental deviations, and the rules that derive hole deviations from them |
| `js/fits.js` | Interference, fit classification, RSS statistics, `erf` |
| `js/suggest.js` | `HoleOptions`: the grade and nominal-diameter axes, and the fit bands painted on the position slider |
| `js/viz.js` | Inline SVG: circle view, tolerance zone chart, bell curve |
| `js/app.js` | State, rendering, event wiring |
| `js/verify-cases.js` | Published spot-check fixtures, each tagged with its source |
| `js/verify-run.js` | The assertion suite, shared by `verify.html` and `tools/verify.sh` |
| `REFERENCES.md` | Which values rest on which source, and the caveats |

## Two things to know before trusting a number

**Interference is `pin size − hole size`** throughout — positive means the pin is
larger than the hole. Nothing in the app deviates from that convention.

**The drawing scale is pinned, not adaptive.** The circle view exaggerates the
tolerance bands — at 3 mm a ±3 µm band is 0.1% of the diameter and would otherwise
be a hairline — and the factor is stated on the drawing. It is derived from the
**diameter alone**, by scaling to the widest deviations reachable in IT5–IT7, so
that moving either hole slider changes the picture only in the way it should: the
bands move and resize against a fixed scale, rather than the whole drawing
rescaling under the cursor. Beyond IT7 no single scale can stay fixed and stay
legible — an A12 hole sits over 500 µm off basic — so there the factor is reduced
just enough to keep the drawing on the canvas, and the label reports it.

**The bell curve is a model.** It assumes both dimensions are independent, normal
and centred, with the tolerance limits at ±3σ (adjustable). Real machining often
runs offset or skewed, so the percentages estimate process capability rather than
guarantee it. The worst-case limits are what the drawing has to survive.

Coverage is 1–500 mm, hole classes A–U and shaft a–u, grades IT5–IT11. See
`REFERENCES.md` for omissions and for the one rule that is applied rather than
corroborated (Δ = 0 below 3 mm, which affects K/M/N/P only).
