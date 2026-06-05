import { NextRequest, NextResponse } from "next/server";

export const AI_REQUEST_LIMITS = {
  MAX_QUESTION_CHARS: 5000,
  MAX_CONVERSATION_HISTORY_COUNT: 20,
  MAX_MESSAGE_CONTENT_CHARS: 5000,
  MAX_DIFF_CHARS: 50000,
  MAX_ARRAY_ITEMS: 100,
  MAX_ARRAY_ITEM_CHARS: 200,
  MAX_CONTEXT_CHARS: 5000,
  MAX_FILE_PATH_LENGTH: 500,
  MAX_REPOSITORY_COMPARE_COUNT: 5,
  MAX_FILE_CONTENT_CHARS: 120000,
  MAX_MANIFEST_CONTENT_CHARS: 5000,
} as const;

export function validateContentType(
  request: NextRequest
): NextResponse | null {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 }
    );
  }
  return null;
}

export function validateRequestBodySize(
  body: string,
  maxSizeBytes: number
): NextResponse | null {
  if (body.length > maxSizeBytes) {
    return NextResponse.json(
      { error: `Request body exceeds maximum size of ${maxSizeBytes} bytes` },
      { status: 413 }
    );
  }
  return null;
}

export function validateArrayLength(
  array: any[],
  maxLength: number,
  fieldName: string
): NextResponse | null {
  if (array.length > maxLength) {
    return NextResponse.json(
      {
        error: `${fieldName} exceeds maximum length of ${maxLength}. You provided ${array.length}.`,
      },
      { status: 400 }
    );
  }
  return null;
}

export function validateStringLength(
  value: string,
  maxLength: number,
  fieldName: string
): NextResponse | null {
  if (value.length > maxLength) {
    return NextResponse.json(
      {
        error: `${fieldName} exceeds maximum length of ${maxLength} characters`,
      },
      { status: 400 }
    );
  }
  return null;
}
