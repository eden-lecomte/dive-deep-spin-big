import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import { join } from "path";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

export async function GET() {
  try {
    const dir = join(process.cwd(), "public", "assets", "images");
    const files = await readdir(dir);
    const images = files.filter((file) =>
      IMAGE_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext))
    );
    return NextResponse.json({ files: images });
  } catch {
    return NextResponse.json({ files: [] });
  }
}
