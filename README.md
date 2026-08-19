# Hole & Pin Fit Calculator

Enter a pin diameter and tolerance class, then dial in a hole along the two axes
ISO actually uses — **grade** sets the tolerance band's width, and **nominal
diameter** sets its position, which is what moves the fit through interference,
transition and clearance. The ISO hole class is the output. Limits, interference
range, a 2D visualisation of both tolerance bands and an RSS bell curve all update
live.

The whole tool fits one screen; secondary detail sits behind `more` panels.

Where the fit interferes, it also estimates what that costs mechanically: contact
pressure, the strain in each part, and the insertion and holding forces — at the
nominal interference and at ±1σ of the production distribution.

Static HTML, CSS and vanilla JavaScript. No build step, no dependencies.

## Running it

Open `index.html` directly in a browser, or serve it:

```sh
python3 -m http.server 8000     # then open http://localhost:8000
```

State lives in the URL hash, so a fit can be bookmarked or shared:
`index.html#d=3&pin=m6&hole=JS6`

## Verifying it

The tolerance data is the whole value of this tool, so it ships with 389 checks
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
against hand-computed pixel values; axis tick labelling; the material CSV
(published property values, quoted-field parsing, and that a malformed row is
*rejected* rather than becoming a NaN); the press-fit mechanics against a
hand-worked Lamé case and its exact limit cases; and — since there is no browser
here — an initialisation *and interaction* run of `app.js` against a stub DOM
that fires the real event handlers (sliders, dropdowns, the view toggle, custom
deviations, the RSS controls and hostile input).

The press-fit group leans on one identity that has to hold exactly:

```
hoop strain in the hub − hoop strain in the pin = interference / diameter
```

That says the two parts' deformations account for precisely the interference
forced between them, so the pressure solution and the reported strains cannot
drift apart. It is asserted across 96 combinations of size, material and geometry
and holds to ~1e-16.

## Layout

| File | Role |
|---|---|
| `js/iso286.js` | Size ranges, IT matrix, shaft fundamental deviations, and the rules that derive hole deviations from them |
| `js/fits.js` | Interference, fit classification, RSS statistics, `erf` |
| `js/suggest.js` | `HoleOptions`: the grade and nominal-diameter axes, and the fit bands painted on the position slider |
| `js/viz.js` | Inline SVG: circle view, tolerance zone chart, bell curve |
| `data/materials.csv` | **The material property table** — the single source of truth |
| `js/materials-data.js` | Generated from that CSV by `tools/build-materials.sh`; do not edit |
| `js/materials.js` | CSV parsing, material lookup, friction pairing |
| `js/press.js` | Interference-fit mechanics: contact pressure, strain, forces, torque |
| `js/app.js` | State, rendering, event wiring |
| `js/verify-cases.js` | Published spot-check fixtures, each tagged with its source |
| `js/verify-run.js` | The assertion suite, shared by `verify.html` and `tools/verify.sh` |
| `REFERENCES.md` | Which values rest on which source, and the caveats |

## Adding a material

Add a row to `data/materials.csv`, then regenerate:

```sh
./tools/build-materials.sh
```

That one CSV holds every property the calculator uses — name, condition, density,
elastic modulus, Poisson's ratio, tensile / yield / shear strength, thermal
expansion and a dry friction coefficient — with a `source` column recording where
each row's numbers came from. Two materials ship: **aluminium 6061-T6** and
**alloy steel 4140, quenched & tempered**.

The generated `js/materials-data.js` exists only because `index.html` is meant to
open straight off disk, and a `file://` page is not allowed to fetch a sibling CSV.
It is committed so a fresh clone works with no build step. The build script parses
the CSV before writing, so a malformed edit fails there rather than at page load.

## Press-fit estimates

Given materials for both parts, the tool solves the Lamé thick-walled cylinder
problem for the interface contact pressure, then reports:

- **contact pressure**, and the **insertion** and **holding force** (µ·p·πDL) plus
  the **holding torque** that force develops on the radius;
- **hoop strain, von Mises stress and percentage of yield** for the pin and the
  hole separately, so it is visible which part is actually being worked;
- all of the above at the nominal interference and at **±1σ** of the RSS
  distribution — the multiplier is editable, and the −σ column is the one that
  decides whether the joint holds at all;
- the **hub temperature rise** that would open the bore by the full interference,
  which is the shrink-fit alternative to pressing.

To keep the input burden to the two material choices, the geometry is generalised:
engagement length defaults to 1× the pin diameter, the hub outer diameter to 2×,
the pin is solid, and friction is the mean of the two materials' dry self-mated
coefficients. Each of those is an editable override that reverts to tracking the
diameter when you clear the field.

**The friction coefficient is the weakest number in the chain.** It is a property
of the interface rather than of a material; lubrication roughly halves it and
galling raises it, and force scales linearly with it. Treat the forces as sizing
estimates. The model is elastic, so once the reported von Mises passes yield — the
tool says so explicitly — it overstates both pressure and force.

## Two things to know before trusting a number

**Interference is `pin size − hole size`** throughout — positive means the pin is
larger than the hole. Nothing in the app deviates from that convention.

**The drawing scale is pinned, never adaptive.** The circle view exaggerates the
tolerance bands — at 3 mm a ±3 µm band is 0.1% of the diameter and would otherwise
be a hairline — and the factor is stated on the drawing. It depends on the
**diameter and your own slider, and on nothing else**. Moving either hole slider
changes the picture only in the way it should: the bands move and resize against a
fixed scale, rather than the drawing rescaling under the cursor.

Nothing reduces the factor automatically, not even to keep an extreme class on the
canvas — that would put the rescaling straight back. If the bands run outside the
view (an A12 hole sits over 500 µm off basic), the visualisation says so and offers
a factor that fits; taking it is your call. Whether a band is too narrow to read is
a judgement only you can make, so the tool leaves it to you.

**The bell curve is a model.** It assumes both dimensions are independent, normal
and centred, with the tolerance limits at ±3σ (adjustable). Real machining often
runs offset or skewed, so the percentages estimate process capability rather than
guarantee it. The worst-case limits are what the drawing has to survive.

Coverage is 1–500 mm with the **complete ISO 286 catalogue**: all 28 fundamental
deviations (a…zc, and A…ZC) and all 20 grades (IT01, IT0, IT1…IT18).

Not every value carries the same weight of evidence, so the ones computed from an
ISO formula rather than transcribed from a corroborated table are **flagged
`derived` in the interface**. The extended letters v, x, y, z, za, zb and zc are
additionally **refused at or below 18 mm**, where the formula is known to
disagree with the tabulated letters by enough to invert their order.
`REFERENCES.md` sets out exactly which values rest on which source.
