// All AniFake logic: no React, no storage, no network. Each function takes a
// slice of round state and returns a { patch } for the caller to apply however
// its persistence layer works — useState locally, a Firebase transaction
// online. See CLAUDE.md: change game behaviour here, not in the hooks, or local
// and online drift apart.
//
// The game: one character everyone at the table knows is dealt privately to
// everyone — except the fake. Each player in turn gives a one-word clue about
// them, then the table votes.
//
// THERE IS NO PUBLIC BOARD, and that is load-bearing rather than incidental.
// An earlier build dealt sixteen candidates face-up so the fake had something
// to bluff off; the fake now gets a one-word hint instead (blind mode: one
// genre off the secret's show, see utils/pool.js's hintFor). Nothing about the
// character may sit in state/, which every member of a room reads in full — so
// a candidate list, however short, cannot go back. What replaced it is dealt
// into secrets/{playerId}, which only its owner can read.
//
// A consequence worth knowing before touching anything here: a character's
// identity is its FOLDED NAME (shared/utils/character.js's characterNameKey),
// not an index into a shared array. With no array to index, the name is the
// only reference two devices can both resolve, and deriveTruth groups the
// published cards by it.
//
// Nothing in here ever sees the secret. It lives in rooms/{code}/secrets/
// online (owner-readable only) and in a closed-over variable locally, and the
// round state it does touch — `reveal` — is written only once the vote has
// closed. See deriveTruth for how the answer comes back without anyone having
// been trusted to hold it.
import { characterNameKey } from '../../shared/utils/character';
import { shuffle } from '../../shared/utils/random';
import { DEFAULT_FAME_ID } from './fame';
import { hintFor, pickDecoy, pickSecret } from './utils/pool';

// Two crew have to agree on the secret for deriveTruth to find the odd one out,
// and a two-player game of "spot the liar" is a coin toss anyway.
export const MIN_PLAYERS = 3;

export const MAX_CLUE_LEN = 24;

// A typed name has to be bounded before it goes into an RTDB write. Long enough
// for the longest romanized full name anyone will actually type.
export const MAX_STEAL_LEN = 64;

// How many times round the table before the vote opens — `laps` on the round,
// "Clue rounds" on screen. These live here rather than in the settings screens
// because AniFakeSetup and OnlineLobby are copy-paste twins, and a default that
// existed twice would drift the moment one of them was tuned.
//
// Three, not one: with a single clue each the fake barely has to commit to
// anything, and the table votes on almost nothing. Note this is the *product*
// default — the `laps = 1` fallbacks in startRound and normalizeGame are repair
// values for a round that arrived without the field, and stay at 1 so old data
// keeps its old behaviour.
export const DEFAULT_CLUE_ROUNDS = 3;
export const MAX_CLUE_ROUNDS = 10;

// The first deal plus two redeals. The runoff's cap next door argues that no
// scheme like this terminates by structure and an uncapped loop wedges an online
// room — which is why a bound is needed, but NOT why this one is 3. The runoff
// stops at one because repeating cannot help: two stubborn players tie forever,
// so a second runoff is the same coin flip. Re-dealing is genuinely productive
// by comparison — the failure it answers is a bad draw, not stubbornness — so
// the bound is here to stop griefing rather than to stop a livelock. Only
// checkOutcome and applyRedeal read it; 2 is a one-line change if a player
// burning everyone's taps turns out to matter more than a second honest re-roll.
export const MAX_DEALS = 3;

/**
 * How many eligible characters a mode needs before it can deal.
 *
 * Blind needs exactly one — the fake is dealt a word, not a character, so
 * nothing else has to exist. Decoy needs a second one to hand the fake, and a
 * fake dealt null would sit on "Waiting for the deal…" forever.
 *
 * This is deliberately not a board size. The old sixteen-card minimum existed
 * to fill a grid nobody looks at anymore, and it locked out every table whose
 * shared lists were small — which, under "shared characters only", is most of
 * them.
 */
export function minPool(mode) {
  return mode === 'decoy' ? 2 : 1;
}

// --- dealing ---------------------------------------------------------------

/**
 * Picks the secret, the fake, and what each player is told.
 *
 * Returns the cards to write into secrets/{playerId} plus the answer — which the
 * CALLER MUST NOT PERSIST anywhere the room can read. See the note in
 * useAniFakeRoom.startGame about the one device this leaks to.
 *
 * `forRound` stamps every card. Cards are overwritten rather than cleared
 * between rounds (a clear that half-fails would leak last round's answer), so
 * the stamp is what makes a stale card unreadable rather than silently wrong —
 * the same trick AniGuess's readAssignment uses.
 */
export function dealRoles(playerIds, pool, {
  mode = 'blind', round = 1, deal = 1, fame = DEFAULT_FAME_ID,
  exclude = [], pinFake = null, discarded = [], rng = Math.random,
} = {}) {
  const ids = playerIds ?? [];
  const entries = pool ?? [];
  if (!ids.length || !entries.length) {
    return { secrets: {}, fakeId: null, secret: null, secretName: null, dealt: [] };
  }

  // The draw happens even when the fake is pinned, and that is deliberate rather
  // than wasteful: this module's tests feed a scripted rng and depend on the
  // fixed draw order (fake, then secret, then decoy). Skipping the call when
  // pinned would shift the secret and the decoy for pinned deals only, so a
  // re-deal would land on a different character than the same seed produces
  // without a pin — a divergence no test could see coming.
  const drawn = ids[Math.floor(rng() * ids.length)];
  // Named `pinFake` rather than `fakeId` so it cannot shadow the value below.
  // The `includes` guard matters because the pin comes from the PREVIOUS deal:
  // online it rides a ref across a phase, and locally the roster is a prop, so
  // neither guarantees the pinned player is still being dealt to.
  const fakeId = pinFake && ids.includes(pinFake) ? pinFake : drawn;
  const secret = pickSecret(entries, { fame, exclude, rng });
  const decoy = mode === 'decoy' ? pickDecoy(entries, secret, { fame, exclude, rng }) : null;
  // Blind mode only. In decoy mode the fake holds a character of their own and
  // is never told anything is wrong, so a hint would be both redundant and a
  // tell. Keeping the hint to one mode is what makes the two modes feel
  // different rather than being a setting.
  const hint = mode === 'blind' ? hintFor(secret, { rng }) : null;

  const secrets = {};
  for (const id of ids) {
    const isFake = id === fakeId;
    secrets[id] = {
      forRound: round,
      // The second half of the stamp, for the same reason as the first. A round
      // can now be dealt more than once (see the check phase below), and the
      // window between the check reset landing and the new cards arriving would
      // otherwise render the superseded character as if it were current.
      // Stamping makes a stale card INVISIBLE with no write at all, which is
      // safe in both interleavings; clearing would be N writes that can half
      // fail.
      forDeal: deal,
      // Blind mode hands the fake no character at all — just the word below.
      // Decoy mode hands them a different one and does NOT tell them, which is
      // the whole point of that mode: nobody knows who they are, including them.
      character: isFake ? (mode === 'decoy' ? decoy : null) : secret,
      // Null when the character carries no genres. RTDB drops nulls, so the key
      // is simply absent on read-back — which reads identically, and both mean
      // "nothing on file" to the screen.
      hint: isFake && mode === 'blind' ? hint : null,
      isFake: mode === 'blind' ? isFake : false,
      // What earlier deals of this round threw away, published to EVERYONE —
      // the fake included, which is the entire point rather than a leak.
      //
      // A re-deal creates common knowledge the fake does not share: the crew all
      // saw the discarded character and the blind fake never did, so "everyone
      // name the one we threw out" catches them for free and for a reason that
      // has nothing to do with how they played. The card check invented that
      // detector; publishing the discard is what disarms it. It costs nothing to
      // give away — a character that is definitively NOT the answer, out of a
      // pool of hundreds.
      //
      // Blind only, which is the hint rule inverted: in decoy mode the fake
      // discarded a DIFFERENT character from everyone else, so a single shared
      // list would tell them their card differs, and decoy's whole premise is
      // that it cannot. That mode keeps the detector; only copy can help it.
      //
      // Null rather than [] when there is nothing, because RTDB stores neither
      // and both read back absent — and deal 1 genuinely has no discards, so
      // "absent" is the correct render rather than a shape to repair.
      discarded: mode === 'blind' && discarded.length ? discarded : null,
    };
  }
  // What this deal put in somebody's hands, for a redeal to exclude. The DECOY
  // is in here as well as the secret, and that is not tidiness: in decoy mode
  // the fake really did hold a character, so promoting last deal's decoy to the
  // new secret would have the table giving clues about someone one of them was
  // privately holding a minute ago.
  const dealt = [secret?.id, decoy?.id].filter(Boolean);
  // The DISPLAY name, alongside the folded ids above, so a caller can build the
  // next deal's `discarded` list without holding the pool entry. Online that
  // matters: the host must accumulate the names across the check phase, and
  // `dealt` already holds the same characters folded — this is the same secret
  // in readable casing, not a wider disclosure. See useAniFakeRoom's refs.
  return { secrets, fakeId, secret, secretName: secret?.name ?? null, dealt };
}

export function startRound(playerIds, {
  mode = 'blind', laps = 1, wordLimit = 1, round = 1, allowRedeal = false, rng = Math.random,
} = {}) {
  return {
    round,
    mode,
    // Which deal of this round is current — the second half of the card stamp.
    // Deliberately OUTSIDE `check`: the stamp has to stay valid for the whole
    // round, while `check` is meaningful only before the first clue, so folding
    // them into one node would either strand the stamp or cost a second write
    // when the phase ends.
    deal: 1,
    // The pre-clue card check, or null when the table turned it off — which is
    // also what every round written before this existed reads as, so the whole
    // backward-compatibility story is "no check node, go straight to clues".
    check: allowRedeal ? { responded: {}, asked: false } : null,
    // Clamped here rather than at the call sites: laps of 0 makes totalTurns 0,
    // which makes cluesDone true on turn zero and opens the vote with nothing
    // said. Both settings screens clamp too, but this is the layer that has to
    // hold — a host types the number, and it reaches here through RTDB.
    laps: Math.min(MAX_CLUE_ROUNDS, Math.max(1, Math.floor(laps) || 1)),
    wordLimit,
    // Fixed at deal time and stored, not derived: going last is an advantage,
    // so the order must not shuffle under the round when the roster changes.
    order: shuffle(playerIds ?? [], rng),
    turn: 0,
    clues: [],
    votes: {},
    // The one runoff a round gets, opened by openRunoff when the opening ballot
    // ties: { candidates: [ids], votes: { voterId: targetId } }. Null until then.
    //
    // Singular rather than an array of ballots, deliberately: the cap IS one. A
    // second tie ends the vote with nobody accused (see voteOutcome), because no
    // runoff scheme terminates by structure — two stubborn players can tie
    // forever, and an uncapped loop would wedge an online room with no way out
    // short of leaving. An array would invite exactly that loop back.
    runoff: null,
    steal: null,
    reveal: {},
  };
}

// --- the card check --------------------------------------------------------
//
// One phase, between the deal and the first clue: everyone looks at their card
// and either confirms it or asks for a fresh one. If anyone asked, the round is
// dealt again — new secret, SAME fake — and everyone looks again.
//
// WHO MAY ASK: everyone except the blind-mode fake. They hold no character, so
// there is nothing for them to fail to recognise, and a fake who pressed it could
// be asked afterwards to justify not knowing a card they never saw — the exact
// failure the paragraph below exists to prevent. The decoy fake keeps the button:
// they hold a real character of their own, can honestly not know it, and a screen
// missing a control everyone else has is precisely the tell that mode forbids.
//
// That gate is CLIENT-SIDE ONLY and cannot be otherwise: `state/` never records
// who the fake is, so this module cannot know either, and `respondToCheck` will
// take `asked: true` from anybody. Pinning is what makes that safe rather than
// sloppy — see below. A modified client that asks anyway is re-dealt and is still
// the fake, so there is nothing to win by defeating the check.
//
// One consequence, accepted rather than designed around: once the fake cannot
// ask, "I asked for the re-deal" becomes a claim of innocence. It is also
// unfalsifiable — several players can ask and the latch merely ORs them, so two
// people claiming it contradicts nothing — which means a fake will simply always
// claim it. The claim is worth nothing to anyone, which is the point.
//
// WHY THE FAKE IS PINNED across the deals of one round (dealRoles' `pinFake`).
// The re-deal used to pick a new fake as well, and that made the button do two
// things: a bad draw was answerable, and so was a role you did not want. Nobody
// is told who asked, so a blind-mode fake could veto their way out of the job
// with a 1-in-N chance of getting it back and no way for the table to notice.
// The gate above closes that from the front; pinning closes it from behind, and
// is the reason the gate can live in a component at all. It costs nobody
// anything either way: a real player who asks stays real, so the pin tells the
// table nothing it did not already know. It also keeps asking FREE — without it,
// an honest crew member who spoke up would take a 1-in-N chance of being handed
// the hardest role, which penalises the exact behaviour the button exists to
// encourage.
//
// It exists because "shared characters only" is a weaker guarantee than it
// sounds. A character every player technically has on a list can still be one
// nobody remembers, and the round is then meaningless clues and an uncatchable
// fake. utils/pool.js's fame bias makes that rare; this is what handles the rest.
//
// WHY NOBODY IS TOLD WHO ASKED, which is the constraint the whole shape follows
// from: in blind mode the fake holds no character at all. So a visible veto — or
// a host polling the table out loud — makes them bluff about a card they cannot
// see, and gets them caught for a reason that has nothing to do with the game.
// state/ is read in full by every member of a room, so a per-player record of
// HOW someone answered is a leak by definition, and there is none anywhere here:
// `responded[id]` is literally `true` for a confirmer and an asker alike, and
// `asked` is one shared boolean that every asker writes the same `true` to.
//
// The residual leak, documented rather than fixed, exactly as startGame
// documents the host holding the answer for the length of one function call: a
// member watching raw RTDB sees `responded/{id}` appear and `asked` flip in the
// same write, so the flip can be correlated with whoever caused it. Closing that
// needs a server to mix the writes and there isn't one. What IS closed is the
// UI — useAniFakeRoom collapses this into a phase string and never returns
// `asked` on its own, so no screen can render the correlation.
//
// And at three players it is weaker still: a confirmer who sees a redeal happen
// knows one of the other two asked. That is inherent to a single shared boolean
// and no code fixes it, which is why the on-screen copy says "nobody is told who
// asked" — true — rather than "nobody can tell".

export function needsCheck(state) {
  return Boolean(state?.check);
}

/**
 * One player's answer. `asked` true is a request to re-deal, and is recorded
 * ONLY in the shared latch — see the note above.
 */
export function respondToCheck(state, playerId, { asked = false } = {}) {
  if (!playerId || !state.check) return { patch: {} };
  // Final once given, for castVote's reason: letting a confirmer switch to a
  // veto after watching everyone else respond would hand the last responder the
  // decision on their own.
  if (state.check.responded?.[playerId]) return { patch: {} };
  return {
    patch: {
      check: {
        responded: { ...(state.check.responded ?? {}), [playerId]: true },
        asked: Boolean(state.check.asked) || asked,
      },
    },
  };
}

// Against the ACTIVE roster, like everyoneVoted: a closed tab drops out of
// activeIds and the gate clears itself rather than wedging the room forever.
export function everyoneChecked(state, activeIds) {
  if (!activeIds?.length) return false;
  return activeIds.every((id) => state.check?.responded?.[id]);
}

export function pendingCheckers(state, activeIds) {
  if (!state.check) return [];
  return (activeIds ?? []).filter((id) => !state.check.responded?.[id]);
}

/**
 * Where the check phase stands, as one object, so the caller never has to
 * combine `asked` with anything itself — the hook turns this straight into a
 * phase string and `asked` never reaches a screen on its own.
 */
export function checkOutcome(state, activeIds) {
  const done = everyoneChecked(state, activeIds);
  const asked = Boolean(state.check?.asked);
  const canRedeal = (state.deal ?? 1) < MAX_DEALS;
  return {
    done,
    asked,
    canRedeal,
    next: !done ? null : (asked && canRedeal ? 'redeal' : 'clues'),
  };
}

/**
 * Claims the next deal and reopens the check for it.
 *
 * `nextDeal` is passed in and re-checked rather than derived, so this is safe as
 * a transaction body: two devices that both saw deal N compute the same N+1, and
 * whichever commits second sees the bumped value and aborts. The loser's cards
 * are stamped with a deal number that never becomes current, which the stamp
 * makes invisible rather than wrong.
 */
export function applyRedeal(state, nextDeal) {
  if (!state.check) return { patch: {} };
  if (nextDeal !== (state.deal ?? 1) + 1) return { patch: {} };
  if (nextDeal > MAX_DEALS) return { patch: {} };
  return { patch: { deal: nextDeal, check: { responded: {}, asked: false } } };
}

// --- the clue lap ----------------------------------------------------------
//
// One flat counter rather than a (lap, index) pair: the speaker is
// order[turn % N] and the lap is floor(turn / N), so skipping a departed player
// is turn + 1 and nothing else has to stay in step.

export function lapOf(state) {
  return Math.floor(state.turn / (state.order?.length || 1));
}

export function totalTurns(state) {
  return (state.order?.length ?? 0) * (state.laps ?? 1);
}

export function cluesDone(state) {
  return state.turn >= totalTurns(state);
}

export function currentSpeakerId(state) {
  const order = state.order ?? [];
  if (!order.length || cluesDone(state)) return null;
  return order[state.turn % order.length];
}

/**
 * The clue log split into rounds, oldest first: [{ lap, clues }].
 *
 * Lives here rather than in the component because it is the only way it gets
 * tested — the vitest config is node-env over `*.test.js`, so a .jsx helper
 * would never run.
 *
 * Groups by the `lap` each clue was stamped with at submit time, NOT by
 * position: skipDepartedTurn can jump the turn counter past a player, so a
 * round can hold fewer clues than there are players and slicing the flat array
 * into equal chunks would smear rounds into each other.
 */
export function cluesByLap(clues) {
  const byLap = new Map();
  for (const clue of clues ?? []) {
    // A clue written before the field existed reads as round one rather than
    // vanishing into a group of its own.
    const lap = clue?.lap ?? 0;
    if (!byLap.has(lap)) byLap.set(lap, []);
    byLap.get(lap).push(clue);
  }
  // Numeric sort, explicitly: the default comparator is lexicographic, which
  // orders round 10 before round 2 — reachable now that MAX_CLUE_ROUNDS is 10.
  return [...byLap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([lap, said]) => ({ lap, clues: said }));
}

/**
 * The one order every AniFake screen renders players in, each carrying a fixed
 * 1-based `seat`.
 *
 * The order is `order` — the speaking order fixed at deal time — and NOT the
 * roster, because it is the order the table heard the clues in. The screens
 * disagreed before this: the clue log ran in speaking order while the ballot
 * and the reveal ran in roster order, so the mental map the table built during
 * the lap was worthless by the time it had to vote.
 *
 * The seat number is the anchor that survives any reflow, and it is why
 * VoteScreen no longer filters the voter out of their own ballot: a row that
 * disappears shifts every row beneath it, so in pass-the-device play the same
 * name sat at a different position on every hand-off.
 *
 * A player absent from `order` — one who joined after the deal — gets seat null
 * and sorts last rather than vanishing. A ballot must never silently lose a row.
 */
export function seating(state, players = []) {
  const order = state?.order ?? [];
  const byId = new Map((players ?? []).map((p) => [p.id, p]));
  // Seat comes from the position in `order`, taken BEFORE dropping anyone the
  // roster no longer holds — numbering the survivors instead would renumber
  // every seat below a player who left, which is the exact shuffle this exists
  // to stop.
  const seated = order
    .map((id, i) => ({ id, seat: i + 1 }))
    .filter(({ id }) => byId.has(id))
    .map(({ id, seat }) => ({ ...byId.get(id), seat }));
  const late = (players ?? []).filter((p) => !order.includes(p.id)).map((p) => ({ ...p, seat: null }));
  return [...seated, ...late];
}

export function countWords(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

// One clue per turn. Rejects rather than throws on every way this arrives
// twice — a double tap, a replayed write, or a device still showing a turn the
// room has moved past.
export function submitClue(state, playerId, text) {
  const clue = (text || '').trim().replace(/\s+/g, ' ').slice(0, MAX_CLUE_LEN);
  if (!clue) return { patch: {} };
  if (currentSpeakerId(state) !== playerId) return { patch: {} };
  if (countWords(clue) > (state.wordLimit ?? 1)) return { patch: {} };
  return {
    patch: {
      // An append-only array, so it renders as the log everyone reads back and
      // RTDB stores it dense — no holes, none of a sparse array's problems.
      clues: [...(state.clues ?? []), { by: playerId, text: clue, lap: lapOf(state) }],
      turn: state.turn + 1,
    },
  };
}

// Talk mode's turn-advance: the clue was said out loud, so there is nothing to
// record. Deliberately a sibling of submitClue rather than a flag on it —
// submitClue's whole contract is "reject anything that is not a real clue", and
// a mode flag that made it accept nothing would undo every guard it has.
//
// Nothing else in the round has to know: the lap, the speaker and cluesDone are
// all derived from `turn`, so a round played this way simply ends with an empty
// `clues` array. The past-the-end case needs no guard of its own —
// currentSpeakerId is null once the lap is done, so no real id can match it.
export function passTurn(state, playerId) {
  if (currentSpeakerId(state) !== playerId) return { patch: {} };
  return { patch: { turn: state.turn + 1 } };
}

// The lap cannot wait on someone who has closed their tab. Walks forward past
// everyone who has gone, bounded by the last turn — so an entire roster leaving
// ends the lap rather than spinning.
export function skipDepartedTurn(state, departedIds = []) {
  const order = state.order ?? [];
  if (!order.length) return { patch: {} };
  const total = totalTurns(state);
  let turn = state.turn;
  while (turn < total && departedIds.includes(order[turn % order.length])) turn++;
  if (turn === state.turn) return { patch: {} };
  return { patch: { turn } };
}

// --- the vote --------------------------------------------------------------
//
// A round holds up to two ballots: the opening vote, and — when that ties — one
// sudden-death runoff between the tied names. Everything below reads through
// currentBallot so neither the screens nor the hooks have to know which is open.

/**
 * Whichever ballot is taking votes right now.
 *
 * On the opening ballot the candidates ARE `order`, so a departed player stays
 * accusable exactly as they were before runoffs existed — walking out is what a
 * rumbled fake does, and VoteScreen deliberately keeps them on the ballot.
 */
export function currentBallot(state) {
  if (state?.runoff) {
    return {
      isRunoff: true,
      candidates: state.runoff.candidates ?? [],
      votes: state.runoff.votes ?? {},
    };
  }
  return { isRunoff: false, candidates: state?.order ?? [], votes: state?.votes ?? {} };
}

// Final once cast. Letting a vote change would mean the last voter closes the
// round, which hands them the power to watch the tally settle first. Final per
// BALLOT: a runoff is a fresh vote, not a chance to amend the opening one.
export function castVote(state, voterId, targetId) {
  if (!voterId || !targetId || voterId === targetId) return { patch: {} };
  const ballot = currentBallot(state);
  if (!ballot.candidates.includes(targetId)) return { patch: {} };
  if (ballot.votes[voterId]) return { patch: {} };
  // Everyone votes in the runoff, the tied players included — the self-vote
  // guard above is the whole of what stops a candidate voting themselves clear.
  if (ballot.isRunoff) {
    return {
      patch: { runoff: { ...state.runoff, votes: { ...ballot.votes, [voterId]: targetId } } },
    };
  }
  return { patch: { votes: { ...ballot.votes, [voterId]: targetId } } };
}

export function everyoneVoted(state, activeIds) {
  if (!activeIds?.length) return false;
  const { votes } = currentBallot(state);
  return activeIds.every((id) => votes[id]);
}

export function pendingVoters(state, activeIds) {
  const { votes } = currentBallot(state);
  return (activeIds ?? []).filter((id) => !votes[id]);
}

// Who a single ballot landed on. `caught` is null on a tie — what that MEANS
// depends on which ballot it was, which is voteOutcome's job, not this one's.
export function tallyVotes(votes) {
  const counts = {};
  for (const target of Object.values(votes ?? {})) {
    counts[target] = (counts[target] || 0) + 1;
  }
  let max = 0;
  for (const n of Object.values(counts)) if (n > max) max = n;
  const topIds = Object.keys(counts).filter((id) => counts[id] === max).sort();
  return { counts, topIds, caught: max > 0 && topIds.length === 1 ? topIds[0] : null };
}

/**
 * Opens the one runoff a round gets.
 *
 * Empty patch when the opening ballot was decisive, when a runoff is already
 * open, or when nobody voted at all — so a caller can fire it unconditionally
 * the moment the ballot closes and let the rule decide whether there is one.
 * That matters online, where any device may reach it.
 */
export function openRunoff(state) {
  if (state?.runoff) return { patch: {} };
  const { topIds, caught } = tallyVotes(state?.votes);
  if (caught || topIds.length < 2) return { patch: {} };
  return { patch: { runoff: { candidates: topIds, votes: {} } } };
}

/**
 * Who the vote landed on, across both ballots — the single answer every screen
 * and both hooks read. Nothing outside this file should tally a ballot itself.
 *
 *   opening ballot decisive  → caught
 *   opening ballot tied      → caught null, needsRunoff true, until openRunoff runs
 *   runoff decisive          → caught
 *   runoff tied too          → caught null, and the fake walks
 *
 * That last line is where "no ties" stops, and it is a deliberate floor rather
 * than an oversight: a table that could not agree twice will not agree a third
 * time, and repeating the runoff until it breaks leaves two stubborn players
 * able to wedge an online room indefinitely.
 *
 * `counts` is always the ballot that decided things, so a caller rendering a
 * tally does not have to branch; `firstCounts` is kept alongside it so the
 * reveal can show the opening vote that forced the runoff.
 */
export function voteOutcome(state) {
  const first = tallyVotes(state?.votes);
  if (!state?.runoff) {
    return {
      caught: first.caught,
      counts: first.counts,
      firstCounts: first.counts,
      candidates: first.topIds,
      isRunoff: false,
      // Only true while the tie is unresolved and no runoff is open yet, so it
      // reads as "act on this now" rather than "a runoff happened".
      needsRunoff: !first.caught && first.topIds.length > 1,
      tiedOut: false,
    };
  }
  const second = tallyVotes(state.runoff.votes ?? {});
  return {
    caught: second.caught,
    counts: second.counts,
    firstCounts: first.counts,
    candidates: state.runoff.candidates ?? [],
    isRunoff: true,
    needsRunoff: false,
    // The runoff tied as well: nobody is accused and the round scores as an escape.
    tiedOut: !second.caught,
  };
}

// --- the reveal ------------------------------------------------------------

/**
 * What a device publishes about ITSELF once the vote closes — nothing more.
 *
 * The display fields ride along with the key because there is no shared board
 * to look a name up in anymore: the published set is the only place the answer
 * exists, so it has to carry enough to render.
 *
 * Returns null for a card that cannot be published (a decoy-mode fake whose
 * pool held nobody else). Callers skip rather than write a malformed card,
 * which deriveTruth would then have to defend against.
 */
export function revealCardFor(card) {
  if (!card) return null;
  // The hint rides along so the reveal can quote what the fake was bluffing off.
  // Safe only because this runs after the vote has closed: the hint is a genre
  // off the secret's show, and the same write publishes the secret itself.
  // Spread rather than `hint: card.hint ?? null` — RTDB drops nulls, so an
  // absent key is what a hintless fake's card reads as anyway, and writing one
  // shape locally and another online is how the two halves drift.
  if (card.isFake) return { isFake: true, ...(card.hint ? { hint: card.hint } : {}) };
  const c = card.character;
  if (!c?.name) return null;
  return {
    key: characterNameKey(c.name),
    name: c.name,
    series: c.series ?? '',
    imageUrl: c.imageUrl ?? '',
  };
}

// Each device publishes its OWN card once the vote has closed, and nothing
// else. The alternative — nominating the host to publish the answer key —
// breaks when the host is the fake and breaks worse when the host leaves
// mid-round, and it would mean the answer sat in state/ where every member
// reads it. This way nothing about the secret exists in state/ until the vote
// is over, and no device is ever trusted with more than what it was dealt.
export function publishCard(state, playerId, card) {
  if (!playerId || !card) return { patch: {} };
  if (state.reveal?.[playerId]) return { patch: {} }; // already in — don't let it be rewritten
  return { patch: { reveal: { ...(state.reveal ?? {}), [playerId]: card } } };
}

export function everyoneRevealed(state, activeIds) {
  if (!activeIds?.length) return false;
  return activeIds.every((id) => state.reveal?.[id]);
}

/**
 * Reconstructs the answer from the published cards alone.
 *
 * Three ways it lands, in order of confidence:
 *
 *   1. Blind mode — the fake's card says so. Nothing to infer.
 *   2. Decoy mode — every crew member was dealt the same character and the fake
 *      was not, so the odd card out is theirs.
 *   3. The fake left (or refused to publish) — they are then the only player
 *      with no card at all, and everyone else agrees.
 *
 * Cards are grouped by `key`, the folded character name, because that is the
 * only reference two devices can both resolve with no shared board between them.
 *
 * Returns fakeId: null when the room genuinely cannot tell, which the results
 * screen shows as an unscored round rather than inventing a culprit.
 *
 * `fakeCard` is whatever the fake was holding — the decoy character in decoy
 * mode, the confession-and-hint in blind. Kept for the same reason `secret` keeps
 * a representative card: the published set is the only record of who a character
 * was, so dropping the odd card out loses the decoy for good. It is null in case
 * 3 above, where the fake is named by elimination and never published anything.
 */
export function deriveTruth(reveal, playerIds) {
  const ids = playerIds ?? [];
  const cards = ids.map((id) => [id, reveal?.[id]]).filter(([, c]) => c);

  const counts = new Map();
  // One representative card per key, kept so the winner can be rendered — the
  // published set is now the only record of who the character was.
  const byKey = new Map();
  for (const [, c] of cards) {
    if (c.isFake || !c.key) continue;
    counts.set(c.key, (counts.get(c.key) || 0) + 1);
    if (!byKey.has(c.key)) byKey.set(c.key, c);
  }
  let key = null;
  let best = 0;
  let tied = false;
  for (const [k, n] of counts) {
    if (n > best) { best = n; key = k; tied = false; } else if (n === best) { tied = true; }
  }
  // Two characters with equal support means there is no crew majority to
  // believe — only reachable below MIN_PLAYERS or once most of the table has
  // left.
  if (tied) key = null;

  const secret = key ? byKey.get(key) : null;

  // Every branch names the fake by id, so the card is one lookup away — and a
  // fake found by elimination has none, which is exactly the null the results
  // screen renders as "they never turned their card over".
  const found = (fakeId) => ({ fakeId, secret, fakeCard: reveal?.[fakeId] ?? null });

  const confessed = cards.find(([, c]) => c.isFake);
  if (confessed) return found(confessed[0]);

  if (key) {
    const odd = cards.filter(([, c]) => !c.isFake && c.key !== key).map(([id]) => id);
    if (odd.length === 1) return found(odd[0]);

    const missing = ids.filter((id) => !reveal?.[id]);
    if (odd.length === 0 && missing.length === 1) return found(missing[0]);
  }

  return { fakeId: null, secret, fakeCard: null };
}

// The caught fake's one shot: name the secret. Blind mode only — in decoy mode
// they were handed a character of their own and have nothing to steal.
//
// Typed rather than picked, because there is no board to pick from. Stored as
// what they typed, not as a key: the results screen quotes it back, and a fold
// is cheap enough to redo at scoring time.
export function submitSteal(state, name) {
  if (state.steal) return { patch: {} };
  const guess = (name || '').trim().replace(/\s+/g, ' ').slice(0, MAX_STEAL_LEN);
  if (!guess) return { patch: {} };
  return { patch: { steal: { name: guess } } };
}

// Whether a typed guess names the secret. Folded on both sides, so "levi
// ackerman" matches "Levi Ackerman" and a name typed without its macrons
// matches one stored with them — the same allowance AniGuess's isCorrectGuess
// makes, and for the same reason: nobody types ō.
export function stealIsCorrect(steal, secret) {
  if (!steal?.name || !secret?.key) return false;
  return characterNameKey(steal.name) === secret.key;
}

export function needsSteal(state, fakeId) {
  if (state.mode !== 'blind' || !fakeId) return false;
  if (state.steal) return false;
  // Through voteOutcome, not tallyVotes: a fake caught in the RUNOFF is caught
  // just the same, and reading the opening ballot alone would silently deny
  // them the steal — a whole screen that never appears.
  return voteOutcome(state).caught === fakeId;
}

// --- scoring ---------------------------------------------------------------

/**
 * Round scores keyed by player id — the shape totalScores and
 * shared/utils/ranking.js's computeRankedPlayers both expect.
 *
 *   crew member who named the fake on EITHER ballot   +1, once
 *   fake, if the vote did not land on them   +2
 *   fake, caught but named the secret correctly   +1
 *
 * Individual credit rather than a team result: it matches the per-player
 * totalScores every other game banks into, and it needs no rule for what a
 * tied team outcome means.
 *
 * Returns {} when the truth could not be reconstructed, which callers gate
 * applyRoundScores on.
 */
export function scoreRound(state, { fakeId, secret } = {}) {
  const out = {};
  if (!fakeId) return out;

  // A Set, so naming the fake on both ballots pays once. Both ballots count
  // because a runoff can open on two names that do not include the fake at all
  // — a player who had them on the opening vote should not lose the point for
  // the forced choice that followed.
  const namedFake = new Set();
  for (const ballot of [state.votes, state.runoff?.votes]) {
    for (const [voter, target] of Object.entries(ballot ?? {})) {
      if (voter !== fakeId && target === fakeId) namedFake.add(voter);
    }
  }
  for (const voter of namedFake) out[voter] = (out[voter] || 0) + 1;

  const { caught } = voteOutcome(state);
  if (caught !== fakeId) {
    out[fakeId] = (out[fakeId] || 0) + 2;
  } else if (state.mode === 'blind' && stealIsCorrect(state.steal, secret)) {
    out[fakeId] = (out[fakeId] || 0) + 1;
  }
  return out;
}

// Folds a round's scores into the running totals. Not idempotent — callers gate
// it, the same way AniRank's is gated by a banking claim.
export function applyRoundScores(totalScores, roundScores) {
  const out = { ...totalScores };
  for (const [id, score] of Object.entries(roundScores ?? {})) {
    out[id] = (out[id] || 0) + score;
  }
  return out;
}
