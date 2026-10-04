declare module '@mkkellogg/gaussian-splats-3d' {
  export class AbortablePromise<T> extends Promise<T> {
    abort(): void;
  }

  export enum LogLevel {
    None = 0,
    Error = 1,
    Warning = 2,
    Info = 3,
    Debug = 4,
  }

  export enum RenderMode {
    Progressive = 0,
    Always = 1,
  }

  export enum SceneRevealMode {
    None = 0,
    Gradual = 1,
    Instant = 2,
  }

  export enum SceneFormat {
    Splat = 0,
    KSplat = 1,
    Ply = 2,
  }

  export enum SplatRenderMode {
    GaussianSplats = 0,
    BigPoints = 1,
  }

  export interface ViewerOptions {
    selfDrivenMode?: boolean;
    useBuiltInControls?: boolean;
    camera?: import('three').Camera;
    renderer?: import('three').WebGLRenderer;
    rootElement?: HTMLElement | null;
    dropInMode?: boolean;
    gpuAcceleratedSort?: boolean;
    sharedMemoryForWorkers?: boolean;
    integerBasedSort?: boolean;
    enableSIMDInSort?: boolean;
    halfPrecisionCovariancesOnGPU?: boolean;
    optimizeSplatData?: boolean;
    freeIntermediateSplatData?: boolean;
    inMemoryCompressionLevel?: number;
    sphericalHarmonicsDegree?: number;
    renderMode?: number;
    sceneRevealMode?: number;
    antialiased?: boolean;
    sortQualityAware?: boolean;
  }

  export interface SplatSceneOptions {
    path?: string;
    splatAlphaRemovalThreshold?: number;
    showLoadingUI?: boolean;
    position?: number[];
    rotation?: number[];
    scale?: number[];
    onProgress?: (progress: number) => void;
  }

  export class Viewer {
    constructor(options?: ViewerOptions);
    init(): void;
    addSplatScene(path: string, options?: SplatSceneOptions): AbortablePromise<void>;
    addSplatScenes(sceneOptions: SplatSceneOptions[], showLoadingUI?: boolean): AbortablePromise<void>;
    removeSplatScene(index: number, showLoadingUI?: boolean): AbortablePromise<void>;
    getSplatScene(index: number): SplatScene;
    getSceneCount(): number;
    setActiveSphericalHarmonicsDegrees(degrees: number): void;
    update(renderer: import('three').WebGLRenderer, camera: import('three').Camera): void;
    dispose(): Promise<void>;
    splatMesh: import('three').Object3D | null;
    onSplatMeshChanged(callback: () => void): void;
  }

  export class DropInViewer extends import('three').Group {
    constructor(options?: ViewerOptions);
    addSplatScene(path: string, options?: SplatSceneOptions): AbortablePromise<void>;
    addSplatScenes(sceneOptions: SplatSceneOptions[], showLoadingUI?: boolean): AbortablePromise<void>;
    removeSplatScene(index: number, showLoadingUI?: boolean): AbortablePromise<void>;
    getSplatScene(index: number): SplatScene;
    getSceneCount(): number;
    setActiveSphericalHarmonicsDegrees(degrees: number): void;
    dispose(): Promise<void>;
    /** The current splat mesh (null until a scene is loaded). */
    splatMesh: import('three').Mesh | null;
    /**
     * Present on some library versions; the app calls these defensively
     * (try/catch) so they are declared optional here.
     */
    setRenderer?(renderer: import('three').WebGLRenderer): void;
    setCamera?(camera: import('three').Camera): void;
    /** The underlying Viewer instance (always present in drop-in mode). */
    viewer: Viewer;
  }

  export class SplatBuffer {
    static loadFromFile(path: string, format: SceneFormat, onProgress?: (p: number) => void): Promise<any>;
    static convertToKSplat(buffer: any, compressionLevel?: number, onProgress?: (p: number) => void): Promise<Uint8Array>;
  }

  export class KSplatLoader {}
  export class SplatLoader {}
  export class PlyLoader {}
  export class SpzLoader {}
  export class PlayCanvasCompressedPlyParser {}
  export class PlyParser {}
  export class SplatBufferGenerator {}
  export class SplatPartitioner {}

  export const Utils: {
    isMobile: boolean;
  };
}
