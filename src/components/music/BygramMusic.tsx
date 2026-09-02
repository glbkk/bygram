import { memo, useEffect, useMemo, useState } from '@teact';
import { getActions } from '../../global';

import type { BygramMusicQueueSource } from '../../api/bygram/musicPlayer';
import type {
  BygramMusicAlbum, BygramMusicHome, BygramMusicPlaylist, BygramMusicSearch, BygramMusicTrack,
} from '../../api/bygram/musicTypes';
import type { ApiAttachment } from '../../api/types';
import { MAIN_THREAD_ID } from '../../api/types';
import { LeftColumnContent } from '../../types';

import { copyTextToClipboard } from '../../util/clipboard';
import { bygramMusicPlayer } from '../../api/bygram/musicPlayer';
import { bygramMusicApi } from '../../api/bygram/serverlessMusic';
import buildAttachment from '../middle/composer/helpers/buildAttachment';

import useBygramMusicPlayer from '../../hooks/useBygramMusicPlayer';
import useLastCallback from '../../hooks/useLastCallback';

import Icon from '../common/icons/Icon';
import RecipientPicker from '../common/RecipientPicker';
import Button from '../ui/Button';
import InputText from '../ui/InputText';
import Modal from '../ui/Modal';
import SearchInput from '../ui/SearchInput';
import Spinner from '../ui/Spinner';

import styles from './BygramMusic.module.scss';

type MusicView = 'discover' | 'library';
type PlayerState = ReturnType<typeof useBygramMusicPlayer>;

function BygramMusic() {
  const { openLeftColumnContent, sendMessage } = getActions();
  const player = useBygramMusicPlayer();
  const [home, setHome] = useState<BygramMusicHome>();
  const [view, setView] = useState<MusicView>('discover');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BygramMusicSearch>();
  const [isSearching, setIsSearching] = useState(false);
  const [isTrackWaveLoading, setIsTrackWaveLoading] = useState(false);
  const [isAlbumLoading, setIsAlbumLoading] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set());
  const [selectedPlaylist, setSelectedPlaylist] = useState<BygramMusicPlaylist>();
  const [selectedAlbum, setSelectedAlbum] = useState<BygramMusicAlbum>();
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [trackToAdd, setTrackToAdd] = useState<BygramMusicTrack>();
  const [trackForNewPlaylist, setTrackForNewPlaylist] = useState<BygramMusicTrack>();
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [pendingShare, setPendingShare] = useState<{ track: BygramMusicTrack; attachment: ApiAttachment }>();

  const loadHome = useLastCallback(async () => {
    try {
      await bygramMusicApi.ensureSession();
      const nextHome = await bygramMusicApi.getMusicHome();
      setHome(nextHome);
      const nextLikedIds = new Set(nextHome.favorites.map((track) => track.id));
      setLikedIds(nextLikedIds);
      bygramMusicPlayer.syncLikedIds(nextLikedIds);
      setSelectedPlaylist((current) => current?.isOwn
        ? nextHome.playlists.find((playlist) => playlist.id === current.id) || current
        : current);
      setError(undefined);
    } catch {
      setError('Не удалось открыть музыку. Проверьте сеть и попробуйте снова');
    }
  });

  useEffect(() => {
    void loadHome();
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

  const search = useLastCallback(async () => {
    if (query.trim().length < 2) return;
    setIsSearching(true);
    setError(undefined);
    try {
      setSelectedAlbum(undefined);
      setSearchResults(await bygramMusicApi.searchMusic(query.trim()));
    } catch {
      setError('Не удалось найти треки в SoundCloud');
    } finally {
      setIsSearching(false);
    }
  });

  const playTrack = useLastCallback((
    track: BygramMusicTrack,
    source: BygramMusicQueueSource,
    queue: BygramMusicTrack[],
  ) => {
    void bygramMusicPlayer.play(track, source, queue);
  });

  const openAlbum = useLastCallback(async (album: BygramMusicAlbum) => {
    if (album.tracks.length) {
      setSelectedAlbum(album);
      return;
    }
    setIsAlbumLoading(true);
    setError(undefined);
    try {
      setSelectedAlbum(await bygramMusicApi.getMusicAlbum(album.id));
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

  const sharePlaylist = useLastCallback(async (playlist: BygramMusicPlaylist) => {
    try {
      const shared = await bygramMusicApi.shareMusicPlaylist(playlist.id);
      const url = new URL(window.location.href);
      url.searchParams.set('bygramPlaylist', shared.shareCode);
      const shareData = { title: shared.name, text: `Плейлист «${shared.name}» в ByGram`, url: url.toString() };
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        copyTextToClipboard(url.toString());
        setNotice('Ссылка на плейлист скопирована');
      }
      setSelectedPlaylist(shared);
      await loadHome();
    } catch (shareError) {
      if ((shareError as Error).name !== 'AbortError') setError('Не удалось поделиться плейлистом');
    }
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

  const shareTrack = useLastCallback(async (track: BygramMusicTrack) => {
    try {
      setNotice('Подготавливаем трек для отправки…');
      await bygramMusicApi.ensureSession();
      const file = await bygramMusicApi.downloadMusicTrack(track);
      const attachment = await buildAttachment(file.name, file);
      setNotice(undefined);
      setPendingShare({ track, attachment });
    } catch {
      setNotice(undefined);
      setError('Не удалось подготовить трек для отправки');
    }
  });

  const startTrackWave = useLastCallback(async (track: BygramMusicTrack) => {
    setIsTrackWaveLoading(true);
    try {
      const wave = await bygramMusicApi.getMusicTrackWave(track.id);
      bygramMusicPlayer.replaceQueue('track-wave', wave);
      if (!player.isPlaying) bygramMusicPlayer.toggle();
      setNotice(`Волна построена по треку «${track.title}»`);
    } catch {
      setError('Не удалось построить волну по треку');
    } finally {
      setIsTrackWaveLoading(false);
    }
  });

  const sendSharedTrack = useLastCallback((chatId: string, threadId = MAIN_THREAD_ID) => {
    if (!pendingShare) return;
    sendMessage({
      messageList: { chatId, threadId, type: 'thread' },
      text: `🎵 ${pendingShare.track.artist} — ${pendingShare.track.title}`,
      attachments: [pendingShare.attachment],
    });
    setNotice('Трек отправляется');
    setPendingShare(undefined);
  });

  const visibleSections = useMemo(() => {
    if (!home) return [];
    return [
      { key: 'daily' as const, title: 'Плейлист дня', subtitle: 'Обновляется каждый день', tracks: home.daily },
      {
        key: 'wave' as const,
        title: 'Моя волна',
        subtitle: 'Подстраивается под ваши прослушивания',
        tracks: home.wave,
      },
      { key: 'recent' as const, title: 'Недавно слушали', subtitle: '', tracks: home.recent },
      { key: 'favorites' as const, title: 'Избранное', subtitle: '', tracks: home.favorites },
    ].filter((section) => section.tracks.length > 0);
  }, [home]);

  return (
    <main id="MiddleColumn" className={`${styles.root} ui-ready`}>
      <header className={styles.header}>
        <Button round color="translucent" iconName="arrow-left" ariaLabel="Назад к чатам" onClick={close} />
        <div className={styles.heading}>
          <strong className={styles.headingTitle}>Музыка</strong>
          <span className={styles.headingSubtitle}>ByGram Music</span>
        </div>
        <div className={styles.search}>
          <SearchInput
            value={query}
            isLoading={isSearching}
            placeholder="Трек, исполнитель или альбом"
            onChange={setQuery}
            onEnter={search}
            onReset={() => {
              setQuery('');
              setSearchResults(undefined);
              setSelectedAlbum(undefined);
            }}
          />
        </div>
      </header>

      <div className={styles.content}>
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
            Плейлисты
          </button>
        </nav>

        {notice && (
          <button type="button" className={styles.notice} onClick={() => setNotice(undefined)}>
            {notice}
          </button>
        )}
        {error && <div className={styles.error}>{error}</div>}
        {player.track && (
          <NowPlaying
            player={player}
            isLiked={likedIds.has(player.track.id)}
            isWaveLoading={isTrackWaveLoading}
            onToggleLike={toggleLike}
            onAddToPlaylist={setTrackToAdd}
            onStartWave={startTrackWave}
          />
        )}
        {!home && !error && <div className={styles.loader}><Spinner /></div>}
        {!searchResults && view === 'discover' && home && (
          <div className={styles.welcome}>
            <span>{greeting()}</span>
            <h1>Что послушаем?</h1>
            <p>Персональные подборки меняются вместе с вашей историей прослушивания.</p>
          </div>
        )}

        {isAlbumLoading ? <div className={styles.loader}><Spinner /></div> : selectedAlbum ? (
          <AlbumDetails
            album={selectedAlbum}
            player={player}
            likedIds={likedIds}
            onBack={() => setSelectedAlbum(undefined)}
            onPlay={playTrack}
            onToggleLike={toggleLike}
            onAddToPlaylist={setTrackToAdd}
            onShareTrack={shareTrack}
          />
        ) : searchResults && (searchResults.tracks.length || searchResults.albums.length) ? (
          <>
            {searchResults.albums.length > 0 && (
              <AlbumSearchResults albums={searchResults.albums} onOpen={openAlbum} />
            )}
            {searchResults.tracks.length > 0 && (
              <MusicSection
                title={`Треки для «${query.trim()}»`}
                tracks={searchResults.tracks}
                source="search"
                likedIds={likedIds}
                player={player}
                onPlay={playTrack}
                onToggleLike={toggleLike}
                onAddToPlaylist={setTrackToAdd}
                onShareTrack={shareTrack}
              />
            )}
          </>
        ) : searchResults ? (
          <EmptyState title="Ничего не найдено" text="Попробуйте изменить название трека, исполнителя или альбома." />
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
            />
          ) : (
            <PlaylistLibrary
              playlists={home?.playlists || []}
              onCreate={() => setIsCreatePlaylistOpen(true)}
              onOpen={setSelectedPlaylist}
            />
          )
        ) : (
          <>
            {visibleSections.map((section) => (
              section.key === 'daily' || section.key === 'wave' ? (
                <MusicShelf
                  key={section.key}
                  title={section.title}
                  subtitle={section.subtitle}
                  tracks={section.tracks}
                  source={section.key}
                  likedIds={likedIds}
                  player={player}
                  onPlay={playTrack}
                  onToggleLike={toggleLike}
                  onAddToPlaylist={setTrackToAdd}
                  onShareTrack={shareTrack}
                />
              ) : (
                <MusicSection
                  key={section.key}
                  title={section.title}
                  subtitle={section.subtitle}
                  tracks={section.tracks}
                  source={section.key}
                  likedIds={likedIds}
                  player={player}
                  onPlay={playTrack}
                  onToggleLike={toggleLike}
                  onAddToPlaylist={setTrackToAdd}
                  onShareTrack={shareTrack}
                />
              )
            ))}
            {home?.librarySize === 0 && (
              <EmptyState title="Найдите первую песню" text="Поиск и стрим идут через SoundCloud, без регистрации." />
            )}
          </>
        )}
      </div>

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
                <small>
                  {playlist.tracks.length}
                  {' '}
                  треков
                </small>
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

      <RecipientPicker
        isOpen={Boolean(pendingShare)}
        title="Отправить трек"
        searchPlaceholder="Поиск чатов"
        onSelectRecipient={sendSharedTrack}
        onClose={() => setPendingShare(undefined)}
      />
    </main>
  );
}

function NowPlaying({
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
  const upcoming = player.queue.slice(player.queueIndex + 1, player.queueIndex + 4);
  return (
    <section className={styles.nowPlaying}>
      <TrackArtwork track={track} large />
      <div className={styles.nowPlayingMain}>
        <span className={styles.eyebrow}>Сейчас играет</span>
        <h1>{track.title}</h1>
        <p>{track.artist}</p>
        <input
          className={styles.progress}
          type="range"
          min="0"
          max={Math.max(1, player.duration)}
          value={Math.min(player.position, player.duration)}
          aria-label="Позиция воспроизведения"
          onChange={(event) => bygramMusicPlayer.seekTo(Number(event.currentTarget.value))}
        />
        <div className={styles.timeline}>
          <span>{formatDuration(player.position)}</span>
          <span>{formatDuration(player.duration)}</span>
        </div>
        <div className={styles.playerControls}>
          <Button
            className={`${styles.repeatControl} ${player.repeatMode !== 'off' ? styles.repeatActive : ''}`}
            round
            color="translucent"
            ariaLabel={repeatModeLabel(player.repeatMode)}
            onClick={() => bygramMusicPlayer.cycleRepeatMode()}
          >
            <Icon name="loop" />
            {player.repeatMode !== 'off' && (
              <span className={styles.repeatBadge}>{player.repeatMode === 'track' ? '1' : '∞'}</span>
            )}
          </Button>
          <Button
            round
            color="translucent"
            iconName="skip-previous"
            ariaLabel="Предыдущий трек"
            onClick={() => void bygramMusicPlayer.previous()}
          />
          <Button
            round
            ariaLabel={player.isPlaying ? 'Пауза' : 'Воспроизвести'}
            onClick={() => bygramMusicPlayer.toggle()}
          >
            {player.isLoading ? <Spinner /> : <Icon name={player.isPlaying ? 'pause' : 'play'} />}
          </Button>
          <Button
            round
            color="translucent"
            iconName="skip-next"
            ariaLabel="Следующий трек"
            disabled={player.queueIndex >= player.queue.length - 1 && player.repeatMode !== 'queue'}
            onClick={() => void bygramMusicPlayer.next()}
          />
        </div>
        <div className={styles.playerActions}>
          <Button
            className={styles.playerAction}
            pill
            color={isLiked ? 'translucent-primary' : 'translucent'}
            size="smaller"
            iconName={isLiked ? 'heart' : 'heart-outline'}
            onClick={() => onToggleLike(track)}
          >
            {isLiked ? 'Понравилось' : 'Нравится'}
          </Button>
          <Button
            className={styles.playerAction}
            pill
            color="translucent"
            size="smaller"
            iconName="add"
            onClick={() => onAddToPlaylist(track)}
          >
            Плейлист
          </Button>
          <Button
            className={styles.playerAction}
            pill
            color="translucent"
            size="smaller"
            iconName="diamond"
            isLoading={isWaveLoading}
            onClick={() => onStartWave(track)}
          >
            Волна
          </Button>
        </div>
        {player.error && <span className={styles.playerError}>{player.error}</span>}
      </div>
      {upcoming.length > 0 && (
        <div className={styles.upNext}>
          <strong>Далее</strong>
          {upcoming.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void bygramMusicPlayer.play(item, player.source, player.queue)}
            >
              <span>{index + 1}</span>
              <div>
                <strong>{item.title}</strong>
                <small>{item.artist}</small>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function PlaylistLibrary({ playlists, onCreate, onOpen }: {
  playlists: BygramMusicPlaylist[];
  onCreate: NoneToVoidFunction;
  onOpen: (playlist: BygramMusicPlaylist) => void;
}) {
  return (
    <section className={styles.library}>
      <div className={styles.libraryHeader}>
        <div>
          <h2>Ваши плейлисты</h2>
          <span>Коллекции для любого настроения</span>
        </div>
        <Button pill size="smaller" iconName="add" onClick={onCreate}>Создать</Button>
      </div>
      {playlists.length ? (
        <div className={styles.playlistGrid}>
          {playlists.map((playlist) => (
            <button key={playlist.id} type="button" className={styles.playlistCard} onClick={() => onOpen(playlist)}>
              <PlaylistCover playlist={playlist} />
              <strong>{playlist.name}</strong>
              <span>
                {playlist.tracks.length}
                {' '}
                треков
              </span>
            </button>
          ))}
        </div>
      ) : <EmptyState title="Соберите первый плейлист" text="Добавляйте найденные песни и делитесь подборками." />}
    </section>
  );
}

function PlaylistDetails({
  playlist, player, likedIds, onBack, onPlay, onShare, onSave, onToggleLike, onAddToPlaylist, onRemoveTrack,
  onShareTrack,
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
}) {
  return (
    <section className={styles.playlistDetails}>
      <div className={styles.playlistHero}>
        <Button round color="translucent" iconName="arrow-left" ariaLabel="К плейлистам" onClick={onBack} />
        <PlaylistCover playlist={playlist} large />
        <div className={styles.playlistHeroMeta}>
          <span>Плейлист</span>
          <h1>{playlist.name}</h1>
          <p>
            {playlist.ownerDisplayName || 'ByGram'}
            {' '}
            ·
            {' '}
            {playlist.tracks.length}
            {' '}
            треков
          </p>
          <div>
            {playlist.tracks.length > 0 && (
              <Button
                pill
                iconName="play"
                onClick={() => onPlay(playlist.tracks[0], 'playlist', playlist.tracks)}
              >
                Слушать
              </Button>
            )}
            {playlist.isOwn ? (
              <Button pill color="translucent" iconName="share-filled" onClick={() => onShare(playlist)}>
                Поделиться
              </Button>
            ) : (
              <Button pill color="translucent" iconName="add" onClick={() => onSave(playlist)}>Добавить себе</Button>
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
        />
      ) : <EmptyState title="Плейлист пока пуст" text="Добавьте песни из поиска или рекомендаций." />}
    </section>
  );
}

function AlbumSearchResults({ albums, onOpen }: {
  albums: BygramMusicAlbum[];
  onOpen: (album: BygramMusicAlbum) => void;
}) {
  return (
    <section className={styles.albumResults}>
      <div className={styles.sectionHeader}><div><h2>Альбомы</h2></div></div>
      <div className={styles.albumGrid}>
        {albums.map((album) => (
          <button key={album.id} type="button" className={styles.albumCard} onClick={() => onOpen(album)}>
            <AlbumArtwork album={album} />
            <span>
              <strong>{album.title}</strong>
              <small>{`${album.artist} · ${album.trackCount} треков`}</small>
            </span>
            <Icon name="next" />
          </button>
        ))}
      </div>
    </section>
  );
}

function AlbumDetails({
  album, player, likedIds, onBack, onPlay, onToggleLike, onAddToPlaylist, onShareTrack,
}: {
  album: BygramMusicAlbum;
  player: PlayerState;
  likedIds: Set<string>;
  onBack: NoneToVoidFunction;
  onPlay: (track: BygramMusicTrack, source: BygramMusicQueueSource, queue: BygramMusicTrack[]) => void;
  onToggleLike: (track: BygramMusicTrack) => void;
  onAddToPlaylist: (track: BygramMusicTrack) => void;
  onShareTrack: (track: BygramMusicTrack) => void;
}) {
  return (
    <section className={styles.playlistDetails}>
      <div className={styles.playlistHero}>
        <Button round color="translucent" iconName="arrow-left" ariaLabel="К результатам поиска" onClick={onBack} />
        <AlbumArtwork album={album} large />
        <div className={styles.playlistHeroMeta}>
          <span>Альбом</span>
          <h1>{album.title}</h1>
          <p>{`${album.artist} · ${album.trackCount} треков`}</p>
          <div>
            {album.tracks.length > 0 && (
              <Button pill iconName="play" onClick={() => onPlay(album.tracks[0], 'album', album.tracks)}>
                Слушать
              </Button>
            )}
          </div>
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
        />
      ) : <EmptyState title="Треки не найдены" text="Для этого альбома пока нет доступных источников." />}
    </section>
  );
}

function MusicSection({
  title, subtitle, tracks, source, likedIds, player, onPlay, onToggleLike, onAddToPlaylist,
  onRemoveFromPlaylist, onShareTrack,
}: {
  title: string;
  subtitle?: string;
  tracks: BygramMusicTrack[];
  source: BygramMusicQueueSource;
  likedIds: Set<string>;
  player: PlayerState;
  onPlay: (track: BygramMusicTrack, source: BygramMusicQueueSource, queue: BygramMusicTrack[]) => void;
  onToggleLike: (track: BygramMusicTrack) => void;
  onAddToPlaylist: (track: BygramMusicTrack) => void;
  onRemoveFromPlaylist?: (track: BygramMusicTrack) => void;
  onShareTrack: (track: BygramMusicTrack) => void;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h2>{title}</h2>
          {subtitle && <span>{subtitle}</span>}
        </div>
        {tracks.length > 1 && (
          <Button pill size="smaller" iconName="play" onClick={() => onPlay(tracks[0], source, tracks)}>
            Слушать
          </Button>
        )}
      </div>
      <div className={styles.trackList}>
        {tracks.map((track) => {
          const isCurrent = player.track?.id === track.id;
          return (
            <div key={track.id} className={`${styles.track} ${isCurrent ? styles.activeTrack : ''}`}>
              <button type="button" className={styles.trackMain} onClick={() => onPlay(track, source, tracks)}>
                <TrackArtwork track={track} />
                <span className={styles.meta}>
                  <strong>{track.title}</strong>
                  <span>{track.artist}</span>
                </span>
              </button>
              <span className={styles.duration}>{formatDuration(track.durationSeconds)}</span>
              <Button
                round
                color="translucent"
                size="smaller"
                iconName={onRemoveFromPlaylist ? 'close' : 'add'}
                ariaLabel={onRemoveFromPlaylist ? 'Удалить из плейлиста' : 'Добавить в плейлист'}
                onClick={() => onRemoveFromPlaylist ? onRemoveFromPlaylist(track) : onAddToPlaylist(track)}
              />
              <Button
                round
                color="translucent"
                size="smaller"
                iconName={likedIds.has(track.id) ? 'heart' : 'heart-outline'}
                ariaLabel="Избранное"
                onClick={() => onToggleLike(track)}
              />
              <Button
                round
                color="translucent"
                size="smaller"
                iconName="share-filled"
                ariaLabel="Отправить трек в чат"
                onClick={() => onShareTrack(track)}
              />
              <Button
                round
                color="translucent"
                size="smaller"
                ariaLabel="Воспроизвести"
                onClick={() => onPlay(track, source, tracks)}
              >
                {isCurrent && player.isLoading
                  ? <Spinner /> : <Icon name={isCurrent && player.isPlaying ? 'pause' : 'play'} />}
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MusicShelf({
  title, subtitle, tracks, source, likedIds, player, onPlay, onToggleLike, onAddToPlaylist, onShareTrack,
}: {
  title: string;
  subtitle?: string;
  tracks: BygramMusicTrack[];
  source: BygramMusicQueueSource;
  likedIds: Set<string>;
  player: PlayerState;
  onPlay: (track: BygramMusicTrack, source: BygramMusicQueueSource, queue: BygramMusicTrack[]) => void;
  onToggleLike: (track: BygramMusicTrack) => void;
  onAddToPlaylist: (track: BygramMusicTrack) => void;
  onShareTrack: (track: BygramMusicTrack) => void;
}) {
  return (
    <section className={styles.shelf}>
      <div className={styles.sectionHeader}>
        <div>
          <h2>{title}</h2>
          {subtitle && <span>{subtitle}</span>}
        </div>
        <Button pill size="smaller" iconName="play" onClick={() => onPlay(tracks[0], source, tracks)}>
          Слушать
        </Button>
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
                  iconName="add"
                  ariaLabel="Добавить в плейлист"
                  onClick={() => onAddToPlaylist(track)}
                />
                <Button
                  round
                  color="translucent"
                  size="tiny"
                  iconName="share-filled"
                  ariaLabel="Отправить в чат"
                  onClick={() => onShareTrack(track)}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
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
      <Icon name="record-play" />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function trackHue(id: string) {
  return Number.parseInt(id.slice(0, 4), 36) % 360;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 6) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function repeatModeLabel(mode: PlayerState['repeatMode']) {
  if (mode === 'track') return 'Повторять текущий трек';
  if (mode === 'queue') return 'Повторять плейлист';
  return 'Включить повтор трека';
}

function formatDuration(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

export default memo(BygramMusic);
