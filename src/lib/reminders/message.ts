import { formatRupiah } from "../money";

export interface WhatsAppReminderParams {
  borrowerName: string;
  creditorName: string;
  groupName: string;
  amount: number;
  paymentMethodText?: string;
  appUrl?: string;
}

/**
 * Formats a polite, friendly WhatsApp settlement reminder message
 * and generates the wa.me click-to-chat URL.
 */
export function formatWhatsAppReminder(params: WhatsAppReminderParams): {
  message: string;
  waUrl: string;
} {
  const {
    borrowerName,
    creditorName,
    groupName,
    amount,
    paymentMethodText,
    appUrl,
  } = params;

  const paymentSection = paymentMethodText
    ? `\n\nBoleh ditransfer ke:\n👉 ${paymentMethodText}`
    : `\n\nBoleh ditransfer ke rekening ${creditorName}.`;

  const linkSection = appUrl
    ? `\n\nCek rincian di Patungin:\n🔗 ${appUrl}`
    : "";

  const message =
    `Halo ${borrowerName}! 👋\n\n` +
    `Mengingatkan untuk tagihan patungan di grup *${groupName}* sebesar *${formatRupiah(amount)}* ya.${paymentSection}${linkSection}\n\n` +
    `Jika sudah ditransfer, jangan lupa tandai di aplikasi agar bisa dikonfirmasi. Terima kasih banyak! 🙏`;

  const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

  return { message, waUrl };
}
