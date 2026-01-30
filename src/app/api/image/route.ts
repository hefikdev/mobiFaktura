import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { s3Client, BUCKET_NAME } from "@/server/storage/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { db } from "@/server/db";
import { sessions } from "@/server/db/schema";
import { eq, and, gt } from "drizzle-orm";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

interface SessionPayload {
  sessionId: string;
  expiresAt: Date;
}

/**
 * Verify JWT token and check session
 */
async function verifySession(token: string): Promise<boolean> {
  try {
    // Verify JWT
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const sessionPayload = payload as unknown as SessionPayload;
    
    if (!sessionPayload.sessionId) {
      return false;
    }
    
    // Check if session exists and is not expired
    const [session] = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.id, sessionPayload.sessionId),
          gt(sessions.expiresAt, new Date())
        )
      )
      .limit(1);
    
    return !!session;
  } catch {
    return false;
  }
}

/**
 * Secure image proxy endpoint
 * Validates user authentication before serving images from S3
 * Prevents unauthorized access to invoice images
 */
export async function GET(request: NextRequest) {
  try {
    // Get image key from query params
    const searchParams = request.nextUrl.searchParams;
    const imageKey = searchParams.get("key");

    if (!imageKey) {
      return NextResponse.json({ error: "Image key is required" }, { status: 400 });
    }

    // Verify user is authenticated
    const sessionCookieName = process.env.SESSION_COOKIE_NAME || "mobifaktura_session";
    const token = request.cookies.get(sessionCookieName)?.value;
    
    if (!token) {
      return NextResponse.json({ error: "Unauthorized - No token provided" }, { status: 401 });
    }

    const isValid = await verifySession(token);
    if (!isValid) {
      return NextResponse.json({ error: "Unauthorized - Invalid or expired session" }, { status: 401 });
    }

    // Fetch image from S3
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: imageKey,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Stream the image
    const chunks: Uint8Array[] = [];
    const stream = response.Body as any;
    
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    
    const buffer = Buffer.concat(chunks);

    // Return image with appropriate headers
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": response.ContentType || "image/jpeg",
        "Content-Length": response.ContentLength?.toString() || buffer.length.toString(),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });

  } catch (error) {
    console.error("Error serving image:", error);
    return NextResponse.json(
      { error: "Failed to serve image" },
      { status: 500 }
    );
  }
}
