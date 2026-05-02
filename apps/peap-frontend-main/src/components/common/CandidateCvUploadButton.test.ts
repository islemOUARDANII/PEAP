import { describe, expect, it } from "vitest";

import { demoCvUploadSteps, getDemoCvUploadStep } from "@/services/candidate/demoCvSession";

describe("demoCvUploadSteps", () => {
  it("keeps the expected fake progress checkpoints", () => {
    expect(demoCvUploadSteps.map((step) => step.progress)).toEqual([0, 25, 55, 80, 100]);
  });

  it("returns the expected step metadata", () => {
    expect(getDemoCvUploadStep("uploading").label).toBe("Uploading CV...");
    expect(getDemoCvUploadStep("structuring").label).toBe("Structuring profile...");
    expect(getDemoCvUploadStep("done").progress).toBe(100);
  });
});
