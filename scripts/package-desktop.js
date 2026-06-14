const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const packageJson = require(path.join(root, 'package.json'));
const electronDistDir = path.join(root, 'node_modules', 'electron', 'dist');
const standaloneDir = path.join(root, '.next', 'standalone');
const appName = 'OpenFMV';
const appVersion = packageJson.version || '1.0.0';
const distDir = path.join(root, 'dist');
let outputDir = path.join(root, 'dist', `${appName}-win32-x64`);
const electronRuntimeDependencies = ['zod'];
const standalonePruneEntries = ['dist', 'reference'];
const iconSizes = [16, 24, 32, 48, 64, 128, 256];

const psString = (value) => `'${String(value).replace(/'/g, "''")}'`;

const runCommand = (command, args) => {
  const result = spawnSync(command, args, { stdio: 'inherit' });
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

const patchExecutableIcon = (exePath, iconPath) => {
  if (process.platform !== 'win32') return;
  const rceditPath = path.join(root, 'node_modules', 'rcedit', 'bin', process.arch === 'x64' ? 'rcedit-x64.exe' : 'rcedit.exe');
  if (!fs.existsSync(rceditPath)) {
    console.warn(`Skipping executable icon patch; rcedit was not found at ${rceditPath}`);
    return;
  }
  runCommand(rceditPath, [exePath, '--set-icon', iconPath]);
};

const copyDir = (source, target) => {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
};

const main = async () => {
  if (!fs.existsSync(path.join(electronDistDir, 'electron.exe'))) {
    throw new Error('Missing Electron runtime. Run npm install first.');
  }

  if (!fs.existsSync(path.join(standaloneDir, 'server.js'))) {
    throw new Error('Missing Next standalone output. Run npm run build first.');
  }

  fs.mkdirSync(distDir, { recursive: true });
  const iconPath = path.join(distDir, `${appName}.ico`);
  await createWindowsIcon(path.join(root, 'public', 'logo.png'), iconPath);

  for (const entry of standalonePruneEntries) {
    fs.rmSync(path.join(standaloneDir, entry), { recursive: true, force: true });
  }

  try {
    fs.rmSync(outputDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  } catch (error) {
    if (error.code !== 'EPERM' && error.code !== 'EBUSY') throw error;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    outputDir = path.join(root, 'dist', `${appName}-win32-x64-${stamp}`);
  }

  const resourcesAppDir = path.join(outputDir, 'resources', 'app');
  copyDir(electronDistDir, outputDir);
  fs.rmSync(path.join(outputDir, 'resources', 'app'), { recursive: true, force: true });
  fs.rmSync(path.join(outputDir, 'resources', 'default_app.asar'), { force: true });
  fs.mkdirSync(resourcesAppDir, { recursive: true });

  copyDir(path.join(root, 'electron'), path.join(resourcesAppDir, 'electron'));
  copyDir(path.join(root, 'public'), path.join(resourcesAppDir, 'public'));
  copyDir(path.join(root, 'shared'), path.join(resourcesAppDir, 'shared'));
  copyDir(standaloneDir, path.join(resourcesAppDir, '.next', 'standalone'));

  for (const dependency of electronRuntimeDependencies) {
    copyDir(
      path.join(root, 'node_modules', dependency),
      path.join(resourcesAppDir, 'node_modules', dependency)
    );
  }

  fs.writeFileSync(
    path.join(resourcesAppDir, 'package.json'),
    JSON.stringify({ name: 'openfmv-client', main: 'electron/main.js' }, null, 2),
    'utf8'
  );

  const appExePath = path.join(outputDir, `${appName}.exe`);
  fs.copyFileSync(path.join(outputDir, 'electron.exe'), appExePath);
  fs.rmSync(path.join(outputDir, 'electron.exe'), { force: true });
  fs.copyFileSync(iconPath, path.join(outputDir, `${appName}.ico`));
  patchExecutableIcon(appExePath, iconPath);
  fs.writeFileSync(
    path.join(outputDir, 'README.txt'),
    'Double-click OpenFMV.exe to start the local interactive movie editor.',
    'utf8'
  );

  console.log(`Packaged desktop client: ${outputDir}`);

  if (process.platform === 'win32') {
    const zipPath = path.join(distDir, `${appName}-win32-x64.zip`);
    const installerBuildDir = path.join(distDir, 'installer-build');
    const installersDir = path.join(distDir, 'installers');
    const installerZipPath = path.join(installerBuildDir, `${appName}-app.zip`);
    const installerName = `${appName}-Setup-${appVersion}.exe`;
    const installerPath = path.join(installersDir, installerName);
    const sedPath = path.join(installerBuildDir, `${appName}-setup.sed`);

    fs.mkdirSync(installerBuildDir, { recursive: true });
    fs.mkdirSync(installersDir, { recursive: true });
    fs.rmSync(zipPath, { force: true });
    fs.rmSync(installerZipPath, { force: true });
    fs.rmSync(installerPath, { force: true });
    for (const entry of fs.readdirSync(installersDir)) {
      if (entry.startsWith(`~${path.parse(installerName).name}`)) {
        fs.rmSync(path.join(installersDir, entry), { force: true });
      }
    }

    runCommand('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `$ErrorActionPreference = 'Stop'; Compress-Archive -LiteralPath ${psString(outputDir)} -DestinationPath ${psString(zipPath)} -CompressionLevel Optimal -Force`,
    ]);

    fs.copyFileSync(zipPath, installerZipPath);
    fs.writeFileSync(
      path.join(installerBuildDir, 'install.ps1'),
      [
        '$ErrorActionPreference = "Stop"',
        `$appName = "${appName}"`,
        '$packageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path',
        '$zipPath = Join-Path $packageRoot "$appName-app.zip"',
        '$installRoot = Join-Path $env:LOCALAPPDATA $appName',
        '$appDir = Join-Path $installRoot "app"',
        '$logPath = Join-Path $installRoot "install.log"',
        '$stagingDir = Join-Path $env:TEMP ("ofmv" + [guid]::NewGuid().ToString("N").Substring(0, 8))',
        'New-Item -ItemType Directory -Force -Path $installRoot | Out-Null',
        'Start-Transcript -LiteralPath $logPath -Force | Out-Null',
        'Write-Host "Installing OpenFMV..."',
        'New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null',
        'try {',
        '  $tarPath = Join-Path $env:SystemRoot "System32\\tar.exe"',
        '  if (-not (Test-Path -LiteralPath $tarPath)) { throw "Windows tar.exe was not found." }',
        '  & $tarPath -xf $zipPath -C $stagingDir',
        '  if ($LASTEXITCODE -ne 0) { throw "Failed to extract OpenFMV package. tar.exe exited with code $LASTEXITCODE." }',
        '  $extractedAppDir = Join-Path $stagingDir "OpenFMV-win32-x64"',
        '  if (-not (Test-Path -LiteralPath $extractedAppDir)) { throw "Packaged application folder was not found." }',
        '  $runningProcesses = Get-Process -Name "OpenFMV" -ErrorAction SilentlyContinue',
        '  if ($runningProcesses) {',
        '    Write-Host "Closing running OpenFMV processes..."',
        '    $runningProcesses | Stop-Process -Force',
        '    Start-Sleep -Milliseconds 600',
        '  }',
        '  if (Test-Path -LiteralPath $appDir) { Remove-Item -LiteralPath $appDir -Recurse -Force }',
        '  Move-Item -LiteralPath $extractedAppDir -Destination $appDir',
        '  $targetExe = Join-Path $appDir "OpenFMV.exe"',
        '  $targetIcon = Join-Path $appDir "OpenFMV.ico"',
        '  if (-not (Test-Path -LiteralPath $targetExe)) { throw "OpenFMV.exe was not found after installation." }',
        '  if (-not (Test-Path -LiteralPath $targetIcon)) { throw "OpenFMV.ico was not found after installation." }',
        '  $shell = New-Object -ComObject WScript.Shell',
        '  $startMenuDir = Join-Path $env:APPDATA "Microsoft\\Windows\\Start Menu\\Programs\\OpenFMV"',
        '  New-Item -ItemType Directory -Force -Path $startMenuDir | Out-Null',
        '  $startShortcut = $shell.CreateShortcut((Join-Path $startMenuDir "OpenFMV.lnk"))',
        '  $startShortcut.TargetPath = $targetExe',
        '  $startShortcut.WorkingDirectory = $appDir',
        '  $startShortcut.IconLocation = "$targetIcon,0"',
        '  $startShortcut.Save()',
        '  $desktopPath = [Environment]::GetFolderPath("DesktopDirectory")',
        '  if ($desktopPath) {',
        '    $desktopShortcut = $shell.CreateShortcut((Join-Path $desktopPath "OpenFMV.lnk"))',
        '    $desktopShortcut.TargetPath = $targetExe',
        '    $desktopShortcut.WorkingDirectory = $appDir',
        '    $desktopShortcut.IconLocation = "$targetIcon,0"',
        '    $desktopShortcut.Save()',
        '  }',
        '  Write-Host "OpenFMV installed to $appDir"',
        '  Start-Process -FilePath $targetExe',
        '} finally {',
        '  Remove-Item -LiteralPath $stagingDir -Recurse -Force -ErrorAction SilentlyContinue',
        '  Stop-Transcript | Out-Null',
        '}',
      ].join('\r\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(installerBuildDir, 'install.cmd'),
      [
        '@echo off',
        'setlocal',
        'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"',
        'set OPENFMV_INSTALL_EXIT=%ERRORLEVEL%',
        'if not "%OPENFMV_INSTALL_EXIT%"=="0" (',
        '  echo.',
        '  echo OpenFMV installation failed. See %LOCALAPPDATA%\\OpenFMV\\install.log for details.',
        '  pause',
        ')',
        'exit /b %OPENFMV_INSTALL_EXIT%',
      ].join('\r\n'),
      'utf8'
    );
    fs.writeFileSync(
      sedPath,
      [
        '[Version]',
        'Class=IEXPRESS',
        'SEDVersion=3',
        '',
        '[Options]',
        'PackagePurpose=InstallApp',
        'ShowInstallProgramWindow=1',
        'HideExtractAnimation=0',
        'UseLongFileName=1',
        'InsideCompressed=0',
        'CAB_FixedSize=0',
        'CAB_ResvCodeSigning=0',
        'RebootMode=N',
        'InstallPrompt=%InstallPrompt%',
        'DisplayLicense=%DisplayLicense%',
        'FinishMessage=%FinishMessage%',
        'TargetName=%TargetName%',
        'FriendlyName=%FriendlyName%',
        'AppLaunched=%AppLaunched%',
        'PostInstallCmd=%PostInstallCmd%',
        'AdminQuietInstCmd=%AdminQuietInstCmd%',
        'UserQuietInstCmd=%UserQuietInstCmd%',
        'SourceFiles=SourceFiles',
        '',
        '[Strings]',
        'InstallPrompt=',
        'DisplayLicense=',
        'FinishMessage=OpenFMV has been installed.',
        `TargetName=${installerPath}`,
        'FriendlyName=OpenFMV Setup',
        'AppLaunched=install.cmd',
        'PostInstallCmd=<None>',
        'AdminQuietInstCmd=install.cmd',
        'UserQuietInstCmd=install.cmd',
        'FILE0="OpenFMV-app.zip"',
        'FILE1="install.ps1"',
        'FILE2="install.cmd"',
        '',
        '[SourceFiles]',
        `SourceFiles0=${installerBuildDir}\\`,
        '',
        '[SourceFiles0]',
        '%FILE0%=',
        '%FILE1%=',
        '%FILE2%=',
      ].join('\r\n'),
      'utf8'
    );

    runCommand(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'iexpress.exe'), ['/N', '/Q', sedPath]);
    if (!fs.existsSync(installerPath)) throw new Error(`Installer was not created: ${installerPath}`);
    patchExecutableIcon(installerPath, iconPath);
    console.log(`Packaged desktop zip: ${zipPath}`);
    console.log(`Packaged desktop installer: ${installerPath}`);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
