import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SecureLogger } from '../_shared/secure-logger.ts'

const logger = new SecureLogger('secure-profile-access')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    logger.logRequest(req)
    
    const body = await req.json().catch(e => {
      logger.error('Failed to parse JSON body', e)
      throw new Error('Invalid JSON in request body')
    })
    
    const { action, profile_id, updates, profile_ids } = body
    
    // Get the authenticated user
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      logger.error('Missing authorization header')
      throw new Error('Missing authorization header')
    }

    // Extract the JWT token from the authorization header
    const token = authHeader.replace('Bearer ', '')
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      logger.error('Authentication failed', userError)
      throw new Error('Authentication failed: ' + (userError?.message || 'No user found'))
    }
    
    logger.logAuth(user.id)
    logger.logAction(action)

    switch (action) {
      case 'get_masked_profile':
        return await getMaskedProfile(profile_id, user.id)
      case 'get_multiple_profiles':
        return await getMultipleProfiles(profile_ids, user.id)
      case 'update_profile_secure':
        return await updateProfileSecure(profile_id, updates, user.id)
      case 'migrate_existing_data':
        return await migrateExistingData(user.id)
      default:
        logger.error('Invalid action', undefined, { action })
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
  } catch (error) {
    logger.error('Request processing failed', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ 
        error: message,
        details: 'Check function logs for more information'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function getMaskedProfile(profileId: string, requestingUserId: string) {
  try {
    logger.info('Getting masked profile')
    
    const { data, error } = await supabase.rpc('get_masked_profile_data', {
      p_profile_id: profileId,
      p_requesting_user_id: requestingUserId
    })

    if (error) {
      logger.error('RPC error in get_masked_profile_data', error)
      throw error
    }

    logger.info('Profile data retrieved successfully')

    return new Response(
      JSON.stringify({ data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    logger.error('Error getting masked profile', error)
    throw error
  }
}

async function getMultipleProfiles(profileIds: string[], requestingUserId: string) {
  try {
    logger.info('Getting multiple profiles', { count: profileIds?.length })
    
    if (!Array.isArray(profileIds)) {
      throw new Error('profile_ids must be an array')
    }

    // Get masked data for each profile
    const profilePromises = profileIds.map(async (profileId: string) => {
      const { data, error } = await supabase.rpc('get_masked_profile_data', {
        p_profile_id: profileId,
        p_requesting_user_id: requestingUserId
      })
      
      if (error) {
        logger.error('Error getting profile', error)
        return null
      }
      
      return data
    })

    const profiles = await Promise.all(profilePromises)
    const validProfiles = profiles.filter(p => p !== null)

    logger.info('Multiple profiles retrieved', { 
      requested: profileIds.length, 
      returned: validProfiles.length 
    })

    return new Response(
      JSON.stringify({ data: validProfiles }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    logger.error('Error getting multiple profiles', error)
    throw error
  }
}

async function updateProfileSecure(profileId: string, updates: any, requestingUserId: string) {
  try {
    logger.info('Updating profile securely')
    
    // Validate that user can update this profile
    if (profileId !== requestingUserId) {
      // Check if user has admin permissions
      const { data: role, error: roleError } = await supabase.rpc('get_user_role', {
        p_user_id: requestingUserId
      })
      
      if (roleError) {
        logger.error('Error getting user role', roleError)
        throw new Error('Failed to verify permissions')
      }
      
      if (!role || !['admin', 'super_admin'].includes(role)) {
        throw new Error('Unauthorized to update this profile')
      }
    }

    const { data, error } = await supabase.rpc('update_profile_secure', {
      p_profile_id: profileId,
      p_updates: updates
    })

    if (error) {
      logger.error('RPC error in update_profile_secure', error)
      throw error
    }

    logger.info('Profile updated securely')

    return new Response(
      JSON.stringify({ data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    logger.error('Error updating profile', error)
    throw error
  }
}

async function migrateExistingData(requestingUserId: string) {
  try {
    logger.info('Starting data migration')
    
    // Check if user has admin permissions for migration
    const { data: role, error: roleError } = await supabase.rpc('get_user_role', {
      p_user_id: requestingUserId
    })
    
    if (roleError) {
      logger.error('Error getting user role', roleError)
      throw new Error('Failed to verify permissions')
    }
    
    if (!role || !['admin', 'super_admin'].includes(role)) {
      throw new Error('Unauthorized to perform data migration')
    }

    // Get all profiles with sensitive data that haven't been encrypted yet
    logger.info('Fetching profiles to migrate')
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, phone_number')
      .not('email', 'is', null)

    if (profilesError) {
      logger.error('Error fetching profiles', profilesError)
      throw new Error('Failed to fetch profiles')
    }

    logger.info('Profiles found', { count: profiles?.length || 0 })

    let migratedCount = 0
    
    // Encrypt existing sensitive data
    if (profiles && profiles.length > 0) {
      for (const profile of profiles) {
        try {
          if (profile.email) {
            await supabase.rpc('encrypt_profile_field', {
              p_profile_id: profile.id,
              p_field_name: 'email',
              p_field_value: profile.email
            })
          }
          
          if (profile.phone_number) {
            await supabase.rpc('encrypt_profile_field', {
              p_profile_id: profile.id,
              p_field_name: 'phone_number',
              p_field_value: profile.phone_number
            })
          }
          
          migratedCount++
        } catch (encryptError) {
          logger.error('Error encrypting profile data', encryptError)
          // Continue with other profiles even if one fails
        }
      }
    }

    logger.info('Data migration completed', { migratedCount })

    // Log the migration completion event
    try {
      await supabase.from('security_events').insert({
        user_id: requestingUserId,
        event_type: 'profile_data_migration_completed',
        severity: 'low',
        details: {
          migrated_profiles: migratedCount,
          timestamp: new Date().toISOString()
        }
      });
    } catch (logError: unknown) {
      logger.warn('Failed to log migration completion', logError instanceof Error ? logError : new Error(String(logError)));
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        migrated_profiles: migratedCount,
        message: `Successfully migrated ${migratedCount} profiles with encryption`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    logger.error('Error during data migration', error)
    throw error
  }
}