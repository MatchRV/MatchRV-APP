// Ported from ui/components/Formatters.kt
import { Brand } from '@/theme';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatPrice(amount: number | null | undefined): string {
  if (amount == null || amount <= 0) return 'Price on request';
  return currency.format(amount);
}

export function formatLength(feet: number | null | undefined): string | null {
  if (feet == null || feet <= 0) return null;
  const rounded = Math.round(feet * 10) / 10;
  return `${rounded} ft`; // JS prints 30 (not 30.0), matching Kotlin's integer branch
}

export function formatWeight(lbs: number | null | undefined): string | null {
  if (lbs == null || lbs <= 0) return null;
  return `${integer.format(Math.round(lbs))} lbs`;
}

export function formatDistance(miles: number | null | undefined): string | null {
  if (miles == null || miles < 0) return null;
  return `${integer.format(Math.round(miles))} mi`;
}

export function formatCount(n: number): string {
  return integer.format(n);
}

export function inquiryStatusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case 'delivered':
      return 'Delivered to Dealer';
    case 'queued_for_matchrv':
      return 'Queued via MatchRV';
    case 'replied':
      return 'Dealer Replied';
    case 'dry_run':
      return 'Test Dry Run';
    case 'failed':
      return 'Delivery Failed';
    default: {
      const s = status.replace(/_/g, ' ');
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
  }
}

export function inquiryStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'delivered':
    case 'replied':
      return Brand.aqua;
    case 'queued_for_matchrv':
    case 'dry_run':
      return Brand.amber;
    case 'failed':
      return Brand.passCoral;
    default:
      return Brand.ember;
  }
}

export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'string' && e) return e;
  return fallback;
}
