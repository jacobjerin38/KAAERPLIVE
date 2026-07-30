-- Migration: Fix radius_meters column and auto-sync in employee_locations and locations tables

ALTER TABLE public.employee_locations ADD COLUMN IF NOT EXISTS radius_meters INTEGER;

UPDATE public.employee_locations SET radius_meters = COALESCE(geofence_radius_meters, 500) WHERE radius_meters IS NULL;

CREATE OR REPLACE FUNCTION sync_employee_locations_radius()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.radius_meters IS NOT NULL AND (NEW.geofence_radius_meters IS NULL OR NEW.geofence_radius_meters <> NEW.radius_meters) THEN
    NEW.geofence_radius_meters := NEW.radius_meters;
  ELSIF NEW.geofence_radius_meters IS NOT NULL AND (NEW.radius_meters IS NULL OR NEW.radius_meters <> NEW.geofence_radius_meters) THEN
    NEW.radius_meters := NEW.geofence_radius_meters;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_employee_locations_radius ON public.employee_locations;

CREATE TRIGGER trg_sync_employee_locations_radius
BEFORE INSERT OR UPDATE ON public.employee_locations
FOR EACH ROW EXECUTE FUNCTION sync_employee_locations_radius();

-- Locations table sync
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS radius_meters INTEGER;

UPDATE public.locations SET radius_meters = COALESCE(geofence_radius_meters, 500) WHERE radius_meters IS NULL;

CREATE OR REPLACE FUNCTION sync_locations_radius()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.radius_meters IS NOT NULL AND (NEW.geofence_radius_meters IS NULL OR NEW.geofence_radius_meters <> NEW.radius_meters) THEN
    NEW.geofence_radius_meters := NEW.radius_meters;
  ELSIF NEW.geofence_radius_meters IS NOT NULL AND (NEW.radius_meters IS NULL OR NEW.radius_meters <> NEW.geofence_radius_meters) THEN
    NEW.radius_meters := NEW.geofence_radius_meters;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_locations_radius ON public.locations;

CREATE TRIGGER trg_sync_locations_radius
BEFORE INSERT OR UPDATE ON public.locations
FOR EACH ROW EXECUTE FUNCTION sync_locations_radius();

NOTIFY pgrst, 'reload schema';
