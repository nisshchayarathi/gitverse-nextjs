import crypto from "crypto";

export interface KmsProvider {
  encrypt(keyId: string, plaintext: Buffer): Promise<Buffer>;
  decrypt(keyId: string, ciphertext: Buffer): Promise<Buffer>;
  generateDataKey(keyId: string, keySpec: string): Promise<{ plaintext: Buffer; ciphertext: Buffer }>;
}

export class AwsKmsProvider implements KmsProvider {
  private client: import("@aws-sdk/client-kms").KMSClient;

  constructor(region?: string) {
    const { KMSClient } = require("@aws-sdk/client-kms");
    this.client = new KMSClient({ region: region || process.env.AWS_REGION || "us-east-1" });
  }

  async encrypt(keyId: string, plaintext: Buffer): Promise<Buffer> {
    const { EncryptCommand } = require("@aws-sdk/client-kms");
    const cmd = new EncryptCommand({ KeyId: keyId, Plaintext: plaintext });
    const resp: any = await this.client.send(cmd);
    return Buffer.from(resp.CiphertextBlob as Uint8Array);
  }

  async decrypt(keyId: string, ciphertext: Buffer): Promise<Buffer> {
    const { DecryptCommand } = require("@aws-sdk/client-kms");
    const cmd = new DecryptCommand({ KeyId: keyId, CiphertextBlob: ciphertext });
    const resp: any = await this.client.send(cmd);
    return Buffer.from(resp.Plaintext as Uint8Array);
  }

  async generateDataKey(keyId: string, keySpec: string): Promise<{ plaintext: Buffer; ciphertext: Buffer }> {
    const { GenerateDataKeyCommand } = require("@aws-sdk/client-kms");
    const cmd = new GenerateDataKeyCommand({ KeyId: keyId, KeySpec: keySpec });
    const resp: any = await this.client.send(cmd);
    return {
      plaintext: Buffer.from(resp.Plaintext as Uint8Array),
      ciphertext: Buffer.from(resp.CiphertextBlob as Uint8Array),
    };
  }
}

export class LocalKmsProvider implements KmsProvider {
  private masterKey: Buffer;

  constructor(keyHex?: string) {
    const hex = keyHex || process.env.TOKEN_ENCRYPTION_KEY;
    if (!hex) throw new Error("TOKEN_ENCRYPTION_KEY or keyHex is required for LocalKmsProvider");
    this.masterKey = Buffer.from(hex.trim(), "hex");
  }

  async encrypt(_keyId: string, plaintext: Buffer): Promise<Buffer> {
    const cipher = crypto.createCipheriv("aes-256-gcm", this.masterKey, Buffer.alloc(16, 0));
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return Buffer.concat([encrypted, cipher.getAuthTag()]);
  }

  async decrypt(_keyId: string, ciphertext: Buffer): Promise<Buffer> {
    const tag = ciphertext.subarray(-16);
    const data = ciphertext.subarray(0, -16);
    const decipher = crypto.createDecipheriv("aes-256-gcm", this.masterKey, Buffer.alloc(16, 0));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }

  async generateDataKey(_keyId: string, _keySpec: string): Promise<{ plaintext: Buffer; ciphertext: Buffer }> {
    const plaintext = crypto.randomBytes(32);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.masterKey, Buffer.alloc(16, 0));
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const ciphertext = Buffer.concat([encrypted, cipher.getAuthTag()]);
    return { plaintext, ciphertext };
  }
}

let instance: KmsProvider | null = null;

export function getKmsProvider(): KmsProvider {
  if (instance) return instance;
  if (process.env.KMS_KEY_ID && process.env.KMS_PROVIDER === "aws") {
    instance = new AwsKmsProvider();
  } else {
    instance = new LocalKmsProvider();
  }
  return instance;
}

export function resetKmsProvider(): void {
  instance = null;
}
