import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Ban,
  Calendar,
  Clock,
  Edit2,
  Eye,
  Folder,
  Globe,
  Layers,
  Percent,
  Plus,
  RotateCcw,
  Search,
  Tag,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { EmptyState, ErrorState, PageHeading } from '../../components/common';
import { categoryService, productService } from '../../services/catalog';
import {
  isProductEligible,
  promotionService,
  type PromotionInput,
} from '../../services/promotions';
import type { ProductPromotion } from '../../types/models';
import { formatCurrency, formatDate } from '../../utils/format';
import { showProductPlaceholder } from '../../utils/images';

function localDateTime(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function emptyPromotion(defaultProductIds: string[] = []): PromotionInput {
  const now = Date.now();
  return {
    name: '',
    discountType: 'PERCENT',
    discountValue: 10,
    startsAt: new Date(now).toISOString(),
    endsAt: new Date(now + 7 * 86400000).toISOString(),
    isEnabled: true,
    targetType: 'CATEGORY',
    categoryIds: [],
    productIds: defaultProductIds,
    excludedProductIds: [],
  };
}

const stateConfig = {
  ACTIVE: {
    label: 'Đang áp dụng',
    tone: 'success' as const,
    badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  },
  SCHEDULED: {
    label: 'Sắp diễn ra',
    tone: 'neutral' as const,
    badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
  },
  ENDED: {
    label: 'Đã kết thúc',
    tone: 'neutral' as const,
    badgeClass: 'bg-slate-100 text-slate-600 border border-slate-200',
  },
  DISABLED: {
    label: 'Đã tắt',
    tone: 'neutral' as const,
    badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
};

export function AdminPromotions() {
  const client = useQueryClient();

  const {
    data: promotions = [],
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-promotions'],
    queryFn: promotionService.list,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['admin-products'],
    queryFn: productService.listAdmin,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: categoryService.listAdmin,
  });

  const [editing, setEditing] = useState<ProductPromotion | 'new' | null>(null);
  const [viewingProductsPromo, setViewingProductsPromo] = useState<ProductPromotion | null>(null);
  const [form, setForm] = useState<PromotionInput>(emptyPromotion([]));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Table filtering & search state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [targetFilter, setTargetFilter] = useState<string>('ALL');

  // Modal product search & category filter
  const [productSearch, setProductSearch] = useState('');
  const [productCatFilter, setProductCatFilter] = useState('');
  const [excludeSearch, setExcludeSearch] = useState('');

  useEffect(() => {
    if (editing === 'new') {
      const defaultCatId = categories[0]?.id ? [categories[0].id] : [];
      setForm({
        ...emptyPromotion([]),
        categoryIds: defaultCatId,
        excludedProductIds: [],
      });
    } else if (editing) {
      setForm({
        name: editing.name,
        discountType: editing.discountType,
        discountValue: editing.discountValue,
        startsAt: editing.startsAt,
        endsAt: editing.endsAt,
        isEnabled: editing.isEnabled,
        targetType: editing.targetType ?? (editing.productId ? 'PRODUCT' : 'ALL'),
        categoryIds: editing.categoryIds ?? [],
        productIds: editing.productIds ?? (editing.productId ? [editing.productId] : []),
        excludedProductIds: editing.excludedProductIds ?? [],
        productId: editing.productId,
      });
    }
    setFormError('');
    setProductSearch('');
    setProductCatFilter('');
    setExcludeSearch('');
  }, [editing, categories]);

  useEffect(() => {
    if (!editing) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEditing(null);
    };
    document.addEventListener('keydown', close);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', close);
      document.body.style.overflow = previous;
    };
  }, [editing]);

  // Compute products count per category
  const countPerCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const prod of products) {
      map.set(prod.categoryId, (map.get(prod.categoryId) ?? 0) + 1);
    }
    return map;
  }, [products]);

  // Products belonging to the currently selected categories
  const productsInSelectedCategories = useMemo(() => {
    if (!form.categoryIds || form.categoryIds.length === 0) return [];
    return products.filter((prod) => {
      if (form.categoryIds!.includes(prod.categoryId)) return true;
      let cur = categories.find((c) => c.id === prod.categoryId);
      while (cur?.parentId) {
        if (form.categoryIds!.includes(cur.parentId)) return true;
        cur = categories.find((c) => c.id === cur?.parentId);
      }
      return false;
    });
  }, [products, categories, form.categoryIds]);

  // Exclude product filter
  const filteredExcludeProducts = useMemo(() => {
    if (!excludeSearch.trim()) return productsInSelectedCategories;
    const q = excludeSearch.toLowerCase();
    return productsInSelectedCategories.filter(
      (p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
    );
  }, [productsInSelectedCategories, excludeSearch]);

  // Filtered products inside modal
  const modalFilteredProducts = useMemo(() => {
    return products.filter((prod) => {
      if (productCatFilter && prod.categoryId !== productCatFilter) return false;
      if (productSearch) {
        const query = productSearch.toLowerCase();
        const matchesName = prod.name.toLowerCase().includes(query);
        const matchesSlug = prod.slug.toLowerCase().includes(query);
        return matchesName || matchesSlug;
      }
      return true;
    });
  }, [products, productSearch, productCatFilter]);

  // Number of eligible products for current form
  const eligibleProducts = useMemo(() => {
    const dummyPromo: ProductPromotion = {
      id: 'preview',
      name: form.name,
      discountType: form.discountType,
      discountValue: form.discountValue,
      startsAt: form.startsAt,
      endsAt: form.endsAt,
      isEnabled: form.isEnabled,
      targetType: form.targetType,
      categoryIds: form.categoryIds,
      productIds: form.productIds,
      excludedProductIds: form.excludedProductIds,
      productId: form.productId,
    };
    return products.filter((p) => isProductEligible(p, dummyPromo, categories));
  }, [products, categories, form]);

  // Sample product for live preview
  const sampleProduct = eligibleProducts[0] ?? products[0];
  const sampleLowest =
    sampleProduct?.variants.reduce((min, variant) => Math.min(min, variant.price), Infinity) ?? 0;
  const sampleDiscounted =
    form.discountType === 'PERCENT'
      ? Math.max(1000, Math.floor((sampleLowest * (100 - form.discountValue)) / 100))
      : Math.max(1000, sampleLowest - form.discountValue);

  // Filtered promotions for display table
  const displayedPromotions = useMemo(() => {
    return promotions.filter((promo) => {
      if (statusFilter !== 'ALL' && promo.state !== statusFilter) return false;
      if (targetFilter !== 'ALL') {
        const type = promo.targetType ?? (promo.productId ? 'PRODUCT' : 'ALL');
        if (type !== targetFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = promo.name.toLowerCase().includes(q);
        const matchProduct = promo.productName?.toLowerCase().includes(q);
        return matchName || matchProduct;
      }
      return true;
    });
  }, [promotions, statusFilter, targetFilter, searchQuery]);

  // KPI stats
  const stats = useMemo(() => {
    let active = 0;
    let scheduled = 0;
    let ended = 0;
    let disabled = 0;
    for (const p of promotions) {
      if (p.state === 'ACTIVE') active++;
      else if (p.state === 'SCHEDULED') scheduled++;
      else if (p.state === 'ENDED') ended++;
      else if (p.state === 'DISABLED') disabled++;
    }
    return { total: promotions.length, active, scheduled, ended, disabled };
  }, [promotions]);

  const toggleCategory = (categoryId: string) => {
    const current = form.categoryIds ?? [];
    const next = current.includes(categoryId)
      ? current.filter((id) => id !== categoryId)
      : [...current, categoryId];
    setForm({ ...form, categoryIds: next });
  };

  const selectAllCategories = () => {
    setForm({ ...form, categoryIds: categories.map((c) => c.id) });
  };

  const deselectAllCategories = () => {
    setForm({ ...form, categoryIds: [], excludedProductIds: [] });
  };

  const toggleExcludeProduct = (productId: string) => {
    const current = form.excludedProductIds ?? [];
    const next = current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId];
    setForm({ ...form, excludedProductIds: next });
  };

  const toggleProduct = (productId: string) => {
    const current = form.productIds ?? [];
    const next = current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId];
    setForm({ ...form, productIds: next, productId: next[0] });
  };

  const selectAllModalProducts = () => {
    const currentIds = new Set(form.productIds ?? []);
    for (const p of modalFilteredProducts) {
      currentIds.add(p.id);
    }
    const arr = Array.from(currentIds);
    setForm({ ...form, productIds: arr, productId: arr[0] });
  };

  const deselectAllProducts = () => {
    setForm({ ...form, productIds: [], productId: undefined });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();

    if (!name || name.length > 150) {
      setFormError('Vui lòng nhập tên chương trình giảm giá (tối đa 150 ký tự).');
      return;
    }
    if (!Number.isSafeInteger(form.discountValue) || form.discountValue <= 0) {
      setFormError('Mức giảm giá phải là số nguyên dương lớn hơn 0.');
      return;
    }
    if (form.discountType === 'PERCENT' && form.discountValue > 99) {
      setFormError('Mức giảm phần trăm không được vượt quá 99%.');
      return;
    }
    if (!form.startsAt || !form.endsAt || new Date(form.startsAt) >= new Date(form.endsAt)) {
      setFormError('Thời gian kết thúc phải sau thời gian bắt đầu.');
      return;
    }

    if (form.targetType === 'CATEGORY' && (!form.categoryIds || form.categoryIds.length === 0)) {
      setFormError('Vui lòng chọn ít nhất một danh mục áp dụng.');
      return;
    }

    if (
      form.targetType === 'PRODUCT' &&
      (!form.productIds || form.productIds.length === 0) &&
      !form.productId
    ) {
      setFormError('Vui lòng chọn ít nhất một sản phẩm áp dụng.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      await promotionService.save(
        {
          ...form,
          name,
          productId:
            form.targetType === 'PRODUCT' && form.productIds?.length === 1
              ? form.productIds[0]
              : form.productId,
        },
        editing && editing !== 'new' ? editing.id : undefined
      );

      await client.invalidateQueries({ queryKey: ['admin-promotions'] });
      await client.invalidateQueries({ queryKey: ['admin-products'] });
      await client.invalidateQueries({ queryKey: ['products'] });
      setEditing(null);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Không lưu được chương trình.');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnable = async (promotion: ProductPromotion) => {
    const nextState = !promotion.isEnabled;
    const confirmMsg = nextState
      ? `Bật lại chương trình “${promotion.name}”?`
      : `Tắt chương trình “${promotion.name}”?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await promotionService.save(
        {
          name: promotion.name,
          discountType: promotion.discountType,
          discountValue: promotion.discountValue,
          startsAt: promotion.startsAt,
          endsAt: promotion.endsAt,
          isEnabled: nextState,
          targetType: promotion.targetType,
          categoryIds: promotion.categoryIds,
          productIds: promotion.productIds,
          excludedProductIds: promotion.excludedProductIds,
          productId: promotion.productId,
        },
        promotion.id
      );
      await client.invalidateQueries();
    } catch (caught) {
      alert(caught instanceof Error ? caught.message : 'Thao tác không thành công.');
    }
  };

  const removePromotion = async (promotion: ProductPromotion) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn chương trình “${promotion.name}”?`)) {
      return;
    }
    try {
      await promotionService.remove(promotion.id);
      await client.invalidateQueries();
    } catch (caught) {
      alert(caught instanceof Error ? caught.message : 'Không xóa được chương trình.');
    }
  };

  const handleResetDefaults = async () => {
    if (
      !window.confirm(
        'Khôi phục danh sách chương trình giảm giá mẫu mặc định (Flash sale Đầm & Váy, Ưu đãi Áo Nam, Xả kho Phụ Kiện)?'
      )
    ) {
      return;
    }
    await promotionService.resetDefaults();
    await client.invalidateQueries();
  };

  // Helper to render readable target description
  const renderTargetInfo = (promotion: ProductPromotion) => {
    const type = promotion.targetType ?? (promotion.productId ? 'PRODUCT' : 'ALL');

    if (type === 'ALL') {
      return (
        <button
          type="button"
          onClick={() => setViewingProductsPromo(promotion)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink bg-slate-100 hover:bg-slate-200 border border-slate-300 px-2.5 py-1 rounded transition-colors text-left"
          title="Bấm để xem danh sách sản phẩm áp dụng"
        >
          <Globe size={14} className="text-slate-600" />
          Toàn bộ cửa hàng ({promotion.appliedCount ?? products.length} sản phẩm)
          <Eye size={12} className="ml-1 text-slate-500" />
        </button>
      );
    }

    if (type === 'CATEGORY') {
      const catNames = (promotion.categoryIds ?? [])
        .map((cid) => categories.find((c) => c.id === cid)?.name)
        .filter(Boolean);
      const excludedCount = promotion.excludedProductIds?.length ?? 0;
      return (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setViewingProductsPromo(promotion)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-0.5 rounded transition-colors text-left"
              title="Bấm để xem chi tiết các sản phẩm áp dụng"
            >
              <Folder size={13} /> {catNames.length} danh mục ({promotion.appliedCount ?? 0} sp)
              <Eye size={12} className="ml-1 text-brand" />
            </button>
            {excludedCount > 0 && (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                Bỏ {excludedCount} sp
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 line-clamp-1 max-w-[280px]">
            {catNames.join(', ') || 'Chưa chọn'}
          </div>
        </div>
      );
    }

    // Product specific
    const count = promotion.productIds?.length ?? (promotion.productId ? 1 : 0);
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => setViewingProductsPromo(promotion)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded transition-colors text-left"
          title="Bấm để xem danh sách sản phẩm đã chọn"
        >
          <Tag size={13} /> {count} sản phẩm
          <Eye size={12} className="ml-1 text-blue-700" />
        </button>
        <div className="text-[11px] text-slate-500 line-clamp-1 max-w-[280px]">
          {promotion.productName || (count > 0 ? `${count} sản phẩm đã chọn` : '')}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Heading with Action Button */}
      <PageHeading
        title="Chương trình giảm giá"
        eyebrow="KHUYẾN MÃI"
        description="Quản lý các chương trình ưu đãi, flash sale linh hoạt theo danh mục hoặc theo từng nhóm sản phẩm được chọn."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-outline inline-flex items-center gap-1.5 text-xs bg-white py-2"
              onClick={() => void handleResetDefaults()}
              title="Khôi phục lại 3 chương trình mẫu mặc định (Flash sale Đầm & Váy, Ưu đãi Áo Nam, Xả kho Phụ Kiện)"
            >
              <RotateCcw size={14} /> Khôi phục mẫu
            </button>
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-2 shadow-sm py-2"
              onClick={() => setEditing('new')}
            >
              <Plus size={16} /> Tạo chương trình mới
            </button>
          </div>
        }
      />

      {error && <ErrorState error={error} retry={() => void refetch()} />}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 border border-[#eee] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Layers size={20} />
          </div>
          <div>
            <div className="text-xl font-black text-ink">{stats.total}</div>
            <div className="text-xs text-slate-500 font-medium">Tổng chương trình</div>
          </div>
        </div>

        <div className="bg-white p-4 border border-[#eee] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Zap size={20} />
          </div>
          <div>
            <div className="text-xl font-black text-emerald-600">{stats.active}</div>
            <div className="text-xs text-slate-500 font-medium">Đang áp dụng</div>
          </div>
        </div>

        <div className="bg-white p-4 border border-[#eee] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-xl font-black text-blue-600">{stats.scheduled}</div>
            <div className="text-xs text-slate-500 font-medium">Sắp diễn ra</div>
          </div>
        </div>

        <div className="bg-white p-4 border border-[#eee] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
            <AlertCircle size={20} />
          </div>
          <div>
            <div className="text-xl font-black text-slate-600">{stats.ended + stats.disabled}</div>
            <div className="text-xs text-slate-500 font-medium">Đã tắt / Hết hạn</div>
          </div>
        </div>
      </div>

      {/* Toolbar: Search & Filter */}
      <div className="bg-white p-4 border border-[#eee] shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên chương trình, sản phẩm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="field pl-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="field text-xs py-1.5"
            aria-label="Lọc theo trạng thái"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang áp dụng</option>
            <option value="SCHEDULED">Sắp diễn ra</option>
            <option value="ENDED">Đã kết thúc</option>
            <option value="DISABLED">Đã tắt</option>
          </select>

          <select
            value={targetFilter}
            onChange={(e) => setTargetFilter(e.target.value)}
            className="field text-xs py-1.5"
            aria-label="Lọc theo phạm vi áp dụng"
          >
            <option value="ALL">Tất cả phạm vi</option>
            <option value="CATEGORY">Theo danh mục</option>
            <option value="PRODUCT">Theo sản phẩm</option>
            <option value="ALL_STORE">Toàn bộ cửa hàng</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="panel overflow-x-auto bg-white border border-[#eee] shadow-sm">
        {displayedPromotions.length > 0 ? (
          <table className="data-table min-w-[900px]">
            <thead>
              <tr>
                <th>Chương trình</th>
                <th>Mức giảm</th>
                <th>Phạm vi áp dụng</th>
                <th>Thời gian</th>
                <th>Trạng thái</th>
                <th className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {displayedPromotions.map((promo) => {
                const config = stateConfig[promo.state ?? 'DISABLED'];
                return (
                  <tr key={promo.id} className="hover:bg-slate-50 transition-colors">
                    <td>
                      <div className="font-bold text-ink text-sm">{promo.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Mã: {promo.id.slice(0, 8)}
                      </div>
                    </td>

                    <td>
                      <span className="inline-flex items-center gap-1 font-black text-brand text-sm bg-red-50 border border-red-200 px-2.5 py-1 rounded">
                        {promo.discountType === 'PERCENT' ? (
                          <>
                            <Percent size={14} /> Giảm {promo.discountValue}%
                          </>
                        ) : (
                          formatCurrency(promo.discountValue)
                        )}
                      </span>
                    </td>

                    <td>{renderTargetInfo(promo)}</td>

                    <td>
                      <div className="text-xs font-medium text-slate-700 flex items-center gap-1">
                        <Calendar size={13} className="text-slate-400 shrink-0" />
                        {formatDate(promo.startsAt)}
                      </div>
                      <div className="text-xs text-slate-500 pl-4">đến {formatDate(promo.endsAt)}</div>
                    </td>

                    <td>
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${config.badgeClass}`}>
                        {config.label}
                      </span>
                    </td>

                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void toggleEnable(promo)}
                          className={`text-xs px-2.5 py-1 font-semibold border transition-colors ${
                            promo.isEnabled
                              ? 'border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100'
                              : 'border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                          }`}
                        >
                          {promo.isEnabled ? 'Tắt' : 'Bật lại'}
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditing(promo)}
                          className="text-xs px-2.5 py-1 font-semibold text-slate-700 border border-slate-300 hover:bg-slate-100 flex items-center gap-1 transition-colors"
                          title="Chỉnh sửa"
                        >
                          <Edit2 size={13} /> Sửa
                        </button>

                        <button
                          type="button"
                          onClick={() => void removePromotion(promo)}
                          className="text-xs p-1.5 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 rounded transition-colors"
                          title="Xóa chương trình"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : !error ? (
          <EmptyState
            title="Chưa có chương trình giảm giá phù hợp"
            description="Hãy bấm 'Tạo chương trình mới' để thiết lập ưu đãi cho sản phẩm hoặc danh mục của bạn."
          />
        ) : null}
      </div>

      {/* Creation & Edit Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 bg-black/60 overflow-y-auto p-3 sm:p-6 flex items-center justify-center animate-fade-in"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditing(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editing === 'new' ? 'Tạo chương trình giảm giá' : 'Sửa chương trình giảm giá'}
            className="bg-white max-w-3xl w-full mx-auto shadow-2xl relative max-h-[92vh] flex flex-col border border-[#ddd]"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-[#eee] bg-slate-50 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-ink">
                  {editing === 'new' ? 'Tạo chương trình giảm giá mới' : 'Chỉnh sửa chương trình giảm giá'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Áp dụng linh hoạt cho toàn bộ danh mục, các sản phẩm được chọn hoặc toàn cửa hàng.
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setEditing(null)}
                className="text-2xl text-slate-400 hover:text-ink w-8 h-8 flex items-center justify-center rounded transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Form Scrollable Body */}
            <form
              id="promotion-form"
              onSubmit={(e) => void submit(e)}
              className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1"
            >
              {/* Section 1: General Info & Discount Value */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pb-2 border-b border-[#eee]">
                  <Zap size={14} className="text-brand" /> 1. THÔNG TIN CHƯƠNG TRÌNH & MỨC GIẢM
                </h3>

                <label className="form-label block">
                  Tên chương trình khuyến mãi <span className="text-red-500">*</span>
                  <input
                    className="field mt-1"
                    required
                    maxLength={150}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ví dụ: Flash Sale Cuối Tuần, Giảm Giá Áo Nam 15%..."
                  />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="form-label block mb-1.5">Hình thức giảm giá</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            discountType: 'PERCENT',
                            discountValue: Math.min(form.discountValue, 90) || 10,
                          })
                        }
                        className={`p-2.5 text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                          form.discountType === 'PERCENT'
                            ? 'border-brand bg-red-50 text-brand ring-1 ring-brand'
                            : 'border-[#ccc] bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Percent size={14} /> Theo phần trăm (%)
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            discountType: 'FIXED',
                            discountValue: form.discountValue >= 1000 ? form.discountValue : 50000,
                          })
                        }
                        className={`p-2.5 text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                          form.discountType === 'FIXED'
                            ? 'border-brand bg-red-50 text-brand ring-1 ring-brand'
                            : 'border-[#ccc] bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        ₫ Theo số tiền (VND)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="form-label block mb-1">
                      {form.discountType === 'PERCENT' ? 'Mức giảm (%)' : 'Số tiền giảm (VND)'}{' '}
                      <span className="text-red-500">*</span>
                      <input
                        className="field mt-0.5"
                        type="number"
                        required
                        min={1}
                        max={form.discountType === 'PERCENT' ? 99 : undefined}
                        step={form.discountType === 'PERCENT' ? 1 : 1000}
                        value={form.discountValue || ''}
                        onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
                      />
                    </label>

                    {/* Quick shortcuts for discount */}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {form.discountType === 'PERCENT'
                        ? [10, 15, 20, 30, 50].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setForm({ ...form, discountValue: val })}
                              className="text-[11px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded"
                            >
                              -{val}%
                            </button>
                          ))
                        : [20000, 50000, 100000, 200000].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setForm({ ...form, discountValue: val })}
                              className="text-[11px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded"
                            >
                              -{val / 1000}k
                            </button>
                          ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Target Scope Selection */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pb-2 border-b border-[#eee]">
                  <Layers size={14} className="text-brand" /> 2. PHẠM VI ÁP DỤNG
                </h3>

                {/* Scope selector tabs */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, targetType: 'CATEGORY' })}
                    className={`p-3 text-left border flex flex-col gap-1 transition-all ${
                      form.targetType === 'CATEGORY'
                        ? 'border-brand bg-red-50/50 ring-1 ring-brand text-brand'
                        : 'border-[#ccc] bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Folder size={15} /> Theo danh mục
                    </div>
                    <span className="text-[11px] text-slate-500 font-normal">
                      Chọn 1 hoặc nhiều danh mục
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, targetType: 'PRODUCT' })}
                    className={`p-3 text-left border flex flex-col gap-1 transition-all ${
                      form.targetType === 'PRODUCT'
                        ? 'border-brand bg-red-50/50 ring-1 ring-brand text-brand'
                        : 'border-[#ccc] bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Tag size={15} /> Chọn sản phẩm
                    </div>
                    <span className="text-[11px] text-slate-500 font-normal">
                      Chọn các sản phẩm cụ thể
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, targetType: 'ALL' })}
                    className={`p-3 text-left border flex flex-col gap-1 transition-all ${
                      form.targetType === 'ALL'
                        ? 'border-brand bg-red-50/50 ring-1 ring-brand text-brand'
                        : 'border-[#ccc] bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Globe size={15} /> Toàn bộ cửa hàng
                    </div>
                    <span className="text-[11px] text-slate-500 font-normal">
                      Tất cả {products.length} sản phẩm
                    </span>
                  </button>
                </div>

                {/* Sub-UI: Category Selection Grid + Exclude Products */}
                {form.targetType === 'CATEGORY' && (
                  <div className="bg-slate-50 p-4 border border-[#e5e5e5] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink">
                        Chọn các danh mục áp dụng: (Đã chọn {form.categoryIds?.length ?? 0}/
                        {categories.length})
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={selectAllCategories}
                          className="text-xs text-brand hover:underline font-semibold"
                        >
                          Chọn tất cả
                        </button>
                        <span className="text-slate-300">•</span>
                        <button
                          type="button"
                          onClick={deselectAllCategories}
                          className="text-xs text-slate-500 hover:underline font-semibold"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-52 overflow-y-auto pr-1">
                      {categories.map((cat) => {
                        const isSelected = form.categoryIds?.includes(cat.id);
                        const count = countPerCategory.get(cat.id) ?? 0;
                        return (
                          <div
                            key={cat.id}
                            onClick={() => toggleCategory(cat.id)}
                            className={`p-2.5 border cursor-pointer flex items-center justify-between text-xs transition-colors select-none ${
                              isSelected
                                ? 'bg-white border-brand text-brand font-bold shadow-xs'
                                : 'bg-white border-[#ddd] text-slate-700 hover:border-slate-400'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleCategory(cat.id)}
                                className="accent-brand"
                              />
                              <span className="truncate">{cat.name}</span>
                            </div>
                            <span className="text-[11px] text-slate-400 shrink-0 font-normal">
                              ({count} sp)
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Bỏ / Loại trừ một vài sản phẩm trong danh mục đã chọn */}
                    {productsInSelectedCategories.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-[#ddd] space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div>
                            <span className="text-xs font-bold text-ink flex items-center gap-1.5 text-slate-800">
                              <Ban size={14} className="text-amber-600" /> Bỏ / Loại trừ sản phẩm trong danh mục:
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              (Tùy chọn) Chọn các sản phẩm bạn KHÔNG muốn giảm giá — các sản phẩm này sẽ giữ nguyên giá gốc.
                            </span>
                          </div>
                          {(form.excludedProductIds?.length ?? 0) > 0 && (
                            <button
                              type="button"
                              onClick={() => setForm({ ...form, excludedProductIds: [] })}
                              className="text-xs text-brand hover:underline font-semibold shrink-0"
                            >
                              Xóa hết loại trừ ({form.excludedProductIds?.length})
                            </button>
                          )}
                        </div>

                        {/* Search input for excluding products */}
                        <div className="relative">
                          <Search
                            size={14}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                          />
                          <input
                            type="text"
                            placeholder="Tìm sản phẩm cần bỏ khỏi danh mục..."
                            value={excludeSearch}
                            onChange={(e) => setExcludeSearch(e.target.value)}
                            className="field pl-8 text-xs py-1.5 bg-white"
                          />
                        </div>

                        {/* Excluded Product Chips */}
                        {(form.excludedProductIds?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-1.5 p-2 bg-amber-50/70 border border-amber-200 rounded">
                            <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1 w-full mb-0.5">
                              Đã loại trừ ({form.excludedProductIds?.length} sản phẩm giữ giá gốc):
                            </span>
                            {form.excludedProductIds?.map((pid) => {
                              const prod = products.find((p) => p.id === pid);
                              if (!prod) return null;
                              return (
                                <span
                                  key={pid}
                                  className="inline-flex items-center gap-1 text-[11px] bg-white border border-amber-300 text-amber-900 px-2 py-0.5 rounded shadow-xs"
                                >
                                  <span className="truncate max-w-[150px]">{prod.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => toggleExcludeProduct(pid)}
                                    className="text-amber-700 hover:text-red-600 font-bold"
                                    title="Hủy loại trừ"
                                  >
                                    ✕
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* Filtered products list to toggle exclude */}
                        <div className="max-h-48 overflow-y-auto space-y-1 bg-white border border-[#e0e0e0] p-1.5 rounded">
                          {filteredExcludeProducts.map((prod) => {
                            const isExcluded = form.excludedProductIds?.includes(prod.id);
                            const categoryName =
                              categories.find((c) => c.id === prod.categoryId)?.name ?? '';
                            return (
                              <div
                                key={prod.id}
                                onClick={() => toggleExcludeProduct(prod.id)}
                                className={`p-2 border flex items-center justify-between cursor-pointer transition-colors text-xs select-none ${
                                  isExcluded
                                    ? 'bg-amber-50/80 border-amber-300'
                                    : 'border-slate-100 hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <input
                                    type="checkbox"
                                    checked={isExcluded}
                                    onChange={() => toggleExcludeProduct(prod.id)}
                                    className="accent-amber-600 shrink-0"
                                  />
                                  <img
                                    src={prod.images[0]?.url}
                                    alt={prod.name}
                                    onError={showProductPlaceholder}
                                    className="w-7 h-7 object-cover rounded shrink-0 bg-slate-100"
                                  />
                                  <div className="truncate">
                                    <div
                                      className={`truncate ${
                                        isExcluded
                                          ? 'font-bold text-amber-900 line-through'
                                          : 'font-medium text-ink'
                                      }`}
                                    >
                                      {prod.name}
                                    </div>
                                    <div className="text-[10px] text-slate-400">{categoryName}</div>
                                  </div>
                                </div>

                                <div className="text-right shrink-0 pl-2">
                                  {isExcluded ? (
                                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                                      Giữ giá gốc ({formatCurrency(prod.minPrice)})
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-slate-500 font-semibold hover:text-amber-700">
                                      Bấm để loại trừ
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-UI: Specific Products Selection */}
                {form.targetType === 'PRODUCT' && (
                  <div className="bg-slate-50 p-4 border border-[#e5e5e5] space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center">
                      <div className="flex items-center gap-2 flex-1">
                        <div className="relative flex-1">
                          <Search
                            size={14}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                          />
                          <input
                            type="text"
                            placeholder="Tìm sản phẩm theo tên..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className="field pl-8 text-xs py-1.5"
                          />
                        </div>

                        <select
                          value={productCatFilter}
                          onChange={(e) => setProductCatFilter(e.target.value)}
                          className="field text-xs py-1.5 max-w-[150px]"
                        >
                          <option value="">Mọi danh mục</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={selectAllModalProducts}
                          className="text-xs text-brand hover:underline font-semibold"
                        >
                          Chọn ({modalFilteredProducts.length}) sp lọc
                        </button>
                        <span className="text-slate-300">•</span>
                        <button
                          type="button"
                          onClick={deselectAllProducts}
                          className="text-xs text-slate-500 hover:underline font-semibold"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    </div>

                    <div className="text-xs font-bold text-ink">
                      Đã chọn: <span className="text-brand">{form.productIds?.length ?? 0}</span> /{' '}
                      {products.length} sản phẩm
                    </div>

                    {/* Selected Products Chips Bar */}
                    {(form.productIds?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-white border border-[#eee] rounded">
                        {form.productIds?.map((pid) => {
                          const prod = products.find((p) => p.id === pid);
                          if (!prod) return null;
                          return (
                            <span
                              key={pid}
                              className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded"
                            >
                              <span className="truncate max-w-[150px]">{prod.name}</span>
                              <button
                                type="button"
                                onClick={() => toggleProduct(pid)}
                                className="text-slate-400 hover:text-red-500"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Product Checkbox List */}
                    <div className="max-h-60 overflow-y-auto space-y-1.5 border border-[#e0e0e0] bg-white p-2">
                      {modalFilteredProducts.map((prod) => {
                        const isSelected = form.productIds?.includes(prod.id);
                        const categoryName =
                          categories.find((c) => c.id === prod.categoryId)?.name ?? '';
                        return (
                          <div
                            key={prod.id}
                            onClick={() => toggleProduct(prod.id)}
                            className={`p-2 border flex items-center justify-between cursor-pointer transition-colors text-xs select-none ${
                              isSelected
                                ? 'bg-red-50/50 border-brand'
                                : 'border-slate-100 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleProduct(prod.id)}
                                className="accent-brand shrink-0"
                              />
                              <img
                                src={prod.images[0]?.url}
                                alt={prod.name}
                                onError={showProductPlaceholder}
                                className="w-9 h-9 object-cover rounded shrink-0 bg-slate-100"
                              />
                              <div className="truncate">
                                <div className="font-semibold text-ink truncate">{prod.name}</div>
                                <div className="text-[11px] text-slate-400">{categoryName}</div>
                              </div>
                            </div>

                            <div className="text-right shrink-0 pl-2">
                              <div className="font-bold text-ink">
                                {formatCurrency(prod.minPrice)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sub-UI: Storewide */}
                {form.targetType === 'ALL' && (
                  <div className="bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-800 flex items-start gap-2.5">
                    <Globe size={18} className="shrink-0 text-emerald-600 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Áp dụng cho toàn bộ cửa hàng:</strong>
                      Tất cả {products.length} sản phẩm đang có sẽ được giảm giá đồng loạt theo mức
                      giảm bạn đã đặt.
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Time & Activation */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pb-2 border-b border-[#eee]">
                  <Calendar size={14} className="text-brand" /> 3. THỜI GIAN ÁP DỤNG & TRẠNG THÁI
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label block mb-1">
                      Thời gian bắt đầu <span className="text-red-500">*</span>
                      <input
                        className="field mt-1"
                        type="datetime-local"
                        required
                        value={localDateTime(form.startsAt)}
                        onChange={(e) => {
                          if (e.target.value) {
                            setForm({ ...form, startsAt: new Date(e.target.value).toISOString() });
                          }
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, startsAt: new Date().toISOString() })}
                      className="text-[11px] text-brand hover:underline font-medium mt-1"
                    >
                      Áp dụng ngay bây giờ
                    </button>
                  </div>

                  <div>
                    <label className="form-label block mb-1">
                      Thời gian kết thúc <span className="text-red-500">*</span>
                      <input
                        className="field mt-1"
                        type="datetime-local"
                        required
                        value={localDateTime(form.endsAt)}
                        onChange={(e) => {
                          if (e.target.value) {
                            setForm({ ...form, endsAt: new Date(e.target.value).toISOString() });
                          }
                        }}
                      />
                    </label>
                    <div className="flex gap-2 text-[11px] text-slate-500 mt-1">
                      <span>Cộng thêm:</span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            endsAt: new Date(Date.now() + 3 * 86400000).toISOString(),
                          })
                        }
                        className="text-brand hover:underline"
                      >
                        +3 ngày
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            endsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
                          })
                        }
                        className="text-brand hover:underline"
                      >
                        +7 ngày
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            endsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
                          })
                        }
                        className="text-brand hover:underline"
                      >
                        +30 ngày
                      </button>
                    </div>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm font-semibold text-ink cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={form.isEnabled}
                    onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })}
                    className="w-4 h-4 accent-brand cursor-pointer"
                  />
                  <span>Kích hoạt chương trình ngay khi lưu</span>
                </label>
              </div>

              {/* Live Impact Preview Box */}
              <div className="bg-slate-50 border border-slate-200 p-4 text-xs space-y-2">
                <div className="font-bold text-ink uppercase tracking-wide flex items-center justify-between">
                  <span>Xem trước tác động thực tế:</span>
                  <span className="text-brand font-black">
                    Áp dụng cho {eligibleProducts.length} sản phẩm
                    {(form.excludedProductIds?.length ?? 0) > 0 &&
                      ` (${form.excludedProductIds?.length} sp loại trừ)`}
                  </span>
                </div>

                {sampleProduct && (
                  <div className="text-slate-600 flex items-center justify-between pt-1 border-t border-slate-200">
                    <span>
                      Ví dụ sản phẩm: <strong>{sampleProduct.name}</strong>
                    </span>
                    <span>
                      Giá từ {formatCurrency(sampleLowest)} →{' '}
                      <strong className="text-brand font-bold text-sm">
                        {formatCurrency(sampleDiscounted)}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              {formError && (
                <div
                  role="alert"
                  className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold flex items-center gap-2"
                >
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
            </form>

            {/* Modal Footer Buttons */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-[#eee] bg-slate-50 shrink-0">
              <button
                type="button"
                className="btn-outline text-xs px-5 py-2.5 font-bold"
                onClick={() => setEditing(null)}
              >
                HỦY
              </button>
              <button
                type="submit"
                form="promotion-form"
                disabled={saving}
                className="btn-primary text-xs px-6 py-2.5 font-bold shadow-sm"
              >
                {saving ? 'ĐANG LƯU...' : 'LƯU CHƯƠNG TRÌNH'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product List Inspection Modal */}
      {viewingProductsPromo && (
        <div
          className="fixed inset-0 z-50 bg-black/60 overflow-y-auto p-3 md:p-8 flex items-center justify-center"
          role="presentation"
          onClick={() => setViewingProductsPromo(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Danh sách sản phẩm áp dụng"
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-auto p-5 md:p-6 relative max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-4 border-b border-[#eee]">
              <div>
                <span className="text-xs font-bold text-brand uppercase tracking-wider">
                  Sản phẩm áp dụng khuyến mãi
                </span>
                <h2 className="text-lg font-black text-ink mt-0.5">
                  {viewingProductsPromo.name}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-600">
                  <span className="font-bold text-brand bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                    {viewingProductsPromo.discountType === 'PERCENT'
                      ? `Giảm ${viewingProductsPromo.discountValue}%`
                      : `Giảm ${formatCurrency(viewingProductsPromo.discountValue)}`}
                  </span>
                  <span>•</span>
                  <span>
                    {formatDate(viewingProductsPromo.startsAt)} đến {formatDate(viewingProductsPromo.endsAt)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setViewingProductsPromo(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-ink text-xl transition-colors"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2">
              {(() => {
                const eligible = products.filter((p) =>
                  isProductEligible(p, viewingProductsPromo, categories)
                );
                if (eligible.length === 0) {
                  return (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      Không có sản phẩm nào thuộc diện áp dụng của chương trình này.
                    </div>
                  );
                }
                return (
                  <div className="divide-y divide-slate-100">
                    {eligible.map((p) => {
                      const basePrice = p.minPrice;
                      const discounted =
                        viewingProductsPromo.discountType === 'PERCENT'
                          ? Math.max(
                              1000,
                              Math.floor((basePrice * (100 - viewingProductsPromo.discountValue)) / 100)
                            )
                          : Math.max(1000, basePrice - viewingProductsPromo.discountValue);
                      const catName = categories.find((c) => c.id === p.categoryId)?.name;
                      return (
                        <div key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={p.images[0]?.url}
                              alt={p.name}
                              className="w-12 h-14 object-cover rounded bg-slate-100 shrink-0"
                              onError={showProductPlaceholder}
                            />
                            <div className="min-w-0">
                              <div className="font-semibold text-ink text-xs line-clamp-1">{p.name}</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {catName || 'Khác'} • {p.variants.length} biến thể
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-black text-brand text-xs">
                              {formatCurrency(discounted)}
                            </div>
                            <div className="text-[11px] text-slate-400 line-through">
                              {formatCurrency(basePrice)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="pt-3 border-t border-[#eee] flex justify-end">
              <button
                type="button"
                onClick={() => setViewingProductsPromo(null)}
                className="btn-outline text-xs px-4 py-1.5"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
