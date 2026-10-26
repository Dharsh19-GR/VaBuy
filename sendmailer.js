const nodemailer = require("nodemailer");

const sendOTP = async (email, purpose = "verification") => {
  const { SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP_USER and SMTP_PASS must be configured to send email.");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS.replace(/\s/g, ""),
    },
  });

  const otp = require("crypto").randomInt(100000, 1000000);
  const isPasswordReset = purpose === "password reset";
  const heading = isPasswordReset ? "Reset your password" : "Verify your email";
  const subject = isPasswordReset ? "Your VaBuy password reset code" : "Your VaBuy verification code";

  const mailOptions = {
    from: SMTP_USER,
    to: email,
    subject,
    text: `${heading}\n\nYour VaBuy code is ${otp}. It expires in 5 minutes. If you did not request this code, you can ignore this email.`,
    html: `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta name="x-apple-disable-message-reformatting">
          <title>${subject}</title>
        </head>
        <body style="margin:0;padding:0;background-color:#f3f5f9;font-family:Arial,Helvetica,sans-serif;color:#182230;">
          <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Your one-time VaBuy code expires in 5 minutes.</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f3f5f9;">
            <tr>
              <td align="center" style="padding:36px 16px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;background-color:#ffffff;border:1px solid #e4e7ec;border-radius:16px;overflow:hidden;">
                  <tr>
                    <td style="padding:24px 32px;background-color:#182230;">
                      <span style="font-size:22px;line-height:28px;font-weight:700;letter-spacing:.3px;color:#ffffff;">VaBuy</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:36px 32px 32px;">
                      <p style="margin:0 0 10px;font-size:13px;line-height:20px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#2563eb;">${isPasswordReset ? "Account security" : "Email verification"}</p>
                      <h1 style="margin:0 0 14px;font-size:26px;line-height:34px;color:#182230;">${heading}</h1>
                      <p style="margin:0 0 26px;font-size:15px;line-height:24px;color:#475467;">Use this one-time code to ${isPasswordReset ? "reset your VaBuy password" : "finish setting up your VaBuy account"}.</p>
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;background-color:#f8faff;border:1px solid #dbe5ff;border-radius:12px;">
                        <tr>
                          <td align="center" style="padding:20px 12px;font-size:34px;line-height:42px;font-weight:700;letter-spacing:10px;color:#1d4ed8;font-family:Arial,Helvetica,sans-serif;">${otp}</td>
                        </tr>
                      </table>
                      <p style="margin:0 0 8px;font-size:14px;line-height:22px;color:#475467;">This code expires in <strong style="color:#182230;">5 minutes</strong>.</p>
                      <p style="margin:0;font-size:13px;line-height:21px;color:#667085;">If you did not request this code, you can safely ignore this email. Never share your code with anyone.</p>
                    </td>
                  </tr>
                </table>
                <p style="margin:18px 0 0;font-size:12px;line-height:18px;color:#98a2b3;">This is an automated message from VaBuy. Please do not reply.</p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
  return String(otp);
};

module.exports = sendOTP;
