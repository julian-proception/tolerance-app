/*
 * suggest.js — hole options laid out along the two axes ISO actually uses.
 *
 * A hole class is two independent choices:
 *
 *   grade  (IT number)  ->  the WIDTH of the tolerance band
 *   letter (deviation)  ->  the POSITION of that band, i.e. the nominal diameter
 *
 * Width is set directly by the grade slider. Position is what decides whether the
 * fit is interference, transition or clearance, so the second slider walks the
 * available letters ordered by nominal diameter and the tool reports whichever ISO
 * class that lands on. The user moves a diameter; the class is the output.
 */
var HoleOptions = (function () {
  'use strict';

  // Preferred fits from ISO 286, written as "hole/shaft" -- the pairings with
  // established tooling and gauging behind them.
  var PREFERRED = {};
  [ 'H11/c11', 'H11/h11', 'H9/d9', 'H9/e9', 'H9/h9', 'H8/e8', 'H8/f7', 'H8/h7',
    'H7/g6', 'H7/h6', 'H7/js6', 'H7/k6', 'H7/m6', 'H7/n6', 'H7/p6', 'H7/r6',
    'H7/s6', 'H7/u6',
    'C11/h11', 'D9/h9', 'E9/h9', 'F8/h7', 'G7/h6', 'JS7/h6', 'K7/h6', 'M7/h6',
    'N7/h6', 'P7/h6', 'R7/h6', 'S7/h6', 'U7/h6'
  ].forEach(function (p) { PREFERRED[p] = true; });

  function isPreferred(holeLabel, pinLabel) {
    return !!PREFERRED[holeLabel + '/' + pinLabel];
  }

  /**
   * Grades that have at least one hole letter defined at this size, in ISO order.
   *
   * Grades are TOKENS, not numbers: IT01 and IT1 both parse to the integer 1, so
   * pulling the digits out of a label with a regex silently merges them.
   */
  function gradesFor(size) {
    var seen = {};
    ISO286.availableClasses(size, 'hole').forEach(function (label) {
      seen[ISO286.parseClass(label).grade] = true;
    });
    return ISO286.GRADES.filter(function (g) { return seen[g]; });
  }

  /**
   * Every hole class at this size and grade, ordered by nominal (mean) diameter
   * ascending -- so index 0 is the smallest hole (most interference) and the last
   * index is the largest (most clearance). That ordering is what makes the
   * position slider read left-to-right as interference -> clearance.
   *
   * Sorting by the computed mean rather than by a hardcoded letter order keeps the
   * slider monotonic even where the letter sequence would not be.
   */
  function forGrade(size, grade, pin) {
    var rows = ISO286.availableClasses(size, 'hole')
      .filter(function (label) {
        return ISO286.parseClass(label).grade === String(grade);
      })
      .map(function (label) {
        var hole = ISO286.limits(size, label);
        var row = {
          label: label,
          letter: hole.letter,
          hole: hole,
          meanDev: (hole.upper + hole.lower) / 2
        };
        if (pin) {
          row.wc = Fits.interference(pin, hole);
          row.fit = row.wc.fit;
          row.preferred = isPreferred(label, pin.label);
        }
        return row;
      });

    rows.sort(function (a, b) {
      if (a.meanDev !== b.meanDev) return a.meanDev - b.meanDev;
      return a.label < b.label ? -1 : 1;
    });
    return rows;
  }

  /**
   * Widest deviations reachable in the precision grades (IT5-IT7) at this size,
   * across both shaft and hole letters.
   *
   * This is what the circle view has to be scaled to accommodate. It is a
   * function of DIAMETER ALONE -- not of the classes currently selected -- which
   * is what lets the drawing scale stay pinned while the sliders move. Deriving
   * it from a fixed reference tolerance instead does not work: the ratio of the
   * most offset letter to the IT width grows with size (u is 2.8x IT7 at 3 mm but
   * 4.7x at 120 mm), so a single ratio holds at one size and clamps at another.
   */
  /*
   * Letters the drawing scale is sized for: f through u, the span in which
   * ordinary fits live. Deliberately NOT every letter -- the catalogue runs from
   * a to zc, and an a7 hole sits 270 um off basic at 3 mm, which would shrink the
   * scale by a factor of ten and leave every normal fit an invisible hairline.
   * Classes outside this span simply overflow and raise the alert, which is the
   * behaviour asked for: report it, let the user decide.
   */
  var SCALE_SPAN = ['f', 'fg', 'g', 'h', 'j', 'js', 'k', 'm', 'n', 'p', 'r',
                    's', 't', 'u'];

  function precisionExtremes(size) {
    var lo = 0, hi = 0;
    ['5', '6', '7'].forEach(function (grade) {
      ['shaft', 'hole'].forEach(function (kind) {
        ISO286.availableClasses(size, kind).forEach(function (label) {
          var pc = ISO286.parseClass(label);
          if (SCALE_SPAN.indexOf(pc.letter.toLowerCase()) < 0) return;
          if (pc.grade !== grade) return;
          var d = ISO286.deviations(size, label);
          if (d.lower < lo) lo = d.lower;
          if (d.upper > hi) hi = d.upper;
        });
      });
    });
    return { lo: lo, hi: hi };
  }

  /** Index of a label within a forGrade() list, or -1. */
  function indexOf(rows, label) {
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].label === label) return i;
    }
    return -1;
  }

  /**
   * Index whose nominal deviation is closest to a target, used to hold the
   * position steady when the grade changes underneath it.
   */
  function nearestIndex(rows, targetMeanDev) {
    var best = 0, bestD = Infinity;
    rows.forEach(function (r, i) {
      var d = Math.abs(r.meanDev - targetMeanDev);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  /**
   * Contiguous runs of like fit category across the ordered list, for painting
   * the slider track so the three regions are visible before you slide into them.
   * Returns [{fit, from, to}] with inclusive indices.
   */
  function bands(rows) {
    var out = [];
    rows.forEach(function (r, i) {
      var last = out[out.length - 1];
      if (last && last.fit === r.fit) last.to = i;
      else out.push({ fit: r.fit, from: i, to: i });
    });
    return out;
  }

  return {
    forGrade: forGrade,
    gradesFor: gradesFor,
    precisionExtremes: precisionExtremes,
    indexOf: indexOf,
    nearestIndex: nearestIndex,
    bands: bands,
    isPreferred: isPreferred,
    PREFERRED: PREFERRED
  };
})();
