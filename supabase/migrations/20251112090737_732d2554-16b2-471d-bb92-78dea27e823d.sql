-- Fix search_path security warning for set_lead_assigned_at function
DROP FUNCTION IF EXISTS set_lead_assigned_at() CASCADE;

CREATE OR REPLACE FUNCTION set_lead_assigned_at()
RETURNS TRIGGER AS $$
BEGIN
  -- If user_id is being set from NULL to a value, update assigned_at
  IF OLD.user_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.assigned_at = NOW();
  END IF;
  
  -- If user_id is being changed from one user to another, update assigned_at
  IF OLD.user_id IS NOT NULL AND NEW.user_id IS NOT NULL AND OLD.user_id != NEW.user_id THEN
    NEW.assigned_at = NOW();
  END IF;
  
  -- If user_id is being set back to NULL (unassigned), clear assigned_at
  IF OLD.user_id IS NOT NULL AND NEW.user_id IS NULL THEN
    NEW.assigned_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_set_lead_assigned_at ON leads;
CREATE TRIGGER trigger_set_lead_assigned_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION set_lead_assigned_at();