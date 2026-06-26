const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const appName = 'OpenFMV';
const iconSizes = [16, 24, 32, 48, 64, 128, 256];
const standaloneDir = path.join(root, '.next', 'standalone');
const buildIconsDir = path.join(root, 'build', 'icons');

const runCommand = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32' && /\.cmd$/i.test(command),
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
};

const createWindowsIcon = async (sourcePng, targetIco) => {
  const images = await Promise.all(iconSizes.map((size) => sharp(sourcePng)
    .resize(size, size, { fit: 'cover' })
    .png()
    .toBuffer()));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let imageOffset = header.length + (images.length * 16);
  const entries = images.map((image, index) => {
    const size = iconSizes[index];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0);
    entry.writeUInt8(size === 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.length, 8);
    entry.writeUInt32LE(imageOffset, 12);
    imageOffset += image.length;
    return entry;
  });

  fs.mkdirSync(path.dirname(targetIco), { recursive: true });
  fs.writeFileSync(targetIco, Buffer.concat([header, ...entries, ...images]));
};

const prepareIcons = async () => {
  const sourceLogo = path.join(root, 'public', 'logo.png');
  const iconPngPath = path.join(buildIconsDir, 'icon.png');
  const iconIcoPath = path.join(buildIconsDir, 'icon.ico');
  fs.mkdirSync(buildIconsDir, { recursive: true });
  await sharp(sourceLogo).resize(512, 512, { fit: 'cover' }).png().toFile(iconPngPath);
  await createWindowsIcon(sourceLogo, iconIcoPath);
};

const pruneStandaloneOutput = () => {
  for (const entry of ['dist', 'reference']) {
    fs.rmSync(path.join(standaloneDir, entry), { recursive: true, force: true });
  }
};

const main = async () => {
  if (!fs.existsSync(path.join(standaloneDir, 'server.js'))) {
    throw new Error('Missing .next/standalone/server.js. Run npm run build first.');
  }

  await prepareIcons();
  pruneStandaloneOutput();

  const publishMode = process.env.OPENFMV_PUBLISH || 'never';
  const builderCli = path.join(root, 'node_modules', 'electron-builder', 'cli.js');
  const builderArgs = [builderCli, '--win', 'nsis', '--x64', '--publish', publishMode];
  runCommand(process.execPath, builderArgs.concat(process.argv.slice(2)));
  console.log(`Packaged ${appName} desktop release with electron-builder.`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
