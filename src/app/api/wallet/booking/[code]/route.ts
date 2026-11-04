import { getBookingByCode } from "@/lib/booking";
import { walletEnabled } from "@/lib/config";
import { bookingPass } from "@/lib/wallet";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!walletEnabled) return new Response("Apple Wallet is not configured", { status: 404 });
  const { code } = await params;
  const b = await getBookingByCode(code);
  if (!b || b.status !== "confirmed") return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bookingPass(b)), {
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": `attachment; filename="moveo-${b.code}.pkpass"`,
      "Cache-Control": "no-store",
    },
  });
}
