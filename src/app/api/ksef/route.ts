import { NextResponse } from "next/server";
import { parseStringPromise } from "xml2js";

const KSEF_URL = "https://ksef.mf.gov.pl";
const KSEF_TOKEN = process.env.KSEF_TOKEN!;

async function authenticate(): Promise<string> {
  const res = await fetch(`${KSEF_URL}/api/online/Session/AuthorisationToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: KSEF_TOKEN })
  });
  if (!res.ok) throw new Error("KSeF auth failed");
  const data = await res.json();
  return data.sessionToken.token;
}

async function getInvoiceXML(sessionToken: string, ksefNumber: string): Promise<string> {
  const res = await fetch(`${KSEF_URL}/api/online/Invoice/Get?ksefReferenceNumber=${encodeURIComponent(ksefNumber)}`, {
    headers: {
      "Session-Token": sessionToken,
      "Accept": "application/octet-stream"
    }
  });
  if (!res.ok) throw new Error("Invoice not found or no access");
  return await res.text();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ksefNumber = searchParams.get("ksefNumber");
  if (!ksefNumber) {
    return NextResponse.json({ valid: false, error: "Missing ksefNumber" }, { status: 400 });
  }
  try {
    const session = await authenticate();
    const xml = await getInvoiceXML(session, ksefNumber);
    const json = await parseStringPromise(xml, { explicitArray: false });
    return NextResponse.json({ valid: true, invoice: json });
  } catch (err: any) {
    return NextResponse.json({ valid: false, error: err.message }, { status: 500 });
  }
}
