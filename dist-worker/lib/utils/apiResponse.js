"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiError = apiError;
exports.apiSuccess = apiSuccess;
const server_1 = require("next/server");
function apiError(message, code) {
    return server_1.NextResponse.json({
        error: true,
        message,
        code,
    }, { status: code });
}
function apiSuccess(data, code = 200) {
    return server_1.NextResponse.json({
        error: false,
        data,
    }, { status: code });
}
