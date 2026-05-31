"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withErrorHandler = withErrorHandler;
const server_1 = require("next/server");
const ApiError_1 = require("../errors/ApiError");
function withErrorHandler(handler) {
    return async (...args) => {
        try {
            return await handler(...args);
        }
        catch (error) {
            console.error(error);
            if (error instanceof ApiError_1.ApiError) {
                return server_1.NextResponse.json({
                    error: true,
                    message: error.message,
                    code: error.statusCode,
                }, { status: error.statusCode });
            }
            return server_1.NextResponse.json({
                error: true,
                message: "Something went wrong",
                code: 500,
            }, { status: 500 });
        }
    };
}
