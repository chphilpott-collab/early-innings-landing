// api/send-lead-magnet.js
//
// EARLY INNINGS — LEAD MAGNET MAILER (Vercel serverless function)
// Sends "The 5 Things I Check First on Any Swing" through your own
// Namecheap Private Email mailbox. No third-party email service,
// no monthly fee. Runs free on Vercel's free tier.

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

  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    res.status(200).json({ ok: false, message: 'Something is misconfigured on our end — email coach@earlyinnings.training directly for now.' });
    return;
  }

  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const pdfUrl = `${proto}://${req.headers.host}/five-things-i-check-first.pdf`;
    const pdfResp = await fetch(pdfUrl);
    if (!pdfResp.ok) throw new Error('PDF not found at ' + pdfUrl);
    const pdfBuffer = Buffer.from(await pdfResp.arrayBuffer());

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    await transporter.sendMail({
      from: `"Coach Cole - Early Innings" <${process.env.SMTP_USER}>`,
      to: email,
      replyTo: process.env.SMTP_USER,
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

    res.status(200).json({ ok: true, message: 'On its way — check your inbox in a minute.' });
  } catch (err) {
    console.error('send-lead-magnet error:', err);
    res.status(200).json({ ok: false, message: "Couldn't send that just now. Mind trying again, or emailing coach@earlyinnings.training directly?" });
  }
};
