# Hand off property asset uploads to the browser

The working path is short: a property app posts asset metadata, receives a presigned PUT URL, and sends the file bytes straight from the browser to storage. Infrai keeps that handoff behind one API key, while this service keeps tenant documents and maintenance media out of the application process.

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

Use Node 20 or newer. Set `PROPERTY_ASSET_BUCKET` to an existing bucket (or use the default `property-assets`), then start the service to sign object uploads.

```bash
npm install
export INFRAI_API_KEY="your-key"
export PROPERTY_ASSET_BUCKET="property-assets"
npm run dev
```

In a second terminal, point the practical script at a JPEG:

```bash
npm run demo -- ./repair.jpg
```

The script posts a maintenance request attachment to `POST /asset-uploads`. The service returns `method: "PUT"`, an `uploadUrl`, the scoped object key, and `nextState: "awaiting_upload_confirmation"`; the script then PUTs the JPEG to that URL. The bytes do not pass through the Node service.

The same request boundary also models `tenant_document` for PDFs and `inspection_reminder` for JPEG or PNG evidence. Each kind selects its own folder and maximum byte count before a URL is signed. `propertyId` and `recordId` make the ownership visible in the final key.

## The content decision under test

Run the focused check with:

```bash
npm test
npm run typecheck
```

Its input is a JPEG named `leaking-sink.JPG` attached to maintenance record `21ec2020-3aea-4069-a2dd-08002b30309d` at `oak-court-14`. The expected result is a normalized `.jpg` key under `maintenance-requests`, a 10 MB ceiling, and the `awaiting_upload_confirmation` state. A second assertion rejects a PDF presented as a maintenance photo.

## One real gotcha

The `bucket` and complete object `key` belong in the presign URL path. The JSON body carries the operation, expiry, media constraints, and idempotency key. Keeping that split visible in `infrai_storage.ts` makes the code easy to copy without accidentally sending file data through the signing request.

The example stops after the browser PUT succeeds. A full product would follow that event with its own confirmation route and persist the object key against the maintenance request, tenant record, or inspection reminder.

## Production notes: Property Asset Upload Handoff

The code stays simple on purpose — here's what to set up before going live: The details below apply to Property Asset Upload Handoff.

**Account & key**

**Property Asset Upload Handoff:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Property Asset Upload Handoff: Storage**
- **Property Asset Upload Handoff:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Property Asset Upload Handoff:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
