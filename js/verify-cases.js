/*
 * verify-cases.js — published spot-check fixtures.
 *
 * There is no Node on this machine, so verify.html is the test runner: open it in
 * a browser and every case below is asserted against the live data layer.
 *
 * `src` records where each expected value came from, so a future reader can tell
 * a corroborated number from a derived one. See REFERENCES.md.
 */
var VerifyCases = (function () {
  'use strict';

  var ROYMECH = 'RoyMech ISO 286-2 hole table, >3-6 mm row';
  var BRIEF = "worked example in the project brief";
  var RULE = 'derived by the ISO 286-1 rule (see note in REFERENCES.md)';
  var TEXTBOOK = 'standard published limits for this class';

  return {

    /* ------------------------------------------------- IT standard tolerances */
    it: [
      // Confirmed against RoyMech H-column values (H6..H11 have EI = 0, so the
      // upper deviation IS the IT value) and Engineers Edge IT table.
      { size: 3, grade: 5, um: 4 },   { size: 3, grade: 6, um: 6 },
      { size: 3, grade: 7, um: 10 },  { size: 3, grade: 8, um: 14 },
      { size: 3, grade: 9, um: 25 },  { size: 3, grade: 10, um: 40 },
      { size: 3, grade: 11, um: 60 },
      { size: 5, grade: 5, um: 5 },   { size: 5, grade: 6, um: 8 },
      { size: 5, grade: 7, um: 12 },  { size: 5, grade: 8, um: 18 },
      { size: 5, grade: 9, um: 30 },  { size: 5, grade: 10, um: 48 },
      { size: 5, grade: 11, um: 75 },
      { size: 25, grade: 6, um: 13 }, { size: 25, grade: 7, um: 21 },
      { size: 100, grade: 7, um: 35 }, { size: 500, grade: 7, um: 63 }
    ],

    /* ------------------------------------------------ deviations, um (upper/lower) */
    deviations: [
      /* --- the brief's own example, the case the whole tool exists to answer --- */
      { size: 3, cls: 'm6',  upper: 8,  lower: 2,  src: BRIEF },
      { size: 3, cls: 'JS6', upper: 3,  lower: -3, src: BRIEF },

      /* --- the fully corroborated >3-6 mm hole row --- */
      { size: 5, cls: 'E6',  upper: 28,  lower: 20,  src: ROYMECH },
      { size: 5, cls: 'E7',  upper: 32,  lower: 20,  src: ROYMECH },
      { size: 5, cls: 'E11', upper: 95,  lower: 20,  src: ROYMECH },
      { size: 5, cls: 'E12', upper: 140, lower: 20,  src: ROYMECH },
      { size: 5, cls: 'E13', upper: 200, lower: 20,  src: ROYMECH },
      { size: 5, cls: 'F6',  upper: 18,  lower: 10,  src: ROYMECH },
      { size: 5, cls: 'F7',  upper: 22,  lower: 10,  src: ROYMECH },
      { size: 5, cls: 'F8',  upper: 28,  lower: 10,  src: ROYMECH },
      { size: 5, cls: 'G6',  upper: 12,  lower: 4,   src: ROYMECH },
      { size: 5, cls: 'G7',  upper: 16,  lower: 4,   src: ROYMECH },
      { size: 5, cls: 'G8',  upper: 22,  lower: 4,   src: ROYMECH },
      { size: 5, cls: 'H6',  upper: 8,   lower: 0,   src: ROYMECH },
      { size: 5, cls: 'H7',  upper: 12,  lower: 0,   src: ROYMECH },
      { size: 5, cls: 'H8',  upper: 18,  lower: 0,   src: ROYMECH },
      { size: 5, cls: 'H9',  upper: 30,  lower: 0,   src: ROYMECH },
      { size: 5, cls: 'H10', upper: 48,  lower: 0,   src: ROYMECH },
      { size: 5, cls: 'H11', upper: 75,  lower: 0,   src: ROYMECH },
      { size: 5, cls: 'J6',  upper: 5,   lower: -3,  src: ROYMECH },
      { size: 5, cls: 'J7',  upper: 6,   lower: -6,  src: ROYMECH },
      { size: 5, cls: 'J8',  upper: 10,  lower: -8,  src: ROYMECH },
      { size: 5, cls: 'JS6', upper: 4,   lower: -4,  src: ROYMECH },
      { size: 5, cls: 'JS7', upper: 6,   lower: -6,  src: ROYMECH },
      { size: 5, cls: 'JS8', upper: 9,   lower: -9,  src: ROYMECH },
      { size: 5, cls: 'K6',  upper: 2,   lower: -6,  src: ROYMECH },
      { size: 5, cls: 'K7',  upper: 3,   lower: -9,  src: ROYMECH },
      { size: 5, cls: 'K8',  upper: 5,   lower: -13, src: ROYMECH },
      { size: 5, cls: 'M6',  upper: -1,  lower: -9,  src: ROYMECH },
      { size: 5, cls: 'M7',  upper: 0,   lower: -12, src: ROYMECH },
      { size: 5, cls: 'M8',  upper: 2,   lower: -16, src: ROYMECH },
      { size: 5, cls: 'N6',  upper: -5,  lower: -13, src: ROYMECH },
      { size: 5, cls: 'N7',  upper: -4,  lower: -16, src: ROYMECH },
      { size: 5, cls: 'N8',  upper: -2,  lower: -20, src: ROYMECH },
      { size: 5, cls: 'P6',  upper: -9,  lower: -17, src: ROYMECH },
      { size: 5, cls: 'P7',  upper: -8,  lower: -20, src: ROYMECH },
      { size: 5, cls: 'P8',  upper: -12, lower: -30, src: ROYMECH },
      { size: 5, cls: 'R6',  upper: -12, lower: -20, src: ROYMECH },
      { size: 5, cls: 'R7',  upper: -11, lower: -23, src: ROYMECH },

      /* --- widely published shaft classes at 25 mm --- */
      { size: 25, cls: 'h6', upper: 0,  lower: -13, src: TEXTBOOK },
      { size: 25, cls: 'j6', upper: 9,  lower: -4,  src: TEXTBOOK },
      { size: 25, cls: 'k6', upper: 15, lower: 2,   src: TEXTBOOK },
      { size: 25, cls: 'p6', upper: 35, lower: 22,  src: TEXTBOOK },
      { size: 25, cls: 'H7', upper: 21, lower: 0,   src: TEXTBOOK },
      { size: 50, cls: 'p6', upper: 42, lower: 26,  src: TEXTBOOK },
      { size: 30, cls: 's6', upper: 48, lower: 35,  src: TEXTBOOK },
      { size: 10, cls: 'm6', upper: 15, lower: 6,   src: TEXTBOOK },
      { size: 6,  cls: 'n6', upper: 16, lower: 8,   src: TEXTBOOK },

      /* --- symmetric js/JS classes where IT is ODD, so the deviation carries a
             half micrometre. Rounding these down was a real bug caught in
             testing; these fixtures exist to stop it coming back. --- */
      { size: 8,  cls: 'JS6', upper: 4.5,  lower: -4.5,  src: 'Coban Engineering, >6-10 row, IT6 = 9' },
      { size: 8,  cls: 'js6', upper: 4.5,  lower: -4.5,  src: 'shaft form of the same class' },
      { size: 25, cls: 'JS6', upper: 6.5,  lower: -6.5,  src: 'Coban Engineering, >18-30 row, IT6 = 13' },
      { size: 25, cls: 'JS7', upper: 10.5, lower: -10.5, src: 'Coban Engineering, >18-30 row, IT7 = 21' },
      { size: 3,  cls: 'JS9', upper: 12.5, lower: -12.5, src: 'IT9 = 25 at <=3 mm, so +/-12.5' },

      /* --- the shaft/hole asymmetry for letter k: ISO zeroes the k deviation
             outside IT4..IT7 for SHAFTS only, so shaft k8 collapses to 0/+18
             while hole K8 still derives from k = +1. Both are asserted so the
             distinction cannot silently regress. --- */
      { size: 5, cls: 'k8', upper: 18, lower: 0, src: 'shaft k is zero outside IT4-IT7' },
      { size: 5, cls: 'k6', upper: 9,  lower: 1, src: TEXTBOOK },

      /* --- r/s/t/u sub-range boundaries: the most likely place for a data bug.
             r subdivides 50-80 at 65, so 65 mm and 66 mm must differ. --- */
      { size: 60, cls: 'r6', upper: 60, lower: 41, src: TEXTBOOK },
      { size: 65, cls: 'r6', upper: 60, lower: 41, src: 'r sub-range 50-65' },
      { size: 66, cls: 'r6', upper: 62, lower: 43, src: 'r sub-range 65-80' },
      { size: 30, cls: 't6', upper: 54, lower: 41, src: 't starts above 24 mm' },

      /* --- delta = 0 below 3 mm. These rest on the ISO rule, not on a fetched
             table, because the free references all start above 3 mm. --- */
      { size: 3, cls: 'K6', upper: 0,  lower: -6,  src: RULE },
      { size: 3, cls: 'M6', upper: -2, lower: -8,  src: RULE },
      { size: 3, cls: 'N6', upper: -4, lower: -10, src: RULE },
      { size: 3, cls: 'P6', upper: -6, lower: -12, src: RULE },
      { size: 3, cls: 'k6', upper: 6,  lower: 0,   src: RULE }
    ],

    /* ------------------------------------------------------- fits, um */
    interference: [
      // The brief's example, spelled out exactly as the brief states it.
      { size: 3, pin: 'm6', hole: 'JS6', mean: 5, max: 11, min: -1,
        fit: 'transition', src: BRIEF },
      // These three are the classic textbook fits. If the sign convention were
      // inverted or the delta rule wrong, at least one would land in the wrong
      // category -- which makes them the strongest single check in the suite.
      { size: 25, pin: 'h6', hole: 'H7', mean: -17, max: 0, min: -34,
        fit: 'clearance', src: 'H7/h6 is a sliding clearance fit' },
      { size: 25, pin: 'k6', hole: 'H7', mean: -2, max: 15, min: -19,
        fit: 'transition', src: 'H7/k6 is a transition fit' },
      { size: 25, pin: 'p6', hole: 'H7', mean: 18, max: 35, min: 1,
        fit: 'interference', src: 'H7/p6 is a press fit' }
    ],

    /* --------------------------------------- classes that must be rejected */
    errors: [
      { size: 3,  cls: 't6',  why: 't is undefined at or below 24 mm' },
      { size: 24, cls: 't6',  why: 't starts above 24 mm, so 24 itself is out' },
      { size: 25, cls: 'q6',  why: 'unknown letter' },
      { size: 25, cls: 'zz6', why: 'unknown two-letter code' },
      { size: 25, cls: 'h',   why: 'missing grade' },
      { size: 0.5, cls: 'h6', why: 'below the supported size range' },
      { size: 900, cls: 'h6', why: 'above the supported size range' },
      { size: 25, cls: 'j8',  why: 'shaft j is only corroborated at grades 5-7' }
    ],

    /* ------------------------------------------------------------ statistics */
    normal: [
      { z: 0,     cdf: 0.5 },
      { z: 1,     cdf: 0.841345 },
      { z: -1,    cdf: 0.158655 },
      { z: 1.96,  cdf: 0.975002 },
      { z: 3,     cdf: 0.998650 },
      { z: -3,    cdf: 0.001350 }
    ],

    erf: [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.520500 },
      { x: 1, y: 0.842701 },
      { x: 2, y: 0.995322 }
    ],

    /* RSS on the brief's example: both tolerances are 6 um wide, so at k = 3
       sigma is 1 um each and the combined sigma is sqrt(2). The interesting
       result is that worst-case allows -1 um (clearance) while RSS predicts
       ~99.98% of assemblies land in interference. */
    rss: [
      { size: 3, pin: 'm6', hole: 'JS6', k: 3,
        sigmaPin: 1, sigmaHole: 1, sigma: Math.SQRT2, mean: 5,
        min: 5 - 3 * Math.SQRT2, max: 5 + 3 * Math.SQRT2,
        pInterference: 0.99980 }
    ]
  };
})();
