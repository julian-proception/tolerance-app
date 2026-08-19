/*
 * app.js — state, rendering and event wiring.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var state = {
    dia: 3, pinClass: 'm6', holeClass: 'JS6',
    useCustom: false, customUpper: 8, customLower: 2,
    k: 3, shift: 0, target: 0, exagSlider: 50
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
    return (v * 100).toFixed(v > 0.01 && v < 0.99 ? 1 : 3) + '%';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---------------------------------------------------------- limits objects */

  /** Pin limits, either from the ISO class or from custom deviations. */
  function pinLimits() {
    if (state.useCustom) {
      var up = state.customUpper, lo = state.customLower;
      if (!(up >= lo)) throw new Error('The upper deviation must be at least the lower deviation.');
      var d = state.dia;
      return {
        basic: d, min: d + lo / 1000, max: d + up / 1000,
        mean: d + (up + lo) / 2000,
        tolerance: (up - lo) / 1000, toleranceUm: up - lo,
        upper: up, lower: lo, label: 'custom', kind: 'shaft',
        grade: null, letter: null, it: null
      };
    }
    return ISO286.limits(state.dia, state.pinClass);
  }

  function holeLimits() { return ISO286.limits(state.dia, state.holeClass); }

  function rssOpts() { return { k: state.k, meanShift: state.shift }; }

  /* --------------------------------------------------------------- rendering */

  function summaryHtml(lim) {
    var name = lim.label === 'custom' ? 'custom' : lim.label;
    return '<span><b>' + esc(name) + '</b></span>' +
      '<span>' + um(lim.upper) + ' / ' + um(lim.lower) + ' µm</span>' +
      '<span>' + mm(lim.min) + ' – ' + mm(lim.max) + ' mm</span>' +
      '<span>mean <b>' + mm(lim.mean) + '</b></span>' +
      '<span>T ' + Viz.fmt(lim.toleranceUm, 1) + ' µm</span>';
  }

  function limitTable(lim, which) {
    var cls = which === 'pin' ? 't-pin' : 't-hole';
    var rows = [
      ['Tolerance class', esc(lim.label)],
      ['IT grade', lim.grade ? ('IT' + lim.grade + ' = ' + Viz.fmt(lim.it, 1) + ' µm') : '—'],
      ['Upper deviation', um(lim.upper) + ' µm'],
      ['Lower deviation', um(lim.lower) + ' µm'],
      ['Basic size', mm(lim.basic) + ' mm'],
      ['Mean size', mm(lim.mean) + ' mm', true],
      ['Minimum size', mm(lim.min) + ' mm'],
      ['Maximum size', mm(lim.max) + ' mm'],
      ['Tolerance width', Viz.fmt(lim.toleranceUm, 1) + ' µm']
    ];
    var hint = lim.grade ? Fits.processHint(lim.grade) : '';
    var html = '<table class="t ' + cls + '"><caption>' +
      (which === 'pin' ? 'Pin (shaft)' : 'Hole') + '</caption><tbody>';
    rows.forEach(function (r) {
      html += '<tr' + (r[2] ? ' class="hi"' : '') + '><th>' + r[0] + '</th><td>' + r[1] + '</td></tr>';
    });
    if (hint) {
      html += '<tr><th>Typically held by</th><td class="wide">' + esc(hint) + '</td></tr>';
    }
    html += '</tbody></table>';
    return html;
  }

  /** Phrase the interference the way the brief asks for it. */
  function describe(wc) {
    var meanWord = wc.mean >= 0 ? 'interference' : 'clearance';
    var meanVal = Viz.fmt(Math.abs(wc.mean), 1);
    var parts = 'Nominal ' + meanWord + ' <span class="n">' + meanVal + ' µm</span>';

    var maxTxt, minTxt;
    if (wc.max >= 0) {
      maxTxt = 'as much as <span class="n">' + Viz.fmt(wc.max, 1) + ' µm</span> interference';
    } else {
      maxTxt = 'at tightest still <span class="n">' + Viz.fmt(-wc.max, 1) + ' µm</span> clearance';
    }
    if (wc.min >= 0) {
      minTxt = 'and as little as <span class="n">' + Viz.fmt(wc.min, 1) + ' µm</span>';
    } else {
      minTxt = 'and as little as <span class="n">' + um(wc.min) +
               ' µm</span> — that is <span class="n">' + Viz.fmt(-wc.min, 1) +
               ' µm</span> of clearance';
    }
    return parts + ' — ' + maxTxt + ', ' + minTxt + '.';
  }

  function renderLadder(pin) {
    var groups;
    try {
      groups = Suggest.ladder(state.dia, pin, rssOpts());
    } catch (e) {
      $('ladder').innerHTML = '<p class="grp-empty">' + esc(e.message) + '</p>';
      return;
    }
    var order = [
      ['interference', 'Interference'],
      ['transition', 'Transition'],
      ['clearance', 'Clearance']
    ];
    var html = '';
    order.forEach(function (o) {
      var key = o[0], g = groups[key];
      html += '<div class="grp grp-' + key + '"><div class="grp-head">' + o[1] +
              '<span class="count">' + g.total + '</span></div>';
      if (!g.rows.length) {
        html += '<p class="grp-empty">No hole class in the evaluated set gives a ' +
                key + ' fit with this pin.</p>';
      }
      g.rows.forEach(function (r) {
        if (r.skippedBefore) {
          html += '<p class="grp-more">⋯ ' + r.skippedBefore + ' looser ' +
                  (r.skippedBefore === 1 ? 'class' : 'classes') + ' between</p>';
        }
        var sel = (r.label === state.holeClass) ? ' is-sel' : '';
        html += '<button type="button" class="row' + sel + '" data-cls="' + esc(r.label) + '">' +
          '<span class="row-cls">' + esc(r.label) +
          (r.preferred ? '<span class="badge">preferred</span>' : '') + '</span>' +
          '<span class="row-num">' + um(r.wc.mean) + ' µm nom.</span>' +
          '<span class="row-sub">' + um(r.wc.min) + ' … ' + um(r.wc.max) +
          ' µm · ' + pct(r.rss.pInterference) + ' interference</span>' +
          '</button>';
      });
      if (g.hidden > 0) {
        html += '<p class="grp-more">' + g.hidden + ' of ' + g.total +
                ' not shown; the tightest and loosest are kept.</p>';
      }
      html += '</div>';
    });
    $('ladder').innerHTML = html;

    Array.prototype.forEach.call($('ladder').querySelectorAll('.row'), function (b) {
      b.addEventListener('click', function () {
        state.holeClass = b.getAttribute('data-cls');
        $('holeClass').value = state.holeClass;
        render();
      });
    });
  }

  function statsTable(stats) {
    var wc = stats.worstCase;
    var html = '<table class="t"><caption>Worst case (arithmetic)</caption><tbody>' +
      '<tr><th>Maximum interference</th><td>' + um(wc.max) + ' µm</td></tr>' +
      '<tr class="hi"><th>Nominal interference</th><td>' + um(wc.mean) + ' µm</td></tr>' +
      '<tr><th>Minimum interference</th><td>' + um(wc.min) + ' µm</td></tr>' +
      '<tr><th>Total spread</th><td>' + Viz.fmt(wc.spread, 1) + ' µm</td></tr>' +
      '</tbody></table>';

    html += '<table class="t"><caption>RSS statistical</caption><tbody>' +
      '<tr><th>σ pin</th><td>' + Viz.fmt(stats.sigmaPin, 2) + ' µm</td></tr>' +
      '<tr><th>σ hole</th><td>' + Viz.fmt(stats.sigmaHole, 2) + ' µm</td></tr>' +
      '<tr class="hi"><th>σ interference (RSS)</th><td>' + Viz.fmt(stats.sigma, 2) + ' µm</td></tr>' +
      '<tr><th>Mean interference</th><td>' + um(stats.mean) + ' µm</td></tr>' +
      '<tr class="hi"><th>±' + Viz.fmt(stats.k, 1) + 'σ range</th><td>' +
        um(stats.min) + ' … ' + um(stats.max) + ' µm</td></tr>' +
      '<tr><th>RSS half-width</th><td>' + Viz.fmt(stats.halfWidth, 2) + ' µm</td></tr>' +
      '</tbody></table>';

    html += '<table class="t"><caption>Predicted outcome</caption><tbody>' +
      '<tr class="hi"><th>Assemblies with interference</th><td>' +
        pct(stats.pInterference) + '</td></tr>' +
      '<tr><th>Assemblies with clearance</th><td>' + pct(stats.pClearance) + '</td></tr>' +
      '<tr><th>Fit category</th><td class="wide">' +
        Fits.FIT_INFO[wc.fit].name + '</td></tr>' +
      '</tbody></table>';
    return html;
  }

  function render() {
    var err = $('inputError');
    var pin, hole;

    // The pin is required for everything below it.
    try {
      pin = pinLimits();
    } catch (e) {
      err.textContent = e.message;
      err.hidden = false;
      $('pinSummary').innerHTML = '<span class="muted">—</span>';
      $('ladder').innerHTML = '';
      return;
    }
    err.hidden = true;
    $('pinSummary').innerHTML = summaryHtml(pin);

    renderLadder(pin);

    // The hole may be invalid on its own without invalidating the ladder.
    try {
      hole = holeLimits();
    } catch (e) {
      err.textContent = e.message;
      err.hidden = false;
      $('holeSummary').innerHTML = '<span class="muted">—</span>';
      $('fitHeadline').innerHTML = '';
      $('fitTables').innerHTML = '';
      $('statsTable').innerHTML = '';
      $('bellCurve').innerHTML = '';
      $('circleView').innerHTML = Viz.circleView({
        basic: state.dia, pin: pin, hole: null,
        exaggeration: exaggeration(pin, null)
      });
      $('zoneChart').innerHTML = Viz.zoneChart({ basic: state.dia, pin: pin, hole: null });
      return;
    }
    $('holeSummary').innerHTML = summaryHtml(hole);

    var stats = Fits.rss(pin, hole, rssOpts());
    var wc = stats.worstCase;

    $('fitHeadline').className = 'headline is-' + wc.fit;
    $('fitHeadline').innerHTML =
      '<p class="headline-fit">' + Fits.FIT_INFO[wc.fit].name + ' fit — hole ' +
        esc(hole.label) + ' on pin ' + esc(pin.label) + '</p>' +
      '<p class="headline-main">' + describe(wc) + '</p>' +
      '<p class="headline-blurb">' + Fits.FIT_INFO[wc.fit].blurb + '</p>';

    $('fitTables').innerHTML = limitTable(pin, 'pin') + limitTable(hole, 'hole');

    var E = exaggeration(pin, hole);
    $('circleView').innerHTML = Viz.circleView({
      basic: state.dia, pin: pin, hole: hole, exaggeration: E
    });
    $('trueScaleView').innerHTML = Viz.trueScaleView({
      basic: state.dia, pin: pin, hole: hole
    });
    $('exagOut').textContent = '×' + Math.round(E);
    $('zoneChart').innerHTML = Viz.zoneChart({ basic: state.dia, pin: pin, hole: hole });

    $('statsTable').innerHTML = statsTable(stats);
    $('bellCurve').innerHTML = Viz.bellCurve(stats);
    $('kEcho').textContent = Viz.fmt(stats.k, 1);

    var frac = stats.fractionAbove(state.target);
    $('targetOut').innerHTML =
      '<span><b>' + pct(frac) + '</b> of assemblies exceed ' +
      um(state.target) + ' µm interference</span>';

    syncHash();
  }

  /**
   * Slider maps to a multiple of the auto-chosen factor, two decades either way,
   * with 50 sitting on the auto value.
   */
  function exaggeration(pin, hole) {
    var auto = Viz.autoExaggeration(state.dia, pin, hole || pin);
    var mult = Math.pow(10, (state.exagSlider - 50) / 25);
    return Math.max(1, auto * mult);
  }

  /* --------------------------------------------------------------- datalists */

  function fillDatalists() {
    try {
      var pins = ISO286.availableClasses(state.dia, 'shaft');
      var holes = ISO286.availableClasses(state.dia, 'hole');
      $('pinClasses').innerHTML = pins.map(function (c) {
        return '<option value="' + c + '">';
      }).join('');
      $('holeClasses').innerHTML = holes.map(function (c) {
        return '<option value="' + c + '">';
      }).join('');
    } catch (e) { /* invalid diameter -- render() reports it */ }
  }

  /* --------------------------------------------------------------- URL state */

  function syncHash() {
    var p = ['d=' + state.dia];
    if (state.useCustom) {
      p.push('cu=' + state.customUpper, 'cl=' + state.customLower);
    } else {
      p.push('pin=' + state.pinClass);
    }
    p.push('hole=' + state.holeClass);
    if (state.k !== 3) p.push('k=' + state.k);
    if (state.shift !== 0) p.push('s=' + state.shift);
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
    if (q.pin) state.pinClass = q.pin;
    if (q.hole) state.holeClass = q.hole;
    if (q.k) state.k = parseFloat(q.k);
    if (q.s) state.shift = parseFloat(q.s);
    if (q.cu !== undefined && q.cl !== undefined) {
      state.useCustom = true;
      state.customUpper = parseFloat(q.cu);
      state.customLower = parseFloat(q.cl);
    }
    $('dia').value = state.dia;
    $('pinClass').value = state.pinClass;
    $('holeClass').value = state.holeClass;
    $('kSel').value = String(state.k);
    $('shift').value = state.shift;
    $('useCustom').checked = state.useCustom;
    $('customUpper').value = state.customUpper;
    $('customLower').value = state.customLower;
    if (state.useCustom) $('customBox').open = true;
  }

  /* ------------------------------------------------------------------ events */

  function num(el, fallback) {
    var v = parseFloat(el.value);
    return isFinite(v) ? v : fallback;
  }

  function wire() {
    $('dia').addEventListener('input', function () {
      state.dia = num($('dia'), state.dia);
      fillDatalists();
      render();
    });
    $('pinClass').addEventListener('input', function () {
      state.pinClass = $('pinClass').value.trim();
      render();
    });
    $('holeClass').addEventListener('input', function () {
      state.holeClass = $('holeClass').value.trim();
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
      state.k = parseFloat($('kSel').value);
      render();
    });
    $('shift').addEventListener('input', function () {
      state.shift = num($('shift'), 0);
      render();
    });
    $('target').addEventListener('input', function () {
      state.target = num($('target'), 0);
      render();
    });
    $('exag').addEventListener('input', function () {
      state.exagSlider = parseFloat($('exag').value);
      render();
    });
  }

  readHash();
  fillDatalists();
  wire();
  render();
})();
