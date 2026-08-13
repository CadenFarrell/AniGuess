import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../shared/ui';

// Plays a fixed-length snippet from a random offset.
//
// Constraints this is written around, all measured against a.animethemes.moe:
//   - Plain <audio src> works and Range seeking works.
//   - The CDN sends no Access-Control-Allow-Origin on the actual response, so
//     Web Audio is unavailable: no AudioContext, no MediaElementSource, no
//     decodeAudioData, and crossOrigin="anonymous" fails outright with
//     MEDIA_ERR_SRC_NOT_SUPPORTED. Fades therefore use el.volume, not a gain
//     node, and there is no waveform.
//   - Metadata took ~2s on a 3.6MB file, so the parent preloads the next clip.
//   - The CDN 503s a lot: 10 of 15 requests during one playthrough. Chrome's
//     media stack retries transparently and usually wins, but a run of them
//     leaves the element stalled at readyState 0 with no `error` event ever
//     firing — so a plain load can hang forever. Hence the stall timeout.
const FADE_MS = 400;
const STALL_TIMEOUT_MS = 9000;
const MAX_LOAD_ATTEMPTS = 3;

export default function ClipPlayer({
  src,
  seconds = 10,
  // Where in the playable range to start, 0..1. Dealt with the question by
  // pickRound rather than rolled here — this component used to pick its own
  // offset on every mount, which meant a remount silently moved the clip and the
  // sample-point setting had nowhere to take effect. SyncedClipPlayer has always
  // taken it this way; now both do, and both map fraction to seconds identically.
  fraction = 0.4,
  playbackRate = 1,
  autoPlay = true,
  revealed = false,
  paused = false,
  onPlaybackError,
  onStarted,
  onWindowEnded,
  onUnplayable,
}) {
  const audioRef = useRef(null);
  const fadeRef = useRef(null);
  const offsetRef = useRef(0);
  const [state, setState] = useState('loading'); // loading | ready | playing | done | error
  const [elapsed, setElapsed] = useState(0);

  // The load and playback effects below are set up once per clip, so they would
  // capture stale callbacks from the render that started them.
  const endedRef = useRef(onWindowEnded);
  endedRef.current = onWindowEnded;
  const unplayableRef = useRef(onUnplayable);
  unplayableRef.current = onUnplayable;
  const startedRef = useRef(onStarted);
  startedRef.current = onStarted;

  // Fresh element per clip. Reusing one and swapping .src leaves the old
  // buffered range attached and makes seeking unreliable.
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = src;
    audioRef.current = audio;
    setState('loading');
    setElapsed(0);

    let cancelled = false;
    let attempt = 1;
    let stallTimer = null;

    // A 503 leaves the element silently stalled, so treat "no metadata yet" as
    // a failure and reload rather than waiting on an error that never comes.
    const armStallTimer = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        if (cancelled || audio.readyState > 0) return;
        if (attempt < MAX_LOAD_ATTEMPTS) {
          attempt += 1;
          // Cache-bust so the retry is not served the same failed response.
          audio.src = `${src}${src.includes('?') ? '&' : '?'}r=${attempt}`;
          audio.load();
          armStallTimer();
        } else {
          setState('error');
          onPlaybackError?.(new Error('Clip stalled (CDN unavailable)'));
          unplayableRef.current?.();
        }
      }, STALL_TIMEOUT_MS);
    };

    const onLoaded = () => {
      if (cancelled) return;
      clearTimeout(stallTimer);
      // Leave room at the end for the whole window plus the outro, then take the
      // dealt fraction of what's left. Same mapping SyncedClipPlayer uses, so a
      // question sounds the same locally and online.
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const latest = Math.max(0, duration - seconds - 2);
      offsetRef.current = Math.min(latest, fraction * latest);
      audio.currentTime = offsetRef.current;
      setState('ready');
      if (autoPlay) startPlayback(audio);
    };

    const onError = () => {
      if (cancelled) return;
      clearTimeout(stallTimer);
      setState('error');
      onPlaybackError?.(audio.error);
      unplayableRef.current?.();
    };

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('error', onError);
    audio.load();
    armStallTimer();

    return () => {
      cancelled = true;
      clearTimeout(stallTimer);
      clearInterval(fadeRef.current);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('error', onError);
      audio.pause();
      audio.src = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, seconds, fraction]);

  // Applied on its own rather than at play() time so a rate change mid-clip
  // takes effect immediately. playbackRate survives pause/resume and seeking, so
  // there is nothing to re-apply afterwards.
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate, state]);

  // Once the answer is out, let the clip run on unbounded so the table can
  // listen to the rest of the song.
  useEffect(() => {
    if (revealed) clearInterval(fadeRef.current);
  }, [revealed]);

  // Race mode holds the clip while a buzzed player answers, then resumes it for
  // everyone still in. No timer bookkeeping is needed: the countdown below is
  // measured off audio.currentTime, which simply stops advancing while paused,
  // so an interrupted clip picks up exactly where it left off.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || state !== 'playing') return;
    if (paused) audio.pause();
    else audio.play().catch(() => {});
  }, [paused, state]);

  function startPlayback(audio = audioRef.current) {
    if (!audio) return;
    clearInterval(fadeRef.current);
    audio.volume = 1;
    const startedAt = audio.currentTime;
    setElapsed(0);

    // The guess window opens here rather than on mount: play() resolving is the
    // first moment anyone can actually hear anything, and a clock started while
    // the CDN was still stalling would be scoring the connection.
    audio.play().then(() => { setState('playing'); startedRef.current?.(); }).catch((err) => {
      // Autoplay without a gesture is refused by every browser; fall back to
      // showing the button rather than looking broken.
      setState('ready');
      onPlaybackError?.(err);
    });

    fadeRef.current = setInterval(() => {
      if (!audioRef.current) return;
      // Measured off currentTime, so `seconds` is seconds OF SONG, not of wall
      // clock: at 1.5x you hear the same stretch of music in less real time.
      // That keeps the speed setting a pure difficulty knob instead of secretly
      // also being a length one — and it is what makes a paused race clip resume
      // exactly where it left off, since currentTime simply stops advancing.
      const played = audioRef.current.currentTime - startedAt;
      setElapsed(played);
      if (revealed) return;
      const remaining = seconds - played;
      if (remaining <= 0) {
        clearInterval(fadeRef.current);
        audioRef.current.pause();
        setState('done');
        endedRef.current?.();
      } else if (remaining < FADE_MS / 1000) {
        audioRef.current.volume = Math.max(0, remaining / (FADE_MS / 1000));
      }
    }, 100);
  }

  function replay() {
    const audio = audioRef.current;
    if (!audio) return;
    // Back to the dealt offset, not "wherever we are minus what we played" —
    // the old subtraction drifted a little each replay, and now that the offset
    // is a property of the question there is an exact place to return to.
    audio.currentTime = offsetRef.current;
    startPlayback(audio);
  }

  const pct = Math.min(100, (elapsed / seconds) * 100);

  return (
    <div className="w-full">
      <div className="mb-4 h-4 w-full overflow-hidden rounded-pop-sm border-2 border-ink bg-surface-2">
        <div
          className="h-full bg-pop-blue transition-[width] duration-100"
          style={{ width: `${revealed ? 100 : pct}%` }}
        />
      </div>

      {state === 'loading' && (
        <p className="py-4 text-center text-lg text-white/40">Loading clip…</p>
      )}

      {state === 'error' && (
        <p className="py-4 text-center text-lg text-pop-red">
          Couldn&apos;t play this clip — skip to the next one.
        </p>
      )}

      {state === 'playing' && !revealed && (
        <p className="py-4 text-center text-lg text-white/60">🎵 Listen…</p>
      )}

      {(state === 'ready' || state === 'done') && (
        <Button variant="neutral" size="lg" fullWidth onClick={replay}>
          {state === 'done' ? '🔁 Replay clip' : '▶ Play clip'}
        </Button>
      )}
    </div>
  );
}
