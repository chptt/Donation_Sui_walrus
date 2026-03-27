# SuiGive — Decentralized Donation Platform

A full-stack donation platform built on **Sui blockchain** with **Walrus** image storage and **zkLogin** authentication.

---

## Architecture

```
/
├── contracts/          # Sui Move smart contract
│   ├── Move.toml
│   └── sources/
│       └── donation_platform.move
├── frontend/           # Next.js 14 app
│   ├── app/            # App Router pages
│   ├── components/     # UI components
│   ├── context/        # ZkLoginContext (auth state)
│   └── utils/          # walrus.ts | zklogin.ts | sui.ts | constants.ts
└── README.md
```

---

## How It Works

### zkLogin (Authentication)
1. User clicks "Login with Google"
2. An ephemeral Ed25519 keypair is generated and stored in `sessionStorage`
3. A nonce committing to the keypair + epoch window is embedded in the Google OAuth URL
4. Google returns a JWT; we send it to the Mysten prover to get a ZK proof
5. The proof + ephemeral signature form a valid Sui transaction signature
6. The user's Sui address is derived deterministically from their Google `sub` + a salt
7. No private key is ever stored long-term — identity = wallet address

### Walrus (Image Storage)
1. User selects an image in the Create Campaign form
2. The raw bytes are PUT to the Walrus publisher endpoint
3. Walrus returns a `blobId` (content-addressed hash)
4. The `blobId` is passed to the Move contract and stored on-chain as a `String`
5. To display the image: `https://aggregator.walrus-testnet.walrus.space/v1/<blobId>`

### On-Chain Storage (Sui Move)
- Each `Campaign` is a shared Sui object containing:
  - `creator` address
  - `title`, `description`
  - `target_amount`, `amount_raised` (in MIST)
  - `walrus_blob_id` — the Walrus image reference (NOT the image itself)
  - `is_active` flag
- Donations call `donate()` which updates `amount_raised` and transfers SUI to the creator

---

## Prerequisites

- [Sui CLI](https://docs.sui.io/guides/developer/getting-started/sui-install) installed
- Node.js 18+
- A Google Cloud project with OAuth 2.0 credentials
- Testnet SUI tokens (from [faucet](https://faucet.sui.io))

---

## Setup

### 1. Deploy the Move contract

```bash
# Switch to testnet
sui client switch --env testnet

# Publish the contract
cd contracts
sui client publish --gas-budget 100000000
```

Copy the **Package ID** from the output.

### 2. Configure the frontend

```bash
cd frontend
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_PACKAGE_ID=0xYOUR_PACKAGE_ID
NEXT_PUBLIC_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000/auth/callback
NEXT_PUBLIC_PROVER_URL=https://prover-dev.mystenlabs.com/v1
NEXT_PUBLIC_WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
NEXT_PUBLIC_WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
```

### 3. Configure Google OAuth

In [Google Cloud Console](https://console.cloud.google.com):
- Create an OAuth 2.0 Client ID (Web application)
- Add `http://localhost:3000/auth/callback` as an Authorized Redirect URI

### 4. Install dependencies and run

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Key Constraints

- No IPFS, Firebase, MongoDB, or traditional database
- All images stored on Walrus — only the `blobId` lives on-chain
- zkLogin is the only authentication method — no email/password
- Campaign creation is blocked without a successfully uploaded image
