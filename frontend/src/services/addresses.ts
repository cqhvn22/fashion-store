import type { Address } from '../types/models';
import { httpClient, useDbAuth } from './httpClient';
import { readLocal, writeLocal } from './storage';

const endpoint = '/users/me/addresses';
const localKey = (userId: string) => `fashionhub_addresses_${userId}`;

export const addressService = {
  async list(userId: string): Promise<Address[]> {
    if (useDbAuth) {
      const { data } = await httpClient.get<{ data: Address[] }>(endpoint);
      return data.data;
    }
    return readLocal<Address[]>(localKey(userId), []);
  },

  async save(userId: string, address: Address): Promise<Address> {
    if (useDbAuth) {
      const { data } = address.id
        ? await httpClient.put<{ data: Address }>(`${endpoint}/${address.id}`, address)
        : await httpClient.post<{ data: Address }>(endpoint, address);
      return data.data;
    }
    const addresses = await this.list(userId);
    const saved = { ...address, id: address.id ?? crypto.randomUUID(),
      isDefault: address.isDefault ?? addresses.length === 0 };
    const next = address.id && addresses.some((item) => item.id === address.id)
      ? addresses.map((item) => item.id === address.id ? saved : item)
      : [...addresses, saved];
    writeLocal(localKey(userId), saved.isDefault
      ? next.map((item) => ({ ...item, isDefault: item.id === saved.id })) : next);
    return saved;
  },

  async remove(userId: string, id: string): Promise<void> {
    if (useDbAuth) {
      await httpClient.delete(`${endpoint}/${id}`);
      return;
    }
    const addresses = (await this.list(userId)).filter((item) => item.id !== id);
    if (addresses.length && !addresses.some((item) => item.isDefault))
      addresses[0].isDefault = true;
    writeLocal(localKey(userId), addresses);
  },
};

export function sameAddress(left: Address, right: Address): boolean {
  return (['recipientName', 'phone', 'province', 'ward', 'detail'] as const)
    .every((field) => left[field].trim() === right[field].trim());
}
