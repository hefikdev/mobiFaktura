import { NextResponse } from 'next/server';
import { logError } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Log the client-side error to the server logs (structured)
    logError(body, { type: 'client-error', source: 'client' });

    return NextResponse.json({ ok: true });
  } catch (err) {
    // If logging the client error fails, log that failure too
    logError(err, { type: 'client-error-route', source: 'server' });
    return new NextResponse('Failed', { status: 500 });
  }
}