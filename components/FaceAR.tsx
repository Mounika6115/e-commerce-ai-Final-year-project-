import { useEffect, useRef, useState } from 'react';
import { HemisphereLight, DirectionalLight } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface FaceARProps {
  modelUrl: string;
}

const FaceAR = ({ modelUrl }: FaceARProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!containerRef.current) return;

    let stopped = false;
    let mindarInstance: any = null;
    let renderer: any = null;

    const loadAR = async () => {
      setStatus('loading');
      setErrorMsg('');

      try {
        // Dynamic import keeps the large mind-ar bundle out of the initial chunk
        const { MindARThree } = await import('mind-ar/dist/mindar-face-three.prod.js');

        if (stopped) return;

        const mindarThree = new MindARThree({ container: containerRef.current! });
        mindarInstance = mindarThree;
        renderer = mindarThree.renderer;

        const { scene, camera } = mindarThree;

        // Lighting
        scene.add(new HemisphereLight(0xffffff, 0xbbbbff, 1.2));
        const dirLight = new DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(0, 2, 2);
        scene.add(dirLight);

        // Add face anchor at nose-bridge (index 168)
        const anchor = mindarThree.addAnchor(168);

        // Load the GLB model
        await new Promise<void>((resolve, reject) => {
          const loader = new GLTFLoader();
          loader.load(
            modelUrl,
            (gltf) => {
              const model = gltf.scene;
              model.scale.set(1.6, 1.6, 1.6);
              model.position.set(0, 0.04, 0.07);
              anchor.group.add(model);
              resolve();
            },
            undefined,
            (err) => reject(err),
          );
        });

        if (stopped) {
          mindarThree.stop();
          return;
        }

        await mindarThree.start();

        if (stopped) {
          renderer.setAnimationLoop(null);
          mindarThree.stop();
          return;
        }

        setStatus('ready');

        renderer.setAnimationLoop(() => {
          renderer.render(scene, camera);
        });
      } catch (err: any) {
        console.error('FaceAR error:', err);
        if (!stopped) {
          setStatus('error');
          setErrorMsg(
            err?.message?.includes('camera') || err?.name === 'NotAllowedError'
              ? 'Camera access denied. Please allow camera and reload.'
              : 'Failed to start AR. Make sure you\'re on a secure (HTTPS) connection.',
          );
        }
      }
    };

    loadAR();

    return () => {
      stopped = true;
      try { renderer?.setAnimationLoop(null); } catch {}
      try { mindarInstance?.stop(); } catch {}
    };
  }, [modelUrl]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', background: '#000' }}
    >
      {status === 'loading' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            background: '#000',
            zIndex: 10,
            gap: 14,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              border: '4px solid rgba(255,255,255,0.2)',
              borderTop: '4px solid #818cf8',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <div style={{ fontSize: 16, fontWeight: 700 }}>Starting AR Camera…</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>Allow camera access when prompted</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {status === 'error' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            background: '#111',
            zIndex: 10,
            gap: 12,
            padding: 32,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>AR Unavailable</div>
          <div style={{ fontSize: 13, opacity: 0.7, maxWidth: 280 }}>{errorMsg}</div>
        </div>
      )}
    </div>
  );
};

export default FaceAR;
