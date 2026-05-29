import { NextResponse } from "next/server";
import { ApiError } from "../errors/ApiError";

export function withErrorHandler(handler: Function) {
  return async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error: any) {
      console.error(error);

      if (error instanceof ApiError) {
        return NextResponse.json(
          {
            error: true,
            message: error.message,
            code: error.statusCode,
          },
          { status: error.statusCode }
        );
      }

      return NextResponse.json(
        {
          error: true,
          message: "Something went wrong",
          code: 500,
        },
        { status: 500 }
      );
    }
  };
}