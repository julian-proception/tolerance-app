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
    exagRef: null, exagBasis: null   // pinned factor and the diameter it belongs to
  };

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
  }

  readHash();
  wire();
  render();
})();
