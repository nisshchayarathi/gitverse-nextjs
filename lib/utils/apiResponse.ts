import { NextResponse } from "next/server";

export function apiError(
  message: string,
  code: number
) {
  return NextResponse.json(
    {
      error: true,
      message,
      code,
    },
    { status: code }
  );
}

export function apiSuccess(data: any, code = 200) {
  return NextResponse.json(
    {
      error: false,
      data,
    },
    { status: code }
  );
}