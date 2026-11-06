/// <reference types="vite/client" />
import JSZip from 'jszip';
import rawPackageJson from '../../../package.json?raw';
import rawIndexHtml from '../../../index.html?raw';
import rawViteConfig from '../../../vite.config.ts?raw';
import rawTsConfig from '../../../tsconfig.json?raw';
import rawReadme from '../../../README.md?raw';
import rawMainTsx from '../../main.tsx?raw';
import rawIndexCss from '../../index.css?raw';
import rawAppTsx from '../../App.tsx?raw';
import rawHwpEditorTsx from '../../components/HwpEditor.tsx?raw';
import rawPluginManifestTs from './pluginManifest.ts?raw';
import rawFullProjectExporterTs from './fullProjectExporter.ts?raw';
import rawGithubWorkflow from '../../../.github/workflows/build-windows.yml?raw';
import rawBuildOxtJs from '../../../scripts/build-oxt.js?raw';
import {
  HWP_PLUGIN_MANIFEST,
  UPGRADE_GUIDE_MARKDOWN,
  generateOxtManifestXml,
  generateOxtDescriptionXml,
  generateOxtAddonsXcu,
  generateOxtBasicScriptXlb,
  generateOxtBasicDialogXlb,
  generateOxtBasicModuleXba,
  generateStandaloneHwpHtml,
  generateFullOpenOfficeWithHwpStandaloneHtml,
} from './pluginManifest';

/**
 * Official Apache OpenOffice Korean Windows Desktop Installer (.exe, ~135 MB) direct mirror URL
 */
export const OFFICIAL_OPENOFFICE_WINDOWS_KO_EXE_URL =
  'https://sourceforge.net/projects/openofficeorg.mirror/files/4.1.15/binaries/ko/Apache_OpenOffice_4.1.15_Win_x86_install_ko.exe/download';

export const OFFICIAL_OPENOFFICE_DOWNLOAD_PAGE_URL =
  'https://www.openoffice.org/ko/download/';

/**
 * Official Apache OpenOffice GitHub Repository & Direct Source Archives
 */
export const APACHE_OPENOFFICE_OFFICIAL_REPO_URL =
  'https://github.com/apache/openoffice';

export const APACHE_OPENOFFICE_AOO41X_ZIP_URL =
  'https://github.com/apache/openoffice/archive/refs/heads/AOO41X.zip';

export const APACHE_OPENOFFICE_TRUNK_ZIP_URL =
  'https://github.com/apache/openoffice/archive/refs/heads/trunk.zip';

export const APACHE_OPENOFFICE_SOURCE_MIRRORS_URL =
  'https://archive.apache.org/dist/openoffice/4.1.15/source/';

/**
 * Generates the official Apache OpenOffice Extension (.oxt) binary package
 * containing Addons.xcu (menu bar items) + HwpBridge StarBasic macro library + standalone HTML suite.
 */
export async function createOxtExtensionBlob(
  installedPlugins?: unknown
): Promise<{ blob: Blob; filename: string; uint8Array: Uint8Array }> {
  const oxtZip = new JSZip();
  oxtZip.file('META-INF/manifest.xml', generateOxtManifestXml());
  oxtZip.file('description.xml', generateOxtDescriptionXml('4.1.0'));
  oxtZip.file('Addons.xcu', generateOxtAddonsXcu());
  oxtZip.file('HwpBridge/script.xlb', generateOxtBasicScriptXlb());
  oxtZip.file('HwpBridge/dialog.xlb', generateOxtBasicDialogXlb());
  oxtZip.file('HwpBridge/HwpLauncher.xba', generateOxtBasicModuleXba());
  oxtZip.file('Apache_OpenOffice_HWP_Standalone.html', generateStandaloneHwpHtml());
  oxtZip.file(
    'Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html',
    generateFullOpenOfficeWithHwpStandaloneHtml()
  );
  oxtZip.file('pluginManifest.json', JSON.stringify(HWP_PLUGIN_MANIFEST, null, 2));
  if (installedPlugins) {
    oxtZip.file('installedPlugins.json', JSON.stringify(installedPlugins, null, 2));
  }
  oxtZip.file('UPGRADE_INTEGRATION_GUIDE.md', UPGRADE_GUIDE_MARKDOWN);

  const uint8Array = await oxtZip.generateAsync({ type: 'uint8array' });
  const blob = new Blob([uint8Array as unknown as BlobPart], {
    type: 'application/vnd.openofficeorg.extension',
  });
  const filename = `Apache_OpenOffice_HWP_Extension_v${HWP_PLUGIN_MANIFEST.pluginVersion}.oxt`;
  return { blob, filename, uint8Array };
}

/**
 * Generates the Windows batch script (Install_OpenOffice_Full_and_HWP.bat & install-hwp-plugin.bat) that:
 * 1) Installs the Full Standalone OpenOffice 6-module + HWP Suite HTML & HWP Standalone HTML
 * 2) Checks if Windows Desktop Apache OpenOffice 4.x (soffice.exe / unopkg.com) is installed;
 *    if NOT installed, automatically downloads the official Korean Windows Apache OpenOffice installer (~135 MB .exe)
 *    via curl.exe / PowerShell and runs the setup!
 * 3) Automatically registers Apache_OpenOffice_HWP_Extension_v2.2.0.oxt via unopkg.com so the [한글(.hwp/.hwpx)] menu appears in OpenOffice
 * 4) Copies React source components (src/App.tsx, src/components/HwpEditor.tsx) if run inside a web project
 */
export function toWindowsCrlf(str: string): string {
  return str.replace(/\r?\n/g, '\r\n');
}

export function generateWindowsInstallBat(): string {
  const oxtName = `Apache_OpenOffice_HWP_Extension_v${HWP_PLUGIN_MANIFEST.pluginVersion}.oxt`;
  return `@echo off
chcp 65001 >nul
setlocal

echo ============================================================================
echo   [Apache OpenOffice 한글(.hwp/.hwpx) 편집기 및 확장팩 자동 설치기 v${HWP_PLUGIN_MANIFEST.pluginVersion}]
echo   1. 사용자 프로필(AppData)에 무설치 독립형 한글 편집기 엔진 자동 복사
echo   2. 데스크톱 오픈오피스 설치 폴더 자동 감지 및 메뉴 확장팩(.oxt) 등록
echo   3. 바탕화면 바로가기 생성 및 즉시 실행 지원
echo ============================================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "AOO_USER_HWP_DIR=%APPDATA%\\OpenOffice\\4\\user\\hwp-editor"

echo [1/3] 사용자 프로필 폴더에 한글 편집기 파일 복사 중...
if not exist "%AOO_USER_HWP_DIR%" mkdir "%AOO_USER_HWP_DIR%" 2>nul

if exist "%SCRIPT_DIR%Apache_OpenOffice_HWP_Standalone.html" (
    copy /Y "%SCRIPT_DIR%Apache_OpenOffice_HWP_Standalone.html" "%AOO_USER_HWP_DIR%\\" >nul 2>nul
    echo       - Apache_OpenOffice_HWP_Standalone.html 복사 완료
)
if exist "%SCRIPT_DIR%Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html" (
    copy /Y "%SCRIPT_DIR%Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html" "%AOO_USER_HWP_DIR%\\" >nul 2>nul
    echo       - Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html 복사 완료
)

echo.
echo [2/3] 오픈오피스 설치 경로 및 unopkg 실행 도구 탐색 중...
set "UNOPKG_PATH="
if exist "%SCRIPT_DIR%program\\unopkg.com" set "UNOPKG_PATH=%SCRIPT_DIR%program\\unopkg.com"
if "%UNOPKG_PATH%"=="" if exist "%SCRIPT_DIR%unopkg.com" set "UNOPKG_PATH=%SCRIPT_DIR%unopkg.com"
if "%UNOPKG_PATH%"=="" if exist "%SCRIPT_DIR%..\\program\\unopkg.com" set "UNOPKG_PATH=%SCRIPT_DIR%..\\program\\unopkg.com"
if "%UNOPKG_PATH%"=="" if exist "%ProgramFiles(x86)%\\OpenOffice 4\\program\\unopkg.com" set "UNOPKG_PATH=%ProgramFiles(x86)%\\OpenOffice 4\\program\\unopkg.com"
if "%UNOPKG_PATH%"=="" if exist "%ProgramFiles%\\OpenOffice 4\\program\\unopkg.com" set "UNOPKG_PATH=%ProgramFiles%\\OpenOffice 4\\program\\unopkg.com"
if "%UNOPKG_PATH%"=="" if exist "C:\\Program Files (x86)\\OpenOffice 4\\program\\unopkg.com" set "UNOPKG_PATH=C:\\Program Files (x86)\\OpenOffice 4\\program\\unopkg.com"
if "%UNOPKG_PATH%"=="" if exist "C:\\Program Files\\OpenOffice 4\\program\\unopkg.com" set "UNOPKG_PATH=C:\\Program Files\\OpenOffice 4\\program\\unopkg.com"
if "%UNOPKG_PATH%"=="" if exist "C:\\openoffice4\\program\\unopkg.com" set "UNOPKG_PATH=C:\\openoffice4\\program\\unopkg.com"
if "%UNOPKG_PATH%"=="" if exist "%SCRIPT_DIR%program\\unopkg.exe" set "UNOPKG_PATH=%SCRIPT_DIR%program\\unopkg.exe"
if "%UNOPKG_PATH%"=="" if exist "%ProgramFiles(x86)%\\OpenOffice 4\\program\\unopkg.exe" set "UNOPKG_PATH=%ProgramFiles(x86)%\\OpenOffice 4\\program\\unopkg.exe"
if "%UNOPKG_PATH%"=="" if exist "%ProgramFiles%\\OpenOffice 4\\program\\unopkg.exe" set "UNOPKG_PATH=%ProgramFiles%\\OpenOffice 4\\program\\unopkg.exe"

if "%UNOPKG_PATH%"=="" goto NoUnopkg

echo       - 오픈오피스 unopkg 도구 확인됨: "%UNOPKG_PATH%"

if exist "%SCRIPT_DIR%${oxtName}" (
    echo.
    echo [3/3] 오픈오피스에 한글(.hwp/.hwpx) 메뉴 확장팩(.oxt) 등록 중...
    "%UNOPKG_PATH%" add -f "%SCRIPT_DIR%${oxtName}"
    echo.
    echo [완료] 오픈오피스 메뉴바에 [한글(.hwp/.hwpx)] 메뉴가 성공적으로 등록되었습니다!
    echo        ※ 만약 오픈오피스가 열려 있었다면 완전히 종료한 후 다시 실행해 주세요.
    goto MakeShortcut
) else (
    echo [안내] "%SCRIPT_DIR%${oxtName}" 파일을 찾지 못했습니다.
    goto MakeShortcut
)

:NoUnopkg
echo.
echo [안내 2/3] PC에서 unopkg.com 자동 탐색에 실패했습니다.
echo            오픈오피스 실행 후 상단 메뉴 [도구] - [확장 관리자] - [추가]를 눌러
echo            "%SCRIPT_DIR%${oxtName}" 파일을 선택하시면 바로 등록됩니다.

:MakeShortcut
echo.
echo [안내] 바탕화면 바로가기 생성 중...
set "DESK_DIR=%USERPROFILE%\\Desktop"
if not exist "%DESK_DIR%" if exist "%USERPROFILE%\\OneDrive\\Desktop" set "DESK_DIR=%USERPROFILE%\\OneDrive\\Desktop"
if not exist "%DESK_DIR%" if exist "%PUBLIC%\\Desktop" set "DESK_DIR=%PUBLIC%\\Desktop"

if exist "%DESK_DIR%" (
    if exist "%AOO_USER_HWP_DIR%\\Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html" (
        echo [InternetShortcut] > "%DESK_DIR%\\오픈오피스 4.1.17 + 한글(HWP) 통합스위트.url"
        echo URL=file:///%AOO_USER_HWP_DIR:\\=/%/Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html >> "%DESK_DIR%\\오픈오피스 4.1.17 + 한글(HWP) 통합스위트.url"
        echo       - 바탕화면에 [오픈오피스 4.1.17 + 한글(HWP) 통합스위트] 바로가기 생성 완료
    )
    if exist "%AOO_USER_HWP_DIR%\\Apache_OpenOffice_HWP_Standalone.html" (
        echo [InternetShortcut] > "%DESK_DIR%\\오픈오피스 한글(HWP·HWPX) 편집기.url"
        echo URL=file:///%AOO_USER_HWP_DIR:\\=/%/Apache_OpenOffice_HWP_Standalone.html >> "%DESK_DIR%\\오픈오피스 한글(HWP·HWPX) 편집기.url"
        echo       - 바탕화면에 [오픈오피스 한글(HWP·HWPX) 편집기] 바로가기 생성 완료
    )
)

echo.
echo ============================================================================
echo   [설치 완료] 한글(.hwp/.hwpx) 편집기 설정이 성공적으로 완료되었습니다!
echo   지금 바로 오픈오피스를 실행하여 상단 [한글(.hwp/.hwpx)] 메뉴를 이용해 보세요.
echo ============================================================================
pause
`;
}

export function generateUnixInstallSh(): string {
  const oxtName = `Apache_OpenOffice_HWP_Extension_v${HWP_PLUGIN_MANIFEST.pluginVersion}.oxt`;
  return `#!/usr/bin/env bash
# Apache OpenOffice 전체 모듈 + 한글(.hwp/.hwpx) 확장팩(.oxt) 및 소스 통합 설치 스크립트 (Linux / macOS)
TARGET_DIR="\${1:-.}"
SCRIPT_DIR="\$(cd "\$(dirname "\$0")" && pwd)"

echo "[1/3] 데스크톱 Apache OpenOffice 사용자 프로필 및 통합 스위트 설치..."
for PROFILE_DIR in "\$HOME/.openoffice.org/4/user" "\$HOME/Library/Application Support/OpenOffice/4/user"; do
  if [ -d "\$(dirname "\$PROFILE_DIR")" ]; then
    mkdir -p "\$PROFILE_DIR/hwp-editor"
    cp -f "\$SCRIPT_DIR/Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html" "\$PROFILE_DIR/hwp-editor/Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html" 2>/dev/null || true
    cp -f "\$SCRIPT_DIR/Apache_OpenOffice_HWP_Standalone.html" "\$PROFILE_DIR/hwp-editor/Apache_OpenOffice_HWP_Standalone.html" 2>/dev/null || true
    echo "  -> 오픈오피스+한글 통합 스위트 복사 완료: \$PROFILE_DIR/hwp-editor/Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html"
  fi
done

if command -v unopkg >/dev/null 2>&1 && [ -f "\$SCRIPT_DIR/${oxtName}" ]; then
  unopkg add -f "\$SCRIPT_DIR/${oxtName}"
  echo "  -> unopkg를 통해 오픈오피스에 한글(.hwp/.hwpx) 메뉴 항목 등록 완료!"
elif [ -x "/opt/openoffice4/program/unopkg" ] && [ -f "\$SCRIPT_DIR/${oxtName}" ]; then
  /opt/openoffice4/program/unopkg add -f "\$SCRIPT_DIR/${oxtName}"
  echo "  -> /opt/openoffice4/program/unopkg를 통해 한글(.hwp/.hwpx) 메뉴 항목 등록 완료!"
fi

if [ -f "\$TARGET_DIR/package.json" ]; then
  echo "[2/3] 웹 프로젝트 경로(\$TARGET_DIR)에 오픈오피스(App.tsx) 및 한글(HwpEditor.tsx) 복사..."
  mkdir -p "\$TARGET_DIR/src/components"
  mkdir -p "\$TARGET_DIR/src/plugins/hwp-extension"
  cp -f "\$SCRIPT_DIR/src/App.tsx" "\$TARGET_DIR/src/App.tsx" 2>/dev/null || true
  cp -f "\$SCRIPT_DIR/src/components/HwpEditor.tsx" "\$TARGET_DIR/src/components/HwpEditor.tsx" 2>/dev/null || true
  cp -f "\$SCRIPT_DIR/src/plugins/hwp-extension/pluginManifest.ts" "\$TARGET_DIR/src/plugins/hwp-extension/pluginManifest.ts" 2>/dev/null || true
  cp -f "\$SCRIPT_DIR/src/plugins/hwp-extension/pluginManifest.json" "\$TARGET_DIR/src/plugins/hwp-extension/pluginManifest.json" 2>/dev/null || true
  echo "[3/3] 필수 의존성(jszip, jspdf, lucide-react) 설치..."
  (cd "\$TARGET_DIR" && npm install jszip jspdf lucide-react)
fi

echo "설치 완료! Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html 또는 오픈오피스 상단 메뉴바에서 [한글(.hwp/.hwpx)] 항목을 확인하세요."
`;
}

export function generateGitHubPushBat(
  repoPath = 'yjhone1/openoffice-hwp',
  branch = 'master'
): string {
  return `@echo off
chcp 65001 >nul
echo ============================================================================
echo   GitHub 저장소 동기화 스크립트 (오픈오피스 4.1.17 + 한글편집기 전체 통합)
echo   - 대상 저장소: https://github.com/${repoPath}.git
echo   - 대상 브랜치: ${branch} (비어있는 레포지터리에 ${branch} 브랜치를 자동 생성합니다)
echo ============================================================================
echo.
set "REPO_URL=https://github.com/${repoPath}.git"
if not exist ".git" (
    git init
)
git checkout -B ${branch}
git remote remove origin 2>nul
git remote add origin %REPO_URL%
git add -A
git commit -m "feat: Apache OpenOffice 4.1.17 Full Suite + HWP/HWPX Editor & Extension"
echo.
echo [진행] ${repoPath} 저장소의 [${branch}] 브랜치로 푸시 중...
git push -u origin ${branch} --force
echo.
echo ============================================================================
echo   [완료] https://github.com/${repoPath}/tree/${branch} 로 푸시가 완료되었습니다!
echo ============================================================================
pause
`;
}

export function generateGitHubPushSh(
  repoPath = 'yjhone1/openoffice-hwp',
  branch = 'master'
): string {
  return `#!/usr/bin/env bash
REPO_URL="https://github.com/${repoPath}.git"
if [ ! -d ".git" ]; then
  git init
fi
git checkout -B ${branch}
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO_URL"
git add -A
git commit -m "feat: Apache OpenOffice 4.1.17 Full Suite + HWP/HWPX Editor & Extension"
git push -u origin ${branch} --force
echo "[완료] https://github.com/${repoPath}/tree/${branch} 로 푸시가 완료되었습니다!"
`;
}

export const MANUAL_INSTALL_GUIDE_TEXT = `================================================================================
  Apache OpenOffice 데스크톱에 한글(.hwp/.hwpx) 편집기 수동 추가 안내
================================================================================

오픈오피스 데스크톱 버전에 한글(.hwp/.hwpx) 편집기 및 메뉴를 수동으로 추가하는 방법:

【방법 1: 오픈오피스 확장 관리자 GUI를 통한 1분 수동 설치 (가장 추천)】
1. Apache OpenOffice(오픈오피스) 프로그램을 실행합니다.
2. 상단 메뉴바에서 [도구 (Tools)] > [확장 관리자 (Extension Manager...)]를 클릭합니다.
   (단축키: Ctrl + Alt + E)
3. 확장 관리자 창 하단의 [추가 (Add...)] 버튼을 누릅니다.
4. 다운로드하거나 압축 푼 폴더에 있는 "Apache_OpenOffice_HWP_Extension_v${HWP_PLUGIN_MANIFEST.pluginVersion}.oxt" 파일을 선택하고 [열기]를 누릅니다.
5. 확장 기능 사용권 계약 화면에서 스크롤을 내린 후 [수락 (Accept)]을 클릭합니다.
6. 확장이 성공적으로 추가되면 [닫기 (Close)]를 누릅니다.
7. 실행 중인 오픈오피스를 완전히 종료한 후 다시 실행합니다.
8. 오픈오피스 상단 메뉴바에 [한글(.hwp/.hwpx)] 메뉴와 [파일 > 한글 문서 (.hwp/.hwpx) 열기 및 편집] 항목이 생성되어 바로 사용하실 수 있습니다!

【방법 2: 수동 설치 도우미 배치파일 실행】
- 동봉된 "수동_확장팩_설치_도우미.bat" 파일을 더블 클릭하면 오픈오피스의 확장 관리자 대화상자가 자동으로 열려 1클릭으로 등록됩니다.

【방법 3: 명령 프롬프트(CMD)를 통한 수동 등록】
- 윈도우 검색창에 cmd를 입력하여 명령 프롬프트를 열고 다음 명령을 실행합니다:
  cd "C:\\Program Files (x86)\\OpenOffice 4\\program"
  unopkg.com add -f "경로\\Apache_OpenOffice_HWP_Extension_v${HWP_PLUGIN_MANIFEST.pluginVersion}.oxt"
================================================================================
`;

export function generateManualInstallBat(): string {
  const oxtName = `Apache_OpenOffice_HWP_Extension_v${HWP_PLUGIN_MANIFEST.pluginVersion}.oxt`;
  return `@echo off
chcp 65001 >nul
echo ============================================================================
echo   Apache OpenOffice 한글(.hwp/.hwpx) 확장팩(.oxt) 수동 설치 도우미
echo ============================================================================
echo.
set "SCRIPT_DIR=%~dp0"
set "UNOPKG_PATH="
if exist "%SCRIPT_DIR%program\\unopkg.exe" set "UNOPKG_PATH=%SCRIPT_DIR%program\\unopkg.exe"
if "%UNOPKG_PATH%"=="" if exist "%SCRIPT_DIR%unopkg.exe" set "UNOPKG_PATH=%SCRIPT_DIR%unopkg.exe"
if "%UNOPKG_PATH%"=="" if exist "%SCRIPT_DIR%..\\program\\unopkg.exe" set "UNOPKG_PATH=%SCRIPT_DIR%..\\program\\unopkg.exe"
if "%UNOPKG_PATH%"=="" if exist "%ProgramFiles(x86)%\\OpenOffice 4\\program\\unopkg.exe" set "UNOPKG_PATH=%ProgramFiles(x86)%\\OpenOffice 4\\program\\unopkg.exe"
if "%UNOPKG_PATH%"=="" if exist "%ProgramFiles%\\OpenOffice 4\\program\\unopkg.exe" set "UNOPKG_PATH=%ProgramFiles%\\OpenOffice 4\\program\\unopkg.exe"
if "%UNOPKG_PATH%"=="" if exist "C:\\Program Files (x86)\\OpenOffice 4\\program\\unopkg.exe" set "UNOPKG_PATH=C:\\Program Files (x86)\\OpenOffice 4\\program\\unopkg.exe"
if "%UNOPKG_PATH%"=="" if exist "C:\\Program Files\\OpenOffice 4\\program\\unopkg.exe" set "UNOPKG_PATH=C:\\Program Files\\OpenOffice 4\\program\\unopkg.exe"
if "%UNOPKG_PATH%"=="" if exist "C:\\openoffice4\\program\\unopkg.exe" set "UNOPKG_PATH=C:\\openoffice4\\program\\unopkg.exe"

if exist "%UNOPKG_PATH%" (
    echo [실행] 오픈오피스 확장 관리자 설치 창을 엽니다...
    start "" "%UNOPKG_PATH%" gui "%SCRIPT_DIR%${oxtName}"
    echo [안내] 화면에 나타난 오픈오피스 창에서 [확인] 및 [수락]을 누르시면 설치가 완료됩니다!
) else (
    echo [안내] 오픈오피스 기본 설치 경로를 찾지 못했습니다.
    echo 오픈오피스 실행 후 상단 메뉴 [도구 ^> 확장 관리자 ^> 추가]에서
    echo "%SCRIPT_DIR%${oxtName}" 파일을 직접 선택해 주세요.
)
pause
`;
}

export const APACHE_OPENOFFICE_SOURCE_INTEGRATION_GUIDE_TEXT = `================================================================================
  [Apache OpenOffice 공식 최신 소스 동적 복제 + 한글 확장팩(openoffice-hwp) 푸시 가이드]
  저장소: https://github.com/yjhone1/openoffice-hwp
================================================================================

[1. 핵심 개발 및 배포 전략]
- 2.5GB에 달하는 아파치 오픈오피스 전체 C++ 소스를 개인 저장소에 보관하지 않습니다.
- 본 저장소(yjhone1/openoffice-hwp)에는 순수한 [한글(.hwp/.hwpx) 확장팩] 소스코드와
  자동 빌드 CI/CD 파일만 가볍고 완전하게 보관합니다.
- 개발 및 배포 시에는 항상 아파치 공식 저장소(apache/openoffice)의 최신 4.1.x (AOO41X 브랜치
  또는 새로운 버전 릴리스 태그) 소스를 동적으로 복제(fetch/clone)하여 한글 확장팩을 결합합니다.
- GitHub Actions 워크플로(.github/workflows/build-windows.yml)가 yjhone1/openoffice-hwp 푸시를
  감지하면 자동으로 아파치 최신 소스를 불러와 윈도우 배포판을 자동 빌드합니다.

[2. 로컬에서 아파치 공식 최신 소스 불러와 한글 확장팩 결합 테스트하기]
- 동봉된 "fetch-apache-openoffice.bat" (윈도우) 또는 "fetch-apache-openoffice.sh" (맥/리눅스)를
  실행하면 아파치 공식 GitHub 저장소(apache/openoffice)에서 최신 AOO41X 소스를 자동 복제하여
  "main/extensions/hwp/" 경로에 본 한글 확장팩을 즉시 연결해 줍니다.
- 오픈오피스 버전이 4.1.18, 4.2.0 등으로 업데이트되더라도 스크립트 실행 한 번으로 새 버전을
  불러와 즉시 한글 확장팩과의 호환성을 검증할 수 있습니다.

[3. 한글 확장팩 (.oxt) 단독 빌드하기]
- "build-oxt.bat" (또는 npm run build:oxt)를 실행하면 "openoffice-extension-oxt/" 폴더의
  Addons.xcu, description.xml, Basic 매크로 브릿지 등을 패키징하여 즉시 설치 가능한
  "Apache_OpenOffice_HWP_Extension_v2.2.0.oxt" 파일을 생성합니다.

[4. 깃허브(yjhone1/openoffice-hwp)에 한글 확장팩 푸시하기]
- "push-to-github.bat" (또는 setup-openoffice-hwp-repo.bat)를 실행하면,
  한글 확장팩 전체 소스 및 GitHub Actions CI/CD 파일이
  "https://github.com/yjhone1/openoffice-hwp.git" 의 master 브랜치로 즉시 푸시됩니다!

[5. 깃허브 Actions에서 윈도우 배포판 자동 빌드 확인]
- yjhone1/openoffice-hwp 저장소로 푸시되면, GitHub Actions 워크플로가:
  1) 아파치 공식 저장소에서 최신 오픈오피스 원본 소스를 동적 복제
  2) 한글 확장팩(.oxt) 빌드 및 오픈오피스 소스 트리에 결합
  3) "OpenOffice-4.1.17-HWP-Windows-Distribution.zip" 최종 윈도우 배포판 빌드 및 업로드
  4) "Apache_OpenOffice_HWP_Extension_v2.2.0.oxt" 독립 확장팩 업로드를 모두 자동으로 완료합니다!
================================================================================
`;

export function generateFetchApacheOpenOfficeBat(): string {
  return `@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ============================================================================
echo   [Apache OpenOffice 공식 저장소 최신 소스 복제 및 한글확장팩 연동 도우미]
echo   - 공식 원본 저장소: https://github.com/apache/openoffice.git
echo   - 대상 브랜치: AOO41X (최신 정식 릴리스 브랜치)
echo ============================================================================
echo.

set "AOO_DIR=aoo-official-source"
if not exist "%AOO_DIR%" (
    echo [1/3] 아파치 공식 저장소(apache/openoffice, AOO41X)에서 최신 원본 소스를 복제합니다...
    git clone --depth 1 -b AOO41X https://github.com/apache/openoffice.git "%AOO_DIR%"
    if errorlevel 1 (
        echo [알림] AOO41X 브랜치 실패 시 기본 trunk 브랜치로 복제합니다...
        git clone --depth 1 https://github.com/apache/openoffice.git "%AOO_DIR%"
    )
) else (
    echo [확인] 이미 "%AOO_DIR%" 폴더가 존재합니다. 최신 변경사항을 가져옵니다...
    cd "%AOO_DIR%"
    git pull origin AOO41X 2>nul || git pull origin trunk
    cd ..
)

echo.
echo [2/3] 한글(.hwp/.hwpx) 확장팩 소스를 아파치 오픈오피스 소스 트리(main/extensions/hwp)에 연결합니다...
set "TARGET_EXT_DIR=%AOO_DIR%\\main\\extensions\\hwp"
if not exist "%TARGET_EXT_DIR%" mkdir "%TARGET_EXT_DIR%"

if exist "openoffice-extension-oxt" (
    xcopy /E /I /Y "openoffice-extension-oxt" "%TARGET_EXT_DIR%" >nul
    echo       - openoffice-extension-oxt 소스 복사 완료
)
if exist "Apache_OpenOffice_HWP_Extension_v2.2.0.oxt" (
    copy /Y "Apache_OpenOffice_HWP_Extension_v2.2.0.oxt" "%TARGET_EXT_DIR%\\" >nul
    echo       - 바이너리 .oxt 확장팩 복사 완료
)

echo.
echo ============================================================================
echo   [3/3] 연동 완료!
echo   - 오픈오피스 최신 소스 위치: %CD%\\%AOO_DIR%
echo   - 한글 확장팩 통합 위치: %CD%\\%TARGET_EXT_DIR%
echo   - 이제 이 확장팩 소스만 yjhone1/openoffice-hwp 저장소에 푸시하시면 됩니다.
echo ============================================================================
pause
`;
}

export function generateFetchApacheOpenOfficeSh(): string {
  return `#!/usr/bin/env bash
# Apache OpenOffice 공식 최신 소스 복제 및 한글확장팩 연동 도우미 (Linux / macOS)
set -e

AOO_DIR="aoo-official-source"
echo "=== [1/3] 아파치 공식 저장소(apache/openoffice, AOO41X)에서 최신 소스 복제 ==="
if [ ! -d "$AOO_DIR" ]; then
  git clone --depth 1 -b AOO41X https://github.com/apache/openoffice.git "$AOO_DIR" || \
  git clone --depth 1 https://github.com/apache/openoffice.git "$AOO_DIR"
else
  echo "기존 $AOO_DIR 폴더에서 최신 소스를 갱신합니다..."
  (cd "$AOO_DIR" && (git pull origin AOO41X 2>/dev/null || git pull origin trunk))
fi

echo "=== [2/3] 한글 확장팩 소스를 오픈오피스 소스 트리(main/extensions/hwp)에 연결 ==="
mkdir -p "$AOO_DIR/main/extensions/hwp"
[ -d "openoffice-extension-oxt" ] && cp -rf openoffice-extension-oxt/* "$AOO_DIR/main/extensions/hwp/" 2>/dev/null || true
[ -f "Apache_OpenOffice_HWP_Extension_v2.2.0.oxt" ] && cp -f Apache_OpenOffice_HWP_Extension_v2.2.0.oxt "$AOO_DIR/main/extensions/hwp/" 2>/dev/null || true

echo "=== [3/3] 연동 완료! ==="
`;
}

export function generateBuildOxtBat(): string {
  return `@echo off
chcp 65001 >nul
echo ============================================================================
echo   Apache OpenOffice 한글 확장팩 (.oxt) 빌드 도우미
echo ============================================================================
echo.
node scripts/build-oxt.js
pause
`;
}

export function generateSetupOpenOfficeHwpRepoBat(
  repoPath = 'yjhone1/openoffice-hwp',
  branch = 'master'
): string {
  return `@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ============================================================================
echo   [Apache OpenOffice 한글(.hwp/.hwpx) 확장팩 GitHub 푸시 도우미]
echo   대상 저장소: https://github.com/${repoPath} (${branch} 브랜치)
echo ============================================================================
echo.

set "REPO_URL=https://github.com/${repoPath}.git"

echo [1/3] Git 저장소를 초기화하고 ${branch} 브랜치를 설정합니다...
if not exist ".git" (
    git init
)
git checkout -B ${branch}
git remote remove origin 2>nul
git remote add origin %REPO_URL%

echo.
echo [2/3] 한글 확장팩 전체 소스 및 GitHub Actions CI/CD 파일을 커밋합니다...
git add -A
git commit -m "feat: Apache OpenOffice Korean (HWP/HWPX) Extension suite & automated CI/CD"

echo.
echo ============================================================================
echo   [3/3] 준비 완료! 이제 아래 명령어로 깃허브에 푸시하시면 됩니다:
echo.
echo     git push -u origin ${branch} --force
echo.
echo   푸시가 완료되면 GitHub Actions에서 아파치 공식 최신 소스를 불러와
echo   윈도우 배포판이 자동 빌드됩니다!
echo ============================================================================
echo.
set /p PUSH_NOW="지금 바로 깃허브(${repoPath})로 푸시하시겠습니까? (Y/N): "
if /i "%PUSH_NOW%"=="Y" (
    echo.
    echo 깃허브로 푸시를 진행합니다 (로그인이 필요할 수 있습니다)...
    git push -u origin ${branch}
)
pause
`;
}

export function generateSetupOpenOfficeHwpRepoSh(
  repoPath = 'yjhone1/openoffice-hwp',
  branch = 'master'
): string {
  return `#!/usr/bin/env bash
# Apache OpenOffice 한글 확장팩 GitHub 푸시 도우미 (Linux / macOS)
set -e

REPO_URL="https://github.com/${repoPath}.git"
BRANCH="${branch}"

echo "=== [1/3] Git 초기화 및 브랜치 설정 ==="
if [ ! -d ".git" ]; then
  git init
fi
git checkout -B "$BRANCH"
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO_URL"

echo "=== [2/3] 한글 확장팩 소스 커밋 ==="
git add -A
git commit -m "feat: Apache OpenOffice Korean (HWP/HWPX) Extension suite & automated CI/CD" || true

echo "=== [3/3] 푸시 실행 ==="
git push -u origin "$BRANCH" --force
`;
}

/**
 * Collects all text project files for bundling in ZIP or pushing directly to GitHub.
 * Includes the full Apache OpenOffice 6-module + HWP standalone suite HTML,
 * full React source (src/App.tsx + src/components/HwpEditor.tsx),
 * the automated Windows Desktop OpenOffice (.exe) + HWP (.oxt) installer script,
 * the manual installation guide and batch runner,
 * and the GitHub Actions Windows CI/CD workflow (.github/workflows/build-windows.yml).
 */
export function getAllProjectTextFiles(
  extraFiles?: Record<string, string>
): Record<string, string> {
  const files: Record<string, string> = {
    'Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html':
      generateFullOpenOfficeWithHwpStandaloneHtml(),
    'Apache_OpenOffice_HWP_Standalone.html': generateStandaloneHwpHtml(),
    '아파치_오픈오피스_연동_및_한글확장팩_푸시가이드.txt':
      APACHE_OPENOFFICE_SOURCE_INTEGRATION_GUIDE_TEXT,
    'fetch-apache-openoffice.bat': generateFetchApacheOpenOfficeBat(),
    'fetch-apache-openoffice.sh': generateFetchApacheOpenOfficeSh(),
    'build-oxt.bat': generateBuildOxtBat(),
    'scripts/build-oxt.js': rawBuildOxtJs,
    'setup-openoffice-hwp-repo.bat': generateSetupOpenOfficeHwpRepoBat(
      'yjhone1/openoffice-hwp',
      'master'
    ),
    'setup-openoffice-hwp-repo.sh': generateSetupOpenOfficeHwpRepoSh(
      'yjhone1/openoffice-hwp',
      'master'
    ),
    '수동_설치_방법_안내.txt': MANUAL_INSTALL_GUIDE_TEXT,
    '수동_확장팩_설치_도우미.bat': generateManualInstallBat(),
    'Install_OpenOffice_Full_and_HWP.bat': generateWindowsInstallBat(),
    'install-hwp-plugin.bat': generateWindowsInstallBat(),
    'install-hwp-plugin.sh': generateUnixInstallSh(),
    'push-to-github.bat': generateGitHubPushBat('yjhone1/openoffice-hwp', 'master'),
    'push-to-github.sh': generateGitHubPushSh('yjhone1/openoffice-hwp', 'master'),
    '.github/workflows/build-windows.yml': rawGithubWorkflow,
    'package.json': rawPackageJson,
    'index.html': rawIndexHtml,
    'vite.config.ts': rawViteConfig,
    'tsconfig.json': rawTsConfig,
    'README.md': rawReadme,
    'UPGRADE_INTEGRATION_GUIDE.md': UPGRADE_GUIDE_MARKDOWN,
    'src/main.tsx': rawMainTsx,
    'src/index.css': rawIndexCss,
    'src/App.tsx': rawAppTsx,
    'src/components/HwpEditor.tsx': rawHwpEditorTsx,
    'src/plugins/hwp-extension/pluginManifest.ts': rawPluginManifestTs,
    'src/plugins/hwp-extension/fullProjectExporter.ts': rawFullProjectExporterTs,
    'src/plugins/hwp-extension/pluginManifest.json': JSON.stringify(
      HWP_PLUGIN_MANIFEST,
      null,
      2
    ),
    'openoffice-extension-oxt/META-INF/manifest.xml': generateOxtManifestXml(),
    'openoffice-extension-oxt/description.xml': generateOxtDescriptionXml('4.1.0'),
    'openoffice-extension-oxt/Addons.xcu': generateOxtAddonsXcu(),
    'openoffice-extension-oxt/HwpBridge/script.xlb': generateOxtBasicScriptXlb(),
    'openoffice-extension-oxt/HwpBridge/dialog.xlb': generateOxtBasicDialogXlb(),
    'openoffice-extension-oxt/HwpBridge/HwpLauncher.xba': generateOxtBasicModuleXba(),
    'openoffice-extension-oxt/Apache_OpenOffice_HWP_Standalone.html': generateStandaloneHwpHtml(),
    'openoffice-extension-oxt/Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html':
      generateFullOpenOfficeWithHwpStandaloneHtml(),
  };

  if (extraFiles) {
    Object.entries(extraFiles).forEach(([filePath, content]) => {
      files[filePath] = content;
    });
  }

  return files;
}

/**
 * Generates a complete, self-contained .zip archive containing:
 * 1. Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html (오픈오피스 6대 모듈 전체 + 한글 편집기 무설치 통합 실행 파일)
 * 2. Install_OpenOffice_Full_and_HWP.bat (데스크톱 오픈오피스 ~135MB .exe 본체 자동 다운로드·설치 + 한글 .oxt 확장팩 자동 결합 스크립트)
 * 3. Apache_OpenOffice_HWP_Extension_v2.2.0.oxt (데스크톱 오픈오피스 확장팩)
 * 4. Full Apache OpenOffice + HWP Editor React/TypeScript source code (src/App.tsx, src/components/HwpEditor.tsx, etc.)
 * 5. Automated 1-click GitHub Push scripts (push-to-github.bat / push-to-github.sh) configured for yjhone1/openoffice-hwp (master branch)
 */
export async function createFullDownloadZipBlob(
  extraFiles?: Record<string, string>
): Promise<{ blob: Blob; filename: string }> {
  const zip = new JSZip();

  // 1. Build and embed the ready-to-install .oxt extension at root
  const oxtPackage = await createOxtExtensionBlob();
  zip.file(oxtPackage.filename, oxtPackage.uint8Array);

  // 2. Add all project text & source files (including Full OpenOffice + HWP Suite HTML & Auto-Installer)
  const textFiles = getAllProjectTextFiles(extraFiles);
  Object.entries(textFiles).forEach(([filePath, content]) => {
    const isWindowsBatchOrText =
      filePath.endsWith('.bat') || filePath.endsWith('.cmd') || filePath.endsWith('.txt');
    zip.file(filePath, isWindowsBatchOrText ? toWindowsCrlf(content) : content);
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const filename = `Apache_OpenOffice_4.1.17_Full_with_HWP_통합패키지_v${HWP_PLUGIN_MANIFEST.pluginVersion}.zip`;
  return { blob, filename };
}

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Directly pushes the entire project to a GitHub repository (e.g., yjhone1/openoffice-hwp)
 * on the specified branch (defaults to 'master').
 * Automatically handles brand-new empty repositories where neither 'master' nor 'main' exists yet!
 */
export async function pushProjectToGitHubRepo(options: {
  repo: string; // e.g. "yjhone1/openoffice-hwp"
  branch: string; // e.g. "master"
  token: string;
  commitMessage?: string;
  onProgress?: (msg: string) => void;
}): Promise<{ htmlUrl: string; branch: string; fileCount: number }> {
  const cleanRepo = options.repo
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
  const branch = options.branch.trim() || 'master';
  const token = options.token.trim();
  const commitMessage =
    options.commitMessage?.trim() ||
    'feat: Apache OpenOffice 4.1.17 + HWP/HWPX Extension & Batch Math PDF (master)';

  if (!cleanRepo || !cleanRepo.includes('/')) {
    throw new Error('올바른 GitHub 저장소 경로(예: yjhone1/openoffice-hwp)를 입력해주세요.');
  }
  if (!token) {
    throw new Error('GitHub Personal Access Token (토큰)을 입력해주세요.');
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const notify = (msg: string) => {
    if (options.onProgress) options.onProgress(msg);
  };

  notify(`[1/5] GitHub 저장소(${cleanRepo}) 및 [${branch}] 브랜치 상태 확인 중...`);

  // Step 1: Check if target branch exists. If repo is newly created and empty, neither master nor main exists yet!
  let refRes = await fetch(
    `https://api.github.com/repos/${cleanRepo}/git/ref/heads/${encodeURIComponent(branch)}`,
    { headers }
  );

  if (refRes.status === 404 || refRes.status === 409) {
    notify(
      `[2/5] 빈 저장소 감지됨 — [${branch}] 브랜치를 최초로 생성하고 초기화합니다...`
    );
    // Initialize the empty repository with README.md on the requested branch (e.g. 'master')
    // First check if README.md already exists on that branch just in case
    let existingSha: string | undefined;
    const checkReadme = await fetch(
      `https://api.github.com/repos/${cleanRepo}/contents/README.md?ref=${encodeURIComponent(branch)}`,
      { headers }
    );
    if (checkReadme.ok) {
      const data = await checkReadme.json();
      existingSha = data?.sha;
    }

    const initRes = await fetch(
      `https://api.github.com/repos/${cleanRepo}/contents/README.md`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: `chore: initialize ${branch} branch`,
          content: utf8ToBase64(rawReadme),
          branch,
          ...(existingSha ? { sha: existingSha } : {}),
        }),
      }
    );

    if (!initRes.ok) {
      const errBody = await initRes.text();
      throw new Error(
        `브랜치(${branch}) 초기 생성 실패 (${initRes.status}): 토큰에 'repo' 또는 'Contents: Read and write' 권한이 있는지 확인해주세요. (${errBody.slice(0, 140)})`
      );
    }

    // Re-fetch ref now that the branch exists
    refRes = await fetch(
      `https://api.github.com/repos/${cleanRepo}/git/ref/heads/${encodeURIComponent(branch)}`,
      { headers }
    );
  }

  if (!refRes.ok) {
    const errText = await refRes.text();
    throw new Error(
      `GitHub 브랜치(${branch}) 조회 실패 (${refRes.status}): ${errText.slice(0, 140)}`
    );
  }

  const refData = await refRes.json();
  const latestCommitSha: string = refData.object.sha;

  // Step 2: Get base commit to retrieve base tree SHA
  const commitRes = await fetch(
    `https://api.github.com/repos/${cleanRepo}/git/commits/${latestCommitSha}`,
    { headers }
  );
  if (!commitRes.ok) {
    throw new Error(`기존 커밋 정보를 가져오지 못했습니다 (${commitRes.status}).`);
  }
  const commitData = await commitRes.json();
  const baseTreeSha: string = commitData.tree.sha;

  // Step 3: Prepare all text files + .oxt binary package
  const textFiles = getAllProjectTextFiles();
  const oxtPackage = await createOxtExtensionBlob();
  const entries = Object.entries(textFiles);
  const totalFiles = entries.length + 1;

  notify(`[3/5] 총 ${totalFiles}개 소스 파일 및 한글 확장팩(.oxt) 업로드 중...`);

  const treeItems: Array<{
    path: string;
    mode: '100644' | '100755';
    type: 'blob';
    sha: string;
  }> = [];

  // Upload text files as blobs
  for (let i = 0; i < entries.length; i++) {
    const [filePath, content] = entries[i];
    notify(`[3/5] 파일 업로드 중 (${i + 1}/${totalFiles}): ${filePath}`);
    const blobRes = await fetch(`https://api.github.com/repos/${cleanRepo}/git/blobs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content,
        encoding: 'utf-8',
      }),
    });
    if (!blobRes.ok) {
      throw new Error(`파일 업로드 실패 (${filePath}): HTTP ${blobRes.status}`);
    }
    const blobData = await blobRes.json();
    treeItems.push({
      path: filePath,
      mode: filePath.endsWith('.sh') ? '100755' : '100644',
      type: 'blob',
      sha: blobData.sha,
    });
  }

  // Upload binary .oxt extension file
  notify(`[3/5] 바이너리 확장팩 업로드 중 (${totalFiles}/${totalFiles}): ${oxtPackage.filename}`);
  const oxtBlobRes = await fetch(`https://api.github.com/repos/${cleanRepo}/git/blobs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      content: uint8ArrayToBase64(oxtPackage.uint8Array),
      encoding: 'base64',
    }),
  });
  if (oxtBlobRes.ok) {
    const oxtBlobData = await oxtBlobRes.json();
    treeItems.push({
      path: oxtPackage.filename,
      mode: '100644',
      type: 'blob',
      sha: oxtBlobData.sha,
    });
  }

  // Step 4: Create Git Tree
  notify(`[4/5] [${branch}] 브랜치용 Git 트리 및 커밋 생성 중...`);
  const newTreeRes = await fetch(`https://api.github.com/repos/${cleanRepo}/git/trees`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: treeItems,
    }),
  });
  if (!newTreeRes.ok) {
    throw new Error(`Git Tree 생성 실패 (HTTP ${newTreeRes.status})`);
  }
  const newTreeData = await newTreeRes.json();

  // Step 5: Create Commit & Update Branch Reference
  const newCommitRes = await fetch(
    `https://api.github.com/repos/${cleanRepo}/git/commits`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: commitMessage,
        tree: newTreeData.sha,
        parents: [latestCommitSha],
      }),
    }
  );
  if (!newCommitRes.ok) {
    throw new Error(`Git Commit 생성 실패 (HTTP ${newCommitRes.status})`);
  }
  const newCommitData = await newCommitRes.json();

  notify(`[5/5] ${cleanRepo} 저장소의 [${branch}] 브랜치에 최종 반영 중...`);
  const updateRefRes = await fetch(
    `https://api.github.com/repos/${cleanRepo}/git/refs/heads/${encodeURIComponent(branch)}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sha: newCommitData.sha,
        force: true,
      }),
    }
  );
  if (!updateRefRes.ok) {
    throw new Error(`브랜치(${branch}) 업데이트 실패 (HTTP ${updateRefRes.status})`);
  }

  return {
    htmlUrl: `https://github.com/${cleanRepo}/tree/${branch}`,
    branch,
    fileCount: treeItems.length,
  };
}
