import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getProgram, IntentguardProgram, PROGRAM_ID, proposalPda, vaultPda } from "./chain";

type Program = IntentguardProgram;
export type VaultAccount = Awaited<ReturnType<Program["account"]["vault"]["fetch"]>>;
export type ProposalAccount = Awaited<ReturnType<Program["account"]["paymentProposal"]["fetch"]>>;

const POLL_MS = 6_000;

export type VaultState = {
  program: Program;
  vaultAddress: PublicKey | null;
  proposalAddress: PublicKey | null;
  vault: VaultAccount | null;
  proposal: ProposalAccount | null;
  balance: bigint | null;
  spendable: bigint | null;
  walletBalance: bigint | null;
  programDeployed: boolean | null;
  loading: boolean;
  rpcError: boolean;
  refresh: () => Promise<void>;
};

/** Everything here is read from Devnet. The dashboard keeps no copy of its own. */
export function useVaultState(): VaultState {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const program = useMemo(() => getProgram(connection), [connection]);
  const vaultAddress = useMemo(() => (publicKey ? vaultPda(publicKey) : null), [publicKey]);
  const proposalAddress = useMemo(
    () => (vaultAddress ? proposalPda(vaultAddress) : null),
    [vaultAddress]
  );

  const [vault, setVault] = useState<VaultAccount | null>(null);
  const [proposal, setProposal] = useState<ProposalAccount | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [spendable, setSpendable] = useState<bigint | null>(null);
  const [walletBalance, setWalletBalance] = useState<bigint | null>(null);
  const [programDeployed, setProgramDeployed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [rpcError, setRpcError] = useState(false);
  const owner = useRef(publicKey);
  owner.current = publicKey;

  const refresh = useCallback(async () => {
    const requestedFor = publicKey;
    try {
      const programInfo = await connection.getAccountInfo(PROGRAM_ID);
      setProgramDeployed(Boolean(programInfo?.executable));
      if (!publicKey || !vaultAddress || !proposalAddress || !programInfo) {
        setVault(null);
        setProposal(null);
        setBalance(null);
        setSpendable(null);
        if (publicKey) setWalletBalance(BigInt(await connection.getBalance(publicKey)));
        setRpcError(false);
        return;
      }
      const [vaultInfo, wallet, nextVault, nextProposal] = await Promise.all([
        connection.getAccountInfo(vaultAddress),
        connection.getBalance(publicKey),
        program.account.vault.fetchNullable(vaultAddress),
        program.account.paymentProposal.fetchNullable(proposalAddress),
      ]);
      // Ignore a late response for a wallet that has since been switched.
      if (owner.current?.toBase58() !== requestedFor?.toBase58()) return;

      setVault(nextVault);
      setProposal(nextProposal);
      setWalletBalance(BigInt(wallet));
      if (vaultInfo) {
        const rent = await connection.getMinimumBalanceForRentExemption(vaultInfo.data.length);
        const lamports = BigInt(vaultInfo.lamports);
        setBalance(lamports);
        setSpendable(lamports > BigInt(rent) ? lamports - BigInt(rent) : 0n);
      } else {
        setBalance(null);
        setSpendable(null);
      }
      setRpcError(false);
    } catch (error) {
      console.warn("Devnet read failed:", error);
      setRpcError(true);
    } finally {
      setLoading(false);
    }
  }, [connection, program, publicKey, vaultAddress, proposalAddress]);

  useEffect(() => {
    setLoading(true);
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return {
    program,
    vaultAddress,
    proposalAddress,
    vault,
    proposal,
    balance,
    spendable,
    walletBalance,
    programDeployed,
    loading,
    rpcError,
    refresh,
  };
}
