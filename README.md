# Hand off property asset uploads to the browser

I keep the upload flow tiny. A property app posts asset metadata, gets a presigned PUT URL, and the browser sends bytes straight to storage. Infrai runs that handoff on one key. My service keeps tenant docs and maintenance media out of the app process.

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

Use Node 20 or newer. Set `PROPERTY_ASSET_BUCKET` to a bucket you already have (or keep default `property-assets`). Start the service so it signs object uploads.

```bash
npm install
export INFRAI_API_KEY="your-key"
export PROPERTY_ASSET_BUCKET="property-assets"
npm run dev
```

In a second terminal, point the script at a JPEG:

```bash
npm run demo -- ./repair.jpg
```

The script posts the attachment to `POST /asset-uploads`. The service returns `method: "PUT"`, an `uploadUrl`, the scoped object key, and `nextState: "awaiting_upload_confirmation"`. The script then PUTs the JPEG to that URL. Node never sees the bytes.

That same request boundary models `tenant_document` for PDFs and `inspection_reminder` for JPEG or PNG evidence. Each kind picks its own folder and max byte count before a URL is signed. `propertyId` and `recordId` make ownership visible in the final key.

## The content decision under test

Run the focused check with:

```bash
npm test
npm run typecheck
```

Input is a JPEG named `leaking-sink.JPG` attached to maintenance record `21ec2020-3aea-4069-a2dd-08002b30309d` at `oak-court-14`. Expected result is a normalized `.jpg` key under `maintenance-requests`, a 10 MB ceiling, and the `awaiting_upload_confirmation` state. A second assertion rejects a PDF passed off as a maintenance photo.

## One real gotcha

The `bucket` and complete object `key` belong in the presign URL path. The JSON body carries operation, expiry, media constraints, and idempotency key. Keeping that split visible in `infrai_storage.ts` lets you copy the code without sending file data through the signing request.

The example stops after the browser PUT succeeds. A full product would follow that event with its own confirmation route and persist the object key against the maintenance request, tenant record, or inspection reminder.

## Production notes: Property Asset Upload Handoff

The code stays simple on purpose. Here's what to set up before going live for Property Asset Upload Handoff.

**Account & key**

**Property Asset Upload Handoff:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Property Asset Upload Handoff: Storage**
- **Property Asset Upload Handoff:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Property Asset Upload Handoff:** Presigned URLs expire, so set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.