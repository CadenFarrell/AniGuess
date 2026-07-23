export default function WaitingScreen({ emoji = '📵', title, subtitle }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-md">
        <div className="text-7xl mb-5">{emoji}</div>
        <h2 className="text-3xl font-black text-white mb-3">{title}</h2>
        {subtitle && <p className="text-white/60 text-lg">{subtitle}</p>}
      </div>
    </div>
  );
}
