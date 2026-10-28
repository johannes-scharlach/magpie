-- ADR 35: open reviews reach the cook's devices, so they outlive the app
-- process. Only the API writes; devices read through the sync stream.
alter table public.import_operations replica identity full;
alter publication powersync add table public.import_operations;
