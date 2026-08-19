import { readFile } from "node:fs/promises";

const photoPath = process.argv[2];
if (!photoPath) throw new Error("Run with a JPEG path: npm run demo -- ./repair.jpg");

const requestBody = {
  propertyId: "oak-court-14",
  recordId: "21ec2020-3aea-4069-a2dd-08002b30309d",
  assetKind: "maintenance_photo",
  fileName: photoPath.split("/").pop() ?? "repair.jpg",
  contentType: "image/jpeg",
};

const handoff = await fetch("http://localhost:3000/asset-uploads", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(requestBody),
});
if (!handoff.ok) throw new Error(await handoff.text());
const result = (await handoff.json()) as { uploadUrl: string; method: "PUT"; objectKey: string; nextState: string };

const upload = await fetch(result.uploadUrl, {
  method: result.method,
  headers: { "Content-Type": requestBody.contentType },
  body: await readFile(photoPath),
});
if (!upload.ok) throw new Error(`Upload returned ${upload.status}`);
console.log({ objectKey: result.objectKey, state: result.nextState });
