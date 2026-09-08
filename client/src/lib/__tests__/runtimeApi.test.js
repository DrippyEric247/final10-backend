import { apiPath, composeApiUrl } from "../runtimeApi";

describe("runtimeApi apiPath", () => {
  const priorApiUrl = process.env.REACT_APP_API_URL;

  afterEach(() => {
    if (priorApiUrl == null) delete process.env.REACT_APP_API_URL;
    else process.env.REACT_APP_API_URL = priorApiUrl;
  });

  test("strips duplicate /api prefix for axios-relative paths", () => {
    expect(apiPath("/api/savvy-core-proof/bootstrap")).toBe("/savvy-core-proof/bootstrap");
    expect(apiPath("savvy-core-proof/bootstrap")).toBe("/savvy-core-proof/bootstrap");
    expect(apiPath("/savvy-core-proof")).toBe("/savvy-core-proof");
  });

  test("composeApiUrl emits exactly one /api segment", () => {
    process.env.REACT_APP_API_URL = "https://final10-backend-production.up.railway.app/api";
    expect(composeApiUrl("/api/savvy-core-proof/bootstrap")).toBe(
      "https://final10-backend-production.up.railway.app/api/savvy-core-proof/bootstrap"
    );
  });

  test("composeApiUrl adds /api when base env is host-only", () => {
    process.env.REACT_APP_API_URL = "https://api.final10.app";
    expect(composeApiUrl("savvy-core-proof/bootstrap")).toBe(
      "https://api.final10.app/api/savvy-core-proof/bootstrap"
    );
  });
});
