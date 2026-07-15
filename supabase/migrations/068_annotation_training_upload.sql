-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 068: bijhouden of een annotatie al naar de trainingsmodule is gezet
--
-- De arts uploadt niet meer zelf; de admin doet dit (per dossier of in bulk).
-- Deze kolommen voorkomen dubbele uploads en tonen de status in het admin-
-- overzicht.
-- ─────────────────────────────────────────────────────────────────────────────

alter table vh_annotation
  add column if not exists training_uploaded_at  timestamptz,
  add column if not exists training_knowledge_id uuid references vh_knowledge(id) on delete set null;

notify pgrst, 'reload schema';
