// Saiguang 3D / MouldNova — RFQ form handler
// Email (Resend) + Telegram push + file upload (Supabase Storage)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const TG_BOT_TOKEN = Deno.env.get('TG_BOT_TOKEN') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const TG_CHAT_ID = '8563750211';
const TO_EMAIL = 'zhangyuanbohz@163.com';
const FROM_EMAIL = 'onboarding@resend.dev';
const BUCKET = 'rfq-files';

const ALLOWED_EXTENSIONS = new Set([
  'stl', 'step', 'stp', 'iges', 'igs', '3mf', 'obj',
  'pdf', 'dxf', 'dwg', 'x_t', 'x_b', 'prt', 'sat',
]);
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const formData = await req.formData();

    const name     = formData.get('name')     ?? '';
    const company  = formData.get('company')  ?? '';
    const email    = formData.get('email')    ?? '';
    const country  = formData.get('country')  ?? '';
    const whatsapp = formData.get('whatsapp') ?? '';
    const service  = formData.get('service')  ?? '';
    const message  = formData.get('message')  ?? '';
    const file     = formData.get('file') as File | null;

    let fileUrl = '';
    let fileName = '';

    // Handle file upload
    if (file && file.size > 0) {
      fileName = file.name;
      const ext = fileName.split('.').pop()?.toLowerCase() ?? '';

      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return new Response(JSON.stringify({ ok: false, error: 'File type not allowed' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      if (file.size > MAX_FILE_SIZE) {
        return new Response(JSON.stringify({ ok: false, error: 'File too large (max 20MB)' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const timestamp = Date.now();
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${timestamp}_${safeName}`;

      const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: file,
        }
      );

      if (uploadRes.ok) {
        // Create signed URL (valid 7 days)
        const signRes = await fetch(
          `${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${storagePath}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ expiresIn: 604800 }),
          }
        );
        if (signRes.ok) {
          const signData = await signRes.json();
          fileUrl = `${SUPABASE_URL}/storage/v1${signData.signedURL}`;
        }
      }
    }

    // Email
    const fileRow = fileUrl
      ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">File</td><td style="padding:8px;border:1px solid #ddd"><a href="${fileUrl}">${fileName}</a></td></tr>`
      : '';

    const html = `
      <h2>New Inquiry — MouldNova / Saiguang 3D</h2>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Name</td><td style="padding:8px;border:1px solid #ddd">${name}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Company</td><td style="padding:8px;border:1px solid #ddd">${company}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Email</td><td style="padding:8px;border:1px solid #ddd">${email}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Country</td><td style="padding:8px;border:1px solid #ddd">${country}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">WhatsApp</td><td style="padding:8px;border:1px solid #ddd">${whatsapp}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Service</td><td style="padding:8px;border:1px solid #ddd">${service}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Message</td><td style="padding:8px;border:1px solid #ddd">${message}</td></tr>
        ${fileRow}
      </table>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        reply_to: email.toString(),
        subject: `New Inquiry from ${name} (${country}) — MouldNova`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend error: ${err}`);
    }

    // Telegram notification
    const fileLine = fileUrl ? `\n📎 *File:* [${fileName}](${fileUrl})` : '';
    const tgText = `🔔 *New MouldNova Inquiry*\n\n👤 *Name:* ${name}\n🏢 *Company:* ${company}\n📧 *Email:* ${email}\n🌍 *Country:* ${country}\n📱 *WhatsApp:* ${whatsapp}\n🔧 *Service:* ${service}\n💬 *Message:* ${message}${fileLine}`;
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text: tgText, parse_mode: 'Markdown' }),
    }).catch(() => {});

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
