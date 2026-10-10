import Decimal from 'decimal.js';
import type { tableRows } from './tableJoin';

const Money = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
type Table = ReturnType<typeof tableRows>;
type Values = Array<Array<string | number | boolean | null>>;

function amount(value: unknown): Decimal {
  if ((typeof value !== 'number' && typeof value !== 'string') ||
      !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(value).trim())) throw new Error('Amounts must be finite numbers or plain decimal strings (no currency symbols or separators).');
  const parsed = new Money(String(value).trim());
  if (!parsed.isFinite() || parsed.abs().gte('1e15') || parsed.decimalPlaces() > 12) throw new Error('Amount exceeds supported precision or magnitude.');
  return parsed;
}

function group(table: Table, keyIndex: number, amountIndex: number) {
  if (![keyIndex, amountIndex].every(Number.isInteger) || keyIndex < 0 || amountIndex < 0 || keyIndex >= table.headers.length || amountIndex >= table.headers.length) throw new Error('Invalid financial field index.');
  const groups = new Map<string, { key: string | number | boolean; total: Decimal; count: number }>();
  for (const row of table.rows) {
    const key = row[keyIndex];
    if (key === null || key === '' || (typeof key === 'string' && !key.trim())) throw new Error('Financial analysis requires nonblank keys on every data row.');
    const id = JSON.stringify([typeof key, key]);
    const entry = groups.get(id) ?? { key, total: new Money(0), count: 0 };
    entry.total = entry.total.plus(amount(row[amountIndex]));
    entry.count++;
    groups.set(id, entry);
  }
  return groups;
}

function numeric(value: Decimal, places: number): number {
  const rounded = value.toDecimalPlaces(places);
  const number = rounded.toNumber();
  if (!Number.isFinite(number) || !new Money(number).equals(rounded) || rounded.abs().gte('1e15')) throw new Error('Result cannot be safely stored as a numeric cell. Narrow the analysis.');
  return number;
}

export function financialAnalysis(left: Table, right: Table, leftKey: number, rightKey: number, leftAmount: number, rightAmount: number,
  options: { mode: 'budget' | 'reconcile'; decimals: number; tolerance: string; favorable: 'higher' | 'lower' }) {
  if (!Number.isInteger(options.decimals) || options.decimals < 0 || options.decimals > 6) throw new Error('Choose 0 to 6 decimal places.');
  const tolerance = amount(options.tolerance);
  if (tolerance.isNegative()) throw new Error('Tolerance cannot be negative.');
  const actual = group(left, leftKey, leftAmount);
  const expected = group(right, rightKey, rightAmount);
  const keys = [...new Set([...actual.keys(), ...expected.keys()])];
  if (!keys.length) throw new Error('No financial records.');
  const values: Values = [options.mode === 'budget'
    ? ['Key', 'Actual', 'Budget', 'Difference', 'Variance ratio', 'Status', 'Actual rows', 'Budget rows']
    : ['Key', 'Left amount', 'Right amount', 'Difference', 'Status', 'Left rows', 'Right rows']];
  const statuses: Record<string, number> = {};
  for (const key of keys) {
    const leftGroup = actual.get(key);
    const rightGroup = expected.get(key);
    const leftTotal = (leftGroup?.total ?? new Money(0)).toDecimalPlaces(options.decimals);
    const rightTotal = (rightGroup?.total ?? new Money(0)).toDecimalPlaces(options.decimals);
    const difference = leftTotal.minus(rightTotal);
    let status: string;
    if (!leftGroup) status = options.mode === 'budget' ? 'ONLY_BUDGET' : 'ONLY_RIGHT';
    else if (!rightGroup) status = options.mode === 'budget' ? 'ONLY_ACTUAL' : 'ONLY_LEFT';
    else if (options.mode === 'reconcile' && (leftGroup.count > 1 || rightGroup.count > 1)) status = 'DUPLICATE_REVIEW';
    else if (difference.abs().lte(tolerance)) status = options.mode === 'budget' ? 'ON_BUDGET' : 'MATCHED';
    else if (options.mode === 'reconcile') status = 'DIFFERENCE';
    else status = (options.favorable === 'higher' ? difference.isPositive() : difference.isNegative()) ? 'FAVORABLE' : 'UNFAVORABLE';
    statuses[status] = (statuses[status] ?? 0) + 1;
    const base = [leftGroup?.key ?? rightGroup!.key, numeric(leftTotal, options.decimals), numeric(rightTotal, options.decimals), numeric(difference, options.decimals)];
    values.push(options.mode === 'budget'
      ? [...base, rightTotal.isZero() || !leftGroup || !rightGroup ? null : numeric(difference.dividedBy(rightTotal.abs()), 6), status, leftGroup?.count ?? 0, rightGroup?.count ?? 0]
      : [...base, status, leftGroup?.count ?? 0, rightGroup?.count ?? 0]);
    if (values.length * values[0].length > 100000) throw new Error('Financial result exceeds 100,000 cells.');
  }
  return { values, statuses, rounding: 'HALF_UP', decimals: options.decimals, tolerance: tolerance.toString() };
}