export type BygramMusicTrack = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  durationSeconds: number;
  artworkUrl?: string;
  audioUrl: string;
  mimeType: string;
};

export type BygramMusicAlbum = {
  id: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  trackCount: number;
  tracks: BygramMusicTrack[];
};

export type BygramMusicSearch = {
  tracks: BygramMusicTrack[];
  albums: BygramMusicAlbum[];
};

export type BygramMusicPlaylist = {
  id: string;
  name: string;
  type: 'favorites' | 'daily' | 'custom';
  ownerTelegramUserId: string;
  ownerDisplayName?: string;
  trackIds: string[];
  tracks: BygramMusicTrack[];
  shareCode?: string;
  isOwn: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BygramMusicHome = {
  daily: BygramMusicTrack[];
  wave: BygramMusicTrack[];
  recent: BygramMusicTrack[];
  favorites: BygramMusicTrack[];
  playlists: BygramMusicPlaylist[];
  librarySize: number;
};

export type BygramMusicPlay = {
  id: string;
  track: BygramMusicTrack;
  streamUrl: string;
};
