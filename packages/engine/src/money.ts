/** v2 money is integer paise. JSON boundaries use canonical decimal strings. */
export type Money = bigint;
export const MONEY_LIMIT = 1_000_000_000_000n;
export function money(value: string | bigint): Money {
  if (typeof value === 'string' && !/^(0|[1-9]\d*)$/.test(value))
    throw new Error('Invalid unsigned paise.');
  const result = BigInt(value);
  if (result < 0n || result > MONEY_LIMIT)
    throw new Error('Paise amount is outside the supported bound.');
  return result;
}
export function checked(value: bigint): Money {
  if (value < 0n || value > MONEY_LIMIT)
    throw new Error('Money arithmetic exceeded the supported bound.');
  return value;
}
export const minMoney = (a: Money, b: Money) => (a < b ? a : b);
export const maxMoney = (a: Money, b: Money) => (a > b ? a : b);
export const halfUp = (numerator: bigint, denominator: bigint) => {
  if (numerator < 0n || denominator <= 0n) throw new Error('Rounding expects a nonnegative ratio.');
  return (numerator + denominator / 2n) / denominator;
};
export const weeklyInterest = (principal: Money, aprBps: number) =>
  checked(halfUp(principal * BigInt(aprBps), 520_000n));
