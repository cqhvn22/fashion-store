import os
import json
import re
import pandas as pd
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
EXCEL_PATH = PROJECT_ROOT / "ai-service" / "atino_products.xlsx"
IMAGES_DIR = PROJECT_ROOT / "frontend" / "public" / "images" / "products"

CATEGORY_MAPPING = {
    'Áo Phông': {'id': 'cat-atino-ao-phong', 'parentId': 'cat-03', 'slug': 'ao-phong', 'name': 'Áo phông nam', 'description': 'Áo phông nam trẻ trung, năng động và thoáng mát.'},
    'Áo PoLo': {'id': 'cat-atino-ao-polo', 'parentId': 'cat-03', 'slug': 'ao-polo', 'name': 'Áo polo nam', 'description': 'Áo polo nam thanh lịch, tôn dáng cho công sở và dạo phố.'},
    'Áo Sơ Mi Dài Tay': {'id': 'cat-atino-so-mi-dai', 'parentId': 'cat-03', 'slug': 'ao-so-mi-dai-tay', 'name': 'Áo sơ mi dài tay', 'description': 'Áo sơ mi nam tay dài sang trọng, lịch lãm.'},
    'Áo Sơ Mi Ngắn Tay': {'id': 'cat-atino-so-mi-ngan', 'parentId': 'cat-03', 'slug': 'ao-so-mi-ngan-tay', 'name': 'Áo sơ mi ngắn tay', 'description': 'Áo sơ mi nam cộc tay trẻ trung, thoáng mát.'},
    'Áo Nỉ / Áo Thun Dài Tay': {'id': 'cat-atino-ao-ni', 'parentId': 'cat-03', 'slug': 'ao-ni-thun-dai-tay', 'name': 'Áo nỉ & thun dài tay', 'description': 'Áo nỉ, sweater và thun dài tay ấm áp mùa thu đông.'},
    'Áo Tank Top': {'id': 'cat-atino-tank-top', 'parentId': 'cat-03', 'slug': 'ao-tank-top', 'name': 'Áo ba lỗ & tank top', 'description': 'Áo tank top nam thể thao, khỏe khoắn.'},
    'Bộ Thể Thao Hè': {'id': 'cat-atino-bo-the-thao', 'parentId': 'cat-03', 'slug': 'bo-the-thao-he', 'name': 'Bộ thể thao hè', 'description': 'Set đồ bộ thể thao nam đồng bộ, thoải mái vận động.'},

    'Quần Jeans': {'id': 'cat-atino-quan-jeans', 'parentId': 'cat-04', 'slug': 'quan-jeans', 'name': 'Quần jeans nam', 'description': 'Quần bò jeans nam form suông, slimfit bền đẹp.'},
    'Quần Kaki': {'id': 'cat-atino-quan-kaki', 'parentId': 'cat-04', 'slug': 'quan-kaki', 'name': 'Quần kaki nam', 'description': 'Quần kaki nam phong cách lịch lãm, chỉn chu.'},
    'Quần Âu': {'id': 'cat-atino-quan-au', 'parentId': 'cat-04', 'slug': 'quan-au', 'name': 'Quần âu nam', 'description': 'Quần tây âu công sở cao cấp, đường ly chuẩn đẹp.'},
    'Quần Short': {'id': 'cat-atino-quan-short', 'parentId': 'cat-04', 'slug': 'quan-short', 'name': 'Quần short nam', 'description': 'Quần đùi short nam mát mẻ, phong cách mùa hè.'},
    'Quần Gió': {'id': 'cat-atino-quan-gio', 'parentId': 'cat-04', 'slug': 'quan-gio', 'name': 'Quần gió nam', 'description': 'Quần gió thể thao cản gió, nhẹ nhàng vận động.'},
    'Quần Nỉ': {'id': 'cat-atino-quan-ni', 'parentId': 'cat-04', 'slug': 'quan-ni', 'name': 'Quần nỉ nam', 'description': 'Quần nỉ jogger thu đông giữ ấm tối đa.'},
    'Quần Lót': {'id': 'cat-atino-quan-lot', 'parentId': 'cat-04', 'slug': 'quan-lot', 'name': 'Quần lót nam', 'description': 'Quần lót nam kháng khuẩn, mềm mại ôm khít.'},

    'Áo Gió': {'id': 'cat-atino-ao-gio', 'parentId': 'cat-05', 'slug': 'ao-gio', 'name': 'Áo khoác gió', 'description': 'Áo khoác gió nam chống nước, cản gió hiệu quả.'},
    'Áo Jacket': {'id': 'cat-atino-ao-jacket', 'parentId': 'cat-05', 'slug': 'ao-jacket', 'name': 'Áo khoác jacket', 'description': 'Áo jacket kaki khóa kéo thời thượng, cá tính.'},

    'Giày Dép': {'id': 'cat-atino-giay-dep', 'parentId': 'cat-06', 'slug': 'giay-dep', 'name': 'Giày & dép nam', 'description': 'Dép da, giày thể thao nam êm ái, bền bỉ.'},
    'Túi / Balo': {'id': 'cat-atino-tui-balo', 'parentId': 'cat-06', 'slug': 'tui-balo', 'name': 'Túi chéo & balo', 'description': 'Túi đeo chéo, balo nam tiện dụng mọi lúc.'},
    'Mũ': {'id': 'cat-15', 'parentId': 'cat-06', 'slug': 'mu', 'name': 'Mũ nón nam', 'description': 'Mũ lưỡi trai, mũ phong cách thể thao cá tính.'},
    'Dây Lưng': {'id': 'cat-atino-day-lung', 'parentId': 'cat-06', 'slug': 'day-lung', 'name': 'Dây lưng da', 'description': 'Thắt lưng da bò cao cấp, khóa kim loại sang trọng.'},
    'Tất': {'id': 'cat-atino-tat', 'parentId': 'cat-06', 'slug': 'tat', 'name': 'Tất & vớ nam', 'description': 'Tất nam cổ ngắn, cổ cao khử mùi thoáng khí.'},
}

COLOR_CODES = {
    'Be': '#e4d5b7',
    'Be Tối': '#c2b299',
    'Ghi': '#8c8c8c',
    'Ghi 6': '#9e9e9e',
    'Ghi Nhạt': '#cfcfcf',
    'Ghi Sáng': '#e0e0e0',
    'Ghi Đậm': '#595959',
    'Hồng': '#f4a7bb',
    'Kem': '#f5f0e1',
    'Mận': '#722f37',
    'Nâu': '#6f4e37',
    'Rêu': '#4b5320',
    'Than': '#2b303a',
    'Tiêu': '#707070',
    'Trắng': '#ffffff',
    'Xanh': '#2e6b9e',
    'Xanh Biển': '#1e88e5',
    'Xanh Ngọc': '#26a69a',
    'Xanh Nhạt': '#81d4fa',
    'Xanh Đậm': '#0d47a1',
    'xám': '#757575',
    'Đen': '#1a1a1a',
    'Đen 1': '#111111',
    'Đỏ': '#c62828',
    'Tiêu chuẩn': '#292929',
}

SIZE_SORT_ORDER = {
    'Freesize': 0, 'Một cỡ': 0,
    'S': 1, 'M': 2, 'L': 3, 'XL': 4, '2XL': 5, '3XL': 6, '4XL': 7,
    '28': 10, '29': 11, '30': 12, '31': 13, '32': 14, '33': 15, '34': 16,
    '39': 20, '40': 21, '41': 22, '42': 23, '43': 24, '44': 25
}

def clean_sku(raw_sku, prod_id):
    if not isinstance(raw_sku, str) or not raw_sku.strip():
        return f"AT-{prod_id}"
    cleaned = raw_sku.split('.')[0] if '.' in raw_sku else raw_sku
    cleaned = re.sub(r'[^a-zA-Z0-9_-]', '', cleaned)
    return f"AT-{cleaned}" if cleaned else f"AT-{prod_id}"

def parse_excel():
    df = pd.read_excel(EXCEL_PATH)
    products = []

    categories_list = []
    for cat_name, info in CATEGORY_MAPPING.items():
        categories_list.append({
            'id': info['id'],
            'parentId': info['parentId'],
            'name': info['name'],
            'slug': info['slug'],
            'description': info['description'],
            'isActive': True
        })

    for idx, row in df.iterrows():
        prod_id_raw = int(row['Product ID'])
        pid = f"prod-at-{prod_id_raw}"
        name = str(row['Tên sản phẩm']).strip()
        slug = str(row['Tên ảnh cơ sở']).strip()
        cat_raw = str(row['Danh mục']).strip()
        cat_info = CATEGORY_MAPPING.get(cat_raw, {
            'id': 'cat-03', 'parentId': None, 'slug': 'ao-nam', 'name': 'Áo nam'
        })
        category_id = cat_info['id']

        price = int(row['Giá bán (VNĐ)'])
        status_raw = str(row['Tình trạng']).strip()
        is_in_stock = (status_raw == 'Còn hàng')

        # Images
        raw_images = [f.strip() for f in str(row['Danh sách file ảnh tải về']).split(',') if f.strip()]
        images = []
        for i_idx, fn in enumerate(raw_images):
            images.append({
                'id': f"{pid}-img-{i_idx + 1}",
                'url': f"/images/products/{fn}",
                'alt': f"{name} - Ảnh {i_idx + 1}",
                'isPrimary': (i_idx == 0)
            })

        if not images:
            images.append({
                'id': f"{pid}-img-1",
                'url': "/images/product-placeholder.svg",
                'alt': name,
                'isPrimary': True
            })

        # Colors & Sizes
        raw_colors = row['Màu sắc']
        if pd.isna(raw_colors) or not str(raw_colors).strip():
            colors = ['Tiêu chuẩn']
        else:
            colors = [c.strip() for c in str(raw_colors).split(',') if c.strip()]
            if not colors:
                colors = ['Tiêu chuẩn']

        raw_sizes = row['Kích cỡ']
        if pd.isna(raw_sizes) or not str(raw_sizes).strip():
            sizes = ['Freesize']
        else:
            sizes = [s.strip() for s in str(raw_sizes).split(',') if s.strip()]
            if not sizes:
                sizes = ['Freesize']
            # Sort sizes
            sizes = sorted(sizes, key=lambda s: SIZE_SORT_ORDER.get(s, 99))

        sku_prefix = clean_sku(row['Mã SKU'], prod_id_raw)

        # Generate Variants
        variants = []
        for ci, color in enumerate(colors):
            color_code = COLOR_CODES.get(color, '#292929')
            # Assign specific image for color if available
            variant_main_img = images[ci % len(images)]['url']
            # Group variant images
            variant_imgs = [img for i, img in enumerate(images) if (i % len(colors)) == ci]
            if not variant_imgs:
                variant_imgs = images

            for si, size in enumerate(sizes):
                vid = f"{pid}-{ci}-{si}"
                v_sku = f"{sku_prefix}-{ci}-{size}"
                # Realistic stock quantity
                if is_in_stock:
                    stock = 12 + ((prod_id_raw * 7 + ci * 5 + si * 3) % 38)
                else:
                    stock = 0

                variants.append({
                    'id': vid,
                    'sku': v_sku,
                    'color': color,
                    'colorCode': color_code,
                    'size': size,
                    'price': price,
                    'stockQuantity': stock,
                    'imageUrl': variant_main_img,
                    'images': variant_imgs,
                    'isActive': True
                })

        # Description
        policy_text = str(row['Chính sách & Ưu đãi']).strip() if pd.notna(row['Chính sách & Ưu đãi']) else ""
        desc_lines = [
            f"**{name}** – Sản phẩm thời trang nam chính hãng từ thương hiệu **ATINO**.",
            "",
            "### Đặc điểm nổi bật:",
            "- **Thiết kế:** Phom dáng chuẩn nam tính, hiện đại và trẻ trung, dễ dàng phối đồ đi làm, đi chơi hay dạo phố.",
            "- **Chất liệu:** Vải cao cấp bền đẹp, mềm mịn, thấm hút mồ hôi và giữ phom chuẩn sau nhiều lần giặt.",
            "- **Màu sắc & Kích cỡ:** Đa dạng biến thể lựa chọn, chuẩn phom dáng người Việt.",
            "",
            "### Cam kết & Chính sách mua hàng:",
            "- Hỗ trợ kiểm tra hàng (đồng kiểm) trước khi thanh toán COD.",
            "- Đổi hàng / đổi size trong vòng 30 ngày kể từ khi nhận hàng.",
            "- Giao hàng nhanh nội thành 24h, toàn quốc 2-4 ngày làm việc.",
            "- Hotline chăm sóc khách hàng: 1800 6000."
        ]
        description = "\n".join(desc_lines)

        rating = float(row['Điểm đánh giá']) if pd.notna(row['Điểm đánh giá']) else 5.0
        reviews = int(row['Số lượt đánh giá']) if pd.notna(row['Số lượt đánh giá']) else 189
        sold = reviews * 2 + ((prod_id_raw % 100) + 15)

        created_day = (idx % 28) + 1
        created_at = f"2026-10-{created_day:02d}T08:00:00.000Z"
        updated_at = "2026-11-10T12:00:00.000Z"

        products.append({
            'id': pid,
            'slug': slug,
            'name': name,
            'description': description,
            'categoryId': category_id,
            'brand': 'ATINO',
            'images': images,
            'variants': variants,
            'minPrice': price,
            'maxPrice': price,
            'originalPrice': price,
            'ratingAverage': rating,
            'reviewCount': reviews,
            'soldCount': sold,
            'status': 'ACTIVE',
            'createdAt': created_at,
            'updatedAt': updated_at
        })

    return categories_list, products

def main():
    categories, products = parse_excel()
    print(f"Parsed {len(categories)} categories and {len(products)} products.")

    # 1. Output TypeScript data file
    out_ts = PROJECT_ROOT / "frontend" / "src" / "data" / "atinoCatalog.ts"
    os.makedirs(os.path.dirname(out_ts), exist_ok=True)
    with open(out_ts, "w", encoding="utf-8") as f:
        f.write("import type { Category, Product } from '../types/models';\n\n")
        f.write("export const atinoCategories: Category[] = ")
        json.dump(categories, f, ensure_ascii=False, indent=2)
        f.write(";\n\n")
        f.write("export const atinoProducts: Product[] = ")
        json.dump(products, f, ensure_ascii=False, indent=2)
        f.write(";\n")
    print(f"Wrote TypeScript file to {out_ts}")

    # 2. Output SQL seed file
    out_sql = PROJECT_ROOT / "scripts" / "seed" / "atino-catalog.sql"
    os.makedirs(os.path.dirname(out_sql), exist_ok=True)
    with open(out_sql, "w", encoding="utf-8") as f:
        f.write("-- ATINO Product & Category Seed for PostgreSQL\n")
        f.write("\\set ON_ERROR_STOP on\nBEGIN;\n\n")

        # Insert categories
        f.write("-- Categories\n")
        for cat in categories:
            desc = cat['description'].replace("'", "''")
            name = cat['name'].replace("'", "''")
            slug = cat['slug']
            p_val = "NULL"
            if cat['parentId']:
                # Parent slug
                p_slug = "ao-nam" if cat['parentId'] == "cat-03" else "quan" if cat['parentId'] == "cat-04" else "ao-khoac" if cat['parentId'] == "cat-05" else "phu-kien"
                p_val = f"(SELECT id FROM categories WHERE slug = '{p_slug}' LIMIT 1)"
            f.write(f"INSERT INTO categories (id, parent_id, name, slug, description, is_active)\n"
                    f"VALUES (md5('fashion-category:{slug}')::uuid, {p_val}, '{name}', '{slug}', '{desc}', true)\n"
                    f"ON CONFLICT (slug) DO NOTHING;\n")

        # Insert products
        f.write("\n-- Products, Images & Variants\n")
        for prod in products:
            p_name = prod['name'].replace("'", "''")
            p_desc = prod['description'].replace("'", "''")
            p_slug = prod['slug']
            p_cat = prod['categoryId']
            # Find category slug from mapping
            cat_slug = next((c['slug'] for c in categories if c['id'] == p_cat), 'ao-nam')
            f.write(f"\n-- Product: {p_name}\n")
            f.write(f"INSERT INTO products (id, category_id, slug, name, description, brand, status, original_price, rating_average, review_count, sold_count)\n"
                    f"SELECT md5('fashion-product:{p_slug}')::uuid, c.id, '{p_slug}', '{p_name}', '{p_desc}', 'ATINO', 'ACTIVE', {prod['originalPrice']}, {prod['ratingAverage']}, {prod['reviewCount']}, {prod['soldCount']}\n"
                    f"FROM categories c WHERE c.slug = '{cat_slug}'\n"
                    f"ON CONFLICT (slug) DO NOTHING;\n")

            # Images
            for img_idx, img in enumerate(prod['images']):
                img_url = img['url']
                is_p = "true" if img['isPrimary'] else "false"
                f.write(f"INSERT INTO product_images (id, product_id, url, alt, is_primary, sort_order)\n"
                        f"SELECT md5('fashion-img:{p_slug}:{img_idx}')::uuid, p.id, '{img_url}', '{p_name}', {is_p}, {img_idx}\n"
                        f"FROM products p WHERE p.slug = '{p_slug}'\n"
                        f"ON CONFLICT DO NOTHING;\n")

            # Variants
            for v_idx, v in enumerate(prod['variants']):
                v_sku = v['sku']
                v_color = v['color'].replace("'", "''")
                v_code = v['colorCode']
                v_size = v['size']
                v_price = v['price']
                v_stock = v['stockQuantity']
                v_img = v['imageUrl']
                f.write(f"INSERT INTO product_variants (id, product_id, sku, color, color_code, size, price, stock_quantity, image_url, is_active)\n"
                        f"SELECT md5('fashion-var:{v_sku}')::uuid, p.id, '{v_sku}', '{v_color}', '{v_code}', '{v_size}', {v_price}, {v_stock}, '{v_img}', true\n"
                        f"FROM products p WHERE p.slug = '{p_slug}'\n"
                        f"ON CONFLICT (sku) DO NOTHING;\n")

        f.write("\nCOMMIT;\n")
    print(f"Wrote SQL file to {out_sql}")

if __name__ == "__main__":
    main()
