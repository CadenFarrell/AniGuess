import { Component } from 'react';
import { storage } from '../services/storage';
import { keysToClear } from '../utils/resetKeys';
import Button from '../ui/Button';
import Screen from '../ui/Screen';

// The one deliberate exception to "no class components" — React requires
// a class component for componentDidCatch/getDerivedStateFromError.
//
// Mounted twice, and the two do different jobs. The root one (main.jsx) is the
// last resort: nothing is left to return to, so it only offers the reset. The
// per-game one (HubScreen) wraps a single <Game>, so it can offer the menu
// instead — one game's render crash used to blank the whole arcade with no way
// back, which turned any bug in the newest game into a bug in all of them.
export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('AniArcade crashed:', error, info);
  }

  // Clears everything except the player's imported profiles — see
  // resetKeys.js for why the list is inverted rather than enumerating the
  // game keys, which is what left this clearing one stale name for three games.
  handleReset = () => {
    for (const key of keysToClear(storage.keys())) storage.removeItem(key);
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { onBack } = this.props;
      return (
        // No <Backdrop /> here: the boundary catches render crashes, so it has
        // to stay as close to plain markup as possible.
        <Screen center width="md" className="text-center">
          <div className="text-6xl mb-4">💥</div>
          <h2 className="font-display text-3xl font-extrabold text-white mb-3">
            Something went wrong
          </h2>
          <p className="text-white/60 text-lg mb-8">
            {onBack
              ? 'This game hit an unexpected error. The rest of the arcade is fine — head back to the menu, or reset if it keeps happening.'
              : 'AniArcade hit an unexpected error. Resetting your in-progress game usually fixes it.'}
          </p>
          {/* Leaving is offered first and styled as the primary action: it is
              the one that costs nothing. Reset discards every saved room, tier
              list and setting on the device, so it should not be the button
              someone hits on the way past. Profiles survive either way. */}
          {onBack && (
            <Button variant="primary" size="xl" fullWidth onClick={onBack} className="mb-4">
              🏠 Back to the hub
            </Button>
          )}
          <Button
            variant={onBack ? 'danger' : 'primary'}
            size="lg"
            fullWidth
            onClick={this.handleReset}
          >
            🔄 Reset Game &amp; Reload
          </Button>
          {onBack && (
            <p className="mt-4 text-sm text-white/40">
              Reset clears saved rooms, tier lists and settings. Your profiles and
              imported lists are kept.
            </p>
          )}
        </Screen>
      );
    }
    return this.props.children;
  }
}
