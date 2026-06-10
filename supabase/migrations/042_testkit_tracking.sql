-- Migratie 042: PostNL track & trace op de testkit
-- tracking_code = PostNL-barcode, tracking_url = consumenten-volglink.

alter table vh_testkit
  add column if not exists tracking_code    text,
  add column if not exists tracking_url     text,
  add column if not exists label_created_at timestamptz;
