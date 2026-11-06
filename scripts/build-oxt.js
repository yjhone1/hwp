import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

async function buildOxt() {
  const oxtDir = path.resolve('openoffice-extension-oxt');
  const outFile = path.resolve('Apache_OpenOffice_HWP_Extension_v2.2.0.oxt');

  if (!fs.existsSync(oxtDir)) {
    console.error(`[오류] ${oxtDir} 디렉터리를 찾을 수 없습니다.`);
    process.exit(1);
  }

  const zip = new JSZip();

  function addDir(dirPath, zipFolder) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const subFolder = zipFolder ? zipFolder.folder(entry.name) : zip.folder(entry.name);
        addDir(fullPath, subFolder);
      } else {
        const fileContent = fs.readFileSync(fullPath);
        if (zipFolder) {
          zipFolder.file(entry.name, fileContent);
        } else {
          zip.file(entry.name, fileContent);
        }
      }
    }
  }

  console.log('[1/2] openoffice-extension-oxt 소스 패키징 중...');
  addDir(oxtDir, null);

  console.log('[2/2] .oxt 바이너리 확장팩 생성 중...');
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  fs.writeFileSync(outFile, buffer);
  console.log(`[완료] Apache OpenOffice 한글 확장팩 생성 완료: ${outFile} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

buildOxt().catch((err) => {
  console.error('[오류 발생]', err);
  process.exit(1);
});
