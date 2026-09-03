-- Profile image for people (stored as a data URL, same approach as company logo).
alter table people add column if not exists avatar_url text;
