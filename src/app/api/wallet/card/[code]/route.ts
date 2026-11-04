import { getCardByCode } from "@/lib/booking";
import { walletEnabled } from "@/lib/config";
import { cardPass } from "@/lib/wallet";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!walletEnabled) return new Response("Apple Wallet is not configured", { status: 404 });
  const { code } = await params;
  const c = await getCardByCode(decodeURIComponent(code));
  if (!c || c.status !== "active") return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(cardPass(c)), {
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": `attachment; filename="moveo-card.pkpass"`,
      "Cache-Control": "no-store",
    },
  });
}
