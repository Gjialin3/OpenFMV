# Windows Desktop Auto Updates

OpenFMV uses Electron Builder NSIS packages and `electron-updater` for Windows desktop updates. The update flow is local-first: it checks a static release feed, downloads an installer package, and installs only after the user chooses to restart. It does not add accounts, databases, cloud sync, or any hosted backend service.

## Release Artifacts

`package.json` `version` is the source of truth for update comparisons. Each desktop release must increment that version before packaging.

Build a local package without uploading:

```bash
npm run package:desktop
```

Publish release assets to the configured provider:

```bash
npm run release:desktop
```

The release output is written to `dist/`. A Windows release should include:

- `OpenFMV-Setup-<version>.exe`
- `OpenFMV-Setup-<version>.exe.blockmap`
- `latest.yml`

The `.blockmap` and `latest.yml` files are required for differential updates. Keep the installer, metadata, and blockmap in the same GitHub Release or static HTTPS directory.

## Update Source

The default `electron-builder.yml` `publish` configuration targets GitHub Releases for `Comedian1926/OpenFMV`. For a static HTTPS directory, change the `publish` block to:

```yaml
publish:
  provider: generic
  url: https://example.com/openfmv/windows/
```

The application also accepts `OPENFMV_UPDATE_URL` as a packaged-app override for internal testing with a generic HTTPS feed.

## Runtime Behavior

Auto update checks run only in packaged apps. Development commands such as `npm run desktop:dev` and `npm run desktop:standalone` do not check for updates.

On startup, OpenFMV checks the configured feed. If a newer `package.json` version is available, it downloads the update in the background. Download or feed errors are logged to the Electron user data log directory and do not block normal app usage.

After the update is downloaded, OpenFMV prompts the user with:

- `Restart and install`
- `Later`

Choosing `Restart and install` calls `autoUpdater.quitAndInstall(false, true)`. Choosing `Later` keeps the current session running.

## Unsigned Internal Builds

Windows update package signature verification is disabled for unsigned internal builds:

```yaml
win:
  verifyUpdateCodeSignature: false
```

The runtime also installs a no-op verifier unless `OPENFMV_VERIFY_UPDATE_SIGNATURE=1` is set. After production code signing is ready, restore signature verification by removing the no-op runtime override and setting `verifyUpdateCodeSignature: true`.

## Local Data Safety

Updater code does not read or write OpenFMV project files, imported assets, or local user data. Electron Builder installs application files under the installer target directory, while project and asset persistence remains in the existing user data locations.
