import { MIN_CAP, MAX_CAP, WRONG_DECLARATION_COST } from './rules';
import { POOL_LABELS } from './prefs';

// The note under each setting, in the two tiers SettingHelp renders: `short` is
// always on screen, `more` only when the player asks for it.
//
// One module rather than two copies of the copy, for the reason anifake/help.js
// and wavelength/help.js both give: the setup screen and the online lobby offer
// overlapping options, and two screens holding the same paragraph by convention
// is a promise nobody keeps.

export const SETTING_HELP = {
  rounds: {
    short: 'You each name one thing in turn, until everybody is out.',
    more: `A go is a single name: you say one, the table answers, and it passes on. Your
           round ends when you declare a category correctly, run out of names, or give
           up — everyone else keeps playing until they do the same. Every round starts
           on fresh categories, picked again or dealt again, so a longer session is more
           clauses rather than longer goes. Who opens moves round the table each time,
           which matters when everyone is answering: the last player to open has heard
           every answer so far.`,
  },

  categoryMode: {
    short: 'Whether you pick your own category or are dealt one you cannot see.',
    // The two halves people get backwards, said plainly: which way the hiding
    // runs, and who is doing the answering. Everything else about a turn — the
    // names, the cap, the declaration, the scoring — is identical.
    more: `Pick your own: you choose a clause only you can see, and every name anyone
           offers is answered by the whole table, each against their own. You win your
           round by declaring somebody else's rule — and each player can only be solved
           once per round, so it is a race.
           Dealt blind: you are handed a clause everyone but you can read, one judge
           answers, and the rule you are working out is your own.`,
  },

  proposalCap: {
    short: 'How many names each of you gets for the whole round.',
    // The scoring is the reason this is a dial rather than a constant: the cap
    // IS the top score, so raising it makes an early solve worth more as well
    // as making a round longer. The miss cost is quoted from rules.js rather
    // than written out, so changing the number cannot leave this lying.
    more: `Spent one at a time as the go passes round, not in one sitting. Solving early
           scores more — a solve is worth the cap minus the names you spent — so this
           sets the size of the prize as well as the length of a round. A wrong
           declaration costs ${WRONG_DECLARATION_COST} of them rather than ending your
           round, and you cannot aim at that player again. Below about six, an unlucky
           opening leaves nothing to reason from.`,
  },

  categoryPool: {
    short: 'Whether this session is about characters or about shows.',
    more: `One pool for the whole table, not one per player. Dealt blind, you cannot see
           your own category, so the prompt telling you what to name is the only clue you
           get about it. Picking your own, everybody is answering the SAME name — so one
           player holding a clause about shows while the table names characters can only
           ever say no.`,
  },

  useCustom: {
    short: 'Put your own written categories in play alongside the built-in ones.',
    more: `They stay on this device — at the top of the list when you are picking, and in
           the deal when you are not. Online, only the category actually in play reaches
           the room, so the rest of your list is never published.`,
  },
};

// Said under the pool control. Not a warning — every pool ships enough clauses
// for an ordinary table — but the count is worth showing.
//
// THE WARNING ONLY APPLIES TO THE DEALT MODE, because only a deal can hand two
// people the same clause without either of them knowing. When everybody picks
// their own, a small list is merely a shorter menu and a duplicate is somebody's
// own decision, so nagging about it would be nagging about nothing.
export const poolCount = ({ size, players, pool, dealt = true }) => {
  const noun = POOL_LABELS[pool]?.plural ?? 'cards';
  const base = `${size} categories about ${noun}.`;
  if (!dealt) return `${base} You can pick one of them or write your own when the round starts.`;
  return players > size
    ? `${base} With ${players} playing, some of you will share one — write a few of your own to spread it out.`
    : base;
};

// The one line the setup screen leads with, and the reason it is worth saying
// out loud: a player arriving from AniGuess or AniTune assumes every game here
// needs an import, and will go and run one before pressing start.
export const NO_LIST_NEEDED = 'No anime list needed — every answer is judged by the table.';

export const capHelp = `Between ${MIN_CAP} and ${MAX_CAP}.`;
