import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://mouldnova.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let fields: Record<string, string> = {};

    if (contentType.includes('application/json')) {
      fields = await req.json();
    } else {
      // FormData
      const fd = await req.formData();
      for (const [key, value] of fd.entries()) {
        fields[key] = value.toString();
      }
    }

    // Map standard fields
    const name        = fields.name        || null;
    const company     = fields.company     || null;
    const email       = fields.email       || null;
    const phone       = fields.phone || fields.whatsapp || null;
    const country     = fields.country     || null;
    const message     = fields.message     || null;
    const service     = fields.service     || null;
    const form_source = fields.subject     || fields.form_source || 'MouldNova website';

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extra LP-specific fields go to metadata
    const reservedKeys = new Set([
      'name','company','email','phone','whatsapp','country','message',
      'service','subject','form_source','access_key','redirect','from_name','botcheck',
    ]);
    const metadata: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (!reservedKeys.has(k) && v) metadata[k] = v;
    }

    // Insert into Supabase (service_role key from env)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: dbError } = await supabase
      .from('rfq_submissions')
      .insert({
        name,
        company,
        email,
        phone,
        country,
        message,
        service,
        form_source,
        metadata: Object.keys(metadata).length ? metadata : null,
      });

    if (dbError) {
      console.error('DB insert error:', dbError);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send email via Resend
    const resendKey   = Deno.env.get('RESEND_API_KEY')!;
    const notifyEmail = Deno.env.get('NOTIFY_EMAIL') || 'zhangyuanbo123@gmail.com';

    const metaRows = Object.entries(metadata)
      .map(([k, v]) => `<tr><td style="padding:4px 8px;color:#666;text-transform:capitalize">${k}</td><td style="padding:4px 8px">${v}</td></tr>`)
      .join('');

    const htmlBody = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#A52030;margin-bottom:4px">New RFQ — MouldNova</h2>
  <p style="color:#666;font-size:0.9rem;margin-top:0">Source: <strong>${form_source}</strong></p>
  <table style="width:100%;border-collapse:collapse;margin-top:16px">
    <tr><td style="padding:8px;background:#f5f5f5;font-weight:700;width:30%">Name</td><td style="padding:8px">${name || '—'}</td></tr>
    <tr><td style="padding:8px;background:#f5f5f5;font-weight:700">Company</td><td style="padding:8px">${company || '—'}</td></tr>
    <tr><td style="padding:8px;background:#f5f5f5;font-weight:700">Email</td><td style="padding:8px"><a href="mailto:${email}">${email}</a></td></tr>
    <tr><td style="padding:8px;background:#f5f5f5;font-weight:700">Phone/WhatsApp</td><td style="padding:8px">${phone || '—'}</td></tr>
    <tr><td style="padding:8px;background:#f5f5f5;font-weight:700">Country</td><td style="padding:8px">${country || '—'}</td></tr>
    <tr><td style="padding:8px;background:#f5f5f5;font-weight:700">Service</td><td style="padding:8px">${service || '—'}</td></tr>
    ${metaRows}
  </table>
  <h3 style="margin-top:24px">Message</h3>
  <div style="background:#f9f9f9;padding:16px;border-radius:4px;white-space:pre-wrap">${message || '—'}</div>
  <p style="margin-top:24px;font-size:0.8rem;color:#999">View all leads at <a href="https://mouldnova.com/admin/">mouldnova.com/admin/</a></p>
</div>`;

    // 1. Notify owner
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'MouldNova CRM <noreply@mouldnova.com>',
        to: [notifyEmail],
        reply_to: email,
        subject: `[RFQ] ${form_source} — ${name || email}`,
        html: htmlBody,
      }),
    });

    // 2. Auto-reply to customer
    const customerName = name ? name.split(' ')[0] : 'there';
    const autoReplyHtml = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
  <div style="background:#A52030;padding:28px 32px;border-radius:8px 8px 0 0">
    <div style="color:#fff;font-size:1.3rem;font-weight:700;letter-spacing:0.02em">MouldNova</div>
    <div style="color:rgba(255,255,255,0.75);font-size:0.85rem;margin-top:4px">Conformal Cooling Inserts — Ningbo, China</div>
  </div>
  <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
    <h2 style="margin:0 0 16px;font-size:1.2rem">Hi ${customerName}, we've received your inquiry!</h2>
    <p style="color:#475569;line-height:1.6;margin:0 0 20px">
      Thank you for reaching out to MouldNova. Your request has been received and our engineering team will review your requirements and respond within <strong>24 hours</strong>.
    </p>
    <div style="background:#f8fafc;border-left:4px solid #A52030;padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 24px">
      <div style="font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;margin-bottom:8px">What happens next</div>
      <ol style="margin:0;padding-left:20px;color:#475569;font-size:0.9rem;line-height:1.8">
        <li>Our engineer reviews your project details</li>
        <li>We design a conformal channel layout for your insert</li>
        <li>You receive a DFM report + firm price within 24 hours</li>
      </ol>
    </div>
    <p style="color:#475569;line-height:1.6;margin:0 0 24px">
      For <strong>faster response</strong>, send your STEP/drawing directly on WhatsApp — we typically reply within 2–4 hours:
    </p>
    <a href="https://wa.me/8618268661068" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:0.95rem">
      WhatsApp: +86 182 6866 1068
    </a>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0" />
    <div style="font-size:0.8rem;color:#94a3b8;line-height:1.6">
      <strong style="color:#64748b">Saiguang 3D Technology Co., Ltd.</strong><br>
      Mazhu Small Business Park, Yuyao, Ningbo, China<br>
      <a href="https://mouldnova.com" style="color:#A52030">mouldnova.com</a> · zhangyuanbo123@gmail.com
    </div>
  </div>
</div>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'MouldNova <noreply@mouldnova.com>',
        to: [email],
        reply_to: notifyEmail,
        subject: `We've received your inquiry — MouldNova Conformal Cooling`,
        html: autoReplyHtml,
      }),
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
