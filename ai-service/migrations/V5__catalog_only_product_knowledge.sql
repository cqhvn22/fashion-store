-- The workbook was an initial Catalog import, never an ongoing product source.
DELETE FROM product_documents WHERE source = 'workbook';
ALTER TABLE product_documents DROP CONSTRAINT product_documents_source_check;
ALTER TABLE product_documents ADD CONSTRAINT product_documents_source_check
    CHECK (source = 'catalog');
