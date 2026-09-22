declare module 'mind-ar/dist/mindar-face-three.prod.js' {
  import type { WebGLRenderer, Scene, PerspectiveCamera, Object3D } from 'three';

  export interface MindARThreeOptions {
    container: HTMLElement;
  }

  export interface AnchorTarget {
    group: Object3D;
  }

  export class MindARThree {
    renderer: WebGLRenderer;
    scene: Scene;
    camera: PerspectiveCamera;
    constructor(options: MindARThreeOptions);
    start(): Promise<void>;
    stop(): void;
    addAnchor(index: number): AnchorTarget;
  }
}
