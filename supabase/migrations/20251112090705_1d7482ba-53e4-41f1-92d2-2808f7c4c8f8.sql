-- Add assigned_at timestamp to track when leads are assigned
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;

-- Create trigger function to set assigned_at when user_id is assigned
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically update assigned_at
DROP TRIGGER IF EXISTS trigger_set_lead_assigned_at ON leads;
CREATE TRIGGER trigger_set_lead_assigned_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION set_lead_assigned_at();

-- Backfill assigned_at for existing assigned leads (set to updated_at as best guess)
UPDATE leads 
SET assigned_at = updated_at 
WHERE user_id IS NOT NULL AND assigned_at IS NULL;