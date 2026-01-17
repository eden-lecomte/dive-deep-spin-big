// Utility to get a random victory GIF from the assets folder
// Add GIF files to public/assets/victory-gifs/ and they will be automatically available

let cachedGifs: string[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 60000; // Cache for 1 minute

/**
 * Fetch available victory GIFs from the API
 */
async function fetchVictoryGifs(): Promise<string[]> {
  try {
    const response = await fetch("/api/victory-gifs");
    const data = await response.json();
    return data.gifs || [];
  } catch (error) {
    console.error("Failed to fetch victory GIFs:", error);
    return [];
  }
}

/**
 * Get available victory GIFs (with caching)
 */
async function getAvailableGifs(): Promise<string[]> {
  const now = Date.now();
  
  // Return cached if still valid
  if (cachedGifs && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedGifs;
  }
  
  // Fetch fresh list
  cachedGifs = await fetchVictoryGifs();
  cacheTimestamp = now;
  return cachedGifs;
}

/**
 * Get a random victory GIF path
 * Returns null if no GIFs are available
 */
export async function getRandomVictoryGif(): Promise<string | null> {
  const gifs = await getAvailableGifs();
  
  if (gifs.length === 0) {
    return null;
  }
  
  const randomIndex = Math.floor(Math.random() * gifs.length);
  const filename = gifs[randomIndex];
  return `/assets/victory-gifs/${filename}`;
}

/**
 * Get all available victory GIF paths
 */
export async function getAllVictoryGifs(): Promise<string[]> {
  const gifs = await getAvailableGifs();
  return gifs.map(filename => `/assets/victory-gifs/${filename}`);
}
