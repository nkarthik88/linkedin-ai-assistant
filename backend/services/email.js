import { Resend } from "resend";
import { config } from "../config.js";

let resend = null;

function getResend() {
  if (!resend && config.resendApiKey) {
    resend = new Resend(config.resendApiKey);
  }
  return resend;
}

const FROM = `ProPostly <${config.fromEmail}>`;

function baseTemplate(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<style>
  body { margin:0; padding:0; background:#f0f4f8; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; }
  .wrapper { max-width:540px; margin:36px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.09); }
  .header { background:linear-gradient(135deg,#0a66c2 0%,#0e86f0 100%); padding:32px 36px; text-align:center; }
  .header h1 { color:#ffffff; margin:0; font-size:22px; font-weight:800; letter-spacing:-0.02em; }
  .header p { color:rgba(255,255,255,0.82); margin:6px 0 0; font-size:13px; }
  .body { padding:32px 36px; color:#1a1a1a; }
  .body h2 { margin:0 0 14px; font-size:20px; font-weight:700; color:#0f1a2e; }
  .body p { margin:0 0 16px; font-size:14px; line-height:1.7; color:#4a5568; }
  .badge { display:inline-block; background:#e8f5e9; color:#057642; padding:5px 14px; border-radius:999px; font-size:11px; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; margin-bottom:20px; }
  .badge-pro { background:#fffbeb; color:#b45309; }
  .cta { display:inline-block; background:linear-gradient(135deg,#0a66c2,#0e86f0); color:#ffffff; padding:14px 28px; border-radius:999px; text-decoration:none; font-weight:700; font-size:14px; margin:12px 0 24px; box-shadow:0 4px 12px rgba(10,102,194,0.3); }
  .feature-list { list-style:none; padding:0; margin:0 0 24px; }
  .feature-list li { padding:10px 0; font-size:14px; color:#374151; border-bottom:1px solid #f1f5f9; display:flex; align-items:flex-start; gap:10px; }
  .feature-list li:last-child { border-bottom:none; }
  .feature-list li::before { content:'✦'; color:#0a66c2; font-size:11px; margin-top:2px; flex-shrink:0; }
  .divider { height:1px; background:#f1f5f9; margin:20px 0; }
  .warning { background:#fffbeb; border-left:4px solid #f59e0b; padding:14px 18px; border-radius:0 8px 8px 0; margin-bottom:24px; }
  .warning p { color:#92400e; margin:0; font-size:14px; line-height:1.6; }
  .receipt-box { background:#f8fafc; border:1px solid #e8eef4; border-radius:12px; overflow:hidden; margin-bottom:24px; }
  .receipt-row { display:flex; justify-content:space-between; padding:12px 18px; font-size:14px; color:#374151; border-bottom:1px solid #e8eef4; }
  .receipt-row:last-child { border-bottom:none; font-weight:700; color:#0f1a2e; }
  .highlight-box { background:linear-gradient(135deg,#eff6ff,#dbeafe); border-radius:12px; padding:18px 20px; margin-bottom:24px; }
  .highlight-box p { color:#1e40af; margin:0; font-size:14px; font-weight:600; }
  .footer { background:#f8fafc; padding:22px 36px; text-align:center; font-size:12px; color:#94a3b8; border-top:1px solid #f1f5f9; }
  .footer a { color:#0a66c2; text-decoration:none; font-weight:600; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>ProPostly</h1>
    <p>Smart content tools for LinkedIn professionals</p>
  </div>
  <div class="body">${bodyHtml}</div>
  <div class="footer">
    <p>Questions? Just reply to this email — we read every one.</p>
    <p style="margin-top:8px;"><a href="https://propostly.com">propostly.com</a> &nbsp;·&nbsp; © 2026 ProPostly</p>
  </div>
</div>
</body>
</html>`;
}

export async function sendWelcomeEmail(email) {
  const client = getResend();
  if (!client || !email) return;

  const body = `
    <h2>You're in. Let's grow your LinkedIn. 🚀</h2>
    <p>Welcome to ProPostly! Your extension is ready — here's everything you can do right now on LinkedIn:</p>
    <ul class="feature-list">
      <li><strong>Generate Post</strong> — Turn any idea into 3 scroll-stopping post options</li>
      <li><strong>Personalized DM</strong> — Write outreach messages that actually get replies</li>
      <li><strong>Reply to Comment</strong> — Respond to comments in seconds, professionally</li>
      <li><strong>Improve Headline</strong> — Get 3 keyword-rich headline options for more profile views</li>
      <li><strong>Viral Post Rewriter</strong> — Transform any draft into a high-engagement post</li>
    </ul>
    <div class="highlight-box">
      <p>💡 Your free plan includes 10 uses per feature each month. Click the ProPostly icon in your browser to get started.</p>
    </div>
    <a href="https://propostly.com" class="cta">Open LinkedIn &amp; Start Creating →</a>
    <p style="font-size:13px;color:#94a3b8;margin-top:4px;">The extension lives inside LinkedIn. Look for the ProPostly button on any post, profile, or comment.</p>
  `;

  await client.emails.send({
    from: FROM,
    to: email,
    subject: "Welcome to ProPostly — you're all set 🎉",
    html: baseTemplate("Welcome to ProPostly", body),
  });
}

export async function sendPaymentReceiptEmail(email, { userId, amount = "$9.00", plan = "Pro" } = {}) {
  const client = getResend();
  if (!client || !email) return;

  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const body = `
    <span class="badge badge-pro">⭐ Pro Member</span>
    <h2>Congratulations — you're now Pro!</h2>
    <p>Your upgrade is confirmed and your account is fully unlocked. No more limits — create as much as you want, every single month.</p>
    <div class="receipt-box">
      <div class="receipt-row"><span>Plan</span><span>${plan}</span></div>
      <div class="receipt-row"><span>Date</span><span>${date}</span></div>
      <div class="receipt-row"><span>Billing</span><span>${amount}/month</span></div>
      <div class="receipt-row"><span>Status</span><span style="color:#057642;">Active ✓</span></div>
    </div>
    <p>Here's what's now unlocked on your account:</p>
    <ul class="feature-list">
      <li>Unlimited post generation, DMs, replies &amp; headlines — every month</li>
      <li>50 lead searches per month with smart qualification</li>
      <li>Advanced content engine for higher-quality, more nuanced outputs</li>
      <li>Priority support — reply to this email anytime</li>
    </ul>
    <a href="https://propostly.com" class="cta">Start Creating with Pro →</a>
    <p style="font-size:13px;color:#94a3b8;">You can manage your subscription anytime from inside the extension → Account tab.</p>
  `;

  await client.emails.send({
    from: FROM,
    to: email,
    subject: "You're now ProPostly Pro — welcome to unlimited 🎉",
    html: baseTemplate("Welcome to Pro", body),
  });
}

export async function sendUsageWarningEmail(email, { remaining = 2, limit = 10 } = {}) {
  const client = getResend();
  if (!client || !email) return;

  const body = `
    <h2>You're almost at your monthly limit</h2>
    <div class="warning">
      <p>⚠️ You have <strong>${remaining} free use${remaining === 1 ? "" : "s"} remaining</strong> this month across your features (free plan: ${limit}/feature/month).</p>
    </div>
    <p>Don't let momentum slow you down. Upgrade to Pro and never worry about limits again — unlimited uses every month, for just $9.</p>
    <ul class="feature-list">
      <li>Unlimited posts, DMs, replies, headlines &amp; rewrites</li>
      <li>50 lead searches per month</li>
      <li>Advanced content engine for richer outputs</li>
      <li>Cancel anytime, no questions asked</li>
    </ul>
    <a href="https://propostly.com" class="cta">Upgrade to Pro — $9/month →</a>
    <p style="font-size:13px;color:#94a3b8;">You can also upgrade directly inside the ProPostly extension — click the upgrade button in the popup.</p>
  `;

  await client.emails.send({
    from: FROM,
    to: email,
    subject: `Only ${remaining} free use${remaining === 1 ? "" : "s"} left this month — upgrade to keep going`,
    html: baseTemplate("Almost at your limit", body),
  });
}

export async function sendCancellationEmail(email) {
  const client = getResend();
  if (!client || !email) return;

  const body = `
    <h2>Your Pro subscription has been cancelled</h2>
    <p>We've processed your cancellation. Your account has moved back to the free plan — no further charges will be made.</p>
    <p>You still have full access to ProPostly with <strong>10 free uses per feature each month</strong>. Your LinkedIn content toolkit is still here whenever you need it.</p>
    <div class="divider"></div>
    <p>We'd genuinely love to know what we could do better. If anything felt off — the pricing, the features, anything at all — just reply to this email. We read every response.</p>
    <p style="font-size:13px;color:#94a3b8;margin-top:24px;">Whenever you're ready to come back, you can resubscribe from the extension in seconds.</p>
  `;

  await client.emails.send({
    from: FROM,
    to: email,
    subject: "Your ProPostly Pro subscription has been cancelled",
    html: baseTemplate("Subscription Cancelled", body),
  });
}
