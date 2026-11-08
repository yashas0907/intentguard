import "./network.js";
import "dotenv/config";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { AiError, parseWithGemini, warmUpGemini } from "./gemini.js";
import { computeIntentHash, MAX_PROMPT_LENGTH, validateIntent } from "./intent.js";
import { AgentChain, loadKeypair } from "./solana.js";

const port = Number(process.env.PORT ?? 8787);
const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
const recipientLabel = process.env.APPROVED_RECIPIENT_LABEL ?? "server host";

const chain = new AgentChain(
  process.env.RPC_URL ?? "https://api.devnet.solana.com",
  loadKeypair(process.env.AGENT_KEYPAIR_PATH ?? "./agent-keypair.json")
);
await chain.assertDevnet();
void warmUpGemini();

// Transient by design: the prompt and AI output behind each proposal, for the review
// screen. The binding record is the intent hash stored on-chain.
const intents = new Map<string, object>();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json({ limit: "10kb" }));

app.get("/api/agent/status", async (_req, res) => {
  const lamports = await chain.connection.getBalance(chain.agent.publicKey).catch(() => null);
  res.json({
    online: true,
    agentPublicKey: chain.agent.publicKey.toBase58(),
    agentBalanceSol: lamports === null ? null : lamports / LAMPORTS_PER_SOL,
    programId: chain.program.programId.toBase58(),
    geminiModel: model,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    recipientLabel,
    cluster: "devnet",
  });
});

app.get("/api/agent/intent/:vault/:nonce", (req, res) => {
  const intent = intents.get(`${req.params.vault}:${req.params.nonce}`);
  if (!intent) {
    res.status(404).json({ error: "No AI details for this proposal in the current backend session." });
    return;
  }
  res.json(intent);
});

// Every submission spends agent SOL and AI quota.
const limiter = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false });

app.post("/api/agent/parse-and-propose", limiter, async (req, res) => {
  const { prompt, vaultPubkey } = req.body ?? {};
  const offChain = (status: number, code: string, message: string) =>
    res.status(status).json({ status: "INVALID_REQUEST", enforcedBy: "off-chain", code, message });

  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > MAX_PROMPT_LENGTH) {
    return offChain(400, "INVALID_PROMPT", `Enter a request of up to ${MAX_PROMPT_LENGTH} characters.`);
  }
  let vaultKey: PublicKey;
  try {
    vaultKey = new PublicKey(vaultPubkey);
  } catch {
    return offChain(400, "INVALID_VAULT", "The vault address is not valid.");
  }

  try {
    const vault = await chain.fetchVault(vaultKey);
    if (!vault) return offChain(404, "VAULT_NOT_FOUND", "That vault doesn't exist on Devnet.");
    if (!vault.authorizedAgent.equals(chain.agent.publicKey)) {
      return offChain(403, "AGENT_NOT_AUTHORIZED", "This backend's agent isn't authorized on that vault.");
    }

    const aiOutput = await parseWithGemini(prompt, {
      apiKey: process.env.GEMINI_API_KEY,
      model,
      recipientLabel,
    });
    const result = validateIntent(aiOutput, prompt, vault.approvedRecipient);
    if (!result.ok) return offChain(400, result.code, result.message);

    const { lamports, recipient, memo, amountSol, confidence } = result.intent;
    const recipientAddress = recipient.toBase58();
    const intentHash = computeIntentHash({
      prompt,
      lamports,
      recipient: recipientAddress,
      memo,
      timestamp: Date.now(),
    });
    const parsedIntent = { amountSol, amountLamports: lamports.toString(), recipient: recipientAddress, memo, confidence };

    const outcome = await chain.propose({ vault: vaultKey, lamports, recipient, intentHash });
    if (outcome.error) {
      // A valid API result: the request worked and the program refused the payment.
      return res.json({
        status: "REJECTED_BY_POLICY",
        enforcedBy: "on-chain",
        error: outcome.error.name,
        errorCode: `0x${outcome.error.code.toString(16)}`,
        message: outcome.error.message,
        txSignature: outcome.signature,
        explorerUrl: outcome.explorerUrl,
        parsedIntent,
      });
    }

    const proposalKey = chain.proposalAddress(vaultKey);
    const proposal = await (chain.program.account as any).paymentProposal.fetch(proposalKey);
    const details = { prompt, parsedIntent, intentHash: intentHash.toString("hex"), model };
    intents.set(`${vaultKey.toBase58()}:${proposal.nonce.toString()}`, details);

    return res.json({
      status: "PROPOSED",
      enforcedBy: "on-chain",
      txSignature: outcome.signature,
      explorerUrl: outcome.explorerUrl,
      proposalPubkey: proposalKey.toBase58(),
      ...details,
    });
  } catch (error) {
    if (error instanceof AiError) {
      return res.status(503).json({ status: "AI_ERROR", enforcedBy: "off-chain", code: error.code, message: error.message });
    }
    console.error("Proposal failed:", error instanceof Error ? error.message : "unknown error");
    return res.status(502).json({
      status: "NETWORK_ERROR",
      enforcedBy: "off-chain",
      code: "SUBMISSION_FAILED",
      message: "Couldn't reach Solana Devnet, or the agent has no SOL for fees.",
    });
  }
});

app.listen(port, "127.0.0.1", () => {
  console.log(`IntentGuard agent on http://127.0.0.1:${port}`);
  console.log(`Agent public key: ${chain.agent.publicKey.toBase58()}`);
});
