const esbuild = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');

async function build() {
  const options = {
    entryPoints: ['media/spreadsheet.js'], bundle: true, minify: true, format: 'iife',
    target: 'chrome114', outfile: 'media/generated/spreadsheet.js', legalComments: 'eof',
    metafile: true, logLevel: 'info'
  };
  const licenses = {
    name: 'third-party-licenses', setup(builder) {
      builder.onEnd(result => {
        if (!result.metafile) return;
        const packages = new Set();
        for (const input of Object.keys(result.metafile.inputs)) {
          const parts = input.split('/');
          const index = parts.lastIndexOf('node_modules');
          if (index < 0) continue;
          const end = index + (parts[index + 1].startsWith('@') ? 3 : 2);
          packages.add(parts.slice(0, end).join('/'));
        }
        const notices = [];
        for (const directory of [...packages].sort()) {
          const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
          notices.push(`${manifest.name} ${manifest.version}\nLicense: ${manifest.license ?? 'See package notices'}`);
          for (const file of fs.readdirSync(directory).filter(name => /^(licen[cs]e|copying|notice)(\.|$)/i.test(name))) {
            const filename = path.join(directory, file);
            if (fs.statSync(filename).isFile()) notices.push(fs.readFileSync(filename, 'utf8'));
          }
        }
        fs.writeFileSync('media/generated/THIRD_PARTY_LICENSES.txt', notices.join('\n\n--------------------\n\n'));
      });
    }
  };
  options.plugins = [licenses];
  if (process.argv.includes('--watch')) {
    const context = await esbuild.context(options);
    await context.watch();
  } else {
    await esbuild.build(options);
  }
}

build().catch(error => { console.error(error); process.exitCode = 1; });