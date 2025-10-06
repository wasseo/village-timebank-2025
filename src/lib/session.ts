import type { SessionOptions } from "iron-session";

export const sessionOptions: SessionOptions = {
  cookieName: process.env.IRON_SESSION_COOKIE_NAME!,
  password: process.env.IRON_SESSION_PASSWORD!,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    httpOnly: true,
  },
};

declare module "iron-session" {
  interface IronSessionData {
    user?: { id: string; phone: string };
  }
}
