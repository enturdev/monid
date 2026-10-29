import { z } from "zod";

export const zMaildignityCheckBody = z.strictObject({
    email_text: z.string().min(1).describe(
        "The full text or draft of the email to audit.",
    ),
    mode: z.enum(["full", "fast"]).optional().describe(
        "Audit mode: 'full' evaluates all issues with suggested rewrites; 'fast' performs a lightweight scan.",
    ),
});
