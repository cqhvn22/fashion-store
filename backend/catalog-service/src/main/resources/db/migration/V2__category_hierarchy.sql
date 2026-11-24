-- Giữ mô hình adjacency list hiện có; thêm ràng buộc để cây không thể có vòng lặp.
CREATE OR REPLACE FUNCTION validate_category_parent() RETURNS trigger AS $$
BEGIN
    -- Tuần tự hóa thay đổi cây để hai giao dịch không tạo vòng lặp đồng thời.
    PERFORM pg_advisory_xact_lock(24112601);
    IF NEW.parent_id IS NOT NULL AND EXISTS (
        WITH RECURSIVE ancestors(id, parent_id) AS (
            SELECT id, parent_id FROM categories WHERE id = NEW.parent_id
            UNION ALL
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

CREATE TRIGGER trg_validate_category_parent
BEFORE INSERT OR UPDATE OF parent_id ON categories
FOR EACH ROW EXECUTE FUNCTION validate_category_parent();
