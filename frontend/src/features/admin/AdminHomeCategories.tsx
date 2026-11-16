import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  Plus,
  Trash2,
  Edit2,
  Search,
  Grid,
  ListFilter,
  ArrowRight,
} from 'lucide-react';
import { Badge, EmptyState, PageHeading } from '../../components/common';
import { categoryService, productService } from '../../services/catalog';
import { homeCategoryService } from '../../services/homeCategories';
import type { HomeCategoryShowcase } from '../../types/models';
import { formatCurrency } from '../../utils/format';
import { getThumbnailUrl, showProductPlaceholder } from '../../utils/images';

export function AdminHomeCategories() {
  const client = useQueryClient();
  const [editingItem, setEditingItem] = useState<Partial<HomeCategoryShowcase> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Queries
  const { data: showcases = [], isLoading } = useQuery({
    queryKey: ['admin-home-categories'],
    queryFn: homeCategoryService.listAdmin,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: categoryService.listAdmin,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['admin-products'],
    queryFn: productService.listAdmin,
  });

  // Modal Form States
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [selectionMode, setSelectionMode] = useState<'ALL' | 'CUSTOM'>('ALL');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [displayLimit, setDisplayLimit] = useState(8);
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper: Get all descendant category IDs for the chosen category
  const descendantIds = useMemo(() => {
    if (!categoryId) return new Set<string>();
    const set = new Set<string>([categoryId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const cat of categories) {
        if (cat.parentId && set.has(cat.parentId) && !set.has(cat.id)) {
          set.add(cat.id);
          changed = true;
        }
      }
    }
    return set;
  }, [categoryId, categories]);

  // Filter products belonging to chosen category
  const categoryProducts = useMemo(() => {
    if (!categoryId) return [];
    return products.filter((p) => descendantIds.has(p.categoryId));
  }, [categoryId, products, descendantIds]);

  // Filter products by search term in modal
  const filteredCategoryProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return categoryProducts;
    return categoryProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q),
    );
  }, [categoryProducts, productSearch]);

  const openCreateModal = () => {
    const defaultCat = categories.find((c) => c.slug === 'ao-polo' || (!c.parentId && c.isActive)) || categories[0];
    setEditingItem(null);
    setCategoryId(defaultCat?.id || '');
    setTitle(defaultCat ? `BỘ SƯU TẬP ${defaultCat.name.toUpperCase()}` : '');
    setSubtitle('Khám phá các thiết kế nổi bật, chất liệu cao cấp và kiểu dáng hiện đại');
    setSelectionMode('ALL');
    setSelectedProductIds([]);
    setDisplayLimit(8);
    setSortOrder(showcases.length);
    setIsActive(true);
    setProductSearch('');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: HomeCategoryShowcase) => {
    setEditingItem(item);
    setCategoryId(item.categoryId);
    setTitle(item.title);
    setSubtitle(item.subtitle || '');
    setSelectionMode(item.selectionMode || 'ALL');
    setSelectedProductIds(item.productIds || []);
    setDisplayLimit(item.displayLimit || 8);
    setSortOrder(item.sortOrder ?? 0);
    setIsActive(item.isActive ?? true);
    setProductSearch('');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleCategoryChange = (newCatId: string) => {
    setCategoryId(newCatId);
    setSelectedProductIds([]);
    const found = categories.find((c) => c.id === newCatId);
    if (found && (!title || title.startsWith('BỘ SƯU TẬP'))) {
      setTitle(`BỘ SƯU TẬP ${found.name.toUpperCase()}`);
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id],
    );
  };

  const toggleSelectAllCategoryProducts = () => {
    if (selectedProductIds.length === categoryProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(categoryProducts.map((p) => p.id));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) {
      setErrorMsg('Vui lòng chọn danh mục áp dụng');
      return;
    }
    if (!title.trim() || title.trim().length < 2) {
      setErrorMsg('Tiêu đề phải từ 2 ký tự trở lên');
      return;
    }
    if (selectionMode === 'CUSTOM' && selectedProductIds.length === 0) {
      setErrorMsg('Ở chế độ chọn cụ thể, bạn cần chọn ít nhất 1 sản phẩm');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const targetCategory = categories.find((c) => c.id === categoryId);
    const payload: Partial<HomeCategoryShowcase> = {
      id: editingItem?.id,
      categoryId,
      title: title.trim(),
      subtitle: subtitle.trim(),
      selectionMode,
      productIds: selectionMode === 'CUSTOM' ? selectedProductIds : [],
      displayLimit: Number(displayLimit) || 8,
      sortOrder: Number(sortOrder) || 0,
      isActive,
      category: targetCategory
        ? { id: targetCategory.id, name: targetCategory.name, slug: targetCategory.slug }
        : undefined,
    };

    try {
      const saved = await homeCategoryService.save(payload);

      // Optimistic update
      client.setQueryData<HomeCategoryShowcase[]>(['admin-home-categories'], (old) => {
        if (!old) return [saved];
        const exists = old.some((item) => item.id === saved.id);
        const next = exists ? old.map((item) => (item.id === saved.id ? saved : item)) : [...old, saved];
        return next.sort((a, b) => a.sortOrder - b.sortOrder);
      });

      void client.invalidateQueries({ queryKey: ['admin-home-categories'], refetchType: 'none' });
      void client.invalidateQueries({ queryKey: ['home-categories'] });

      setIsModalOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể lưu cấu hình danh mục trang chủ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Xóa cấu hình hiển thị trang chủ của "${name}"?`)) return;

    // Optimistic delete
    client.setQueryData<HomeCategoryShowcase[]>(['admin-home-categories'], (old) =>
      old?.filter((item) => item.id !== id) ?? [],
    );

    try {
      await homeCategoryService.remove(id);
      void client.invalidateQueries({ queryKey: ['admin-home-categories'], refetchType: 'none' });
      void client.invalidateQueries({ queryKey: ['home-categories'] });
    } catch {
      alert('Không thể xóa cấu hình');
      void client.invalidateQueries({ queryKey: ['admin-home-categories'] });
    }
  };

  const handleToggleActive = async (item: HomeCategoryShowcase) => {
    const updated = { ...item, isActive: !item.isActive };

    client.setQueryData<HomeCategoryShowcase[]>(['admin-home-categories'], (old) =>
      old?.map((x) => (x.id === item.id ? updated : x)) ?? [],
    );

    try {
      await homeCategoryService.save(updated);
      void client.invalidateQueries({ queryKey: ['admin-home-categories'], refetchType: 'none' });
      void client.invalidateQueries({ queryKey: ['home-categories'] });
    } catch {
      void client.invalidateQueries({ queryKey: ['admin-home-categories'] });
    }
  };

  return (
    <>
      <PageHeading
        eyebrow="CATALOG / HIỂN THỊ"
        title="Quản lý danh mục hiển thị Trang chủ"
        description="Tùy biến các khối danh mục nổi bật hiển thị trên trang chủ với chế độ chọn toàn bộ sản phẩm hoặc tự tay chọn sản phẩm mong muốn."
        action={
          <button type="button" className="btn-primary flex items-center gap-1.5" onClick={openCreateModal}>
            <Plus size={16} /> Thêm danh mục trang chủ
          </button>
        }
      />

      {/* Navigation Switcher Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-slate-200">
        <Link
          to="/admin/home-categories"
          className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-brand border-b-2 border-brand flex items-center gap-2"
        >
          <Layers size={15} /> Danh mục hiển thị Trang chủ
        </Link>
        <Link
          to="/admin/categories"
          className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-ink transition-colors flex items-center gap-2"
        >
          <Grid size={15} /> Cây danh mục hệ thống
        </Link>
      </div>

      <div className="panel">
        {isLoading ? (
          <p className="text-slate-500 py-8 text-center text-sm">Đang tải danh sách hiển thị...</p>
        ) : showcases.length === 0 ? (
          <EmptyState
            title="Chưa có danh mục nào được ghim lên Trang chủ"
            description="Bấm vào '+ Thêm danh mục trang chủ' để cấu hình các khối bộ sưu tập hiển thị cho khách hàng."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Thứ tự</th>
                  <th>Khối hiển thị</th>
                  <th>Danh mục đích</th>
                  <th>Chế độ sản phẩm</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {showcases.map((item) => {
                  const cat = categories.find((c) => c.id === item.categoryId);
                  const isCustom = item.selectionMode === 'CUSTOM';
                  const count = isCustom ? (item.productIds?.length || 0) : 'Tất cả';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="w-16 text-center font-bold text-slate-500">
                        #{item.sortOrder}
                      </td>
                      <td>
                        <div className="max-w-md">
                          <strong className="block text-sm font-bold text-ink">{item.title}</strong>
                          {item.subtitle && (
                            <span className="text-xs text-slate-500 block truncate mt-0.5">
                              {item.subtitle}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded">
                            {cat?.name || item.category?.name || 'Danh mục'}
                          </span>
                          <Link
                            to={`/categories/${cat?.slug || item.category?.slug}`}
                            target="_blank"
                            className="text-slate-400 hover:text-brand"
                            title="Xem trang danh mục trên web"
                          >
                            <ArrowRight size={13} />
                          </Link>
                        </div>
                      </td>
                      <td>
                        {isCustom ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                            <ListFilter size={13} /> Tự chọn: {count} sản phẩm
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                            <Grid size={13} /> Chọn tất cả (tối đa {item.displayLimit})
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => void handleToggleActive(item)}
                          className="flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                          title="Bấm để bật/tắt nhanh"
                        >
                          <Badge tone={item.isActive ? 'success' : 'neutral'}>
                            {item.isActive ? 'Hiển thị' : 'Đã ẩn'}
                          </Badge>
                        </button>
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className="text-brand font-medium hover:underline text-xs flex items-center gap-1"
                            onClick={() => openEditModal(item)}
                          >
                            <Edit2 size={13} /> Sửa
                          </button>
                          <button
                            type="button"
                            className="text-red-600 font-medium hover:underline text-xs flex items-center gap-1"
                            onClick={() => void handleDelete(item.id, item.title)}
                          >
                            <Trash2 size={13} /> Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Cấu hình Danh mục Trang chủ */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 overflow-y-auto p-3 md:p-8 flex items-center justify-center animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 md:p-8 relative my-8 max-h-[90vh] flex flex-col">
            <button
              type="button"
              className="absolute right-5 top-5 text-2xl text-slate-400 hover:text-ink"
              onClick={() => setIsModalOpen(false)}
            >
              ×
            </button>

            <h3 className="text-lg font-black text-ink uppercase tracking-wide border-b pb-4 mb-5">
              {editingItem ? 'Sửa danh mục hiển thị Trang chủ' : 'Thêm danh mục hiển thị Trang chủ'}
            </h3>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-5 overflow-y-auto pr-1 flex-1">
              <div className="grid md:grid-cols-2 gap-4">
                {/* 1. Chọn Danh mục */}
                <div>
                  <label className="form-label font-bold text-xs">
                    Danh mục nguồn <span className="text-red-500">*</span>
                    <select
                      className="field mt-1"
                      value={categoryId}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      required
                    >
                      <option value="">-- Chọn danh mục --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.parentId ? `↳ ${c.name}` : c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Có <strong>{categoryProducts.length}</strong> sản phẩm trong danh mục này.
                  </p>
                </div>

                {/* Thứ tự & Giới hạn */}
                <div className="grid grid-cols-2 gap-3">
                  <label className="form-label font-bold text-xs">
                    Thứ tự hiển thị
                    <input
                      type="number"
                      min={0}
                      className="field mt-1"
                      value={sortOrder}
                      onChange={(e) => setSortOrder(Number(e.target.value))}
                    />
                  </label>

                  <label className="form-label font-bold text-xs">
                    Số lượng tối đa
                    <select
                      className="field mt-1"
                      value={displayLimit}
                      onChange={(e) => setDisplayLimit(Number(e.target.value))}
                    >
                      <option value={4}>4 sản phẩm (1 hàng)</option>
                      <option value={8}>8 sản phẩm (2 hàng)</option>
                      <option value={12}>12 sản phẩm (3 hàng)</option>
                      <option value={16}>16 sản phẩm (4 hàng)</option>
                    </select>
                  </label>
                </div>
              </div>

              {/* Tiêu đề & Phụ đề */}
              <div className="space-y-3">
                <label className="form-label font-bold text-xs">
                  Tiêu đề hiển thị trên Trang chủ <span className="text-red-500">*</span>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={150}
                    placeholder="VD: BỘ SƯU TẬP ÁO POLO MÙA HÈ"
                    className="field mt-1 font-bold text-ink uppercase tracking-wide"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>

                <label className="form-label font-bold text-xs">
                  Mô tả / Phụ đề ngắn
                  <input
                    type="text"
                    maxLength={400}
                    placeholder="VD: Phong cách thanh lịch, dễ phối đồ cho nam giới"
                    className="field mt-1"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                  />
                </label>
              </div>

              {/* Chế độ chọn sản phẩm */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
                <span className="block font-bold text-xs uppercase tracking-wide text-ink">
                  Chế độ chọn sản phẩm hiển thị:
                </span>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      selectionMode === 'ALL'
                        ? 'border-brand bg-white shadow-sm ring-1 ring-brand'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="selectionMode"
                      checked={selectionMode === 'ALL'}
                      onChange={() => setSelectionMode('ALL')}
                      className="mt-1"
                    />
                    <div>
                      <strong className="block text-xs font-bold text-ink">Chọn tất cả sản phẩm</strong>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Tự động hiển thị toàn bộ sản phẩm mới và nổi bật nhất trong danh mục này (tối đa {displayLimit} sản phẩm).
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      selectionMode === 'CUSTOM'
                        ? 'border-brand bg-white shadow-sm ring-1 ring-brand'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="selectionMode"
                      checked={selectionMode === 'CUSTOM'}
                      onChange={() => setSelectionMode('CUSTOM')}
                      className="mt-1"
                    />
                    <div>
                      <strong className="block text-xs font-bold text-ink">Chọn sản phẩm trong đó</strong>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Tự tay tick chọn từng sản phẩm cụ thể thuộc danh mục để trưng bày trang chủ.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Giao diện chọn sản phẩm cụ thể khi chọn CUSTOM */}
                {selectionMode === 'CUSTOM' && (
                  <div className="mt-4 pt-3 border-t border-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-ink">
                          Đã chọn: <strong className="text-brand">{selectedProductIds.length}</strong> / {categoryProducts.length} sản phẩm
                        </span>
                        <button
                          type="button"
                          onClick={toggleSelectAllCategoryProducts}
                          className="text-[11px] font-bold text-brand hover:underline ml-2"
                        >
                          {selectedProductIds.length === categoryProducts.length
                            ? 'Bỏ chọn tất cả'
                            : 'Chọn tất cả'}
                        </button>
                      </div>

                      <div className="relative w-48">
                        <input
                          type="text"
                          placeholder="Tìm sản phẩm..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          className="field py-1 px-2.5 text-xs w-full pl-7"
                        />
                        <Search size={13} className="absolute left-2 top-2.5 text-slate-400" />
                      </div>
                    </div>

                    {categoryProducts.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">
                        Danh mục này chưa có sản phẩm nào.
                      </p>
                    ) : filteredCategoryProducts.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">
                        Không tìm thấy sản phẩm khớp với từ khóa tìm kiếm.
                      </p>
                    ) : (
                      <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white">
                        {filteredCategoryProducts.map((p) => {
                          const isSelected = selectedProductIds.includes(p.id);
                          return (
                            <label
                              key={p.id}
                              className={`flex items-center gap-3 p-2.5 hover:bg-slate-50 cursor-pointer transition-colors ${
                                isSelected ? 'bg-red-50/40' : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectProduct(p.id)}
                                className="w-4 h-4 rounded text-brand focus:ring-brand"
                              />
                              <img
                                src={getThumbnailUrl(p.images[0]?.url)}
                                alt=""
                                onError={showProductPlaceholder}
                                className="w-10 h-12 object-cover rounded bg-slate-100 shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <span className="font-semibold text-xs text-ink block truncate">
                                  {p.name}
                                </span>
                                <span className="text-[11px] text-slate-500 block">
                                  {formatCurrency(p.minPrice)} • SKU: {p.variants[0]?.sku || p.slug}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Trạng thái kích hoạt */}
              <label className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-brand focus:ring-brand"
                />
                Kích hoạt hiển thị ngay trên Trang chủ
              </label>

              {/* Action Buttons */}
              <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  className="btn-outline px-5 py-2 text-xs"
                  onClick={() => setIsModalOpen(false)}
                >
                  HỦY
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary px-6 py-2 text-xs"
                >
                  {isSubmitting ? 'ĐANG LƯU...' : 'LƯU CẤU HÌNH'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
