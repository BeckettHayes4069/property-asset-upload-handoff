import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { infrai, InfraiError } from "./infrai_storage.js";
import { planAssetUpload, uploadRequestSchema } from "./upload_policy.js";

const bucket = process.env.PROPERTY_ASSET_BUCKET ?? "property-assets";
const port = Number(process.env.PORT ?? 3000);

function json(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/asset-uploads") {
    json(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const input = uploadRequestSchema.parse(await readJson(request));
    const plan = planAssetUpload(input);
    const uploadId = randomUUID();
    const signed = await infrai.storage.object.presign(bucket, plan.objectKey, {
      op: "put",
      expires_seconds: 600,
      content_type: plan.contentType,
      max_bytes: plan.maxBytes,
      idempotency_key: uploadId,
    });
    json(response, 201, {
      uploadId,
      uploadUrl: signed.url,
      method: "PUT",
      objectKey: plan.objectKey,
      nextState: plan.nextState,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      json(response, 400, { error: "Invalid upload request", issues: error.issues });
      return;
    }
    if (error instanceof InfraiError) {
      json(response, error.status >= 400 && error.status < 500 ? error.status : 502, {
        error: error.code,
      });
      return;
    }
    json(response, 500, { error: error instanceof Error ? error.message : "Unexpected error" });
  }
});

server.listen(port, () => {
  console.log(`Property asset service listening on http://localhost:${port}`);
});
