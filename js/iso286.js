/*
 * iso286.js — ISO 286 limits & fits data layer.
 *
 * Design note: only the SHAFT fundamental deviations and the IT grade matrix are
 * hardcoded. Every hole class except J/JS is DERIVED from the shaft value via the
 * ISO 286-1 rules implemented in holeDeviation() below. That keeps the amount of
 * hand-transcribed data small, which is where typos hide in tools like this.
 *
 * Sign convention throughout: deviations are in micrometres (um), signed, relative
 * to the basic size. `upper` is always >= `lower`.
 *
 * Sources and which values rest on which source: see REFERENCES.md.
 */
var ISO286 = (function () {
  'use strict';

  /* ---------------------------------------------------------------- size ranges */

  // Upper bounds of the 13 principal nominal-size ranges of ISO 286 (mm).
  // Read as "over the previous bound, up to and including this one"; the first
  // range is "up to and including 3 mm".
  var R13 = [3, 6, 10, 18, 30, 50, 80, 120, 180, 250, 315, 400, 500];

  // Letters a, b, c and r, s, t, u subdivide several of the principal ranges, so
  // they are keyed on this finer list instead. Using one master fine list (rather
  // than per-letter range tables) means a letter that does NOT subdivide simply
  // repeats its value across the sub-ranges -- easy to eyeball for correctness.
  var R25 = [3, 6, 10, 14, 18, 24, 30, 40, 50, 65, 80, 100, 120, 140, 160, 180,
             200, 225, 250, 280, 315, 355, 400, 450, 500];

  var MIN_SIZE = 1;   // ISO 286 letters a/b are undefined below 1 mm
  var MAX_SIZE = 500; // this implementation stops at the 500 mm range

  /* ------------------------------------------------------------- IT grade table */

  // IT1..IT13 in um, one value per principal size range (13 columns).
  // Hardcoded rather than computed from i = 0.45*cbrt(D) + 0.001*D because ISO
  // rounds the formula results onto preferred-number series in a way that is not
  // reliably reproducible (e.g. at <=3 mm, 40i = 34.7 but the table says 40).
  var IT = {
    1:  [0.8, 1,   1,   1.2, 1.5, 1.5, 2,   2.5, 3.5, 4.5, 6,   7,   8  ],
    2:  [1.2, 1.5, 1.5, 2,   2.5, 2.5, 3,   4,   5,   7,   8,   9,   10 ],
    3:  [2,   2.5, 2.5, 3,   4,   4,   5,   6,   8,   10,  12,  13,  15 ],
    4:  [3,   4,   4,   5,   6,   7,   8,   10,  12,  14,  16,  18,  20 ],
    5:  [4,   5,   6,   8,   9,   11,  13,  15,  18,  20,  23,  25,  27 ],
    6:  [6,   8,   9,   11,  13,  16,  19,  22,  25,  29,  32,  36,  40 ],
    7:  [10,  12,  15,  18,  21,  25,  30,  35,  40,  46,  52,  57,  63 ],
    8:  [14,  18,  22,  27,  33,  39,  46,  54,  63,  72,  81,  89,  97 ],
    9:  [25,  30,  36,  43,  52,  62,  74,  87,  100, 115, 130, 140, 155],
    10: [40,  48,  58,  70,  84,  100, 120, 140, 160, 185, 210, 230, 250],
    11: [60,  75,  90,  110, 130, 160, 190, 220, 250, 290, 320, 360, 400],
    12: [100, 120, 150, 180, 210, 250, 300, 350, 400, 460, 520, 570, 630],
    13: [140, 180, 220, 270, 330, 390, 460, 540, 630, 720, 810, 890, 970]
  };

  /* -------------------------------------------- shaft fundamental deviations */

  // Letters a..h: the fundamental deviation is `es` (upper deviation), <= 0.
  // Keyed on the 13 principal ranges.
  var SHAFT_ES_13 = {
    d: [-20, -30, -40, -50, -65, -80, -100, -120, -145, -170, -190, -210, -230],
    e: [-14, -20, -25, -32, -40, -50, -60,  -72,  -85,  -100, -110, -125, -135],
    f: [-6,  -10, -13, -16, -20, -25, -30,  -36,  -43,  -50,  -56,  -62,  -68 ],
    g: [-2,  -4,  -5,  -6,  -7,  -9,  -10,  -12,  -14,  -15,  -17,  -18,  -20 ],
    h: [0,   0,   0,   0,   0,   0,   0,    0,    0,    0,    0,    0,    0   ]
  };

  // Letters a, b, c subdivide -- keyed on the 25 fine ranges.
  var SHAFT_ES_25 = {
    a: [-270, -270, -280, -290, -290, -300, -300, -310, -320, -340, -360, -380,
        -410, -460, -520, -580, -660, -740, -820, -920, -1050, -1200, -1350,
        -1500, -1650],
    b: [-140, -140, -150, -150, -150, -160, -160, -170, -180, -190, -200, -220,
        -240, -260, -280, -310, -340, -380, -420, -480, -540, -600, -680, -760,
        -840],
    c: [-60, -70, -80, -95, -95, -110, -110, -120, -130, -140, -150, -170, -180,
        -200, -210, -230, -240, -260, -280, -300, -330, -360, -400, -440, -480]
  };

  // Letters k..u: the fundamental deviation is `ei` (lower deviation), >= 0.
  var SHAFT_EI_13 = {
    // k has a nonzero deviation ONLY for grades IT4..IT7; see shaftDeviation().
    k: [0,  1,  1,  1,  2,  2,  2,  3,  3,  4,  4,  4,  5 ],
    m: [2,  4,  6,  7,  8,  9,  11, 13, 15, 17, 20, 21, 23],
    n: [4,  8,  10, 12, 15, 17, 20, 23, 27, 31, 34, 37, 40],
    p: [6,  12, 15, 18, 22, 26, 32, 37, 43, 50, 56, 62, 68]
  };

  // r, s, t, u subdivide -- keyed on the 25 fine ranges. `t` is undefined at or
  // below 24 mm (nulls), which callers must reject rather than read as zero.
  var SHAFT_EI_25 = {
    r: [10, 15, 19, 23, 23, 28, 28, 34, 34, 41, 43, 51, 54, 63, 65, 68, 77, 80,
        84, 94, 98, 108, 114, 126, 132],
    s: [14, 19, 23, 28, 28, 35, 35, 43, 43, 53, 59, 71, 79, 92, 100, 108, 122,
        130, 140, 158, 170, 190, 208, 232, 252],
    t: [null, null, null, null, null, null, 41, 48, 54, 66, 75, 91, 104, 122,
        134, 146, 166, 180, 196, 218, 240, 268, 294, 330, 360],
    u: [18, 23, 28, 33, 33, 41, 48, 60, 70, 87, 102, 124, 144, 170, 190, 210,
        236, 258, 284, 315, 350, 390, 435, 490, 540]
  };

  // Shaft j is tabulated per grade and is not derivable from a single column.
  // j5 and j6 share one column in ISO 286; j7 has its own. j8 is omitted because
  // its column could not be corroborated -- see REFERENCES.md.
  var SHAFT_EI_J = {
    5: [-2, -2, -2, -3, -4, -5, -7,  -9,  -11, -13, -16, -18, -20],
    6: [-2, -2, -2, -3, -4, -5, -7,  -9,  -11, -13, -16, -18, -20],
    7: [-4, -4, -5, -6, -8, -10, -12, -15, -18, -21, -26, -28, -32]
  };

  // Hole J is likewise tabulated (it is NOT the mirror of shaft j, nor does the
  // delta rule reproduce it). Values are ES, the upper deviation.
  var HOLE_ES_J = {
    6: [2, 5,  5,  6,  8,  10, 13, 16, 18, 22, 25, 29, 33],
    7: [4, 6,  8,  10, 12, 14, 18, 22, 26, 30, 36, 39, 43],
    8: [6, 10, 12, 15, 20, 24, 28, 34, 41, 47, 55, 60, 66]
  };

  /* ------------------------------------------------------------ grade catalogue */

  // Grades offered in the UI per letter. Any parseable class is still computed if
  // asked for; this list only drives dropdowns and the suggestion ladder, so that
  // we surface combinations engineers actually specify.
  var OFFERED_GRADES = {
    a: [11, 12], b: [11, 12], c: [9, 10, 11], d: [8, 9, 10, 11],
    e: [7, 8, 9], f: [6, 7, 8, 9], g: [5, 6, 7],
    h: [5, 6, 7, 8, 9, 10, 11],
    j: [5, 6, 7], js: [5, 6, 7, 8, 9, 10, 11],
    k: [5, 6, 7], m: [5, 6, 7, 8], n: [5, 6, 7, 8],
    p: [5, 6, 7], r: [5, 6, 7], s: [5, 6, 7], t: [6, 7], u: [6, 7, 8]
  };
  // Holes carry one extra grade for K/M/N/P per ISO practice (e.g. P8 exists).
  var OFFERED_GRADES_HOLE = {
    A: [11, 12], B: [11, 12], C: [9, 10, 11], D: [8, 9, 10, 11],
    E: [7, 8, 9], F: [6, 7, 8, 9], G: [5, 6, 7],
    H: [5, 6, 7, 8, 9, 10, 11],
    J: [6, 7, 8], JS: [5, 6, 7, 8, 9, 10, 11],
    K: [5, 6, 7, 8], M: [5, 6, 7, 8], N: [5, 6, 7, 8],
    P: [5, 6, 7, 8], R: [5, 6, 7], S: [5, 6, 7], T: [6, 7], U: [6, 7, 8]
  };

  /* ------------------------------------------------------------------- helpers */

  function rangeIndex(size, bounds) {
    for (var i = 0; i < bounds.length; i++) {
      if (size <= bounds[i]) return i;
    }
    return -1;
  }

  function checkSize(size) {
    if (typeof size !== 'number' || !isFinite(size)) {
      throw new Error('Basic size must be a number.');
    }
    if (size < MIN_SIZE || size > MAX_SIZE) {
      throw new Error('Basic size ' + size + ' mm is outside the supported range ' +
                      MIN_SIZE + '-' + MAX_SIZE + ' mm.');
    }
  }

  /** Standard tolerance (IT grade) value in um for a basic size. */
  function itValue(size, grade) {
    checkSize(size);
    var row = IT[grade];
    if (!row) throw new Error('IT' + grade + ' is not supported (IT1-IT13 only).');
    return row[rangeIndex(size, R13)];
  }

  /**
   * The ISO 286-1 "delta" correction applied to interference-side hole classes.
   *
   * Rule: for holes K, M, N at grades <= IT8, and P..ZC at grades <= IT7,
   *   ES = -(shaft fundamental deviation) + delta,  delta = IT(n) - IT(n-1).
   * Outside those windows delta is zero.
   *
   * Footnote that matters: delta is 0 for nominal sizes <= 3 mm. This is why, at
   * 3 mm, K6 is 0/-6 rather than +2/-4. The ISO delta table itself begins at
   * >3 mm for exactly this reason.
   */
  function deltaFor(size, letter, grade) {
    if (size <= 3) return 0;
    var isKMN = (letter === 'K' || letter === 'M' || letter === 'N');
    var isPtoU = ('PRSTU'.indexOf(letter) >= 0);
    if (isKMN && grade > 8) return 0;
    if (isPtoU && grade > 7) return 0;
    if (!isKMN && !isPtoU) return 0;
    if (grade < 2) return 0;
    return itValue(size, grade) - itValue(size, grade - 1);
  }

  /**
   * Symmetric js/JS deviation: always +/- IT/2.
   *
   * Older editions of the standard allowed odd IT values to be rounded to
   * +/-(IT-1)/2 so the deviations came out as whole micrometres, but published
   * ISO 286-2 tables keep the half micrometre: JS6 at 6-10 mm (IT6 = 9) is
   * +/-4.5, JS6 at 18-30 (IT6 = 13) is +/-6.5, and JS7 at 18-30 (IT7 = 21) is
   * +/-10.5. Rounding down here would silently report every odd-IT symmetric
   * class as 1 um tighter than it is, so it is not done.
   */
  function symmetricHalf(size, grade) {
    return itValue(size, grade) / 2;
  }

  /**
   * Signed fundamental deviation of a lower-case letter, with its kind.
   *
   * `forShaft` matters for exactly one letter, k. ISO restricts the nonzero k
   * deviation to grades IT4..IT7 *for shafts*; hole K is built from the tabulated
   * k value at every grade. That is why hole K8 at 3-6 mm is +5/-13 (from
   * k = +1 plus delta = 6) and not +6/-12, while shaft k8 really is 0/+18.
   */
  function shaftFundamental(size, letter, grade, forShaft) {
    if (forShaft === undefined) forShaft = true;
    if (letter === 'h') return { kind: 'es', value: 0 };
    if (letter === 'j') {
      var jrow = SHAFT_EI_J[grade];
      if (!jrow) {
        throw new Error('Shaft j is supported at grades 5-7 only (j' + grade +
                        ' requested).');
      }
      return { kind: 'ei', value: jrow[rangeIndex(size, R13)] };
    }
    if (letter === 'k') {
      var useTable = !forShaft || (grade >= 4 && grade <= 7);
      var kv = useTable ? SHAFT_EI_13.k[rangeIndex(size, R13)] : 0;
      return { kind: 'ei', value: kv };
    }
    if (SHAFT_ES_13[letter]) {
      return { kind: 'es', value: SHAFT_ES_13[letter][rangeIndex(size, R13)] };
    }
    if (SHAFT_ES_25[letter]) {
      return { kind: 'es', value: SHAFT_ES_25[letter][rangeIndex(size, R25)] };
    }
    if (SHAFT_EI_13[letter]) {
      return { kind: 'ei', value: SHAFT_EI_13[letter][rangeIndex(size, R13)] };
    }
    if (SHAFT_EI_25[letter]) {
      var v = SHAFT_EI_25[letter][rangeIndex(size, R25)];
      if (v === null) {
        throw new Error('Tolerance letter ' + letter + ' is not defined at ' +
                        size + ' mm (it starts above 24 mm).');
      }
      return { kind: 'ei', value: v };
    }
    throw new Error('Unknown tolerance letter "' + letter + '".');
  }

  /** {upper, lower} deviations in um for a shaft class. */
  function shaftDeviation(size, letter, grade) {
    if (letter === 'js') {
      var h = symmetricHalf(size, grade);
      return { upper: h, lower: -h };
    }
    var it = itValue(size, grade);
    var fd = shaftFundamental(size, letter, grade);
    return (fd.kind === 'es')
      ? { upper: fd.value, lower: fd.value - it }
      : { upper: fd.value + it, lower: fd.value };
  }

  /** {upper, lower} deviations in um for a hole class. */
  function holeDeviation(size, letter, grade) {
    if (letter === 'JS') {
      var h = symmetricHalf(size, grade);
      return { upper: h, lower: -h };
    }
    var it = itValue(size, grade);
    if (letter === 'J') {
      var jrow = HOLE_ES_J[grade];
      if (!jrow) {
        throw new Error('Hole J is supported at grades 6-8 only (J' + grade +
                        ' requested).');
      }
      var es = jrow[rangeIndex(size, R13)];
      return { upper: es, lower: es - it };
    }
    // Every other hole letter mirrors its shaft counterpart.
    var fd = shaftFundamental(size, letter.toLowerCase(), grade, false);
    if (fd.kind === 'es') {
      // A..H: EI = -es(shaft), ES = EI + IT.
      var ei = -fd.value;
      return { upper: ei + it, lower: ei };
    }
    // K..U: ES = -ei(shaft) + delta.
    var esH = -fd.value + deltaFor(size, letter, grade);
    return { upper: esH, lower: esH - it };
  }

  /* -------------------------------------------------------------- public API */

  var CLASS_RE = /^([A-Za-z]{1,2})\s*(\d{1,2})$/;

  /**
   * Parse a tolerance class such as "m6", "JS6", "H7".
   * Case decides the feature: uppercase letter = hole, lowercase = shaft. This
   * matches normal drawing practice and the brief's own m6 / JS6 usage.
   */
  function parseClass(str) {
    if (typeof str !== 'string') throw new Error('Tolerance class must be a string.');
    var m = CLASS_RE.exec(str.trim());
    if (!m) throw new Error('Could not read "' + str + '" as a tolerance class ' +
                            '(expected something like m6, h7 or JS6).');
    var letters = m[1];
    var grade = parseInt(m[2], 10);
    var isHole = letters[0] === letters[0].toUpperCase();
    // Accept "js6"/"JS6" and also the ISO typographic form written as "Js6".
    var norm = isHole ? letters.toUpperCase() : letters.toLowerCase();
    if (norm.length === 2 && norm.toUpperCase() !== 'JS') {
      throw new Error('Unknown tolerance letter "' + letters + '".');
    }
    return { letter: norm, grade: grade, kind: isHole ? 'hole' : 'shaft',
             label: norm + grade };
  }

  /** Deviations in um for any class string. */
  function deviations(size, classStr) {
    checkSize(size);
    var p = (typeof classStr === 'string') ? parseClass(classStr) : classStr;
    var d = (p.kind === 'hole')
      ? holeDeviation(size, p.letter, p.grade)
      : shaftDeviation(size, p.letter, p.grade);
    return { upper: d.upper, lower: d.lower, letter: p.letter, grade: p.grade,
             kind: p.kind, label: p.label || (p.letter + p.grade),
             it: itValue(size, p.grade) };
  }

  /** Limits in mm for any class string. Deviations are um, so scale by 1000. */
  function limits(size, classStr) {
    var d = deviations(size, classStr);
    var min = size + d.lower / 1000;
    var max = size + d.upper / 1000;
    return {
      basic: size,
      min: min,
      max: max,
      mean: (min + max) / 2,
      tolerance: max - min,       // mm
      toleranceUm: d.upper - d.lower,
      upper: d.upper,             // um
      lower: d.lower,             // um
      label: d.label,
      kind: d.kind,
      grade: d.grade,
      letter: d.letter,
      it: d.it
    };
  }

  /** Class strings valid at this size, for dropdowns and the suggestion ladder. */
  function availableClasses(size, kind) {
    checkSize(size);
    var table = (kind === 'hole') ? OFFERED_GRADES_HOLE : OFFERED_GRADES;
    var out = [];
    Object.keys(table).forEach(function (letter) {
      table[letter].forEach(function (grade) {
        var label = letter + grade;
        try {
          deviations(size, label);
          out.push(label);
        } catch (e) { /* not defined at this size (e.g. t6 at 3 mm) -- skip */ }
      });
    });
    return out;
  }

  return {
    itValue: itValue,
    deviations: deviations,
    limits: limits,
    parseClass: parseClass,
    availableClasses: availableClasses,
    deltaFor: deltaFor,
    symmetricHalf: symmetricHalf,
    MIN_SIZE: MIN_SIZE,
    MAX_SIZE: MAX_SIZE,
    RANGES_PRINCIPAL: R13,
    RANGES_FINE: R25
  };
})();
