// Kamino yield test. Runs against real Kamino Lend code and the real Main Market USDC reserve copied from mainnet
// (see scripts/kamino-fork.sh).
import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import BN from "bn.js";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL, ComputeBudgetProgram } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo, getAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";
import { randomBytes } from "crypto";
import fs from "fs";
import type { Unslept } from "../target/types/unslept";

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const KLEND = new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD");
const MARKET = new PublicKey("7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF");
const RESERVE = new PublicKey("D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59");
const SUPPLY = new PublicKey(process.env.SUPPLY!);
const CTOKEN_MINT = new PublicKey(process.env.CTOKEN_MINT!);
const LMA = PublicKey.findProgramAddressSync([Buffer.from("lma"), MARKET.toBuffer()], KLEND)[0];
const SYSVAR_IX = new PublicKey("Sysvar1nstructions1111111111111111111111111");
const USDC = (n: number) => new BN(Math.round(n * 1e6));
const cu = ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 });

describe("unslept + kamino (mainnet fork)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Unslept as Program<Unslept>;
  const conn = provider.connection;
  const admin = (provider.wallet as anchor.Wallet).payer;
  const owner = Keypair.generate();
  const agentSigner = Keypair.generate();
  const merchant = Keypair.generate();

  const pda = (...seeds: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(seeds, program.programId)[0];
  const config = pda(Buffer.from("config"));
  const bufferVault = pda(Buffer.from("buffer_vault"));
  const shareMint = pda(Buffer.from("share_mint"));
  const agentId = new BN(1);
  const agent = pda(Buffer.from("agent"), owner.publicKey.toBuffer(), agentId.toArrayLike(Buffer, "le", 8));
  const agentVault = pda(Buffer.from("agent_vault"), agent.toBuffer());
  const agentCtoken = pda(Buffer.from("agent_ctoken"), agent.toBuffer());
  let treasury: PublicKey, merchantUsdc: PublicKey, adminUsdc: PublicKey, adminShares: PublicKey;

  const bal = async (a: PublicKey) => Number((await getAccount(conn, a)).amount);
  const kaminoAccounts = {
    ctokenMint: CTOKEN_MINT, usdcMint: USDC_MINT, reserve: RESERVE, lendingMarket: MARKET,
    lendingMarketAuthority: LMA, reserveLiquiditySupply: SUPPLY, instructionSysvar: SYSVAR_IX, klendProgram: KLEND,
    tokenProgram: TOKEN_PROGRAM_ID,
  };

  before(async () => {
    for (const k of [owner, agentSigner, merchant]) {
      await conn.confirmTransaction(await conn.requestAirdrop(k.publicKey, 5 * LAMPORTS_PER_SOL), "confirmed");
    }
    treasury = (await getOrCreateAssociatedTokenAccount(conn, admin, USDC_MINT, admin.publicKey)).address;
    adminUsdc = treasury;
    merchantUsdc = (await getOrCreateAssociatedTokenAccount(conn, admin, USDC_MINT, merchant.publicKey)).address;
    await mintTo(conn, admin, USDC_MINT, adminUsdc, admin, 1_000e6);
  });

  it("initializes with real USDC and the Kamino Main Market USDC reserve", async () => {
    await program.methods
      .initialize({ feeBps: 50, depositCap: USDC(50_000), pauser: admin.publicKey, keeper: admin.publicKey, treasury })
      .accountsPartial({ admin: admin.publicKey, usdcMint: USDC_MINT, config, bufferVault, shareMint })
      .rpc();
    await program.methods.setYieldReserve(RESERVE, CTOKEN_MINT).accountsPartial({ admin: admin.publicKey, config }).rpc();
    try {
      await program.methods.setYieldReserve(RESERVE, CTOKEN_MINT).accountsPartial({ admin: admin.publicKey, config }).rpc();
      expect.fail("second set should fail");
    } catch (e: any) {
      expect(String(e?.error?.errorCode?.code ?? e)).to.include("YieldReserveAlreadySet");
    }
    adminShares = (await getOrCreateAssociatedTokenAccount(conn, admin, shareMint, admin.publicKey)).address;
    await program.methods
      .bufferDeposit(USDC(200))
      .accountsPartial({ depositor: admin.publicKey, config, bufferVault, shareMint, depositorUsdc: adminUsdc, depositorShares: adminShares })
      .rpc();
  });

  it("creates an agent and puts its USDC to work in Kamino", async () => {
    await program.methods
      .createAgent(agentId, agentSigner.publicKey, USDC(20), USDC(100))
      .accountsPartial({ owner: owner.publicKey, config, usdcMint: USDC_MINT, agent, agentVault })
      .signers([owner])
      .rpc();
    await mintTo(conn, admin, USDC_MINT, agentVault, admin, 50e6);

    await program.methods
      .yieldDeposit(USDC(40))
      .accountsPartial({ owner: owner.publicKey, config, agent, agentVault, agentCtoken, systemProgram: SystemProgram.programId, ...kaminoAccounts })
      .preInstructions([cu])
      .signers([owner])
      .rpc();

    expect(await bal(agentVault)).to.eq(10e6);
    const ctokens = await bal(agentCtoken);
    expect(ctokens).to.be.greaterThan(0);
    expect(ctokens).to.be.lessThan(40e6); // cUSDC is worth more than 1 USDC
    const a = await program.account.agent.fetch(agent);
    expect(a.positionValue.toNumber()).to.eq(40e6);
    console.log(`      40 USDC -> ${ctokens / 1e6} cUSDC`);
  });

  it("pays more than the liquid balance; the Kamino position backs the debt", async () => {
    const id = randomBytes(32);
    await program.methods
      .pay([...id], USDC(15), [...Buffer.alloc(32, 1)])
      .accountsPartial({
        signer: agentSigner.publicKey, config, agent, agentVault, bufferVault, treasury, payeeToken: merchantUsdc,
        payment: pda(Buffer.from("payment"), id), tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      })
      .signers([agentSigner])
      .rpc();
    expect(await bal(merchantUsdc)).to.eq(15e6);
    const a = await program.account.agent.fetch(agent);
    // 10 USDC liquid: 0.075 fee, 9.925 repaid at once, 5.075 left as debt.
    expect(a.debt.toNumber()).to.eq(5_075_000);
    expect(await bal(agentVault)).to.eq(0);
  });

  it("refuses redemption by a stranger", async () => {
    const stranger = Keypair.generate();
    await conn.confirmTransaction(await conn.requestAirdrop(stranger.publicKey, LAMPORTS_PER_SOL), "confirmed");
    try {
      await program.methods
        .yieldRedeem(new BN(1))
        .accountsPartial({ caller: stranger.publicKey, config, agent, agentVault, agentCtoken, bufferVault, ...kaminoAccounts })
        .preInstructions([cu])
        .signers([stranger])
        .rpc();
      expect.fail("stranger redeemed");
    } catch (e: any) {
      expect(String(e?.error?.errorCode?.code ?? e)).to.include("NotOwnerOrKeeper");
    }
  });

  it("keeper redeems from Kamino and the debt is repaid in the same transaction", async () => {
    const bufferBefore = await bal(bufferVault);
    const ctokens = await bal(agentCtoken);
    await program.methods
      .yieldRedeem(new BN(ctokens))
      .accountsPartial({ caller: admin.publicKey, config, agent, agentVault, agentCtoken, bufferVault, ...kaminoAccounts })
      .preInstructions([cu])
      .rpc();
    const a = await program.account.agent.fetch(agent);
    expect(a.debt.toNumber()).to.eq(0);
    expect(a.positionValue.toNumber()).to.eq(0);
    expect(await bal(agentCtoken)).to.eq(0);
    expect(await bal(bufferVault)).to.eq(bufferBefore + 5_075_000);
    const left = await bal(agentVault);
    // Redemption returns at least the deposit minus rounding.
    expect(left).to.be.greaterThanOrEqual(40e6 - 5_075_000 - 2);
    console.log(`      redeemed ${ctokens / 1e6} cUSDC, ${left / 1e6} USDC left after repaying debt`);
    const c = await program.account.config.fetch(config);
    expect(c.outstandingDebt.toNumber()).to.eq(0);
  });

  after(() => {
    // Hand the funded agent to the SDK end-to-end script (scripts/sdk-e2e.mts).
    fs.writeFileSync(".fork/e2e.json", JSON.stringify({ agent: agent.toBase58(), signer: Array.from(agentSigner.secretKey) }));
  });
});
