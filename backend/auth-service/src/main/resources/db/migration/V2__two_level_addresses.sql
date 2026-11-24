-- Giữ dữ liệu quận/huyện cũ để đọc lịch sử; địa chỉ mới chỉ cần tỉnh và xã/phường.
ALTER TABLE addresses ALTER COLUMN district DROP NOT NULL;
