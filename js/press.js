/*
 * press.js — interference-fit mechanics: contact pressure, strain, and the
 * insertion / holding forces that follow from them.
 *
 * The model is the classic Lame thick-walled cylinder solution for a shaft pressed
 * into a hub, which is what every machine-design text uses for this (Shigley,
 * Roark). Given a diametral interference d it solves for the interface contact
 * pressure p, then everything else is algebra on p.
 *
 *   d = p * D * [ Co + Ci ]
 *
 *   Co = ( (Do^2 + D^2)/(Do^2 - D^2) + vo ) / Eo     hub  (the hole's part)
 *   Ci = ( (D^2 + Di^2)/(D^2 - Di^2) - vi ) / Ei     shaft (the pin's part)
 *
 * where D is the interface diameter, Do the hub outer diameter, Di the pin bore.
 * A solid pin is Di = 0, which collapses Ci to (1 - vi)/Ei; a hub in a very large
 * body is Do -> infinity, which collapses Co to (1 + vo)/Eo.
 *
 * The two hoop strains at the interface fall straight out of the same terms:
 *
 *   e_hub = +p * Co        e_pin = -p * Ci        e_hub - e_pin = d / D
 *
 * That last identity is exact and is asserted in the test suite: it is the
 * cleanest possible check that the pressure solution and the strain outputs cannot
 * drift apart, because it says the two parts' deformations must add up to exactly
 * the interference that was forced between them.
 *
 * SIGN CONVENTION: interference is pin size - hole size, in micrometres, matching
 * fits.js. Positive means the pin is larger, i.e. an actual press fit. Zero or
 * negative means the parts fall together and every force here is zero.
 *
 * WHAT THIS DELIBERATELY DOES NOT MODEL: plasticity (once von Mises passes yield
 * the elastic numbers overstate pressure and force), surface roughness flattening
 * (real interference is a few um less than the dimensional interference on a rough
 * bore), the lead-in chamfer, misalignment, temperature, and time-dependent stress
 * relaxation. All of those make it an estimate. The yield check is reported so the
 * first of them is at least visible.
 */
var PressFit = (function () {
  'use strict';

  /* -------------------------------------------------------- geometry factors */

  /**
   * Hub (outer member) geometry factor (Do^2 + D^2)/(Do^2 - D^2).
   * Tends to 1 as the hub becomes large, and to infinity as its wall vanishes.
   */
  function hubFactor(D, Do) {
    if (!isFinite(Do)) return 1;
    return (Do * Do + D * D) / (Do * Do - D * D);
  }

  /**
   * Pin (inner member) geometry factor (D^2 + Di^2)/(D^2 - Di^2).
   * Exactly 1 for a solid pin; grows as the pin is bored out thinner.
   */
  function pinFactor(D, Di) {
    if (!(Di > 0)) return 1;
    return (D * D + Di * Di) / (D * D - Di * Di);
  }

  /** Von Mises equivalent stress for a plane-stress state (sz = 0). */
  function vonMises(sr, st) {
    return Math.sqrt(st * st - st * sr + sr * sr);
  }

  /* ------------------------------------------------------------------- solver */

  /**
   * Solve one interference condition.
   *
   * opts:
   *   interferenceUm  diametral interference, um, signed (pin - hole)
   *   diameterMm      nominal interface diameter
   *   pin, hole       material records from Materials.get()
   *   pinBoreMm       pin inner diameter, 0 for solid (default 0)
   *   hubOuterMm      hub outer diameter; Infinity for an effectively infinite
   *                   body (default 2 x diameterMm)
   *   lengthMm        axial engagement length (default diameterMm)
   *   friction        coefficient of friction at the interface
   *
   * Returns an object in display units: MPa, N, N*m, um, and strain both as a
   * ratio and as microstrain.
   */
  function solve(opts) {
    var D_mm = opts.diameterMm;
    var Di_mm = opts.pinBoreMm || 0;
    var Do_mm = (opts.hubOuterMm === undefined || opts.hubOuterMm === null)
      ? 2 * D_mm : opts.hubOuterMm;
    var L_mm = (opts.lengthMm === undefined || opts.lengthMm === null)
      ? D_mm : opts.lengthMm;
    var mu = (typeof opts.friction === 'number') ? opts.friction : 0.15;
    var pin = opts.pin, hole = opts.hole;

    if (!(D_mm > 0)) throw new Error('Interface diameter must be positive.');
    if (!(L_mm >= 0)) throw new Error('Engagement length cannot be negative.');
    if (Di_mm >= D_mm) {
      throw new Error('Pin bore must be smaller than the pin diameter.');
    }
    if (isFinite(Do_mm) && Do_mm <= D_mm) {
      throw new Error('Hub outer diameter must be larger than the hole diameter.');
    }

    var fHub = hubFactor(D_mm, Do_mm);
    var fPin = pinFactor(D_mm, Di_mm);

    // Compliance of each member, in 1/Pa. Materials store E in GPa.
    var Eo = hole.youngs_modulus_gpa * 1e9;
    var Ei = pin.youngs_modulus_gpa * 1e9;
    var Co = (fHub + hole.poissons_ratio) / Eo;
    var Ci = (fPin - pin.poissons_ratio) / Ei;

    // SI for the mechanics, then back to display units at the end.
    var D_m = D_mm * 1e-3;
    var L_m = L_mm * 1e-3;
    var delta_m = opts.interferenceUm * 1e-6;

    var engaged = opts.interferenceUm > 0;
    var p = engaged ? delta_m / (D_m * (Co + Ci)) : 0;   // Pa

    // Hoop strain at the interface. Hub goes into tension, pin into compression.
    var eHub = p * Co;
    var ePin = -p * Ci;

    // Radial displacement of each surface, um. These sum to half the diametral
    // interference, which is the same identity as the strain one.
    var uHub = eHub * (D_m / 2) * 1e6;
    var uPin = ePin * (D_m / 2) * 1e6;

    var stHub = p * fHub;      // hub bore hoop stress, tensile
    var stPin = -p * fPin;     // pin surface hoop stress, compressive
    var srBoth = -p;           // radial stress at the interface is -p on both

    var area_m2 = Math.PI * D_m * L_m;
    var force = mu * p * area_m2;          // N, both insertion and retention
    var torque = force * (D_m / 2);        // N*m

    function member(mat, strain, u, st, vmStress) {
      var yield_Pa = mat.yield_strength_mpa * 1e6;
      return {
        material: mat,
        hoopStrain: strain,
        microstrain: strain * 1e6,
        radialDispUm: u,
        hoopStressMPa: st / 1e6,
        radialStressMPa: srBoth / 1e6,
        vonMisesMPa: vmStress / 1e6,
        // Fraction of yield used up by the fit alone, before any service load.
        yieldUtilisation: vmStress / yield_Pa,
        yields: vmStress > yield_Pa,
        // Strain at which this material would yield in simple tension, for scale.
        yieldStrain: yield_Pa / (mat.youngs_modulus_gpa * 1e9)
      };
    }

    /*
     * Hub heating that would open the bore by the full interference, i.e. the
     * shrink-fit alternative to pressing. dT = d / (alpha * D).
     */
    var alphaHub = hole.cte_um_m_k * 1e-6;
    var deltaTHub = engaged ? delta_m / (alphaHub * D_m) : 0;

    return {
      engaged: engaged,
      interferenceUm: opts.interferenceUm,
      diameterMm: D_mm,
      lengthMm: L_mm,
      hubOuterMm: Do_mm,
      pinBoreMm: Di_mm,
      friction: mu,

      pressureMPa: p / 1e6,
      contactAreaMm2: area_m2 * 1e6,

      // Insertion and retention are both mu * p * A under this model. They are
      // reported separately because they are different questions, and because a
      // user overriding friction usually wants to try a lubricated insertion
      // value against a dry retention value.
      insertionForceN: force,
      holdingForceN: force,
      holdingTorqueNm: torque,

      pin: member(pin, ePin, uPin, stPin, vonMises(srBoth, stPin)),
      hole: member(hole, eHub, uHub, stHub, vonMises(srBoth, stHub)),

      deltaTHubC: deltaTHub,

      // Exposed for testing: the identity eHub - ePin == delta/D must hold.
      compliance: { hub: Co, pin: Ci, hubFactor: fHub, pinFactor: fPin }
    };
  }

  /**
   * Solve the nominal case plus the +/- n-sigma cases of the interference
   * distribution, so the UI can show how much the forces move across a production
   * run rather than only at the mean.
   *
   * `stats` is a Fits.rss() result: it supplies the mean interference and the RSS
   * sigma, both in um. `nSigma` defaults to 1.
   */
  function range(stats, nSigma, opts) {
    var n = (typeof nSigma === 'number' && nSigma >= 0) ? nSigma : 1;
    var band = n * stats.sigma;

    function at(interferenceUm) {
      var o = {};
      for (var k in opts) if (opts.hasOwnProperty(k)) o[k] = opts[k];
      o.interferenceUm = interferenceUm;
      return solve(o);
    }

    return {
      nSigma: n,
      sigmaUm: stats.sigma,
      // Named low / nominal / high by interference, so `low` is the loosest fit
      // and the weakest holding force -- the one that decides whether the joint
      // works at all.
      low: at(stats.mean - band),
      nominal: at(stats.mean),
      high: at(stats.mean + band)
    };
  }

  return {
    solve: solve,
    range: range,
    hubFactor: hubFactor,
    pinFactor: pinFactor,
    vonMises: vonMises
  };
})();
