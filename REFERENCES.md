# Sources and provenance

This file records **which values rest on which source**, so a future reader can
tell a value corroborated against a published table from one produced by applying
a rule. Anything in the second category is called out explicitly.

## Normative sources

- **ISO 286-1:2010** — *Geometrical product specifications (GPS) — ISO code system
  for tolerances on linear sizes — Part 1: Basis of tolerances, deviations and
  fits.* Defines the IT grades, the fundamental deviation letters, and the Δ rule
  used here to derive hole deviations from shaft ones.
- **ISO 286-2:2010** — *Part 2: Tables of standard tolerance classes and limit
  deviations for holes and shafts.*

Both are paywalled and their tables cannot be reproduced wholesale. The approach
taken instead: encode the widely published numeric deviation values, derive
everything derivable via the documented rules, and prove the result against a
spot-check fixture drawn from several independent sources.

**ISO 286-1:2010 itself is now a direct source for two things.** Its Table 1 (the
standard tolerance grades) was read and used to check every IT value this tool
ships — all of IT1–IT13 matched at all thirteen size ranges — and to supply IT01,
IT0 and IT14–IT18. Its five worked examples are encoded as fixtures, and they are
the strongest checks in the suite because the standard states both the inputs and
the answers:

| Example | Expected | Exercises |
|---|---|---|
| 90 F7 | +71 / +36 µm | hole, clearance side |
| 90 f7 | −36 / −71 µm | shaft, clearance side |
| 28 P9 | −22 / −74 µm | P above IT7, so **no** Δ |
| 20 K7 | +6 / −15 µm | Δ = IT7 − IT6 = 8 |
| 40 U6 | −55 / −71 µm | Δ = 5, and confirms the `u` column |

The Δ rule is quoted verbatim in the standard as applying to *"K, M and N for
standard tolerance grades up to and including IT8 and P to ZC up to and including
IT7"* — which is exactly what `deltaFor` implements, now including ZA/ZB/ZC.

## Corroborating sources actually consulted

| Source | Used for |
|---|---|
| [RoyMech ISO 286-2 hole table](https://www.roymech.co.uk/Useful_Tables/ISO_Tolerances/ISO_286_2H.html) | Full `>3–6 mm` hole row (E, F, G, H, J, JS, K, M, N, P, R at grades 6–13). This is the single most heavily used check in the suite — 38 fixtures. |
| [RoyMech ISO 286-2 shaft table](https://www.roymech.co.uk/Useful_Tables/ISO_Tolerances/ISO_286_2s.html) | Confirmed which shaft letters and grades the standard tabulates. |
| [Engineers Edge IT grades](https://www.engineersedge.com/international_tol.htm) | IT grade matrix. |
| [Coban Engineering, shaft deviations](https://www.cobanengineering.com/Tolerances/UpperAndLowerDeviationsShafts.asp) | Resolved that **j5 and j6 share one column** (ei −2 … −20 µm) while **j7** has its own (−4 … −32 µm); confirmed the endpoints of the k, m, n, p columns (0…+5, +2…+23, +4…+40, +6…+68). |
| [Coban Engineering, hole tolerances](https://www.cobanengineering.com/Tolerances/ISOHoleTolerances3mmTo400mm.asp) | Confirmed JS keeps half-micrometres: JS6 at `>6–10` = ±4.5, JS6 at `>18–30` = ±6.5, JS7 at `>18–30` = ±10.5. |
| *Machinery's Handbook*, limits and fits section | General cross-check and the preferred-fit selections. |

RSS stackup method follows standard tolerance-analysis practice — Fischer,
*Mechanical Tolerance Stackup and Analysis*; Creveling, *Tolerance Design*.

## Rules implemented, and what they change

**The Δ rule** (`deltaFor` in `js/iso286.js`). For holes **K, M, N at grades ≤ IT8**
and **P–U at grades ≤ IT7**:

```
ES = −(shaft fundamental deviation) + Δ,   Δ = IT(n) − IT(n−1)
```

Verified against the RoyMech `>3–6` row at ten points: K6 = −1+3 = +2, K7 = −1+4 =
+3, K8 = −1+6 = +5, M6 = −4+3 = −1, M7 = −4+4 = 0, M8 = −4+6 = +2, N6 = −8+3 = −5,
N7 = −8+4 = −4, P6 = −12+3 = −9, R7 = −15+4 = −11. P8 (grade above the window) =
−12 with no Δ, also confirmed.

**Δ = 0 for nominal sizes ≤ 3 mm.** ⚠️ *This is the one rule not corroborated
against a fetched table*, because every free reproduction sampled begins at
`>3 mm`. It is applied because the Δ table in ISO 286-2 itself starts above 3 mm.
The consequence is that at 3 mm, K6 is `0/−6` rather than `+2/−4`, M6 is `−2/−8`,
N6 is `−4/−10` and P6 is `−6/−12`. **If you rely on K/M/N/P at or below 3 mm,
confirm these four values against the standard before use.** Every other class at
≤3 mm — including the `m6` and `JS6` of the worked example — is unaffected, since
the rule only touches K, M, N and P–U.

**Letter k is asymmetric between shafts and holes.** ISO restricts k's nonzero
deviation to grades IT4–IT7 *for shafts only*. Hole K is built from the tabulated
k value at every grade. So shaft `k8` collapses to `0/+18` at 3–6 mm while hole
`K8` is `+5/−13`. Applying the shaft restriction to holes was a real bug caught in
testing; both cases are now asserted.

**js / JS is always ±IT/2.** Older editions permitted rounding odd IT values to
±(IT−1)/2 so deviations came out whole. Published ISO 286-2 tables do **not** do
this — JS6 at 6–10 mm is ±4.5, not ±4. Rounding down would report every odd-IT
symmetric class as 1 µm tighter than it is. Also caught in testing.

## Coverage: all 28 identifiers and all 20 grades

The catalogue matches the full ISO set — letters **a, b, c, cd, d, e, ef, f, fg,
g, h, j, js, k, m, n, p, r, s, t, u, v, x, y, z, za, zb, zc** and grades **IT01,
IT0, IT1 … IT18**. I, L, O, Q and W are absent because ISO does not use them: they
are too easily confused with digits or other drawing symbols.

Grades are handled as **string tokens**, not integers, because `IT01` and `IT1`
both parse to the integer 1. Anything that pulls digits out of a class label with
a regex silently merges those two grades.

### Which values are transcribed and which are derived

Values from a formula rather than a corroborated table column are **flagged
`derived` in the UI**, so the distinction is visible at the point of use rather
than buried here.

- **cd, ef, fg** — ISO defines these as the geometric mean of their two
  neighbours (c·d, e·f, f·g). That is an *interpolation*: the result cannot fall
  outside the pair it sits between, so it is safe at every size. Rounding may
  differ from ISO's tabulated value by about 1 µm.
- **v, x, y, z, za, zb, zc** — computed from ISO 286-1's formulae,
  `ei = IT(n) + k·D`, with D the geometric mean of the size range:
  v = IT7 + 1.25D, x = IT7 + 1.6D, y = IT7 + 2D, z = IT7 + 2.5D,
  za = IT8 + 3.15D, zb = IT9 + 4D, zc = IT10 + 5D.

### ⚠️ Why the extended letters stop at 18 mm

These formulae are *extrapolations* past the tabulated letters, so they are only
trustworthy where they reproduce values that can be checked. Tested against `u`,
whose column is tabulated and is independently confirmed by the standard's own
`40 U6` example:

| range | IT7 + D | published `u` | error |
|---|---|---|---|
| ≤3 mm | 11.7 | 18 | **−6.3** |
| 6–10 mm | 22.7 | 28 | **−5.3** |
| 18–24 mm | 41.8 | 41 | −0.8 |
| 24–30 mm | 47.8 | 48 | +0.2 |
| 50–65 mm | 87.0 | 87 | 0.0 |

Exact from 18 mm up; 5–6 µm low below it. At 3 mm that error would place `x`
*below* `u`, inverting the order of the letters and breaking the position slider.
So **v, x, y, z, za, zb and zc are rejected at or below 18 mm** with an explanatory
message, rather than shipping numbers that are wrong in a way that compounds. If
you have the tabulated values for those ranges, they can be encoded directly and
the restriction lifted.

## Deliberate omissions

- **Shaft j8** — its column could not be corroborated, so `j8` is rejected rather
  than guessed. `j5`, `j6`, `j7` are supported.
- **Sizes above 500 mm.**
- **ANSI/inch fit classes** (RC/LC/FN).

## Sub-range warning

Letters **a, b, c** and **r, s, t, u** subdivide the 13 principal size ranges
(splits at 40, 65, 100, 140, 160, 200, 225, 280, 355 and 450 mm), and **t is
undefined at or below 24 mm**. These are keyed on a separate 25-entry range list
in `js/iso286.js`. Sub-range boundaries are asserted either side of a split (r6 at
65 mm = +41 vs at 66 mm = +43).

## Material properties

Every property lives in `data/materials.csv`, one row per material, with a
`source` column on each row. Both shipped rows were cross-checked against two
independent reproductions of the same underlying datasheet.

### Aluminium 6061-T6 / T651

| Property | Value | Note |
|---|---|---|
| Density | 2700 kg/m³ | 2.70 g/cm³ |
| Elastic modulus | 68.9 GPa | 10.0 Msi |
| Poisson's ratio | 0.33 | |
| Tensile (UTS) | 310 MPa | 45 ksi |
| Yield | 276 MPa | 40 ksi |
| Shear (ultimate) | 207 MPa | 30 ksi — a *measured* value, not an estimate |
| Expansion | 23.6 µm/m·K | |

Sources: the ASM/MatWeb 6061-T6 set, as reproduced in
[this 6061-T651 datasheet](https://quickparts.com/wp-content/uploads/2024/05/Aluminum-6061.pdf)
(density, Poisson, expansion and the ksi column confirmed directly) and
[AmesWeb's 6061 sheet/plate tables](https://amesweb.info/Materials/Aluminum-6061-Sheet-Plate.aspx),
which cite MMPDS-01. This is the most widely reproduced set of numbers for the
alloy and the four strength values are mutually consistent in ksi.

### Alloy steel — AISI 4140, quenched & tempered

| Property | Value | Note |
|---|---|---|
| Density | 7850 kg/m³ | 7.85 g/cm³ |
| Elastic modulus | 205 GPa | published range 190–210 |
| Poisson's ratio | 0.29 | published range 0.27–0.30 |
| Tensile (UTS) | 850 MPa | ⚠️ **low end** of the 850–1000 MPa Q&T range |
| Yield | 655 MPa | ⚠️ **low end** of the 650–850 MPa Q&T range |
| Shear (ultimate) | 510 MPa | ⚠️ **derived**, 0.60 × UTS |
| Expansion | 12.3 µm/m·K | published 12.2–12.3 |

Sources: [AZoM's AISI 4140 datasheet](https://www.azom.com/article.aspx?ArticleID=6769)
(density, modulus range, Poisson range, expansion) and
[a MatWeb-derived 4140 property summary](https://www.otaialloysteel.com/4140-steel-properties-matweb/)
plus [a second Q&T summary](https://www.fuhongforge.com/aisi-4140-steel-a-complete-guide-for-buyers-and-engineers/),
which agree on 850–1000 MPa UTS, ≥650–670 MPa yield, 205 GPa and 12.3 µm/m·K for
the quenched-and-tempered condition at a 25 mm section.

Three deliberate choices in that row:

1. **"Alloy steel" is not a specification.** 4140 Q&T is used as the
   representative low-alloy steel because it is what press-fit pins and hubs are
   actually made from. The row is labelled with its condition so nobody mistakes it
   for a generic value.
2. **UTS and yield are taken at the bottom of the published range.** Yield gates
   the tool's "past yield" warning, so erring low makes the warning fire early
   rather than late.
3. **Shear strength is derived, not quoted** — 0.60 × UTS, the standard steel
   approximation. For comparison, 6061-T6's *measured* shear/UTS ratio is 0.67, so
   0.60 is on the conservative side. Shear strength is not currently used by any
   calculation; it is carried because the brief asked for it and a torsional or
   pin-shear check would need it.

⚠️ **Friction coefficients (0.28 for 6061, 0.15 for 4140) are the weakest numbers
in this file.** Friction is a property of an *interface*, not of a material, so no
per-material column can be correct about it. The values are practical press-fit
figures — 0.15 for steel-on-steel is the coefficient Shigley uses for press-fit
torque capacity, and aluminium is given a higher value because it galls. A
dissimilar pair is estimated as the arithmetic mean of the two, which puts
steel-on-aluminium at 0.215, inside the 0.17–0.30 commonly published for that pair.
Insertion and holding force scale linearly with this number, so the UI exposes it
as an override and the app labels it `(est.)` until you set it.

## Press-fit model

The mechanics in `js/press.js` are the Lamé thick-walled cylinder solution for a
shaft in a hub — the standard elastic treatment in Shigley, *Mechanical
Engineering Design* (the interference-fit section) and Roark, *Formulas for Stress
and Strain* (thick cylinders under internal/external pressure). Nothing about it
is novel, so rather than cite a table it is verified structurally:

- against a **hand-worked reference case** (25 mm, 50 µm interference, steel in
  steel, hub OD 50 mm, L 25 mm, µ 0.15 → p = 153.75 MPa, F = 45.28 kN,
  T = 566.0 N·m), computed from the equations independently of the code;
- against its **exact limit cases**: an infinite hub must collapse its compliance
  term to (1+ν)/E, a solid pin to (1−ν)/E, both geometry factors to 1, and a solid
  pin's von Mises stress to exactly the contact pressure;
- against the **strain identity** ε_hub − ε_pin = δ/D, which must hold exactly
  because the two parts' deformations have to account for precisely the
  interference forced between them (96 combinations, worst relative error ~1e-16);
- against **scaling laws**: force linear in length, friction and interference;
  pressure independent of length.

Known limits of the model, all reported in the UI rather than hidden: it is purely
elastic, so past yield it overstates pressure and force; it ignores surface
roughness flattening, which costs a real joint a few µm of effective interference
on a rough bore; and it ignores lead-in chamfers, misalignment, temperature and
stress relaxation. Insertion and retention are both µ·p·πDL under this model, which
is why the tool reports them as equal and invites a different µ for each.

## Standing caveat

This is a calculator, not the standard. The numbers here are checked, but for
anything going onto a production drawing, confirm against ISO 286 itself — and for
a press fit that matters, confirm the force on a sample before committing to a
press or a retention margin.
