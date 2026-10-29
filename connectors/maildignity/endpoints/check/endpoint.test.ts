import { assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import {
    liveSkip,
    loadFixture,
    runEndpoint,
    testSealedUnit,
} from "@shared/testing";

const ID = "maildignity#check";
const chains = fromFileUrl(new URL("../../fixtures/", import.meta.url));

Deno.test(`${ID} happy pass (synthetic): one credit, verdict PASS`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${chains}synthetic-check-pass.json`);
    const result = await runEndpoint({
        unit,
        input: {
            body: {
                email_text:
                    "Hi Alex,\n\nI saw your recent post about sales outreach. Would you be open to a quick exchange next week?\n\nBest,\nEnrico",
                mode: "full",
            },
        },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);
    assertEquals(result.usage, {
        credits: { default: 1 },
        evidence: { CALL: 1 },
    });
    assertEquals(result.output, fixture.calls[0].res.body);
});

Deno.test(`${ID} happy review with issues (synthetic): one credit, verdict REVIEW, repaired_body returned`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${chains}synthetic-check-review.json`);
    const result = await runEndpoint({
        unit,
        input: {
            body: {
                email_text:
                    "Hey Alex, let's talk Tuesday at 2pm. I know you're struggling with lead gen.",
                mode: "full",
            },
        },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);
    assertEquals(result.usage, {
        credits: { default: 1 },
        evidence: { CALL: 1 },
    });
    assertEquals(result.output, fixture.calls[0].res.body);
});

Deno.test(`${ID} provider error (synthetic 401): zero usage`, async () => {
    const unit = await testSealedUnit(ID);
    const result = await runEndpoint({
        unit,
        input: {
            body: {
                email_text: "Test email draft",
                mode: "full",
            },
        },
        mode: "replay",
        fixture: await loadFixture(`${chains}synthetic-unauthorized.json`),
    });
    assertEquals(result.httpStatus, 401);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    assertEquals(result.output, {
        message: "Invalid or missing API key",
        raw: { error: "Invalid or missing API key" },
    });
});

Deno.test(`${ID} schema gate: accepts valid email_text and rejects invalid inputs`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${chains}synthetic-check-pass.json`);

    // Passing near-twin: valid email_text without mode is accepted
    const validRun = await runEndpoint({
        unit,
        input: {
            body: {
                email_text:
                    "Hi Alex,\n\nI saw your recent post about sales outreach. Would you be open to a quick exchange next week?\n\nBest,\nEnrico",
            },
        },
        mode: "replay",
        fixture,
    });
    assertEquals(validRun.httpStatus, 200);

    // Rejection assertions
    await assertRejects(
        () =>
            runEndpoint({
                unit,
                input: { body: {} },
                mode: "replay",
                fixture,
            }),
        Error,
        "INVALID_INPUT",
    );
    await assertRejects(
        () =>
            runEndpoint({
                unit,
                input: { body: { email_text: "" } },
                mode: "replay",
                fixture,
            }),
        Error,
        "INVALID_INPUT",
    );
    await assertRejects(
        () =>
            runEndpoint({
                unit,
                input: {
                    body: { email_text: "hello", mode: "invalid_mode" },
                },
                mode: "replay",
                fixture,
            }),
        Error,
        "INVALID_INPUT",
    );
    await assertRejects(
        () =>
            runEndpoint({
                unit,
                input: {
                    body: { email_text: "hello", unknown_key: true },
                },
                mode: "replay",
                fixture,
            }),
        Error,
        "INVALID_INPUT",
    );
});

Deno.test({
    name: `${ID} live (gated on MAILDIGNITY_API_KEY)`,
    ignore: liveSkip("maildignity"),
    fn: async () => {
        const unit = await testSealedUnit(ID);
        const result = await runEndpoint({
            unit,
            input: {
                body: {
                    email_text: "Hello, checking in.",
                    mode: "fast",
                },
            },
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        const output = result.output as Record<string, unknown>;
        assertEquals(typeof output.verdict, "string");
    },
});
