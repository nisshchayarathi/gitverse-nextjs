import { NextResponse } from "next/server";

export function apiError(status: number, message: string) {
  return NextResponse.json(
    { error: message },
    { status }
  );
}