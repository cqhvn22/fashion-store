"""Read the ATINO workbook without treating repeated shipping policy as product facts."""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
import zipfile
from collections import Counter
from decimal import Decimal, InvalidOperation
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REQUIRED = {"Product ID", "Tên sản phẩm", "Danh mục", "Giá bán (VNĐ)"}
POLICY_PHRASES = ("mức phí:", "được kiểm tra hàng", "đổi hàng trong vòng", "miễn phí đổi trả")


def clean_text(value: object) -> str:
    return " ".join(unicodedata.normalize("NFKC", str(value or "")).split()).strip()


def split_values(value: object) -> list[str]:
    return list(dict.fromkeys(part for item in str(value or "").split(",")
                              if (part := clean_text(item))))


def price_value(value: object) -> int:
    try:
        amount = int(Decimal(str(value).replace(",", "")))
    except (InvalidOperation, ValueError):
        return 0
    return amount if amount > 0 else 0


def read_rows(path: Path) -> list[dict[str, str]]:
    with zipfile.ZipFile(path) as archive:
        strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            strings = ["".join(node.itertext()) for node in root.findall("x:si", NS)]
        sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
    table: list[dict[int, str]] = []
    for row in sheet.findall(".//x:sheetData/x:row", NS):
        values: dict[int, str] = {}
        for cell in row.findall("x:c", NS):
            letters = re.match(r"[A-Z]+", cell.attrib["r"]).group()
            column = 0
            for letter in letters:
                column = column * 26 + ord(letter) - ord("A") + 1
            kind = cell.attrib.get("t")
            if kind == "inlineStr":
                inline = cell.find("x:is", NS)
                value = "".join(inline.itertext()) if inline is not None else ""
            else:
                value = cell.findtext("x:v", default="", namespaces=NS)
                if kind == "s" and value:
                    value = strings[int(value)]
            values[column - 1] = value
        table.append(values)
    if not table:
        raise ValueError("Workbook has no rows")
    columns = table[0]
    headers = {index: clean_text(name) for index, name in columns.items()}
    if not REQUIRED.issubset(set(headers.values())):
        raise ValueError(f"Missing columns: {sorted(REQUIRED - set(headers.values()))}")
    return [{header: values.get(index, "") for index, header in headers.items()}
            for values in table[1:] if values]


def normalize_row(row: dict[str, str]) -> dict | None:
    source_id = clean_text(row.get("Product ID", ""))
    if source_id.endswith(".0"):
        source_id = source_id[:-2]
    name = clean_text(row.get("Tên sản phẩm", ""))
    category = clean_text(row.get("Danh mục", ""))
    price = price_value(row.get("Giá bán (VNĐ)", ""))
    if not source_id.isdigit() or not name or not category or not price:
        return None
    slug = clean_text(row.get("Tên ảnh cơ sở", "")).lower()
    if not re.fullmatch(r"[a-z0-9]+(?:[a-z0-9.-]*[a-z0-9])?", slug):
        slug = f"atino-{source_id}"
    raw_sku = clean_text(row.get("Mã SKU", ""))
    materials = re.findall(r"\d+(?:[.,]\d+)?%\s*[A-Za-zÀ-ỹ][A-Za-zÀ-ỹ\s/-]*?(?=,\s*\d|$)", raw_sku)
    material = ", ".join(materials) or None
    raw_description = clean_text(row.get("Mô tả sản phẩm", ""))
    description = None if sum(phrase in raw_description.lower() for phrase in POLICY_PHRASES) >= 2 else raw_description or None
    file_names = [Path(item.strip()).name for item in str(row.get("Danh sách file ảnh tải về", "")).split(",")]
    file_names = [name for name in file_names if re.fullmatch(r"[\w.-]+\.(?:jpg|jpeg|png|webp)", name, re.I)]
    product_url = f"/products/{slug}"
    stock_text = clean_text(row.get("Tình trạng", "")).lower()
    in_stock = True if stock_text == "còn hàng" else False if stock_text == "hết hàng" else None
    original_price = price_value(row.get("Giá gốc (VNĐ)", ""))
    return {
        "source": "workbook", "source_id": source_id, "slug": slug,
        "name": name, "category": category, "price": price,
        "original_price": original_price if original_price > price else None,
        "colors": split_values(row.get("Màu sắc", "")),
        "sizes": split_values(row.get("Kích cỡ", "")),
        "material": material, "description": description,
        "image_url": f"/images/products/{file_names[0]}" if file_names else "/images/product-placeholder.svg",
        "product_url": product_url, "in_stock": in_stock,
    }


def load_products(path: Path) -> tuple[list[dict], dict]:
    rows = read_rows(path)
    products: list[dict] = []
    seen: set[str] = set()
    rejected = 0
    duplicates = 0
    for row in rows:
        product = normalize_row(row)
        if product is None:
            rejected += 1
        elif product["source_id"] in seen:
            duplicates += 1
        else:
            products.append(product)
            seen.add(product["source_id"])
    if not products:
        raise ValueError("No valid products in workbook")
    report = {"rows": len(rows), "valid": len(products), "rejected": rejected,
              "duplicate_ids": duplicates,
              "categories": dict(Counter(item["category"] for item in products)),
              "product_descriptions": sum(bool(item["description"]) for item in products),
              "materials": sum(bool(item["material"]) for item in products)}
    return products, report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    arguments = parser.parse_args()
    records, summary = load_products(arguments.input)
    if arguments.output:
        arguments.output.parent.mkdir(parents=True, exist_ok=True)
        arguments.output.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False))
