-- Cover the nullable platform feature flag audit actor foreign key.
create index if not exists idx_platform_feature_flags_updated_by
  on public.platform_feature_flags (updated_by)
  where updated_by is not null;
