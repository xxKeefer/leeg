export function extractReplayId(url: string): string | null {
  const match = url.match(/(?:https?:\/\/)?replay\.pokemonshowdown\.com\/([^/\s]+)\/?$/);
  return match ? match[1] : null;
}

export async function fetchReplayProtocol(replayUrl: string): Promise<string> {
  const replayId = extractReplayId(replayUrl);
  if (!replayId) {
    throw new Error("Invalid replay URL");
  }

  const response = await fetch(`https://replay.pokemonshowdown.com/${replayId}.json`);
  if (!response.ok) {
    throw new Error(`Failed to fetch replay: ${response.status}`);
  }

  const data = await response.json();
  if (!data.log) {
    throw new Error("No protocol log found in replay data");
  }

  return data.log as string;
}
