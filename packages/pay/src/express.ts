import type { Paywall, PaymentInfo } from "./index.js";

interface Req {
  protocol: string;
  originalUrl: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
  get(name: string): string | undefined;
  payment?: PaymentInfo;
}
interface Res {
  status(code: number): Res;
  setHeader(name: string, value: string): void;
  send(body: string): void;
}

/** Express middleware. On success `req.payment` holds the payment and the PAYMENT-RESPONSE header is set. */
export function expressPaywall(paywall: Paywall) {
  return async (req: Req, res: Res, next: (err?: unknown) => void) => {
    try {
      const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
      const v = await paywall.verify(new Request(url, { method: req.method, headers }));
      if (!v.paid) {
        v.response.headers.forEach((val, k) => res.setHeader(k, val));
        res.status(402).send(await v.response.text());
        return;
      }
      for (const [k, val] of Object.entries(v.headers)) res.setHeader(k, val);
      req.payment = v.payment;
      next();
    } catch (e) {
      next(e);
    }
  };
}
