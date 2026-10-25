import { spawn } from 'child_process';
import http from 'http';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${PORT}${path}`, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.pending = new Map();
    this.events = [];
    this.ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id && this.pending.has(data.id)) {
        const { resolve, reject } = this.pending.get(data.id);
        this.pending.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      } else if (data.method) {
        this.events.push(data);
      }
    };
  }

  async ready() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    return new Promise((r) => {
      this.ws.onopen = () => r();
    });
  }

  async send(method, params = {}) {
    await this.ready();
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result?.value;
  }
}

async function run() {
  console.log('Launching Chrome with CDP on port', PORT);
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--enable-webgl',
    '--use-gl=angle',
    '--use-angle=d3d11',
    '--enable-features=SharedArrayBuffer',
    '--window-size=1536,864',
    '--user-data-dir=C:\\Users\\lenovo\\AppData\\Local\\Temp\\chrome-perf-profile',
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    let version = null;
    for (let i = 0; i < 20; i++) {
      try {
        version = await getJson('/json/version');
        if (version) break;
      } catch (e) {
        await sleep(300);
      }
    }
    if (!version) throw new Error('Could not connect to Chrome CDP');

    const targets = await getJson('/json/list');
    const pageTarget = targets.find((t) => t.type === 'page');
    const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.ready();

    console.log('Enabling CDP domains...');
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Network.enable');
    const consoleLogs = [];
    client.ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id && client.pending.has(data.id)) {
        const { resolve, reject } = client.pending.get(data.id);
        client.pending.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      } else if (data.method === 'Runtime.consoleAPICalled') {
        const text = data.params.args.map(a => a.value ?? a.description ?? '').join(' ');
        consoleLogs.push({ type: data.params.type, text, time: Date.now() });
        if (text.includes('GaussianSplat') || text.includes('WebGL') || text.includes('error') || text.includes('warn')) {
          console.log(`[Browser Console ${data.params.type}]`, text);
        }
      } else if (data.method) {
        client.events.push(data);
      }
    };

    console.log('\n--- SCENARIO 1: Desktop Landing Page Baseline ---');
    const startTime = Date.now();
    await client.send('Page.navigate', { url: 'http://localhost:3000/' });
    await sleep(4000);

    // Measure Landing metrics
    const landingMetrics = await client.eval(`(() => {
      const resources = performance.getEntriesByType('resource');
      const totalTransferred = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
      const totalDecoded = resources.reduce((sum, r) => sum + (r.decodedBodySize || 0), 0);
      const images = resources.filter(r => r.initiatorType === 'img' || r.name.match(/\\.(png|jpg|jpeg|webp|avif)/i));
      const heroImg = images.find(r => r.name.includes('hero-building'));
      const galleryImgs = images.filter(r => r.name.includes('gallery'));
      const memory = performance.memory ? {
        usedJSHeapSizeMB: (performance.memory.usedJSHeapSize / 1048576).toFixed(2),
        totalJSHeapSizeMB: (performance.memory.totalJSHeapSize / 1048576).toFixed(2),
      } : null;

      return {
        totalTransferredMB: (totalTransferred / 1048576).toFixed(2),
        totalDecodedMB: (totalDecoded / 1048576).toFixed(2),
        resourceCount: resources.length,
        heroImg: heroImg ? { name: heroImg.name, transferBytes: heroImg.transferSize } : null,
        galleryImgCount: galleryImgs.length,
        memory,
      };
    })()`);

    console.log('Landing Metrics:', JSON.stringify(landingMetrics, null, 2));

    // Measure FPS over 120 frames
    const fpsResult = await client.eval(`new Promise((resolve) => {
      let frames = 0;
      let start = performance.now();
      let last = start;
      const deltas = [];
      function frame(now) {
        deltas.push(now - last);
        last = now;
        frames++;
        if (frames >= 120) {
          const totalTime = now - start;
          const avgFrameTime = totalTime / frames;
          const fps = 1000 / avgFrameTime;
          deltas.sort((a,b) => a-b);
          const p95 = deltas[Math.floor(deltas.length * 0.95)];
          resolve({ fps: fps.toFixed(1), avgFrameTimeMs: avgFrameTime.toFixed(2), p95FrameTimeMs: p95.toFixed(2) });
        } else {
          requestAnimationFrame(frame);
        }
      }
      requestAnimationFrame(frame);
    })`);
    console.log('Landing FPS (idle/scroll demand):', fpsResult);

    console.log('\n--- SCENARIO 2: Transition to CITY_ORBIT ---');
    await client.eval(`(() => {
      // Trigger stage change to LANDING_TO_CITY_TRANSITION or CITY_ORBIT
      const btns = Array.from(document.querySelectorAll('button'));
      const cta = btns.find(b => b.textContent.includes('Residences') || b.textContent.includes('Apartment') || b.textContent.includes('Explore'));
      if (cta) cta.click();
    })()`);
    await sleep(2000);

    const orbitFPS = await client.eval(`new Promise((resolve) => {
      let frames = 0;
      let start = performance.now();
      let last = start;
      const deltas = [];
      function frame(now) {
        deltas.push(now - last);
        last = now;
        frames++;
        if (frames >= 90) {
          const totalTime = now - start;
          const avgFrameTime = totalTime / frames;
          const fps = 1000 / avgFrameTime;
          deltas.sort((a,b) => a-b);
          const p95 = deltas[Math.floor(deltas.length * 0.95)];
          resolve({ fps: fps.toFixed(1), avgFrameTimeMs: avgFrameTime.toFixed(2), p95FrameTimeMs: p95.toFixed(2) });
        } else {
          requestAnimationFrame(frame);
        }
      }
      requestAnimationFrame(frame);
    })`);
    console.log('Orbit FPS:', orbitFPS);

    console.log('\n--- SCENARIO 3: Enter WALKTHROUGH (Unit selection & Confirm) ---');
    await client.eval(`(() => {
      const store = window.__useAppStore.getState();
      store.selectFloor(1);
      store.selectUnit('A');
      store.confirmSelection();
    })()`);
    console.log('Confirmed floor 1 unit A. Waiting for zoom transition and splats to load...');
    const splatStart = Date.now();
    let splatLoaded = false;
    while (Date.now() - splatStart < 45000) {
      const loadedLogs = consoleLogs.filter(l => l.text.includes('[GaussianSplat] loaded:'));
      if (loadedLogs.length >= 2) {
        console.log('Both splat scenes successfully loaded into scene graph in', Date.now() - splatStart, 'ms!');
        splatLoaded = true;
        break;
      }
      await sleep(500);
    }
    if (!splatLoaded) {
      console.warn('Timed out waiting for 2 splat load events. Current splat logs:',
        consoleLogs.filter(l => l.text.includes('GaussianSplat')).map(l => l.text));
    }
    // Allow an extra 2s for initial sort and texture binding
    await sleep(2000);

    const walkthroughMetrics = await client.eval(`(() => {
      const resources = performance.getEntriesByType('resource');
      const totalTransferred = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
      const splatResources = resources.filter(r => r.name.includes('.ksplat') || r.name.includes('.ply') || r.name.includes('.glb'));
      const memory = performance.memory ? {
        usedJSHeapSizeMB: (performance.memory.usedJSHeapSize / 1048576).toFixed(2),
        totalJSHeapSizeMB: (performance.memory.totalJSHeapSize / 1048576).toFixed(2),
      } : null;
      return {
        totalTransferredMB: (totalTransferred / 1048576).toFixed(2),
        splatsLoaded: splatResources.map(s => ({ name: s.name.split('/').pop(), mb: (s.transferSize/1048576).toFixed(1) })),
        memory,
      };
    })()`);
    console.log('Walkthrough Initial Metrics:', JSON.stringify(walkthroughMetrics, null, 2));

    const walkthroughFPS = await client.eval(`new Promise((resolve) => {
      let frames = 0;
      let start = performance.now();
      let last = start;
      const deltas = [];
      function frame(now) {
        deltas.push(now - last);
        last = now;
        frames++;
        if (frames >= 90) {
          const totalTime = now - start;
          const avgFrameTime = totalTime / frames;
          const fps = 1000 / avgFrameTime;
          deltas.sort((a,b) => a-b);
          const p95 = deltas[Math.floor(deltas.length * 0.95)];
          resolve({ fps: fps.toFixed(1), avgFrameTimeMs: avgFrameTime.toFixed(2), p95FrameTimeMs: p95.toFixed(2) });
        } else {
          requestAnimationFrame(frame);
        }
      }
      requestAnimationFrame(frame);
    })`);
    console.log('Walkthrough FPS:', walkthroughFPS);

    console.log('\n--- SCENARIO 4: Memory Leak Test (Visiting 5 Units) ---');
    const memorySnapshots = [];
    for (let u = 1; u <= 5; u++) {
      // Exit walkthrough
      await client.eval(`(() => {
        window.__useAppStore.getState().backToOrbit();
      })()`);
      await sleep(1500);

      const prevLoadedCount = consoleLogs.filter(l => l.text.includes('[GaussianSplat] loaded:')).length;
      await client.eval(`((unitIdx) => {
        const store = window.__useAppStore.getState();
        store.selectFloor(unitIdx + 1);
        store.selectUnit('A');
        store.confirmSelection();
      })(${u})`);
      
      // Wait for splats to finish loading for this unit
      
      // Wait for splats to finish loading for this unit
      const uStart = Date.now();
      while (Date.now() - uStart < 25000) {
        const curCount = consoleLogs.filter(l => l.text.includes('[GaussianSplat] loaded:')).length;
        if (curCount >= prevLoadedCount + 2) break;
        await sleep(500);
      }
      await sleep(1000);

      const mem = await client.eval(`performance.memory ? {
        usedMB: (performance.memory.usedJSHeapSize / 1048576).toFixed(2),
        totalMB: (performance.memory.totalJSHeapSize / 1048576).toFixed(2)
      } : { usedMB: 'N/A' }`);
      memorySnapshots.push({ unitNumber: u, ...mem });
      console.log(`Visited unit ${u}, memory:`, mem);
    }

    console.log('\n--- SCENARIO 5: 4x CPU Throttling & Mobile Emulation Test ---');
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await client.send('Network.setUserAgentOverride', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    });

    await client.send('Page.navigate', { url: 'http://localhost:3000/' });
    await sleep(4000);

    const mobileLandingFPS = await client.eval(`new Promise((resolve) => {
      let frames = 0;
      let start = performance.now();
      let last = start;
      const deltas = [];
      function frame(now) {
        deltas.push(now - last);
        last = now;
        frames++;
        if (frames >= 60) {
          const totalTime = now - start;
          const avgFrameTime = totalTime / frames;
          const fps = 1000 / avgFrameTime;
          deltas.sort((a,b) => a-b);
          const p95 = deltas[Math.floor(deltas.length * 0.95)];
          resolve({ fps: fps.toFixed(1), avgFrameTimeMs: avgFrameTime.toFixed(2), p95FrameTimeMs: p95.toFixed(2) });
        } else {
          requestAnimationFrame(frame);
        }
      }
      requestAnimationFrame(frame);
    })`);
    console.log('Mobile Throttled (4x CPU) Landing FPS:', mobileLandingFPS);

    const mobileSummary = await client.eval(`(() => {
      const resources = performance.getEntriesByType('resource');
      const totalTransferred = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
      const mem = performance.memory ? {
        usedMB: (performance.memory.usedJSHeapSize / 1048576).toFixed(2),
      } : null;
      return {
        totalTransferredMB: (totalTransferred / 1048576).toFixed(2),
        mem,
      };
    })()`);
    console.log('Mobile Summary:', mobileSummary);

    console.log('\nBenchmark completed successfully!');
  } finally {
    try {
      chromeProcess.kill();
    } catch {}
  }
}

run().catch((e) => {
  console.error('Benchmark error:', e);
  process.exit(1);
});
