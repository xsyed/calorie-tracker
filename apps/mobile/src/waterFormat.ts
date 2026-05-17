export function formatWaterAmount(amountMl: number): string {
  if (Math.abs(amountMl) < 1000) return `${amountMl}ml`;

  const liters = amountMl / 1000;
  const value = Number.isInteger(liters)
    ? String(liters)
    : liters.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${value}L`;
}
