# LIT Desktop Release Process

## Overview
This document describes how to build and distribute lit-desktop for open source releases.

## Prerequisites
- Node.js and npm installed
- Electron and Angular dependencies installed (`npm install`)

## Release Steps

### 1. Update Version
Update the version number in `package.json`:
```bash
# Edit package.json to increment version number
# Current version: 1.0.0
```

### 2. Build the Application
```bash
cd /path/to/lit-desktop
npm run electron:build
```

This command:
- Runs `ng build --configuration production` to build the Angular app
- Runs `electron-builder` to create platform-specific distributions
- Outputs files to the `release/` directory

### 3. Verify Build Artifacts
Check that the build completed successfully:
```bash
ls -la release/
# Should contain:
# - lit-desktop-<version>.AppImage (Linux)
# - lit-desktop_<version>_amd64.deb (Debian package)
# - linux-unpacked/ (unpacked Linux build)
```

### 4. Create GitHub Release
1. Create a new tag: `git tag v1.0.0`
2. Push the tag: `git push origin v1.0.0`
3. Create a GitHub release with the tag
4. Upload build artifacts to the release

### 5. Test the Release
Download and test the released version:
```bash
# Download from GitHub releases
wget https://github.com/owner/lit-desktop/releases/download/v1.0.0/lit-desktop-1.0.0.AppImage

# Make executable and test
chmod +x lit-desktop-1.0.0.AppImage
./lit-desktop-1.0.0.AppImage
```

## Build Configurations

The electron-builder configuration in `package.json` supports:
- **Linux**: AppImage and .deb packages
- **Windows**: NSIS installer (use `npm run electron:build:windows`)
- **macOS**: .app bundle (use `npm run electron:build:mac`)

## Platform-Specific Builds

### Linux
```bash
npm run electron:build:linux
```
Produces: AppImage and .deb packages

### Windows
```bash
npm run electron:build:windows
```
Produces: .exe installer

### macOS
```bash
npm run electron:build:mac
```
Produces: .dmg installer

## Distribution Strategy

### GitHub Releases (Primary)
- Create releases for each version tag
- Upload platform-specific binaries
- Include changelog and installation instructions

### Package Managers (Future)
- Consider npm package for developers
- Homebrew formula for macOS
- Snap package for Linux
- Chocolatey for Windows

## Version Management

Follow semantic versioning:
- **Major** (X.0.0): Breaking changes
- **Minor** (0.X.0): New features, backward compatible
- **Patch** (0.0.X): Bug fixes, backward compatible

## Quick Release Checklist

For a new release:

1. **Update version in package.json** (e.g., 1.0.0 → 1.1.0)
2. **Update CHANGELOG.md** with new features and fixes
3. **Build**: `npm run electron:build`
4. **Test locally**: Verify the build works
5. **Tag**: `git tag v1.1.0 && git push origin v1.1.0`
6. **Release**: Create GitHub release with artifacts
7. **Announce**: Update README or project announcements

## Notes
- The AppImage is the primary Linux distribution format
- Version numbers should follow semantic versioning
- Test releases on multiple platforms when possible
- Keep build artifacts under 100MB when possible for faster downloads
