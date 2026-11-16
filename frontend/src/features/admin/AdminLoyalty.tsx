import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { loyaltyService, tierNames, type EligibleTier, type TierCode, type TierPromotion } from '../../services/loyalty';
import { formatCurrency } from '../../utils/format';

const tierOrder: TierCode[] = ['SILVER', 'GOLD', 'DIAMOND'];
const blankPromotion = (): Omit<TierPromotion, 'id'> => ({
  name: '', eligibleTier: 'ALL', discountType: 'PERCENT', discountValue: 5,
  minSubtotal: 0, startsAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 30 * 86400000).toISOString(), isEnabled: true,
});
const localDate = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export function AdminLoyalty() {
  const settings = useQuery({ queryKey: ['admin-loyalty-settings'], queryFn: loyaltyService.settings });
  const promotions = useQuery({ queryKey: ['admin-tier-promotions'], queryFn: loyaltyService.promotions });
  const [conversion, setConversion] = useState(1000);
  const [months, setMonths] = useState(6);
  const [rules, setRules] = useState<Record<string, { minOrders: number; minSpend: number }>>({});
  const [editingId, setEditingId] = useState<string>();
  const [promotion, setPromotion] = useState<Omit<TierPromotion, 'id'>>(blankPromotion);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!settings.data) return;
    setConversion(settings.data.settings.vndPerPoint);
    setMonths(settings.data.settings.windowMonths);
    setRules(Object.fromEntries(settings.data.tiers.map((tier) => [tier.code, { minOrders: tier.minOrders, minSpend: tier.minSpend }])));
  }, [settings.data]);
  const report = async (action: () => Promise<unknown>) => {
    setSaving(true); setMessage('');
    try {
      await action();
      await Promise.all([settings.refetch(), promotions.refetch()]);
      setMessage('Đã lưu thay đổi.');
      return true;
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể lưu thay đổi.'); return false; }
    finally { setSaving(false); }
  };
  return <div className="space-y-6">
    <div><p className="text-xs font-bold uppercase text-brand">Chương trình thành viên</p><h1 className="text-3xl font-black uppercase">Tích điểm & ưu đãi</h1>
      <p className="text-sm text-slate-600 mt-2">Điểm được cộng một lần khi đơn đã giao và thanh toán. Hạng xét theo số đơn hoặc tổng tiền trong kỳ.</p></div>
    {message && <p role="status" className="panel text-sm">{message}</p>}
    {settings.isError ? <p className="panel text-red-600">Không tải được cấu hình. <button onClick={() => void settings.refetch()} className="underline">Thử lại</button></p> :
      <section className="panel space-y-5"><h2 className="text-xl font-bold">Quy tắc tích điểm</h2>
        <form className="flex flex-wrap items-end gap-4" onSubmit={(event) => { event.preventDefault(); void report(() => loyaltyService.saveSettings({ vndPerPoint: conversion, windowMonths: months })); }}>
          <label className="form-label">Số tiền để nhận 1 điểm<input className="field" type="number" min="100" max="1000000" required value={conversion} onChange={(event) => setConversion(Number(event.target.value))} /></label>
          <label className="form-label">Thời gian xét hạng (tháng)<input className="field" type="number" min="1" max="36" required value={months} onChange={(event) => setMonths(Number(event.target.value))} /></label>
          <button className="btn-primary" disabled={saving}>Lưu quy tắc</button>
        </form>
        <h3 className="font-bold">Mốc hạng</h3><div className="grid gap-3 lg:grid-cols-3">{tierOrder.map((code) => <form key={code} className="border p-4 space-y-3" onSubmit={(event) => {
          event.preventDefault(); void report(() => loyaltyService.saveTier(code, rules[code]));
        }}><h4 className="font-bold">{tierNames[code]}</h4>
          <label className="form-label">Số đơn tối thiểu<input className="field" type="number" min="1" required value={rules[code]?.minOrders ?? ''} onChange={(event) => setRules((current) => ({ ...current, [code]: { ...current[code], minOrders: Number(event.target.value) } }))} /></label>
          <label className="form-label">Hoặc chi tiêu từ<input className="field" type="number" min="1000" step="1000" required value={rules[code]?.minSpend ?? ''} onChange={(event) => setRules((current) => ({ ...current, [code]: { ...current[code], minSpend: Number(event.target.value) } }))} /></label>
          <button className="btn-secondary" disabled={saving}>Lưu mốc</button></form>)}</div>
      </section>}
    <section className="panel space-y-5"><h2 className="text-xl font-bold">Ưu đãi theo hạng</h2>
      <p className="text-sm text-slate-600">Ưu đãi được tính trên tiền hàng sau giảm giá sản phẩm. Nếu nhiều ưu đãi phù hợp, hệ thống chọn mức giảm cao nhất.</p>
      <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={(event) => {
        event.preventDefault();
        if (new Date(promotion.startsAt) >= new Date(promotion.endsAt)) { setMessage('Ngày kết thúc cần sau ngày bắt đầu.'); return; }
        void report(() => loyaltyService.savePromotion(promotion, editingId)).then((saved) => { if (saved) { setEditingId(undefined); setPromotion(blankPromotion()); } });
      }}>
        <label className="form-label md:col-span-2">Tên chương trình<input className="field" required maxLength={150} value={promotion.name} onChange={(event) => setPromotion({ ...promotion, name: event.target.value })} /></label>
        <label className="form-label">Áp dụng cho<select className="field" value={promotion.eligibleTier} onChange={(event) => setPromotion({ ...promotion, eligibleTier: event.target.value as EligibleTier })}>{Object.entries(tierNames).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
        <label className="form-label">Loại giảm<select className="field" value={promotion.discountType} onChange={(event) => setPromotion({ ...promotion, discountType: event.target.value as 'PERCENT' | 'FIXED' })}><option value="PERCENT">Phần trăm</option><option value="FIXED">Số tiền</option></select></label>
        <label className="form-label">Mức giảm<input className="field" type="number" min="1" max={promotion.discountType === 'PERCENT' ? 99 : undefined} required value={promotion.discountValue} onChange={(event) => setPromotion({ ...promotion, discountValue: Number(event.target.value) })} /></label>
        <label className="form-label">Đơn hàng tối thiểu<input className="field" type="number" min="0" required value={promotion.minSubtotal} onChange={(event) => setPromotion({ ...promotion, minSubtotal: Number(event.target.value) })} /></label>
        <label className="form-label">Bắt đầu<input className="field" type="datetime-local" required value={localDate(promotion.startsAt)} onChange={(event) => setPromotion({ ...promotion, startsAt: new Date(event.target.value).toISOString() })} /></label>
        <label className="form-label">Kết thúc<input className="field" type="datetime-local" required value={localDate(promotion.endsAt)} onChange={(event) => setPromotion({ ...promotion, endsAt: new Date(event.target.value).toISOString() })} /></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={promotion.isEnabled} onChange={(event) => setPromotion({ ...promotion, isEnabled: event.target.checked })} /> Đang áp dụng</label>
        <div className="flex gap-2"><button className="btn-primary" disabled={saving}>{editingId ? 'Lưu ưu đãi' : 'Thêm ưu đãi'}</button>{editingId && <button type="button" className="btn-secondary" onClick={() => { setEditingId(undefined); setPromotion(blankPromotion()); }}>Hủy sửa</button>}</div>
      </form>
      {promotions.isError ? <p className="text-red-600">Không tải được ưu đãi. <button className="underline" onClick={() => void promotions.refetch()}>Thử lại</button></p> :
        <div className="space-y-2">{promotions.data?.map((item) => <div key={item.id} className="border p-3 flex flex-wrap items-center justify-between gap-3">
          <div><p className="font-bold">{item.name} {!item.isEnabled && <span className="text-slate-500 text-sm">(Đã tắt)</span>}</p>
            <p className="text-sm text-slate-600">{tierNames[item.eligibleTier]} · Giảm {item.discountType === 'PERCENT' ? `${item.discountValue}%` : formatCurrency(item.discountValue)} · Từ {formatCurrency(item.minSubtotal)}</p></div>
          <div className="flex gap-3"><button className="underline" onClick={() => { setEditingId(item.id); setPromotion(item); }}>Sửa</button><button className="underline text-red-600" onClick={() => void report(() => loyaltyService.deletePromotion(item.id))}>Tắt</button></div>
        </div>)}{promotions.data?.length === 0 && <p className="text-slate-500">Chưa có ưu đãi theo hạng.</p>}</div>}
    </section>
  </div>;
}
