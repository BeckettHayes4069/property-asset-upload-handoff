import assert from "node:assert/strict";
import test from "node:test";
import { planAssetUpload, uploadRequestSchema } from "../src/upload_policy.js";

test("a maintenance photo is routed to its request and awaits confirmation", () => {
  const input = uploadRequestSchema.parse({
    propertyId: "oak-court-14",
    recordId: "21ec2020-3aea-4069-a2dd-08002b30309d",
    assetKind: "maintenance_photo",
    fileName: "leaking-sink.JPG",
    contentType: "image/jpeg",
  });
  const plan = planAssetUpload(input);

  assert.deepEqual(plan, {
    objectKey: "properties/oak-court-14/maintenance-requests/21ec2020-3aea-4069-a2dd-08002b30309d.jpg",
    contentType: "image/jpeg",
    maxBytes: 10_000_000,
    nextState: "awaiting_upload_confirmation",
  });
});

test("a PDF cannot be attached as a maintenance photo", () => {
  const input = uploadRequestSchema.parse({
    propertyId: "oak-court-14",
    recordId: "21ec2020-3aea-4069-a2dd-08002b30309d",
    assetKind: "maintenance_photo",
    fileName: "invoice.pdf",
    contentType: "application/pdf",
  });
  assert.throws(() => planAssetUpload(input), /does not accept application\/pdf/);
});
