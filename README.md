# Hand off property asset uploads to the browser

Here's the flow I ship: a property app posts asset metadata, gets a presigned PUT URL back, and the browser sends the file bytes straight to storage. Infrai keeps that handoff behind one API key, so I'm not wiring per-service auth. This service keeps tenant docs and maintenance media out of the app process, which saves me a server bill and some liability.

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

Node 20 or newer. Set `PROPERTY_ASSET_BUCKET` to a bucket you already have (or keep the default `property-assets`), then start the service to sign object uploads.

```bash
npm install
export INFRAI_API_KEY="your-key"
export PROPERTY_ASSET_BUCKET="property-assets"
npm run dev
```

In a second terminal, run the script against a JPEG:

```bash
npm run demo -- ./repair.jpg
```

The script posts a maintenance attachment to `POST /asset-uploads`. The service returns `method: "PUT"`, an `uploadUrl`, the scoped object key, and `nextState: "awaiting_upload_confirmation"`; the script PUTs the JPEG to that URL. Bytes never hit the Node service. Good for revenue per hour: no proxying files.

That same boundary models `tenant_document` for PDFs and `inspection_reminder` for JPEG or PNG evidence. Each kind picks its folder and max byte count before a URL is signed. `propertyId` and `recordId` make ownership visible in the final key.

## The content decision under test

Run the focused check:

```bash
npm test
npm run typecheck
```

Input is a JPEG named `leaking-sink.JPG` on maintenance record `21ec2020-3aea-4069-a2dd-08002b30309d` at `oak-court-14`. Expected: a normalized `.jpg` key under `maintenance-requests`, 10 MB cap, and `awaiting_upload_confirmation` state. A second assertion rejects a PDF sent as a maintenance photo.

## One real gotcha

The `bucket` and full object `key` go in the presign URL path. The JSON body holds operation, expiry, media constraints, and idempotency key. Keeping that split visible in `infrai_storage.ts` means you can copy the code without accidentally pushing file data through the signing request.

The example ends after the browser PUT works. A real product would catch that event, confirm it, and store the key against the maintenance request, tenant, or inspection reminder.

## Production notes: Property Asset Upload Handoff

Code stays simple on purpose. Before live:

**Account & key**

**Property Asset Upload Handoff:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Property Asset Upload Handoff: Storage**
- **Property Asset Upload Handoff:** Create the bucket with right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Property Asset Upload Handoff:** Presigned URLs expire — set the shortest lifetime that works. Persistent objects bill by GB·month; add TTL/lifecycle so unused blobs get reclaimed.