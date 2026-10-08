import { formatRupiah } from "@/lib/money";

export interface SendReminderEmailParams {
  toEmail: string;
  debtorName: string;
  creditorName: string;
  groupName: string;
  amount: number;
  paymentMethodText?: string;
  settleUrl: string;
}

/**
 * Sends a reminder email via Resend if RESEND_API_KEY is configured.
 * Otherwise logs the formatted email content safely in development.
 */
export async function sendReminderEmail(
  params: SendReminderEmailParams,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const {
    toEmail,
    debtorName,
    creditorName,
    groupName,
    amount,
    paymentMethodText,
    settleUrl,
  } = params;

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.EMAIL_FROM || "Patungan <noreply@patungin.com>";

  const subject = `Pengingat Pelunasan Tagihan: ${groupName} (${formatRupiah(amount)})`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FFFDF5; color: #121212; padding: 24px; }
          .card { max-width: 520px; margin: 0 auto; background: #ffffff; border: 3px solid #121212; box-shadow: 5px 5px 0px 0px #121212; border-radius: 12px; padding: 28px; }
          .badge { display: inline-block; background: #FFE600; border: 2px solid #121212; padding: 4px 10px; font-size: 11px; font-weight: 800; text-transform: uppercase; border-radius: 4px; margin-bottom: 12px; }
          .amount-box { background: #FFFDF5; border: 2px solid #121212; padding: 14px; border-radius: 8px; margin: 18px 0; text-align: center; }
          .amount { font-size: 26px; font-weight: 900; color: #121212; }
          .btn { display: inline-block; background: #FFE600; border: 2px solid #121212; box-shadow: 3px 3px 0px 0px #121212; padding: 12px 24px; font-weight: 800; font-size: 14px; text-decoration: none; color: #121212; border-radius: 8px; margin-top: 14px; }
          .footer { font-size: 11px; color: #7c775f; margin-top: 24px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">Pengingat Pelunasan</div>
          <h2 style="margin: 0 0 12px 0; font-weight: 900;">Halo ${debtorName},</h2>
          <p style="font-size: 14px; line-height: 1.5; color: #4b4731;">
            Ini adalah pengingat ramah untuk kewajiban patungan Anda di grup <strong>${groupName}</strong> yang belum terkonfirmasi lunas.
          </p>

          <div class="amount-box">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #7c775f; margin-bottom: 4px;">Total Tagihan</div>
            <div class="amount">${formatRupiah(amount)}</div>
            <div style="font-size: 12px; color: #4b4731; margin-top: 4px;">Ditalangi oleh: <strong>${creditorName}</strong></div>
          </div>

          ${
            paymentMethodText
              ? `<div style="background: #f6f3f2; border: 1px solid #121212; padding: 10px; border-radius: 6px; font-size: 12px; margin-bottom: 16px;">
                  <strong>Info Transfer Penerima:</strong><br>${paymentMethodText}
                </div>`
              : ""
          }

          <div style="text-align: center;">
            <a href="${settleUrl}" class="btn">Buka Patungin & Konfirmasi &rarr;</a>
          </div>

          <div class="footer">
            Anda menerima email ini karena tergabung di grup ${groupName} pada aplikasi Patungin.<br>
            Anda dapat mematikan pengingat email otomatis kapan saja di menu Pengaturan Akun.
          </div>
        </div>
      </body>
    </html>
  `;

  if (!apiKey) {
    console.log(
      `[MOCK EMAIL SENT] To: ${toEmail} | Group: ${groupName} | Amount: ${amount}`,
    );
    return { success: true, id: "mock-id" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("Resend API error:", errBody);
      return { success: false, error: errBody };
    }

    const data = (await res.json()) as { id?: string };
    return { success: true, id: data.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    console.error("Failed to send reminder email:", message);
    return { success: false, error: message };
  }
}
