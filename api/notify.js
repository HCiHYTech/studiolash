// Vercel serverless function — sends a booking notification to Kelsey via Resend email.
//
// 2026-09-02: repointed from Twilio SMS back to Resend email. The Twilio path
// (commit 182d1ab) has been sitting dead since 2026-07-19 — TWILIO_ACCOUNT_SID /
// TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER were never set on this Vercel project
// (Linear AIF-63), and even once set, delivery is separately gated on the HCiHY
// subaccount's toll-free number clearing Twilio Trust Hub verification — no ETA
// on either. Email has no such gate: it uses the same Resend pattern this repo
// already ran successfully June 19–July 19 2026 (see commit 65bb9d8), just via a
// raw fetch instead of the `resend` npm package so no package.json/build step is
// needed here, matching the rest of this repo's no-dependency style.
//
// Sends to Kelsey directly (not Dan) — confirmed her real inbox 2026-09-02.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
// hcihytech.com is the domain verified in Resend (2026-09-02) — hcihysvc.com
// was the old default and was never confirmed verified. Recipients see the
// "Kelsey Renee Beauty Booking" display name, not this raw address, so which
// verified domain it rides on doesn't matter cosmetically.
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'bookings@hcihytech.com';

// Kelsey's own inbox. Confirmed current/accurate via the SL-001 client record
// (2026-07-18 correction) and reconfirmed 2026-09-02.
const KELSEY_EMAIL = process.env.KELSEY_NOTIFY_EMAIL || 'kelsey.bell66@yahoo.com';

async function sendEmail({ to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Kelsey Renee Beauty Booking <${RESEND_FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend ${res.status}: ${text}`);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const { name, phone, day, time, service, notes } = req.body || {};

  if (!name || !phone || !day || !time) {
    res.status(400).json({ ok: false, error: 'Missing required fields' });
    return;
  }

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured — cannot send booking email');
    res.status(500).json({ ok: false, error: 'Email notification is not configured yet' });
    return;
  }

  const bodyLines = [
    `New booking request — Kelsey Renee Beauty`,
    ``,
    `Name: ${name}`,
    `Phone: ${phone}`,
    `Service: ${service || 'n/a'}`,
    `Requested day: ${day}`,
    `Requested time: ${time}`,
    `Notes: ${notes || 'n/a'}`,
  ];

  try {
    await sendEmail({
      to: KELSEY_EMAIL,
      subject: `New booking request — ${name} (${day} @ ${time})`,
      html: bodyLines.map((line) => `<p>${line}</p>`).join(''),
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Kelsey booking email failed:', err.message);
    res.status(502).json({ ok: false, error: 'Failed to send email notification' });
  }
};
