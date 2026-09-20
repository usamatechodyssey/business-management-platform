const RUPEE_SIGN = "Rs";

export function formatCurrency(amount: number): string {
  const rounded = Math.round(amount);
  const withCommas = rounded.toLocaleString("en-PK");
  return `${RUPEE_SIGN} ${withCommas}`;
}

export function formatDate(dateInput: string | Date, locale: "en" | "ur" = "en"): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return date.toLocaleDateString(locale === "ur" ? "ur-PK" : "en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatPercentage(value: number): string {
  return `${value}%`;
}

export function calculateFundAmount(profit: number, percentage: number): number {
  return Math.round((profit * percentage) / 100);
}