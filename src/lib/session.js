// src/lib/session.js
import { getIronSession } from "iron-session";

const COOKIE_NAME =
  process.env.IRON_SESSION_COOKIE_NAME?.trim() || "tb_session"; // 기본값
const PASSWORD =
  process.env.IRON_SESSION_PASSWORD?.trim() || "x".repeat(32);   // 최소 32자 보장

export const sessionOptions = {
  password: PASSWORD,
  cookieName: COOKIE_NAME,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production", // 배포 환경일 때만 secure
    sameSite: "lax",
    httpOnly: true,
    path: "/",
  },
};

export { getIronSession };

