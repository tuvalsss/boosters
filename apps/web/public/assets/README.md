# Asset Folder

Production-safe default visuals live in:

```text
assets/
  brand-packs/   Original Boosters pack artwork
  brand-campaign/ AI-generated fictional Boosters campaign imagery
  sample-prizes/ Temporary local card-listing samples for demo fallback
```

The legacy `packs/` and `cards/` PNG folders are kept only for backward
compatibility with older branches. Current UI defaults use original Boosters
pack assets and pack-specific `coverImageUrl` values from the admin pack editor.

Prize-card imagery must come from real vaulted card photos or imported eBay
listing image URLs. Do not use generated card art as a prize fallback.

The `sample-prizes/` slabs are temporary seeded examples for local demos before
eBay credentials are configured. Replace them with real eBay/imported vault
photos before production launch.

For third-party pack themes, upload or reference licensed artwork in the admin
panel instead of committing unlicensed logos, characters, or brand art.
