import { useEffect, useState } from '@teact';

import { bygramMusicPlayer } from '../api/bygram/musicPlayer';

export default function useBygramMusicPlayer() {
  const [state, setState] = useState(() => bygramMusicPlayer.getState());

  useEffect(() => bygramMusicPlayer.subscribe(() => {
    setState(bygramMusicPlayer.getState());
  }), []);

  return state;
}
