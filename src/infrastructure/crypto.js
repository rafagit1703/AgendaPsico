import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashSenha(senha, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(senha, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verificarSenha(senha, armazenado) {
  const [salt, hash] = armazenado.split(":");
  const tentativa = scryptSync(senha, salt, 32);
  const original = Buffer.from(hash, "hex");
  if (tentativa.length !== original.length) return false;
  return timingSafeEqual(tentativa, original);
}

export function cifrarAes256(texto, chave32) {
  if (texto == null || texto === "") return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chave32, iv);
  const enc = Buffer.concat([cipher.update(String(texto), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decifrarAes256(payload, chave32) {
  if (!payload) return null;
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", chave32, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export function novaChaveAes() {
  return randomBytes(32);
}
