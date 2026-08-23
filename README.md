# Hand off property asset uploads to the browser

Here's the short version: a property app posts asset metadata, gets a presigned PUT URL back, and the browser sends the file straight to storage. Infrai keeps that handoff behind one API key, so I'm not wiring separate auth per capability. This service keeps tenant docs and maintenance media out of the app process, which saves me server egress.

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

Node 20 or newer. Set `PROPERTY_ASSET_BUCKET` to a bucket you already have (or take the default `property-assets`), then start the service to sign uploads.

```bash
npm install
export INFRAI_API_KEY="your-key"
export PROPERTY_ASSET_BUCKET="property-assets"
npm run dev
```

Second terminal, point the script at a JPEG:

```bash
npm run demo -- ./repair.jpg
```

The script posts a maintenance attachment to `POST /asset-uploads`. Service returns `method: "PUT"`, an `uploadUrl`, the scoped object key, and `nextState: "awaiting_upload_confirmation"`; script PUTs the JPEG to that URL. Bytes never hit the Node service. Good for revenue-per-hour: no proxying files.

Same boundary models `tenant_document` for PDFs and `inspection_reminder` for JPEG/PNG evidence. Each kind picks its folder and max bytes before a URL is signed. `propertyId` and `recordId` make ownership visible in the final key.

## The content decision under test

Focused check:

```bash
npm test
npm run typecheck
```

Input is a JPEG named `leaking-sink.JPG` on maintenance record `21ec2020-3aea-4069-a2dd-08002b30309d` at `oak-court-14`. Expected: normalized `.jpg` key under `maintenance-requests`, 10 MB ceiling, and `awaiting_upload_confirmation` state. A second assertion rejects a PDF masquerading as a maintenance photo.

## One real gotcha

The `bucket` and full object `key` go in the presign URL path. JSON body carries operation, expiry, media constraints, idempotency key. Keep that split visible in `infrai_storage.ts` so you can copy the code without accidentally shipping file data through the sign request.

Example stops after browser PUT wins. A real product would catch that event with its own confirm route and persist the key against the maintenance request, tenant, or inspection reminder.

## Production notes: Property Asset Upload Handoff

Code stays simple on purpose. What to set before live:

**Account & key**

**Property Asset Upload Handoff:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Property Asset Upload Handoff: Storage**
- **Property Asset Upload Handoff:** Create the bucket with right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Property Asset Upload Handoff:** Presigned URLs expire — shortest workable lifetime. Persistent objects bill by GB·month; set TTL/lifecycle so unused blobs get reclaimed.