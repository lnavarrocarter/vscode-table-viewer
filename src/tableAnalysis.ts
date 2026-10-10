import Decimal from 'decimal.js';

const Numeric = Decimal.clone({ precision: 50 });
export const filterOperators = ['contains', 'equals', 'notEquals', 'greater', 'less', 'empty', 'notEmpty'] as const;
export type FilterOperator = typeof filterOperators[number];
export const aggregations = ['COUNT', 'SUM', 'AVERAGE', 'MIN', 'MAX'] as const;

function numeric(value: string): Decimal | undefined {
  const text = value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text) || text.length > 100) return;
  const number = new Numeric(text);
  if (number.isFinite() && number.abs().lt('1e100')) return number;
}

export function matchesFilter(value: string, operator: FilterOperator, expected: string): boolean {
  if (operator === 'empty') return value.trim() === '';
  if (operator === 'notEmpty') return value.trim() !== '';
  if (operator === 'contains') return value.toLowerCase().includes(expected.toLowerCase());
  if (operator === 'equals') return value.toLowerCase() === expected.toLowerCase();
  if (operator === 'notEquals') return value.toLowerCase() !== expected.toLowerCase();
  const actual = numeric(value);
  const operand = numeric(expected);
  if (!actual || !operand) return false;
  return operator === 'greater' ? actual.gt(operand) : operator === 'less' ? actual.lt(operand) : false;
}

export function aggregateValues(values: string[], operation: typeof aggregations[number]): { value: string; numericCount: number; ignoredCount: number } {
  let count = 0;
  let total = new Numeric(0);
  let minimum: Decimal | undefined;
  let maximum: Decimal | undefined;
  for (const value of values) {
    const number = numeric(value);
    if (!number) continue;
    count++;
    total = total.plus(number);
    if (!minimum || number.lt(minimum)) minimum = number;
    if (!maximum || number.gt(maximum)) maximum = number;
  }
  const result = operation === 'COUNT' ? String(values.length)
    : !count ? '' : operation === 'SUM' ? total.toString()
    : operation === 'AVERAGE' ? total.div(count).toString()
    : operation === 'MIN' ? minimum!.toString() : maximum!.toString();
  return { value: result, numericCount: count, ignoredCount: values.length - count };
}