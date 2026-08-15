# On-Chain Testing Guide (WEMSP + Hardhat)

This guide explains how to run local on-chain testing for:

- `wemsp-contract` (smart contract repo)
- `wemsp-v2` (backend integration using `src/lib/contract.ts`)

---

## 1) Prerequisites

- Node.js + pnpm installed
- Repos cloned:
  - `wemsp-contract`
  - `wemsp-v2`

---

## 2) Install dependencies

### Contract repo

```bash
cd ~/.../wemsp-contract
pnpm install
```

### App repo

```bash
cd ~/.../wemsp-v2
pnpm install
```

---

## 3) Run contract tests (repo-level)

From `wemsp-contract`:

```bash
ETHERSCAN_API_KEY=dummy pnpm exec hardhat test
```

> Note: current `hardhat.config.ts` expects `verify.etherscan.apiKey` to be a string. For local tests, use a dummy value.

---

## 4) Start local Hardhat node

From `wemsp-contract`:

```bash
ETHERSCAN_API_KEY=dummy pnpm exec hardhat node
```

RPC endpoint:

- `http://127.0.0.1:8545`

Default funded account used in local tests:

- Address: `0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266`
- Private key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`

---

## 5) Deploy AgreementContract locally

In another terminal, from `wemsp-contract`:

```bash
ETHERSCAN_API_KEY=dummy pnpm exec hardhat run scripts/deploy.ts --network localhost
```

Capture deployed contract address from output, e.g.:

- `0x5FbDB2315678afecb367f032d93F642f64180aa3`

---

## 6) Run app integration smoke flow against local chain

From `wemsp-v2`:

```bash
RPC_URL=http://127.0.0.1:8545 \
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3 \
pnpm exec tsx src/test/onchain-smoke.ts
```

Expected behavior:

- Mint agreement NFT
- Owner signs
- Beneficiaries sign
- Witness signs
- Agreement finalizes
- Final state prints `isFinalized: true`

---

## 7) Run app test suite (includes on-chain route mocks)

From `wemsp-v2`:

```bash
pnpm test
```

Current suite includes:

- admin login/session route tests
- agreement auth/lifecycle tests
- on-chain sign route tests (owner/beneficiary/witness) with contract-layer mocks
- validation/faraid tests

---

## 8) Troubleshooting

### `Nonce too low` / `nonce has already been used`

If sending multiple transactions quickly from one signer, nonce issues can happen.

Fix already applied in app integration:

- `src/lib/contract.ts` now uses `ethers.NonceManager` for the signer.

### Hardhat verify config error (`HHE15`)

If `ETHERSCAN_API_KEY` missing, local test command may fail on config validation.
Use:

```bash
ETHERSCAN_API_KEY=dummy ...
```

### Vitest message: `close timed out after 10000ms`

This warning can appear even when tests pass (`exit code 0`).
It usually indicates lingering process handles in Vite/Vitest runtime.

---

## 9) Suggested CI split

- PR pipeline:
  - `pnpm test` (fast mocked route/unit tests)
- Nightly / pre-release:
  - boot local Hardhat
  - deploy contract
  - run `src/test/onchain-smoke.ts`

This gives speed + real on-chain confidence.
