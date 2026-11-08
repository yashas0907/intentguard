export type AgentStatus = {
  online: boolean;
  agentPublicKey: string;
  agentBalanceSol: number | null;
  programId: string;
  geminiModel: string;
  geminiConfigured: boolean;
  recipientLabel: string;
  cluster: string;
};

export type ParsedIntent = {
  amountSol: string;
  amountLamports: string;
  recipient: string;
  memo: string;
  confidence: number;
};

export type IntentDetails = {
  prompt: string;
  parsedIntent: ParsedIntent;
  intentHash: string;
  model: string;
};

export type ProposeResponse =
  | ({
      status: "PROPOSED";
      enforcedBy: "on-chain";
      txSignature: string;
      explorerUrl: string;
      proposalPubkey: string;
    } & IntentDetails)
  | {
      status: "REJECTED_BY_POLICY";
      enforcedBy: "on-chain";
      error: string;
      errorCode: string;
      message: string;
      txSignature: string;
      explorerUrl: string;
      parsedIntent: ParsedIntent;
    }
  | {
      status: "INVALID_REQUEST" | "AI_ERROR" | "NETWORK_ERROR" | "RATE_LIMITED";
      enforcedBy: "off-chain";
      code: string;
      message: string;
    };

export async function fetchAgentStatus(): Promise<AgentStatus | null> {
  try {
    const response = await fetch("/api/agent/status");
    return response.ok ? ((await response.json()) as AgentStatus) : null;
  } catch {
    return null;
  }
}

export async function fetchIntentDetails(vault: string, nonce: string): Promise<IntentDetails | null> {
  try {
    const response = await fetch(`/api/agent/intent/${vault}/${nonce}`);
    return response.ok ? ((await response.json()) as IntentDetails) : null;
  } catch {
    return null;
  }
}

export async function submitPrompt(prompt: string, vaultPubkey: string): Promise<ProposeResponse> {
  const offChain = (status: "NETWORK_ERROR" | "RATE_LIMITED", code: string, message: string): ProposeResponse => ({
    status,
    enforcedBy: "off-chain",
    code,
    message,
  });
  let response: Response;
  try {
    response = await fetch("/api/agent/parse-and-propose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, vaultPubkey }),
    });
  } catch {
    return offChain("NETWORK_ERROR", "BACKEND_OFFLINE", "Can't reach the agent backend. Is it running?");
  }
  if (response.status === 429) {
    return offChain("RATE_LIMITED", "RATE_LIMITED", "Too many requests. Wait a minute and try again.");
  }
  try {
    return (await response.json()) as ProposeResponse;
  } catch {
    return offChain("NETWORK_ERROR", "BAD_RESPONSE", "The agent backend returned an unreadable response.");
  }
}
