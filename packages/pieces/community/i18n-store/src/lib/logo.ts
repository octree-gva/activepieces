import * as fs from 'fs';
import * as path from 'path';

function getLogoDataUrl(): string {
  // Try multiple possible paths to find the logo.svg file
  const possiblePaths = [
    path.join(__dirname, 'logo.svg'), // Development/build output
    path.join(__dirname, '..', 'src', 'logo.svg'), // Alternative build path
    path.join(process.cwd(), 'packages', 'pieces', 'community', 'i18n-store', 'src', 'logo.svg'), // Source path
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

  // Fallback: return empty or throw error
  throw new Error(`Could not find logo.svg file. Tried paths: ${possiblePaths.join(', ')}`);
}

export const logoUrl = getLogoDataUrl();
