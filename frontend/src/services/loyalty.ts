import { httpClient } from './httpClient';

export type TierCode = 'MEMBER' | 'SILVER' | 'GOLD' | 'DIAMOND';
export type EligibleTier = TierCode | 'ALL';
export interface LoyaltySummary {
  tier: TierCode; points: number; orderCount: number; spent: number;
  windowMonths: number; vndPerPoint: number;
  offers: Pick<TierPromotion, 'name' | 'discountType' | 'discountValue' | 'minSubtotal' | 'endsAt'>[];
}
export interface LoyaltySettings {
  settings: { vndPerPoint: number; windowMonths: number };
  tiers: { code: TierCode; rank: number; minOrders: number; minSpend: number }[];
}
export interface TierPromotion {
  id: string; name: string; eligibleTier: EligibleTier;
  discountType: 'PERCENT' | 'FIXED'; discountValue: number;
  minSubtotal: number; startsAt: string; endsAt: string; isEnabled: boolean;
}
export const tierNames: Record<EligibleTier, string> = {
  ALL: 'Tất cả', MEMBER: 'Thành viên', SILVER: 'Bạc', GOLD: 'Vàng', DIAMOND: 'Kim Cương',
};
export const loyaltyService = {
  async mine() { return (await httpClient.get<{ data: LoyaltySummary }>('/loyalty/me')).data.data; },
  async quote(subtotal: number) { return (await httpClient.get<{ data: { discountAmount: number } }>('/loyalty/quote', { params: { subtotal } })).data.data; },
  async settings() { return (await httpClient.get<{ data: LoyaltySettings }>('/admin/loyalty/settings')).data.data; },
  async saveSettings(value: LoyaltySettings['settings']) {
    return (await httpClient.put('/admin/loyalty/settings', value)).data;
  },
  async saveTier(code: TierCode, value: { minOrders: number; minSpend: number }) {
    return (await httpClient.put(`/admin/loyalty/tiers/${code}`, value)).data;
  },
  async promotions() { return (await httpClient.get<{ data: TierPromotion[] }>('/admin/tier-promotions')).data.data; },
  async savePromotion(value: Omit<TierPromotion, 'id'>, id?: string) {
    return id ? httpClient.put(`/admin/tier-promotions/${id}`, value) : httpClient.post('/admin/tier-promotions', value);
  },
  async deletePromotion(id: string) { return httpClient.delete(`/admin/tier-promotions/${id}`); },
};
