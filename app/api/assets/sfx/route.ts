import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import { join } from "path";

const SFX_EXTENSIONS = [".mp3", ".ogg", ".wav", ".m4a", ".mp4"];

export async function GET() {
  try {
    const dir = join(process.cwd(), "public", "assets", "sfx");
    const files = await readdir(dir);
    const sounds = files.filter((file) =>
      SFX_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext))
    );
    return NextResponse.json({ files: sounds });
  } catch {
    return NextResponse.json({ files: [] });
  }
}
