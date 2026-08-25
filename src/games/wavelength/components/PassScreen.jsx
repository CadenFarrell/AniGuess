import { Button, Card, Screen } from '../../../shared/ui';

// The hand-off gate. Follows anifake's SecretReveal: name who the device is for,
// require a deliberate tap, and NEVER auto-advance on a timer — the whole
// mechanism is that the screen stays useless until the right person is holding
// it, and a screen that moves on by itself defeats that while somebody is still
// passing it across the table.
//
// `note` is what the next person is about to do, not a warning to the current
// one. Everyone can see this screen; nothing secret may appear on it.
export default function PassScreen({ name, note, cta = "I'm ready", onReady }) {
  return (
    <Screen center>
      <Card padding="lg" className="text-center">
        <p className="font-display text-sm font-extrabold uppercase tracking-widest text-white/50">
          Pass the device to
        </p>
        <p className="my-4 font-display text-4xl font-extrabold text-white">{name}</p>
        {note && <p className="mb-6 text-base text-white/60">{note}</p>}
        <Button variant="primary" size="xl" fullWidth onClick={onReady}>
          {cta}
        </Button>
      </Card>
    </Screen>
  );
}
