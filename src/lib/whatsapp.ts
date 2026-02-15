export function openWhatsApp(e164: string, message: string) {
  const phone = e164.replace("+", "");
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
