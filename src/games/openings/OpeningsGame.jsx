import { Backdrop, GhostButton, Screen, Wordmark } from '../../shared/ui';

// Placeholder so the hub has a second registry entry to render and the
// opening-quiz branch has an obvious place to land. Replace wholesale.
export default function OpeningsGame({ onExit }) {
  return (
    <>
      <Backdrop />
      <Screen center>
        <div className="mb-6 text-center text-6xl">🎵</div>
        <Wordmark tone="blue" size="md" subtitle="Not built yet." className="mb-10">
          Name That Opening
        </Wordmark>
        <div className="text-center">
          <GhostButton onClick={onExit}>← Back to hub</GhostButton>
        </div>
      </Screen>
    </>
  );
}
