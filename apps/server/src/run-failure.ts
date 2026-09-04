import { type RunFailureCode, runFailureMessages } from "@openbot/protocol";

export interface PublicRunFailure {
  code: RunFailureCode;
  message: string;
}

export function publicRunFailure(code: RunFailureCode): PublicRunFailure {
  return { code, message: runFailureMessages[code] };
}
