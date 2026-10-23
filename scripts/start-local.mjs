import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const windows = process.platform === 'win32';
let server;
let stopping = false;

async function runNpm(args) {
  // Only fixed commands are passed to the Windows command shell.
  const child = spawn(windows ? 'npm.cmd' : 'npm', args, {
    cwd: root,
    stdio: 'inherit',
    shell: windows,
  });
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`npm ${args[0]} tamamlanamadi (${code}).`)),
    );
  });
}

function available(port) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, '0.0.0.0', () => probe.close(() => resolve(true)));
  });
}

async function main() {
  if (Number(process.versions.node.split('.')[0]) < 24)
    throw new Error('Node.js 24 veya daha yeni LTS surumunu nodejs.org adresinden kur.');

  const stamp = path.join(root, 'node_modules', '.stadium-local-setup');
  const fingerprint = createHash('sha256')
    .update(readFileSync('package-lock.json'))
    .update(`${process.versions.node}:${process.platform}:${process.arch}`)
    .digest('hex');
  if (!existsSync(stamp) || readFileSync(stamp, 'utf8') !== fingerprint) {
    console.log('Ilk kurulum yapiliyor. Internet baglantisi gerekli; bu islem biraz surebilir.');
    await runNpm(['ci', '--include=dev', '--no-audit', '--no-fund']);
    writeFileSync(stamp, fingerprint);
  }
  console.log('Program hazirlaniyor...');
  await runNpm(['run', 'build']);

  let port = 3001;
  while (port < 3021 && !(await available(port))) port++;
  if (port === 3021) throw new Error('3001-3020 portlari dolu. Acik Naberlo pencerelerini kapat.');
  const accessCode = randomBytes(8).toString('hex');
  server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      HOST: '0.0.0.0',
      PORT: String(port),
      STADIUM_ACCESS_TOKEN: accessCode,
    },
  });
  let startupError;
  server.once('error', (error) => (startupError = error));
  server.once('exit', (code) => {
    if (!stopping) process.exitCode = code || 1;
  });
  const localUrl = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (startupError) throw startupError;
    if (server.exitCode !== null || server.signalCode !== null)
      throw new Error('Sunucu kapandi. Yukaridaki hata mesajini kontrol et.');
    try {
      const response = await fetch(`${localUrl}/api/health`, {
        headers: { Authorization: `Bearer ${accessCode}` },
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok && (await response.json()).service === 'naberlo') {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error('Sunucu zamaninda baslamadi. Tekrar dene.');

  console.log('\nNABERLO HAZIR');
  console.log(`Giris kodu: ${accessCode}`);
  console.log('Bu kodu bilgisayar ve telefonun giris ekraninda kullan.');
  console.log('Kod her baslatmada yenilenir; projelerin korunur.');
  console.log('\nTELEFONDAN AC:');
  const addresses = new Set();
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries || []) {
      if (
        entry.family === 'IPv4' &&
        !entry.internal &&
        /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry.address)
      )
        addresses.add(entry.address);
    }
  }
  for (const address of addresses) console.log(`http://${address}:${port}`);
  if (!addresses.size) console.log('Yerel ag adresi bulunamadi. Bilgisayari ev Wi-Fi agina bagla.');
  console.log('Telefon ve bilgisayar ayni Wi-Fi aginda olmali.');
  console.log('Windows ag izni sorarsa yalnizca Ozel aglar icin izin ver.');
  console.log('Bilgisayari ve bu pencereyi acik tut. Durdurmak icin Ctrl+C.\n');

  if (process.env.STADIUM_NO_BROWSER !== '1') {
    const browser = windows
      ? spawn('cmd.exe', ['/d', '/c', 'start', '', localUrl], { stdio: 'ignore' })
      : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [localUrl], {
          stdio: 'ignore',
        });
    browser.once('error', () =>
      console.log(
        'Tarayici otomatik acilamadi. Yukaridaki telefon adresini bilgisayarda da kullanabilirsin.',
      ),
    );
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopping = true;
    server?.kill();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  stopping = true;
  server?.kill();
  process.exitCode = 1;
});
