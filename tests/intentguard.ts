import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";
import { assert } from "chai";
import { Intentguard } from "../target/types/intentguard";

const SOL = (n: number) => new anchor.BN(Math.round(n * LAMPORTS_PER_SOL));

// Codes documented in docs/TEST_PLAN.md (Anchor custom errors start at 0x1770).
const ERROR_CODES: Record<string, number> = {
  UnauthorizedAgent: 0x1770,
  UnauthorizedOwner: 0x1771,
  AmountExceedsPolicyLimit: 0x1772,
  UnapprovedRecipient: 0x1773,
  ProposalNotPending: 0x1774,
  InsufficientVaultBalance: 0x1775,
  InvalidProposalVault: 0x1776,
  InvalidRecipientAccount: 0x1777,
  InvalidAmount: 0x1778,
  StaleProposal: 0x1779,
  PendingProposalExists: 0x177a,
};

describe("intentguard", () => {
  // Confirm and read at the same commitment, so balance checks are never stale.
  const envProvider = anchor.AnchorProvider.env();
  const provider = new anchor.AnchorProvider(envProvider.connection, envProvider.wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);
  const program = anchor.workspace.Intentguard as Program<Intentguard>;
  const connection = provider.connection;

  async function fund(pubkey: PublicKey, sol = 10) {
    const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
    const latest = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
  }

  const intentHash = (text: string) =>
    Array.from(createHash("sha256").update(text).digest());

  const balance = (pubkey: PublicKey) => connection.getBalance(pubkey, "confirmed");

  async function expectError(action: Promise<unknown>, name: string) {
    let error: any;
    try {
      await action;
    } catch (e) {
      error = e;
    }
    assert.isDefined(error, `expected the program to revert with ${name}`);
    assert.equal(error.error?.errorCode?.code, name, `wrong error: ${error}`);
    assert.equal(error.error?.errorCode?.number, ERROR_CODES[name]);
  }

  type Setup = {
    owner: Keypair;
    agent: Keypair;
    attacker: Keypair;
    recipient: Keypair;
    vault: PublicKey;
    proposal: PublicKey;
  };

  // Every test gets its own owner, and therefore its own vault and proposal slot.
  async function setup({ maxSol = 1, depositSol = 2 } = {}): Promise<Setup> {
    const owner = Keypair.generate();
    const agent = Keypair.generate();
    const attacker = Keypair.generate();
    const recipient = Keypair.generate();
    await Promise.all([fund(owner.publicKey), fund(agent.publicKey), fund(attacker.publicKey)]);

    const [vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), owner.publicKey.toBuffer()],
      program.programId
    );
    const [proposal] = PublicKey.findProgramAddressSync(
      [Buffer.from("proposal"), vault.toBuffer()],
      program.programId
    );

    await program.methods
      .initializeVault(agent.publicKey, recipient.publicKey, SOL(maxSol))
      .accountsPartial({ owner: owner.publicKey, vault })
      .signers([owner])
      .rpc();
    if (depositSol > 0) {
      await program.methods
        .depositSol(SOL(depositSol))
        .accountsPartial({ owner: owner.publicKey, vault })
        .signers([owner])
        .rpc();
    }
    return { owner, agent, attacker, recipient, vault, proposal };
  }

  const propose = (
    s: Setup,
    amount: anchor.BN,
    { signer = s.agent, recipient = s.recipient.publicKey } = {}
  ) =>
    program.methods
      .proposePayment(amount, recipient, intentHash("test intent"))
      .accountsPartial({ agent: signer.publicKey, vault: s.vault, proposal: s.proposal })
      .signers([signer])
      .rpc();

  const execute = (
    s: Setup,
    nonce = 1,
    { signer = s.owner, recipient = s.recipient.publicKey } = {}
  ) =>
    program.methods
      .approveAndExecutePayment(new anchor.BN(nonce))
      .accountsPartial({
        owner: signer.publicKey,
        vault: s.vault,
        proposal: s.proposal,
        recipient,
      })
      .signers([signer])
      .rpc();

  const reject = (s: Setup, signer = s.owner) =>
    program.methods
      .rejectPayment()
      .accountsPartial({ owner: signer.publicKey, vault: s.vault, proposal: s.proposal })
      .signers([signer])
      .rpc();

  before(async () => {
    // Safety guard: these tests request airdrops, so refuse to run on a real network.
    const endpoint = connection.rpcEndpoint;
    assert.match(endpoint, /localhost|127\.0\.0\.1/, `refusing to run against ${endpoint}`);
    await fund(provider.wallet.publicKey, 100);
  });

  describe("vault and policy", () => {
    it("TC-ON-01 initializes a vault with the exact policy", async () => {
      const s = await setup({ depositSol: 0 });
      const vault = await program.account.vault.fetch(s.vault);
      assert.isTrue(vault.owner.equals(s.owner.publicKey));
      assert.isTrue(vault.authorizedAgent.equals(s.agent.publicKey));
      assert.isTrue(vault.approvedRecipient.equals(s.recipient.publicKey));
      assert.equal(vault.maxAmountLamports.toString(), SOL(1).toString());
    });

    it("deposits SOL into the vault", async () => {
      const s = await setup({ depositSol: 0 });
      const before = await balance(s.vault);
      await program.methods
        .depositSol(SOL(1))
        .accountsPartial({ owner: s.owner.publicKey, vault: s.vault })
        .signers([s.owner])
        .rpc();
      assert.equal((await balance(s.vault)) - before, LAMPORTS_PER_SOL);
    });

    it("TC-ON-02 lets the owner update the policy", async () => {
      const s = await setup();
      const newAgent = Keypair.generate().publicKey;
      const newRecipient = Keypair.generate().publicKey;
      await program.methods
        .updatePolicy(newAgent, newRecipient, SOL(2))
        .accountsPartial({ owner: s.owner.publicKey, vault: s.vault })
        .signers([s.owner])
        .rpc();
      const vault = await program.account.vault.fetch(s.vault);
      assert.isTrue(vault.authorizedAgent.equals(newAgent));
      assert.isTrue(vault.approvedRecipient.equals(newRecipient));
      assert.equal(vault.maxAmountLamports.toString(), SOL(2).toString());
    });

    for (const who of ["attacker", "agent"] as const) {
      it(`TC-ON-03 blocks the ${who} from updating the policy`, async () => {
        const s = await setup();
        await expectError(
          program.methods
            .updatePolicy(null, s[who].publicKey, SOL(100))
            .accountsPartial({ owner: s[who].publicKey, vault: s.vault })
            .signers([s[who]])
            .rpc(),
          "UnauthorizedOwner"
        );
      });
    }
  });

  describe("proposals", () => {
    it("TC-ON-04 records a valid proposal as Pending and moves no funds", async () => {
      const s = await setup();
      const before = await balance(s.vault);
      await propose(s, SOL(0.5));
      const proposal = await program.account.paymentProposal.fetch(s.proposal);
      assert.deepEqual(proposal.status, { pending: {} });
      assert.equal(proposal.amount.toString(), SOL(0.5).toString());
      assert.equal(proposal.nonce.toNumber(), 1);
      assert.isTrue(proposal.vault.equals(s.vault));
      assert.isTrue(proposal.agent.equals(s.agent.publicKey));
      assert.deepEqual(Array.from(proposal.intentHash), intentHash("test intent"));
      assert.equal(await balance(s.vault), before);
    });

    it("TC-ON-05 blocks an unauthorized proposer", async () => {
      const s = await setup();
      await expectError(propose(s, SOL(0.1), { signer: s.attacker }), "UnauthorizedAgent");
    });

    it("TC-ON-06 blocks a proposal over the limit", async () => {
      const s = await setup();
      await expectError(propose(s, SOL(1.5)), "AmountExceedsPolicyLimit");
    });

    it("accepts a proposal exactly at the limit", async () => {
      const s = await setup();
      await propose(s, SOL(1));
    });

    it("TC-ON-07 blocks an unapproved recipient", async () => {
      const s = await setup();
      await expectError(
        propose(s, SOL(0.1), { recipient: Keypair.generate().publicKey }),
        "UnapprovedRecipient"
      );
    });

    it("TC-ON-11 blocks an amount above the vault's spendable balance", async () => {
      const s = await setup({ maxSol: 5, depositSol: 1 });
      await expectError(propose(s, SOL(2)), "InsufficientVaultBalance");
    });

    it("keeps the vault rent-exempt: spendable balance is the exact ceiling", async () => {
      const s = await setup({ maxSol: 5, depositSol: 1 });
      await expectError(propose(s, SOL(1).addn(1)), "InsufficientVaultBalance");
      await propose(s, SOL(1));
      await execute(s);
      const info = await connection.getAccountInfo(s.vault, "confirmed");
      const rentMinimum = await connection.getMinimumBalanceForRentExemption(info!.data.length);
      assert.equal(info!.lamports, rentMinimum);
    });

    it("blocks a zero-amount proposal", async () => {
      const s = await setup();
      await expectError(propose(s, new anchor.BN(0)), "InvalidAmount");
    });

    it("blocks overwriting a pending proposal", async () => {
      const s = await setup();
      await propose(s, SOL(0.01));
      await expectError(propose(s, SOL(0.5)), "PendingProposalExists");
      const proposal = await program.account.paymentProposal.fetch(s.proposal);
      assert.equal(proposal.amount.toString(), SOL(0.01).toString());
    });
  });

  describe("owner approval", () => {
    it("TC-ON-08 owner execution moves the exact amount to the recipient", async () => {
      const s = await setup();
      await propose(s, SOL(0.2));
      const vaultBefore = await balance(s.vault);
      await execute(s);
      assert.equal(vaultBefore - (await balance(s.vault)), 0.2 * LAMPORTS_PER_SOL);
      assert.equal(await balance(s.recipient.publicKey), 0.2 * LAMPORTS_PER_SOL);
      const proposal = await program.account.paymentProposal.fetch(s.proposal);
      assert.deepEqual(proposal.status, { executed: {} });
    });

    for (const who of ["attacker", "agent"] as const) {
      it(`TC-ON-09 blocks the ${who} from executing`, async () => {
        const s = await setup();
        await propose(s, SOL(0.2));
        const before = await balance(s.vault);
        await expectError(execute(s, 1, { signer: s[who] }), "UnauthorizedOwner");
        assert.equal(await balance(s.vault), before);
      });
    }

    it("TC-ON-10 blocks double execution", async () => {
      const s = await setup();
      await propose(s, SOL(0.2));
      await execute(s);
      await expectError(execute(s), "ProposalNotPending");
      assert.equal(await balance(s.recipient.publicKey), 0.2 * LAMPORTS_PER_SOL);
    });

    it("TC-ON-12 owner rejection keeps funds in the vault", async () => {
      const s = await setup();
      await propose(s, SOL(0.2));
      const before = await balance(s.vault);
      await reject(s);
      const proposal = await program.account.paymentProposal.fetch(s.proposal);
      assert.deepEqual(proposal.status, { rejected: {} });
      assert.equal(await balance(s.vault), before);
    });

    it("blocks executing a rejected proposal", async () => {
      const s = await setup();
      await propose(s, SOL(0.2));
      await reject(s);
      await expectError(execute(s), "ProposalNotPending");
    });

    for (const who of ["attacker", "agent"] as const) {
      it(`blocks the ${who} from rejecting`, async () => {
        const s = await setup();
        await propose(s, SOL(0.2));
        await expectError(reject(s, s[who]), "UnauthorizedOwner");
      });
    }

    it("blocks paying a different recipient account at execution", async () => {
      const s = await setup();
      await propose(s, SOL(0.2));
      await expectError(
        execute(s, 1, { recipient: s.attacker.publicKey }),
        "InvalidRecipientAccount"
      );
    });

    it("blocks an old approval from executing a newer proposal", async () => {
      const s = await setup();
      await propose(s, SOL(0.01));
      await reject(s);
      await propose(s, SOL(0.5));
      const proposal = await program.account.paymentProposal.fetch(s.proposal);
      assert.equal(proposal.nonce.toNumber(), 2);
      await expectError(execute(s, 1), "StaleProposal");
      await execute(s, 2);
      assert.equal(await balance(s.recipient.publicKey), 0.5 * LAMPORTS_PER_SOL);
    });

    it("re-checks the limit at execution if the owner lowered it", async () => {
      const s = await setup();
      await propose(s, SOL(0.5));
      await program.methods
        .updatePolicy(null, null, SOL(0.1))
        .accountsPartial({ owner: s.owner.publicKey, vault: s.vault })
        .signers([s.owner])
        .rpc();
      await expectError(execute(s), "AmountExceedsPolicyLimit");
    });

    it("re-checks the recipient at execution if the owner changed it", async () => {
      const s = await setup();
      await propose(s, SOL(0.5));
      await program.methods
        .updatePolicy(null, Keypair.generate().publicKey, null)
        .accountsPartial({ owner: s.owner.publicKey, vault: s.vault })
        .signers([s.owner])
        .rpc();
      await expectError(execute(s), "UnapprovedRecipient");
    });

    it("blocks executing a proposal from an agent the owner has since replaced", async () => {
      const s = await setup();
      await propose(s, SOL(0.5));
      await program.methods
        .updatePolicy(Keypair.generate().publicKey, null, null)
        .accountsPartial({ owner: s.owner.publicKey, vault: s.vault })
        .signers([s.owner])
        .rpc();
      const before = await balance(s.vault);
      await expectError(execute(s), "UnauthorizedAgent");
      assert.equal(await balance(s.vault), before);
      // The owner can still clear it.
      await reject(s);
    });

    it("blocks a proposal PDA that belongs to another vault", async () => {
      const a = await setup();
      const b = await setup();
      await propose(b, SOL(0.2));
      const before = await balance(a.vault);
      let failed = false;
      try {
        await execute({ ...a, proposal: b.proposal });
      } catch {
        failed = true;
      }
      assert.isTrue(failed, "execution with another vault's proposal must revert");
      assert.equal(await balance(a.vault), before);
    });

    it("blocks a vault from being initialized twice", async () => {
      const s = await setup();
      let failed = false;
      try {
        await program.methods
          .initializeVault(s.attacker.publicKey, s.attacker.publicKey, SOL(100))
          .accountsPartial({ owner: s.owner.publicKey, vault: s.vault })
          .signers([s.owner])
          .rpc();
      } catch {
        failed = true;
      }
      assert.isTrue(failed, "re-initialization must revert");
    });

    it("lets the owner recover all spendable funds, even past a pending proposal", async () => {
      const s = await setup({ maxSol: 1, depositSol: 2 });
      await propose(s, SOL(0.5)); // A stale proposal from the old agent is in the way.
      await reject(s);
      await program.methods
        .updatePolicy(s.owner.publicKey, s.owner.publicKey, SOL(5))
        .accountsPartial({ owner: s.owner.publicKey, vault: s.vault })
        .signers([s.owner])
        .rpc();
      const before = await balance(s.owner.publicKey);
      await propose(s, SOL(2), { signer: s.owner, recipient: s.owner.publicKey });
      await execute(s, 2, { recipient: s.owner.publicKey });
      const gained = (await balance(s.owner.publicKey)) - before;
      assert.isAbove(gained, 2 * LAMPORTS_PER_SOL - 0.01 * LAMPORTS_PER_SOL);
      const info = await connection.getAccountInfo(s.vault, "confirmed");
      assert.equal(info!.lamports, await connection.getMinimumBalanceForRentExemption(info!.data.length));
    });

    it("runs a second full cycle through the same proposal slot", async () => {
      const s = await setup();
      await propose(s, SOL(0.1));
      await execute(s, 1);
      await propose(s, SOL(0.1));
      await execute(s, 2);
      assert.equal(await balance(s.recipient.publicKey), 0.2 * LAMPORTS_PER_SOL);
    });
  });

  it("has no instruction that lets an agent move funds", () => {
    const names = program.idl.instructions.map((i) => i.name).sort();
    assert.deepEqual(names, [
      "approveAndExecutePayment",
      "depositSol",
      "initializeVault",
      "proposePayment",
      "rejectPayment",
      "updatePolicy",
    ]);
    for (const ix of program.idl.instructions) {
      if (ix.name === "proposePayment") continue;
      assert.notInclude(ix.accounts.map((a) => a.name), "agent", `${ix.name} takes an agent`);
    }
  });
});
