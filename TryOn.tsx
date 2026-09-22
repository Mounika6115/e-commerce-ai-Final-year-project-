interface TryOnProps {
  initialModelUrl?: string;
  onClose: () => void;
}

const MODELS = [
  { label: 'Thug Life', url: '/api/models/thug_life__cool_glasses__stylise_goggles.glb' },
  { label: 'Aviation Goggles', url: '/api/models/aviation_goggles_revised.glb' },
  { label: 'Futuristic Glasses', url: '/api/models/futuristic_glasses__super_sun_glasses__goggles.glb' },
];

export default function TryOn({ initialModelUrl, onClose }: TryOnProps) {
  // Sort models to put initialModelUrl first if provided
  const sortedModels = [...MODELS];
  if (initialModelUrl) {
    const idx = sortedModels.findIndex(m => m.url === initialModelUrl);
    if (idx > -1) {
      const [m] = sortedModels.splice(idx, 1);
      sortedModels.unshift(m);
    }
  }

  const params = new URLSearchParams();
  sortedModels.forEach((m) => {
    params.append('model', m.url);
    params.append('label', m.label);
  });
  const iframeSrc = `/try-on.html?${params.toString()}`;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000' }}>
      {/* Full-screen iframe — CDN-loaded A-Frame + MindAR, no bundler issues */}
      <iframe
        src={iframeSrc}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
        allow="camera; microphone"
        title="AR Try-On"
      />

      {/* Close button overlaid from React so it always works */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          zIndex: 10000,
          background: 'rgba(0,0,0,0.55)',
          color: '#fff',
          border: '1.5px solid rgba(255,255,255,0.3)',
          borderRadius: '50%',
          width: 42,
          height: 42,
          fontSize: 20,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(6px)',
        }}
        aria-label="Close AR"
      >
        ✕
      </button>

      {/* AR label top-left */}
      <div
        style={{
          position: 'absolute',
          top: 18,
          left: 16,
          zIndex: 10000,
          color: '#fff',
          fontWeight: 900,
          fontSize: 15,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        <span>👓 AR Try-On</span>
        <span
          style={{
            fontSize: 9,
            background: 'rgba(129,140,248,0.35)',
            border: '1px solid rgba(129,140,248,0.6)',
            padding: '2px 8px',
            borderRadius: 20,
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          LIVE
        </span>
      </div>
    </div>
  );
}
