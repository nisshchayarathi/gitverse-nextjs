"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_REQUEST_LIMITS = void 0;
exports.validateContentType = validateContentType;
const server_1 = require("next/server");
exports.AI_REQUEST_LIMITS = {
    MAX_QUESTION_CHARS: 5000,
    MAX_CONVERSATION_HISTORY_COUNT: 20,
    MAX_MESSAGE_CONTENT_CHARS: 5000,
    MAX_DIFF_CHARS: 50000,
    MAX_ARRAY_ITEMS: 100,
    MAX_ARRAY_ITEM_CHARS: 200,
    MAX_CONTEXT_CHARS: 5000,
};
function validateContentType(request) {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        return server_1.NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
    }
    return null;
}
