-- Migratie 021: bijhouden van mislukte inlogpogingen per e-mailadres
-- Na 3 mislukte pogingen: 5 minuten timeout
-- Na 6 mislukte pogingen: account geblokkeerd (alleen handmatig te deblokkeren)

create table if not exists vh_login_attempt (
  email            text primary key,
  attempts         smallint     not null default 0,
  locked_until     timestamptz,
  blocked          boolean      not null default false,
  last_attempt_at  timestamptz  not null default now(),
  created_at       timestamptz  not null default now()
);

-- Alleen toegankelijk via service role (API route), geen publieke policies
alter table vh_login_attempt enable row level security;
