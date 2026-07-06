/**
 * Central definition of sellable product units.
 *
 * - `decimal: true` units (kg, ltr) can be sold in fractional quantities
 *   (e.g. 0.5 kg, 0.25 ltr) and have a smaller `subUnit` (g, ml) that
 *   staff can use to type quantities the way customers naturally think
 *   of them ("500 grams", "250 ml") instead of doing the math themselves.
 * - `decimal: false` units (pcs, pack, box, dozen, sack) are sold as
 *   whole numbers only (e.g. "3 sacks").
 */
const PRODUCT_UNITS = {
  pcs:   { label: 'Piece(s)',      short: 'pcs',   decimal: false, subUnit: null },
  pack:  { label: 'Pack(s)',       short: 'pack',  decimal: false, subUnit: null },
  box:   { label: 'Box(es)',       short: 'box',   decimal: false, subUnit: null },
  dozen: { label: 'Dozen',         short: 'dozen', decimal: false, subUnit: null },
  sack:  { label: 'Sack(s)',       short: 'sack',  decimal: false, subUnit: null },
  kg:    { label: 'Kilogram (kg)', short: 'kg',    decimal: true,  subUnit: { short: 'g',  factor: 1000 } },
  ltr:   { label: 'Litre (ltr)',   short: 'ltr',   decimal: true,  subUnit: { short: 'ml', factor: 1000 } }
};

const UNIT_KEYS = Object.keys(PRODUCT_UNITS);
const DEFAULT_UNIT = 'pcs';

function getUnitMeta(unit) {
  return PRODUCT_UNITS[unit] || PRODUCT_UNITS[DEFAULT_UNIT];
}

function isDecimalUnit(unit) {
  return getUnitMeta(unit).decimal === true;
}

// Round to a sane precision for weight/volume math (avoids 0.1+0.2 style drift)
function roundQty(qty, unit) {
  const n = Number(qty) || 0;
  if (isDecimalUnit(unit)) return Math.round(n * 1000) / 1000;
  return Math.round(n);
}

/**
 * Formats a quantity (always stored internally in the *base* unit, e.g. kg or ltr)
 * into a human-friendly string, switching to the sub-unit for small amounts.
 * e.g. formatQty(0.5, 'kg') -> "500 g", formatQty(2, 'kg') -> "2 kg"
 */
function formatQty(qty, unit) {
  const meta = getUnitMeta(unit);
  const n = Number(qty) || 0;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);

  if (meta.decimal) {
    if (meta.subUnit && abs < 1 && abs > 0) {
      const subVal = Math.round(abs * meta.subUnit.factor);
      return `${sign}${subVal} ${meta.subUnit.short}`;
    }
    const trimmed = parseFloat(abs.toFixed(3));
    return `${sign}${trimmed} ${meta.short}`;
  }
  return `${sign}${abs} ${meta.short}`;
}

module.exports = { PRODUCT_UNITS, UNIT_KEYS, DEFAULT_UNIT, getUnitMeta, isDecimalUnit, roundQty, formatQty };
