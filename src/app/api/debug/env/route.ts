import { NextRequest, NextResponse } from "next/server";
import fs from "fs";

// Temporary diagnostics: verify DB path & volume mount inside the container.
export async function GET(_req: NextRequest) {
  const dbPath = process.env.ACTIVITY_DB_PATH || "(unset)";
  const dir = dbPath.replace(/\/[^/]+$/, "");
  let dirInfo = "unreachable";
  try {
    const entries = fs.readdirSync(dir);
    dirInfo = entries.join(",") || "(empty)";
  } catch (e) {
    dirInfo = `error: ${String(e)}`;
  }
  return NextResponse.json({
    cwd: process.cwd(),
    dbPath,
    dir,
    dirInfo,
    exists: fs.existsSync(dbPath),
  });
}
