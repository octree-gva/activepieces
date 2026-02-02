import * as fs from 'fs';
import * as path from 'path';

function getLogoDataUrl(): string {
  const possiblePaths = [
    path.join(__dirname, 'logo.svg'),
    path.join(__dirname, '..', 'src', 'logo.svg'),
    path.join(process.cwd(), 'packages', 'pieces', 'community', 'state-store', 'src', 'logo.svg'),
  ];

  for (const logoPath of possiblePaths) {
    try {
      if (fs.existsSync(logoPath)) {
        const svgContent = fs.readFileSync(logoPath, 'utf8');
        const base64 = Buffer.from(svgContent).toString('base64');
        return `data:image/svg+xml;base64,${base64}`;
      }
    } catch (error) {
      // Continue to next path
    }
  }

  throw new Error(`Could not find logo.svg file. Tried paths: ${possiblePaths.join(', ')}`);
}

export const logoUrl = getLogoDataUrl();
