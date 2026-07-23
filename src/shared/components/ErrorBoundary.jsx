import { Component } from 'react';
import { storage } from '../services/storage';
import Button from '../ui/Button';
import Screen from '../ui/Screen';

// The one deliberate exception to "no class components" — React requires
// a class component for componentDidCatch/getDerivedStateFromError.
export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('AniGuess crashed:', error, info);
  }

  handleReset = () => {
    storage.removeItem('aniguess_session');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        // No <Backdrop /> here: the boundary catches render crashes, so it has
        // to stay as close to plain markup as possible.
        <Screen center width="md" className="text-center">
          <div className="text-6xl mb-4">💥</div>
          <h2 className="font-display text-3xl font-extrabold text-white mb-3">
            Something went wrong
          </h2>
          <p className="text-white/60 text-lg mb-8">
            AniGuess hit an unexpected error. Resetting your in-progress game usually fixes it.
          </p>
          <Button variant="primary" size="lg" fullWidth onClick={this.handleReset}>
            🔄 Reset Game &amp; Reload
          </Button>
        </Screen>
      );
    }
    return this.props.children;
  }
}
