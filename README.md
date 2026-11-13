# ⭐ Star Donation — Decentralized Donation Platform

> A fully on-chain fundraising platform built on **Sui** blockchain with **Walrus** decentralized storage and **zkLogin** (Google OAuth) for passwordless authentication.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://donation-sui-walrus.vercel.app)
[![Sui Network](https://img.shields.io/badge/Network-Sui%20Testnet-4DA2FF?style=for-the-badge)](https://suiexplorer.com/object/0x18cce85dcbe14f55ecdb56396467ebed18e6bd38db5e3b86775f01e94878cae7?network=testnet)

---

## 🌐 Live Demo

**Production URL:** https://donation-sui-walrus.vercel.app

---

## 📖 Overview

Star Donation lets anyone create a fundraising campaign, upload a proof photo, and receive SUI coin donations — with no backend server, no custodial accounts, and no passwords.

- Campaign data lives permanently on the **Sui blockchain**
- Campaign images are stored on **Walrus** (decentralized storage)
- Users authenticate with **Google via zkLogin** — no wallet extension required
- Every donation is a verifiable on-chain transaction

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔐 zkLogin | Sign in with Google — no seed phrase, no wallet extension |
| 📸 Walrus Image Storage | Campaign photos stored on decentralized Walrus network |
| 🏦 On-chain Campaigns | Campaign state stored in Sui shared objects |
| 💸 Direct Donations | SUI coins sent directly to campaign creator on-chain |
| 🌊 Testnet Faucet | Built-in faucet request to fund new accounts |
| 🎯 Real-time Progress | Live fundraising progress bar per campaign |
| 📋 Proof of Authenticity | Walrus blob ID anchored permanently in the smart contract |

---

## 🛠 Technology Stack

### Blockchain
| Technology | Role |
|-----------|------|
| Sui | Layer-1 blockchain — smart contracts + object storage |
| Move (2024 edition) | Smart contract language |
| Walrus | Decentralized blob storage for campaign images |

### Frontend
| Technology | Role |
|-----------|------|
| Next.js 15 | React framework with App Router + API routes |
| TypeScript | Type-safe codebase |
| Tailwind CSS | Utility-first styling |
| @mysten/sui | Sui TypeScript SDK |
| @mysten/zklogin | zkLogin helpers |

### Auth & Infrastructure
| Technology | Role |
|-----------|------|
| zkLogin | Passwordless Google OAuth to Sui address derivation |
| Mysten Enoki / Dev Prover | ZK proof generation service |
| Vercel | Frontend hosting + serverless API routes |

---

## 🏗 Architecture

```
Browser (Next.js)
  |
  |-- Google OAuth (zkLogin)
  |-- ZK Prover (Enoki or dev prover) --> ZK Proof
  |-- Walrus Network (image upload) --> blobId
  |
  v
Sui Testnet Blockchain
  Campaign (shared object):
    - title, description, target_amount
    - amount_raised, is_active
    - walrus_blob_id (anchored on-chain)
```

**Key design decisions:**
- Images are never stored on Sui — only the Walrus blobId string is anchored on-chain, keeping gas costs minimal
- zkLogin derives a deterministic Sui address from Google identity + a browser-local salt — no seed phrase needed
- Donations flow peer-to-peer (donor to campaign creator) with no escrow contract

---

## 📂 Project Structure

```
├── contracts/
│   ├── sources/
│   │   └── donation_platform.move   # Move smart contract
│   ├── Move.toml                    # Package manifest
│   ├── Move.lock                    # Dependency lock file
│   └── Published.toml               # Deployment metadata (package ID)
│
└── frontend/
    ├── app/                         # Next.js App Router pages
    │   ├── page.tsx                 # Homepage — campaign feed
    │   ├── campaigns/create/        # Create campaign form
    │   ├── campaigns/[id]/          # Campaign detail + donate
    │   └── auth/callback/           # zkLogin OAuth callback
    ├── components/
    │   ├── Navbar.tsx               # Navigation + login/logout
    │   ├── CampaignCard.tsx         # Campaign grid card
    │   └── ImageUpload.tsx          # Walrus upload component
    ├── context/
    │   └── ZkLoginContext.tsx       # zkLogin session context
    ├── pages/api/
    │   ├── zkproof.ts               # ZK proof proxy (Enoki/dev)
    │   ├── upload.ts                # Walrus upload proxy
    │   └── faucet.ts                # Testnet faucet proxy
    └── utils/
        ├── constants.ts             # Central env var config
        ├── sui.ts                   # Sui transaction helpers
        ├── zklogin.ts               # zkLogin session helpers
        └── walrus.ts                # Walrus upload helpers
```

---

## 🚀 Setup & Local Development

### Prerequisites
- Node.js 18+
- Sui CLI
- A Google Cloud OAuth 2.0 Client ID

### 1. Clone & Install

```bash
git clone https://github.com/chptt/Donation_Sui_walrus.git
cd Donation_Sui_walrus/frontend
npm install
```

### 2. Configure Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_PACKAGE_ID=0x18cce85dcbe14f55ecdb56396467ebed18e6bd38db5e3b86775f01e94878cae7
NEXT_PUBLIC_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000/auth/callback
NEXT_PUBLIC_PROVER_URL=https://prover-dev.mystenlabs.com/v1
NEXT_PUBLIC_WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
NEXT_PUBLIC_WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
```

### 3. Run Dev Server

```bash
npm run dev
# Open http://localhost:3000
```

---

## 🔗 Smart Contract

The Move contract is deployed on Sui Testnet.

| Field | Value |
|-------|-------|
| Package ID | `0x18cce85dcbe14f55ecdb56396467ebed18e6bd38db5e3b86775f01e94878cae7` |
| Network | Sui Testnet (chain ID: `4c78adac`) |
| Explorer | https://suiexplorer.com/object/0x18cce85dcbe14f55ecdb56396467ebed18e6bd38db5e3b86775f01e94878cae7?network=testnet |

### Redeploy Contract

```bash
cd contracts
sui client publish --gas-budget 100000000
```

---

## 🔐 zkLogin Flow

1. User clicks "Sign in with Google"
2. App generates an ephemeral Ed25519 keypair + nonce
3. Redirect to Google OAuth with nonce embedded in request
4. Google returns a JWT containing the nonce
5. JWT is sent to the ZK prover which returns a ZK proof
6. Sui address is deterministically derived from `genAddressSeed(salt, "sub", sub, aud)`
7. Transactions are signed with ephemeral key + ZK proof — no seed phrase ever stored

---

## 🌊 Walrus Image Storage

Campaign images are uploaded to the Walrus decentralized storage network:

1. Image is PUT to `/api/upload` — proxied to Walrus publisher
2. Walrus returns a `blobId` string
3. `blobId` is passed to the `create_campaign` Move entry function and stored on-chain
4. Images are retrieved via `https://{aggregator}/v1/{blobId}`

Walrus stores blobs for a configurable number of epochs (default: 5).

---

## 📦 Deploy to Vercel

Set the following environment variables in your Vercel project dashboard:
- `NEXT_PUBLIC_SUI_NETWORK`
- `NEXT_PUBLIC_PACKAGE_ID`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `NEXT_PUBLIC_REDIRECT_URI` (use your Vercel domain)
- `NEXT_PUBLIC_WALRUS_PUBLISHER_URL`
- `NEXT_PUBLIC_WALRUS_AGGREGATOR_URL`
- `ENOKI_API_KEY` (optional, for Enoki prover)

---

## 📄 License

MIT
