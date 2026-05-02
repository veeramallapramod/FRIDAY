// modules/spotify.js
// Uses Spotify Web API — requires SPOTIFY_ACCESS_TOKEN in environment
// Token can be obtained via OAuth flow (setup guide in README)

const BASE_URL = 'https://api.spotify.com/v1';

function getToken() {
  return process.env.SPOTIFY_ACCESS_TOKEN || null;
}

async function spotifyFetch(endpoint, method = 'GET', body = null) {
  const token = getToken();
  if (!token) {
    throw new Error(
      'Spotify not configured. Add SPOTIFY_ACCESS_TOKEN to your environment. See README for OAuth setup.'
    );
  }

  const options = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${BASE_URL}${endpoint}`, options);

  if (response.status === 204) return { success: true };
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Spotify API error: ${response.status} — ${err}`);
  }

  return response.json();
}

async function spotifyControl(action, params = {}) {
  switch (action) {
    case 'current': {
      const data = await spotifyFetch('/me/player/currently-playing');
      if (!data || !data.item) return { playing: false, track: null };
      return {
        playing: data.is_playing,
        track: data.item.name,
        artist: data.item.artists.map((a) => a.name).join(', '),
        album: data.item.album.name,
      };
    }

    case 'pause': {
      await spotifyFetch('/me/player/pause', 'PUT');
      return { action: 'paused' };
    }

    case 'play': {
      if (params.query) {
        // Search first, then play
        const search = await spotifyFetch(
          `/search?q=${encodeURIComponent(params.query)}&type=track&limit=1`
        );
        const track = search.tracks?.items?.[0];
        if (!track) return { error: 'Track not found' };

        await spotifyFetch('/me/player/play', 'PUT', {
          uris: [track.uri],
        });

        return {
          action: 'playing',
          track: track.name,
          artist: track.artists.map((a) => a.name).join(', '),
        };
      } else {
        await spotifyFetch('/me/player/play', 'PUT');
        return { action: 'resumed' };
      }
    }

    case 'skip': {
      await spotifyFetch('/me/player/next', 'POST');
      return { action: 'skipped' };
    }

    case 'previous': {
      await spotifyFetch('/me/player/previous', 'POST');
      return { action: 'previous' };
    }

    case 'search': {
      const results = await spotifyFetch(
        `/search?q=${encodeURIComponent(params.query)}&type=track,artist&limit=5`
      );
      return {
        tracks: results.tracks?.items?.map((t) => ({
          name: t.name,
          artist: t.artists[0]?.name,
          uri: t.uri,
        })),
      };
    }

    default:
      throw new Error(`Unknown Spotify action: ${action}`);
  }
}

module.exports = { spotifyControl };
