import crypto from "crypto";
export function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}
export function genCode(len = 6) {
  // 6자리 숫자
  return Math.floor(10**(len-1) + Math.random() * 9*10**(len-1)).toString();
}
