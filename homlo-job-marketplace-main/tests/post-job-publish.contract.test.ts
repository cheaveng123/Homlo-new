import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "app/employer/post-job.tsx"), "utf8").replace(
  /\r\n/g,
  "\n",
);

describe("post-job banner publishing", () => {
  it("saves a bannerless draft before converting and uploading the banner", () => {
    const draft = source.indexOf("toSaveInput(d, 'draft', { bannerImage: '' })");
    const convert = source.indexOf("pickerImageToJpegDataUrl({ uri: d.photoUri })");
    const upload = source.indexOf("uploadJobImage(draftId, image)");
    const open = source.indexOf("toSaveInput(d, 'open', { bannerImage, jobId: draftId })");

    expect(draft).toBeGreaterThan(-1);
    expect(convert).toBeGreaterThan(draft);
    expect(upload).toBeGreaterThan(convert);
    expect(open).toBeGreaterThan(upload);
  });

  it("tracks the draft id before upload so discard can clean it up", () => {
    const track = source.indexOf("setSavedDraftId(draftId)");
    const upload = source.indexOf("uploadJobImage(draftId, image)");

    expect(track).toBeGreaterThan(-1);
    expect(track).toBeLessThan(upload);
    expect(source).toContain("if (savedDraftId && !published)");
    expect(source).toContain("deleteJob.mutateAsync({ jobId: savedDraftId })");
  });

  it("publishes without the banner and alerts when the upload fails", () => {
    expect(source).toContain("bannerUploadFailed = true");
    expect(source).toContain("bannerImage = ''");
    expect(source).toContain("toSaveInput(d, 'open', { bannerImage, jobId: draftId })");
    expect(source).toContain("Published without a photo");
  });

  it("never persists the local picker URI and covers the full form", () => {
    expect(source).toContain("bannerImage: options?.bannerImage ?? ''");
    expect(source).not.toContain("bannerImage: d.photoUri");
    expect(source).toContain("...StyleSheet.absoluteFill,");
    expect(source).not.toContain("absoluteFillObject");
  });
});
