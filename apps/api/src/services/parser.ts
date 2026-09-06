/**
MIT License

Copyright (c) 2020 Erick Almeida (https://github.com/Erick2280)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 */

import { SpotifyService } from 'services/spotify';
import type { PlaybackData, Track } from 'types';

export class ParserService {
  spotifyService: SpotifyService;

  constructor() {
    this.spotifyService = new SpotifyService();
  }

  async parseTrack(playbackData: PlaybackData): Promise<Track | null> {
    // Based on the implementation of https://github.com/web-scrobbler/web-scrobbler/blob/master/src/core/content/util.js

    const removeStrings = [
      '(official)',
      '(music video)',
      '(lyric video)',
      'videoclipe oficial',
      'official music video',
      '(official music)',
      '(official video)',
      '(official audio)',
      '(videoclip)',
      '(videoclipe)',
      '(video)',
      '(audio)',
      'm/v',
      ' mv',
      'clipe oficial',
      'color coded',
      'audio only',
      'ft.',
      'feat.',
      '…',
    ];
    const removeChars = ['-', '&', ',', '(', ')', '"', "'"];
    const spotifyTrackIdRegExp =
      /(?<=spotify:track:|open\.spotify\.com\/track\/|)[a-zA-Z0-9]{22}/;
    const youtubeTitleRegExps = [
      // Artist "Track", Artist: "Track", Artist - "Track", etc.
      {
        pattern: /(.+?)([\s:—-])+\s*"(.+?)"/,
        groups: { artist: 1, track: 3 },
      },
      // Artist「Track」 (Japanese tracks)
      {
        pattern: /(.+?)「(.+?)」/,
        groups: { artist: 1, track: 2 },
      },
      // Track (... by Artist)
      {
        pattern: /(\w[\s\w]*?)\s+by\s+([\w\s]+)$/,
        groups: { artist: 2, track: 1 },
      },
    ];

    // If it has an Spotify URL, request data from Spotify
    const spotifyTrackIdMatch =
      playbackData?.url?.match(spotifyTrackIdRegExp)?.[0];

    if (spotifyTrackIdMatch) {
      try {
        return await this.spotifyService.getTrack(spotifyTrackIdMatch);
      } catch (error: unknown) {
        throw new Error('SpotifyRequestUnknownError', { cause: error });
      }
    }

    let filteredTitle = playbackData.title.toLowerCase();

    // Remove [genre] or 【genre】 from the beginning of the title
    filteredTitle = filteredTitle.replace(
      /^((\[[^\]]+])|(【[^】]+】))\s*-*\s*/i,
      '',
    );

    // Remove track (CD and vinyl) numbers from the beginning of the title
    filteredTitle = filteredTitle.replace(
      /^\s*([a-zA-Z]{1,2}|[0-9]{1,2})[1-9]?\.\s+/i,
      '',
    );

    // Remove common strings on title
    for (const string of removeStrings) {
      filteredTitle = filteredTitle.replace(string, '');
    }

    // Try to match one of the regexps
    for (const regExp of youtubeTitleRegExps) {
      const artistTrack = filteredTitle.match(regExp.pattern);
      if (artistTrack) {
        filteredTitle = `${artistTrack[regExp.groups.artist]} ${artistTrack[regExp.groups.track]}`;
        break;
      }
    }

    // Remove certain chars after regexps matching
    for (const string of removeChars) {
      filteredTitle = filteredTitle.split(string).join(' ');
    }

    try {
      return (await this.spotifyService.searchTrack(
        filteredTitle,
        'full',
      )) as Track;
    } catch (error: unknown) {
      console.error(error);
    }

    return null;

    // TODO: Allow disable scrobbling for tracks not provided by Spotify
  }
}
