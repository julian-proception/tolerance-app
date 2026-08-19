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
 * most exposed to: app.js reaching for an element that the HTML does not define.
 */
(function smokeTestApp() {
  var groups = result.groups;
  var g = { name: 'app.js against a stub DOM', rows: [] };
  groups.push(g);
  function ok(cond, what, got, want) {
    if (cond) result.pass++; else result.fail++;
    g.rows.push({ ok: !!cond, what: what, got: String(got), want: String(want), src: '' });
  }

  var html = read('index.html');
  var declared = {};
  var re = /id="([^"]+)"/g, m;
  while ((m = re.exec(html))) declared[m[1]] = true;

  var missing = [];    // ids app.js asks for that index.html does not declare
  var touched = {};

  function makeEl(id) {
    return {
      id: id, innerHTML: '', textContent: '', value: '', checked: false,
      className: '', open: false, hidden: false,
      addEventListener: function () {},
      querySelectorAll: function () { return []; },
      getAttribute: function () { return null; },
      setAttribute: function () {}
    };
  }
  var els = {};
  var doc = {
    getElementById: function (id) {
      touched[id] = true;
      if (!declared[id] && missing.indexOf(id) < 0) missing.push(id);
      if (!els[id]) els[id] = makeEl(id);
      return els[id];
    }
  };
  // Minimal globals app.js expects.
  this.document = doc;
  this.location = { hash: '' };
  this.history = { replaceState: function () {} };
  this.Array = Array;

  var threw = null;
  try {
    // app.js is an IIFE, so loading it runs the whole init path.
    load('js/app.js');
  } catch (e) {
    threw = e;
  }

  ok(!threw, 'app.js initialises without throwing',
     threw ? String(threw) : 'no exception', 'no exception');
  ok(missing.length === 0, 'every element app.js reaches for exists in index.html',
     missing.length ? 'MISSING: ' + missing.join(', ') : 'all present', 'all present');

  // With the defaults (3 mm, m6, JS6) the key panels must be populated, and the
  // headline must state the brief's numbers.
  var headline = (els.fitHeadline || {}).innerHTML || '';
  ok(/Transition fit/.test(headline), 'default 3 mm m6/JS6 is reported as a transition fit',
     (headline.match(/>([A-Za-z]+ fit[^<]*)</) || ['', 'nothing'])[1], 'Transition fit');
  ok(/5 µm/.test(headline), 'headline states 5 um nominal interference',
     /5 µm/.test(headline) ? 'present' : headline.slice(0, 90), 'present');
  ok(/11 µm/.test(headline), 'headline states 11 um maximum interference',
     /11 µm/.test(headline) ? 'present' : headline.slice(0, 90), 'present');
  ok(/−1 µm/.test(headline) || /-1 µm/.test(headline),
     'headline states the -1 um minimum (1 um of clearance)',
     /−1 µm|-1 µm/.test(headline) ? 'present' : headline.slice(0, 120), 'present');

  ['pinSummary', 'holeSummary', 'ladder', 'fitTables', 'circleView', 'zoneChart',
   'statsTable', 'bellCurve', 'targetOut'].forEach(function (id) {
    var v = (els[id] || {}).innerHTML || '';
    ok(v.length > 0, '#' + id + ' is populated on first render',
       v.length + ' chars', 'more than 0 chars');
  });
  var ladder = (els.ladder || {}).innerHTML || '';
  ok(/JS6/.test(ladder), 'the ladder markup offers JS6', 'present', 'present');
  ok(!/NaN|undefined/.test(ladder + headline + ((els.statsTable || {}).innerHTML || '')),
     'rendered markup contains no NaN or undefined',
     /NaN|undefined/.test(ladder + headline) ? 'FOUND' : 'clean', 'clean');
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
