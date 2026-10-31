import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";
import { randomBytes } from "crypto";
import type { Unslept } from "../target/types/unslept";

const USDC = (n: number) => new BN(Math.round(n * 1e6));

describe("unslept", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Unslept as Program<Unslept>;
  const conn = provider.connection;
  const admin = (provider.wallet as anchor.Wallet).payer;

  const owner = Keypair.generate();
  const agentSigner = Keypair.generate();
  const merchant = Keypair.generate();
  const lp = Keypair.generate();
  const pauser = Keypair.generate();

  let mint: PublicKey;
  let treasury: PublicKey;
  let lpUsdc: PublicKey;
  let lpShares: PublicKey;
  let merchantUsdc: PublicKey;
  const pda = (...seeds: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(seeds, program.programId)[0];
  const config = pda(Buffer.from("config"));
  const bufferVault = pda(Buffer.from("buffer_vault"));
  const shareMint = pda(Buffer.from("share_mint"));
  const agentId = new BN(1);
  const agent = pda(Buffer.from("agent"), owner.publicKey.toBuffer(), agentId.toArrayLike(Buffer, "le", 8));
  const agentVault = pda(Buffer.from("agent_vault"), agent.toBuffer());

  const bal = async (a: PublicKey) => Number((await getAccount(conn, a)).amount);
  const airdrop = async (k: PublicKey) => {
    const sig = await conn.requestAirdrop(k, 5 * LAMPORTS_PER_SOL);
    await conn.confirmTransaction(sig, "confirmed");
  };

  async function pay(amount: BN, payee = merchantUsdc, id = randomBytes(32)) {
    const payment = pda(Buffer.from("payment"), id);
    await program.methods
      .pay([...id], amount, [...Buffer.alloc(32, 7)])
      .accountsPartial({
        signer: agentSigner.publicKey,
        config,
        agent,
        agentVault,
        bufferVault,
        treasury,
        payeeToken: payee,
        payment,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentSigner])
      .rpc();
    return { id, payment };
  }

  async function expectError(p: Promise<unknown>, code: string) {
    try {
      await p;
      expect.fail(`expected ${code}`);
    } catch (e: any) {
      expect(String(e?.error?.errorCode?.code ?? e?.message ?? e)).to.include(code);
    }
  }

  before(async () => {
    for (const k of [owner, agentSigner, merchant, lp, pauser]) await airdrop(k.publicKey);
    mint = await createMint(conn, admin, admin.publicKey, null, 6);
    treasury = (await getOrCreateAssociatedTokenAccount(conn, admin, mint, admin.publicKey)).address;
    lpUsdc = (await getOrCreateAssociatedTokenAccount(conn, admin, mint, lp.publicKey)).address;
    merchantUsdc = (await getOrCreateAssociatedTokenAccount(conn, admin, mint, merchant.publicKey)).address;
    await mintTo(conn, admin, mint, lpUsdc, admin, 1_000e6);
  });

  it("initializes the protocol", async () => {
    await program.methods
      .initialize({ feeBps: 50, depositCap: USDC(50_000), pauser: pauser.publicKey, keeper: admin.publicKey, treasury })
      .accountsPartial({ admin: admin.publicKey, usdcMint: mint, config, bufferVault, shareMint })
      .rpc();
    const c = await program.account.config.fetch(config);
    expect(c.params.feeBps).to.eq(50);
    expect(c.usdcMint.toBase58()).to.eq(mint.toBase58());
  });

  it("takes buffer deposits and mints shares 1:1 at first", async () => {
    lpShares = (await getOrCreateAssociatedTokenAccount(conn, admin, shareMint, lp.publicKey)).address;
    await program.methods
      .bufferDeposit(USDC(500))
      .accountsPartial({ depositor: lp.publicKey, config, bufferVault, shareMint, depositorUsdc: lpUsdc, depositorShares: lpShares })
      .signers([lp])
      .rpc();
    expect(await bal(bufferVault)).to.eq(500e6);
    expect(await bal(lpShares)).to.eq(500e6);
  });

  it("refuses deposits above the cap", async () => {
    await program.methods
      .proposeParams({ feeBps: 50, depositCap: USDC(600), pauser: pauser.publicKey, keeper: admin.publicKey, treasury })
      .accountsPartial({ admin: admin.publicKey, config })
      .rpc();
    // The new cap is not active until its 24-hour delay passes.
    await expectError(program.methods.applyParams().accountsPartial({ config }).rpc(), "NotReady");
    await program.methods.cancelParams().accountsPartial({ admin: admin.publicKey, config }).rpc();
  });

  it("creates an agent account with a policy", async () => {
    await program.methods
      .createAgent(agentId, agentSigner.publicKey, USDC(0.05), USDC(1))
      .accountsPartial({ owner: owner.publicKey, config, usdcMint: mint, agent, agentVault })
      .signers([owner])
      .rpc();
    const a = await program.account.agent.fetch(agent);
    expect(a.signer.toBase58()).to.eq(agentSigner.publicKey.toBase58());
    expect(a.perCallCap.toNumber()).to.eq(50_000);
  });

  it("refuses a payment the agent cannot cover", async () => {
    await expectError(pay(USDC(0.01)), "InsufficientCollateral");
  });

  it("settles a payment from the buffer and repays it from the agent in the same transaction", async () => {
    await mintTo(conn, admin, mint, agentVault, admin, 2e6);
    const before = { buffer: await bal(bufferVault), merchant: await bal(merchantUsdc), treasury: await bal(treasury), agent: await bal(agentVault) };
    const { payment } = await pay(USDC(0.01));
    expect(await bal(merchantUsdc)).to.eq(before.merchant + 10_000);
    expect(await bal(treasury)).to.eq(before.treasury + 50); // 0.5% fee
    expect(await bal(agentVault)).to.eq(before.agent - 10_050);
    expect(await bal(bufferVault)).to.eq(before.buffer); // fronted and repaid in one transaction
    const a = await program.account.agent.fetch(agent);
    expect(a.debt.toNumber()).to.eq(0);
    expect(a.spentToday.toNumber()).to.eq(10_000);
    const p = await program.account.payment.fetch(payment);
    expect(p.payee.toBase58()).to.eq(merchant.publicKey.toBase58());
    expect(p.amount.toNumber()).to.eq(10_000);
    const c = await program.account.config.fetch(config);
    expect(c.outstandingDebt.toNumber()).to.eq(0);
  });

  it("never accepts the same payment ID twice", async () => {
    const id = randomBytes(32);
    await pay(USDC(0.01), merchantUsdc, id);
    let failed = false;
    try {
      await pay(USDC(0.01), merchantUsdc, id);
    } catch {
      failed = true;
    }
    expect(failed).to.eq(true);
  });

  it("enforces the per-call cap", async () => {
    await expectError(pay(USDC(0.06)), "PerCallCapExceeded");
  });

  it("enforces the daily cap", async () => {
    await program.methods.setPolicy(USDC(0.05), USDC(0.04)).accountsPartial({ owner: owner.publicKey, agent }).signers([owner]).rpc();
    await expectError(pay(USDC(0.03)), "DailyCapExceeded");
    await program.methods.setPolicy(USDC(0.05), USDC(1)).accountsPartial({ owner: owner.publicKey, agent }).signers([owner]).rpc();
  });

  it("enforces the payee allowlist", async () => {
    const other = Keypair.generate();
    await program.methods.setAllowlist([other.publicKey]).accountsPartial({ owner: owner.publicKey, agent }).signers([owner]).rpc();
    await expectError(pay(USDC(0.01)), "PayeeNotAllowed");
    await program.methods.setAllowlist([merchant.publicKey]).accountsPartial({ owner: owner.publicKey, agent }).signers([owner]).rpc();
    await pay(USDC(0.01));
  });

  it("only the agent signer can pay", async () => {
    const id = randomBytes(32);
    const stranger = Keypair.generate();
    await airdrop(stranger.publicKey);
    await expectError(
      program.methods
        .pay([...id], USDC(0.01), [...Buffer.alloc(32)])
        .accountsPartial({ signer: stranger.publicKey, config, agent, agentVault, bufferVault, treasury, payeeToken: merchantUsdc, payment: pda(Buffer.from("payment"), id) })
        .signers([stranger])
        .rpc(),
      "NotSigner",
    );
  });

  it("pauses: payments stop, buffer withdrawals stay open", async () => {
    await program.methods.setPaused(true).accountsPartial({ authority: pauser.publicKey, config }).signers([pauser]).rpc();
    await expectError(pay(USDC(0.01)), "ProtocolPaused");
    await program.methods
      .bufferWithdraw(USDC(100))
      .accountsPartial({ depositor: lp.publicKey, config, bufferVault, shareMint, depositorUsdc: lpUsdc, depositorShares: lpShares })
      .signers([lp])
      .rpc();
    expect(await bal(lpShares)).to.eq(400e6);
    await program.methods.setPaused(false).accountsPartial({ authority: pauser.publicKey, config }).signers([pauser]).rpc();
  });

  it("lets the owner withdraw and revoke", async () => {
    const ownerUsdc = (await getOrCreateAssociatedTokenAccount(conn, admin, mint, owner.publicKey)).address;
    await program.methods.agentWithdraw(USDC(0.5)).accountsPartial({ owner: owner.publicKey, agent, agentVault, destination: ownerUsdc }).signers([owner]).rpc();
    expect(await bal(ownerUsdc)).to.eq(500_000);
    await program.methods.revoke().accountsPartial({ owner: owner.publicKey, agent }).signers([owner]).rpc();
    await expectError(pay(USDC(0.01)), "NotSigner");
  });

  it("a stranger cannot change the agent policy", async () => {
    const stranger = Keypair.generate();
    await expectError(
      program.methods.setPolicy(USDC(100), USDC(100)).accountsPartial({ owner: stranger.publicKey, agent }).signers([stranger]).rpc(),
      "NotOwner",
    );
  });
});
