"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiError = apiError;
const server_1 = require("next/server");
function apiError(status, message, code) {
    return server_1.NextResponse.json({
        error: {
            message,
            ...(code && { code }),
        },
    }, { status });
}
