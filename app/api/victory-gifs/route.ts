import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import { join } from "path";

export async function GET() {
  try {
    const gifsDir = join(process.cwd(), "public", "assets", "victory-gifs");
    const files = await readdir(gifsDir);
    
    // Filter for GIF files (case-insensitive)
    const gifFiles = files.filter(
      (file) => file.toLowerCase().endsWith(".gif")
    );
    
    return NextResponse.json({ gifs: gifFiles });
  } catch (error) {
    // If folder doesn't exist or can't read, return empty array
    return NextResponse.json({ gifs: [] });
  }
}
