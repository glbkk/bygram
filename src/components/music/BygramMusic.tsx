import { memo, useEffect, useMemo, useRef, useState } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { BygramMusicQueueSource } from '../../api/bygram/musicPlayer';
import type {
  BygramMusicAlbum, BygramMusicHome, BygramMusicPlaylist, BygramMusicSearch, BygramMusicTrack,
} from '../../api/bygram/musicTypes';
import type { ApiAttachment } from '../../api/types';
import type { MenuItemContextAction } from '../ui/ListItem';
import { MAIN_THREAD_ID } from '../../api/types';
import { LeftColumnContent } from '../../types';

import { takePendingPlaylistTrack } from '../../api/bygram/byprotoMusic';
import { bygramMusicPlayer } from '../../api/bygram/musicPlayer';
import { bygramMusicApi } from '../../api/bygram/serverlessMusic';
import { createByProtoMusicPlaylistEnvelope, createByProtoMusicTrackEnvelope } from '../../byproto/outgoing';
import buildAttachment from '../middle/composer/helpers/buildAttachment';

import useBygramMusicPlayer from '../../hooks/useBygramMusicPlayer';
import useDebouncedCallback from '../../hooks/useDebouncedCallback';
import useLastCallback from '../../hooks/useLastCallback';

import Icon from '../common/icons/Icon';
import RecipientPicker from '../common/RecipientPicker';
import Button from '../ui/Button';
import InputText from '../ui/InputText';
import ListItem from '../ui/ListItem';
import Modal from '../ui/Modal';
import SearchInput from '../ui/SearchInput';
import Spinner from '../ui/Spinner';

import styles from './BygramMusic.module.scss';

type MusicView = 'discover' | 'library';
type PlayerState = ReturnType<typeof useBygramMusicPlayer>;

function BygramMusic() {
  const { openLeftColumnContent, sendMessage } = getActions();
  const player = useBygramMusicPlayer();
  const [home, setHome] = useState<BygramMusicHome | undefined>(() => bygramMusicApi.getCachedMusicHome());
  const [isHomeLoading, setIsHomeLoading] = useState(() => !bygramMusicApi.getCachedMusicHome());
  const [view, setView] = useState<MusicView>('discover');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BygramMusicSearch>();
  const [isSearching, setIsSearching] = useState(false);
  const [isTrackWaveLoading, setIsTrackWaveLoading] = useState(false);
  const [isAlbumLoading, setIsAlbumLoading] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set(
    bygramMusicApi.getCachedMusicHome()?.favorites.map((track) => track.id) || [],
  ));
  const [selectedPlaylist, setSelectedPlaylist] = useState<BygramMusicPlaylist>();
  const [selectedAlbum, setSelectedAlbum] = useState<BygramMusicAlbum>();
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [trackToAdd, setTrackToAdd] = useState<BygramMusicTrack>();
  const [trackForNewPlaylist, setTrackForNewPlaylist] = useState<BygramMusicTrack>();
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [pendingShare, setPendingShare] = useState<{
    track?: BygramMusicTrack;
    playlist?: BygramMusicPlaylist;
    attachments?: ApiAttachment[];
  }>();
  const [shareTrackCandidate, setShareTrackCandidate] = useState<BygramMusicTrack>();
  const [sharePlaylistCandidate, setSharePlaylistCandidate] = useState<BygramMusicPlaylist>();
  const [isPreparingShareFile, setIsPreparingShareFile] = useState(false);
  const searchRequestIdRef = useRef(0);

  const applyHome = useLastCallback((nextHome: BygramMusicHome) => {
    setHome(nextHome);
    const nextLikedIds = new Set(nextHome.favorites.map((track) => track.id));
    setLikedIds(nextLikedIds);
    bygramMusicPlayer.syncLikedIds(nextLikedIds);
    setSelectedPlaylist((current) => current?.isOwn
      ? nextHome.playlists.find((playlist) => playlist.id === current.id) || current
      : current);
  });

  const loadHome = useLastCallback(async () => {
    try {
      await bygramMusicApi.ensureSession();
      const nextHome = await bygramMusicApi.getMusicHome();
      applyHome(nextHome);
      setError(undefined);
    } catch {
      if (!home) setError('Не удалось открыть музыку. Проверьте сеть и попробуйте снова');
    } finally {
      setIsHomeLoading(false);
    }
  });

  useEffect(() => {
    void loadHome();
    const pendingTrack = takePendingPlaylistTrack();
    if (pendingTrack) {
      setView('library');
      setTrackToAdd(pendingTrack);
    }
    const shareCode = new URLSearchParams(window.location.search).get('bygramPlaylist');
    if (shareCode) {
      setView('library');
      void bygramMusicApi.ensureSession()
        .then(() => bygramMusicApi.getSharedMusicPlaylist(shareCode))
        .then(setSelectedPlaylist)
        .catch(() => setError('Общий плейлист не найден'));
    }
  }, []);

  const close = useLastCallback(() => {
    openLeftColumnContent({ contentKey: LeftColumnContent.ChatList });
  });

  const runSearch = useLastCallback(async (rawQuery: string) => {
    const trimmed = rawQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults(undefined);
      setIsSearching(false);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    const cached = bygramMusicApi.getCachedMusicSearch(trimmed);
    if (cached?.tracks.length) {
      setSelectedAlbum(undefined);
      setSearchResults(cached);
      setIsSearching(false);
    } else {
      setIsSearching(true);
    }

    setError(undefined);
    try {
      const results = await bygramMusicApi.searchMusic(trimmed);
      if (requestId !== searchRequestIdRef.current) return;
      setSelectedAlbum(undefined);
      setSearchResults(results);
    } catch {
      if (requestId !== searchRequestIdRef.current) return;
      if (!cached?.tracks.length) setError('Не удалось найти треки. Попробуйте ещё раз');
    } finally {
      if (requestId === searchRequestIdRef.current) setIsSearching(false);
    }
  });

  const debouncedSearch = useDebouncedCallback((value: string) => {
    void runSearch(value);
  }, [runSearch], 350, true);

  const handleQueryChange = useLastCallback((value: string) => {
    setQuery(value);
    if (value.trim().length < 2) {
      searchRequestIdRef.current += 1;
      setSearchResults(undefined);
      setSelectedAlbum(undefined);
      setIsSearching(false);
      return;
    }
    debouncedSearch(value);
  });

  const playTrack = useLastCallback((
    track: BygramMusicTrack,
    source: BygramMusicQueueSource,
    queue: BygramMusicTrack[],
  ) => {
    void bygramMusicPlayer.play(track, source, queue);
  });

  const openAlbum = useLastCallback(async (album: BygramMusicAlbum) => {
    if (album.tracks.length && !album.id.startsWith('sc-playlist:')) {
      setSelectedAlbum(album);
      return;
    }
    if (album.tracks.length && album.id.startsWith('sc-playlist:')) {
      setSelectedAlbum(album);
    }
    setIsAlbumLoading(true);
    setError(undefined);
    try {
      const resolved = await bygramMusicApi.getMusicAlbum(album.id);
      setSelectedAlbum(resolved || album);
    } catch {
      setError('Не удалось загрузить треки альбома');
    } finally {
      setIsAlbumLoading(false);
    }
  });

  const toggleLike = useLastCallback(async (track: BygramMusicTrack) => {
    const liked = !likedIds.has(track.id);
    const next = new Set(likedIds);
    if (liked) next.add(track.id);
    else next.delete(track.id);
    setLikedIds(next);
    bygramMusicPlayer.reflectLiked(track.id, liked);
    try {
      await bygramMusicApi.setMusicLiked(track.id, liked);
      void loadHome();
    } catch {
      setLikedIds(likedIds);
      bygramMusicPlayer.reflectLiked(track.id, !liked);
    }
  });

  const createPlaylist = useLastCallback(async () => {
    if (!newPlaylistName.trim()) return;
    try {
      let playlist = await bygramMusicApi.createMusicPlaylist(newPlaylistName.trim());
      if (trackForNewPlaylist) {
        playlist = await bygramMusicApi.updateMusicPlaylist(playlist.id, trackForNewPlaylist.id, true);
      }
      setNewPlaylistName('');
      setTrackForNewPlaylist(undefined);
      setIsCreatePlaylistOpen(false);
      setView('library');
      setSelectedPlaylist(playlist);
      await loadHome();
    } catch {
      setError('Не удалось создать плейлист');
    }
  });

  const addTrackToPlaylist = useLastCallback(async (playlist: BygramMusicPlaylist) => {
    if (!trackToAdd) return;
    try {
      await bygramMusicApi.updateMusicPlaylist(playlist.id, trackToAdd.id, true);
      setNotice(`Добавлено в «${playlist.name}»`);
      setTrackToAdd(undefined);
      await loadHome();
    } catch {
      setError('Не удалось добавить трек');
    }
  });

  const removeTrackFromPlaylist = useLastCallback(async (
    playlist: BygramMusicPlaylist,
    track: BygramMusicTrack,
  ) => {
    try {
      const updated = await bygramMusicApi.updateMusicPlaylist(playlist.id, track.id, false);
      setSelectedPlaylist(updated);
      setNotice(`Удалено из «${playlist.name}»`);
      await loadHome();
    } catch {
      setError('Не удалось удалить трек из плейлиста');
    }
  });

  const sharePlaylist = useLastCallback((playlist: BygramMusicPlaylist) => {
    setSharePlaylistCandidate(playlist);
  });

  const sharePlaylistAsFiles = useLastCallback(async () => {
    if (!sharePlaylistCandidate?.tracks.length) return;
    setIsPreparingShareFile(true);
    setError(undefined);
    try {
      await bygramMusicApi.ensureSession();
      const files = await bygramMusicApi.downloadMusicPlaylist(sharePlaylistCandidate);
      const attachments = await Promise.all(
        files.map((file) => buildAttachment(file.name, file)),
      );
      setPendingShare({ playlist: sharePlaylistCandidate, attachments });
      setSharePlaylistCandidate(undefined);
    } catch {
      setError('Не удалось подготовить файлы плейлиста');
    } finally {
      setIsPreparingShareFile(false);
    }
  });

  const sharePlaylistAsByProto = useLastCallback(() => {
    if (!sharePlaylistCandidate?.trackIds.length) return;
    setPendingShare({ playlist: sharePlaylistCandidate });
    setSharePlaylistCandidate(undefined);
  });

  const saveSharedPlaylist = useLastCallback(async (playlist: BygramMusicPlaylist) => {
    if (!playlist.shareCode) return;
    try {
      const saved = await bygramMusicApi.saveSharedMusicPlaylist(playlist.shareCode);
      setSelectedPlaylist(saved);
      setNotice('Плейлист добавлен в вашу медиатеку');
      const url = new URL(window.location.href);
      url.searchParams.delete('bygramPlaylist');
      window.history.replaceState(undefined, '', url);
      await loadHome();
    } catch {
      setError('Не удалось сохранить плейлист');
    }
  });

  const shareTrack = useLastCallback((track: BygramMusicTrack) => {
    setShareTrackCandidate(track);
  });

  const shareTrackAsFile = useLastCallback(async () => {
    if (!shareTrackCandidate) return;
    setIsPreparingShareFile(true);
    setError(undefined);
    try {
      await bygramMusicApi.ensureSession();
      const file = await bygramMusicApi.downloadMusicTrack(shareTrackCandidate);
      const attachment = await buildAttachment(file.name, file);
      setPendingShare({ track: shareTrackCandidate, attachments: [attachment] });
      setShareTrackCandidate(undefined);
    } catch {
      setError('Не удалось подготовить файл трека');
    } finally {
      setIsPreparingShareFile(false);
    }
  });

  const shareTrackAsByProto = useLastCallback(() => {
    if (!shareTrackCandidate) return;
    setPendingShare({ track: shareTrackCandidate });
    setShareTrackCandidate(undefined);
  });

  const startTrackWave = useLastCallback(async (track: BygramMusicTrack) => {
    setIsTrackWaveLoading(true);
    try {
      const wave = await bygramMusicApi.getMusicTrackWave(track.id);
      bygramMusicPlayer.replaceQueue('track-wave', wave);
      if (!player.isPlaying) bygramMusicPlayer.toggle();
      setNotice(`Волна по «${track.title}»`);
    } catch {
      setError('Не удалось построить волну');
    } finally {
      setIsTrackWaveLoading(false);
    }
  });

  const sendSharedContent = useLastCallback((chatId: string, threadId = MAIN_THREAD_ID) => {
    if (!pendingShare) return;
    const { track, playlist, attachments } = pendingShare;

    if (attachments?.length) {
      const caption = track
        ? [
          `🎵 ${track.artist} — ${track.title}`,
          'Отправлено с помощью bygram',
          'https://glbkk.github.io/bygram',
        ].join('\n')
        : [
          `🎵 Плейлист «${playlist?.name || 'bygramMusic'}» · ${attachments.length} треков`,
          'Отправлено с помощью bygram',
          'https://glbkk.github.io/bygram',
        ].join('\n');
      sendMessage({
        messageList: { chatId, threadId, type: 'thread' },
        text: caption,
        attachments,
      });
      setNotice(track ? 'Музыкальный файл отправляется' : 'Файлы плейлиста отправляются');
      setPendingShare(undefined);
      return;
    }

    if (playlist) {
      try {
        sendMessage({
          messageList: { chatId, threadId, type: 'thread' },
          text: `🎵 Плейлист «${playlist.name}» · ${playlist.trackIds.length} треков\nОткрыть в bygramMusic`,
          byProtoEnvelope: createByProtoMusicPlaylistEnvelope({
            name: playlist.name,
            trackIds: playlist.trackIds,
          }),
        });
        setNotice('Плейлист bygramMusic отправляется');
      } catch {
        setError('Плейлист слишком большой для bygram proto');
      }
      setPendingShare(undefined);
      return;
    }

    if (track) {
      sendMessage({
        messageList: { chatId, threadId, type: 'thread' },
        text: `🎵 ${track.artist} — ${track.title}\nОткрыть в bygramMusic`,
        byProtoEnvelope: createByProtoMusicTrackEnvelope({
          id: track.id,
          title: track.title,
          artist: track.artist,
          album: track.album,
          genre: track.genre,
          durationSeconds: track.durationSeconds,
          artworkUrl: track.artworkUrl,
          audioUrl: track.audioUrl,
          mimeType: track.mimeType,
        }),
      });
      setNotice('Трек bygramMusic отправляется');
    }
    setPendingShare(undefined);
  });

  const visibleSections = useMemo(() => {
    if (!home) return [];
    return [
      { key: 'daily' as const, title: 'Плейлист дня', tracks: home.daily },
      { key: 'wave' as const, title: 'Моя волна', tracks: home.wave },
      { key: 'recent' as const, title: 'Недавно', tracks: home.recent },
      { key: 'favorites' as const, title: 'Любимые', tracks: home.favorites },
    ].filter((section) => section.tracks.length > 0);
  }, [home]);

  const isSearchMode = Boolean(query.trim().length >= 2 || searchResults);

  return (
    <main id="BygramMusic" className={styles.root}>
      <header className={styles.header}>
        <Button round color="translucent" iconName="arrow-left" ariaLabel="Назад к чатам" onClick={close} />
        <div className={styles.heading}>
          <strong className={styles.headingTitle}>Музыка</strong>
        </div>
        <nav className={styles.tabs} aria-label="Разделы музыки">
          <button
            type="button"
            className={view === 'discover' ? styles.activeTab : undefined}
            onClick={() => {
              setView('discover');
              setSelectedPlaylist(undefined);
            }}
          >
            Для вас
          </button>
          <button
            type="button"
            className={view === 'library' ? styles.activeTab : undefined}
            onClick={() => {
              setView('library');
              setSelectedPlaylist(undefined);
            }}
          >
            Медиатека
          </button>
        </nav>
      </header>

      <div className={styles.searchBar}>
        <SearchInput
          value={query}
          isLoading={isSearching}
          placeholder="Поиск треков и альбомов"
          onChange={handleQueryChange}
          onEnter={() => void runSearch(query)}
          onReset={() => {
            searchRequestIdRef.current += 1;
            setQuery('');
            setSearchResults(undefined);
            setSelectedAlbum(undefined);
            setIsSearching(false);
          }}
        />
      </div>

      <div className={styles.content}>
        {notice && (
          <button type="button" className={styles.notice} onClick={() => setNotice(undefined)}>
            {notice}
          </button>
        )}
        {error && <div className={styles.error}>{error}</div>}

        {isAlbumLoading && !selectedAlbum ? (
          <div className={styles.loader}><Spinner /></div>
        ) : selectedAlbum ? (
          <AlbumDetails
            album={selectedAlbum}
            player={player}
            likedIds={likedIds}
            onBack={() => setSelectedAlbum(undefined)}
            onPlay={playTrack}
            onToggleLike={toggleLike}
            onAddToPlaylist={setTrackToAdd}
            onShareTrack={shareTrack}
            onStartWave={startTrackWave}
          />
        ) : isSearchMode ? (
          isSearching && !searchResults ? (
            <div className={styles.loader}>
              <Spinner />
              <span>Ищем в bygramMusic…</span>
            </div>
          ) : searchResults && (searchResults.tracks.length || searchResults.albums.length) ? (
            <>
              {searchResults.albums.length > 0 && (
                <AlbumSearchResults albums={searchResults.albums} onOpen={openAlbum} />
              )}
              {searchResults.tracks.length > 0 && (
                <MusicSection
                  title="Треки"
                  tracks={searchResults.tracks}
                  source="search"
                  likedIds={likedIds}
                  player={player}
                  onPlay={playTrack}
                  onToggleLike={toggleLike}
                  onAddToPlaylist={setTrackToAdd}
                  onShareTrack={shareTrack}
                  onStartWave={startTrackWave}
                />
              )}
            </>
          ) : (
            <EmptyState title="Ничего не найдено" text="Попробуйте другое название или исполнителя" />
          )
        ) : view === 'library' ? (
          selectedPlaylist ? (
            <PlaylistDetails
              playlist={selectedPlaylist}
              player={player}
              likedIds={likedIds}
              onBack={() => setSelectedPlaylist(undefined)}
              onPlay={playTrack}
              onShare={sharePlaylist}
              onSave={saveSharedPlaylist}
              onToggleLike={toggleLike}
              onAddToPlaylist={setTrackToAdd}
              onRemoveTrack={removeTrackFromPlaylist}
              onShareTrack={shareTrack}
              onStartWave={startTrackWave}
            />
          ) : (
            <PlaylistLibrary
              playlists={home?.playlists || []}
              onCreate={() => setIsCreatePlaylistOpen(true)}
              onOpen={setSelectedPlaylist}
              onShare={sharePlaylist}
            />
          )
        ) : isHomeLoading && !home ? (
          <div className={styles.loader}><Spinner /></div>
        ) : (
          <>
            {visibleSections.map((section) => (
              section.key === 'daily' || section.key === 'wave' ? (
                <MusicShelf
                  key={section.key}
                  title={section.title}
                  tracks={section.tracks}
                  source={section.key}
                  likedIds={likedIds}
                  player={player}
                  onPlay={playTrack}
                  onToggleLike={toggleLike}
                  onAddToPlaylist={setTrackToAdd}
                  onShareTrack={shareTrack}
                  onStartWave={startTrackWave}
                />
              ) : (
                <MusicSection
                  key={section.key}
                  title={section.title}
                  tracks={section.tracks}
                  source={section.key}
                  likedIds={likedIds}
                  player={player}
                  onPlay={playTrack}
                  onToggleLike={toggleLike}
                  onAddToPlaylist={setTrackToAdd}
                  onShareTrack={shareTrack}
                  onStartWave={startTrackWave}
                />
              )
            ))}
            {home && visibleSections.length === 0 && (
              <EmptyState title="Найдите первую песню" text="Введите название в поиск сверху" />
            )}
          </>
        )}
      </div>

      {player.track && (
        <MiniPlayer
          player={player}
          isLiked={likedIds.has(player.track.id)}
          isWaveLoading={isTrackWaveLoading}
          onToggleLike={toggleLike}
          onAddToPlaylist={setTrackToAdd}
          onStartWave={startTrackWave}
        />
      )}

      <Modal
        isOpen={isCreatePlaylistOpen}
        title="Новый плейлист"
        hasCloseButton
        onClose={() => {
          setIsCreatePlaylistOpen(false);
          setTrackForNewPlaylist(undefined);
        }}
        onEnter={createPlaylist}
      >
        <div className={styles.modalBody}>
          <InputText
            value={newPlaylistName}
            label="Название"
            maxLength={80}
            autoFocus
            onChange={(event) => setNewPlaylistName(event.currentTarget.value)}
          />
          <Button fluid disabled={!newPlaylistName.trim()} onClick={createPlaylist}>Создать</Button>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(trackToAdd)}
        title="Добавить в плейлист"
        hasCloseButton
        onClose={() => setTrackToAdd(undefined)}
      >
        <div className={styles.playlistPicker}>
          {(home?.playlists || []).map((playlist) => (
            <button key={playlist.id} type="button" onClick={() => void addTrackToPlaylist(playlist)}>
              <PlaylistCover playlist={playlist} />
              <span>
                <strong>{playlist.name}</strong>
                <small>{`${playlist.tracks.length} треков`}</small>
              </span>
              <Icon name="next" />
            </button>
          ))}
          <Button
            fluid
            color="translucent"
            iconName="add"
            onClick={() => {
              setTrackForNewPlaylist(trackToAdd);
              setTrackToAdd(undefined);
              setIsCreatePlaylistOpen(true);
            }}
          >
            Новый плейлист
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(shareTrackCandidate)}
        title="Поделиться треком"
        hasCloseButton
        onClose={() => setShareTrackCandidate(undefined)}
      >
        <div className={styles.modalBody}>
          <p className={styles.shareHint}>
            {shareTrackCandidate
              ? `${shareTrackCandidate.artist} — ${shareTrackCandidate.title}`
              : ''}
          </p>
          <Button
            fluid
            iconName="download"
            isLoading={isPreparingShareFile}
            onClick={() => void shareTrackAsFile()}
          >
            Отправить как файл
          </Button>
          <Button
            fluid
            color="primary"
            onClick={shareTrackAsByProto}
          >
            Отправить через bygram
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(sharePlaylistCandidate)}
        title="Поделиться плейлистом"
        hasCloseButton
        onClose={() => setSharePlaylistCandidate(undefined)}
      >
        <div className={styles.modalBody}>
          <p className={styles.shareHint}>
            {sharePlaylistCandidate
              ? `«${sharePlaylistCandidate.name}» · ${sharePlaylistCandidate.tracks.length} треков`
              : ''}
          </p>
          <Button
            fluid
            iconName="download"
            isLoading={isPreparingShareFile}
            disabled={!sharePlaylistCandidate?.tracks.length}
            onClick={() => void sharePlaylistAsFiles()}
          >
            Отправить файлами песен
          </Button>
          <Button
            fluid
            color="primary"
            disabled={!sharePlaylistCandidate?.trackIds.length}
            onClick={sharePlaylistAsByProto}
          >
            Отправить через bygram
          </Button>
        </div>
      </Modal>

      <RecipientPicker
        isOpen={Boolean(pendingShare)}
        title={pendingShare?.attachments?.length
          ? (pendingShare.track ? 'Отправить файл' : 'Отправить файлы')
          : 'Отправить в bygram'}
        searchPlaceholder="Поиск чатов"
        onSelectRecipient={sendSharedContent}
        onClose={() => setPendingShare(undefined)}
      />
    </main>
  );
}

function MiniPlayer({
  player, isLiked, isWaveLoading, onToggleLike, onAddToPlaylist, onStartWave,
}: {
  player: PlayerState;
  isLiked: boolean;
  isWaveLoading: boolean;
  onToggleLike: (track: BygramMusicTrack) => void;
  onAddToPlaylist: (track: BygramMusicTrack) => void;
  onStartWave: (track: BygramMusicTrack) => void;
}) {
  const track = player.track!;
  return (
    <section className={styles.miniPlayer}>
      <div className={styles.miniRow}>
        <button type="button" className={styles.miniMain} onClick={() => bygramMusicPlayer.toggle()}>
          <TrackArtwork track={track} />
          <span className={styles.meta}>
            <strong>{track.title}</strong>
            <span>{track.artist}</span>
          </span>
        </button>
        <div className={styles.miniControls}>
          <Button
            className={styles.miniBtn}
            round
            color="translucent"
            size="smaller"
            iconName={isLiked ? 'heart' : 'heart-outline'}
            ariaLabel="Избранное"
            onClick={() => onToggleLike(track)}
          />
          <Button
            className={styles.miniBtn}
            round
            color="translucent"
            size="smaller"
            iconName="add"
            ariaLabel="В плейлист"
            onClick={() => onAddToPlaylist(track)}
          />
          <Button
            className={styles.miniBtn}
            round
            color="translucent"
            size="smaller"
            iconName="diamond"
            ariaLabel="Волна"
            isLoading={isWaveLoading}
            onClick={() => onStartWave(track)}
          />
          <Button
            className={styles.miniBtn}
            round
            color="translucent"
            size="smaller"
            iconName="skip-previous"
            ariaLabel="Назад"
            onClick={() => void bygramMusicPlayer.previous()}
          />
          <Button
            className={`${styles.miniBtn} ${styles.miniPlay}`}
            round
            ariaLabel={player.isPlaying ? 'Пауза' : 'Играть'}
            onClick={() => bygramMusicPlayer.toggle()}
          >
            {player.isLoading ? <Spinner /> : <Icon name={player.isPlaying ? 'pause' : 'play'} />}
          </Button>
          <Button
            className={styles.miniBtn}
            round
            color="translucent"
            size="smaller"
            iconName="skip-next"
            ariaLabel="Далее"
            onClick={() => void bygramMusicPlayer.next()}
          />
        </div>
      </div>
      <input
        className={styles.miniProgress}
        type="range"
        min="0"
        max={Math.max(1, player.duration)}
        value={Math.min(player.position, player.duration)}
        aria-label="Позиция"
        onChange={(event) => bygramMusicPlayer.seekTo(Number(event.currentTarget.value))}
      />
      {player.error && <span className={styles.playerError}>{player.error}</span>}
    </section>
  );
}

function PlaylistLibrary({ playlists, onCreate, onOpen, onShare }: {
  playlists: BygramMusicPlaylist[];
  onCreate: NoneToVoidFunction;
  onOpen: (playlist: BygramMusicPlaylist) => void;
  onShare: (playlist: BygramMusicPlaylist) => void;
}) {
  return (
    <section className={styles.library}>
      <div className={styles.libraryHeader}>
        <h2>Плейлисты</h2>
        <Button round color="translucent" size="smaller" iconName="add" ariaLabel="Создать" onClick={onCreate} />
      </div>
      {playlists.length ? (
        <div className={styles.playlistGrid}>
          {playlists.map((playlist) => (
            <div key={playlist.id} className={styles.playlistCard}>
              <button type="button" className={styles.playlistCardMain} onClick={() => onOpen(playlist)}>
                <PlaylistCover playlist={playlist} />
                <strong>{playlist.name}</strong>
                <span>{`${playlist.tracks.length} треков`}</span>
              </button>
              {playlist.isOwn && (
                <Button
                  className={styles.playlistShare}
                  round
                  color="translucent"
                  size="tiny"
                  iconName="share-filled"
                  ariaLabel="Поделиться плейлистом"
                  onClick={() => onShare(playlist)}
                />
              )}
            </div>
          ))}
        </div>
      ) : <EmptyState title="Пока пусто" text="Создайте плейлист или добавьте трек из поиска" />}
    </section>
  );
}

function PlaylistDetails({
  playlist, player, likedIds, onBack, onPlay, onShare, onSave, onToggleLike, onAddToPlaylist, onRemoveTrack,
  onShareTrack, onStartWave,
}: {
  playlist: BygramMusicPlaylist;
  player: PlayerState;
  likedIds: Set<string>;
  onBack: NoneToVoidFunction;
  onPlay: (track: BygramMusicTrack, source: BygramMusicQueueSource, queue: BygramMusicTrack[]) => void;
  onShare: (playlist: BygramMusicPlaylist) => void;
  onSave: (playlist: BygramMusicPlaylist) => void;
  onToggleLike: (track: BygramMusicTrack) => void;
  onAddToPlaylist: (track: BygramMusicTrack) => void;
  onRemoveTrack: (playlist: BygramMusicPlaylist, track: BygramMusicTrack) => void;
  onShareTrack: (track: BygramMusicTrack) => void;
  onStartWave: (track: BygramMusicTrack) => void;
}) {
  return (
    <section className={styles.playlistDetails}>
      <div className={styles.playlistHero}>
        <Button round color="translucent" iconName="arrow-left" ariaLabel="Назад" onClick={onBack} />
        <PlaylistCover playlist={playlist} large />
        <div className={styles.playlistHeroMeta}>
          <h2>{playlist.name}</h2>
          <p>{`${playlist.tracks.length} треков`}</p>
          <div className={styles.heroActions}>
            {playlist.tracks.length > 0 && (
              <Button
                round
                ariaLabel="Слушать"
                onClick={() => onPlay(playlist.tracks[0], 'playlist', playlist.tracks)}
              >
                <Icon name="play" />
              </Button>
            )}
            {playlist.isOwn ? (
              <Button
                round
                color="translucent"
                iconName="share-filled"
                ariaLabel="Поделиться"
                onClick={() => onShare(playlist)}
              />
            ) : (
              <Button
                round
                color="translucent"
                iconName="add"
                ariaLabel="Сохранить"
                onClick={() => onSave(playlist)}
              />
            )}
          </div>
        </div>
      </div>
      {playlist.tracks.length ? (
        <MusicSection
          title="Треки"
          tracks={playlist.tracks}
          source="playlist"
          likedIds={likedIds}
          player={player}
          onPlay={onPlay}
          onToggleLike={onToggleLike}
          onAddToPlaylist={onAddToPlaylist}
          onRemoveFromPlaylist={playlist.isOwn ? (track) => onRemoveTrack(playlist, track) : undefined}
          onShareTrack={onShareTrack}
          onStartWave={onStartWave}
        />
      ) : <EmptyState title="Плейлист пуст" text="Добавьте песни из поиска" />}
    </section>
  );
}

function AlbumSearchResults({ albums, onOpen }: {
  albums: BygramMusicAlbum[];
  onOpen: (album: BygramMusicAlbum) => void;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}><h2>Альбомы и плейлисты</h2></div>
      <div className={styles.shelfScroll}>
        {albums.map((album) => (
          <button key={album.id} type="button" className={styles.shelfCard} onClick={() => onOpen(album)}>
            <AlbumArtwork album={album} />
            <strong className={styles.shelfTitle}>{album.title}</strong>
            <span className={styles.shelfArtist}>{album.artist}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function AlbumDetails({
  album, player, likedIds, onBack, onPlay, onToggleLike, onAddToPlaylist, onShareTrack, onStartWave,
}: {
  album: BygramMusicAlbum;
  player: PlayerState;
  likedIds: Set<string>;
  onBack: NoneToVoidFunction;
  onPlay: (track: BygramMusicTrack, source: BygramMusicQueueSource, queue: BygramMusicTrack[]) => void;
  onToggleLike: (track: BygramMusicTrack) => void;
  onAddToPlaylist: (track: BygramMusicTrack) => void;
  onShareTrack: (track: BygramMusicTrack) => void;
  onStartWave: (track: BygramMusicTrack) => void;
}) {
  return (
    <section className={styles.playlistDetails}>
      <div className={styles.playlistHero}>
        <Button round color="translucent" iconName="arrow-left" ariaLabel="Назад" onClick={onBack} />
        <AlbumArtwork album={album} large />
        <div className={styles.playlistHeroMeta}>
          <h2>{album.title}</h2>
          <p>{`${album.artist} · ${album.trackCount} треков`}</p>
          {album.tracks.length > 0 && (
            <div className={styles.heroActions}>
              <Button round ariaLabel="Слушать" onClick={() => onPlay(album.tracks[0], 'album', album.tracks)}>
                <Icon name="play" />
              </Button>
            </div>
          )}
        </div>
      </div>
      {album.tracks.length ? (
        <MusicSection
          title="Треки"
          tracks={album.tracks}
          source="album"
          likedIds={likedIds}
          player={player}
          onPlay={onPlay}
          onToggleLike={onToggleLike}
          onAddToPlaylist={onAddToPlaylist}
          onShareTrack={onShareTrack}
          onStartWave={onStartWave}
        />
      ) : <EmptyState title="Треки не найдены" text="Попробуйте открыть ещё раз" />}
    </section>
  );
}

function MusicSection({
  title, tracks, source, likedIds, player, onPlay, onToggleLike, onAddToPlaylist,
  onRemoveFromPlaylist, onShareTrack, onStartWave,
}: {
  title: string;
  tracks: BygramMusicTrack[];
  source: BygramMusicQueueSource;
  likedIds: Set<string>;
  player: PlayerState;
  onPlay: (track: BygramMusicTrack, source: BygramMusicQueueSource, queue: BygramMusicTrack[]) => void;
  onToggleLike: (track: BygramMusicTrack) => void;
  onAddToPlaylist: (track: BygramMusicTrack) => void;
  onRemoveFromPlaylist?: (track: BygramMusicTrack) => void;
  onShareTrack: (track: BygramMusicTrack) => void;
  onStartWave: (track: BygramMusicTrack) => void;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>{title}</h2>
        {tracks.length > 1 && (
          <Button
            round
            color="translucent"
            size="smaller"
            iconName="play"
            ariaLabel="Слушать всё"
            onClick={() => onPlay(tracks[0], source, tracks)}
          />
        )}
      </div>
      <div className={styles.trackList}>
        {tracks.map((track, index) => (
          <TrackRow
            key={track.id}
            index={index + 1}
            track={track}
            isCurrent={player.track?.id === track.id}
            isPlaying={player.track?.id === track.id && player.isPlaying}
            isLoading={player.track?.id === track.id && player.isLoading}
            isLiked={likedIds.has(track.id)}
            onPlay={() => onPlay(track, source, tracks)}
            onToggleLike={() => onToggleLike(track)}
            onAddToPlaylist={() => onAddToPlaylist(track)}
            onRemoveFromPlaylist={onRemoveFromPlaylist ? () => onRemoveFromPlaylist(track) : undefined}
            onShareTrack={() => onShareTrack(track)}
            onStartWave={() => onStartWave(track)}
          />
        ))}
      </div>
    </section>
  );
}

function MusicShelf({
  title, tracks, source, likedIds, player, onPlay, onToggleLike, onAddToPlaylist,
}: {
  title: string;
  tracks: BygramMusicTrack[];
  source: BygramMusicQueueSource;
  likedIds: Set<string>;
  player: PlayerState;
  onPlay: (track: BygramMusicTrack, source: BygramMusicQueueSource, queue: BygramMusicTrack[]) => void;
  onToggleLike: (track: BygramMusicTrack) => void;
  onAddToPlaylist: (track: BygramMusicTrack) => void;
  onShareTrack: (track: BygramMusicTrack) => void;
  onStartWave: (track: BygramMusicTrack) => void;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>{title}</h2>
        <Button
          round
          color="translucent"
          size="smaller"
          iconName="play"
          ariaLabel="Слушать"
          onClick={() => onPlay(tracks[0], source, tracks)}
        />
      </div>
      <div className={styles.shelfScroll}>
        {tracks.map((track) => {
          const isCurrent = player.track?.id === track.id;
          return (
            <article key={track.id} className={`${styles.shelfCard} ${isCurrent ? styles.activeShelfCard : ''}`}>
              <button type="button" className={styles.shelfPlay} onClick={() => onPlay(track, source, tracks)}>
                <TrackArtwork track={track} />
                <span className={styles.shelfPlayIcon}>
                  <Icon name={isCurrent && player.isPlaying ? 'pause' : 'play'} />
                </span>
              </button>
              <strong className={styles.shelfTitle}>{track.title}</strong>
              <span className={styles.shelfArtist}>{track.artist}</span>
              <div className={styles.shelfActions}>
                <Button
                  round
                  color="translucent"
                  size="tiny"
                  iconName={likedIds.has(track.id) ? 'heart' : 'heart-outline'}
                  ariaLabel="Избранное"
                  onClick={() => onToggleLike(track)}
                />
                <Button
                  round
                  color="translucent"
                  size="tiny"
                  iconName="more"
                  ariaLabel="Ещё"
                  onClick={() => onAddToPlaylist(track)}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TrackRow({
  index, track, isCurrent, isPlaying, isLoading, isLiked,
  onPlay, onToggleLike, onAddToPlaylist, onRemoveFromPlaylist, onShareTrack, onStartWave,
}: {
  index: number;
  track: BygramMusicTrack;
  isCurrent: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  isLiked: boolean;
  onPlay: NoneToVoidFunction;
  onToggleLike: NoneToVoidFunction;
  onAddToPlaylist: NoneToVoidFunction;
  onRemoveFromPlaylist?: NoneToVoidFunction;
  onShareTrack: NoneToVoidFunction;
  onStartWave: NoneToVoidFunction;
}) {
  const contextActions = useMemo((): MenuItemContextAction[] => {
    const actions: MenuItemContextAction[] = [
      {
        title: isLiked ? 'Убрать из любимых' : 'В любимые',
        icon: isLiked ? 'heart' : 'heart-outline',
        handler: onToggleLike,
      },
      { title: 'В плейлист', icon: 'add', handler: onAddToPlaylist },
      { title: 'Волна по треку', icon: 'diamond', handler: onStartWave },
      { title: 'Отправить в чат', icon: 'share-filled', handler: onShareTrack },
    ];
    if (onRemoveFromPlaylist) {
      actions.push({
        title: 'Удалить из плейлиста',
        icon: 'delete',
        destructive: true,
        handler: onRemoveFromPlaylist,
      });
    }
    return actions;
  }, [isLiked, onAddToPlaylist, onRemoveFromPlaylist, onShareTrack, onStartWave, onToggleLike]);

  const trackIndexContent = (() => {
    if (!isCurrent) return index;
    if (isLoading) return <Spinner />;
    return <Icon name={isPlaying ? 'pause' : 'play'} />;
  })();

  return (
    <ListItem
      className={`${styles.trackItem} ${isCurrent ? styles.activeTrack : ''}`}
      ripple
      narrow
      multiline
      leftElement={(
        <span className={styles.trackLeft}>
          <span className={styles.trackIndex}>
            {trackIndexContent}
          </span>
          <TrackArtwork track={track} />
        </span>
      )}
      rightElement={<span className={styles.duration}>{formatDuration(track.durationSeconds)}</span>}
      secondaryIcon="more"
      contextActions={contextActions}
      onClick={onPlay}
    >
      <div className={styles.trackText}>
        <strong>{track.title}</strong>
        <span>{track.artist}</span>
      </div>
    </ListItem>
  );
}

function PlaylistCover({ playlist, large = false }: { playlist: BygramMusicPlaylist; large?: boolean }) {
  const artworkUrl = playlist.tracks.find((track) => track.artworkUrl)?.artworkUrl;
  return (
    <span
      className={`${styles.playlistCover} ${large ? styles.largeCover : ''}`}
      style={`--artwork-hue: ${trackHue(playlist.id)}`}
    >
      {artworkUrl ? <img src={artworkUrl} alt="" draggable={false} /> : <Icon name="record-play" />}
    </span>
  );
}

function TrackArtwork({ track, large = false }: { track: BygramMusicTrack; large?: boolean }) {
  return (
    <span
      className={`${styles.artwork} ${large ? styles.largeArtwork : ''}`}
      style={`--artwork-hue: ${trackHue(track.id)}`}
    >
      {track.artworkUrl ? <img src={track.artworkUrl} alt="" draggable={false} /> : <Icon name="record-play" />}
    </span>
  );
}

function AlbumArtwork({ album, large = false }: { album: BygramMusicAlbum; large?: boolean }) {
  return (
    <span
      className={`${styles.artwork} ${large ? styles.largeArtwork : ''}`}
      style={`--artwork-hue: ${trackHue(album.id)}`}
    >
      {album.artworkUrl ? <img src={album.artworkUrl} alt="" draggable={false} /> : <Icon name="record-play" />}
    </span>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className={styles.empty}>
      <Icon name="search" />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function trackHue(id: string) {
  return Number.parseInt(id.replace(/\D/g, '').slice(0, 4) || '12', 10) % 360;
}

function formatDuration(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

export default memo(BygramMusic);
