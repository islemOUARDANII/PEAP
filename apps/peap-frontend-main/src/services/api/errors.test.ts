import { describe, expect, it } from "vitest";

import { ApiServiceError } from "./client";
import { isMissingCandidateProfileError } from "./errors";

describe("isMissingCandidateProfileError", () => {
  it("detects the no linked candidate profile 404", () => {
    const error = new ApiServiceError(
      "No canonical candidate profile is linked to this account.",
      404,
      { detail: "No canonical candidate profile is linked to this account." },
    );

    expect(isMissingCandidateProfileError(error)).toBe(true);
  });

  it("detects the job seeker profile not found 404", () => {
    const error = new ApiServiceError(
      "JOB SEEKER PROFILE NOT FOUND",
      404,
      { detail: "JOB SEEKER PROFILE NOT FOUND" },
    );

    expect(isMissingCandidateProfileError(error)).toBe(true);
  });

  it("does not detect unrelated errors", () => {
    expect(isMissingCandidateProfileError(new ApiServiceError("Match not found", 404))).toBe(false);
    expect(isMissingCandidateProfileError(new ApiServiceError("Internal server error", 500))).toBe(false);
    expect(isMissingCandidateProfileError(new Error("No canonical candidate profile is linked to this account."))).toBe(false);
  });
});
