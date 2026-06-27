import nodemailer from 'nodemailer';

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendMail(message) {
  if (!smtpConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[dev] Email skipped: ${message.to} ${message.subject}`);
      return;
    }
    throw new Error('SMTP is not configured');
  }

  await createTransporter().sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    ...message,
  });
}

export async function sendVerificationEmail(email, code) {
  if (!smtpConfigured() && process.env.NODE_ENV !== 'production') {
    console.log(`[dev] Email verification code for ${email}: ${code}`);
    return;
  }

  await sendMail({
    to: email,
    subject: '智学助手邮箱验证码',
    text: `你的验证码是：${code}。验证码 10 分钟内有效。`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2933">
        <h2>智学助手邮箱验证码</h2>
        <p>你的验证码是：</p>
        <div style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</div>
        <p>验证码 10 分钟内有效。如果不是你本人操作，可以忽略这封邮件。</p>
      </div>
    `,
  });
}

export async function sendStudyReminderEmail(email, reminder) {
  const actionText = reminder.kind === 'checkin'
    ? '打开应用完成签到，领取今日奖励。'
    : `还差 ${reminder.remainingCount} 项学习量，完成后就可以签到。`;

  await sendMail({
    to: email,
    subject: reminder.title,
    text: `${reminder.body}\n\n${actionText}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.7;color:#1f2933">
        <h2>${reminder.title}</h2>
        <p>${reminder.body}</p>
        <p>${actionText}</p>
        <p style="font-size:12px;color:#667085">你可以在智学助手设置中调整提醒时间或关闭邮件兜底。</p>
      </div>
    `,
  });
}
