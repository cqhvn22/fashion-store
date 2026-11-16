"""Demo store coordinates; replace with verified coordinates before real deployment."""
from math import asin, cos, radians, sin, sqrt
import re
import unicodedata

STORES = [
    ("FashionHub Vincom Bà Triệu", "Hà Nội", "Hai Bà Trưng", "191 Bà Triệu", 21.0112, 105.8491),
    ("FashionHub Vincom Mega Mall Smart City", "Hà Nội", "Nam Từ Liêm", "Tây Mỗ", 21.0021, 105.7318),
    ("FashionHub Cầu Giấy", "Hà Nội", "Cầu Giấy", "182 Cầu Giấy", 21.0329, 105.7950),
    ("FashionHub Vincom Plaza Trần Duy Hưng", "Hà Nội", "Cầu Giấy", "119 Trần Duy Hưng", 21.0069, 105.7953),
    ("FashionHub Vincom Center Đồng Khởi", "TP. Hồ Chí Minh", "Quận 1", "72 Lê Thánh Tôn", 10.7784, 106.7028),
    ("FashionHub Vạn Hạnh Mall", "TP. Hồ Chí Minh", "Quận 10", "11 Sư Vạn Hạnh", 10.7704, 106.6708),
    ("FashionHub Crescent Mall", "TP. Hồ Chí Minh", "Quận 7", "101 Tôn Dật Tiên", 10.7293, 106.7184),
    ("FashionHub Quang Trung", "TP. Hồ Chí Minh", "Gò Vấp", "648 Quang Trung", 10.8343, 106.6544),
    ("FashionHub Vincom Plaza Ngô Quyền", "Đà Nẵng", "Sơn Trà", "910A Ngô Quyền", 16.0774, 108.2319),
    ("FashionHub Lê Duẩn", "Đà Nẵng", "Thanh Khê", "215 Lê Duẩn", 16.0689, 108.2112),
]


def normalized(text: str) -> str:
    text = unicodedata.normalize("NFD", text.casefold()).replace("đ", "d")
    return re.sub(r"[^a-z0-9]+", " ", "".join(c for c in text if not unicodedata.combining(c))).strip()


def nearest(latitude: float, longitude: float) -> list[dict]:
    def distance(lat: float, lon: float) -> float:
        a = sin(radians(lat - latitude) / 2) ** 2 + cos(radians(latitude)) * cos(radians(lat)) * sin(radians(lon - longitude) / 2) ** 2
        return 6371 * 2 * asin(sqrt(a))
    return sorted(({"name": name, "city": city, "district": district, "address": address,
                    "distanceKm": round(distance(lat, lon), 1), "latitude": lat, "longitude": lon}
                   for name, city, district, address, lat, lon in STORES), key=lambda row: row["distanceKm"])[:3]


def by_area(text: str) -> list[dict]:
    query = normalized(text)
    if not query:
        return []
    target_city = next((label for phrase, label in (("ha noi", "Hà Nội"), ("da nang", "Đà Nẵng"),
                                               ("ho chi minh", "TP. Hồ Chí Minh"), ("sai gon", "TP. Hồ Chí Minh"))
                 if phrase in query), None)
    words = set(query.split()) - {"toi", "minh", "dang", "o", "gan", "cua", "hang", "nhat", "tim", "cho", "tai", "shop", "quan", "tp", "thanh", "pho"}
    ranked = []
    for name, city, district, address, lat, lon in STORES:
        if target_city and city != target_city:
            continue
        haystack = normalized(f"{name} {city} {district} {address}")
        score = sum(len(word) for word in words if re.search(rf"\b{re.escape(word)}\b", haystack))
        if score:
            ranked.append((score, {"name": name, "city": city, "district": district, "address": address,
                                   "latitude": lat, "longitude": lon}))
    return [item for _, item in sorted(ranked, key=lambda pair: pair[0], reverse=True)[:3]]
