/*
 * suggest.js — ranked ladder of hole tolerances for a given pin.
 *
 * Produces three groups (interference / transition / clearance), each sorted by
 * mean interference descending, so the ladder reads top to bottom as tight ->
 * loose. The app does not assume hole-basis fits: the pin may carry any class,
 * and every valid hole class is evaluated against it.
 */
var Suggest = (function () {
  'use strict';

  // Preferred fits from ISO 286, written as "hole/shaft". These are the pairings
  // with established tooling, gauging and published assembly practice behind
  // them, so they are worth flagging even when a neighbouring class fits better
  // numerically. Union of the hole-basis and shaft-basis preferred selections.
  var PREFERRED = {};
  [ // hole basis (H hole, varying shaft)
    'H11/c11', 'H11/h11', 'H9/d9', 'H9/e9', 'H9/h9', 'H8/e8', 'H8/f7', 'H8/h7',
    'H7/g6', 'H7/h6', 'H7/js6', 'H7/k6', 'H7/m6', 'H7/n6', 'H7/p6', 'H7/r6',
    'H7/s6', 'H7/u6',
    // shaft basis (h shaft, varying hole)
    'C11/h11', 'D9/h9', 'E9/h9', 'F8/h7', 'G7/h6', 'JS7/h6', 'K7/h6', 'M7/h6',
    'N7/h6', 'P7/h6', 'R7/h6', 'S7/h6', 'U7/h6'
  ].forEach(function (p) { PREFERRED[p] = true; });

  function isPreferred(holeLabel, pinLabel) {
    return !!PREFERRED[holeLabel + '/' + pinLabel];
  }

  /**
   * Evaluate every sensible hole class against the pin.
   *
   * @param size      basic size in mm
   * @param pinLimits limits object for the pin (from ISO286.limits, or a custom
   *                  deviation object with the same shape)
   * @param opts      {k, meanShift, perGroup, grades}
   */
  function ladder(size, pinLimits, opts) {
    opts = opts || {};
    var perGroup = opts.perGroup || 6;

    // Which IT grades to consider for the hole. IT6-IT8 covers normal precision
    // work; the pin's own grade and one coarser are added so the hole can be
    // matched to the pin rather than to a fixed assumption.
    var gradeSet = {};
    (opts.grades || [6, 7, 8]).forEach(function (g) { gradeSet[g] = true; });
    if (pinLimits.grade) {
      gradeSet[pinLimits.grade] = true;
      gradeSet[pinLimits.grade + 1] = true;
    }

    var candidates = ISO286.availableClasses(size, 'hole').filter(function (label) {
      var grade = parseInt(label.replace(/[^0-9]/g, ''), 10);
      return gradeSet[grade];
    });

    var rows = candidates.map(function (label) {
      var hole = ISO286.limits(size, label);
      var stats = Fits.rss(pinLimits, hole, opts);
      return {
        label: label,
        hole: hole,
        wc: stats.worstCase,
        rss: stats,
        fit: stats.worstCase.fit,
        preferred: isPreferred(label, pinLimits.label)
      };
    });

    var groups = { interference: [], transition: [], clearance: [] };
    rows.forEach(function (r) { groups[r.fit].push(r); });

    Object.keys(groups).forEach(function (key) {
      // Tightest first within every group: highest mean interference at the top.
      groups[key].sort(function (a, b) {
        if (b.wc.mean !== a.wc.mean) return b.wc.mean - a.wc.mean;
        // Tie-break: prefer the ISO preferred pairing, then the tighter hole.
        if (a.preferred !== b.preferred) return a.preferred ? -1 : 1;
        return a.hole.toleranceUm - b.hole.toleranceUm;
      });
    });

    /*
     * Trim each group from the MIDDLE, not the tail.
     *
     * Both ends of a group are interesting and they mean different things: the
     * head is the tightest option, the tail the loosest. Keeping only the head
     * hides exactly the rows an engineer reaches for most -- the bottom of the
     * transition group, where a fit is barely-clearance, and the top of the
     * clearance group. Any ISO preferred fit is also kept wherever it falls, so a
     * badge can never be truncated out of sight.
     */
    var result = {};
    Object.keys(groups).forEach(function (key) {
      var all = groups[key];
      var keep = {};
      if (all.length <= perGroup) {
        all.forEach(function (r, i) { keep[i] = true; });
      } else {
        var headN = Math.ceil(perGroup / 2);
        var tailN = perGroup - headN;
        for (var i = 0; i < headN; i++) keep[i] = true;
        for (var j = Math.max(headN, all.length - tailN); j < all.length; j++) keep[j] = true;
        all.forEach(function (r, i) { if (r.preferred) keep[i] = true; });
      }
      var rows = [], prev = -1;
      all.forEach(function (r, i) {
        if (!keep[i]) return;
        // How many classes were skipped immediately before this row, so the UI can
        // show the elision instead of implying the list is contiguous.
        r.skippedBefore = (prev >= 0) ? (i - prev - 1) : 0;
        rows.push(r);
        prev = i;
      });
      result[key] = {
        rows: rows,
        total: all.length,
        hidden: all.length - rows.length
      };
    });
    return result;
  }

  return { ladder: ladder, isPreferred: isPreferred, PREFERRED: PREFERRED };
})();
