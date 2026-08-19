/*
 * run-verify.js — headless test run via macOS JavaScriptCore.
 *
 *   ./tools/verify.sh          (from the project root)
 *
 * Runs the same suite as verify.html, plus a stub-DOM smoke test of app.js that a
 * browser-free environment could not otherwise cover.
 */
load('js/iso286.js');
load('js/fits.js');
load('js/suggest.js');
load('js/viz.js');
load('js/verify-cases.js');
load('js/verify-run.js');

var result = VerifyRun.run();

/* -------------------------------------------------------- stub-DOM smoke test */
/*
 * app.js only touches the DOM through getElementById, so a stub that knows which
 * ids index.html actually declares is enough to catch the failure this project is
 * most exposed to: app.js reaching for an element the HTML does not define. That
 * matters more since the UI rewrite, where every id changed at once.
 */
(function smokeTestApp() {
  var g = { name: 'app.js against a stub DOM', rows: [] };
  result.groups.push(g);
  function ok(cond, what, got, want) {
    if (cond) result.pass++; else result.fail++;
    g.rows.push({ ok: !!cond, what: what, got: String(got), want: String(want), src: '' });
  }

  var html = read('index.html');
  var declared = {};
  var re = /id="([^"]+)"/g, m;
  while ((m = re.exec(html))) declared[m[1]] = true;

  var missing = [], els = {};
  function makeEl(id) {
    return {
      id: id, innerHTML: '', textContent: '', value: '', checked: false,
      className: '', open: false, hidden: false, max: '', min: '', step: '',
      _on: {},
      addEventListener: function (type, fn) {
        (this._on[type] = this._on[type] || []).push(fn);
      },
      querySelectorAll: function () { return []; },
      getAttribute: function () { return null; },
      setAttribute: function () {}
    };
  }
  this.document = {
    getElementById: function (id) {
      if (!declared[id] && missing.indexOf(id) < 0) missing.push(id);
      if (!els[id]) els[id] = makeEl(id);
      return els[id];
    }
  };
  this.location = { hash: '' };
  this.history = { replaceState: function () {} };

  var threw = null;
  try { load('js/app.js'); } catch (e) { threw = e; }

  ok(!threw, 'app.js initialises without throwing',
     threw ? String(threw) : 'no exception', 'no exception');
  ok(missing.length === 0, 'every element app.js reaches for exists in index.html',
     missing.length ? 'MISSING: ' + missing.join(', ') : 'all present', 'all present');

  function txt(id) { return (els[id] || {}).textContent || ''; }
  function html_(id) { return (els[id] || {}).innerHTML || ''; }

  // Defaults are 3 mm m6 against JS6 -- the brief's worked example.
  ok(txt('pinLabel') === 'm6', 'pin resolves to m6 from the two dropdowns',
     txt('pinLabel') || 'empty', 'm6');
  ok(txt('holeLabel') === 'JS6', 'the two sliders resolve to hole JS6',
     txt('holeLabel') || 'empty', 'JS6');
  ok(txt('gradeOut') === 'IT6', 'grade axis reads IT6', txt('gradeOut') || 'empty', 'IT6');
  ok(txt('posOut') === '3.0000 mm', 'position axis reads the nominal diameter',
     txt('posOut') || 'empty', '3.0000 mm');
  ok(txt('gradeWidth') === '6 µm wide', 'grade axis states the band width',
     txt('gradeWidth') || 'empty', '6 µm wide');

  ok(txt('fitBadge') === 'Transition', 'fit is reported as a transition',
     txt('fitBadge') || 'empty', 'Transition');
  var fn = html_('fitNum');
  ok(/5 µm/.test(fn), 'fit line states 5 um nominal interference',
     /5 µm/.test(fn) ? 'present' : fn.slice(0, 80), 'present');
  ok(/−1/.test(fn) && /\+11/.test(fn), 'fit line states the -1 to +11 um range',
     /−1/.test(fn) && /\+11/.test(fn) ? 'present' : fn.slice(0, 110), 'present');
  ok(/99\.98/.test(txt('fitRss')), 'fit line states the RSS interference share',
     txt('fitRss') || 'empty', 'about 99.98%');

  // The painted track must actually be emitted, with widths that sum to ~100%.
  var track = html_('posTrack');
  var widths = [], reW = /width:([\d.]+)%/g, mw;
  while ((mw = reW.exec(track))) widths.push(parseFloat(mw[1]));
  var total = widths.reduce(function (a, b) { return a + b; }, 0);
  ok(widths.length > 0, 'the position track paints at least one fit band',
     widths.length + ' bands', 'more than 0');
  ok(Math.abs(total - 100) < 0.01, 'track band widths sum to 100%',
     total.toFixed(3) + '%', '100%');
  ok(/b-interference|b-transition|b-clearance/.test(track),
     'track bands carry a fit-category class', 'classed', 'classed');

  ['pinReadout', 'holeReadout', 'pinMore', 'holeMore', 'vizHost', 'bellCurve',
   'rssTable', 'trueScaleView', 'vizLegend'].forEach(function (id) {
    ok(html_(id).length > 0, '#' + id + ' is populated on first render',
       html_(id).length + ' chars', 'more than 0 chars');
  });

  // Readouts must show the three diameters the feedback asked for, and nothing
  // in the rendered markup may be NaN.
  var pr = html_('pinReadout');
  ok(/3\.0080/.test(pr) && /3\.0050/.test(pr) && /3\.0020/.test(pr),
     'pin readout shows max, nominal and min diameter',
     /3\.0080/.test(pr) && /3\.0050/.test(pr) && /3\.0020/.test(pr)
       ? 'all three' : pr.slice(0, 120), 'all three');
  var hr = html_('holeReadout');
  ok(/3\.0030/.test(hr) && /3\.0000/.test(hr) && /2\.9970/.test(hr),
     'hole readout shows max, nominal and min diameter',
     /3\.0030/.test(hr) && /3\.0000/.test(hr) && /2\.9970/.test(hr)
       ? 'all three' : hr.slice(0, 120), 'all three');

  var all = pr + hr + fn + track + html_('vizHost') + html_('rssTable') +
            html_('bellCurve') + html_('pinMore') + html_('holeMore');
  ok(!/NaN|undefined/.test(all), 'rendered markup contains no NaN or undefined',
     /NaN|undefined/.test(all) ? 'FOUND' : 'clean', 'clean');

  // The diameters view is the default, per the UI feedback.
  ok(els.vizDia && els.vizDia.className === 'on',
     'the diameters view is selected by default',
     (els.vizDia || {}).className || 'empty', 'on');
  ok(els.vizZone && els.vizZone.className !== 'on',
     'the zones view is not selected by default',
     (els.vizZone || {}).className || 'empty', 'not on');
  ok(/<svg/.test(html_('vizHost')) && /circle/.test(html_('vizHost')),
     'the default view renders the circle visualisation', 'circles', 'circles');

  /* ------------------------------------------------------- interaction pass */
  /*
   * First render alone proves very little about a slider-driven UI. Firing the
   * real handlers is the only way, short of a browser, to catch a controller that
   * throws on the second interaction or leaves the two axes inconsistent.
   */
  function fire(id, type) {
    var el = els[id];
    if (!el || !el._on[type]) return false;
    el._on[type].forEach(function (fn) { fn.call(el, { target: el }); });
    return true;
  }
  var ig = { name: 'app.js interaction pass', rows: [] };
  result.groups.push(ig);
  function iok(cond, what, got, want) {
    if (cond) result.pass++; else result.fail++;
    ig.rows.push({ ok: !!cond, what: what, got: String(got), want: String(want), src: '' });
  }
  function attempt(label, fn) {
    try { fn(); return null; } catch (e) { iok(false, label, String(e), 'no exception'); return e; }
  }

  // 1. change the diameter
  attempt('changing diameter to 25 mm', function () {
    els.dia.value = '25';
    iok(fire('dia', 'input'), 'diameter input has a handler bound', 'bound', 'bound');
    iok(/25\.0/.test(txt('posOut')) || /24\.9/.test(txt('posOut')),
        'position readout follows the diameter to 25 mm',
        txt('posOut'), 'about 25 mm');
    iok(!/NaN/.test(html_('vizHost') + html_('bellCurve')),
        'no NaN after the diameter change', 'clean', 'clean');
  });

  // 2. walk the whole position axis; nominal diameter must rise monotonically
  attempt('walking the position axis', function () {
    var maxIdx = parseInt(els.posSlider.max, 10);
    iok(maxIdx > 0, 'position slider spans more than one class',
        '0..' + maxIdx, 'more than one');
    var noms = [], labels = [], fits = [], exags = [];
    for (var i = 0; i <= maxIdx; i++) {
      els.posSlider.value = String(i);
      fire('posSlider', 'input');
      noms.push(parseFloat(txt('posOut')));
      labels.push(txt('holeLabel'));
      fits.push(txt('fitBadge'));
      exags.push(txt('exagOut'));
    }
    // The drawing scale must hold still while the slider moves, or the circles
    // shift under the cursor and cannot be compared position to position.
    var modal = {}, best = '', bestN = 0;
    exags.forEach(function (v) {
      modal[v] = (modal[v] || 0) + 1;
      if (modal[v] > bestN) { bestN = modal[v]; best = v; }
    });
    iok(bestN === exags.length,
        'exaggeration holds steady while the position slider moves',
        bestN + ' of ' + exags.length + ' steps at ' + best +
          (bestN < exags.length ? ' (others: ' +
            exags.filter(function (v) { return v !== best; }).join(', ') + ')' : ''),
        'every step identical');
    var rising = true;
    for (var j = 1; j < noms.length; j++) if (noms[j] < noms[j - 1] - 1e-9) rising = false;
    iok(rising, 'nominal diameter rises monotonically along the position slider',
        noms[0] + ' -> ' + noms[noms.length - 1] + ' mm', 'ascending');
    var uniq = {};
    labels.forEach(function (l) { uniq[l] = true; });
    iok(Object.keys(uniq).length === labels.length,
        'every slider position resolves to a distinct ISO class',
        Object.keys(uniq).length + ' of ' + labels.length, 'all distinct');
    /*
     * A single grade does not necessarily span all three categories: at IT6 an m6
     * pin cannot reach clearance at any diameter, because even the loosest grade-6
     * hole (F6) still overlaps it -- clearance needs E8 or looser. That is a real
     * property of ISO 286, so the requirement is that the axis is ordered
     * loosest-last AND that the UI says which category is out of reach.
     */
    var uniqFits = [];
    fits.forEach(function (f) { if (uniqFits.indexOf(f) < 0) uniqFits.push(f); });
    iok(fits[0] === 'Interference',
        'the tight end of the axis is the interference end',
        fits[0], 'Interference');
    iok(uniqFits.length >= 2, 'the axis spans at least two fit categories',
        uniqFits.join(' -> '), 'two or more');
    var reachable = {};
    HoleOptions.gradesFor(25).forEach(function (gr) {
      HoleOptions.forGrade(25, gr, ISO286.limits(25, 'm6')).forEach(function (r) {
        reachable[r.fit] = true;
      });
    });
    iok(reachable.interference && reachable.transition && reachable.clearance,
        'all three categories are reachable at 25 mm across the grade axis',
        Object.keys(reachable).join(', '), 'all three');
    // And when one is out of reach at the current grade, the UI must say so
    // rather than leaving the user hunting along a slider.
    /*
     * With the full letter catalogue nearly every category is reachable at every
     * grade, so the hint rarely fires. What must hold is that it is CORRECT: shown
     * only when a category really is missing, hidden only when all three exist.
     */
    var hintShown = els.holeHint && els.holeHint.hidden === false;
    var hintText = (els.holeHint || {}).textContent || '';
    var reachHere = {};
    HoleOptions.forGrade(25, '6', ISO286.limits(25, 'm6')).forEach(function (r2) {
      reachHere[r2.fit] = true;
    });
    var allThree = reachHere.interference && reachHere.transition && reachHere.clearance;
    iok(hintShown === !allThree,
        'the unreachable-category hint agrees with what the axis actually offers',
        (hintShown ? 'shown: ' + hintText : 'hidden') +
          ' / axis has ' + Object.keys(reachHere).sort().join('+'),
        allThree ? 'hidden' : 'shown');
  });

  // 3. change grade; the position must be held near the same nominal diameter
  attempt('changing the tolerance grade', function () {
    els.posSlider.value = String(Math.floor(parseInt(els.posSlider.max, 10) / 2));
    fire('posSlider', 'input');
    var before = parseFloat(txt('posOut'));
    var exagBeforeGrade = txt('exagOut');
    var gmax = parseInt(els.gradeSlider.max, 10);
    var gi = Math.min(gmax, parseInt(els.gradeSlider.value, 10) + 1);
    els.gradeSlider.value = String(gi);
    fire('gradeSlider', 'input');
    var after = parseFloat(txt('posOut'));
    iok(Math.abs(after - before) < 0.02,
        'changing grade holds the nominal diameter rather than jumping',
        before.toFixed(4) + ' -> ' + after.toFixed(4) + ' mm', 'within 0.02 mm');
    iok(/^IT\d+$/.test(txt('gradeOut')), 'grade readout still reads as an IT class',
        txt('gradeOut'), 'IT<n>');
    iok(txt('exagOut') === exagBeforeGrade,
        'exaggeration is unchanged by a grade change too',
        exagBeforeGrade + ' -> ' + txt('exagOut'), 'unchanged');
    iok(!/NaN/.test(html_('holeReadout')), 'no NaN after the grade change',
        'clean', 'clean');
  });

  // 4. sweep every grade at this diameter
  attempt('sweeping every grade', function () {
    var gmax = parseInt(els.gradeSlider.max, 10), bad = [];
    for (var i = 0; i <= gmax; i++) {
      els.gradeSlider.value = String(i);
      fire('gradeSlider', 'input');
      var blob = html_('holeReadout') + html_('vizHost') + html_('bellCurve') +
                 html_('posTrack');
      if (/NaN|undefined|Infinity/.test(blob)) bad.push(txt('gradeOut'));
      if (!/^\d+\.\d{4} mm$/.test(txt('posOut'))) bad.push(txt('gradeOut') + ' readout');
    }
    iok(bad.length === 0, 'every grade renders cleanly at 25 mm',
        bad.length ? bad.join(', ') : 'all ' + (gmax + 1) + ' grades clean', 'clean');
  });

  // 4b. the drawing factor must not move for ANY grade, coarse ones included --
  //     this is the property the whole pinned-factor design exists to provide,
  //     and only the real render path can demonstrate it.
  attempt('holding the factor across every grade', function () {
    var gmax = parseInt(els.gradeSlider.max, 10), seen = {}, order = [];
    for (var i = 0; i <= gmax; i++) {
      els.gradeSlider.value = String(i);
      fire('gradeSlider', 'input');
      var e = txt('exagOut');
      if (!seen[e]) { seen[e] = 0; order.push(e); }
      seen[e]++;
    }
    iok(order.length === 1,
        'exaggeration is identical across all ' + (gmax + 1) + ' grades',
        order.join(', '), 'a single value');
  });

  var exagAcrossGrades = txt('exagOut');

  // 4c. overflow must be reported, not silently corrected
  attempt('the overflow alert', function () {
    var gmax = parseInt(els.gradeSlider.max, 10);
    // Coarse grades push the bands well outside a precision-scaled drawing.
    els.gradeSlider.value = String(gmax);
    fire('gradeSlider', 'input');
    els.posSlider.value = String(parseInt(els.posSlider.max, 10));
    fire('posSlider', 'input');
    var overflowing = els.vizAlert.hidden === false;
    iok(overflowing, 'the alert appears when the bands run outside the view',
        overflowing ? 'shown' : 'hidden', 'shown');
    iok(/exaggeration to ×\d+/.test(txt('vizAlertMsg')),
        'the alert names a factor that would fit',
        txt('vizAlertMsg') || 'empty', 'names a factor');
    var before = txt('exagOut');
    iok(before === exagAcrossGrades,
        'the factor was NOT quietly reduced to make it fit',
        before + ' vs ' + exagAcrossGrades, 'unchanged');

    // The fit button is the correction, and it is the user's to press.
    fire('vizFit', 'click');
    iok(els.vizAlert.hidden === true, 'pressing fit clears the alert',
        els.vizAlert.hidden ? 'cleared' : 'still shown', 'cleared');
    iok(txt('exagOut') !== before, 'pressing fit changes the factor',
        before + ' -> ' + txt('exagOut'), 'changed');
    iok(!/NaN/.test(html_('vizHost')), 'the drawing is clean after fitting',
        'clean', 'clean');

    // Back to an ordinary fit; the alert must go away on its own. Select IT6 by
    // NAME rather than by slider index -- with IT01 and IT0 now at the head of the
    // list, index 1 is IT0, which is not what this is testing.
    var gi6 = HoleOptions.gradesFor(25).indexOf('6');
    iok(gi6 >= 0, 'IT6 is on the grade axis at 25 mm', 'index ' + gi6, 'present');
    els.gradeSlider.value = String(gi6);
    fire('gradeSlider', 'input');
    var mid = Math.floor(parseInt(els.posSlider.max, 10) / 2);
    els.posSlider.value = String(mid);
    fire('posSlider', 'input');
    els.exag.value = '50';
    fire('exag', 'input');
    iok(txt('gradeOut') === 'IT6', 'the grade axis really is back at IT6',
        txt('gradeOut'), 'IT6');
    iok(els.vizAlert.hidden === true, 'the alert clears again at an ordinary fit',
        els.vizAlert.hidden ? 'hidden' : 'still shown at ' + txt('holeLabel'),
        'hidden');
  });

  // 5. the visualisation toggle
  attempt('toggling the visualisation', function () {
    fire('vizZone', 'click');
    iok(els.vizZone.className === 'on' && els.vizDia.className !== 'on',
        'the zones button becomes active when clicked',
        els.vizZone.className + ' / ' + els.vizDia.className, 'on / not on');
    iok(/deviation \(µm\)/.test(html_('vizHost')),
        'the zones view renders the tolerance zone chart', 'zone chart', 'zone chart');
    iok(els.vizFoot.hidden === true,
        'the exaggeration control is hidden in the zones view',
        String(els.vizFoot.hidden), 'true');
    fire('vizDia', 'click');
    iok(els.vizDia.className === 'on' && els.vizFoot.hidden === false,
        'switching back restores the diameters view and its control',
        els.vizDia.className + ', foot hidden ' + els.vizFoot.hidden, 'on, foot hidden false');
  });

  // 6. custom deviations, the secondary pin path
  attempt('enabling custom pin deviations', function () {
    els.useCustom.checked = true;
    els.customUpper.value = '12';
    els.customLower.value = '4';
    fire('customUpper', 'input');
    fire('useCustom', 'change');
    iok(txt('pinLabel') === 'custom', 'the pin reports as a custom class',
        txt('pinLabel'), 'custom');
    iok(/12 \/ \+4 µm|\+12 \/ \+4 µm/.test(html_('pinReadout')),
        'the custom deviations reach the pin readout',
        (html_('pinReadout').match(/[+-−\d. ]+µm/) || ['none'])[0], '+12 / +4 µm');
    els.useCustom.checked = false;
    fire('useCustom', 'change');
    iok(txt('pinLabel') !== 'custom', 'unchecking returns to the ISO class',
        txt('pinLabel'), 'an ISO class');
  });

  // 7. the RSS controls
  attempt('changing the RSS assumptions', function () {
    els.kSel.value = '4';
    fire('kSel', 'change');
    iok(/4/.test(txt('kEcho')), 'the capability control feeds the stated assumption',
        txt('kEcho'), '4');
    iok(/±4/.test(html_('rssTable')) || /4\.0σ/.test(html_('rssTable')),
        'the RSS table reflects the new sigma multiplier',
        (html_('rssTable').match(/±[\d.]+σ/) || ['none'])[0], '±4');
    els.shift.value = '3';
    fire('shift', 'input');
    iok(!/NaN/.test(html_('bellCurve')), 'a mean shift does not break the curve',
        'clean', 'clean');
    els.shift.value = '0';
    fire('shift', 'input');
    els.kSel.value = '3';
    fire('kSel', 'change');
  });

  // 8. hostile input must not throw
  attempt('hostile input', function () {
    ['', 'abc', '-5', '0.2', '9999'].forEach(function (v) {
      els.dia.value = v;
      fire('dia', 'input');
    });
    iok(true, 'out-of-range and non-numeric diameters do not throw',
        'survived', 'survived');
    els.dia.value = '3';
    fire('dia', 'input');
    iok(txt('holeLabel').length > 0, 'the UI recovers after bad input',
        txt('holeLabel'), 'a class');
  });
})();

/* ----------------------------------------------------------------- text report */
var width = 0;
result.groups.forEach(function (g) {
  g.rows.forEach(function (r) { width = Math.max(width, r.what.length); });
});
width = Math.min(width, 62);

function pad(s, n) {
  s = String(s);
  while (s.length < n) s += ' ';
  return s;
}

result.groups.forEach(function (g) {
  var bad = g.rows.filter(function (r) { return !r.ok; }).length;
  print('');
  print('== ' + g.name + ' — ' + (bad ? bad + ' FAILED' : g.rows.length + ' passed'));
  g.rows.forEach(function (r) {
    if (r.ok) {
      print('   ok   ' + pad(r.what, width) + '  ' + r.got);
    } else {
      print('  FAIL  ' + pad(r.what, width) + '  got ' + r.got + '  |  want ' + r.want);
    }
  });
});

print('');
print('------------------------------------------------------------');
if (result.fail) {
  print(result.fail + ' of ' + (result.pass + result.fail) + ' checks FAILED');
} else {
  print('all ' + result.pass + ' checks passed');
}
