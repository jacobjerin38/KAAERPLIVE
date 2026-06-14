import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase environment variables missing')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check API Key
    const apiKey = req.headers.get('x-api-key')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing x-api-key header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Verify API Key
    const { data: settingsData, error: settingsError } = await supabase
      .from('org_attendance_settings')
      .select('company_id')
      .eq('enable_biometric', true)
      .eq('biometric_api_key', apiKey)
      .maybeSingle()

    if (settingsError || !settingsData) {
      return new Response(JSON.stringify({ error: 'Invalid API Key or Biometric sync disabled' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const companyId = settingsData.company_id

    // Parse the payload (expecting JSON body from the Biometric terminal)
    // Payload format: { type: 'PUNCH', data: { employee_code: '1234', timestamp: '2023-10-27T08:00:00Z', punch_type: 'IN' } }
    const payload = await req.json()

    if (payload.type !== 'PUNCH' || !payload.data) {
      return new Response(JSON.stringify({ error: 'Invalid payload type' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { employee_code, timestamp, punch_type } = payload.data
    
    // Find the employee ID
    const { data: employeeData, error: employeeError } = await supabase
      .from('employees')
      .select('id')
      .eq('company_id', companyId)
      .eq('employee_code', employee_code)
      .maybeSingle()

    if (employeeError || !employeeData) {
      return new Response(JSON.stringify({ error: 'Employee not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const employeeId = employeeData.id

    // Check for existing attendance record for today
    const dateStr = new Date(timestamp).toISOString().split('T')[0]

    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance')
      .select('id, check_in, check_out')
      .eq('company_id', companyId)
      .eq('employee_id', employeeId)
      .eq('date', dateStr)
      .maybeSingle()

    if (attendanceError && attendanceError.code !== 'PGRST116') {
      throw attendanceError
    }

    let result;
    if (attendanceData) {
      // Update existing record
      const updateData: any = {}
      if (punch_type === 'IN') {
          // Generally we don't overwrite check-in with a later IN punch unless it's null
          if (!attendanceData.check_in) updateData.check_in = timestamp
      } else if (punch_type === 'OUT') {
          updateData.check_out = timestamp
      }

      if (Object.keys(updateData).length > 0) {
        // Calculate duration if check_out is provided
        if (updateData.check_out && attendanceData.check_in) {
            const durationMs = new Date(updateData.check_out).getTime() - new Date(attendanceData.check_in).getTime()
            updateData.duration = durationMs / (1000 * 60 * 60) // convert to hours
        } else if (updateData.check_out && updateData.check_in) {
             const durationMs = new Date(updateData.check_out).getTime() - new Date(updateData.check_in).getTime()
             updateData.duration = durationMs / (1000 * 60 * 60) // convert to hours
        }

        const { data: updatedRecord, error: updateError } = await supabase
            .from('attendance')
            .update(updateData)
            .eq('id', attendanceData.id)
            .select()

        if (updateError) throw updateError
        result = updatedRecord
      } else {
        result = attendanceData // No changes made
      }

    } else {
      // Create new record
      const insertData: any = {
          company_id: companyId,
          employee_id: employeeId,
          date: dateStr,
          status: 'Present' // Default status
      }
      if (punch_type === 'IN') {
          insertData.check_in = timestamp
      } else if (punch_type === 'OUT') {
          insertData.check_out = timestamp
      }

      const { data: insertedRecord, error: insertError } = await supabase
          .from('attendance')
          .insert([insertData])
          .select()

      if (insertError) throw insertError
      result = insertedRecord
    }

    return new Response(JSON.stringify({ success: true, data: result }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error('Error processing device-sync request:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
