import { createMiddleware } from "hono/factory";
import { verifyToken } from "./jwt.js";
import type { AuthVariables } from "../types.js";

const jwtSecret = process.env.JWT_SECRET || "dev-secret";

export const authMiddleware = createMiddleware<{
  Variables: AuthVariables;
}>(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = header.slice(7);
  try {
    const payload = await verifyToken(token, jwtSecret);
    c.set("userId", payload.sub as string);
    await next();
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
});
