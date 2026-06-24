import { NextResponse } from "next/server";

export function verifyBearerSecret(request: Request, envKey: string): boolean {
  const secret = process.env[envKey];
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;

  return auth.slice(7) === secret;
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
