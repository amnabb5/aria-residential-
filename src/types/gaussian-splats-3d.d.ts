declare module '@mkkellogg/gaussian-splats-3d' {
  import * as THREE from 'three';

  export interface DropInViewerOptions {
    gpuAcceleratedSort?: boolean;
    sharedMemoryForWorkers?: boolean;
    integerBasedSort?: boolean;
    enableSIMDInSort?: boolean;
    halfPrecisionCovariancesOnGPU?: boolean;
    optimizeSplatData?: boolean;
    freeIntermediateSplatData?: boolean;
    inMemoryCompressionLevel?: number;
    sphericalHarmonicsDegree?: number;
    selfDrivenMode?: boolean;
    useBuiltInControls?: boolean;
    renderMode?: number;
    sceneRevealMode?: number;
    camera?: THREE.Camera | undefined;
    renderer?: THREE.WebGLRenderer | undefined;
    rootElement?: HTMLElement | null;
    dropInMode?: boolean;
    dynamicScene?: boolean;
    antialiased?: boolean;
    kernel2DSize?: number;
    focalAdjustment?: number;
    maxScreenSpaceSplatSize?: number;
    logLevel?: number;
    enableOptionalEffects?: boolean;
    splatRenderMode?: number;
    sceneFadeInRateMultiplier?: number;
    threeScene?: THREE.Scene;
    ignoreDevicePixelRatio?: boolean;
    webXRMode?: number;
  }

  export interface AddSplatSceneOptions {
    position?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
    splatAlphaRemovalThreshold?: number;
    showLoadingUI?: boolean;
    onProgress?: (percent: number, label: string, status: number) => void;
    format?: number;
    progressiveLoad?: boolean;
    headers?: Record<string, string>;
  }

  export class DropInViewer extends THREE.Group {
    constructor(options?: DropInViewerOptions);
    addSplatScene(path: string, options?: AddSplatSceneOptions): AbortablePromise;
    addSplatScenes(
      sceneOptions: Array<AddSplatSceneOptions & { path: string }>,
      showLoadingUI?: boolean,
    ): AbortablePromise;
    getSplatScene(index: number): object | null;
    removeSplatScene(index: number): Promise<void>;
    dispose(): Promise<void>;
  }

  export class Viewer {
    constructor(options?: DropInViewerOptions);
    splatMesh: THREE.Mesh & {
      getSplatCount(): number;
      getMaxSplatCount(): number;
      updateRenderIndexes(indexes: Uint32Array, count: number): void;
    };
    addSplatScene(path: string, options?: AddSplatSceneOptions): AbortablePromise;
    update(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void;
    onSplatMeshChanged(callback: () => void): void;
    dispose(): Promise<void>;
    setupSortWorker(splatMesh: unknown): Promise<void>;
    runSplatSort(force?: boolean, forceSortAll?: boolean): Promise<boolean>;
  }

  export class AbortablePromise implements Promise<unknown> {
    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2>;
    catch<TResult = never>(
      onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
    ): Promise<unknown | TResult>;
    finally(onfinally?: (() => void) | null): Promise<unknown>;
    abort(): void;
    readonly id: number;
    readonly promise: Promise<unknown>;
  }
}
