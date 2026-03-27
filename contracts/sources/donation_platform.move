/// Sui Move smart contract for the decentralized donation platform.
/// Campaigns store a Walrus blob ID as the image reference — no image data is stored on-chain.
module donation_platform::donation_platform {

    use sui::coin::Coin;
    use sui::sui::SUI;
    use sui::event;
    use std::string::String;

    // ─── Errors ───────────────────────────────────────────────────────────────
    const EInvalidTargetAmount: u64 = 1;
    const EEmptyTitle: u64 = 2;
    const EEmptyImageRef: u64 = 3;
    const EZeroDonation: u64 = 4;
    const ECampaignNotActive: u64 = 5;

    // ─── Structs ──────────────────────────────────────────────────────────────

    /// Shared object representing a single donation campaign.
    /// `walrus_blob_id` is the Walrus storage reference for the campaign image.
    /// Only the blob ID string is stored here — the actual image lives on Walrus.
    public struct Campaign has key {
        id: UID,
        creator: address,
        title: String,
        description: String,
        /// Target amount in MIST (1 SUI = 1_000_000_000 MIST)
        target_amount: u64,
        /// Total amount raised so far in MIST
        amount_raised: u64,
        /// Walrus blob ID — the off-chain image reference stored permanently on-chain.
        /// Reconstruct image URL as: https://aggregator.walrus-testnet.walrus.space/v1/<walrus_blob_id>
        walrus_blob_id: String,
        is_active: bool,
    }

    /// Capability object sent to the campaign creator — allows them to deactivate the campaign.
    public struct CampaignCap has key, store {
        id: UID,
        campaign_id: address,
    }

    // ─── Events ───────────────────────────────────────────────────────────────

    public struct CampaignCreated has copy, drop {
        campaign_id: address,
        creator: address,
        title: String,
        target_amount: u64,
        walrus_blob_id: String,
    }

    public struct DonationMade has copy, drop {
        campaign_id: address,
        donor: address,
        amount: u64,
        new_total: u64,
    }

    // ─── Entry Functions ──────────────────────────────────────────────────────

    /// Create a new campaign.
    /// `walrus_blob_id` must be a non-empty string returned by Walrus after uploading the image.
    /// This blob ID is stored permanently on-chain and links the campaign to its proof image.
    public entry fun create_campaign(
        title: vector<u8>,
        description: vector<u8>,
        target_amount: u64,
        walrus_blob_id: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(target_amount > 0, EInvalidTargetAmount);
        assert!(!title.is_empty(), EEmptyTitle);
        assert!(!walrus_blob_id.is_empty(), EEmptyImageRef);

        let campaign_uid = object::new(ctx);
        let campaign_id = campaign_uid.to_address();
        let creator = ctx.sender();

        let title_str = title.to_string();
        let blob_str = walrus_blob_id.to_string();

        // Emit creation event so the frontend can index campaigns by querying events
        event::emit(CampaignCreated {
            campaign_id,
            creator,
            title: title_str,
            target_amount,
            walrus_blob_id: blob_str,
        });

        let campaign = Campaign {
            id: campaign_uid,
            creator,
            title: title_str,
            description: description.to_string(),
            target_amount,
            amount_raised: 0,
            walrus_blob_id: blob_str, // ← Walrus blob ID stored permanently on-chain
            is_active: true,
        };

        // Share the campaign so anyone can donate to it
        transfer::share_object(campaign);

        // Send capability to creator so they can deactivate later
        let cap = CampaignCap {
            id: object::new(ctx),
            campaign_id,
        };
        transfer::transfer(cap, creator);
    }

    /// Donate SUI to a campaign.
    /// Funds are transferred directly to the campaign creator.
    /// The raised amount is updated on-chain for full transparency.
    public entry fun donate(
        campaign: &mut Campaign,
        payment: Coin<SUI>,
        ctx: &mut TxContext,
    ) {
        assert!(campaign.is_active, ECampaignNotActive);
        let amount = payment.value();
        assert!(amount > 0, EZeroDonation);

        campaign.amount_raised = campaign.amount_raised + amount;

        event::emit(DonationMade {
            campaign_id: campaign.id.to_address(),
            donor: ctx.sender(),
            amount,
            new_total: campaign.amount_raised,
        });

        // Transfer funds directly to the campaign creator
        transfer::public_transfer(payment, campaign.creator);
    }

    /// Creator can deactivate their campaign using the CampaignCap.
    public entry fun deactivate_campaign(
        campaign: &mut Campaign,
        _cap: &CampaignCap,
        _ctx: &mut TxContext,
    ) {
        campaign.is_active = false;
    }

    // ─── View helpers ─────────────────────────────────────────────────────────

    public fun get_walrus_blob_id(campaign: &Campaign): &String {
        &campaign.walrus_blob_id
    }

    public fun get_amount_raised(campaign: &Campaign): u64 {
        campaign.amount_raised
    }

    public fun is_active(campaign: &Campaign): bool {
        campaign.is_active
    }
}
