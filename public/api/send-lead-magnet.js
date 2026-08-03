// api/send-lead-magnet.js
//
// EARLY INNINGS — LEAD MAGNET MAILER (Vercel serverless function)
// Sends "The 5 Things I Check First on Any Swing" through your own
// Namecheap Private Email mailbox. No third-party email service,
// no monthly fee. Runs free on Vercel's free tier.
//
// Also logs every signup to a separate inbox so you've got a running
// list of who to follow up with.
//
// Requires SMTP_USER and SMTP_PASSWORD to be set as environment
// variables in your Vercel project (Settings -> Environment Variables).
// Do not hardcode credentials in this file.

const nodemailer = require('nodemailer');

const SMTP_HOST = 'mail.privateemail.com';
const SMTP_PORT = 587;
const SMTP_SECURE = false;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Invalid request.' });
    return;
  }

  const { email, website } = req.body || {};

  // Honeypot — a hidden field real visitors never fill in.
  if (website) {
    res.status(200).json({ ok: true, message: 'Thanks!' });
    return;
  }

  const emailOk = typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    res.status(200).json({ ok: false, message: "That email address doesn't look right — mind double-checking it?" });
    return;
  }

  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASSWORD = process.env.SMTP_PASSWORD;

  if (!SMTP_USER || !SMTP_PASSWORD) {
    console.error('Missing SMTP_USER or SMTP_PASSWORD environment variables.');
    res.status(200).json({ ok: false, message: "Couldn't send that just now. Mind trying again, or emailing coach@earlyinnings.training directly?" });
    return;
  }

  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const pdfUrl = `${proto}://${req.headers.host}/five-things-i-check-first.pdf`;
    console.log('Fetching PDF from:', pdfUrl);

    // Use https module for Node.js compatibility
    const https = require('https');
    const pdfBuffer = await new Promise((resolve, reject) => {
      https.get(pdfUrl, (resp) => {
        if (resp.statusCode !== 200) {
          reject(new Error(`PDF fetch failed: ${resp.statusCode}`));
          return;
        }
        const chunks = [];
        resp.on('data', chunk => chunks.push(chunk));
        resp.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    });

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    await transporter.sendMail({
      from: `"Coach Cole - Early Innings" <${SMTP_USER}>`,
      to: email,
      replyTo: SMTP_USER,
      subject: 'The 5 things I check first on any swing',
      html: `
        <div style="font-family:Georgia,serif;font-size:16px;color:#111;line-height:1.6;max-width:520px">
          <p>Hey,</p>
          <p>Here's the checklist, five things to look for on any swing, in order, attached as a PDF.</p>
          <p>Pull up a phone video tonight and run through it. If you want a second set of eyes on the actual swing, that's exactly what Early Innings does.</p>
          <p>&mdash; Coach Cole<br>
          <a href="https://earlyinnings.training" style="color:#8A7020">earlyinnings.training</a></p>
        </div>`,
      text: "Here's the checklist, attached as a PDF. Pull up a phone video tonight and run through it.\n\n— Coach Cole\nearlyinnings.training",
      attachments: [
        {
          filename: 'The 5 Things I Check First on Any Swing.pdf',
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    // Log the signup to a separate inbox so you've got a running list to
    // work from. Sent to a different address than SMTP_USER on purpose,
    // self-to-self mail on the same mailbox tends to get silently dropped.
    // Non-blocking: if this fails, the visitor still gets their PDF.
    try {
      const when = new Date().toLocaleString('en-US', {
        timeZone: 'America/New_York',
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      const notifyResult = await transporter.sendMail({
        from: `"Early Innings Signups" <${SMTP_USER}>`,
        to: 'chphilpott@gmail.com',
        replyTo: email,
        subject: `New PDF signup: ${email}`,
        html: `
          <div style="font-family:Georgia,serif;font-size:15px;color:#111;line-height:1.6;max-width:480px">
            <p style="margin:0 0 12px">New signup for the free swing checklist:</p>
            <p style="margin:0 0 12px;font-size:17px"><strong>${email}</strong></p>
            <p style="margin:0;color:#666;font-size:13px">${when} ET</p>
          </div>`,
        text: `New signup for the free swing checklist:\n${email}\n${when} ET`,
      });
      console.log('signup log email sent, messageId:', notifyResult.messageId);
    } catch (logErr) {
      console.error('signup log email failed (non-blocking):', logErr);
    }

    res.status(200).json({ ok: true, message: 'On its way — check your inbox in a minute.' });
  } catch (err) {
    console.error('send-lead-magnet error:', err);
    res.status(200).json({ ok: false, message: "Couldn't send that just now. Mind trying again, or emailing coach@earlyinnings.training directly?" });
  }
};
