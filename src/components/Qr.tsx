import QRCode from "qrcode";

/** Server-rendered QR code as inline SVG (no client JS). */
export async function Qr({ value, label }: { value: string; label: string }) {
  const svg = await QRCode.toString(value, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#2B2B28", light: "#FFFFFF" } });
  return <div className="qr" role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: svg }} />;
}
