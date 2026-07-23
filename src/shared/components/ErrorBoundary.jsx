import { Component } from 'react';
import { storage } from '../services/storage';

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
        <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 text-center">
          <div className="w-full max-w-lg">
            <div className="text-6xl mb-4">💥</div>
            <h2 className="text-3xl font-black text-white mb-3">Something went wrong</h2>
            <p className="text-white/60 text-lg mb-8">
              AniGuess hit an unexpected error. Resetting your in-progress game usually fixes it.
            </p>
            <button
              onClick={this.handleReset}
              className="w-full py-4 bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold text-lg rounded-xl transition-all"
            >
              🔄 Reset Game & Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
