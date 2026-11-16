import { readLocal, writeLocal } from './storage';
import type { Address } from '../types/models';

export type CheckoutDraft = Pick<
  Address,
  'recipientName' | 'phone' | 'province' | 'ward' | 'detail'
> & { note: string };

const keyFor = (userId: string) => `fashionhub_checkout_${userId}`;

export function readCheckoutDraft(userId: string): CheckoutDraft | null {
  return readLocal<CheckoutDraft | null>(keyFor(userId), null);
}

export function saveCheckoutDraft(userId: string, draft: CheckoutDraft) {
  try {
    writeLocal(keyFor(userId), draft);
  } catch {
    // Checkout remains usable if the browser blocks local storage.
  }
}
