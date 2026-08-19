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

## Deliberate omissions

- **Shaft j8** — its column could not be corroborated, so `j8` is rejected rather
  than guessed. `j5`, `j6`, `j7` are supported.
- **Letters cd, ef, fg and v–zc** — rare, and they need additional sub-range data.
- **Sizes above 500 mm** and IT14–IT18.
- **ANSI/inch fit classes** (RC/LC/FN).

## Sub-range warning

Letters **a, b, c** and **r, s, t, u** subdivide the 13 principal size ranges
(splits at 40, 65, 100, 140, 160, 200, 225, 280, 355 and 450 mm), and **t is
undefined at or below 24 mm**. These are keyed on a separate 25-entry range list
in `js/iso286.js`. Sub-range boundaries are asserted either side of a split (r6 at
65 mm = +41 vs at 66 mm = +43).

## Standing caveat

This is a calculator, not the standard. The numbers here are checked, but for
anything going onto a production drawing, confirm against ISO 286 itself.
