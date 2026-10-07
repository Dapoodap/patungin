import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// Pool (WebSocket) is selected because interactive transactions are needed (expenses + splits).
// Neon HTTP driver only handles single stateless queries without interactive transactions.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
