
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handler } from "./handler.ts";

Deno.test("Gemini AI Function - Unauthorized Request", async () => {
    // Mock request without Authorization header
    const req = new Request("http://localhost:8000/gemini-ai", {
        method: "POST",
        body: JSON.stringify({ action: "analyze-lead", payload: {} }),
    });

    const res = await handler(req);
    assertEquals(res.status, 401);
});

Deno.test("Gemini AI Function - OPTIONS Request", async () => {
    const req = new Request("http://localhost:8000/gemini-ai", {
        method: "OPTIONS",
    });

    const res = await handler(req);
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});
