import { token } from "@/lib/config";

/** $UNSLEPT on Solana. The mint is shown only when NEXT_PUBLIC_UNSLEPT_TOKEN_ADDRESS is set. */
export const TOKEN_SYMBOL = "UNSLEPT";

export async function getTokenAddress(): Promise<string | undefined> {
  return token.address && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(token.address) ? token.address : undefined;
}
