/*
 * verify-run.js — the assertion suite, shared by verify.html (browser) and
 * tools/run-verify.js (headless via JavaScriptCore). Keeping one copy means the
 * page you open and the check you run in a terminal can never drift apart.
 *
 * Returns { groups: [{name, rows:[{ok, what, got, want, src}]}], pass, fail }.
 */
var VerifyRun = (function () {
  'use strict';

  function run() {
    var groups = [], pass = 0, fail = 0;

    function group(name) {
      var g = { name: name, rows: [] };
      groups.push(g);
      return {
        ok: function (cond, what, got, want, src) {
          if (cond) pass++; else fail++;
          g.rows.push({ ok: !!cond, what: what, got: String(got), want: String(want),
                        src: src || '' });
        }
      };
    }
    function near(a, b, tol) { return Math.abs(a - b) <= (tol === undefined ? 1e-9 : tol); }
    function s(v) { return (v > 0 ? '+' : '') + (Math.round(v * 1000) / 1000); }

    /* ------------------------------------------------------------- IT grades */
    var g = group('Standard tolerances (IT grades)');
    VerifyCases.it.forEach(function (c) {
      var got = ISO286.itValue(c.size, c.grade);
      g.ok(near(got, c.um), 'IT' + c.grade + ' at ' + c.size + ' mm',
           got + ' um', c.um + ' um');
    });

    /* ------------------------------------------------------------ deviations */
    g = group('Limit deviations');
    VerifyCases.deviations.forEach(function (c) {
      var got;
      try { got = ISO286.deviations(c.size, c.cls); }
      catch (e) {
        g.ok(false, c.cls + ' at ' + c.size + ' mm', 'threw: ' + e.message,
             s(c.upper) + '/' + s(c.lower), c.src);
        return;
      }
      g.ok(near(got.upper, c.upper) && near(got.lower, c.lower),
           c.cls + ' at ' + c.size + ' mm',
           s(got.upper) + '/' + s(got.lower) + ' um',
           s(c.upper) + '/' + s(c.lower) + ' um', c.src);
    });

    /* ---------------------------------------------------------- interference */
    g = group('Interference and fit category');
    VerifyCases.interference.forEach(function (c) {
      var pin = ISO286.limits(c.size, c.pin);
      var hole = ISO286.limits(c.size, c.hole);
      var i = Fits.interference(pin, hole);
      g.ok(near(i.mean, c.mean) && near(i.max, c.max) && near(i.min, c.min) &&
           i.fit === c.fit,
           c.hole + '/' + c.pin + ' at ' + c.size + ' mm',
           'mean ' + s(i.mean) + ', ' + s(i.min) + '..' + s(i.max) + ' um, ' + i.fit,
           'mean ' + s(c.mean) + ', ' + s(c.min) + '..' + s(c.max) + ' um, ' + c.fit,
           c.src);
    });

    /* ----------------------------------------------------------- rejections */
    g = group('Classes that must be rejected');
    VerifyCases.errors.forEach(function (c) {
      var threw = false;
      try { ISO286.deviations(c.size, c.cls); } catch (e) { threw = true; }
      g.ok(threw, c.cls + ' at ' + c.size + ' mm',
           threw ? 'rejected' : 'ACCEPTED', 'rejected', c.why);
    });

    /* ------------------------------------------------------- normal helpers */
    g = group('Normal distribution helpers');
    VerifyCases.erf.forEach(function (c) {
      var got = Fits.erf(c.x);
      g.ok(near(got, c.y, 2e-6), 'erf(' + c.x + ')', got.toFixed(6), c.y.toFixed(6));
    });
    VerifyCases.normal.forEach(function (c) {
      var got = Fits.normalCdf(c.z);
      g.ok(near(got, c.cdf, 2e-6), 'Phi(' + c.z + ')', got.toFixed(6), c.cdf.toFixed(6));
    });

    /* -------------------------------------------------------------- RSS math */
    g = group('RSS statistics');
    VerifyCases.rss.forEach(function (c) {
      var pin = ISO286.limits(c.size, c.pin), hole = ISO286.limits(c.size, c.hole);
      var r = Fits.rss(pin, hole, { k: c.k });
      g.ok(near(r.sigmaPin, c.sigmaPin), 'sigma pin, ' + c.pin + ' at ' + c.size + ' mm',
           r.sigmaPin.toFixed(4), c.sigmaPin.toFixed(4));
      g.ok(near(r.sigmaHole, c.sigmaHole), 'sigma hole, ' + c.hole,
           r.sigmaHole.toFixed(4), c.sigmaHole.toFixed(4));
      g.ok(near(r.sigma, c.sigma), 'sigma interference (RSS)',
           r.sigma.toFixed(4), c.sigma.toFixed(4));
      g.ok(near(r.mean, c.mean), 'mean interference', s(r.mean), s(c.mean));
      g.ok(near(r.min, c.min) && near(r.max, c.max), 'plus/minus ' + c.k + ' sigma range',
           s(r.min) + '..' + s(r.max), s(c.min) + '..' + s(c.max));
      g.ok(near(r.pInterference, c.pInterference, 5e-5), 'fraction in interference',
           (r.pInterference * 100).toFixed(3) + '%',
           (c.pInterference * 100).toFixed(3) + '%');
      // The statistical band must always sit inside the worst-case band.
      g.ok(r.min >= r.worstCase.min - 1e-9 && r.max <= r.worstCase.max + 1e-9,
           'RSS band lies inside the worst-case band',
           s(r.min) + '..' + s(r.max),
           'within ' + s(r.worstCase.min) + '..' + s(r.worstCase.max));
      // A mean shift must move the mean by exactly that amount.
      var shifted = Fits.rss(pin, hole, { k: c.k, meanShift: 2.5 });
      g.ok(near(shifted.mean, r.mean + 2.5), 'a +2.5 um mean shift moves the mean',
           s(shifted.mean), s(r.mean + 2.5));
      // fractionAbove(mean) must be one half of a centred normal.
      g.ok(near(r.fractionAbove(r.mean), 0.5, 1e-6),
           'fractionAbove(mean) is 50%', r.fractionAbove(r.mean).toFixed(6), '0.500000');
      g.ok(near(r.fractionBetween(r.min, r.max), 0.9973, 5e-4),
           'fractionBetween the +/-3 sigma limits is 99.73%',
           r.fractionBetween(r.min, r.max).toFixed(4), '0.9973');
    });

    /* ------------------------------------ sweep: internal self-consistency */
    g = group('Self-consistency sweep across every offered class');
    var sizes = [1, 3, 5, 10, 18, 25, 30, 50, 65, 66, 80, 120, 180, 250, 400, 500];
    var swept = 0, problems = [];
    sizes.forEach(function (size) {
      ['shaft', 'hole'].forEach(function (kind) {
        ISO286.availableClasses(size, kind).forEach(function (cls) {
          swept++;
          var L = ISO286.limits(size, cls);
          if (!(L.upper >= L.lower)) problems.push(cls + '@' + size + ': upper < lower');
          if (!near(L.toleranceUm, L.upper - L.lower))
            problems.push(cls + '@' + size + ': tolerance width mismatch');
          if (!near(L.mean, (L.min + L.max) / 2, 1e-12))
            problems.push(cls + '@' + size + ': mean not centred');
          if (L.grade && !near(L.toleranceUm, ISO286.itValue(size, L.grade)))
            problems.push(cls + '@' + size + ': width != IT' + L.grade);
          if (!near(L.min, size + L.lower / 1000, 1e-12))
            problems.push(cls + '@' + size + ': min does not match lower deviation');
          if (!isFinite(L.min) || !isFinite(L.max))
            problems.push(cls + '@' + size + ': non-finite limit');
        });
      });
    });
    g.ok(problems.length === 0, swept + ' class/size combinations swept',
         problems.length ? problems.slice(0, 6).join('; ') : 'all consistent',
         'all consistent');

    // Every hole letter must mirror its shaft counterpart in sign direction:
    // A..H holes open away from the shaft, K..U close onto it.
    var mirrorBad = [];
    [5, 25, 100].forEach(function (size) {
      'DEFG'.split('').forEach(function (L) {
        var h = ISO286.deviations(size, L + 8);
        var sh = ISO286.deviations(size, L.toLowerCase() + 8);
        if (!(h.lower > 0 && sh.upper < 0)) mirrorBad.push(L + '/' + L.toLowerCase() + '@' + size);
      });
    });
    g.ok(mirrorBad.length === 0, 'D-G holes sit above basic size while d-g shafts sit below',
         mirrorBad.length ? mirrorBad.join(', ') : 'correct', 'correct');

    /* --------------------------------------- fit classification boundaries */
    g = group('Fit classification boundaries');
    g.ok(Fits.classify(0, 10) === 'interference', 'min interference exactly 0',
         Fits.classify(0, 10), 'interference');
    g.ok(Fits.classify(-10, 0) === 'clearance', 'max interference exactly 0',
         Fits.classify(-10, 0), 'clearance');
    g.ok(Fits.classify(-1, 1) === 'transition', 'range straddles zero',
         Fits.classify(-1, 1), 'transition');
    g.ok(Fits.classify(0, 0) === 'interference', 'zero width at zero',
         Fits.classify(0, 0), 'interference');

    /* -------------------------------------------------- the suggestion ladder */
    g = group('Suggestion ladder');
    var lad = Suggest.ladder(3, ISO286.limits(3, 'm6'), { k: 3 });
    ['interference', 'transition', 'clearance'].forEach(function (key) {
      g.ok(lad[key].total > 0, 'a 3 mm m6 pin has at least one ' + key + ' hole option',
           lad[key].total + ' found', 'more than 0');
    });
    var labels = lad.transition.rows.concat(lad.interference.rows, lad.clearance.rows)
      .map(function (r) { return r.label; });
    g.ok(labels.indexOf('JS6') >= 0, "the brief's JS6 appears in the ladder",
         labels.indexOf('JS6') >= 0 ? 'present' : 'MISSING', 'present');
    var ordered = true;
    ['interference', 'transition', 'clearance'].forEach(function (key) {
      var rows = lad[key].rows;
      for (var i = 1; i < rows.length; i++) {
        if (rows[i].wc.mean > rows[i - 1].wc.mean + 1e-9) ordered = false;
      }
    });
    g.ok(ordered, 'each group is ordered by descending nominal interference',
         ordered ? 'ordered' : 'OUT OF ORDER', 'ordered');
    // Every row's declared category must match its own numbers.
    var misfiled = 0;
    ['interference', 'transition', 'clearance'].forEach(function (key) {
      lad[key].rows.forEach(function (r) {
        if (Fits.classify(r.wc.min, r.wc.max) !== key) misfiled++;
      });
    });
    g.ok(misfiled === 0, 'no row is filed under the wrong category',
         misfiled + ' misfiled', '0 misfiled');
    /*
     * Trimming must keep both ends of a group. If it kept only the head, the
     * loosest transition options -- the barely-clearance fits an engineer most
     * often wants -- would vanish from the list.
     */
    var trans = lad.transition;
    g.ok(trans.rows[trans.rows.length - 1].wc.mean ===
           Math.min.apply(null, trans.rows.map(function (r) { return r.wc.mean; })),
         'the loosest transition option survives trimming',
         trans.rows[trans.rows.length - 1].label + ' at ' +
           trans.rows[trans.rows.length - 1].wc.mean + ' um', 'the minimum');
    var sumSkipped = 0;
    trans.rows.forEach(function (r) { sumSkipped += (r.skippedBefore || 0); });
    g.ok(sumSkipped === trans.hidden,
         'the elision markers account for every hidden class',
         sumSkipped + ' marked vs ' + trans.hidden + ' hidden', 'equal');
    // With a coarse pin the clearance group is large; its tightest entry (the one
    // closest to line-to-line) must be present.
    var ladH = Suggest.ladder(25, ISO286.limits(25, 'h6'), { k: 3 });
    g.ok(ladH.clearance.rows[0].wc.mean ===
           Math.max.apply(null, ladH.clearance.rows.map(function (r) { return r.wc.mean; })),
         'the tightest clearance option survives trimming',
         ladH.clearance.rows[0].label, 'the maximum');
    // H7/h6 must land in the clearance group at 25 mm; H7/p6 in interference.
    var l25 = Suggest.ladder(25, ISO286.limits(25, 'h6'), { k: 3 });
    g.ok(l25.clearance.rows.some(function (r) { return r.label === 'H7'; }),
         'H7 is offered as a clearance hole for a 25 mm h6 pin',
         'present', 'present');
    var l25p = Suggest.ladder(25, ISO286.limits(25, 'p6'), { k: 3 });
    g.ok(l25p.interference.rows.some(function (r) { return r.label === 'H7'; }),
         'H7 is offered as an interference hole for a 25 mm p6 pin',
         'present', 'present');
    g.ok(l25p.interference.rows.some(function (r) {
           return r.label === 'H7' && r.preferred;
         }), 'H7/p6 carries the ISO preferred-fit badge', 'badged', 'badged');

    /* ------------------------------------------ rendered SVG must be sane */
    if (typeof Viz !== 'undefined') {
      g = group('Rendered SVG output');
      var pin3 = ISO286.limits(3, 'm6'), hole3 = ISO286.limits(3, 'JS6');
      var stats3 = Fits.rss(pin3, hole3, { k: 3 });
      var E = Viz.autoExaggeration(3, pin3, hole3);
      g.ok(isFinite(E) && E > 1, 'auto exaggeration is a sensible finite factor',
           'x' + Math.round(E), 'finite and above 1');
      var views = {
        'circle view': Viz.circleView({ basic: 3, pin: pin3, hole: hole3, exaggeration: E }),
        'true-scale view': Viz.trueScaleView({ basic: 3, pin: pin3, hole: hole3 }),
        'zone chart': Viz.zoneChart({ basic: 3, pin: pin3, hole: hole3 }),
        'bell curve': Viz.bellCurve(stats3),
        // A pin with no hole selected yet must still render.
        'circle view, hole not yet chosen':
          Viz.circleView({ basic: 3, pin: pin3, hole: null, exaggeration: E }),
        'zone chart, hole not yet chosen':
          Viz.zoneChart({ basic: 3, pin: pin3, hole: null })
      };
      Object.keys(views).forEach(function (name) {
        var svg = views[name];
        // NaN or undefined inside a path attribute fails silently in SVG -- the
        // element just does not draw -- so it has to be asserted, not eyeballed.
        var junk = /NaN|undefined|Infinity|null/.test(svg);
        g.ok(!junk, name + ' contains no NaN/undefined/Infinity',
             junk ? 'FOUND: ' + (svg.match(/NaN|undefined|Infinity|null/) || [])[0] : 'clean',
             'clean');
        g.ok(/^<svg[\s\S]*<\/svg>$/.test(svg.trim()), name + ' is a closed svg element',
             'well formed', 'well formed');
      });
      // The exaggeration warning must be present and must state the factor.
      var cv = views['circle view'];
      g.ok(/NOT TO SCALE/.test(cv) && /exaggerated ×\d+/.test(cv),
           'circle view carries the not-to-scale warning with its factor',
           (cv.match(/NOT TO SCALE[^<]*/) || ['missing'])[0], 'present');
      // The bell curve must label both percentages for the brief's example, which
      // is ~99.98% interference despite worst case allowing clearance.
      var bc = views['bell curve'];
      g.ok(/interference<\/text>/.test(bc), 'bell curve labels the interference share',
           'labelled', 'labelled');

      // A degenerate case: zero-width tolerances must not divide by zero.
      var flat = { basic: 10, min: 10, max: 10, mean: 10, tolerance: 0, toleranceUm: 0,
                   upper: 0, lower: 0, label: 'exact', kind: 'shaft', grade: null,
                   letter: null, it: null };
      var flatStats = Fits.rss(flat, flat, { k: 3 });
      var flatSvg = Viz.bellCurve(flatStats);
      g.ok(!/NaN|Infinity/.test(flatSvg),
           'zero-width tolerances do not produce NaN in the bell curve',
           /NaN|Infinity/.test(flatSvg) ? 'NaN present' : 'clean', 'clean');
      g.ok(flatStats.sigma === 0 && isFinite(flatStats.pInterference),
           'zero-width tolerances give a finite interference probability',
           'sigma ' + flatStats.sigma + ', p ' + flatStats.pInterference,
           'finite');

      /* ------------------------------------------- circle-view geometry, checked
         against hand-computed values rather than eyeballed. At 3 mm with the
         basic radius drawn at 108 px, true scale is 108/1.5 = 72 px/mm, so at
         x160 exaggeration one micrometre of diameter is 72*160/2000 = 5.76 px. */
      g = group('Circle-view geometry');
      var rings = [];
      var reRing = /<circle cx="200" cy="200" r="([\d.]+)"[^>]*stroke-width="([\d.]+)"/g, mR;
      var cvGeom = Viz.circleView({ basic: 3, pin: pin3, hole: hole3, exaggeration: 160 });
      while ((mR = reRing.exec(cvGeom))) {
        rings.push({ r: parseFloat(mR[1]), w: parseFloat(mR[2]) });
      }
      function hasRing(r, w, label) {
        var found = rings.some(function (x) {
          return Math.abs(x.r - r) < 0.02 && Math.abs(x.w - w) < 0.02;
        });
        g.ok(found, label, found ? 'r=' + r + ' w=' + w : 'not drawn',
             'r=' + r + ' w=' + w);
      }
      // hole JS6 spans -3..+3 um  ->  90.72..125.28 px  ->  r 108.00, width 34.56
      hasRing(108.00, 34.56, 'hole JS6 band sits centred on the basic radius');
      // pin m6 spans +2..+8 um    -> 119.52..154.08 px  ->  r 136.80, width 34.56
      hasRing(136.80, 34.56, 'pin m6 band sits outboard of the basic radius');
      // overlap is +2..+3 um      -> 119.52..125.28 px  ->  r 122.40, width 5.76
      hasRing(122.40, 5.76, 'overlap ring covers only the +2..+3 um region');

      var maxR = rings.reduce(function (a, x) { return Math.max(a, x.r + x.w / 2); }, 0);
      g.ok(maxR < 200, 'nothing is drawn outside the 400x400 viewBox',
           'outermost edge ' + maxR.toFixed(1) + ' px', 'below 200 px');

      // A guaranteed interference fit has NO band overlap, because the bands are
      // fully separated. This is the assertion that would have caught the old
      // legend claiming the overlap marked "possible interference".
      var pi = ISO286.limits(25, 'p6'), hi7 = ISO286.limits(25, 'H7');
      var cvInt = Viz.circleView({ basic: 25, pin: pi, hole: hi7, exaggeration: 300 });
      var overlapColour = Viz.COLORS.overlap;
      g.ok(cvInt.indexOf(overlapColour) < 0,
           'H7/p6, a guaranteed interference fit, draws no overlap ring',
           cvInt.indexOf(overlapColour) < 0 ? 'absent' : 'PRESENT', 'absent');
      g.ok(cvGeom.indexOf(overlapColour) >= 0,
           'JS6/m6, a transition fit, does draw an overlap ring',
           cvGeom.indexOf(overlapColour) >= 0 ? 'present' : 'ABSENT', 'present');

      /* ------------------------------------------------------ axis tick labels */
      g = group('Axis tick labels');
      /*
       * A 2.5 um step printed at zero decimals renders as "-3, 0, +3, +5, +8":
       * evenly spaced gridlines carrying a sequence that reads as broken. Labels
       * must therefore always form an arithmetic progression.
       */
      function tickLabelValues(svg) {
        var vals = [], re = /class="viz-tick">([^<]+)</g, m;
        while ((m = re.exec(svg))) {
          var txt = m[1].replace(/\u2212/g, '-').trim();
          if (/^[-+]?[\d.]+$/.test(txt)) vals.push(parseFloat(txt));
        }
        return vals;
      }
      function arithmetic(vals, label) {
        // Consecutive numeric labels along one axis must share a constant delta.
        var sorted = vals.slice().sort(function (a, b) { return a - b; });
        var uniq = sorted.filter(function (v, i) { return i === 0 || v !== sorted[i - 1]; });
        if (uniq.length < 3) { g.ok(true, label + ' (too few ticks to check)', 'skipped', 'skipped'); return; }
        var d = uniq[1] - uniq[0], bad = null;
        for (var i = 2; i < uniq.length; i++) {
          if (Math.abs((uniq[i] - uniq[i - 1]) - d) > 1e-6) bad = uniq.join(', ');
        }
        g.ok(!bad, label, bad ? 'uneven: ' + bad : uniq.join(', '), 'evenly spaced');
      }
      // 3 mm m6/JS6 is the case that exposed the bug: the span forces a 2.5 step.
      arithmetic(tickLabelValues(Viz.zoneChart({ basic: 3, pin: pin3, hole: hole3 })),
                 'zone chart labels are evenly spaced at 3 mm (2.5 um step)');
      arithmetic(tickLabelValues(Viz.bellCurve(stats3)),
                 'bell curve labels are evenly spaced at 3 mm');
      // Sweep a spread of sizes and classes so an odd span cannot slip through.
      [[1, 'h5', 'H6'], [3, 'm6', 'JS6'], [8, 'js6', 'JS6'], [25, 'p6', 'H7'],
       [50, 'k6', 'JS7'], [120, 's6', 'H8'], [500, 'u7', 'H11']].forEach(function (c) {
        var pn = ISO286.limits(c[0], c[1]), hl = ISO286.limits(c[0], c[2]);
        arithmetic(tickLabelValues(Viz.zoneChart({ basic: c[0], pin: pn, hole: hl })),
                   'zone chart labels even for ' + c[2] + '/' + c[1] + ' at ' + c[0] + ' mm');
        arithmetic(tickLabelValues(Viz.bellCurve(Fits.rss(pn, hl, { k: 3 }))),
                   'bell curve labels even for ' + c[2] + '/' + c[1] + ' at ' + c[0] + ' mm');
      });
    }

    return { groups: groups, pass: pass, fail: fail };
  }

  return { run: run };
})();
