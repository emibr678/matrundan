-- Trigger-funktionerna behöver inte SECURITY DEFINER: de anropas av
-- triggersystemet, inte av API-anropare, och SELECT mot places/visits räcker
-- med RLS för den inloggade användaren.
ALTER FUNCTION public.protect_owner_membership()      SECURITY INVOKER;
ALTER FUNCTION public.validate_visit_participant()    SECURITY INVOKER;
ALTER FUNCTION public.validate_activity_refs()        SECURITY INVOKER;
ALTER FUNCTION public.places_immutable_cols()         SECURITY INVOKER;
ALTER FUNCTION public.visits_immutable_cols()         SECURITY INVOKER;
ALTER FUNCTION public.reviews_immutable_cols()        SECURITY INVOKER;
ALTER FUNCTION public.place_sources_immutable_cols()  SECURITY INVOKER;
ALTER FUNCTION public.activity_immutable_cols()       SECURITY INVOKER;

-- Extra: ingen anropare behöver EXECUTE på dessa trigger-funktioner.
REVOKE EXECUTE ON FUNCTION
  public.protect_owner_membership(),
  public.validate_visit_participant(),
  public.validate_activity_refs(),
  public.places_immutable_cols(),
  public.visits_immutable_cols(),
  public.reviews_immutable_cols(),
  public.place_sources_immutable_cols(),
  public.activity_immutable_cols()
FROM PUBLIC, anon, authenticated;