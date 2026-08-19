/*
 * fits.js — fit evaluation and RSS tolerance stackup.
 *
 * Interference convention, used everywhere without exception:
 *     I = pin size - hole size
 *   I > 0  ->  interference (pin larger than hole)
 *   I < 0  ->  clearance
 *
 * All interference arithmetic is done in micrometres directly from the integer
 * deviations, NOT by subtracting the mm limits. Subtracting mm values that were
 * produced by dividing by 1000 introduces float noise that shows up as
 * "4.999999999999998 um" in the UI.
 */
var Fits = (function () {
  'use strict';

  /* ------------------------------------------------------------- normal stats */

  /**
   * Error function, Abramowitz & Stegun 7.1.26. Max absolute error ~1.5e-7,
   * which is far tighter than the modelling assumptions it feeds.
   */
  function erf(x) {
    var sign = (x < 0) ? -1 : 1;
    x = Math.abs(x);
    var a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
        a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    var t = 1 / (1 + p * x);
    var y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
  }

  /** Standard normal CDF. */
  function normalCdf(z) {
    return 0.5 * (1 + erf(z / Math.SQRT2));
  }

  /** Standard normal PDF. */
  function normalPdf(z) {
    return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  }

  /* ------------------------------------------------------- worst-case analysis */

  /**
   * Arithmetic (worst-case) interference from two limits objects.
   * Returns micrometres.
   */
  function interference(pin, hole) {
    var max = pin.upper - hole.lower;   // biggest pin in smallest hole
    var min = pin.lower - hole.upper;   // smallest pin in biggest hole
    var mean = (pin.upper + pin.lower) / 2 - (hole.upper + hole.lower) / 2;
    return {
      max: max,
      min: min,
      mean: mean,
      // Total spread of possible interference = sum of the two tolerances.
      spread: max - min,
      fit: classify(min, max)
    };
  }

  /**
   * Fit category. Boundaries are inclusive on the interference side: a fit whose
   * minimum interference is exactly zero is still guaranteed non-clearance, so it
   * counts as interference rather than transition.
   */
  function classify(min, max) {
    if (min >= 0) return 'interference';
    if (max <= 0) return 'clearance';
    return 'transition';
  }

  var FIT_INFO = {
    interference: {
      name: 'Interference',
      blurb: 'Always interference. The pin is larger than the hole across the ' +
             'whole tolerance range, so assembly needs press, shrink or ' +
             'freeze fitting.'
    },
    transition: {
      name: 'Transition',
      blurb: 'May be either. Depending on where the two parts land in their ' +
             'tolerance bands, an assembly can come out with light ' +
             'interference or slight clearance.'
    },
    clearance: {
      name: 'Clearance',
      blurb: 'Always clearance. The pin is smaller than the hole across the ' +
             'whole tolerance range, so the parts always assemble freely.'
    }
  };

  /* ------------------------------------------------------------ RSS statistics */

  /**
   * Root-sum-square statistical stackup of the interference.
   *
   * Model: each dimension is treated as independent and normally distributed,
   * centred in its tolerance band, with the band edges at +/- k sigma. k = 3
   * (Cp = 1.0) is the default. `meanShift` (um, applied to the interference mean)
   * models a process that does not run centred.
   *
   * This is an estimate of process capability, not a guarantee -- see the caveat
   * shown in the UI. Worst-case limits are what a drawing has to survive.
   */
  function rss(pin, hole, opts) {
    opts = opts || {};
    var k = (typeof opts.k === 'number' && opts.k > 0) ? opts.k : 3;
    var meanShift = opts.meanShift || 0;

    var tPin = pin.upper - pin.lower;      // um
    var tHole = hole.upper - hole.lower;   // um
    var sigmaPin = tPin / (2 * k);
    var sigmaHole = tHole / (2 * k);
    var sigma = Math.sqrt(sigmaPin * sigmaPin + sigmaHole * sigmaHole);

    var wc = interference(pin, hole);
    var mean = wc.mean + meanShift;

    // Fraction of assemblies with I > 0.
    var pInterference = (sigma > 0)
      ? 1 - normalCdf((0 - mean) / sigma)
      : (mean > 0 ? 1 : (mean < 0 ? 0 : 0.5));

    return {
      k: k,
      meanShift: meanShift,
      sigmaPin: sigmaPin,
      sigmaHole: sigmaHole,
      sigma: sigma,
      mean: mean,
      // RSS limits: narrower than worst-case, because both parts landing at
      // opposite extremes at once is improbable rather than impossible.
      min: mean - k * sigma,
      max: mean + k * sigma,
      // Half-width of the RSS band, the classic sqrt(sum of squares) result.
      halfWidth: k * sigma,
      worstCase: wc,
      pInterference: pInterference,
      pClearance: 1 - pInterference,
      /** Fraction of assemblies whose interference exceeds x um. */
      fractionAbove: function (x) {
        if (sigma <= 0) return mean > x ? 1 : 0;
        return 1 - normalCdf((x - mean) / sigma);
      },
      /** Fraction of assemblies whose interference falls between lo and hi um. */
      fractionBetween: function (lo, hi) {
        if (sigma <= 0) return (mean >= lo && mean <= hi) ? 1 : 0;
        return normalCdf((hi - mean) / sigma) - normalCdf((lo - mean) / sigma);
      },
      /** Normal PDF of interference at x um (for plotting). */
      pdf: function (x) {
        if (sigma <= 0) return 0;
        return normalPdf((x - mean) / sigma) / sigma;
      }
    };
  }

  /* ----------------------------------------------------- informational extras */

  // Rough guide to the processes that routinely hold each IT grade. Indicative
  // only -- actual capability depends on machine, setup, material and inspection.
  var PROCESS_HINTS = {
    1: 'lapping, superfinishing', 2: 'lapping, superfinishing',
    3: 'lapping, honing', 4: 'honing, fine grinding',
    5: 'cylindrical grinding, fine honing',
    6: 'grinding, reaming, precision boring',
    7: 'grinding, reaming, precision turning',
    8: 'turning, boring, reaming',
    9: 'milling, turning, drilling then reaming',
    10: 'milling, turning, drilling',
    11: 'drilling, rough turning, punching',
    12: 'die casting, punching, sawing',
    13: 'sand casting, flame cutting'
  };

  function processHint(grade) {
    return PROCESS_HINTS[grade] || '';
  }

  return {
    erf: erf,
    normalCdf: normalCdf,
    normalPdf: normalPdf,
    interference: interference,
    classify: classify,
    rss: rss,
    processHint: processHint,
    FIT_INFO: FIT_INFO
  };
})();
