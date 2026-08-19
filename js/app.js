/*
 * app.js — state, rendering and event wiring.
 *
 * The hole is chosen along two independent axes rather than by typing a class:
 *   gradeSlider -> tolerance band WIDTH  (the IT number)
 *   posSlider   -> band POSITION, i.e. the nominal diameter, which is what moves
 *                  the fit between interference, transition and clearance
 * The ISO class is the OUTPUT of those two, shown in the card heading.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var state = {
    dia: 3,
    pinLetter: 'm', pinGrade: '6',
    useCustom: false, customUpper: 8, customLower: 2,
    holeLetter: 'JS', holeGrade: '6',
    vizMode: 'dia',
    k: 3, shift: 0, target: 0, exagSlider: 50,
    exagRef: null, exagBasis: null,  // pinned factor and the diameter it belongs to

    /* Press fit. A steel pin in an aluminium hub is the common case, so it is the
       default pairing. The four geometry fields are null until the user types in
       them, which means "track the diameter" -- see engLenMm() and friends. A
       stale 25 mm engagement length left behind after the diameter changed to 3 mm
       would quietly produce forces an order of magnitude out. */
    pinMat: 'steel4140', holeMat: 'al6061',
    engLen: null, hubOd: null, pinBore: null, fric: null,
    nSigma: 1
  };

  /* -------------------------------------------------- press-fit derived inputs */

  /** Engagement length, defaulting to 1x the diameter. */
  function engLenMm() {
    return state.engLen === null ? state.dia : state.engLen;
  }

  /** Hub outer diameter, defaulting to 2x the diameter (a stout but not
      infinite hub). */
  function hubOdMm() {
    return state.hubOd === null ? 2 * state.dia : state.hubOd;
  }

  /** Pin bore, defaulting to solid. */
  function pinBoreMm() {
    return state.pinBore === null ? 0 : state.pinBore;
  }

  /** Friction, defaulting to the estimate from the material pair. */
  function fricVal() {
    return state.fric === null
      ? Materials.pairFriction(state.pinMat, state.holeMat)
      : state.fric;
  }

  /* ------------------------------------------------------------- formatting */

  var signed = Viz.signed;
  function mm(v) { return v.toFixed(4); }
  function um(v) { return signed(v, 1); }
  function pct(v) {
    if (v >= 1) return '100%';
    if (v <= 0) return '0%';
    if (v > 0.9999) return '>99.99%';
    if (v < 0.0001) return '<0.01%';
    return (v * 100).toFixed(v > 0.01 && v < 0.99 ? 2 : 3) + '%';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ----------------------------------------------------------- limits objects */

  function pinLimits() {
    if (state.useCustom) {
      var up = state.customUpper, lo = state.customLower, d = state.dia;
      if (!(up >= lo)) throw new Error('Pin upper deviation must be at least the lower.');
      return {
        basic: d, min: d + lo / 1000, max: d + up / 1000, mean: d + (up + lo) / 2000,
        tolerance: (up - lo) / 1000, toleranceUm: up - lo,
        upper: up, lower: lo, label: 'custom', kind: 'shaft',
        grade: null, letter: null, it: null
      };
    }
    return ISO286.limits(state.dia, state.pinLetter + state.pinGrade);
  }

  function rssOpts() { return { k: state.k, meanShift: state.shift }; }

  /* ---------------------------------------------------------------- readouts */

  /** Compact readout: deviations, then max / nominal / min diameter. */
  function readout(lim) {
    return '' +
      '<span class="k">deviation</span>' +
      '<span class="v dev">' + um(lim.upper) + ' / ' + um(lim.lower) + ' µm</span>' +
      '<span class="sep"></span>' +
      '<span class="k">max Ø</span><span class="v">' + mm(lim.max) + ' mm</span>' +
      '<span class="k">nominal Ø</span><span class="v nom">' + mm(lim.mean) + ' mm</span>' +
      '<span class="k">min Ø</span><span class="v">' + mm(lim.min) + ' mm</span>';
  }

  /** The detail overlay: the things most users do not need on screen. */
  function moreTable(lim) {
    var rows = [
      ['Tolerance class', esc(lim.label)],
      ['Basic size', mm(lim.basic) + ' mm'],
      ['Nominal (mean) size', mm(lim.mean) + ' mm'],
      ['Tolerance width', Viz.fmt(lim.toleranceUm, 1) + ' µm'],
      ['IT grade', lim.grade ? 'IT' + lim.grade + ' = ' + Viz.fmt(lim.it, 1) + ' µm' : '—']
    ];
    if (lim.grade) rows.push(['Typically held by', Fits.processHint(lim.grade)]);
    var html = '<table class="mini"><tbody>';
    rows.forEach(function (r) {
      html += '<tr><th>' + r[0] + '</th><td>' + r[1] + '</td></tr>';
    });
    html += '</tbody></table>' +
      '<p class="fine"><strong>Basic size</strong> is the stated diameter the ' +
      'deviations apply to; <strong>nominal</strong> here is ' +
      'the middle of the tolerance band, which is where the solid circle is drawn.</p>';
    return html;
  }

  /* --------------------------------------------------------------- press fit */

  /**
   * Fixed significant figures without ever falling back to exponent notation,
   * which would be unreadable in a table of forces.
   */
  function sig(v, n) {
    if (!isFinite(v)) return '—';
    if (v === 0) return '0';
    var mag = Math.floor(Math.log10(Math.abs(v)));
    return v.toFixed(Math.max(0, Math.min(6, n - 1 - mag)));
  }

  /**
   * Format a number for an input field or an inline note. Viz.fmt is not used for
   * these: it clamps anything under 0.05 to zero, which is right for micrometre
   * deviations but would silently show a 0.03 mm hub wall or a µ of 0.04 as "0".
   */
  function numIn(v) {
    if (!isFinite(v)) return '';
    return String(Math.round(v * 1e4) / 1e4);
  }

  /** Write a value into an input unless the user is currently editing it. */
  function setUnlessFocused(id, value) {
    var el = $(id);
    if (document.activeElement === el) return;
    el.value = value;
  }

  /**
   * Choose one unit for a whole row from its largest value, so a row never mixes
   * N with kN. Returns { unit, f } where f formats one value into that unit.
   */
  function rowScale(values, ladder) {
    var m = 0;
    values.forEach(function (v) { m = Math.max(m, Math.abs(v)); });
    for (var i = ladder.length - 1; i >= 0; i--) {
      if (m >= ladder[i].min || i === 0) {
        var step = ladder[i];
        return {
          unit: step.unit,
          f: function (v) { return sig(v / step.div, 3); }
        };
      }
    }
  }

  var FORCE_LADDER = [
    { min: 0, unit: 'N', div: 1 },
    { min: 1000, unit: 'kN', div: 1000 }
  ];
  var TORQUE_LADDER = [
    { min: 0, unit: 'N·mm', div: 0.001 },
    { min: 1, unit: 'N·m', div: 1 }
  ];

  function fillMatSelects() {
    /*
     * Name only, not "name — condition". The name already carries the temper
     * (6061-T6, 4140 Q&T) so nothing is lost, and the long form was wide enough to
     * force the whole card past its grid track. The full condition is a row in the
     * material table behind the detail panel.
     */
    var opts = Materials.all().map(function (m) {
      return { key: m.key, text: m.name };
    });
    [['pinMat', 'pinMat'], ['holeMat', 'holeMat']].forEach(function (pair) {
      var id = pair[0], key = pair[1];
      if (!Materials.has(state[key])) state[key] = Materials.defaultKey();
      $(id).innerHTML = opts.map(function (o) {
        return '<option value="' + o.key + '"' +
          (o.key === state[key] ? ' selected' : '') + '>' + esc(o.text) + '</option>';
      }).join('');
    });
  }

  /** Short name for the heading, e.g. "4140 → 6061". */
  function shortName(key) {
    var n = Materials.get(key).name;
    var m = n.match(/(\d{4})/);
    return m ? m[1] : n;
  }

  /**
   * The property table shown behind "material data & assumptions". Both selected
   * materials side by side, with the provenance of each row's numbers underneath.
   */
  function matTable() {
    var pin = Materials.get(state.pinMat), hole = Materials.get(state.holeMat);
    var rows = [
      ['Condition', pin.condition, hole.condition],
      ['Density', pin.density_kg_m3 + ' kg/m³', hole.density_kg_m3 + ' kg/m³'],
      ['Elastic modulus E', pin.youngs_modulus_gpa + ' GPa', hole.youngs_modulus_gpa + ' GPa'],
      ['Poisson ν', pin.poissons_ratio, hole.poissons_ratio],
      ['Tensile (UTS)', pin.tensile_strength_mpa + ' MPa', hole.tensile_strength_mpa + ' MPa'],
      ['Yield', pin.yield_strength_mpa + ' MPa', hole.yield_strength_mpa + ' MPa'],
      ['Shear (ultimate)', pin.shear_strength_mpa + ' MPa', hole.shear_strength_mpa + ' MPa'],
      ['Expansion α', pin.cte_um_m_k + ' µm/m·K', hole.cte_um_m_k + ' µm/m·K'],
      ['Friction (self, dry)', pin.friction_dry, hole.friction_dry]
    ];
    var html = '<table class="mini"><thead><tr><th></th>' +
      '<th style="text-align:right">pin</th>' +
      '<th style="text-align:right">hole</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr><th>' + r[0] + '</th><td>' + esc(r[1]) + '</td><td>' +
        esc(r[2]) + '</td></tr>';
    });
    html += '</tbody></table>';
    html += '<p class="fine"><strong>' + esc(pin.name) + '</strong> — ' +
      esc(pin.source) + '</p>';
    if (hole.key !== pin.key) {
      html += '<p class="fine"><strong>' + esc(hole.name) + '</strong> — ' +
        esc(hole.source) + '</p>';
    }
    return html;
  }

  /**
   * The forces-and-strain table. `stats` is the Fits.rss() result, which supplies
   * the mean interference and its sigma; everything else comes from the material
   * and geometry inputs.
   */
  function renderPress(stats) {
    $('pressPair').textContent = shortName(state.pinMat) + ' → ' + shortName(state.holeMat);
    $('matTable').innerHTML = matTable();

    // Reflect the derived defaults back into the inputs, so the fields always show
    // the numbers actually being used rather than going blank. The focused field is
    // skipped: rewriting it mid-keystroke would fight the user, and would make
    // clearing a field to drop the override impossible because the derived value
    // would reappear instantly.
    setUnlessFocused('engLen', numIn(engLenMm()));
    setUnlessFocused('hubOd', numIn(hubOdMm()));
    setUnlessFocused('pinBore', numIn(pinBoreMm()));
    setUnlessFocused('fric', numIn(fricVal()));
    setUnlessFocused('nSigma', numIn(state.nSigma));

    var opts = {
      diameterMm: state.dia,
      pin: Materials.get(state.pinMat),
      hole: Materials.get(state.holeMat),
      pinBoreMm: pinBoreMm(),
      hubOuterMm: hubOdMm(),
      lengthMm: engLenMm(),
      friction: fricVal()
    };

    var wall = (hubOdMm() - state.dia) / 2;
    $('geoNote').textContent =
      'L/D ' + sig(engLenMm() / state.dia, 3) +
      ' · hub wall ' + sig(wall, 3) + ' mm' +
      ' · µ ' + numIn(fricVal()) +
      (state.fric === null ? ' (est.)' : ' (set)');

    var r;
    try {
      r = PressFit.range(stats, state.nSigma, opts);
    } catch (e) {
      $('pressOut').innerHTML = '<p class="press-warn">' + esc(e.message) + '</p>';
      $('pressMore').innerHTML = '';
      return;
    }

    var cases = [r.low, r.nominal, r.high];

    // Nothing to press: the entire +/- n sigma range falls together.
    if (!r.high.engaged) {
      $('pressOut').innerHTML =
        '<p class="press-none"><b>No interference anywhere in this range.</b> ' +
        'Even the tightest ±' + numIn(r.nSigma) + 'σ assembly clears by ' +
        sig(Math.abs(r.high.interferenceUm), 3) + ' µm, so there is no contact ' +
        'pressure, no press force and no retention. Move the hole nominal down ' +
        'to reach interference.</p>';
      $('pressMore').innerHTML =
        '<p class="fine">Forces and strain appear once the interference range ' +
        'reaches positive values. Interference is pin size − hole size.</p>';
      return;
    }

    function vals(get) { return cases.map(get); }

    /*
     * The unit goes in the row label, not a trailing column. Forces switch between
     * N and kN (and torque between N·mm and N·m) depending on magnitude, so the
     * unit has to be stated per row either way -- and stating it beside the label
     * keeps it on screen when the card is narrow, where a trailing column is the
     * first thing to get clipped.
     */
    function row(label, values, scale, cls) {
      var f = scale.f;
      return '<tr' + (cls ? ' class="' + cls + '"' : '') + '>' +
        '<th>' + label + '<i>' + scale.unit + '</i></th>' +
        '<td class="c-off">' + f(values[0]) + '</td>' +
        '<td class="c-nom">' + f(values[1]) + '</td>' +
        '<td class="c-off">' + f(values[2]) + '</td></tr>';
    }

    var plain = function (unit, n) {
      return { unit: unit, f: function (v) { return sig(v, n || 3); } };
    };

    var forceVals = vals(function (c) { return c.insertionForceN; });
    var torqueVals = vals(function (c) { return c.holdingTorqueNm; });
    var fScale = rowScale(forceVals, FORCE_LADDER);
    var tScale = rowScale(torqueVals, TORQUE_LADDER);

    var nsLabel = numIn(r.nSigma);

    var html = '<table class="press">' +
      '<colgroup><col style="width:46%"><col><col><col></colgroup>' +
      '<thead><tr><th></th>' +
      '<th>−' + nsLabel + 'σ</th><th>nominal</th><th>+' + nsLabel + 'σ</th>' +
      '</tr></thead><tbody>';

    html += row('Interference', vals(function (c) { return c.interferenceUm; }),
                plain('µm'));
    html += row('Contact pressure', vals(function (c) { return c.pressureMPa; }),
                plain('MPa'));
    html += row('Insertion force', forceVals, fScale);
    html += row('Holding force', vals(function (c) { return c.holdingForceN; }), fScale);
    html += row('Holding torque', torqueVals, tScale);

    [['pin', 'Pin'], ['hole', 'Hole']].forEach(function (part) {
      var key = part[0];
      var mat = Materials.get(key === 'pin' ? state.pinMat : state.holeMat);
      html += '<tr class="part is-' + key + '"><th colspan="4">' +
        part[1] + ' — ' + esc(mat.name) + '</th></tr>';
      html += row('Hoop strain', vals(function (c) { return c[key].microstrain; }),
                  plain('µε', 3));
      html += row('Von Mises', vals(function (c) { return c[key].vonMisesMPa; }),
                  plain('MPa'));
      var util = vals(function (c) { return c[key].yieldUtilisation * 100; });
      var over = util[2] >= 100;
      html += row('Of yield', util, plain('%'), over ? 'hi' : '');
    });

    html += '</tbody></table>';

    var yielders = [];
    ['pin', 'hole'].forEach(function (key) {
      if (r.high[key].yields) {
        yielders.push(key + ' (' + esc(Materials.get(
          key === 'pin' ? state.pinMat : state.holeMat).name) + ')');
      }
    });
    if (yielders.length) {
      html += '<p class="press-warn">At +' + nsLabel + 'σ the ' +
        yielders.join(' and ') + ' passes yield, so the elastic model ' +
        'overstates pressure and force there — the real joint deforms ' +
        'plastically instead.</p>';
    }

    if (!r.low.engaged) {
      html += '<p class="press-warn">At −' + nsLabel + 'σ the parts clear rather ' +
        'than interfere, so that column is zero: some assemblies would hold ' +
        'nothing at all.</p>';
    }

    html += '<p class="press-foot">' +
      '<span>shrink fit: hub +' + sig(r.nominal.deltaTHubC, 3) + ' °C</span>' +
      '<span>contact ' + sig(r.nominal.contactAreaMm2, 3) + ' mm²</span>' +
      '</p>';

    $('pressOut').innerHTML = html;
    $('pressMore').innerHTML = pressMore(r);
  }

  /** Second-order press-fit detail, kept out of the main card for height. */
  function pressMore(r) {
    var n = r.nominal;
    var rows = [
      ['Interface Ø', mm(n.diameterMm) + ' mm'],
      ['Engagement length', numIn(n.lengthMm) + ' mm'],
      ['Hub outer Ø', numIn(n.hubOuterMm) + ' mm'],
      ['Pin bore Ø', n.pinBoreMm ? numIn(n.pinBoreMm) + ' mm' : 'solid'],
      ['Contact area', sig(n.contactAreaMm2, 4) + ' mm²'],
      ['Friction µ', numIn(n.friction)],
      ['σ of interference', sig(r.sigmaUm, 3) + ' µm'],
      ['Pin surface moves in', sig(Math.abs(n.pin.radialDispUm), 3) + ' µm'],
      ['Hole surface moves out', sig(n.hole.radialDispUm, 3) + ' µm'],
      ['Pin yields at', sig(n.pin.yieldStrain * 1e6, 4) + ' µε'],
      ['Hole yields at', sig(n.hole.yieldStrain * 1e6, 4) + ' µε'],
      ['Hub heating to clear', sig(n.deltaTHubC, 3) + ' °C'],
      ['Hub geometry factor', sig(n.compliance.hubFactor, 4)],
      ['Pin geometry factor', sig(n.compliance.pinFactor, 4)]
    ];
    var html = '<table class="mini"><tbody>';
    rows.forEach(function (row) {
      html += '<tr><th>' + row[0] + '</th><td>' + row[1] + '</td></tr>';
    });
    html += '</tbody></table>';
    html += '<p class="fine">The two surface movements sum to half the diametral ' +
      'interference — that is the identity the model is built on, and the pin ' +
      'gives up the smaller share when it is the stiffer part.</p>';
    html += '<p class="fine"><strong>Hub heating</strong> is the shrink-fit ' +
      'alternative: warm the hub by this much and its bore opens by the full ' +
      'interference, so the pin drops in with no press force. Add margin for ' +
      'handling time, and remember the pin can be chilled instead.</p>';
    html += '<p class="fine">Insertion and holding force are equal under this ' +
      'model, both µ·p·πDL. They are listed separately because a lubricated ' +
      'insertion and a dry retention are different questions — override µ to ' +
      'explore either.</p>';
    return html;
  }

  /* ----------------------------------------------------------- pin dropdowns */

  function fillPinSelects() {
    var letters;
    try { letters = ISO286.letters(state.dia, 'shaft'); }
    catch (e) { return; }
    if (letters.indexOf(state.pinLetter) < 0) state.pinLetter = 'h';

    $('pinLetter').innerHTML = letters.map(function (l) {
      return '<option value="' + l + '"' +
        (l === state.pinLetter ? ' selected' : '') + '>' + l + '</option>';
    }).join('');

    var grades = ISO286.gradesForLetter(state.dia, state.pinLetter);
    if (grades.indexOf(state.pinGrade) < 0) state.pinGrade = grades[Math.floor(grades.length / 2)];
    $('pinGrade').innerHTML = grades.map(function (g) {
      return '<option value="' + g + '"' +
        (g === state.pinGrade ? ' selected' : '') + '>' + g + '</option>';
    }).join('');
  }

  /* --------------------------------------------------------- hole two axes */

  /**
   * Sync the two hole sliders to the current size, then resolve the class.
   * Returns { rows, index, hole } or throws.
   */
  function resolveHole(pin) {
    var grades = HoleOptions.gradesFor(state.dia);
    if (grades.indexOf(state.holeGrade) < 0) {
      // Fall back to IT6 when the held grade is gone, not to the coarsest.
      state.holeGrade = grades.indexOf('6') >= 0 ? '6' : grades[0];
    }
    var gi = grades.indexOf(state.holeGrade);
    $('gradeSlider').max = String(grades.length - 1);
    $('gradeSlider').value = String(gi);

    var rows = HoleOptions.forGrade(state.dia, state.holeGrade, pin);
    var idx = HoleOptions.indexOf(rows, state.holeLetter + state.holeGrade);
    if (idx < 0) {
      // The letter does not exist at this grade. Hold the nominal diameter as
      // close as possible instead of jumping to an arbitrary class.
      idx = HoleOptions.nearestIndex(rows, state.lastMeanDev || 0);
      state.holeLetter = rows[idx].letter;
    }
    state.lastMeanDev = rows[idx].meanDev;

    $('posSlider').max = String(rows.length - 1);
    $('posSlider').value = String(idx);

    // Paint the track so the three regions are visible before sliding into them.
    $('posTrack').innerHTML = HoleOptions.bands(rows).map(function (b) {
      var w = (b.to - b.from + 1) / rows.length * 100;
      return '<i class="b-' + b.fit + '" style="width:' + w.toFixed(3) + '%"></i>';
    }).join('');

    return { rows: rows, index: idx, hole: rows[idx].hole, row: rows[idx],
             grades: grades };
  }

  /* ----------------------------------------------------------- visualisation */

  /**
   * The drawing scale.
   *
   * Pinned to the diameter and to the user's own slider -- nothing else. It is
   * deliberately NOT reduced to make an extreme class fit: doing that reintroduced
   * the rescaling this design exists to remove, since a band far enough off basic
   * would shrink the whole drawing the moment a slider reached it. If the bands
   * overflow, the view says so and offers a factor that fits; whether the bands
   * are readable is the user's judgement, not the code's.
   */
  function exaggeration() {
    if (state.exagBasis !== state.dia) {
      var ex = HoleOptions.precisionExtremes(state.dia);
      state.exagRef = Viz.pinnedExaggeration(state.dia, ex.lo, ex.hi);
      state.exagBasis = state.dia;
    }
    return state.exagRef * Math.pow(10, (state.exagSlider - 50) / 25);
  }

  /** Slider position that yields a given factor, inverting exaggeration(). */
  function sliderFor(factor) {
    if (!state.exagRef) return state.exagSlider;
    var v = 50 + 25 * Math.log(factor / state.exagRef) / Math.LN10;
    return Math.max(0, Math.min(100, v));
  }

  function renderViz(pin, hole) {
    var diaMode = state.vizMode === 'dia';
    $('vizDia').className = diaMode ? 'on' : '';
    $('vizZone').className = diaMode ? '' : 'on';
    $('vizFoot').hidden = !diaMode;

    if (diaMode) {
      var E = exaggeration();
      $('vizHost').innerHTML = Viz.circleView({
        basic: state.dia, pin: pin, hole: hole, exaggeration: E
      });

      // Report overflow instead of preventing it.
      var of = Viz.circleOverflow(state.dia, pin, hole, E);
      state.fitTarget = of.suggested;
      $('vizAlert').hidden = !of.over;
      if (of.over) {
        var where = of.inward && of.outward ? 'past the centre and beyond the view'
                  : of.inward ? 'in past the centre'
                  : 'beyond the view';
        $('vizAlertMsg').textContent = 'Bands run ' + where +
          ' — reduce exaggeration to ×' + Math.round(of.suggested);
      }
      $('trueScaleView').innerHTML = Viz.trueScaleView({
        basic: state.dia, pin: pin, hole: hole
      });
      $('exagOut').textContent = '×' + Math.round(E);
      $('vizLegend').innerHTML =
        '<span><i class="sw sw-pin-line"></i>pin nominal</span>' +
        '<span><i class="sw sw-pin-band"></i>pin tolerance</span>' +
        '<span><i class="sw sw-hole-line"></i>hole nominal</span>' +
        '<span><i class="sw sw-hole-band"></i>hole tolerance</span>' +
        '<span><i class="sw sw-overlap"></i>overlap — fit may go either way</span>';
    } else {
      $('vizAlert').hidden = true;
      $('vizHost').innerHTML = Viz.zoneChart({
        basic: state.dia, pin: pin, hole: hole
      });
      $('vizLegend').innerHTML =
        '<span>Deviations in µm about the basic size. Dashed line is the ' +
        'nominal (mid-tolerance) diameter.</span>';
    }
  }

  /* ------------------------------------------------------------------ render */

  function render() {
    var pin;
    try {
      pin = pinLimits();
    } catch (e) {
      $('err').textContent = e.message;
      $('err').hidden = false;
      return;
    }

    fillPinSelects();
    $('pinLabel').textContent = pin.label;
    $('pinDerived').hidden = !pin.derived;
    $('pinReadout').innerHTML = readout(pin);
    $('pinMore').innerHTML = moreTable(pin);

    var h;
    try {
      h = resolveHole(pin);
    } catch (e) {
      $('err').textContent = e.message;
      $('err').hidden = false;
      return;
    }
    $('err').hidden = true;

    var hole = h.hole;
    $('holeLabel').textContent = hole.label;
    $('holePref').hidden = !h.row.preferred;
    $('holeDerived').hidden = !hole.derived;
    $('holeReadout').innerHTML = readout(hole);
    $('holeMore').innerHTML = moreTable(hole);

    $('gradeOut').textContent = 'IT' + state.holeGrade;
    $('gradeWidth').textContent = Viz.fmt(hole.toleranceUm, 1) + ' µm wide';
    $('posOut').textContent = mm(hole.mean) + ' mm';

    // If a whole fit category is unreachable at this grade, say so rather than
    // letting the user hunt along a slider for something that is not there.
    var present = {};
    h.rows.forEach(function (r) { present[r.fit] = true; });
    var missing = ['interference', 'transition', 'clearance'].filter(function (k) {
      return !present[k];
    });
    if (missing.length) {
      $('holeHint').textContent = 'No ' + missing.join(' or ') +
        ' option exists at IT' + state.holeGrade + ' with this pin — change the grade.';
      $('holeHint').hidden = false;
    } else {
      $('holeHint').hidden = true;
    }

    var stats = Fits.rss(pin, hole, rssOpts());
    var wc = stats.worstCase;

    $('fitBadge').className = 'fit-badge is-' + wc.fit;
    $('fitBadge').textContent = Fits.FIT_INFO[wc.fit].name;
    var word = wc.mean >= 0 ? 'interference' : 'clearance';
    $('fitNum').innerHTML = 'nominal ' + word + ' <span class="n">' +
      Viz.fmt(Math.abs(wc.mean), 1) + ' µm</span>, from <span class="n">' +
      um(wc.min) + '</span> to <span class="n">' + um(wc.max) + ' µm</span>';
    $('fitRss').textContent = pct(stats.pInterference) + ' interference';

    renderViz(pin, hole);
    $('bellCurve').innerHTML = Viz.bellCurve(stats);

    $('rssTable').innerHTML =
      '<table class="mini"><tbody>' +
      '<tr><th>Worst case</th><td>' + um(wc.min) + ' … ' + um(wc.max) + ' µm</td></tr>' +
      '<tr><th>±' + Viz.fmt(stats.k, 1) + 'σ (RSS)</th><td>' +
        um(stats.min) + ' … ' + um(stats.max) + ' µm</td></tr>' +
      '<tr><th>σ pin / σ hole</th><td>' + Viz.fmt(stats.sigmaPin, 2) + ' / ' +
        Viz.fmt(stats.sigmaHole, 2) + ' µm</td></tr>' +
      '<tr><th>σ interference</th><td>' + Viz.fmt(stats.sigma, 2) + ' µm</td></tr>' +
      '<tr><th>Interference / clearance</th><td>' + pct(stats.pInterference) +
        ' / ' + pct(stats.pClearance) + '</td></tr>' +
      '<tr><th>Over ' + um(state.target) + ' µm</th><td>' +
        pct(stats.fractionAbove(state.target)) + '</td></tr>' +
      '</tbody></table>';
    $('kEcho').textContent = Viz.fmt(stats.k, 1);

    fillMatSelects();
    renderPress(stats);

    syncHash();
  }

  /* --------------------------------------------------------------- URL state */

  function syncHash() {
    var p = ['d=' + state.dia];
    if (state.useCustom) p.push('cu=' + state.customUpper, 'cl=' + state.customLower);
    else p.push('pin=' + state.pinLetter + state.pinGrade);
    p.push('hole=' + state.holeLetter + state.holeGrade);
    if (state.k !== 3) p.push('k=' + state.k);
    if (state.shift !== 0) p.push('s=' + state.shift);
    if (state.vizMode !== 'dia') p.push('v=' + state.vizMode);
    // Press-fit state. Only overrides travel in the hash: a null geometry field
    // means "track the diameter", and baking its current derived value into the
    // URL would freeze it for whoever opened the link.
    p.push('pm=' + state.pinMat, 'hm=' + state.holeMat);
    if (state.engLen !== null) p.push('L=' + state.engLen);
    if (state.hubOd !== null) p.push('od=' + state.hubOd);
    if (state.pinBore !== null) p.push('bore=' + state.pinBore);
    if (state.fric !== null) p.push('mu=' + state.fric);
    if (state.nSigma !== 1) p.push('ns=' + state.nSigma);
    history.replaceState(null, '', '#' + p.join('&'));
  }

  function readHash() {
    var h = location.hash.replace(/^#/, '');
    if (!h) return;
    var q = {};
    h.split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i > 0) q[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1));
    });
    if (q.d) state.dia = parseFloat(q.d);
    if (q.pin) {
      try {
        var p = ISO286.parseClass(q.pin);
        state.pinLetter = p.letter; state.pinGrade = p.grade;
      } catch (e) { /* keep defaults */ }
    }
    if (q.hole) {
      try {
        var hh = ISO286.parseClass(q.hole);
        state.holeLetter = hh.letter; state.holeGrade = hh.grade;
      } catch (e) { /* keep defaults */ }
    }
    if (q.k) state.k = parseFloat(q.k);
    if (q.s) state.shift = parseFloat(q.s);
    if (q.v) state.vizMode = q.v;
    if (q.cu !== undefined && q.cl !== undefined) {
      state.useCustom = true;
      state.customUpper = parseFloat(q.cu);
      state.customLower = parseFloat(q.cl);
    }
    if (q.pm && Materials.has(q.pm)) state.pinMat = q.pm;
    if (q.hm && Materials.has(q.hm)) state.holeMat = q.hm;
    // A geometry override only counts if it parses; anything else stays null so
    // the field keeps tracking the diameter.
    [['L', 'engLen'], ['od', 'hubOd'], ['bore', 'pinBore'], ['mu', 'fric']]
      .forEach(function (pair) {
        if (q[pair[0]] === undefined) return;
        var v = parseFloat(q[pair[0]]);
        if (isFinite(v) && v >= 0) state[pair[1]] = v;
      });
    if (q.ns !== undefined) {
      var ns = parseFloat(q.ns);
      if (isFinite(ns) && ns >= 0) state.nSigma = ns;
    }

    $('dia').value = state.dia;
    $('exag').value = String(state.exagSlider);
    $('kSel').value = String(state.k);
    $('shift').value = state.shift;
    $('useCustom').checked = state.useCustom;
    $('customUpper').value = state.customUpper;
    $('customLower').value = state.customLower;
  }

  /* ------------------------------------------------------------------ events */

  function num(el, fallback) {
    var v = parseFloat(el.value);
    return isFinite(v) ? v : fallback;
  }

  function wire() {
    $('dia').addEventListener('input', function () {
      state.dia = num($('dia'), state.dia);
      render();
    });
    $('pinLetter').addEventListener('change', function () {
      state.pinLetter = $('pinLetter').value;
      render();
    });
    $('pinGrade').addEventListener('change', function () {
      state.pinGrade = $('pinGrade').value;
      render();
    });

    $('gradeSlider').addEventListener('input', function () {
      var grades = HoleOptions.gradesFor(state.dia);
      state.holeGrade = grades[parseInt($('gradeSlider').value, 10)];
      render();
    });
    $('posSlider').addEventListener('input', function () {
      var rows = HoleOptions.forGrade(state.dia, state.holeGrade, null);
      var i = parseInt($('posSlider').value, 10);
      if (rows[i]) {
        state.holeLetter = rows[i].letter;
        state.lastMeanDev = rows[i].meanDev;
      }
      render();
    });

    $('vizDia').addEventListener('click', function () {
      state.vizMode = 'dia'; render();
    });
    $('vizZone').addEventListener('click', function () {
      state.vizMode = 'zone'; render();
    });
    $('exag').addEventListener('input', function () {
      state.exagSlider = parseFloat($('exag').value);
      render();
    });
    $('vizFit').addEventListener('click', function () {
      if (!state.fitTarget) return;
      state.exagSlider = sliderFor(state.fitTarget);
      $('exag').value = String(state.exagSlider);
      render();
    });

    $('useCustom').addEventListener('change', function () {
      state.useCustom = $('useCustom').checked;
      render();
    });
    ['customUpper', 'customLower'].forEach(function (id) {
      $(id).addEventListener('input', function () {
        state.customUpper = num($('customUpper'), state.customUpper);
        state.customLower = num($('customLower'), state.customLower);
        if (state.useCustom) render();
      });
    });
    $('kSel').addEventListener('change', function () {
      state.k = parseFloat($('kSel').value); render();
    });
    $('shift').addEventListener('input', function () {
      state.shift = num($('shift'), 0); render();
    });
    $('target').addEventListener('input', function () {
      state.target = num($('target'), 0); render();
    });

    /* ------------------------------------------------------------- press fit */

    $('pinMat').addEventListener('change', function () {
      state.pinMat = $('pinMat').value; render();
    });
    $('holeMat').addEventListener('change', function () {
      state.holeMat = $('holeMat').value; render();
    });

    /*
     * Geometry fields hold null until touched, which is what makes them follow the
     * diameter. Clearing a field puts it back to null rather than to zero, so
     * "undo my override" is just selecting the text and deleting it.
     */
    [['engLen', 'engLen'], ['hubOd', 'hubOd'], ['pinBore', 'pinBore'],
     ['fric', 'fric']].forEach(function (pair) {
      var id = pair[0], key = pair[1];
      $(id).addEventListener('input', function () {
        var raw = $(id).value.trim();
        if (raw === '') {
          state[key] = null;
        } else {
          var v = parseFloat(raw);
          // Ignore an unparseable or negative entry rather than rendering NaN;
          // the field keeps whatever the user typed until it becomes valid.
          if (!isFinite(v) || v < 0) return;
          state[key] = v;
        }
        render();
      });
    });

    $('nSigma').addEventListener('input', function () {
      var v = parseFloat($('nSigma').value);
      if (!isFinite(v) || v < 0) return;
      state.nSigma = v;
      render();
    });
  }

  readHash();
  wire();
  render();
})();
