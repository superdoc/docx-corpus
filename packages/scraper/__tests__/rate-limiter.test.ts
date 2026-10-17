import { describe, expect, test } from "bun:test";
import { createRateLimiter } from "../rate-limiter";

const limiterAt = (rps: number) => createRateLimiter({ initialRps: rps, minRps: rps, maxRps: rps });

describe("createRateLimiter", () => {
  test("waits when tokens exhausted", async () => {
    const rate = 2;
    const limiter = limiterAt(rate);

    // Consume all tokens
    await limiter.acquire();
    await limiter.acquire();

    // Next call should wait
    const start = Date.now();
    await limiter.acquire();
    const elapsed = Date.now() - start;

    // Should wait approximately 500ms (1/2 second for 2 req/sec)
    expect(elapsed).toBeGreaterThanOrEqual(400);
    expect(elapsed).toBeLessThan(700);
  });

  test("handles fractional rates", async () => {
    const limiter = limiterAt(0.5); // 0.5 tokens/sec = 1 request per 2 seconds
    // Initial tokens = 0.5, so first call needs to wait for 1 token
    // Wait time = (1 - 0.5) / 0.5 * 1000 = 1000ms

    const start = Date.now();
    await limiter.acquire();
    const elapsed = Date.now() - start;

    // Should wait approximately 1 second
    expect(elapsed).toBeGreaterThanOrEqual(900);
    expect(elapsed).toBeLessThan(1200);
  });

  test("wait time followed by immediate due to refill", async () => {
    const rate = 5; // 5 per second = 200ms per token
    const limiter = limiterAt(rate);

    // Exhaust all tokens
    for (let i = 0; i < rate; i++) {
      await limiter.acquire();
    }

    // First call after exhaustion waits ~200ms
    // After waiting, the next call sees elapsed time from the wait,
    // which refills tokens, making it (nearly) immediate
    const start = Date.now();
    await limiter.acquire(); // waits ~200ms
    await limiter.acquire(); // refill from wait time makes this fast
    const elapsed = Date.now() - start;

    // Should wait approximately 200ms total (first wait + fast second)
    expect(elapsed).toBeGreaterThanOrEqual(150);
    expect(elapsed).toBeLessThan(400);
  });

  test("tracks success and error stats", () => {
    const limiter = limiterAt(100);

    limiter.reportSuccess();
    limiter.reportSuccess();
    limiter.reportError(503);

    const stats = limiter.getStats();
    expect(stats.successCount).toBe(2);
    expect(stats.errorCount).toBe(1);
  });

  test("reduces RPS on 503 errors", async () => {
    const limiter = createRateLimiter({
      initialRps: 100,
      minRps: 10,
      maxRps: 200,
      backoffFactor: 0.5,
    });

    expect(limiter.getCurrentRps()).toBe(100);

    limiter.reportError(503);
    expect(limiter.getCurrentRps()).toBe(50);

    limiter.reportError(503);
    expect(limiter.getCurrentRps()).toBe(25);

    // Shouldn't go below minRps
    limiter.reportError(503);
    limiter.reportError(503);
    expect(limiter.getCurrentRps()).toBeGreaterThanOrEqual(10);
  });

  test("increases RPS after success streak", () => {
    const limiter = createRateLimiter({
      initialRps: 50,
      minRps: 10,
      maxRps: 200,
      recoveryFactor: 2,
      successStreakThreshold: 5,
    });

    expect(limiter.getCurrentRps()).toBe(50);

    // Report 5 successes to trigger recovery
    for (let i = 0; i < 5; i++) {
      limiter.reportSuccess();
    }

    expect(limiter.getCurrentRps()).toBe(100);
  });

  test("resets success streak on error", () => {
    const limiter = createRateLimiter({
      initialRps: 50,
      minRps: 10,
      maxRps: 200,
      successStreakThreshold: 5,
    });

    // Report 3 successes
    for (let i = 0; i < 3; i++) {
      limiter.reportSuccess();
    }

    // Error resets streak
    limiter.reportError(500);

    // Report 4 more successes (total 4, not 7)
    for (let i = 0; i < 4; i++) {
      limiter.reportSuccess();
    }

    // Should not have increased yet (need 5 consecutive)
    expect(limiter.getCurrentRps()).toBe(50);
  });
});
