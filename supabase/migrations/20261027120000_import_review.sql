-- ADR 35: an import that found more than one recipe waits for the cook to
-- choose which to keep. The read recipes wait here until a save or a cancel
-- ends the review.
alter table public.import_operations
  drop constraint import_operations_outcome_check,
  add constraint import_operations_outcome_check
    check (outcome in ('saved', 'cancelled', 'review')),
  add column review jsonb;
comment on table public.import_operations is
  'Saved, cancelled or waiting for review, per import operation. A cancel after the save reports the save instead.';
