import { Resend } from "resend";
import { config } from "../config.js";

let resend = null;

function getResend() {
  if (!resend && config.resendApiKey) {
    resend = new Resend(config.resendApiKey);
  }
  return resend;
}

const FROM = `LinkedIn AI Assistant <${config.fromEmail}>`;

function baseTemplate(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<style>
  body { margin: 0; padding: 0; background: #f3f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; }
  .wrapper { max-width: 520px; margin: 32px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .header { background: #0a66c2; padding: 28px 32px; text-align: center; }
  .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
  .header p { color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px; }
  .body { padding: 28px 32px; color: #191919; }
  .body h2 { margin: 0 0 12px; font-size: 18px; font-weight: 600; }
  .body p { margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #444; }
  .badge { display: inline-block; background: #e8f5e9; color: #057642; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 20px; }
  .cta { display: inline-block; background: #0a66c2; color: #ffffff; padding: 12px 24px; border-radius: 24px; text-decoration: none; font-weight: 600; font-size: 14px; margin: 8px 0 20px; }
  .feature-list { list-style: none; padding: 0; margin: 0 0 20px; }
  .feature-list li { padding: 8px 0; font-size: 14px; color: #444; border-bottom: 1px solid #f0f0f0; }
  .feature-list li:last-child { border-bottom: none; }
  .feature-list li::before { content: '✓ '; color: #0a66c2; font-weight: 700; }
  .warning { background: #fff8e1; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 4px; margin-bottom: 20px; }
  .warning p { color: #92400e; margin: 0; font-size: 13px; }
  .receipt-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
  .receipt-row:last-child { border-bottom: none; font-weight: 700; }
  .footer { background: #f3f6f8; padding: 20px 32px; text-align: center; font-size: 12px; color: #888; }
  .footer a { color: #0a66c2; text-decoration: none; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>LinkedIn AI Assistant</h1>
    <p>AI-powered content for your LinkedIn presence</p>
  </div>
  <div class="body">${bodyHtml}</div>
  <div class="footer">
    <p>Questions? Reply to this email or visit <a href="https://linkedinai.tech">linkedinai.tech</a></p>
    <p style="margin-top:8px;">© 2026 LinkedIn AI Assistant. All rights reserved.</p>
  </div>
</div>
</body>
</html>`;
}

export async function sendWelcomeEmail(email) {
  const client = getResend();
  if (!client || !email) return;

  const body = `
    <h2>Welcome to LinkedIn AI Assistant! 🎉</h2>
    <p>You're all set to supercharge your LinkedIn presence with AI. Here's what you can do:</p>
    <ul class="feature-list">
      <li>Generate Post — Create 3 polished post options from any topic</li>
      <li>Personalized DM — Write outreach messages tailored to any profile</li>
      <li>Reply to Comment — Craft thoughtful, professional replies</li>
      <li>Improve Headline — Get 3 keyword-optimized headline options</li>
      <li>Viral Post Rewriter — Turn your draft into a high-engagement post</li>
    </ul>
    <p>Your free plan includes <strong>10 AI generations per month</strong>. When you're ready for unlimited access, upgrade to Pro for just $9/month.</p>
    <a href="https://linkedinai.tech" class="cta">Open LinkedIn to Get Started</a>
    <p style="font-size:13px;color:#888;">The extension works directly inside LinkedIn. Click the extension icon in your browser toolbar to access all features.</p>
  `;

  await client.emails.send({
    from: FROM,
    to: email,
    subject: "Welcome to LinkedIn AI Assistant 🚀",
    html: baseTemplate("Welcome to LinkedIn AI Assistant", body),
  });
}

export async function sendPaymentReceiptEmail(email, { userId, amount = "$9.00", plan = "Pro" } = {}) {
  const client = getResend();
  if (!client || !email) return;

  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const body = `
    <span class="badge">Payment Confirmed</span>
    <h2>You're now a Pro member!</h2>
    <p>Thank you for upgrading. Your account has been upgraded to <strong>Pro</strong> and unlimited AI generations are now active.</p>
    <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;">
      <div class="receipt-row"><span>Plan</span><span>${plan}</span></div>
      <div class="receipt-row"><span>Date</span><span>${date}</span></div>
      <div class="receipt-row"><span>Amount</span><span>${amount}/month</span></div>
      <div class="receipt-row"><span>Status</span><span style="color:#057642;">Active ✓</span></div>
    </div>
    <p>Your Pro benefits:</p>
    <ul class="feature-list">
      <li>Unlimited AI generations every month</li>
      <li>Advanced AI model for smarter responses</li>
      <li>Priority support</li>
    </ul>
    <a href="https://linkedinai.tech" class="cta">Start Creating with Pro</a>
  `;

  await client.emails.send({
    from: FROM,
    to: email,
    subject: "Payment confirmed — Welcome to LinkedIn AI Pro! 🎉",
    html: baseTemplate("Payment Receipt", body),
  });
}

export async function sendUsageWarningEmail(email, { remaining = 2, limit = 10 } = {}) {
  const client = getResend();
  if (!client || !email) return;

  const body = `
    <h2>You're almost out of generations</h2>
    <div class="warning">
      <p>⚠️ You have <strong>${remaining} AI generation${remaining === 1 ? "" : "s"} remaining</strong> this month (out of ${limit} on the free plan).</p>
    </div>
    <p>Don't lose your momentum on LinkedIn. Upgrade to Pro for <strong>unlimited generations</strong> at just $9/month.</p>
    <ul class="feature-list">
      <li>Unlimited posts, DMs, headlines & rewrites</li>
      <li>Advanced AI (smarter, more detailed responses)</li>
      <li>Cancel anytime</li>
    </ul>
    <a href="https://linkedinai.tech" class="cta">Upgrade to Pro — $9/month</a>
    <p style="font-size:13px;color:#888;">You can also upgrade directly inside the LinkedIn AI Assistant extension.</p>
  `;

  await client.emails.send({
    from: FROM,
    to: email,
    subject: `Only ${remaining} AI generation${remaining === 1 ? "" : "s"} left this month`,
    html: baseTemplate("Usage Warning", body),
  });
}

export async function sendCancellationEmail(email) {
  const client = getResend();
  if (!client || !email) return;

  const body = `
    <h2>Your subscription has been cancelled</h2>
    <p>We've cancelled your LinkedIn AI Assistant Pro subscription as requested. Your account has been moved back to the free plan.</p>
    <p>You still have access to <strong>10 free AI generations per month</strong> — enough to keep building your LinkedIn presence.</p>
    <p>We'd love to know why you cancelled so we can improve. Just reply to this email with any feedback.</p>
    <p style="margin-top:24px;font-size:13px;color:#888;">If you change your mind, you can resubscribe anytime from the extension.</p>
  `;

  await client.emails.send({
    from: FROM,
    to: email,
    subject: "Your LinkedIn AI Pro subscription has been cancelled",
    html: baseTemplate("Subscription Cancelled", body),
  });
}
