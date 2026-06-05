import { NextResponse } from "next/server";

export function apiError(
  status: number,
  message: string,
  code?: string
) {
  return NextResponse.json(
    {
      error: {
        message,
        ...(code && { code }),
      },
    },
    { status }
  );
}