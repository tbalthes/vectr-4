import {
  validatePlannerRequests,
  checkPlannerQuota,
} from "../src/lib/analytics/validate-planner";

describe("validatePlannerRequests", () => {
  it("parses valid planner output and filters unknown endpoints", () => {
    const raw = {
      requests: [
        { endpoint: "aggregator", params: { range: "30d", namesOnly: false } },
        { endpoint: "unknown", params: { foo: "bar" } },
      ],
    };

    const out = validatePlannerRequests(raw);
    expect(out.length).toBe(1);
    expect(out[0].endpoint).toBe("aggregator");
    expect(out[0].params.range).toBe("30d");
    expect(out[0].params.namesOnly).toBe(false);
  });

  it("coerces string booleans and numbers", () => {
    const raw = {
      requests: [
        { endpoint: "categories", params: { namesOnly: "true", range: 7 } },
      ],
    };
    const out = validatePlannerRequests(raw);
    expect(out.length).toBe(1);
    expect(out[0].params.namesOnly).toBe(true);
    expect(out[0].params.range).toBe("7");
  });
});

describe("checkPlannerQuota", () => {
  it("enforces a simple rate limit", () => {
    const key = "test-key";
    // call up to 6 times allowed
    for (let i = 0; i < 6; i++) {
      const res = checkPlannerQuota(key);
      expect(res.allowed).toBe(true);
    }
    const over = checkPlannerQuota(key);
    expect(over.allowed).toBe(false);
  });
});
