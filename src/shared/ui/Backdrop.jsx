// Purely decorative colour blobs behind the page. Fixed rather than absolute so
// they stay put while a long screen scrolls, and pointer-events-none (via the
// `blob` utility) so they never intercept a click. The animation is disabled
// under prefers-reduced-motion in src/index.css.
export default function Backdrop() {
  return (
    <div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden">
      <div className="blob bg-pop-pink h-80 w-80 -top-20 -left-16" />
      <div
        className="blob bg-pop-purple h-96 w-96 top-1/3 -right-24"
        style={{ animationDelay: '-8s' }}
      />
      <div
        className="blob bg-pop-blue h-72 w-72 -bottom-20 left-1/4"
        style={{ animationDelay: '-16s' }}
      />
    </div>
  );
}
