import { useState } from 'react';
import {
  Avatar, Badge, Button, Card, Combobox, GhostButton, Input, Screen,
} from '../../../shared/ui';
import { MAX_CLUE_LEN, needsCardPool } from '../rules';
import { browseCards, poolNoun, rankCards } from '../utils/cards';
import ClueCard from './ClueCard';
import Dial from './Dial';
import SpectrumPicker from './SpectrumPicker';

// The psychic's turn: choose the spectrum, then say something about the target.
//
// TWO STEPS ON ONE DEVICE, AND ONE WRITE AT THE END. The spectrum is not a
// phase — no round state exists for "picking" — because there is nothing for
// anyone else to see or wait on, and a phase for it would be a round trip
// online for a decision made in two seconds. It goes out with the clue, in the
// same patch, which is what makes a guess phase with no spectrum
// unrepresentable. See rules.submitClue.
//
// THE SPECTRUM IS CHOSEN BEFORE THE TARGET IS SHOWN, deliberately. The other
// order is friendlier — you would see where your point sits under each option
// and take whichever you can clue — and that is exactly the problem: it turns
// the hard part of the game into shopping. This is the faithful order, and it
// is one swap of the two blocks below to change if it plays badly.
//
// The clue is typed here and cleaned in rules.submitClue rather than on the way
// out of this input, so a clue arriving from another device online is cleaned by
// the same rule. The counter below is therefore advisory — maxLength stops the
// typing, but the truncation that actually matters happens in the rules.
//
// `cards` SEARCHES, `readroom` IS DEALT, and the two props say which is which:
// `cards` is the whole eligible pool this device may offer, `hand` is what was
// dealt into secrets/. Neither mode ever sees the other's prop populated — see
// rules.needsCardPool / rules.dealsHand for why they came apart.
//
// NOTHING THE PSYCHIC SEARCHES REACHES THE ROOM. The pool is computed on this
// device from the roster every member already holds, every query is local, and
// only the card they finally play is published — the same property SpectrumPicker
// has, and for the same reason it is stated out loud there.
export default function PsychicView({
  mode = 'text', target, hand = [], cards = [], cardPool = 'characters',
  excludeId = null, roundNumber, totalRounds, onSubmit,
}) {
  const [spectrum, setSpectrum] = useState(null);
  const [clue, setClue] = useState('');
  // cards only: the card searched up, held whole rather than as an id — search
  // results are not an array this component keeps, so there is nothing to look
  // an id up in.
  const [chosen, setChosen] = useState(null);
  const [query, setQuery] = useState('');
  // Ranked in the change handler rather than in the render body, matching
  // AniGuess's GameScreen — the list must not reshuffle under the cursor on a
  // re-render nobody typed into.
  const [matches, setMatches] = useState([]);
  // Drawn ONCE. browseCards reaches Math.random, so a render-body call would
  // deal a different strip on every keystroke. Same lazy initializer as
  // SpectrumPicker's three suggestions.
  const [browse] = useState(() => browseCards(cards));
  // readroom only: the psychic's own dial, which becomes the answer key.
  const [placement, setPlacement] = useState(null);

  const header = (
    <div className="mb-6 flex items-center justify-between gap-3">
      <h2 className="font-display text-2xl font-extrabold text-white">You're the psychic</h2>
      <Badge tone="purple">Round {roundNumber}/{totalRounds}</Badge>
    </div>
  );

  if (!spectrum) {
    return (
      <Screen>
        {header}
        <p className="mb-6 text-base text-white/60">
          Pick what this round is about. Nobody else sees the options — only
          whichever one you choose.
        </p>
        <SpectrumPicker
          excludeId={excludeId}
          // WHICH SPECTRA ARE WORTH OFFERING follows the deck this round deals
          // from — a Shows round has no use for WOULD LOSE → WOULD WIN. text
          // mode deals no cards, so it passes null and is offered everything:
          // its setup screen never shows the pool control, and filtering on a
          // setting the player was never shown would hide half the registry for
          // no visible reason. Same needsCardPool gate every other pool control
          // in the game sits behind.
          pool={needsCardPool(mode) ? cardPool : null}
          onPick={setSpectrum}
        />
      </Screen>
    );
  }

  // The one card everyone will be asked to place. Dealt as a hand of one — see
  // rules.normalizeHand on why it stays plural.
  const subject = mode === 'readroom' ? hand[0] ?? null : null;

  // 'characters' / 'shows'; sliced to the singular at the one place that wants
  // one, which both of them survive.
  const noun = poolNoun(cardPool);

  const search = (text) => {
    setQuery(text);
    setMatches(rankCards(cards, text));
  };

  const pick = (card) => {
    setChosen(card);
    setQuery('');
    setMatches([]);
  };

  const ready = mode === 'text' ? clue.trim().length > 0
    : mode === 'cards' ? Boolean(chosen)
      : Boolean(subject) && Number.isFinite(placement);

  const submit = () => {
    if (!ready) return;
    onSubmit({
      spectrum,
      text: mode === 'text' ? clue : undefined,
      card: mode === 'readroom' ? subject : chosen,
      placement: mode === 'readroom' ? placement : undefined,
    });
  };

  return (
    <Screen>
      {header}

      {mode === 'readroom' ? (
        <>
          <Card padding="lg" className="mb-6">
            <p className="mb-4 text-base text-white/60">
              Put this where <em>you</em> think it belongs. There is no right
              answer — everyone else is guessing where you'll put it.
            </p>
            <ClueCard card={subject} size="lg" className="mb-6" />
            <Dial spectrum={spectrum} value={placement} onChange={setPlacement} />
          </Card>
          <Button variant="primary" size="xl" fullWidth disabled={!ready} onClick={submit}>
            Lock in my answer
          </Button>
        </>
      ) : (
        <>
          <Card padding="lg" className="mb-6">
            <p className="mb-4 text-base text-white/60">
              Only you can see the target. Land everyone else's dial right on it.
            </p>
            <Dial spectrum={spectrum} target={target} label="The hidden target" />
          </Card>

          {mode === 'cards' ? (
            <>
              <Card title="Your card" padding="lg" className="mb-6">
                {chosen ? (
                  <>
                    <p className="mb-4 text-base text-white/60">
                      This is what the table will place. Nobody sees anything
                      else you looked at.
                    </p>
                    <ClueCard card={chosen} size="lg" className="mb-4" />
                    <GhostButton fullWidth onClick={() => pick(null)}>
                      Search for a different one
                    </GhostButton>
                  </>
                ) : (
                  <>
                    <p className="mb-4 text-base text-white/60">
                      Find the {noun.slice(0, -1)} that sits closest to the
                      target. Only {noun} this round can use are listed —
                      anything already played is gone.
                    </p>
                    <Combobox
                      value={query}
                      onChange={search}
                      suggestions={matches}
                      onSelect={pick}
                      optionKey={(c) => c.id}
                      ariaLabel={`Search ${noun}`}
                      placeholder={`search your ${noun}…`}
                      renderOption={(c) => (
                        <>
                          <Avatar src={c.imageUrl} alt="" size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-white">
                              {c.title}
                            </span>
                            {c.subtitle && (
                              <span className="block truncate text-sm text-white/40">
                                {c.subtitle}
                              </span>
                            )}
                          </span>
                        </>
                      )}
                    />
                    {/* The cold start a search box has and a hand did not: with
                        nothing typed there is nothing on screen to react to, and
                        a psychic who has never read the shared list has no first
                        keystroke. These are a starting point, not a hand — every
                        other eligible card is one query away. */}
                    {!query && browse.length > 0 && (
                      <div className="mt-5">
                        <p className="mb-3 font-display text-sm font-extrabold uppercase
                          tracking-widest text-white/40"
                        >
                          Or start from one of these
                        </p>
                        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                          {browse.map((card) => (
                            <ClueCard key={card.id} card={card} onSelect={() => pick(card)} />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </Card>
              <Button variant="primary" size="xl" fullWidth disabled={!ready} onClick={submit}>
                {chosen ? `Play ${chosen.title}` : 'Pick a card'}
              </Button>
            </>
          ) : (
            <>
              <Card padding="lg" className="mb-6">
                <label
                  htmlFor="aniwave-clue"
                  className="mb-2 block font-display text-sm font-extrabold uppercase tracking-widest text-white/50"
                >
                  Your clue
                </label>
                <Input
                  id="aniwave-clue"
                  value={clue}
                  maxLength={MAX_CLUE_LEN}
                  placeholder="a word or a phrase…"
                  autoComplete="off"
                  onChange={(e) => setClue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && ready) submit(); }}
                />
                <p className="mt-2 text-right text-sm text-white/40">
                  {clue.length}/{MAX_CLUE_LEN}
                </p>
              </Card>
              <Button variant="primary" size="xl" fullWidth disabled={!ready} onClick={submit}>
                Give the clue
              </Button>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
