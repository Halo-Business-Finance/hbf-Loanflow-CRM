-- ============================================
-- SECURITY FIX: Strengthen RLS policies for sensitive tables
-- ============================================

-- 1. PROFILES TABLE - Restrict to owner and super_admin only
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;

-- Create strict policies for profiles
CREATE POLICY "profiles_owner_select"
ON profiles FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    id = auth.uid() OR
    has_role('super_admin'::user_role) OR
    has_role('admin'::user_role)
  )
);

CREATE POLICY "profiles_owner_update"
ON profiles FOR UPDATE
USING (
  auth.uid() IS NOT NULL AND (
    id = auth.uid() OR
    has_role('super_admin'::user_role)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    id = auth.uid() OR
    has_role('super_admin'::user_role)
  )
);

CREATE POLICY "profiles_owner_insert"
ON profiles FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND id = auth.uid()
);

CREATE POLICY "profiles_super_admin_delete"
ON profiles FOR DELETE
USING (
  auth.uid() IS NOT NULL AND has_role('super_admin'::user_role)
);

-- 2. CONTACT_ENTITIES TABLE - Tighten financial data access
-- Drop overly permissive policies if they exist
DROP POLICY IF EXISTS "contact_entities_public_read" ON contact_entities;
DROP POLICY IF EXISTS "Allow public read" ON contact_entities;

-- Update SELECT policy to be more restrictive (replace existing)
DROP POLICY IF EXISTS "contact_entities_secure_select_policy" ON contact_entities;

CREATE POLICY "contact_entities_strict_select"
ON contact_entities FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    -- Owner always has access
    user_id = auth.uid() OR
    -- Super admin and admin have full access
    has_role('super_admin'::user_role) OR
    has_role('admin'::user_role) OR
    -- Manager can view for oversight
    has_role('manager'::user_role) OR
    -- Loan roles can ONLY view contacts linked to leads they're assigned to
    (
      has_any_role(auth.uid(), ARRAY['loan_processor'::user_role, 'underwriter'::user_role, 'funder'::user_role, 'closer'::user_role, 'loan_originator'::user_role]) AND
      (
        EXISTS (
          SELECT 1 FROM leads l
          WHERE l.contact_entity_id = contact_entities.id
          AND l.user_id = auth.uid()
        )
        OR
        EXISTS (
          SELECT 1 FROM additional_borrowers ab
          JOIN leads l ON l.id = ab.lead_id
          WHERE ab.contact_entity_id = contact_entities.id
          AND l.user_id = auth.uid()
        )
      )
    )
  )
);

-- 3. LEAD_DOCUMENTS TABLE - Add explicit document-level access controls
-- Drop existing policies
DROP POLICY IF EXISTS "lead_documents_select_policy" ON lead_documents;
DROP POLICY IF EXISTS "lead_documents_insert_policy" ON lead_documents;
DROP POLICY IF EXISTS "lead_documents_update_policy" ON lead_documents;
DROP POLICY IF EXISTS "lead_documents_delete_policy" ON lead_documents;
DROP POLICY IF EXISTS "Users can view their lead documents" ON lead_documents;
DROP POLICY IF EXISTS "Users can create lead documents" ON lead_documents;
DROP POLICY IF EXISTS "Users can update their lead documents" ON lead_documents;
DROP POLICY IF EXISTS "Users can delete their lead documents" ON lead_documents;
DROP POLICY IF EXISTS "Admins can manage all lead documents" ON lead_documents;
DROP POLICY IF EXISTS "Global admin access to lead_documents" ON lead_documents;
DROP POLICY IF EXISTS "Loan processors can view assigned lead documents" ON lead_documents;
DROP POLICY IF EXISTS "Loan roles can view assigned lead documents" ON lead_documents;

-- Create strict document access policies
CREATE POLICY "lead_documents_strict_select"
ON lead_documents FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    -- Document owner has access
    user_id = auth.uid() OR
    -- Super admin and admin have full access
    has_role('super_admin'::user_role) OR
    has_role('admin'::user_role) OR
    -- Manager can view for oversight
    has_role('manager'::user_role) OR
    -- Users can view documents for leads they own
    EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = lead_documents.lead_id
      AND l.user_id = auth.uid()
    ) OR
    -- Loan roles can ONLY view documents for leads explicitly assigned to them
    (
      has_any_role(auth.uid(), ARRAY['loan_processor'::user_role, 'underwriter'::user_role, 'funder'::user_role, 'closer'::user_role, 'loan_originator'::user_role]) AND
      EXISTS (
        SELECT 1 FROM leads l
        WHERE l.id = lead_documents.lead_id
        AND l.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "lead_documents_strict_insert"
ON lead_documents FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    -- User can insert their own documents
    user_id = auth.uid() OR
    -- Admins can insert
    has_role('super_admin'::user_role) OR
    has_role('admin'::user_role)
  )
);

CREATE POLICY "lead_documents_strict_update"
ON lead_documents FOR UPDATE
USING (
  auth.uid() IS NOT NULL AND (
    -- Document owner can update
    user_id = auth.uid() OR
    -- Admins can update
    has_role('super_admin'::user_role) OR
    has_role('admin'::user_role) OR
    -- Lead owner can update documents
    EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = lead_documents.lead_id
      AND l.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    user_id = auth.uid() OR
    has_role('super_admin'::user_role) OR
    has_role('admin'::user_role) OR
    EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = lead_documents.lead_id
      AND l.user_id = auth.uid()
    )
  )
);

CREATE POLICY "lead_documents_strict_delete"
ON lead_documents FOR DELETE
USING (
  auth.uid() IS NOT NULL AND (
    -- Document owner can delete
    user_id = auth.uid() OR
    -- Only super_admin and admin can delete
    has_role('super_admin'::user_role) OR
    has_role('admin'::user_role)
  )
);

-- Add audit logging triggers for data modifications only (not SELECT)
CREATE OR REPLACE FUNCTION log_sensitive_data_modification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    action,
    table_name,
    record_id,
    user_id,
    ip_address,
    risk_score,
    old_values,
    new_values
  ) VALUES (
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    auth.uid(),
    inet_client_addr(),
    CASE 
      WHEN TG_TABLE_NAME IN ('contact_entities', 'lead_documents') THEN 50
      WHEN TG_TABLE_NAME = 'profiles' THEN 30
      ELSE 10
    END,
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply audit triggers to sensitive tables for modifications only
DROP TRIGGER IF EXISTS audit_contact_entities_modification ON contact_entities;
CREATE TRIGGER audit_contact_entities_modification
  AFTER INSERT OR UPDATE OR DELETE ON contact_entities
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_data_modification();

DROP TRIGGER IF EXISTS audit_lead_documents_modification ON lead_documents;
CREATE TRIGGER audit_lead_documents_modification
  AFTER INSERT OR UPDATE OR DELETE ON lead_documents
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_data_modification();

DROP TRIGGER IF EXISTS audit_profiles_modification ON profiles;
CREATE TRIGGER audit_profiles_modification
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_data_modification();