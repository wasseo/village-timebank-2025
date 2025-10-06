import 'server-only';

const apiKey = process.env.SOLAPI_API_KEY;
const apiSecret = process.env.SOLAPI_API_SECRET;
const sender = process.env.SOLAPI_SENDER;

export async function sendSmsViaSolapi(to: string, text: string) {
  if (!apiKey || !apiSecret || !sender) {
    throw new Error("SOLAPI env missing: SOLAPI_API_KEY / SOLAPI_API_SECRET / SOLAPI_SENDER");
  }

  const mod = await import('solapi');
  const SolapiMessageService =
    (mod as any).SolapiMessageService ||
    (mod as any).default?.SolapiMessageService;

  if (!SolapiMessageService) {
    throw new Error("Solapi SDK load failed");
  }

  const messageService = new SolapiMessageService(apiKey, apiSecret);

  const toNum = String(to || "").trim().replace(/\D/g, "");
  const fromNum = String(sender || "").trim().replace(/\D/g, "");
  if (!toNum || !fromNum) throw new Error("Invalid phone number (to/from)");

  const res = await messageService.sendOne({ to: toNum, from: fromNum, text });
  return res;
}
