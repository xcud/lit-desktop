# LIT-Light Release Process

## Overview
This document describes how to build and deploy a new version of LIT-Light.

## Prerequisites
- Node.js and npm installed
- AWS CLI configured with access to `s3://lit-install/` bucket
- Electron and Angular dependencies installed (`npm install`)

## Release Steps

### 1. Update Version
First, update the version number in `package.json`:
```bash
# Edit package.json to increment version number
# Current version: 1.0.0
```

### 2. Build the Application
```bash
cd /home/ben/lit-platform/lit-chat-electron
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
# - LIT-Light-<version>.AppImage (Linux)
# - lit-chat-electron_<version>_amd64.deb (Debian package)
# - linux-unpacked/ (unpacked Linux build)
```

### 4. Upload to S3
Upload the AppImage to the S3 distribution bucket:
```bash
aws s3 cp release/LIT-Light-1.0.0.AppImage s3://lit-install/LIT-Light-1.0.0.AppImage
```

### 5. Test the Release
Download and test the released version:
```bash
# Download from S3
wget https://s3.amazonaws.com/lit-install/LIT-Light-1.0.0.AppImage

# Make executable and test
chmod +x LIT-Light-1.0.0.AppImage
./LIT-Light-1.0.0.AppImage
```

## Build Configurations

The electron-builder configuration in `package.json` supports:
- **Linux**: AppImage and .deb packages
- **Windows**: NSIS installer (use `npm run electron:build:windows`)
- **macOS**: .app bundle (use `npm run electron:build:mac`)

## Distribution Structure

```
s3://lit-install/
├── LIT-Light-1.0.0.AppImage
└── (other releases)
```

## Notes
- The current build only creates Linux distributions by default
- The AppImage is the primary distribution format
- Version numbers should follow semantic versioning
- The S3 bucket `lit-install` is used for public distribution

## Quick Release Checklist

For your new version with the context window fix:

1. **Update version in package.json** (e.g., 1.0.0 → 1.1.0)
2. **Build**: `npm run electron:build`
3. **Upload**: `aws s3 cp release/LIT-Light-1.1.0.AppImage s3://lit-install/LIT-Light-1.1.0.AppImage`
4. **Test**: Download and verify the new release works

## Recent Changes in This Release
- Fixed context window overflow causing tool refusal behavior
- Desktop now matches server tool usage capabilities
- Both static (desktop-commander) and dynamic (mcp-dynamic-tools) tools working
- Improved MCP tool instruction format for better model performance