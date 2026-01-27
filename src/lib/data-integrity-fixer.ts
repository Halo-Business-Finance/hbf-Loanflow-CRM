import { supabase } from "@/integrations/supabase/client"

export class DataIntegrityFixer {
  async checkAuthAndPermissions(): Promise<{ authenticated: boolean; userId: string | null; contactCount: number }> {
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { authenticated: false, userId: null, contactCount: 0 }
      }
      
      // Check how many contacts the user can access
      const { data: contacts, error } = await supabase
        .from('contact_entities')
        .select('id')
        
      return { 
        authenticated: true, 
        userId: user.id, 
        contactCount: contacts?.length || 0 
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      return { authenticated: false, userId: null, contactCount: 0 }
    }
  }

  async fixCurrentUserContactIssues(): Promise<{ fixed: number; errors: string[] }> {
    const result = { fixed: 0, errors: [] }

    try {
      console.log('🔧 Starting auto-fix for current user data...')
      
      // First check if user is authenticated
      const authCheck = await this.checkAuthAndPermissions()
      console.log('🔐 Auth check:', authCheck)
      
      if (!authCheck.authenticated) {
        result.errors.push('❌ User not authenticated. Please log in to fix data issues.')
        return result
      }
      
      if (authCheck.contactCount === 0) {
        result.errors.push('ℹ️ No contact entities found for current user.')
        return result
      }
      
      console.log(`👤 Authenticated as user ${authCheck.userId} with ${authCheck.contactCount} contacts`)
      
      // Fix null loan amounts for current user's contact entities
      const { data: userContacts, error: fetchError } = await supabase
        .from('contact_entities')
        .select('id, loan_amount, business_name, name, phone')
        .is('loan_amount', null)
      
      if (fetchError) {
        console.error('❌ Error fetching user contacts:', fetchError)
        result.errors.push(`Failed to fetch contacts: ${fetchError.message}`)
        return result
      }
      
      console.log(`📋 Found ${userContacts?.length || 0} contacts with null loan amounts for current user`)
      
      if (userContacts && userContacts.length > 0) {
        for (const contact of userContacts) {
          try {
            // Set reasonable default based on business type
            const defaultLoanAmount = contact.business_name ? 100000 : 50000
            
            console.log(`🔨 Fixing ${contact.name} (${contact.id}): Setting loan amount to $${defaultLoanAmount}`)
            
            const { error: updateError } = await supabase
              .from('contact_entities')
              .update({ 
                loan_amount: defaultLoanAmount 
              })
              .eq('id', contact.id)
            
            if (!updateError) {
              result.fixed++
              console.log(`✅ Successfully fixed ${contact.name}`)
            } else {
              console.error(`❌ Failed to fix ${contact.name}:`, updateError)
              result.errors.push(`Failed to fix ${contact.name}: ${updateError.message}`)
            }
          } catch (contactError) {
            console.error(`❌ Exception fixing ${contact.name}:`, contactError)
            result.errors.push(`Exception fixing ${contact.name}: ${contactError}`)
          }
        }
      }

      // Fix contacts with large loan amounts but missing business names
      const { data: largeLoans, error: largeLoansError } = await supabase
        .from('contact_entities')
        .select('id, name, loan_amount, business_name')
        .gt('loan_amount', 100000)
        .or('business_name.is.null,business_name.eq.""')
      
      if (largeLoansError) {
        console.error('❌ Error fetching large loans:', largeLoansError)
      } else if (largeLoans && largeLoans.length > 0) {
        console.log(`📋 Found ${largeLoans.length} large loans without business names`)
        
        for (const contact of largeLoans) {
          try {
            // Generate a reasonable business name based on the contact name
            const businessName = contact.name ? `${contact.name} Business` : 'Business Entity'
            
            console.log(`🔨 Adding business name to ${contact.name}: ${businessName}`)
            
            const { error: updateError } = await supabase
              .from('contact_entities')
              .update({ business_name: businessName })
              .eq('id', contact.id)
            
            if (!updateError) {
              result.fixed++
              console.log(`✅ Successfully added business name for ${contact.name}`)
            } else {
              console.error(`❌ Failed to add business name:`, updateError)
              result.errors.push(`Failed to add business name: ${updateError.message}`)
            }
          } catch (error) {
            console.error(`❌ Exception adding business name:`, error)
            result.errors.push(`Exception adding business name: ${error}`)
          }
        }
      }

      // Fix contacts with invalid phone number formats
      const { data: phoneContacts, error: phoneError } = await supabase
        .from('contact_entities')
        .select('id, name, phone')
        .not('phone', 'is', null)
        .neq('phone', '')
      
      if (phoneError) {
        console.error('❌ Error fetching phone contacts:', phoneError)
      } else if (phoneContacts && phoneContacts.length > 0) {
        console.log(`📋 Checking ${phoneContacts.length} contacts for phone format issues`)
        
        for (const contact of phoneContacts) {
          try {
            const phone = contact.phone
            // Check if phone needs formatting (only digits, no formatting)
            if (phone && /^\d{10}$/.test(phone.replace(/\D/g, ''))) {
              const digits = phone.replace(/\D/g, '')
              if (digits.length === 10) {
                const formattedPhone = `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
                
                if (formattedPhone !== phone) {
                  console.log(`🔨 Formatting phone for ${contact.name}: ${phone} → ${formattedPhone}`)
                  
                  const { error: updateError } = await supabase
                    .from('contact_entities')
                    .update({ phone: formattedPhone })
                    .eq('id', contact.id)
                  
                  if (!updateError) {
                    result.fixed++
                    console.log(`✅ Successfully formatted phone for ${contact.name}`)
                  } else {
                    console.error(`❌ Failed to format phone:`, updateError)
                    result.errors.push(`Failed to format phone: ${updateError.message}`)
                  }
                }
              }
            }
          } catch (error) {
            console.error(`❌ Exception formatting phone:`, error)
            result.errors.push(`Exception formatting phone: ${error}`)
          }
        }
      }
      
      // Fix pipeline entries with missing amounts
      const { data: pipelineIssues, error: pipelineError } = await supabase
        .from('pipeline_entries')
        .select('id, amount, stage, lead_id')
        .or('amount.is.null,amount.eq.0')
      
      if (pipelineError) {
        console.error('❌ Error fetching pipeline entries:', pipelineError)
        result.errors.push(`Failed to fetch pipeline entries: ${pipelineError.message}`)
      } else if (pipelineIssues && pipelineIssues.length > 0) {
        console.log(`📋 Found ${pipelineIssues.length} pipeline entries with missing amounts`)
        
        for (const pipeline of pipelineIssues) {
          try {
            let defaultAmount = 50000 // Default amount
            
            // Set amount based on stage
            if (pipeline.stage) {
              switch (pipeline.stage.toLowerCase()) {
                case 'application':
                case 'qualified':
                  defaultAmount = 100000
                  break
                case 'loan approved':
                case 'documentation':
                case 'closing':
                  defaultAmount = 250000
                  break
                case 'funded':
                  defaultAmount = 500000
                  break
              }
            }
            
            console.log(`🔨 Fixing pipeline entry ${pipeline.id}: Setting amount to $${defaultAmount}`)
            
            const { error: updateError } = await supabase
              .from('pipeline_entries')
              .update({ amount: defaultAmount })
              .eq('id', pipeline.id)
            
            if (!updateError) {
              result.fixed++
              console.log(`✅ Successfully fixed pipeline entry ${pipeline.id}`)
            } else {
              console.error(`❌ Failed to fix pipeline entry:`, updateError)
              result.errors.push(`Failed to fix pipeline entry: ${updateError.message}`)
            }
          } catch (pipelineError) {
            console.error(`❌ Exception fixing pipeline entry:`, pipelineError)
            result.errors.push(`Exception fixing pipeline entry: ${pipelineError}`)
          }
        }
      }

      // Fix contacts missing priority field
      const { data: missingPriority, error: priorityError } = await supabase
        .from('contact_entities')
        .select('id, name, priority')
        .or('priority.is.null,priority.eq.""')
      
      if (priorityError) {
        console.error('❌ Error fetching priority issues:', priorityError)
      } else if (missingPriority && missingPriority.length > 0) {
        console.log(`📋 Found ${missingPriority.length} contacts with missing priority`)
        
        for (const contact of missingPriority) {
          try {
            console.log(`🔨 Setting default priority for ${contact.name}`)
            
            const { error: updateError } = await supabase
              .from('contact_entities')
              .update({ priority: 'medium' })
              .eq('id', contact.id)
            
            if (!updateError) {
              result.fixed++
              console.log(`✅ Successfully set priority for ${contact.name}`)
            } else {
              console.error(`❌ Failed to set priority:`, updateError)
              result.errors.push(`Failed to set priority: ${updateError.message}`)
            }
          } catch (error) {
            console.error(`❌ Exception setting priority:`, error)
            result.errors.push(`Exception setting priority: ${error}`)
          }
        }
      }

      // Fix contacts missing stage field
      const { data: missingStage, error: stageError } = await supabase
        .from('contact_entities')
        .select('id, name, stage')
        .or('stage.is.null,stage.eq.""')
      
      if (stageError) {
        console.error('❌ Error fetching stage issues:', stageError)
      } else if (missingStage && missingStage.length > 0) {
        console.log(`📋 Found ${missingStage.length} contacts with missing stage`)
        
        for (const contact of missingStage) {
          try {
            console.log(`🔨 Setting default stage for ${contact.name}`)
            
            const { error: updateError } = await supabase
              .from('contact_entities')
              .update({ stage: 'New Lead' })
              .eq('id', contact.id)
            
            if (!updateError) {
              result.fixed++
              console.log(`✅ Successfully set stage for ${contact.name}`)
            } else {
              console.error(`❌ Failed to set stage:`, updateError)
              result.errors.push(`Failed to set stage: ${updateError.message}`)
            }
          } catch (error) {
            console.error(`❌ Exception setting stage:`, error)
            result.errors.push(`Exception setting stage: ${error}`)
          }
        }
      }
      
      console.log(`🎉 Auto-fix completed: ${result.fixed} fixes, ${result.errors.length} errors`)
      
      if (result.fixed === 0 && result.errors.length === 0) {
        // Check if there are actually any issues to fix by doing a quick validation
        const issueCheck = await this.checkForRemainingIssues()
        if (issueCheck.hasIssues) {
          result.errors.push('Some data integrity issues were detected but could not be automatically fixed. Please check the audit results for details.')
        } else {
          result.errors.push('✅ All data integrity issues have been resolved! Your data is now consistent.')
        }
      }
      
      return result
    } catch (error) {
      console.error('❌ Auto-fix failed:', error)
      result.errors.push(`Auto-fix failed: ${error}`)
      return result
    }
  }

  private async checkForRemainingIssues(): Promise<{ hasIssues: boolean; issueCount: number }> {
    try {
      let issueCount = 0

      // Check for contacts without proper priority
      const { data: priorityIssues } = await supabase
        .from('contact_entities')
        .select('id')
        .or('priority.is.null,priority.eq.""')
      issueCount += priorityIssues?.length || 0

      // Check for contacts without proper stage
      const { data: stageIssues } = await supabase
        .from('contact_entities')
        .select('id')
        .or('stage.is.null,stage.eq.""')
      issueCount += stageIssues?.length || 0

      // Check for null loan amounts
      const { data: loanIssues } = await supabase
        .from('contact_entities')
        .select('id')
        .is('loan_amount', null)
      issueCount += loanIssues?.length || 0

      // Check for large loans without business names
      const { data: businessIssues } = await supabase
        .from('contact_entities')
        .select('id')
        .gt('loan_amount', 100000)
        .or('business_name.is.null,business_name.eq.""')
      issueCount += businessIssues?.length || 0

      // Check for pipeline entries without amounts
      const { data: pipelineIssues } = await supabase
        .from('pipeline_entries')
        .select('id')
        .or('amount.is.null,amount.eq.0')
      issueCount += pipelineIssues?.length || 0

      return { hasIssues: issueCount > 0, issueCount }
    } catch (error) {
      console.error('Error checking for remaining issues:', error)
      return { hasIssues: true, issueCount: 0 }
    }
  }
}