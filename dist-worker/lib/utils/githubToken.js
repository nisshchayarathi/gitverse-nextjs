"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDecryptedGitHubToken = getDecryptedGitHubToken;
const prisma_1 = __importDefault(require("@/lib/prisma"));
const tokenEncryption_1 = require("@/lib/utils/tokenEncryption");
async function getDecryptedGitHubToken(userId) {
    const account = await prisma_1.default.gitHubAccount.findUnique({
        where: { userId },
        select: { accessToken: true, tokenEncrypted: true },
    });
    if (!account?.accessToken)
        return null;
    if (account.tokenEncrypted) {
        return (0, tokenEncryption_1.decryptToken)(account.accessToken);
    }
    return account.accessToken;
}
