/*
 * materials.js — material property table, parsed from data/materials.csv.
 *
 * The CSV is the single source of truth. It is not fetched at runtime: index.html
 * is meant to open straight off disk and a file:// page cannot fetch a sibling
 * file, so ./tools/build-materials.sh bakes the CSV text into
 * js/materials-data.js and this module parses that string. Editing the CSV and
 * rerunning the script is the whole workflow; nothing here hardcodes a property.
 *
 * Units as stored in the CSV are kept in the record under their original names
 * (GPa, MPa, um/m/K). press.js converts to SI at the point of use, so there is
 * exactly one place where a unit conversion can be wrong.
 */
var Materials = (function () {
  'use strict';

  // Columns that must parse as finite numbers. A row missing any of them is a
  // data error worth failing loudly on rather than rendering as NaN in the UI.
  var NUMERIC = [
    'density_kg_m3', 'youngs_modulus_gpa', 'poissons_ratio',
    'tensile_strength_mpa', 'yield_strength_mpa', 'shear_strength_mpa',
    'cte_um_m_k', 'friction_dry'
  ];

  /* --------------------------------------------------------------- CSV parsing */

  /**
   * Split one CSV line, honouring double-quoted fields and "" escapes. The source
   * column contains commas, so a naive split(',') silently truncates it.
   */
  function splitLine(line) {
    var out = [], field = '', inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var c = line.charAt(i);
      if (inQuotes) {
        if (c === '"') {
          if (line.charAt(i + 1) === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        out.push(field); field = '';
      } else {
        field += c;
      }
    }
    out.push(field);
    return out;
  }

  /**
   * Parse CSV text into records of plain strings. Blank lines and lines starting
   * with '#' are comments; the first surviving line is the header.
   *
   * Deliberately knows nothing about materials: it is the general CSV step, and
   * parseMaterials() below layers the schema on top. Keeping them apart means the
   * quoting behaviour can be tested against a two-line fixture.
   */
  function parseCsv(text) {
    var lines = String(text).split(/\r?\n/).filter(function (l) {
      return l.trim() !== '' && l.charAt(0) !== '#';
    });
    if (!lines.length) throw new Error('CSV is empty');

    var header = splitLine(lines[0]).map(function (h) { return h.trim(); });
    var rows = [];

    for (var i = 1; i < lines.length; i++) {
      var cells = splitLine(lines[i]);
      if (cells.length !== header.length) {
        throw new Error('CSV row ' + (i + 1) + ' has ' + cells.length +
                        ' fields, header has ' + header.length);
      }
      var rec = {};
      header.forEach(function (h, j) { rec[h] = cells[j].trim(); });
      rows.push(rec);
    }
    return rows;
  }

  /**
   * Parse the materials CSV and enforce the schema: every NUMERIC column must be a
   * finite number and every row must carry a key. Failing loudly here is the point
   * -- a missing modulus that reached the UI would render as NaN forces, and a
   * mistyped one would rescale every force silently.
   */
  function parseMaterials(text) {
    var rows = parseCsv(text);
    rows.forEach(function (rec, i) {
      if (!rec.key) throw new Error('materials.csv row ' + (i + 2) + ' has no key');
      NUMERIC.forEach(function (h) {
        var v = parseFloat(rec[h]);
        if (!isFinite(v)) {
          throw new Error('materials.csv: ' + rec.key + ' has a non-numeric ' +
                          h + ' (' + rec[h] + ')');
        }
        rec[h] = v;
      });
    });
    return rows;
  }

  /* ------------------------------------------------------------------ accessors */

  var LIST = parseMaterials(MaterialsData.csv);
  var BY_KEY = {};
  LIST.forEach(function (m) {
    if (BY_KEY[m.key]) throw new Error('materials.csv: duplicate key ' + m.key);
    BY_KEY[m.key] = m;
  });

  function all() { return LIST.slice(); }

  function get(key) {
    var m = BY_KEY[key];
    if (!m) throw new Error('Unknown material: ' + key);
    return m;
  }

  function has(key) { return !!BY_KEY[key]; }

  /** Key of the first material, used as the default selection. */
  function defaultKey() { return LIST[0].key; }

  /**
   * Estimated static friction coefficient for a pair of materials: the mean of
   * the two self-mated values. Friction is an interface property and no
   * per-material table can be right about it, so this is deliberately a crude
   * generalisation that the UI lets the user overwrite.
   */
  function pairFriction(a, b) {
    return (get(a).friction_dry + get(b).friction_dry) / 2;
  }

  return {
    parseCsv: parseCsv,
    parseMaterials: parseMaterials,
    splitLine: splitLine,
    all: all,
    get: get,
    has: has,
    defaultKey: defaultKey,
    pairFriction: pairFriction,
    NUMERIC: NUMERIC
  };
})();
