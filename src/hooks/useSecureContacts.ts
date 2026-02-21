import { useState, useEffect } from 'react';
import { ibmDb } from '@/lib/ibm';
import { getAuthUser } from '@/lib/auth-utils';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import type { ContactEntity } from '@/types/lead';

interface SecureContactData {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  business_name?: string;
  location?: string;
  stage?: string;
  priority?: string;
  loan_type?: string;
  loan_amount?: number;
  credit_score?: number;
  income?: number;
  user_id: string;
  created_at: string;
  updated_at?: string;
}

export const useSecureContacts = () => {
  const [contacts, setContacts] = useState<SecureContactData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchSecureContacts = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const { data: contactIds, error: idsError } = await ibmDb
        .from('contact_entities')
        .select('id')
        .eq('user_id', user.id);

      if (idsError) throw idsError;
      const ids = (contactIds as any[]) || [];
      if (!ids.length) { setContacts([]); return; }

      const secureContacts: SecureContactData[] = [];
      for (const { id } of ids) {
        const { data, error } = await ibmDb.rpc('get_masked_contact_data_enhanced', {
          p_contact_id: id, p_requesting_user_id: user.id
        });
        if (error) { console.error('Error fetching contact:', error); continue; }
        if (data) secureContacts.push(data as unknown as SecureContactData);
      }
      setContacts(secureContacts);
    } catch (error) {
      console.error('Error fetching secure contacts:', error);
      toast({ title: "Error", description: "Failed to fetch contacts securely", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const createSecureContact = async (contactData: Partial<ContactEntity>) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to create contacts", variant: "destructive" });
      return null;
    }
    try {
      const authUser = await getAuthUser();
      if (!authUser) {
        toast({ title: "Authentication Error", description: "Please sign out and sign back in", variant: "destructive" });
        return null;
      }

      const sensitiveFields = {
        email: contactData.email, phone: contactData.phone, credit_score: contactData.credit_score,
        income: contactData.income, loan_amount: contactData.loan_amount, annual_revenue: contactData.annual_revenue,
        bdo_email: contactData.bdo_email, bdo_telephone: contactData.bdo_telephone
      };

      const mainFields = {
        name: contactData.name || '', email: '', business_name: contactData.business_name || '',
        business_address: contactData.business_address || '', location: contactData.location || '',
        stage: contactData.stage || 'New Lead', priority: contactData.priority || 'medium',
        loan_type: contactData.loan_type || '', notes: contactData.notes || '',
        naics_code: contactData.naics_code || '', ownership_structure: contactData.ownership_structure || '',
        user_id: user.id
      };

      const { data: newContact, error: createError } = await ibmDb
        .from('contact_entities')
        .insert(mainFields)
        .select()
        .single();

      if (createError) throw createError;
      const contact = newContact as any;

      for (const [fieldName, fieldValue] of Object.entries(sensitiveFields)) {
        if (fieldValue && String(fieldValue).trim()) {
          const { error: encryptError } = await ibmDb.rpc('encrypt_data', {
            p_action: 'encrypt', p_data: String(fieldValue).trim(),
            p_table_name: 'contact_entities', p_field_name: fieldName, p_record_id: contact.id
          });
          if (encryptError) console.error(`Error encrypting ${fieldName}:`, encryptError);
        }
      }

      await fetchSecureContacts();
      toast({ title: "Success", description: "Contact created securely with encryption" });
      return contact;
    } catch (error: any) {
      console.error('Error creating secure contact:', error);
      toast({ title: "Error", description: `Failed to create contact: ${error.message}`, variant: "destructive" });
      return null;
    }
  };

  const updateSecureContact = async (contactId: string, updates: Partial<ContactEntity>) => {
    if (!user) return null;
    try {
      const sensitiveFields = {
        email: updates.email, phone: updates.phone,
        credit_score: updates.credit_score?.toString(), income: updates.income?.toString(),
        loan_amount: updates.loan_amount?.toString()
      };
      const nonSensitiveFields = {
        name: updates.name, business_name: updates.business_name, location: updates.location,
        stage: updates.stage, priority: updates.priority, loan_type: updates.loan_type, notes: updates.notes
      };

      const { data: updatedContact, error: updateError } = await ibmDb
        .from('contact_entities')
        .update(nonSensitiveFields)
        .eq('id', contactId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      for (const [fieldName, fieldValue] of Object.entries(sensitiveFields)) {
        if (fieldValue && fieldValue.trim()) {
          const { error: encryptError } = await ibmDb.rpc('encrypt_contact_field_enhanced', {
            p_contact_id: contactId, p_field_name: fieldName, p_field_value: fieldValue.trim()
          });
          if (encryptError) console.error(`Error encrypting ${fieldName}:`, encryptError);
        }
      }

      await fetchSecureContacts();
      toast({ title: "Success", description: "Contact updated securely" });
      return updatedContact;
    } catch (error) {
      console.error('Error updating secure contact:', error);
      toast({ title: "Error", description: "Failed to update contact", variant: "destructive" });
      return null;
    }
  };

  const deleteSecureContact = async (contactId: string) => {
    if (!user) return false;
    try {
      const { error } = await ibmDb
        .from('contact_entities')
        .delete()
        .eq('id', contactId)
        .eq('user_id', user.id);
      if (error) throw error;
      await fetchSecureContacts();
      toast({ title: "Success", description: "Contact deleted securely" });
      return true;
    } catch (error) {
      console.error('Error deleting secure contact:', error);
      toast({ title: "Error", description: "Failed to delete contact", variant: "destructive" });
      return false;
    }
  };

  useEffect(() => { if (user) fetchSecureContacts(); }, [user]);

  return { contacts, isLoading, fetchSecureContacts, createSecureContact, updateSecureContact, deleteSecureContact };
};
