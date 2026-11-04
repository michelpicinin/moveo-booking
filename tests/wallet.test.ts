// Builds real .pkpass files signed with a throwaway self-signed certificate.
// (iPhones only accept passes signed with your Apple Pass Type ID certificate.)
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

describe("Apple Wallet passes", () => {
  beforeAll(() => {
    const dir = mkdtempSync(path.join(tmpdir(), "pass-"));
    execSync(
      `openssl req -x509 -newkey rsa:2048 -nodes -keyout ${dir}/key.pem -out ${dir}/cert.pem -days 2 -subj "/CN=Test Pass"`,
      { stdio: "ignore" },
    );
    const cert = readFileSync(`${dir}/cert.pem`, "utf8");
    Object.assign(process.env, {
      PASS_TYPE_ID: "pass.lu.moveo.test",
      APPLE_TEAM_ID: "ABCDE12345",
      PASS_SIGNER_CERT: Buffer.from(cert).toString("base64"),
      PASS_SIGNER_KEY: readFileSync(`${dir}/key.pem`, "utf8"),
      PASS_WWDR_CERT: cert,
    });
  });

  const booking = {
    id: "x", code: "B23456789", status: "confirmed", kind: "dropin", amountCents: 2500, paymentRef: null, checkoutRef: null,
    checkedInAt: null, refunded: false, customerName: "Ana Silva", customerEmail: "ana@example.com", cardCode: null,
    classId: "c", title: "Vinyasa Flow", instructor: "Anna", startsAt: new Date("2026-11-10T17:30:00Z"), durationMin: 60,
    location: "MOVEO Belair", classCancelled: false,
  } as const;

  it("creates a signed booking ticket and a 10-card pass", async () => {
    const { bookingPass, cardPass } = await import("@/lib/wallet");
    const ticket = bookingPass({ ...booking });
    expect(ticket.subarray(0, 2).toString()).toBe("PK"); // zip archive
    const listing = ticket.toString("latin1");
    for (const f of ["pass.json", "manifest.json", "signature", "icon.png", "logo@2x.png"]) expect(listing).toContain(f);

    const card = cardPass({
      id: "k", code: "C-2345-6789-AB", status: "active", creditsTotal: 10, creditsUsed: 3,
      expiresAt: new Date("2027-05-01"), amountCents: 20000, checkoutRef: null, customerName: "Ana Silva", customerEmail: null,
    });
    expect(card.subarray(0, 2).toString()).toBe("PK");
  });
});
