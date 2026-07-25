import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../shared/ui';

// The online clip player. Where ClipPlayer just plays a random snippet on its
// one device, this coordinates every device onto the SAME snippet at the SAME
// instant, which is what makes the buzz race fair:
//
//   1. Ready gate — browsers refuse to start audio without a user gesture, so
//      each player taps "ready". The tap unlocks the element (a muted play/pause
//      primes it for later programmatic playback) and reports readiness upward.
//   2. Shared seek — every device seeks to clipFraction × the playable range, so
//      they hear the identical musical moment despite ClipPlayer-style randomness.
//   3. Scheduled start — once the room stamps clipStartAt (a server-time ms), each
//      device schedules play at that instant, corrected by serverOffset. A short
//      countdown fills the lead time.
//
// The CDN quirks (503 stalls with no error event, no CORS so fades use el.volume)
// are the same as ClipPlayer and handled the same way.
const FADE_MS = 400;
const STALL_TIMEOUT_MS = 9000;
const MAX_LOAD_ATTEMPTS = 3;

export default function SyncedClipPlayer({
  src,
  seconds = 10,
  clipFraction = 0.4,
  clipStartAt = null,
  serverOffset = 0,
  paused = false,
  revealed = false,
  onReady,
  onStarted,
  onWindowEnded,
  onUnplayable,
}) {
  const audioRef = useRef(null);
  const offsetRef = useRef(0);
  const fadeRef = useRef(null);
  const startTimerRef = useRef(null);
  // 'loading' | 'gate' | 'armed' | 'playing' | 'done' | 'blocked' | 'error'
  const [state, setState] = useState('loading');
  const [elapsed, setElapsed] = useState(0);
  const [countdown, setCountdown] = useState(0);

  // Effects below are armed once per clip, so they'd capture stale callbacks.
  const readyRef = useRef(onReady); readyRef.current = onReady;
  const startedRef = useRef(onStarted); startedRef.current = onStarted;
  const endedRef = useRef(onWindowEnded); endedRef.current = onWindowEnded;
  const unplayableRef = useRef(onUnplayable); unplayableRef.current = onUnplayable;

  // Load + seek. Mirrors ClipPlayer's stall-retry handling for the flaky CDN.
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

    const armStallTimer = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        if (cancelled || audio.readyState > 0) return;
        if (attempt < MAX_LOAD_ATTEMPTS) {
          attempt += 1;
          audio.src = `${src}${src.includes('?') ? '&' : '?'}r=${attempt}`;
          audio.load();
          armStallTimer();
        } else {
          setState('error');
          unplayableRef.current?.();
        }
      }, STALL_TIMEOUT_MS);
    };

    const onLoaded = () => {
      if (cancelled) return;
      clearTimeout(stallTimer);
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const latest = Math.max(0, duration - seconds - 2);
      // Shared fraction, not Math.random(), so every device lands on the same spot.
      offsetRef.current = Math.min(latest, clipFraction * latest);
      audio.currentTime = offsetRef.current;
      setState('gate');
    };

    const onError = () => {
      if (cancelled) return;
      clearTimeout(stallTimer);
      setState('error');
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
      clearTimeout(startTimerRef.current);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('error', onError);
      audio.pause();
      audio.src = '';
    };
  }, [src, seconds, clipFraction]);

  // The Ready tap: a real user gesture, so prime the element for the later,
  // gesture-less programmatic play() and report readiness to the room.
  const handleReady = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = true;
    audio.play()
      .then(() => {
        audio.pause();
        audio.muted = false;
        audio.currentTime = offsetRef.current;
      })
      .catch(() => { audio.muted = false; });
    setState('armed');
    readyRef.current?.();
  };

  function startPlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    clearInterval(fadeRef.current);
    audio.currentTime = offsetRef.current;
    audio.volume = 1;
    const startedAt = audio.currentTime;
    setElapsed(0);

    audio.play()
      .then(() => { setState('playing'); startedRef.current?.(); })
      .catch(() => setState('blocked')); // gesture unlock failed — offer a button

    fadeRef.current = setInterval(() => {
      if (!audioRef.current) return;
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

  // Schedule playback at the shared instant, once armed and the room has stamped
  // clipStartAt. Runs a 3-2-1 countdown over the lead time.
  useEffect(() => {
    if (state !== 'armed' || clipStartAt == null) return;
    const delay = clipStartAt - (Date.now() + serverOffset);
    if (delay <= 0) { startPlayback(); return; }

    setCountdown(Math.ceil(delay / 1000));
    const tick = setInterval(() => {
      const left = clipStartAt - (Date.now() + serverOffset);
      setCountdown(Math.max(0, Math.ceil(left / 1000)));
    }, 200);
    startTimerRef.current = setTimeout(() => { clearInterval(tick); startPlayback(); }, delay);
    return () => { clearInterval(tick); clearTimeout(startTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, clipStartAt, serverOffset]);

  // Race pauses the clip for everyone while a buzzed player answers, then resumes
  // it in place — the elapsed countdown is measured off currentTime, which simply
  // stops advancing while paused.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || state !== 'playing') return;
    if (paused) audio.pause();
    else audio.play().catch(() => {});
  }, [paused, state]);

  // Once the answer is out, let the clip run on so the room can hear the rest.
  useEffect(() => {
    if (revealed) clearInterval(fadeRef.current);
  }, [revealed]);

  function replay() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = offsetRef.current;
    startPlayback();
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
          Couldn&apos;t play this clip — reveal and skip to the next one.
        </p>
      )}

      {state === 'gate' && (
        <Button variant="primary" size="lg" fullWidth onClick={handleReady}>
          🎧 Tap when ready
        </Button>
      )}

      {state === 'armed' && (
        <p className="py-4 text-center text-lg text-white/60">
          {clipStartAt == null
            ? 'Waiting for everyone…'
            : `Get ready… ${countdown > 0 ? countdown : ''}`}
        </p>
      )}

      {state === 'playing' && !revealed && (
        <p className="py-4 text-center text-lg text-white/60">🎵 Listen…</p>
      )}

      {state === 'blocked' && (
        <Button variant="neutral" size="lg" fullWidth onClick={replay}>
          ▶ Play clip
        </Button>
      )}

      {state === 'done' && !revealed && (
        <Button variant="neutral" size="lg" fullWidth onClick={replay}>
          🔁 Replay clip
        </Button>
      )}
    </div>
  );
}
