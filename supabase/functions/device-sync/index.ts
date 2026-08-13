import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
}

serve(async (req) => {
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

    // Check API Key (from header or URL query parameter ?api_key=...)
    const url = new URL(req.url)
    const apiKey = req.headers.get('x-api-key') || url.searchParams.get('api_key')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing x-api-key header or api_key query param' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Verify API Key against company settings or device integration key
    const { data: settingsData } = await supabase
      .from('org_attendance_settings')
      .select('company_id')
      .eq('enable_biometric', true)
      .eq('biometric_api_key', apiKey)
      .maybeSingle()

    let companyId = settingsData?.company_id

    if (!companyId) {
      // Check device_integrations table for device-specific API key
      const { data: deviceData } = await supabase
        .from('device_integrations')
        .select('company_id')
        .eq('api_key', apiKey)
        .maybeSingle()

      if (deviceData) {
        companyId = deviceData.company_id
      }
    }

    if (!companyId) {
      return new Response(JSON.stringify({ error: 'Invalid API Key or Biometric sync disabled' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Parse Payload (Supports Hikvision iVMS-4200, ZKTeco BioTime 9.0+, and Generic Webhook)
    const rawBody = await req.text()
    let payload: any = {}
    try {
      payload = JSON.parse(rawBody)
    } catch (_e) {
      payload = {}
    }

    let empCode = ''
    let timestamp = ''
    let punchType = 'IN'

    // 1. Hikvision iVMS-4200 / HikCentral / DS-K Series (ISAPI / Event Push)
    if (payload.AccessControlEvent || payload.event_log) {
      const acEvent = payload.AccessControlEvent || payload.event_log
      empCode = acEvent.employeeNoString || acEvent.employeeNo || acEvent.cardNo || ''
      timestamp = acEvent.eventTime || acEvent.time || new Date().toISOString()
      const subType = acEvent.subEventType || acEvent.eventType
      punchType = (subType === 21 || subType === 'checkIn' || subType === 1) ? 'IN' : 'OUT'

    // 2. ZKTeco BioTime 8.5 / 9.0+ / BioTime Cloud / ADMS
    } else if (payload.emp_code || payload.pin || (Array.isArray(payload.data) && payload.data[0]?.emp_code)) {
      const item = Array.isArray(payload.data) ? payload.data[0] : payload
      empCode = item.emp_code || item.pin || item.user_id || ''
      timestamp = item.punch_time || item.timestamp || item.att_time || new Date().toISOString()
      const state = item.punch_state ?? item.state ?? item.status
      punchType = (state === 0 || state === '0' || state === 'IN' || state === 'Check-In' || state === '01') ? 'IN' : 'OUT'

    // 3. Generic PUNCH Wrapper Format
    } else if (payload.type === 'PUNCH' && payload.data) {
      empCode = payload.data.employee_code || payload.data.employee_id || ''
      timestamp = payload.data.timestamp || new Date().toISOString()
      punchType = (payload.data.punch_type || 'IN').toUpperCase()

    // 4. Flat Standard JSON
    } else {
      empCode = payload.employee_code || payload.employeeNo || payload.emp_code || payload.user_id || ''
      timestamp = payload.timestamp || payload.punch_time || payload.eventTime || new Date().toISOString()
      punchType = (payload.punch_type || payload.type || 'IN').toUpperCase().includes('OUT') ? 'OUT' : 'IN'
    }

    if (!empCode) {
      return new Response(JSON.stringify({ error: 'Could not extract employee code from payload' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Find Employee ID
    const { data: employeeData, error: employeeError } = await supabase
      .from('employees')
      .select('id, name')
      .eq('company_id', companyId)
      .or(`employee_code.eq.${empCode},id.eq.${empCode}`)
      .maybeSingle()

    if (employeeError || !employeeData) {
      // Log raw device attempt in device_attendance_logs for debugging
      await supabase.from('device_attendance_logs').insert({
        company_id: companyId,
        employee_identifier: empCode,
        punch_time: new Date(timestamp).toISOString(),
        punch_type: punchType,
        sync_status: 'failed',
        sync_error: `Employee code '${empCode}' not found`
      })

      return new Response(JSON.stringify({ error: `Employee '${empCode}' not found in company` }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const employeeId = employeeData.id
    const dateStr = new Date(timestamp).toISOString().split('T')[0]

    // Log raw punch
    await supabase.from('device_attendance_logs').insert({
      company_id: companyId,
      employee_id: employeeId,
      employee_identifier: empCode,
      punch_time: new Date(timestamp).toISOString(),
      punch_type: punchType,
      sync_status: 'synced'
    })

    // Upsert into main attendance table
    // For OUT punches, check if there's an active open punch (check_out IS NULL) in the last 16 hours (supports night shifts)
    let openPunch: any = null;
    if (punchType === 'OUT') {
      const sixteenHoursAgo = new Date(new Date(timestamp).getTime() - 16 * 60 * 60 * 1000).toISOString()
      const { data: openPunches } = await supabase
        .from('attendance')
        .select('id, check_in, check_out, date')
        .eq('company_id', companyId)
        .eq('employee_id', employeeId)
        .is('check_out', null)
        .gte('check_in', sixteenHoursAgo)
        .order('check_in', { ascending: false })
        .limit(1)

      if (openPunches && openPunches.length > 0) {
        openPunch = openPunches[0]
      }
    }

    const { data: attendanceData } = openPunch
      ? { data: openPunch }
      : await supabase
          .from('attendance')
          .select('id, check_in, check_out, date')
          .eq('company_id', companyId)
          .eq('employee_id', employeeId)
          .eq('date', dateStr)
          .maybeSingle()

    let result;
    if (attendanceData) {
      const updateData: any = {}
      if (punchType === 'IN' && !attendanceData.check_in) {
        updateData.check_in = new Date(timestamp).toISOString()
      } else if (punchType === 'OUT') {
        updateData.check_out = new Date(timestamp).toISOString()
      }

      if (updateData.check_out && (updateData.check_in || attendanceData.check_in)) {
        const inTime = new Date(updateData.check_in || attendanceData.check_in).getTime()
        const outTime = new Date(updateData.check_out).getTime()
        const durHours = Math.max(0, parseFloat(((outTime - inTime) / (1000 * 60 * 60)).toFixed(2)))
        updateData.total_hours = durHours
        updateData.duration = durHours
        updateData.status = 'Present'
      }

      if (Object.keys(updateData).length > 0) {
        const { data: updatedRecord } = await supabase
          .from('attendance')
          .update(updateData)
          .eq('id', attendanceData.id)
          .select()
        result = updatedRecord
      } else {
        result = attendanceData
      }
    } else {
      const insertData: any = {
        company_id: companyId,
        employee_id: employeeId,
        date: dateStr,
        status: 'Present',
        source: 'device'
      }
      if (punchType === 'IN') {
        insertData.check_in = new Date(timestamp).toISOString()
      } else {
        insertData.check_out = new Date(timestamp).toISOString()
      }

      const { data: insertedRecord } = await supabase
        .from('attendance')
        .insert([insertData])
        .select()
      result = insertedRecord
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Punch recorded for ${employeeData.name} (${empCode})`,
      data: result
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error('Error processing device-sync request:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
