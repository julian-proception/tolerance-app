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

    /* ------------------------------------------------ catalogue completeness */
    g = group('Catalogue completeness');
    g.ok(ISO286.LETTERS.length === 28, 'all 28 ISO fundamental deviations exist',
         ISO286.LETTERS.length + ' letters', '28');
    g.ok(ISO286.GRADES.length === 20, 'all 20 ISO standard tolerance grades exist',
         ISO286.GRADES.length + ' grades', '20');
    g.ok(ISO286.GRADES[0] === '01' && ISO286.GRADES[1] === '0' &&
         ISO286.GRADES[19] === '18',
         'the grade series runs IT01, IT0, IT1 ... IT18',
         ISO286.GRADES.slice(0, 3).join(',') + ' ... ' + ISO286.GRADES[19],
         '01,0,1 ... 18');
    // I, L, O, Q and W are deliberately absent from ISO 286.
    var forbidden = ['i', 'l', 'o', 'q', 'w'].filter(function (l) {
      return ISO286.LETTERS.indexOf(l) >= 0;
    });
    g.ok(forbidden.length === 0, 'the ambiguous identifiers I L O Q W are absent',
         forbidden.length ? forbidden.join(',') : 'absent', 'absent');
    var at25 = ISO286.letters(25, 'hole');
    g.ok(at25.length === 28, 'all 28 identifiers are offered at 25 mm',
         at25.length + ': ' + at25.join(' '), '28');
    g.ok(ISO286.gradesForLetter(25, 'H').length === 20,
         'hole H offers all 20 grades at 25 mm',
         ISO286.gradesForLetter(25, 'H').length + ' grades', '20');

    // IT01 and IT1 must not collide: they parse to the same integer.
    var it01 = ISO286.itValue(25, '01'), it1 = ISO286.itValue(25, '1');
    g.ok(it01 !== it1 && it01 === 0.6 && it1 === 1.5,
         'IT01 and IT1 are distinct grades, not the same integer',
         'IT01=' + it01 + ', IT1=' + it1, 'IT01=0.6, IT1=1.5');
    g.ok(ISO286.parseClass('h01').grade === '01' &&
         ISO286.parseClass('h1').grade === '1' &&
         ISO286.parseClass('h0').grade === '0',
         'h01, h0 and h1 parse to three different grades',
         [ISO286.parseClass('h01').grade, ISO286.parseClass('h0').grade,
          ISO286.parseClass('h1').grade].join(','), '01,0,1');

    // Every grade must widen monotonically -- a coarser grade cannot be tighter.
    var widthBad = [];
    [3, 25, 500].forEach(function (size) {
      var prev = -1;
      ISO286.GRADES.forEach(function (gr) {
        var w = ISO286.itValue(size, gr);
        if (w < prev - 1e-9) widthBad.push('IT' + gr + '@' + size);
        prev = w;
      });
    });
    g.ok(widthBad.length === 0, 'IT values increase monotonically across all 20 grades',
         widthBad.length ? widthBad.join(', ') : 'monotonic', 'monotonic');

    // The derived values must be flagged, and the transcribed ones must not be.
    var flagged = ['x6', 'z6', 'za6', 'zc6', 'v6', 'y6'].every(function (c) {
      return ISO286.limits(25, c).derived === true;
    });
    g.ok(flagged, 'the formula-derived letters are flagged as derived',
         flagged ? 'all flagged' : 'NOT FLAGGED', 'all flagged');
    var plain = ['h6', 'm6', 'JS6', 'H7', 'u6', 's6', 'p6'].every(function (c) {
      return !ISO286.limits(25, c).derived;
    });
    g.ok(plain, 'the transcribed letters are not flagged',
         plain ? 'none flagged' : 'WRONGLY FLAGGED', 'none flagged');
    g.ok(ISO286.limits(3, 'cd9').derived === true,
         'the geometric-mean letters are flagged too',
         'flagged', 'flagged');

    // The full 28-letter axis must still be ordered by nominal diameter, or the
    // position slider stops meaning anything.
    var full = HoleOptions.forGrade(25, '6', ISO286.limits(25, 'h6'));
    g.ok(full.length === 28, 'the position axis carries all 28 letters at 25 mm IT6',
         full.length + ' classes', '28');
    var ord = true;
    for (var fi = 1; fi < full.length; fi++) {
      if (full[fi].hole.mean < full[fi - 1].hole.mean - 1e-12) ord = false;
    }
    g.ok(ord, 'the 28-letter axis is monotonic in nominal diameter',
         full[0].label + ' ' + full[0].hole.mean.toFixed(4) + ' -> ' +
           full[27].label + ' ' + full[27].hole.mean.toFixed(4), 'ascending');
    g.ok(full[0].label === 'ZC6' && full[27].label === 'A6',
         'the axis runs from the heaviest interference to the loosest clearance',
         full[0].label + ' ... ' + full[27].label, 'ZC6 ... A6');

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
    var near = HoleOptions.nearestIndex(rows7, rows6[jsIdx].meanDev);
    g.ok(Math.abs(rows7[near].meanDev - rows6[jsIdx].meanDev) <= 3,
         'switching grade 6 -> 7 holds the nominal within 3 um',
         rows7[near].label + ' at ' + rows7[near].meanDev + ' um',
         'within 3 um of ' + rows6[jsIdx].meanDev);

    g.ok(HoleOptions.indexOf(rows6, 'NOPE9') === -1,
         'indexOf reports -1 for a class not on the axis', '-1', '-1');

    var grades3 = HoleOptions.gradesFor(3);
    var isoOrder = ISO286.GRADES.filter(function (x) { return grades3.indexOf(x) >= 0; });
    g.ok(grades3.join() === isoOrder.join() && grades3.length > 2,
         'gradesFor returns grades in ISO order (IT01, IT0, IT1 ...)',
         grades3.join(' '), 'ISO order');

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

      /* --------------------------------- exaggeration stability and overflow */
      /*
       * The factor is a function of diameter and the user's slider ONLY. Nothing
       * about the selected classes may influence it -- not even to keep an extreme
       * class on the canvas, because that reintroduces the rescaling the pinned
       * factor exists to remove. Overflow is reported instead.
       */
      g = group('Exaggeration stability and overflow');
      var exA = HoleOptions.precisionExtremes(3);
      var refAt3 = Viz.pinnedExaggeration(3, exA.lo, exA.hi);
      g.ok(Viz.pinnedExaggeration(3, exA.lo, exA.hi) === refAt3,
           'the pinned factor depends only on the diameter',
           'x' + refAt3, 'repeatable');

      // Whether the RENDER PATH holds the factor still cannot be observed from
      // here -- Viz has no knowledge of it. That is asserted where it is visible,
      // by sweeping the real sliders in the interaction pass.

      // Overflow must be reported exactly when a smaller factor would be needed.
      var pin3b = ISO286.limits(3, 'm6');
      var okFits = Viz.circleOverflow(3, pin3b, ISO286.limits(3, 'JS6'), refAt3);
      g.ok(!okFits.over && okFits.suggested >= refAt3,
           'a normal fit at the pinned factor reports no overflow',
           okFits.over ? 'overflow' : 'fits', 'fits');

      // A coarse class at the precision-scaled factor must overflow, and the
      // suggested factor must actually resolve it.
      var coarse = ISO286.limits(3, 'C11');
      var ofC = Viz.circleOverflow(3, pin3b, coarse, refAt3);
      g.ok(ofC.over, 'a C11 hole at the precision factor is reported as overflowing',
           ofC.over ? 'overflow reported' : 'NOT REPORTED', 'overflow reported');
      g.ok(ofC.suggested < refAt3, 'the suggested factor is smaller than the current',
           'x' + Math.round(ofC.suggested) + ' vs x' + refAt3, 'smaller');
      var after = Viz.circleOverflow(3, pin3b, coarse, ofC.suggested);
      g.ok(!after.over, 'applying the suggested factor clears the overflow',
           after.over ? 'still overflowing' : 'clear', 'clear');

      // over must be consistent with suggested across the whole range, or the
      // alert would fire when nothing needs fixing (or stay silent when it does).
      var inconsistent = [];
      [3, 25, 120].forEach(function (size) {
        var exN = HoleOptions.precisionExtremes(size);
        var ref = Viz.pinnedExaggeration(size, exN.lo, exN.hi);
        var pn = ISO286.limits(size, 'h6');
        HoleOptions.gradesFor(size).forEach(function (gr) {
          HoleOptions.forGrade(size, gr, pn).forEach(function (r) {
            var o = Viz.circleOverflow(size, pn, r.hole, ref);
            if (o.over !== (o.suggested < ref - 1e-9)) {
              inconsistent.push(r.label + '@' + size);
            }
            if (o.over && Viz.circleOverflow(size, pn, r.hole, o.suggested).over) {
              inconsistent.push(r.label + '@' + size + ' (suggestion does not fit)');
            }
          });
        });
      });
      g.ok(inconsistent.length === 0,
           'overflow flag and suggested factor agree at every grade and size',
           inconsistent.length ? inconsistent.slice(0, 4).join(', ') : 'consistent',
           'consistent');

      /*
       * Without a clamp, an extreme class can drive a radius negative. SVG treats
       * a negative r as an error and draws nothing at all, so the geometry is
       * guarded at zero -- the drawing clips rather than vanishing.
       */
      var badSvg = [];
      [3, 25, 500].forEach(function (size) {
        var exN = HoleOptions.precisionExtremes(size);
        var ref = Viz.pinnedExaggeration(size, exN.lo, exN.hi);
        var pn = ISO286.limits(size, 'h6');
        HoleOptions.gradesFor(size).forEach(function (gr) {
          HoleOptions.forGrade(size, gr, pn).forEach(function (r) {
            var svg = Viz.circleView({ basic: size, pin: pn, hole: r.hole,
                                       exaggeration: ref });
            if (/r="-/.test(svg) || /NaN|undefined/.test(svg)) {
              badSvg.push(r.label + '@' + size);
            }
          });
        });
      });
      g.ok(badSvg.length === 0,
           'no class emits a negative or invalid radius, even when overflowing',
           badSvg.length ? badSvg.slice(0, 4).join(', ') : 'all valid', 'all valid');

      // A wildly overcranked factor must still produce a drawable figure.
      var huge = Viz.circleView({ basic: 3, pin: pin3b,
                                  hole: ISO286.limits(3, 'U6'), exaggeration: 100000 });
      g.ok(!/r="-/.test(huge) && /<svg/.test(huge) && !/NaN/.test(huge),
           'a 100000x factor still yields valid SVG',
           /r="-/.test(huge) ? 'negative radius' : 'valid', 'valid');

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

    return { groups: groups, pass: pass, fail: fail };
  }

  return { run: run };
})();
