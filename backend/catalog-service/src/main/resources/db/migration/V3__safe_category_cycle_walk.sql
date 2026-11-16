-- UNION loại các nút đã thăm để hàm kiểm tra cũng an toàn với dữ liệu cũ có vòng lặp.
CREATE OR REPLACE FUNCTION validate_category_parent() RETURNS trigger AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(24112601);
    IF NEW.parent_id IS NOT NULL AND EXISTS (
        WITH RECURSIVE ancestors(id, parent_id) AS (
            SELECT id, parent_id FROM categories WHERE id = NEW.parent_id
            UNION
            SELECT c.id, c.parent_id FROM categories c
            JOIN ancestors a ON c.id = a.parent_id
        )
        SELECT 1 FROM ancestors WHERE id = NEW.id
    ) THEN
        RAISE EXCEPTION 'CATEGORY_CYCLE: category cannot be its own ancestor'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
