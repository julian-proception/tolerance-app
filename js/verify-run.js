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

    /* ------------------------------------------------- the two hole axes */
    g = group('Hole selection axes');
    var pinM6 = ISO286.limits(3, 'm6');
    var rows6 = HoleOptions.forGrade(3, 6, pinM6);

    g.ok(rows6.length > 0, 'grade 6 offers hole classes at 3 mm',
         rows6.length + ' classes', 'more than 0');

    // The position slider is only intuitive if the ordering is strictly monotonic
    // in nominal diameter -- otherwise sliding right could tighten the fit.
    var monotonic = true, prev = -Infinity;
    rows6.forEach(function (r) {
      if (r.hole.mean < prev - 1e-12) monotonic = false;
      prev = r.hole.mean;
    });
    g.ok(monotonic, 'position axis is monotonic in nominal diameter at 3 mm',
         rows6[0].hole.mean.toFixed(4) + ' -> ' +
           rows6[rows6.length - 1].hole.mean.toFixed(4) + ' mm', 'ascending');

    // Sliding right must loosen the fit: interference falls as the hole grows.
    var falling = true, prevInt = Infinity;
    rows6.forEach(function (r) {
      if (r.wc.mean > prevInt + 1e-12) falling = false;
      prevInt = r.wc.mean;
    });
    g.ok(falling, 'interference decreases monotonically along the position axis',
         rows6[0].wc.mean + ' -> ' + rows6[rows6.length - 1].wc.mean + ' um',
         'descending');

    var jsIdx = HoleOptions.indexOf(rows6, 'JS6');
    g.ok(jsIdx >= 0, "the brief's JS6 is on the grade 6 position axis",
         jsIdx >= 0 ? 'index ' + jsIdx : 'MISSING', 'present');
    g.ok(jsIdx >= 0 && rows6[jsIdx].wc.mean === 5 && rows6[jsIdx].wc.min === -1 &&
         rows6[jsIdx].wc.max === 11,
         'JS6 on the axis still carries the brief\'s numbers',
         jsIdx >= 0 ? rows6[jsIdx].wc.mean + ', ' + rows6[jsIdx].wc.min + '..' +
           rows6[jsIdx].wc.max : 'n/a', '5, -1..11');
    g.ok(jsIdx >= 0 && Math.abs(rows6[jsIdx].hole.mean - 3) < 1e-12,
         'JS6 sits at a nominal diameter of exactly 3.0000 mm',
         jsIdx >= 0 ? rows6[jsIdx].hole.mean.toFixed(4) : 'n/a', '3.0000');

    // Every row must be filed under the category its own numbers imply.
    var wrong = rows6.filter(function (r) {
      return Fits.classify(r.wc.min, r.wc.max) !== r.fit;
    }).length;
    g.ok(wrong === 0, 'every row on the axis is classified from its own numbers',
         wrong + ' mismatched', '0 mismatched');

    // The painted track must tile the axis exactly -- no gaps, no overlap, or the
    // coloured regions would not line up with the slider positions.
    var bd = HoleOptions.bands(rows6);
    var covered = 0, contiguous = true, at = 0;
    bd.forEach(function (b) {
      if (b.from !== at) contiguous = false;
      covered += b.to - b.from + 1;
      at = b.to + 1;
    });
    g.ok(contiguous && covered === rows6.length,
         'track bands tile the position axis exactly',
         covered + ' of ' + rows6.length + ' covered, contiguous ' + contiguous,
         rows6.length + ' covered, contiguous true');
    var mixed = bd.filter(function (b) {
      for (var i = b.from; i <= b.to; i++) {
        if (rows6[i].fit !== b.fit) return true;
      }
      return false;
    }).length;
    g.ok(mixed === 0, 'no track band contains a mixed fit category',
         mixed + ' mixed', '0 mixed');

    // Changing grade must hold the nominal diameter roughly steady rather than
    // jumping to an arbitrary class.
    var rows7 = HoleOptions.forGrade(3, 7, pinM6);
    // Named nearIdx, not near: `var` is function-scoped, so calling it `near`
    // silently overwrote the near() float-comparison helper for every check
    // further down run(). Nothing below used it at the time, so the clash sat
    // dormant until a later group did.
    var nearIdx = HoleOptions.nearestIndex(rows7, rows6[jsIdx].meanDev);
    g.ok(Math.abs(rows7[nearIdx].meanDev - rows6[jsIdx].meanDev) <= 3,
         'switching grade 6 -> 7 holds the nominal within 3 um',
         rows7[nearIdx].label + ' at ' + rows7[nearIdx].meanDev + ' um',
         'within 3 um of ' + rows6[jsIdx].meanDev);

    g.ok(HoleOptions.indexOf(rows6, 'NOPE9') === -1,
         'indexOf reports -1 for a class not on the axis', '-1', '-1');

    var grades3 = HoleOptions.gradesFor(3);
    var sortedG = grades3.slice().sort(function (a, b) { return a - b; });
    g.ok(grades3.join() === sortedG.join() && grades3.length > 2,
         'gradesFor returns ascending grades', grades3.join(' '), 'ascending');

    // A 25 mm h6 pin must be able to reach all three categories somewhere.
    var reach = {};
    HoleOptions.gradesFor(25).forEach(function (gr) {
      HoleOptions.forGrade(25, gr, ISO286.limits(25, 'h6')).forEach(function (r) {
        reach[r.fit] = true;
      });
    });
    ['interference', 'transition', 'clearance'].forEach(function (key) {
      g.ok(reach[key], 'a 25 mm h6 pin can reach a ' + key + ' fit',
           reach[key] ? 'reachable' : 'UNREACHABLE', 'reachable');
    });

    g.ok(HoleOptions.isPreferred('H7', 'p6'), 'H7/p6 is flagged as an ISO preferred fit',
         'preferred', 'preferred');
    g.ok(!HoleOptions.isPreferred('U8', 'm6'), 'U8/m6 is not flagged preferred',
         'not preferred', 'not preferred');

    /* ------------------------------------------ rendered SVG must be sane */
    if (typeof Viz !== 'undefined') {
      g = group('Rendered SVG output');
      var pin3 = ISO286.limits(3, 'm6'), hole3 = ISO286.limits(3, 'JS6');
      var stats3 = Fits.rss(pin3, hole3, { k: 3 });
      var ex3 = HoleOptions.precisionExtremes(3);
      var E = Viz.pinnedExaggeration(3, ex3.lo, ex3.hi);
      g.ok(isFinite(E) && E > 1, 'pinned exaggeration is a sensible finite factor',
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

      /* ------------------------------------------- exaggeration stability */
      /*
       * The factor must NOT be derived from the selected classes. If it is, the
       * drawing rescales on every slider step and the circles shift under the
       * cursor while you are trying to compare them.
       */
      g = group('Exaggeration stability');
      var exA = HoleOptions.precisionExtremes(3);
      var refAt3 = Viz.pinnedExaggeration(3, exA.lo, exA.hi);
      g.ok(Viz.pinnedExaggeration(3, exA.lo, exA.hi) === refAt3,
           'the pinned factor depends only on the diameter',
           'x' + refAt3, 'repeatable');

      // Walk the entire grade 6 position axis: the factor applied must stay put.
      var axis6 = HoleOptions.forGrade(3, 6, pinM6);
      var applied = axis6.map(function (r) {
        return Viz.clampExaggeration(3, pinM6, r.hole, refAt3);
      });
      var unchanged = applied.filter(function (v) { return v === refAt3; }).length;
      g.ok(unchanged === axis6.length,
           'the factor is identical at every grade 6 position at 3 mm',
           unchanged + ' of ' + axis6.length + ' positions unchanged',
           'all ' + axis6.length);
      // At larger sizes the most offset classes can still force a reduction. It
      // must stay a nudge, never the several-fold jump the old scheme produced.
      var exB = HoleOptions.precisionExtremes(25);
      var ref25 = Viz.pinnedExaggeration(25, exB.lo, exB.hi);
      var pin25 = ISO286.limits(25, 'm6');
      /*
       * Across the precision grades -- the range this tool is actually used in --
       * the factor must never move at all. At the coarse end (IT11, IT12, where an
       * A12 hole sits hundreds of micrometres off basic) a reduction is
       * unavoidable: without it the drawing would run off the canvas. The clamp
       * therefore still applies there, and the on-screen label reports it.
       */
      var worst = 1, worstAt = '';
      [5, 6, 7].forEach(function (gr) {
        if (HoleOptions.gradesFor(25).indexOf(gr) < 0) return;
        HoleOptions.forGrade(25, gr, pin25).forEach(function (r) {
          var e = Viz.clampExaggeration(25, pin25, r.hole, ref25);
          if (ref25 / e > worst) { worst = ref25 / e; worstAt = r.label; }
        });
      });
      g.ok(worst === 1,
           'IT5-IT7 at 25 mm never force a reduction, at any position',
           worst === 1 ? 'never clamped' : 'x' + worst.toFixed(2) + ' at ' + worstAt,
           'never clamped');
      // The IT5-IT7 guarantee must hold at every size, not just at 25 mm.
      var clampedAt = [];
      [1, 3, 8, 25, 50, 120, 500].forEach(function (size) {
        var exN = HoleOptions.precisionExtremes(size);
        var ref = Viz.pinnedExaggeration(size, exN.lo, exN.hi);
        var pn = ISO286.limits(size, 'h6');
        [5, 6, 7].forEach(function (gr) {
          if (HoleOptions.gradesFor(size).indexOf(gr) < 0) return;
          HoleOptions.forGrade(size, gr, pn).forEach(function (r) {
            if (Viz.clampExaggeration(size, pn, r.hole, ref) !== ref) {
              clampedAt.push(r.label + '@' + size + 'mm');
            }
          });
        });
      });
      g.ok(clampedAt.length === 0,
           'IT5-IT7 never clamp at 1, 3, 8, 25, 50, 120 or 500 mm',
           clampedAt.length ? clampedAt.slice(0, 5).join(', ') : 'never clamped',
           'never clamped');

      // The coarse grades still have to stay on the canvas.
      var coarseOut = [];
      HoleOptions.gradesFor(25).forEach(function (gr) {
        HoleOptions.forGrade(25, gr, pin25).forEach(function (r) {
          var e = Viz.clampExaggeration(25, pin25, r.hole, ref25);
          var sv = Viz.circleView({ basic: 25, pin: pin25, hole: r.hole, exaggeration: e });
          var re3 = /<circle cx="200" cy="200" r="([\d.]+)"[^>]*stroke-width="([\d.]+)"/g, m3;
          while ((m3 = re3.exec(sv))) {
            var rr3 = parseFloat(m3[1]), ww3 = parseFloat(m3[2]);
            if (rr3 - ww3 / 2 < -0.01 || rr3 + ww3 / 2 > 200.01) coarseOut.push(r.label);
          }
        });
      });
      g.ok(coarseOut.length === 0,
           'every class at every grade still draws inside the box after clamping',
           coarseOut.length ? coarseOut.slice(0, 5).join(', ') : 'all inside', 'all inside');

      // Where it does reduce, it may only ever reduce -- never grow past the pin.
      var grew = applied.filter(function (v) { return v > refAt3 + 1e-9; }).length;
      g.ok(grew === 0, 'the clamp only ever reduces the pinned factor',
           grew + ' grew', '0 grew');

      // And the clamp must actually keep the drawing inside the box.
      var outOfBox = [];
      axis6.forEach(function (r, i) {
        var svg = Viz.circleView({ basic: 3, pin: pinM6, hole: r.hole,
                                   exaggeration: applied[i] });
        var re2 = /<circle cx="200" cy="200" r="([\d.]+)"[^>]*stroke-width="([\d.]+)"/g, mm2;
        while ((mm2 = re2.exec(svg))) {
          var rr = parseFloat(mm2[1]), ww = parseFloat(mm2[2]);
          if (rr - ww / 2 < 0 || rr + ww / 2 > 200) outOfBox.push(r.label);
        }
      });
      g.ok(outOfBox.length === 0,
           'every grade 6 class draws inside the box at the pinned factor',
           outOfBox.length ? outOfBox.join(', ') : 'all inside', 'all inside');

      // A grade sweep must not send the factor wandering either, and the extreme
      // U6 case must still be drawn the right way round.
      var u6 = ISO286.limits(3, 'U6');
      var eU6 = Viz.clampExaggeration(3, pinM6, u6, refAt3);
      g.ok(eU6 === refAt3,
           'even U6, the most offset grade 6 class at 3 mm, needs no reduction',
           'x' + Math.round(eU6) + ' from x' + refAt3, 'unchanged');
      var svgU6 = Viz.circleView({ basic: 3, pin: pinM6, hole: u6, exaggeration: eU6 });
      g.ok(!/r="-/.test(svgU6), 'no negative radius is emitted for U6 at 3 mm',
           /r="-/.test(svgU6) ? 'NEGATIVE' : 'all positive', 'all positive');

      /* ------------------------------------------- circle-view geometry, checked
         against hand-computed values rather than eyeballed. At 3 mm with the
         basic radius drawn at 104 px, true scale is 104/1.5 = 69.3333 px/mm, so at
         x160 exaggeration one micrometre of diameter is 69.3333*160/2000 =
         5.546667 px. */
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
      // hole JS6 spans -3..+3 um  ->  87.36..120.64 px  ->  r 104.00, width 33.28
      hasRing(104.00, 33.28, 'hole JS6 band sits centred on the basic radius');
      // pin m6 spans +2..+8 um    -> 115.09..148.37 px  ->  r 131.73, width 33.28
      hasRing(131.73, 33.28, 'pin m6 band sits outboard of the basic radius');
      // overlap is +2..+3 um      -> 115.09..120.64 px  ->  r 117.87, width 5.55
      hasRing(117.87, 5.55, 'overlap ring covers only the +2..+3 um region');

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

    /* ------------------------------------------------- materials CSV integrity */
    g = group('Materials CSV');
    (function () {
      var list = Materials.all();
      g.ok(list.length >= 2, 'the CSV supplies at least two materials',
           list.length + ' materials', '>= 2');

      // The two the brief asks for must be present under stable keys, because the
      // URL hash refers to them by key.
      ['al6061', 'steel4140'].forEach(function (key) {
        g.ok(Materials.has(key), 'material "' + key + '" is present',
             Materials.has(key) ? 'present' : 'MISSING', 'present');
      });

      // Spot-check the published values these rest on. If someone edits the CSV
      // and fat-fingers a modulus, the forces silently change by a factor; these
      // fixtures are the guard.
      VerifyCases.materials.forEach(function (c) {
        var m = Materials.get(c.key);
        g.ok(near(m[c.field], c.value, c.tol || 1e-9),
             c.key + ' ' + c.field, m[c.field], c.value, c.src);
      });

      // Every numeric column must actually be a finite number on every row.
      var bad = [];
      list.forEach(function (m) {
        Materials.NUMERIC.forEach(function (f) {
          if (typeof m[f] !== 'number' || !isFinite(m[f])) bad.push(m.key + '.' + f);
        });
      });
      g.ok(bad.length === 0, 'every numeric column parses on every row',
           bad.length ? bad.join(', ') : 'all numeric', 'all numeric');

      // Yield below ultimate, and shear below tensile: a row failing either is a
      // transcription error rather than an exotic material.
      list.forEach(function (m) {
        g.ok(m.yield_strength_mpa <= m.tensile_strength_mpa,
             m.key + ' yield does not exceed UTS',
             m.yield_strength_mpa + ' vs ' + m.tensile_strength_mpa, 'yield <= UTS');
        g.ok(m.shear_strength_mpa < m.tensile_strength_mpa,
             m.key + ' shear is below UTS',
             m.shear_strength_mpa + ' vs ' + m.tensile_strength_mpa, 'shear < UTS');
        g.ok(m.poissons_ratio > 0 && m.poissons_ratio < 0.5,
             m.key + ' Poisson ratio is physical', m.poissons_ratio, '0 < v < 0.5');
      });

      // Every row has to say where its numbers came from. Deliberately a
      // non-empty check rather than a length threshold: a legitimate citation can
      // be short ("ASM Handbook Vol 2, p.1099"), and the quoted-comma parsing it
      // would otherwise be standing in for is asserted directly further down.
      list.forEach(function (m) {
        g.ok(!!(m.source && m.source.trim()),
             m.key + ' records a source for its numbers',
             m.source ? m.source.slice(0, 40) : 'EMPTY', 'non-empty');
      });

      var parsed = Materials.parseCsv(
        'key,name,v\n' +
        'a,"Name, with comma","say ""hi"""\n');
      g.ok(parsed.length === 1 && parsed[0].name === 'Name, with comma' &&
           parsed[0].v === 'say "hi"',
           'CSV parser handles quoted commas and doubled quotes',
           parsed.length ? parsed[0].name + ' | ' + parsed[0].v : 'no rows',
           'Name, with comma | say "hi"');

      // Comment and blank lines must not become rows.
      var withComments = Materials.parseCsv('# lead\n\nkey,name\n# mid\nx,Ex\n');
      g.ok(withComments.length === 1 && withComments[0].key === 'x',
           'CSV parser skips comment and blank lines',
           withComments.length + ' row(s)', '1 row');

      // A row with the wrong field count is a truncated edit, not a material.
      var ragged = false;
      try { Materials.parseCsv('a,b,c\n1,2\n'); } catch (e) { ragged = true; }
      g.ok(ragged, 'CSV parser rejects a row with the wrong field count',
           ragged ? 'threw' : 'accepted it', 'throws');

      /*
       * The schema layer must reject a bad material rather than letting a NaN
       * modulus reach the UI, where it would silently produce NaN forces. Built by
       * blanking one numeric column of a real row.
       */
      var head = 'key,' + Materials.NUMERIC.join(',');
      function syntheticRow(blank) {
        return Materials.NUMERIC.map(function (f) {
          return f === blank ? '' : '1';
        }).join(',');
      }
      g.ok((function () {
        try {
          Materials.parseMaterials(head + '\nok,' + syntheticRow(null) + '\n');
          return true;
        } catch (e) { return false; }
      })(), 'a fully populated synthetic row is accepted', 'accepted', 'accepted');

      var rejected = [];
      Materials.NUMERIC.forEach(function (f) {
        var threw = false;
        try {
          Materials.parseMaterials(head + '\nbad,' + syntheticRow(f) + '\n');
        } catch (e) { threw = true; }
        if (!threw) rejected.push(f);
      });
      g.ok(rejected.length === 0,
           'a blank value in any numeric column is rejected',
           rejected.length ? 'accepted blanks in: ' + rejected.join(', ')
                           : 'all ' + Materials.NUMERIC.length + ' rejected',
           'all rejected');

      var noKey = false;
      try { Materials.parseMaterials('key,youngs_modulus_gpa\n,205\n'); }
      catch (e) { noKey = true; }
      g.ok(noKey, 'a row with no key is rejected',
           noKey ? 'threw' : 'accepted it', 'throws');

      var unknown = false;
      try { Materials.get('no-such-material'); } catch (e) { unknown = true; }
      g.ok(unknown, 'asking for an unknown material key throws',
           unknown ? 'threw' : 'returned something', 'throws');

      // Friction pairing is the mean of the two self-mated values.
      var mu = Materials.pairFriction('steel4140', 'al6061');
      var want = (Materials.get('steel4140').friction_dry +
                  Materials.get('al6061').friction_dry) / 2;
      g.ok(near(mu, want), 'pair friction is the mean of the two self values',
           mu, want);
    })();

    /* ------------------------------------------------------ press-fit mechanics */
    g = group('Press-fit mechanics');
    (function () {
      var steel = Materials.get('steel4140');
      var alu = Materials.get('al6061');

      /*
       * Hand-computed reference case. 25 mm interface, 50 um diametral
       * interference, alloy steel in alloy steel, hub OD 50 mm, 25 mm engagement,
       * mu 0.15. Worked from the Lame equations by hand:
       *   Ci = (1 - 0.29)/205e9       = 3.463415e-12  1/Pa
       *   Co = (5/3 + 0.29)/205e9     = 9.544715e-12  1/Pa
       *   p  = 50e-6/(0.025 * 1.300813e-11) = 153.75 MPa
       *   F  = 0.15 * 153.75e6 * pi * 0.025 * 0.025 = 45.28 kN
       *   T  = F * 0.0125 = 566.0 N*m
       */
      var ref = PressFit.solve({
        interferenceUm: 50, diameterMm: 25, pin: steel, hole: steel,
        hubOuterMm: 50, lengthMm: 25, friction: 0.15
      });
      g.ok(near(ref.pressureMPa, 153.75, 0.01), 'contact pressure of the reference case',
           ref.pressureMPa.toFixed(3) + ' MPa', '153.75 MPa',
           'Lame, hand-computed');
      g.ok(near(ref.insertionForceN / 1000, 45.28, 0.01),
           'insertion force of the reference case',
           (ref.insertionForceN / 1000).toFixed(3) + ' kN', '45.28 kN',
           'mu*p*pi*D*L');
      g.ok(near(ref.holdingTorqueNm, 566.04, 0.05),
           'holding torque of the reference case',
           ref.holdingTorqueNm.toFixed(2) + ' N*m', '566.04 N*m', 'F*D/2');
      g.ok(near(ref.compliance.hub, 9.544715e-12, 1e-17),
           'hub compliance term of the reference case',
           ref.compliance.hub.toExponential(6), '9.544715e-12 1/Pa');
      g.ok(near(ref.compliance.pin, 3.463415e-12, 1e-17),
           'pin compliance term of the reference case',
           ref.compliance.pin.toExponential(6), '3.463415e-12 1/Pa');

      /*
       * THE governing identity: the hub's hoop strain minus the pin's must equal
       * the interference divided by the diameter, exactly. It says the two parts'
       * deformations account for precisely the interference forced between them,
       * so pressure and strain outputs cannot drift apart. Swept over materials,
       * sizes and geometry.
       */
      var worst = 0, worstAt = '';
      [[3, 5], [3, 0.4], [10, 12], [25, 50], [120, 200], [500, 900]]
        .forEach(function (ds) {
          [[steel, steel], [steel, alu], [alu, steel], [alu, alu]]
            .forEach(function (pair) {
              [[2 * ds[0], 0], [1.2 * ds[0], 0], [Infinity, 0],
               [2 * ds[0], 0.5 * ds[0]]].forEach(function (geo) {
                var r = PressFit.solve({
                  interferenceUm: ds[1], diameterMm: ds[0],
                  pin: pair[0], hole: pair[1],
                  hubOuterMm: geo[0], pinBoreMm: geo[1],
                  lengthMm: ds[0], friction: 0.2
                });
                var got = r.hole.hoopStrain - r.pin.hoopStrain;
                var want = (ds[1] * 1e-6) / (ds[0] * 1e-3);
                var rel = Math.abs(got - want) / Math.abs(want);
                if (rel > worst) {
                  worst = rel;
                  worstAt = ds[0] + ' mm, ' + ds[1] + ' um, OD ' + geo[0] +
                            ', bore ' + geo[1];
                }
              });
            });
        });
      g.ok(worst < 1e-12,
           'strain identity e_hub - e_pin = d/D holds over 96 combinations',
           'worst relative error ' + worst.toExponential(2) +
           (worstAt ? ' at ' + worstAt : ''), '< 1e-12');

      // The same identity in displacement form: the two surfaces move by half the
      // diametral interference between them.
      g.ok(near(ref.hole.radialDispUm - ref.pin.radialDispUm, 25, 1e-9),
           'the two surface movements sum to half the interference',
           (ref.hole.radialDispUm - ref.pin.radialDispUm).toFixed(6) + ' um',
           '25 um');

      // Limit cases the closed form must reproduce exactly.
      var inf = PressFit.solve({
        interferenceUm: 50, diameterMm: 25, pin: steel, hole: steel,
        hubOuterMm: Infinity, lengthMm: 25, friction: 0.15
      });
      g.ok(near(inf.compliance.hub, (1 + 0.29) / 205e9, 1e-18),
           'an infinite hub collapses its compliance to (1+v)/E',
           inf.compliance.hub.toExponential(6),
           ((1 + 0.29) / 205e9).toExponential(6));
      g.ok(near(inf.compliance.hubFactor, 1),
           'an infinite hub has geometry factor 1', inf.compliance.hubFactor, 1);
      // An infinite body cannot expand as freely as a finite hub, so it is stiffer
      // and the same interference generates MORE pressure, not less.
      g.ok(inf.pressureMPa > ref.pressureMPa,
           'an infinite hub is stiffer, so pressure rises',
           inf.pressureMPa.toFixed(2) + ' vs ' + ref.pressureMPa.toFixed(2) + ' MPa',
           'infinite > finite');

      g.ok(near(ref.compliance.pinFactor, 1),
           'a solid pin has geometry factor 1', ref.compliance.pinFactor, 1);
      g.ok(near(ref.compliance.pin, (1 - 0.29) / 205e9, 1e-18),
           'a solid pin collapses its compliance to (1-v)/E',
           ref.compliance.pin.toExponential(6), ((1 - 0.29) / 205e9).toExponential(6));

      // A solid pin sits in uniform biaxial compression, sr = st = -p, so its von
      // Mises equivalent stress is exactly p.
      g.ok(near(ref.pin.vonMisesMPa, ref.pressureMPa, 1e-9),
           'von Mises in a solid pin equals the contact pressure',
           ref.pin.vonMisesMPa.toFixed(6) + ' MPa',
           ref.pressureMPa.toFixed(6) + ' MPa');

      // Hub goes into tension, pin into compression. Sign errors here would invert
      // the whole yield story.
      g.ok(ref.hole.hoopStrain > 0 && ref.pin.hoopStrain < 0,
           'hub strains in tension and pin in compression',
           's_hub=' + ref.hole.hoopStrain.toExponential(3) +
           ' s_pin=' + ref.pin.hoopStrain.toExponential(3),
           'hub > 0 > pin');
      g.ok(ref.hole.hoopStressMPa > 0 && ref.pin.hoopStressMPa < 0,
           'hoop stress is tensile in the hub and compressive in the pin',
           ref.hole.hoopStressMPa.toFixed(1) + ' / ' + ref.pin.hoopStressMPa.toFixed(1),
           'hub > 0 > pin');
      g.ok(near(ref.hole.radialStressMPa, -ref.pressureMPa, 1e-9),
           'radial stress at the interface is -p',
           ref.hole.radialStressMPa.toFixed(3), (-ref.pressureMPa).toFixed(3));

      // Scaling laws. Force is linear in both length and friction; pressure is
      // linear in interference and independent of length.
      function withLen(L) {
        return PressFit.solve({
          interferenceUm: 50, diameterMm: 25, pin: steel, hole: steel,
          hubOuterMm: 50, lengthMm: L, friction: 0.15
        });
      }
      g.ok(near(withLen(50).insertionForceN / ref.insertionForceN, 2, 1e-12),
           'force is linear in engagement length',
           (withLen(50).insertionForceN / ref.insertionForceN).toFixed(9), 2);
      g.ok(near(withLen(50).pressureMPa, ref.pressureMPa, 1e-9),
           'pressure does not depend on engagement length',
           withLen(50).pressureMPa.toFixed(6), ref.pressureMPa.toFixed(6));
      var dblMu = PressFit.solve({
        interferenceUm: 50, diameterMm: 25, pin: steel, hole: steel,
        hubOuterMm: 50, lengthMm: 25, friction: 0.30
      });
      g.ok(near(dblMu.insertionForceN / ref.insertionForceN, 2, 1e-12),
           'force is linear in friction',
           (dblMu.insertionForceN / ref.insertionForceN).toFixed(9), 2);
      var dblInt = PressFit.solve({
        interferenceUm: 100, diameterMm: 25, pin: steel, hole: steel,
        hubOuterMm: 50, lengthMm: 25, friction: 0.15
      });
      g.ok(near(dblInt.pressureMPa / ref.pressureMPa, 2, 1e-12),
           'pressure is linear in interference',
           (dblInt.pressureMPa / ref.pressureMPa).toFixed(9), 2);
      g.ok(near(ref.contactAreaMm2, Math.PI * 25 * 25, 1e-9),
           'contact area is pi*D*L', ref.contactAreaMm2.toFixed(4) + ' mm2',
           (Math.PI * 625).toFixed(4) + ' mm2');

      // A softer hub yields to the pin instead of squeezing it, so an aluminium
      // hub develops less pressure than a steel one at the same interference,
      // while taking more of the strain.
      var aluHub = PressFit.solve({
        interferenceUm: 50, diameterMm: 25, pin: steel, hole: alu,
        hubOuterMm: 50, lengthMm: 25, friction: 0.15
      });
      g.ok(aluHub.pressureMPa < ref.pressureMPa,
           'an aluminium hub develops less pressure than a steel one',
           aluHub.pressureMPa.toFixed(2) + ' vs ' + ref.pressureMPa.toFixed(2) + ' MPa',
           'aluminium < steel');
      g.ok(aluHub.hole.hoopStrain > ref.hole.hoopStrain,
           'the aluminium hub takes more of the strain',
           aluHub.hole.hoopStrain.toExponential(3) + ' vs ' +
           ref.hole.hoopStrain.toExponential(3), 'aluminium > steel');

      // Boring the pin out makes it more compliant, which drops the pressure.
      var hollow = PressFit.solve({
        interferenceUm: 50, diameterMm: 25, pin: steel, hole: steel,
        hubOuterMm: 50, pinBoreMm: 15, lengthMm: 25, friction: 0.15
      });
      g.ok(hollow.pressureMPa < ref.pressureMPa,
           'a bored pin is more compliant, so pressure drops',
           hollow.pressureMPa.toFixed(2) + ' vs ' + ref.pressureMPa.toFixed(2) + ' MPa',
           'hollow < solid');
      g.ok(hollow.compliance.pinFactor > 1,
           'a bored pin has geometry factor above 1',
           hollow.compliance.pinFactor.toFixed(4), '> 1');

      // A thinner hub wall is more compliant, so it too drops the pressure.
      var thin = PressFit.solve({
        interferenceUm: 50, diameterMm: 25, pin: steel, hole: steel,
        hubOuterMm: 27, lengthMm: 25, friction: 0.15
      });
      g.ok(thin.pressureMPa < ref.pressureMPa,
           'a thin-walled hub develops less pressure',
           thin.pressureMPa.toFixed(2) + ' vs ' + ref.pressureMPa.toFixed(2) + ' MPa',
           'thin < thick');

      // Clearance and exactly-zero interference must produce nothing at all, not a
      // negative force.
      [-5, 0].forEach(function (i) {
        var c = PressFit.solve({
          interferenceUm: i, diameterMm: 25, pin: steel, hole: steel,
          hubOuterMm: 50, lengthMm: 25, friction: 0.15
        });
        g.ok(!c.engaged && c.pressureMPa === 0 && c.insertionForceN === 0 &&
             c.holdingTorqueNm === 0 && c.hole.hoopStrain === 0 &&
             c.pin.hoopStrain === 0 && c.deltaTHubC === 0,
             'interference of ' + i + ' um produces no pressure, force or strain',
             'p=' + c.pressureMPa + ' F=' + c.insertionForceN +
             ' e=' + c.hole.hoopStrain, 'all zero');
      });

      // Shrink-fit temperature rise: dT = d/(alpha*D). 50 um on 25 mm of 4140 at
      // 12.3 um/m/K gives 50000/(12.3*25) = 162.6 K.
      g.ok(near(ref.deltaTHubC, 50000 / (12.3 * 25), 1e-6),
           'shrink-fit temperature rise is d/(alpha*D)',
           ref.deltaTHubC.toFixed(2) + ' C', (50000 / (12.3 * 25)).toFixed(2) + ' C',
           'linear expansion');

      // Yield reporting must agree with the utilisation ratio it is derived from.
      var over = PressFit.solve({
        interferenceUm: 400, diameterMm: 25, pin: steel, hole: alu,
        hubOuterMm: 50, lengthMm: 25, friction: 0.15
      });
      g.ok(over.hole.yields === (over.hole.yieldUtilisation > 1),
           'the yield flag agrees with the utilisation ratio',
           over.hole.yields + ' at ' + over.hole.yieldUtilisation.toFixed(3),
           'flag == (util > 1)');
      g.ok(over.hole.yields,
           '400 um on a 25 mm aluminium hub is reported as past yield',
           over.hole.vonMisesMPa.toFixed(0) + ' MPa vs ' +
           alu.yield_strength_mpa + ' MPa yield', 'yields');
      g.ok(near(ref.hole.yieldStrain, 655e6 / 205e9, 1e-15),
           'yield strain is yield stress over E',
           ref.hole.yieldStrain.toExponential(6),
           (655e6 / 205e9).toExponential(6));

      // Bad geometry must be rejected rather than producing a nonsense number.
      [{ o: { pinBoreMm: 25 }, what: 'a pin bore equal to the pin diameter' },
       { o: { pinBoreMm: 30 }, what: 'a pin bore larger than the pin diameter' },
       { o: { hubOuterMm: 25 }, what: 'a hub outer diameter equal to the bore' },
       { o: { hubOuterMm: 20 }, what: 'a hub outer diameter below the bore' },
       { o: { diameterMm: 0 }, what: 'a zero interface diameter' }
      ].forEach(function (bad) {
        var base = {
          interferenceUm: 50, diameterMm: 25, pin: steel, hole: steel,
          hubOuterMm: 50, lengthMm: 25, friction: 0.15
        };
        for (var k in bad.o) base[k] = bad.o[k];
        var threw = false, msg = '';
        try { PressFit.solve(base); } catch (e) { threw = true; msg = e.message; }
        g.ok(threw, bad.what + ' is rejected',
             threw ? 'threw: ' + msg : 'returned a value', 'throws');
      });

      /* ------------------------------------------------------- the sigma range */
      var pin3 = ISO286.limits(3, 'm6');
      var hole3 = ISO286.limits(3, 'JS6');
      var st3 = Fits.rss(pin3, hole3, { k: 3 });
      var rng = PressFit.range(st3, 1, {
        diameterMm: 3, pin: steel, hole: alu,
        hubOuterMm: 6, lengthMm: 3, friction: 0.215
      });
      g.ok(near(rng.nominal.interferenceUm, st3.mean, 1e-12),
           'the nominal column uses the mean interference',
           rng.nominal.interferenceUm, st3.mean);
      g.ok(near(rng.high.interferenceUm - rng.nominal.interferenceUm, st3.sigma, 1e-12),
           'the +1 sigma column is one sigma above nominal',
           (rng.high.interferenceUm - rng.nominal.interferenceUm).toFixed(6) + ' um',
           st3.sigma.toFixed(6) + ' um');
      g.ok(near(rng.nominal.interferenceUm - rng.low.interferenceUm, st3.sigma, 1e-12),
           'the -1 sigma column is one sigma below nominal',
           (rng.nominal.interferenceUm - rng.low.interferenceUm).toFixed(6) + ' um',
           st3.sigma.toFixed(6) + ' um');
      g.ok(rng.low.interferenceUm < rng.nominal.interferenceUm &&
           rng.nominal.interferenceUm < rng.high.interferenceUm,
           'the three columns are ordered low < nominal < high',
           [rng.low, rng.nominal, rng.high].map(function (c) {
             return c.interferenceUm.toFixed(2);
           }).join(' < '), 'ascending');
      g.ok(rng.high.pressureMPa > rng.nominal.pressureMPa &&
           rng.nominal.pressureMPa >= rng.low.pressureMPa,
           'pressure rises with the sigma column',
           [rng.low, rng.nominal, rng.high].map(function (c) {
             return c.pressureMPa.toFixed(1);
           }).join(' <= '), 'ascending');

      // A wider sigma multiplier must widen the band proportionally.
      var rng2 = PressFit.range(st3, 2, {
        diameterMm: 3, pin: steel, hole: alu,
        hubOuterMm: 6, lengthMm: 3, friction: 0.215
      });
      g.ok(near(rng2.high.interferenceUm - st3.mean,
                2 * (rng.high.interferenceUm - st3.mean), 1e-12),
           'doubling the sigma multiplier doubles the band',
           (rng2.high.interferenceUm - st3.mean).toFixed(6),
           (2 * (rng.high.interferenceUm - st3.mean)).toFixed(6));

      // A zero multiplier collapses all three columns onto the nominal.
      var rng0 = PressFit.range(st3, 0, {
        diameterMm: 3, pin: steel, hole: alu,
        hubOuterMm: 6, lengthMm: 3, friction: 0.215
      });
      g.ok(near(rng0.low.interferenceUm, rng0.high.interferenceUm, 1e-12) &&
           near(rng0.low.interferenceUm, st3.mean, 1e-12),
           'a zero sigma multiplier collapses the range onto the nominal',
           rng0.low.interferenceUm + ' / ' + rng0.high.interferenceUm,
           st3.mean + ' both');

      // A clearance fit across the whole band must report nothing engaged, which
      // is what drives the "nothing to press" panel.
      var clr = ISO286.limits(3, 'H7');
      var clrPin = ISO286.limits(3, 'g6');
      var clrRng = PressFit.range(Fits.rss(clrPin, clr, { k: 3 }), 1, {
        diameterMm: 3, pin: steel, hole: alu,
        hubOuterMm: 6, lengthMm: 3, friction: 0.215
      });
      g.ok(!clrRng.high.engaged && !clrRng.nominal.engaged,
           'H7/g6 at 3 mm reports no engagement anywhere in the range',
           'high engaged=' + clrRng.high.engaged, 'not engaged');
    })();

    return { groups: groups, pass: pass, fail: fail };
  }

  return { run: run };
})();
