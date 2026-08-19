import { z } from "zod";

export const uploadRequestSchema = z.object({
  propertyId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  recordId: z.string().uuid(),
  assetKind: z.enum(["maintenance_photo", "tenant_document", "inspection_reminder"]),
  fileName: z.string().min(1).max(120),
  contentType: z.string().min(1).max(100),
});

export type UploadRequest = z.infer<typeof uploadRequestSchema>;

const policies = {
  maintenance_photo: { folder: "maintenance-requests", accepts: /^image\/(jpeg|png|webp)$/, maxBytes: 10_000_000 },
  tenant_document: { folder: "tenant-documents", accepts: /^application\/pdf$/, maxBytes: 20_000_000 },
  inspection_reminder: { folder: "inspection-reminders", accepts: /^image\/(jpeg|png)$/, maxBytes: 5_000_000 },
} as const;

export function planAssetUpload(input: UploadRequest) {
  const policy = policies[input.assetKind];
  if (!policy.accepts.test(input.contentType)) {
    throw new Error(`${input.assetKind} does not accept ${input.contentType}`);
  }
  const extension = input.fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return {
    objectKey: `properties/${input.propertyId}/${policy.folder}/${input.recordId}.${extension}`,
    contentType: input.contentType,
    maxBytes: policy.maxBytes,
    nextState: "awaiting_upload_confirmation" as const,
  };
}
