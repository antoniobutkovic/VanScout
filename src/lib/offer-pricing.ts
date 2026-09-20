export const CROATIA_STANDARD_VAT_RATE = 25;

export function offerPriceFromEnteredAmount(amountCents: number, vatIncluded: boolean) {
  if (vatIncluded) {
    const vatCents = Math.round(amountCents * CROATIA_STANDARD_VAT_RATE / (100 + CROATIA_STANDARD_VAT_RATE));
    return { netCents: amountCents - vatCents, vatCents, totalCents: amountCents };
  }

  const vatCents = Math.round(amountCents * CROATIA_STANDARD_VAT_RATE / 100);
  return { netCents: amountCents, vatCents, totalCents: amountCents + vatCents };
}

export function offerPriceFromTotal(totalCents: number) {
  const vatCents = Math.round(totalCents * CROATIA_STANDARD_VAT_RATE / (100 + CROATIA_STANDARD_VAT_RATE));
  return { netCents: totalCents - vatCents, vatCents, totalCents };
}
