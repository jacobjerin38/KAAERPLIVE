import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
}

serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Supabase configuration missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Validate Caller JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Authenticate user token
    const { data: { user: callerUser }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid authentication token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. Verify Caller is Admin or has user management privileges
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, role, company_id')
      .eq('id', callerUser.id)
      .maybeSingle()

    const roleStr = (callerProfile?.role || '').toLowerCase()
    let isAllowed = ['admin', 'super admin', 'superadmin', 'managing director', 'ceo', 'senior administrative officer'].includes(roleStr)

    if (!isAllowed) {
      const { data: userPerm } = await supabaseAdmin
        .from('user_permissions')
        .select('id')
        .eq('user_id', callerUser.id)
        .in('permission', ['org.users.manage', 'org.structure.view', '*'])
        .eq('granted', true)
        .maybeSingle()
      if (userPerm) isAllowed = true
    }

    if (!isAllowed) {
      return new Response(JSON.stringify({ error: 'Forbidden: Only administrators can reset passwords' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4. Parse request body
    const body = await req.json().catch(() => ({}))
    const targetUserId = body.user_id
    const newPassword = body.new_password || '654321'

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 5. Tenant isolation check (if not super admin)
    if (!['super admin', 'superadmin'].includes(roleStr)) {
      const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('company_id')
        .eq('id', targetUserId)
        .maybeSingle()

      if (targetProfile && targetProfile.company_id && callerProfile?.company_id && targetProfile.company_id !== callerProfile.company_id) {
        return new Response(JSON.stringify({ error: 'Forbidden: Cannot reset password for a user in another company' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // 6. Update user password using Supabase Auth Admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword }
    )

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Password for user has been reset to default (${newPassword}).`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
