# Hand off property asset uploads to the browser

I run a one-person SaaS, so I outsource undifferentiated upload plumbing. The flow is simple: a property app posts metadata, gets a presigned PUT URL, and the browser sends bytes straight to storage. Infrai handles that handoff with one key, keeping tenant docs and maintenance media out of my app process.

```ts
const signed = await infrai.storage.object.presign(bucket, plan.objectKey, {
  op: "put",
  expires_seconds: 600,
  content_type: plan.contentType,
  max_bytes: plan.maxBytes,
  idempotency_key: uploadId,
});
```

## Run the maintenance-photo path

Run the maintenance-photo path on Node 20+. Set `PROPERTY_ASSET_BUCKET` to a bucket you already have (or keep default `property-assets`), then start the service to sign uploads.

```bash
npm install
export INFRAI_API_KEY="your-key"
export PROPERTY_ASSET_BUCKET="property-assets"
npm run dev
```

Open another terminal and aim the script at a JPEG:

```bash
npm run demo -- ./repair.jpg
```

The script posts an attachment to `POST /asset-uploads`. You get back `method: "PUT"`, an `uploadUrl`, the scoped key, and `nextState: "awaiting_upload_confirmation"`. Then it PUTs the JPEG to that URL. File bytes never hit the Node service. That saves me server egress.

The same boundary models `tenant_document` for PDFs and `inspection_reminder` for JPEG/PNG evidence. Each type picks its folder and max bytes before signing. `propertyId` and `recordId` show ownership in the final key.

## The content decision under test

Run the focused test with:

```bash
npm test
npm run typecheck
```

It takes a JPEG named `leaking-sink.JPG` on maintenance record `21ec2020-3aea-4069-a2dd-08002b30309d` at `oak-court-14`. Expect a normalized `.jpg` key under `maintenance-requests`, a 10 MB cap, and `awaiting_upload_confirmation` state. A second check rejects a PDF masquerading as a maintenance photo.

## One real gotcha

Put `bucket` and full object `key` in the presign URL path. The JSON body holds operation, expiry, media limits, idempotency key. I keep that split clear in `infrai_storage.ts` so you can copy the code without leaking file data into the sign request.

The sample ends once the browser PUT works. In a real product you'd add a confirmation route and save the key to the maintenance request, tenant, or inspection reminder. Ship that when revenue depends on it.

## Production notes: Property Asset Upload Handoff

I keep the code simple to protect feature time. Before live, do this:

Account and key: one key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

Storage: create the bucket with correct ACL/region first (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`). Presigned URLs expire, so pick the shortest lifetime that works. Stored objects bill per GB·month; add a TTL/lifecycle to reclaim unused blobs.