# 3D performance investigation

## Current findings

The production build succeeds. The walkthrough uses one R3F/WebGL canvas and loads two Gaussian splat scenes into it: `ApartmentV2.fast.ksplat` (35.6 MB on disk, about 1.48 million splats from its KSplat header) and a city scene. Desktop high/ultra currently use `la_night_full.ksplat` (about 34 MB); medium uses the 11.8 MB mobile city file; low uses the 1.7 MB decimated city file. While a non-low city asset loads, the 1.7 MB decimated city preview can overlap it briefly.

The apartment file is identical at every tier. Therefore selecting Low reduces the exterior city workload and pixel ratio, but does not reduce the largest fixed splat workload (the apartment). The app's startup benchmark is a synthetic 512x512 fragment-shader workload; it does not exercise splat sorting, CPU worker cost, transparency overdraw, shared-memory bandwidth, or the two-scene workload. Its result cannot establish a 30 FPS tier for this scene.

The walkthrough is mounted only after the persistent city canvas is removed, so it does not normally run alongside the city canvas. `WindowCityView` defines another canvas but has no call sites. The active walk-through has one primary WebGL context. The current sort is WASM SIMD in a worker; GPU sorting is intentionally disabled because of the installed renderer's stability history on integrated/virtualized GPUs.

The Windows host queried for this investigation reports a Ryzen 7 5800H (8 cores / 16 threads), 16 GB installed as two 8 GB DDR4-3200 DIMMs, AMD Radeon(TM) Graphics, and an NVIDIA RTX 3060 Laptop GPU. Windows alone does not tell us which adapter Chrome assigns to this page. The new `GPU` line in the debug panel reports the WebGL renderer string of the actual scene context (when the browser exposes it).

The generic `AMD Radeon(TM) Graphics` renderer previously matched neither the discrete Radeon patterns nor the integrated-GPU patterns. It first fell through to the CPU/RAM fallback; a later classification correction assigned Medium. Same-host 1080p captures show Auto/Medium dipping under 30 FPS during camera panning, while Low remains above 43 FPS. Low is faster but visibly reduces city detail. Auto now treats this renderer as a weak Vega APU with a Medium minimum; adaptive resolution handles slow frames without switching to the reduced Low city asset. The synthetic fragment probe cannot promote this GPU class or push it below Medium. Discrete GPUs retain their existing tiers.

## Likely causes, ranked as hypotheses

1. **Splat sort and fill load.** Two scenes mean sorting and drawing roughly millions of translucent splats. The apartment remains full-sized even on Low. Fast camera rotation also makes CPU sorting more visible because sorts run asynchronously.
2. **iGPU bandwidth and pixel fill.** An integrated GPU shares system memory with the CPU. High DPR makes splat overdraw expensive, and resolution reductions alone cannot remove the fixed apartment sort cost. The actual adapter string and live DPR/FPS are now exposed for verification.
3. **CPU contention during sorting/loading.** The 5800H has 8 cores / 16 threads, but available compute is shared with browser work, workers, React and the OS. Core count by itself does not predict the worker's sustained sort rate.
4. **Startup calibration mismatch.** The fragment-only probe is not representative of sorting two splat layers. It can choose a tier that underestimates the actual scene cost.
5. **Memory pressure during load.** Network file sizes are not peak CPU/GPU memory. Decoding and upload temporarily hold multiple representations, and the city preview overlaps the final city while loading.

1080p host captures confirm the performance difference between Auto/Medium and Low on the AMD iGPU. They do not isolate sorting from raster/fill cost, and they do not measure power or thermal throttling. Browser/GPU traces and the user's regular browser are still useful follow-up checks.

## 1080p host measurements

Captured in the local app in the embedded browser with `?debug=1`; the reported WebGL renderer was `ANGLE (AMD, AMD Radeon(TM) Graphics … Direct3D11)`. The browser was set to a 1920×1080 device-pixel viewport. Its 125% scaling produced a 1536×864 CSS viewport. The FPS values below are 500 ms HUD samples taken across 30 seconds. Camera motion used alternating 120 px horizontal look drags, keeping the player position fixed.

| Fresh tier/run | FPS samples | DPR / framebuffer during capture | Loaded splats |
| --- | ---: | --- | --- |
| Auto → Medium, idle | 36.5 mean (35.6–37.1) | 0.75 / 1152×648 | Apartment 1,481,828 + city 515,159 |
| Auto → Medium, moving | 37.2 mean (19.9–43.9) | 0.75 / 1152×648 | Apartment 1,481,828 + city 515,159 |
| Low, idle | 43.2 mean (39.8–45.6) | adapted from 0.85 to 0.69 / 1059×596 by the end | Apartment 1,481,828 + city 72,865 |
| Low, moving | 50.5 mean (43.8–53.8) | 0.69 / 1059×596 | Apartment 1,481,828 + city 72,865 |

In this capture, Low improved moving-camera average by 13.3 FPS and raised the minimum sample from 19.9 to 43.8 FPS, while preserving the complete apartment splat. The city count fell by about 86%; DPR was also lower. These factors are coupled, so this does not prove whether sort time, transparency fill, or both dominate. In a separate non-fresh manual tier switch, the monitor had already reached its fallback and stopped sampling; that run was excluded from this table.

After applying the new AMD APU rule and rebuilding, a fresh page in Auto displayed `Auto low`; entering the walkthrough loaded the same 72,865 city splats and 1,481,828 apartment splats. This verifies the new selection path, not a second 30-second performance run.

## Renderer options

- **Current GaussianSplats3D + Three/R3F:** least migration work and already consumes the deployed KSplat assets. Its own project documentation identifies CPU sorting and mobile performance as limitations. The project advertises WASM SIMD sorting and frustum culling, matching the current setup.
- **Spark:** the strongest next benchmark candidate because it integrates into Three.js, supports KSPLAT and multiple splat objects, and targets WebGL2. It can preserve the current app architecture and make a like-for-like comparison against current assets. Its feature/performance claims are not treated as benchmark results.
- **PlayCanvas engine / SuperSplat Viewer with SOG or Streamed SOG:** strong option if scene LOD/streaming is needed. Streamed SOG uses chunked LOD data and can reduce loaded working sets. It is a larger integration change, and the current React Three scene would need an engine boundary or replacement. SuperSplat 3 editor's WebGPU requirement is not the same as a WebGL-capable runtime; validate the actual runtime separately.

No renderer migration is selected without a same-device comparison using this apartment, city, camera path, output resolution and quality target. Initial benchmark candidates: current KSplat renderer, Spark with the same KSplat files, then PlayCanvas streamed SOG if Spark cannot meet the target or the working set remains too large.

## Capture procedure

1. Open the production build in the browser on the affected device with `?debug=1` appended to the URL, then enter the walkthrough and select the affected apartment.
2. Wait until the city preview disappears and both final splats have loaded. Move the camera continuously for 30 seconds, then leave it still for 15 seconds.
3. Capture the debug panel at the start and end of movement. Include the browser, Windows power mode, whether it is plugged in, selected quality tier, and whether Windows/browser is configured to use the integrated or discrete GPU. The reported `GPU` line is authoritative for the page's context when available.
4. If possible, repeat at the same window size on the discrete GPU. Keep browser extensions/tabs consistent.

The panel reports FPS and average frame time over each half-second sample, DPR and canvas dimensions, Three renderer counters, active splat counts, adapter string, and Chromium JS heap when available. `renderer.info` is a renderer counter and may not fully reflect draws issued inside the splat library's own viewer callback; use browser GPU traces for authoritative draw/GPU timings.

## Current before/after evidence

| Evidence | Before change | After diagnostics |
| --- | --- | --- |
| Production build | Successful | Successful after diagnostics |
| Duplicate `viewer.update()` calls during R3F frame + DropInViewer callback | Present | Removed in commit `9646da7` |
| Camera-based behind-eye culling on apartment | Off | On in commit `9646da7` |
| Generic Ryzen 7 5800H Radeon iGPU classification | Unknown → High CPU/RAM fallback | Weak integrated → Medium Auto minimum; adaptive resolution remains available |
| Runtime FPS / frame time / adapter / splat counts | Not available in app | Available with `?debug=1` |
| 30-second AMD iGPU host capture | Not captured | Auto/Medium 37.2 FPS mean with 19.9 minimum; Low 50.5 mean with 43.8 minimum while panning |

## References checked

- [GaussianSplats3D repository and documented limitations](https://github.com/mkkellogg/GaussianSplats3D)
- [Spark renderer repository](https://github.com/sparkjsdev/spark)
- [PlayCanvas SuperSplat formats, including Streamed SOG](https://github.com/playcanvas/developer-site/blob/main/docs/user-manual/supersplat/editor/import-export.md)
- [PlayCanvas splat-transform and Streamed SOG](https://github.com/playcanvas/splat-transform)
- [SuperSplat Viewer runtime options](https://github.com/playcanvas/supersplat-viewer)
