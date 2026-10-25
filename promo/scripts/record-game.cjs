// Records a game route's canvas and its Web Audio output to WebM via MediaRecorder.
// usage (with `vp dev` running): PUPPETEER_CORE=<path to puppeteer-core> node scripts/record-game.cjs <route> <seconds> <out.webm>
// e.g. route showcase/windows-xp. Needs Google Chrome; see footage/README.md for the rest of the pipeline.
const puppeteer = require(process.env.PUPPETEER_CORE);
const fs = require('fs');

const [route, seconds, out] = process.argv.slice(2);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--autoplay-policy=no-user-gesture-required'],
    defaultViewport: { width: 1280, height: 720, deviceScaleFactor: 2 },
  });
  const page = await browser.newPage();
  page.on('console', (m) => m.type() === 'log' && console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const file = fs.openSync(out, 'w');
  await page.exposeFunction('__chunk', (b64) => fs.writeSync(file, Buffer.from(b64, 'base64')));
  await page.evaluateOnNewDocument(() => {
    // A legacy progress key migrates into a current save, so scene routes don't bounce to the title
    localStorage.setItem('rhythm2000s.guideBookletRead', '1');
    // Tee everything that reaches the speakers into a MediaStream for the recorder
    const Ctx = window.AudioContext;
    window.AudioContext = class extends Ctx {
      constructor(...a) {
        super(...a);
        window.__tap = this.createMediaStreamDestination();
      }
    };
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest, ...rest) {
      if (dest instanceof AudioDestinationNode && window.__tap?.context === dest.context) {
        connect.call(this, window.__tap);
      }
      return connect.call(this, dest, ...rest);
    };
  });
  await page.goto(`http://localhost:5173/#${route}`, { waitUntil: 'networkidle0' });
  await page.keyboard.press('Backquote'); // hide the dev panel
  await page.evaluate(() => {
    const canvas = document.querySelector('#game canvas');
    // Mirror into a 2D canvas each frame: captureStream on the WebGL canvas yields no frames in headless Chrome
    const mirror = document.createElement('canvas');
    mirror.width = canvas.width;
    mirror.height = canvas.height;
    const g = mirror.getContext('2d');
    const copy = () => {
      g.fillStyle = '#000';
      g.fillRect(0, 0, mirror.width, mirror.height);
      g.drawImage(canvas, 0, 0);
      requestAnimationFrame(copy);
    };
    requestAnimationFrame(copy);
    const stream = mirror.captureStream(60);
    for (const t of window.__tap.stream.getAudioTracks()) stream.addTrack(t);
    const rec = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9,opus',
      videoBitsPerSecond: 30_000_000,
    });
    rec.ondataavailable = async (e) => {
      const buf = new Uint8Array(await e.data.arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      await window.__chunk(btoa(s));
    };
    window.__rec = rec;
    rec.start(1000);
    console.log('recording');
  });
  await new Promise((r) => setTimeout(r, Number(seconds) * 1000));
  await page.evaluate(
    () =>
      new Promise((r) => {
        window.__rec.onstop = () => setTimeout(r, 1500);
        window.__rec.stop();
      }),
  );
  fs.closeSync(file);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
