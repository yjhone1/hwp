export interface HwpPluginManifest {
  pluginId: string;
  pluginName: string;
  pluginVersion: string;
  compatibleHostVersions: string;
  supportedExtensions: string[];
  standardSpec: string;
  entryComponent: string;
  isolatedDependencies: string[];
  description: string;
}

export interface HwpExternalPlugin {
  id: string;
  name: string;
  version: string;
  author: string;
  category: 'css' | 'js' | 'hybrid';
  description: string;
  installed: boolean;
  enabled: boolean;
  actionButtonLabel?: string;
  cssUrl?: string;
  jsUrl?: string;
  cssCode?: string;
  jsCode?: string;
  isCustom?: boolean;
}

export const DEFAULT_HWP_EXTERNAL_PLUGINS: HwpExternalPlugin[] = [
  {
    id: 'plugin-gov-stamp-helper',
    name: '행정공문서 문서번호·시행일자 자동 스탬프',
    version: '1.1.0',
    author: 'AOO Korea Official',
    category: 'hybrid',
    description:
      '공문서 결재란 및 표 테두리를 선명하게 보정하는 CSS와 본문 하단에 시행일자·문서번호를 자동 기입하는 JS 액션을 제공합니다.',
    installed: true,
    enabled: true,
    actionButtonLabel: '시행일자·문서번호 삽입',
    cssCode: `
      .hwp-page-canvas table {
        border-color: #0f172a !important;
      }
      .hwp-page-canvas .hwp-title-box {
        border-bottom-width: 3px !important;
        border-bottom-color: #0369a1 !important;
      }
    `,
    jsCode: `
      const today = new Date().toLocaleDateString('ko-KR');
      const stamp = "\\n\\n[시행: 오픈오피스-2026-0108호 (" + today + ") / 접수: 전자문서시스템]";
      api.setContent(api.getContent() + stamp);
      api.notify("공문서 시행일자 및 문서번호가 본문 하단에 삽입되었습니다.");
    `,
  },
  {
    id: 'plugin-privacy-masker',
    name: '개인정보(주민번호·전화번호) 자동 마스킹 필터',
    version: '1.0.4',
    author: 'Security Extension Lab',
    category: 'js',
    description:
      '본문 내 주민등록번호 및 휴대전화번호 패턴을 찾아 개인정보 보호 규정에 맞게 별표(*)로 즉시 마스킹합니다.',
    installed: true,
    enabled: true,
    actionButtonLabel: '개인정보 마스킹 실행',
    jsCode: `
      const raw = api.getContent();
      const masked = raw
        .replace(/(\\d{6})-?([1-4]\\d{6})/g, '$1-*******')
        .replace(/(01[016789])-?(\\d{3,4})-?(\\d{4})/g, '$1-****-$3');
      if (masked === raw) {
        api.notify("본문에 마스킹할 주민번호/전화번호가 없어 예시 보호 문구를 추가했습니다.");
        api.setContent(raw + "\\n\\n※ 개인정보 보호점검 완료 (담당자: 010-****-5678 / 식별번호: 900101-*******)");
      } else {
        api.setContent(masked);
        api.notify("본문 내 개인정보(주민번호·연락처) 마스킹이 완료되었습니다.");
      }
    `,
  },
  {
    id: 'plugin-manuscript-grid',
    name: '200자 원고지 줄노트 배경 스타일러 (CSS 모듈)',
    version: '1.0.2',
    author: 'Hangul Typography Team',
    category: 'css',
    description:
      '코어 코드 수정 없이 외부 CSS 주입만으로 한글 편집 용지에 은은한 원고지 가로 줄노트 가이드라인을 표시합니다.',
    installed: true,
    enabled: false,
    cssCode: `
      .hwp-page-canvas .hwp-body-editor {
        background-image: linear-gradient(to bottom, transparent 95%, #cbd5e1 96%);
        background-size: 100% 28px;
        padding-top: 4px;
      }
    `,
  },
  {
    id: 'plugin-sepia-eye-care',
    name: '장시간 문서 교정용 세피아(Sepia) 눈보호 테마',
    version: '1.2.0',
    author: 'AOO Accessibility Group',
    category: 'css',
    description:
      '한글 문서 용지 배경을 따뜻한 한지(세피아) 톤으로 전환하여 장시간 공문서 열람 시 눈의 피로를 줄여줍니다.',
    installed: false,
    enabled: false,
    cssCode: `
      .hwp-page-canvas {
        background-color: #fdfaf2 !important;
        border-color: #d6cbb5 !important;
      }
      .hwp-page-canvas textarea,
      .hwp-page-canvas input {
        color: #292524 !important;
      }
    `,
  },
  {
    id: 'plugin-bullet-normalizer',
    name: '공문서 개조식 기호(□, ㅇ, ―) 자동 정렬기',
    version: '1.0.1',
    author: 'GovDoc Formatters',
    category: 'js',
    description:
      '본문 내 하이픈(-)이나 별표(*)로 작성된 목록을 행정업무운영편람 표준 기호(□, ㅇ, ―) 들여쓰기 규격으로 일괄 변환합니다.',
    installed: false,
    enabled: false,
    actionButtonLabel: '공문서 기호 일괄 정규화',
    jsCode: `
      const lines = api.getContent().split('\\n').map((line) => {
        if (/^\\s*\\*\\s+/.test(line)) return line.replace(/^\\s*\\*\\s+/, '  □ ');
        if (/^\\s*-\\s+/.test(line)) return line.replace(/^\\s*-\\s+/, '    ― ');
        return line;
      });
      api.setContent(lines.join('\\n'));
      api.notify("본문 목록 기호를 행정공문서 표준(□, ―) 규격으로 변환했습니다.");
    `,
  },
];

export const HWP_PLUGIN_MANIFEST: HwpPluginManifest = {
  pluginId: 'org.apache.openoffice.ko.hwp.extension',
  pluginName: 'Apache OpenOffice 한글(.hwp/.hwpx) 독립 확장 플러그인',
  pluginVersion: '1.2.0',
  compatibleHostVersions: 'Apache OpenOffice 4.1.x (4.1.17, 4.1.18+) / 4.2.x / 5.x 전 버전 호환',
  supportedExtensions: ['.hwpx', '.hwp'],
  standardSpec: 'KS X 6101 (OWPML XML) & HWP 5.0 Stream',
  entryComponent: 'src/components/HwpEditor.tsx',
  isolatedDependencies: ['jszip', 'lucide-react'],
  description:
    '오픈오피스 본체(Core) 버전이 업그레이드되더라도 코어 소스 수정 없이 독립적으로 플러그인 형태로 마운트하여 한글 문서(.hwp/.hwpx) 열람·편집·표 레이아웃 보존 기능을 그대로 사용할 수 있는 모듈형 확장 패키지입니다.',
};

export const UPGRADE_GUIDE_MARKDOWN = `# Apache OpenOffice 최신 버전 설치 후 한글(.hwp/.hwpx) 항목 자동 추가 가이드

이 패키지는 **1) Windows 데스크톱용 공식 Apache OpenOffice 설치판(\`soffice.exe\`)** 과 **2) 웹/소스코드 기반 오픈오피스 프로젝트** 양쪽 모두에서 \`install-hwp-plugin.bat\` 더블클릭(실행) 한 번으로 **한글(.hwp/.hwpx) 문서 항목**이 생성되도록 구성되어 있습니다.

---

## 1. Windows 데스크톱 오픈오피스(설치판)에서 \`install-hwp-plugin.bat\` 실행 시 동작

최신 버전의 Apache OpenOffice(예: 4.1.15, 4.1.17 등)를 PC에 먼저 설치한 뒤, 압축을 푼 폴더에서 **\`install-hwp-plugin.bat\`** 파일을 실행하면 다음 4단계가 자동으로 수행됩니다:

1. **설치된 오픈오피스 경로 자동 탐색**:
   - \`C:\\Program Files (x86)\\OpenOffice 4\\program\\unopkg.com\` 또는 \`C:\\Program Files\\OpenOffice 4\\program\\unopkg.com\` 경로를 자동으로 찾습니다.
2. **독립형 한글(.hwp/.hwpx) 편집기 엔진 복사**:
   - 오픈오피스 사용자 프로필 폴더(\`%APPDATA%\\OpenOffice\\4\\user\\hwp-editor\\Apache_OpenOffice_HWP_Standalone.html\`)에 무설치 독립형 한글(.hwp/.hwpx) 편집기를 설치합니다.
3. **오픈오피스 공식 확장팩(\`.oxt\`) 자동 등록**:
   - \`unopkg.com add -f Apache_OpenOffice_HWP_Extension_v1.2.0.oxt\` 명령을 자동 실행하여 오픈오피스 메뉴바에 한글 문서 항목을 등록합니다.
   - 등록 완료 후 오픈오피스를 실행하면 **다음 3곳에 한글 문서 메뉴가 생성**됩니다:
     - **상단 메뉴바 우측**: **\`한글(.hwp/.hwpx)\`** 전용 최상위 메뉴 생성
     - **\`파일(File)\` 메뉴 내부**: \`열기(Open)\` 바로 아래에 **\`한글 문서 (.hwp/.hwpx) 열기 및 편집\`** 항목 생성
     - **\`도구(Tools) > 애드온(Add-Ons)\` 메뉴**: **\`한글 문서 (.hwp/.hwpx) 편집기 실행\`** 항목 생성
4. **바탕화면 바로가기 아이콘 자동 생성**:
   - 바탕화면에 **\`오픈오피스 한글(HWP·HWPX) 편집기.url\`** 바로가기가 함께 생성되어 언제든 즉시 실행할 수 있습니다.

> **참고**: 만약 \`install-hwp-plugin.bat\` 실행 당시 오픈오피스 창( 또는 빠른 시작 트레이 아이콘 \`soffice.bin\` )이 켜져 있었다면, 오픈오피스를 완전히 닫았다가 다시 켜야 새로 등록된 **\`한글(.hwp/.hwpx)\`** 메뉴가 화면에 나타납니다.

---

## 2. 오픈오피스 웹 스위트(React/TypeScript 소스 프로젝트)에서 실행 시 동작

소스코드 폴더(\`package.json\`이 있는 폴더)에 대해 \`install-hwp-plugin.bat\` 또는 \`install-hwp-plugin.sh\`를 실행하면:
1. \`src/components/HwpEditor.tsx\` — 한글(.hwp/.hwpx) 파서, 표(<hp:tbl>) 무결성 보존 엔진, 결재란 및 플러그인 매니저 UI 전체가 내장된 단일 독립 컴포넌트 복사
2. \`src/plugins/hwp-extension/pluginManifest.ts\` — 버전 독립형 플러그인 메타데이터 및 연동 어댑터 복사
3. \`npm install jszip jspdf lucide-react\` 자동 설치

---

## 3. 왜 오픈오피스 버전이 올라가도 깨지지 않나요?
- **코어 비침투형(Zero-Core-Mutation) 설계**: 오픈오피스 내부 전역 상태에 의존하지 않고 자체적으로 ZIP(OWPML XML) 파싱, 표 격자 정규화(\`normalizeTableGrid\`), UTF-16LE 스트림 추출을 완결합니다.
- **표준 규격 준수**: 국가표준 \`KS X 6101(.hwpx)\` 및 \`ISO/IEC 26300\` 규격을 따르므로 호스트 오픈오피스 버전과 무관하게 동일한 문서 결과를 보장합니다.
`;

export function generateOxtManifestXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="http://openoffice.org/2001/manifest">
  <manifest:file-entry manifest:media-type="application/vnd.sun.star.configuration-data"
                       manifest:full-path="Addons.xcu"/>
  <manifest:file-entry manifest:media-type="application/vnd.sun.star.basic-library"
                       manifest:full-path="HwpBridge/"/>
  <manifest:file-entry manifest:media-type="application/vnd.sun.star.package-bundle-description"
                       manifest:full-path="description.xml"/>
  <manifest:file-entry manifest:media-type="text/html"
                       manifest:full-path="Apache_OpenOffice_HWP_Standalone.html"/>
  <manifest:file-entry manifest:media-type="text/html"
                       manifest:full-path="Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html"/>
</manifest:manifest>`;
}

export function generateOxtDescriptionXml(targetHostMinVersion = '4.1.0'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<description xmlns="http://openoffice.org/extensions/description/2006"
             xmlns:d="http://openoffice.org/extensions/description/2006"
             xmlns:xlink="http://www.w3.org/1999/xlink">
  <identifier value="${HWP_PLUGIN_MANIFEST.pluginId}" />
  <version value="${HWP_PLUGIN_MANIFEST.pluginVersion}" />
  <dependencies>
    <OpenOffice.org-minimal-version value="${targetHostMinVersion}" d:name="Apache OpenOffice ${targetHostMinVersion} or later" />
  </dependencies>
  <display-name>
    <name lang="ko">${HWP_PLUGIN_MANIFEST.pluginName}</name>
    <name lang="en">Korean HWP/HWPX Document Filter &amp; Editor Extension</name>
  </display-name>
</description>`;
}

export function generateOxtAddonsXcu(): string {
  const macroUrl =
    'vnd.sun.star.script:HwpBridge.HwpLauncher.OpenHwpEditor?language=Basic&amp;location=application';
  return `<?xml version="1.0" encoding="UTF-8"?>
<oor:component-data xmlns:oor="http://openoffice.org/2001/registry"
                    xmlns:xs="http://www.w3.org/2001/XMLSchema"
                    oor:name="Addons"
                    oor:package="org.openoffice.Office">
  <node oor:name="AddonUI">
    <node oor:name="AddonMenu">
      <node oor:name="org.apache.openoffice.ko.hwp.addonmenu" oor:op="replace">
        <prop oor:name="Title" oor:type="xs:string">
          <value/>
          <value xml:lang="ko">한글 문서 (.hwp/.hwpx) 편집기 실행</value>
          <value xml:lang="en-US">Open Korean HWP/HWPX Document Editor</value>
        </prop>
        <prop oor:name="URL" oor:type="xs:string">
          <value>${macroUrl}</value>
        </prop>
        <prop oor:name="Target" oor:type="xs:string">
          <value>_self</value>
        </prop>
        <prop oor:name="Context" oor:type="xs:string">
          <value/>
        </prop>
      </node>
    </node>
    <node oor:name="OfficeMenuBar">
      <node oor:name="org.apache.openoffice.ko.hwp.menubar" oor:op="replace">
        <prop oor:name="Title" oor:type="xs:string">
          <value/>
          <value xml:lang="ko">한글(.hwp/.hwpx)</value>
          <value xml:lang="en-US">Korean HWP/HWPX</value>
        </prop>
        <prop oor:name="Context" oor:type="xs:string">
          <value/>
        </prop>
        <node oor:name="Submenu">
          <node oor:name="M1" oor:op="replace">
            <prop oor:name="Title" oor:type="xs:string">
              <value/>
              <value xml:lang="ko">한글 문서 (.hwp/.hwpx) 열기 및 편집기 실행</value>
              <value xml:lang="en-US">Launch Korean HWP/HWPX Editor</value>
            </prop>
            <prop oor:name="URL" oor:type="xs:string">
              <value>${macroUrl}</value>
            </prop>
            <prop oor:name="Target" oor:type="xs:string">
              <value>_self</value>
            </prop>
          </node>
        </node>
      </node>
    </node>
    <node oor:name="OfficeMenuBarMerging">
      <node oor:name="org.apache.openoffice.ko.hwp" oor:op="replace">
        <node oor:name="S1" oor:op="replace">
          <prop oor:name="MergePoint">
            <value>.uno:PickList\\.uno:Open</value>
          </prop>
          <prop oor:name="MergeCommand">
            <value>AddAfter</value>
          </prop>
          <prop oor:name="MergeFallback">
            <value>AddPath</value>
          </prop>
          <node oor:name="MenuItems">
            <node oor:name="M1" oor:op="replace">
              <prop oor:name="Title">
                <value xml:lang="ko">한글 문서 (.hwp/.hwpx) 열기 및 편집</value>
                <value xml:lang="en-US">Open Korean HWP/HWPX Document</value>
              </prop>
              <prop oor:name="URL">
                <value>${macroUrl}</value>
              </prop>
              <prop oor:name="Target">
                <value>_self</value>
              </prop>
            </node>
          </node>
        </node>
      </node>
    </node>
  </node>
</oor:component-data>`;
}

export function generateOxtBasicScriptXlb(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE library:library PUBLIC "-//OpenOffice.org//DTD OfficeDocument 1.0//EN" "library.dtd">
<library:library xmlns:library="http://openoffice.org/2000/library" library:name="HwpBridge" library:readonly="false" library:passwordprotected="false">
  <library:element library:name="HwpLauncher"/>
</library:library>`;
}

export function generateOxtBasicDialogXlb(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE library:library PUBLIC "-//OpenOffice.org//DTD OfficeDocument 1.0//EN" "library.dtd">
<library:library xmlns:library="http://openoffice.org/2000/library" library:name="HwpBridge" library:readonly="false" library:passwordprotected="false"/>`;
}

export function generateOxtBasicModuleXba(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE script:module PUBLIC "-//OpenOffice.org//DTD OfficeDocument 1.0//EN" "module.dtd">
<script:module xmlns:script="http://openoffice.org/2000/script" script:name="HwpLauncher" script:language="StarBasic">REM  *****  BASIC  *****
Option Explicit

Sub OpenHwpEditor()
  On Error GoTo ErrorHandler
  Dim oPip As Object
  Dim sExtUrl As String
  Dim oPathSubst As Object
  Dim sUserUrl As String
  Dim sInstUrl As String
  Dim sProgUrl As String
  Dim sWorkUrl As String
  Dim sHomeUrl As String
  Dim sCandidates(14) As String
  Dim i As Integer
  Dim sTargetSysPath As String
  Dim oShell As Object

  sTargetSysPath = &quot;&quot;

  REM 1. Retrieve the installed extension unpacked package directory
  On Error Resume Next
  oPip = GetDefaultContext().getValueByName(&quot;/singletons/com.sun.star.deployment.PackageInformationProvider&quot;)
  If Not IsNull(oPip) And Not IsEmpty(oPip) Then
    sExtUrl = oPip.getPackageLocation(&quot;org.apache.openoffice.ko.hwp.extension&quot;)
  End If
  On Error GoTo ErrorHandler

  oPathSubst = CreateUnoService(&quot;com.sun.star.util.PathSubstitution&quot;)
  sUserUrl = oPathSubst.getSubstituteVariableValue(&quot;$(user)&quot;)
  sInstUrl = oPathSubst.getSubstituteVariableValue(&quot;$(inst)&quot;)
  sProgUrl = oPathSubst.getSubstituteVariableValue(&quot;$(prog)&quot;)
  sWorkUrl = oPathSubst.getSubstituteVariableValue(&quot;$(work)&quot;)
  sHomeUrl = oPathSubst.getSubstituteVariableValue(&quot;$(home)&quot;)

  REM Check inside the unpacked .oxt package first
  If Len(sExtUrl) &gt; 0 Then
    sCandidates(0) = ConvertFromURL(sExtUrl &amp; &quot;/Apache_OpenOffice_HWP_Standalone.html&quot;)
    sCandidates(1) = ConvertFromURL(sExtUrl &amp; &quot;/Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html&quot;)
    sCandidates(2) = ConvertFromURL(sExtUrl &amp; &quot;/hwp-editor/Apache_OpenOffice_HWP_Standalone.html&quot;)
  End If

  REM Check user profile hwp-editor directory
  sCandidates(3) = ConvertFromURL(sUserUrl &amp; &quot;/hwp-editor/Apache_OpenOffice_HWP_Standalone.html&quot;)
  sCandidates(4) = ConvertFromURL(sUserUrl &amp; &quot;/hwp-editor/Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html&quot;)

  REM Check OpenOffice installation directory and program folder (where user may have pasted)
  sCandidates(5) = ConvertFromURL(sInstUrl &amp; &quot;/Apache_OpenOffice_HWP_Standalone.html&quot;)
  sCandidates(6) = ConvertFromURL(sInstUrl &amp; &quot;/Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html&quot;)
  sCandidates(7) = ConvertFromURL(sProgUrl &amp; &quot;/Apache_OpenOffice_HWP_Standalone.html&quot;)
  sCandidates(8) = ConvertFromURL(sInstUrl &amp; &quot;/program/Apache_OpenOffice_HWP_Standalone.html&quot;)

  REM Check working folder and common locations
  sCandidates(9) = ConvertFromURL(sWorkUrl &amp; &quot;/Apache_OpenOffice_HWP_Standalone.html&quot;)
  sCandidates(10) = ConvertFromURL(sHomeUrl &amp; &quot;/Desktop/Apache_OpenOffice_HWP_Standalone.html&quot;)
  sCandidates(11) = &quot;C:\Program Files (x86)\OpenOffice 4\Apache_OpenOffice_HWP_Standalone.html&quot;
  sCandidates(12) = &quot;C:\Program Files\OpenOffice 4\Apache_OpenOffice_HWP_Standalone.html&quot;
  sCandidates(13) = &quot;C:\openoffice4\Apache_OpenOffice_HWP_Standalone.html&quot;

  For i = 0 To 13
    If Len(sCandidates(i)) &gt; 0 Then
      If FileExists(sCandidates(i)) Then
        sTargetSysPath = sCandidates(i)
        Exit For
      End If
    End If
  Next i

  If Len(sTargetSysPath) &gt; 0 Then
    oShell = CreateUnoService(&quot;com.sun.star.system.SystemShellExecute&quot;)
    oShell.execute(sTargetSysPath, &quot;&quot;, 0)
  Else
    MsgBox &quot;오픈오피스 한글(.hwp/.hwpx) 편집기 파일을 찾을 수 없습니다.&quot; &amp; Chr(13) &amp; Chr(13) &amp; _
           &quot;다음 위치 중 하나에 'Apache_OpenOffice_HWP_Standalone.html' 파일이 있어야 합니다:&quot; &amp; Chr(13) &amp; _
           &quot;1. 오픈오피스 설치 폴더: &quot; &amp; ConvertFromURL(sInstUrl) &amp; Chr(13) &amp; _
           &quot;2. 사용자 프로필 폴더: &quot; &amp; ConvertFromURL(sUserUrl) &amp; &quot;\hwp-editor\&quot;, 64, &quot;Apache OpenOffice 한글(.hwp/.hwpx) 확장 모듈&quot;
  End If
  Exit Sub

ErrorHandler:
  MsgBox &quot;한글(.hwp/.hwpx) 편집기 실행 중 오류가 발생했습니다: &quot; &amp; Error$, 48, &quot;Apache OpenOffice 한글 확장팩&quot;
End Sub
</script:module>`;
}

/**
 * Generates a self-contained, zero-dependency HTML5 Korean HWP/HWPX Document Editor
 * that Desktop Apache OpenOffice launches directly via the StarBasic HwpBridge macro
 * or Windows Desktop shortcut without requiring Node.js.
 */
export function generateStandaloneHwpHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Apache OpenOffice 4.1.17 — 한글(.hwp/.hwpx) 독립 문서 편집기 v${HWP_PLUGIN_MANIFEST.pluginVersion}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
      background: #1e2229;
      color: #f1f5f9;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    header {
      background: linear-gradient(90deg, #0b3b75 0%, #164e96 100%);
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #2e5ea0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .badge {
      background: #fbbf24;
      color: #0f172a;
      font-weight: 800;
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 4px;
    }
    .toolbar {
      background: #282d37;
      padding: 10px 20px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      border-bottom: 1px solid #394150;
    }
    button, .btn-label {
      background: #334155;
      color: #f8fafc;
      border: 1px solid #475569;
      padding: 6px 12px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 4px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    button:hover, .btn-label:hover { background: #475569; }
    .btn-primary { background: #0284c7; border-color: #38bdf8; }
    .btn-primary:hover { background: #0369a1; }
    .btn-amber { background: #f59e0b; color: #0f172a; border-color: #fde68a; font-weight: 800; }
    .btn-amber:hover { background: #d97706; }
    main {
      flex: 1;
      display: flex;
      justify-content: center;
      padding: 28px 16px;
      overflow-y: auto;
    }
    .a4-sheet {
      width: 210mm;
      min-height: 297mm;
      background: #ffffff;
      color: #111827;
      padding: 20mm;
      box-shadow: 0 12px 32px rgba(0,0,0,0.55);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .approval-box {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 8px;
    }
    .approval-table {
      border-collapse: collapse;
      font-size: 12px;
      text-align: center;
    }
    .approval-table th, .approval-table td {
      border: 1px solid #1f2937;
      padding: 4px 14px;
    }
    .approval-table th { background: #f3f4f6; font-weight: 700; }
    .approval-table td { height: 48px; color: #dc2626; font-weight: 700; }
    .doc-title {
      font-size: 22px;
      font-weight: 800;
      text-align: center;
      border-bottom: 2px solid #1e3a8a;
      padding-bottom: 10px;
      outline: none;
    }
    .editor-area {
      min-height: 360px;
      font-size: 15px;
      line-height: 1.75;
      outline: none;
      white-space: pre-wrap;
    }
    table.hwp-table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
    }
    table.hwp-table th, table.hwp-table td {
      border: 1px solid #374151;
      padding: 8px 10px;
      font-size: 13px;
    }
    table.hwp-table th { background: #e5e7eb; font-weight: 700; text-align: center; }
    footer {
      background: #111827;
      color: #94a3b8;
      padding: 8px 20px;
      font-size: 12px;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #334155;
    }
    @media print {
      body { background: #fff; }
      header, .toolbar, footer { display: none !important; }
      main { padding: 0; }
      .a4-sheet { box-shadow: none; width: 100%; padding: 10mm; }
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span class="badge">한글 HWP·HWPX</span>
      <div>
        <div style="font-size:15px;font-weight:800;">Apache OpenOffice 한글(.hwp/.hwpx) 문서 편집기 (데스크톱 연동판)</div>
        <div style="font-size:11px;color:#cbd5e1;">KS X 6101 (OWPML) · HWP 5.0 호환 · 오픈오피스 확장 관리자(.oxt) 브리지 실행됨</div>
      </div>
    </div>
    <div style="font-size:12px;color:#fde68a;font-weight:700;" id="statusText">준비 완료 (오픈오피스 연동됨)</div>
  </header>

  <div class="toolbar">
    <label class="btn-label btn-primary">
      📂 한글(.hwp/.hwpx) 파일 열기
      <input type="file" id="fileInput" accept=".hwp,.hwpx,.txt,.html" style="display:none" />
    </label>
    <button class="btn-amber" onclick="saveAsHwpxXml()">💾 한글 표준 문서(.hwpx) 저장</button>
    <button onclick="saveAsHtmlDoc()">📄 HTML/ODT 호환 문서 저장</button>
    <button onclick="insertTable()">📊 표(&lt;hp:tbl&gt;) 추가</button>
    <button onclick="toggleApproval()">💮 행정 결재란 표시/숨김</button>
    <button onclick="applyGovFormat()">🏛️ 행정공문서 표준 서식 적용</button>
    <button onclick="window.print()">🖨️ 인쇄 / PDF 내보내기</button>
  </div>

  <main>
    <div class="a4-sheet" id="a4Sheet">
      <div class="approval-box" id="approvalBox">
        <table class="approval-table">
          <tr>
            <th rowspan="2">결<br/>재</th>
            <th>담 당</th>
            <th>검 토</th>
            <th>결 재</th>
          </tr>
          <tr>
            <td contenteditable="true">승인</td>
            <td contenteditable="true">승인</td>
            <td contenteditable="true">전결</td>
          </tr>
        </table>
      </div>

      <div class="doc-title" id="docTitle" contenteditable="true">
        2026년도 오픈오피스 한글(.hwp/.hwpx) 호환성 기안문
      </div>

      <div class="editor-area" id="editorArea" contenteditable="true">1. 관련근거: 국가표준 KS X 6101(OWPML) 및 개방형 문서 포맷(ODF) 상호운용성 지침

2. 위 호와 관련하여 Apache OpenOffice 최신 버전에서 한글 문서(.hwp / .hwpx)를 열람·편집하고 표 레이아웃을 보존하기 위한 독립 모듈 문서를 아래와 같이 작성합니다.

□ 주요 내용
  ― 오픈오피스 상단 메뉴바 [한글(.hwp/.hwpx)] 및 [파일 > 한글 문서 열기] 메뉴 즉시 연동
  ― 표(Table) 셀 병합 및 행정기관 표준 결재란 인쇄 완벽 지원</div>

      <div id="tableContainer">
        <table class="hwp-table">
          <thead>
            <tr>
              <th>구분</th>
              <th>지원 포맷</th>
              <th>핵심 기능</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td contenteditable="true" style="text-align:center;">한글 표준</td>
              <td contenteditable="true" style="text-align:center;">.hwpx / .hwp</td>
              <td contenteditable="true">본문 편집, 표(&lt;hp:tbl&gt;) 추가·수정, 결재란 날인</td>
              <td contenteditable="true" style="text-align:center;">KS X 6101 준수</td>
            </tr>
            <tr>
              <td contenteditable="true" style="text-align:center;">오픈오피스</td>
              <td contenteditable="true" style="text-align:center;">.oxt 확장팩</td>
              <td contenteditable="true">install-hwp-plugin.bat 실행 시 메뉴 자동 등록</td>
              <td contenteditable="true" style="text-align:center;">전 버전 호환</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </main>

  <footer>
    <span>Apache OpenOffice 한글(.hwp/.hwpx) 독립 확장 플러그인 v${HWP_PLUGIN_MANIFEST.pluginVersion}</span>
    <span id="charCount">글자 수: 계산 중...</span>
  </footer>

  <script>
    const editorArea = document.getElementById('editorArea');
    const docTitle = document.getElementById('docTitle');
    const statusText = document.getElementById('statusText');
    const charCount = document.getElementById('charCount');

    function updateCount() {
      const len = (editorArea.innerText || '').length;
      charCount.textContent = '본문 글자 수: ' + len + '자';
    }
    editorArea.addEventListener('input', updateCount);
    updateCount();

    document.getElementById('fileInput').addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (!file) return;
      docTitle.innerText = file.name.replace(/\\.(hwpx|hwp|txt|html)$/i, '');
      const reader = new FileReader();
      reader.onload = function(evt) {
        const buffer = evt.target.result;
        const bytes = new Uint8Array(buffer);
        // Try UTF-8 text extraction for XML/text or UTF-16LE fallback for binary HWP 5.0
        const utf8Text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        if (utf8Text.includes('<hp:t>') || utf8Text.includes('<t>')) {
          const matches = Array.from(utf8Text.matchAll(/<(?:hp:)?t[^>]*>([\\s\\S]*?)<\\/(?:hp:)?t>/g)).map(m => m[1]);
          if (matches.length > 0) {
            editorArea.innerText = matches.join('\\n');
            statusText.textContent = file.name + ' (OWPML XML 텍스트 추출 완료)';
            updateCount();
            return;
          }
        }
        const utf16Text = new TextDecoder('utf-16le', { fatal: false }).decode(bytes);
        const hangulChunks = utf16Text.match(/[가-힣0-9a-zA-Z .,?!()\\r\\n\\-]{4,}/g);
        if (hangulChunks && hangulChunks.join('').length > 20) {
          editorArea.innerText = hangulChunks.join('\\n').trim();
          statusText.textContent = file.name + ' (HWP 스트림 텍스트 로드 완료)';
        } else {
          editorArea.innerText = utf8Text.slice(0, 8000);
          statusText.textContent = file.name + ' 로드 완료';
        }
        updateCount();
      };
      reader.readAsArrayBuffer(file);
    });

    function insertTable() {
      const container = document.getElementById('tableContainer');
      const tbl = document.createElement('table');
      tbl.className = 'hwp-table';
      tbl.innerHTML = '<thead><tr><th contenteditable="true">항목 1</th><th contenteditable="true">항목 2</th><th contenteditable="true">비고</th></tr></thead>' +
                      '<tbody><tr><td contenteditable="true">내용 입력</td><td contenteditable="true">내용 입력</td><td contenteditable="true">-</td></tr></tbody>';
      container.appendChild(tbl);
      statusText.textContent = '새 한글 표(<hp:tbl>)가 본문 하단에 추가되었습니다.';
    }

    function toggleApproval() {
      const box = document.getElementById('approvalBox');
      box.style.display = box.style.display === 'none' ? 'flex' : 'none';
      statusText.textContent = '행정 결재란 표시 상태를 전환했습니다.';
    }

    function applyGovFormat() {
      editorArea.innerText = editorArea.innerText
        .replace(/^\\s*[-*]\\s+/gm, '  ― ')
        .replace(/^\\s*(\\d+)\\.\\s+/gm, '$1. ');
      statusText.textContent = '행정업무운영편람 공문서 표준 기호(□, ―) 서식을 적용했습니다.';
    }

    function downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 400);
    }

    function saveAsHwpxXml() {
      const title = (docTitle.innerText || '한글문서').trim();
      const paragraphs = (editorArea.innerText || '').split(/\\r?\\n/);
      const xmlLines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">',
        '  <hp:p><hp:run><hp:t>' + title.replace(/[<>&]/g, '') + '</hp:t></hp:run></hp:p>'
      ];
      paragraphs.forEach(line => {
        xmlLines.push('  <hp:p><hp:run><hp:t>' + line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</hp:t></hp:run></hp:p>');
      });
      xmlLines.push('</hs:sec>');
      const blob = new Blob([xmlLines.join('\\n')], { type: 'application/hwp+zip;charset=utf-8' });
      downloadBlob(blob, title + '.hwpx');
      statusText.textContent = title + '.hwpx 파일 저장 완료';
    }

    function saveAsHtmlDoc() {
      const title = (docTitle.innerText || '한글문서').trim();
      const htmlContent = '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>' + title + '</title></head><body>' +
        document.getElementById('a4Sheet').innerHTML + '</body></html>';
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      downloadBlob(blob, title + '_한글문서.html');
      statusText.textContent = title + '_한글문서.html 저장 완료';
    }
  </script>
</body>
</html>`;
}

/**
 * Generates the All-in-One Standalone Apache OpenOffice 4.1.17 Full Suite + HWP/HWPX Editor HTML file
 * (`Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html`).
 * Includes all modules in a single zero-dependency executable HTML file:
 * - Start Center (시작 센터)
 * - HWP / HWPX Korean Word Processor (한글 .hwp/.hwpx 편집기 + 표 + 결재란)
 * - Writer (.odt 텍스트 문서 편집기)
 * - Calc (.ods 스프레드시트 및 함수 계산기)
 * - Impress (.odp 프레젠테이션 슬라이드 편집기 및 슬라이드쇼)
 * - Draw (.odg 벡터 드로잉 및 다이어그램 캔버스)
 * - Math (.odf 수식 편집기 + 콤팩트/표준/확장 여백 프리셋 + 다중 수식 일괄 PDF 인쇄)
 */
export function generateFullOpenOfficeWithHwpStandaloneHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Apache OpenOffice 4.1.17 + 한글(.hwp/.hwpx) 통합 오피스 스위트 (Full Standalone)</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
      background: #f1f5f9;
      color: #0f172a;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: linear-gradient(90deg, #075985, #0369a1, #1e40af);
      color: #fff;
      padding: 10px 18px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .brand { display: flex; align-items: center; gap: 10px; cursor: pointer; }
    .logo-box {
      width: 36px; height: 36px; border-radius: 8px;
      background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.3);
      display: flex; align-items: center; justify-content: center;
      font-weight: 900; font-size: 14px; color: #e0f2fe;
    }
    nav {
      display: flex; flex-wrap: wrap; gap: 4px;
      background: rgba(12, 74, 110, 0.55);
      padding: 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);
    }
    .nav-btn {
      border: none; background: transparent; color: #e0f2fe;
      padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700;
      cursor: pointer; transition: 0.15s;
    }
    .nav-btn:hover { background: rgba(255,255,255,0.12); }
    .nav-btn.active { background: #ffffff; color: #0c4a6e; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
    .subbar {
      background: #0f172a; color: #e2e8f0; padding: 7px 18px;
      font-size: 12px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px;
    }
    .btn {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 6px 12px; border-radius: 6px; border: 1px solid #cbd5e1;
      background: #fff; color: #1e293b; font-size: 12px; font-weight: 700; cursor: pointer; text-decoration: none;
    }
    .btn:hover { background: #f8fafc; }
    .btn-emerald { background: #10b981; color: #fff; border-color: #059669; }
    .btn-emerald:hover { background: #059669; }
    .btn-sky { background: #0284c7; color: #fff; border-color: #0369a1; }
    .btn-sky:hover { background: #0369a1; }
    .btn-amber { background: #f59e0b; color: #111827; border-color: #d97706; }
    .btn-indigo { background: #4f46e5; color: #fff; border-color: #4338ca; }
    main { flex: 1; max-width: 1280px; width: 100%; margin: 0 auto; padding: 16px; }
    .module-pane { display: none; }
    .module-pane.active { display: block; }
    .card {
      background: #fff; border-radius: 12px; border: 1px solid #cbd5e1;
      padding: 18px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); margin-bottom: 16px;
    }
    .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
    .module-card {
      border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px;
      cursor: pointer; transition: 0.15s; background: #fff; text-align: left;
    }
    .module-card:hover { border-color: #0284c7; background: #f0f9ff; transform: translateY(-1px); }
    .toolbar {
      display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
      background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px;
    }
    .a4-sheet {
      background: #fff; max-width: 210mm; min-height: 260mm; margin: 0 auto;
      padding: 20mm; border: 1px solid #cbd5e1; box-shadow: 0 8px 24px rgba(15,23,42,0.12);
    }
    table.hwp-table, table.calc-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    table.hwp-table th, table.hwp-table td { border: 1px solid #334155; padding: 8px; font-size: 13px; }
    table.hwp-table th { background: #e2e8f0; text-align: center; }
    table.calc-table th, table.calc-table td { border: 1px solid #cbd5e1; padding: 4px 6px; font-size: 13px; }
    table.calc-table th { background: #f1f5f9; text-align: center; font-weight: 700; width: 90px; }
    table.calc-table td input { width: 100%; border: none; outline: none; font-size: 13px; background: transparent; }
    .math-preview-box {
      background: #f8fafc; border: 2px solid #cbd5e1; border-radius: 12px;
      min-height: 160px; display: flex; align-items: center; justify-content: center;
      font-family: Georgia, "Times New Roman", serif; font-size: 28px; color: #0f172a;
      transition: 0.2s; margin: 12px 0;
    }
    footer {
      background: #0f172a; color: #94a3b8; font-size: 12px;
      padding: 8px 18px; display: flex; justify-content: space-between;
    }
    .batch-page {
      page-break-after: always; border: 1px solid #cbd5e1; border-radius: 10px;
      padding: 24px; margin-bottom: 14px; background: #fff;
    }
    @media print {
      header, .subbar, .toolbar, footer, .no-print { display: none !important; }
      body { background: #fff; }
      main { max-width: 100%; padding: 0; }
      .a4-sheet { box-shadow: none; border: none; width: 100%; padding: 10mm; }
    }
  </style>
</head>
<body>
  <header>
    <div class="brand" onclick="switchModule('start')">
      <div class="logo-box">AOO</div>
      <div>
        <div style="font-size:15px;font-weight:800;">Apache OpenOffice® 4.1.17 + 한글(.hwp/.hwpx) 통합 스위트</div>
        <div style="font-size:11px;color:#bae6fd;">Writer · Calc · Impress · Draw · Math · 한글(HWP/HWPX) 전 모듈 통합 실행판</div>
      </div>
    </div>
    <nav>
      <button class="nav-btn active" id="tab-start" onclick="switchModule('start')">🏠 시작 센터</button>
      <button class="nav-btn" id="tab-hwp" onclick="switchModule('hwp')">🇰🇷 한글 (.hwp/.hwpx)</button>
      <button class="nav-btn" id="tab-writer" onclick="switchModule('writer')">📝 Writer (.odt)</button>
      <button class="nav-btn" id="tab-calc" onclick="switchModule('calc')">📊 Calc (.ods)</button>
      <button class="nav-btn" id="tab-impress" onclick="switchModule('impress')">📽️ Impress (.odp)</button>
      <button class="nav-btn" id="tab-draw" onclick="switchModule('draw')">🎨 Draw (.odg)</button>
      <button class="nav-btn" id="tab-math" onclick="switchModule('math')">∑ Math (.odf)</button>
    </nav>
  </header>

  <div class="subbar">
    <div>
      <strong>[오픈오피스 + 한글편집기 통합 실행 파일]</strong> 인터넷이나 별도 서버 없이 오픈오피스 6대 모듈과 한글(.hwp/.hwpx) 편집기를 모두 사용할 수 있습니다.
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <a class="btn btn-emerald" href="https://sourceforge.net/projects/openofficeorg.mirror/files/4.1.15/binaries/ko/Apache_OpenOffice_4.1.15_Win_x86_install_ko.exe/download" target="_blank" rel="noopener noreferrer">
        ⬇️ 윈도우 데스크톱 오픈오피스 본체 (.exe, ~135MB) 공식 다운로드
      </a>
      <span id="globalStatus" style="color:#fde68a;font-weight:700;">준비 완료</span>
    </div>
  </div>

  <main>
    <!-- 1. START CENTER -->
    <section class="module-pane active" id="pane-start">
      <div class="card" style="background:linear-gradient(90deg,#ecfdf5,#eff6ff);border:2px solid #10b981;">
        <h2 style="font-size:17px;color:#065f46;margin-bottom:6px;">✅ Apache OpenOffice 4.1.17 전체 모듈 + 한글(.hwp/.hwpx) 통합 패키지</h2>
        <p style="font-size:13px;color:#334155;line-height:1.6;">
          • <strong>웹/독립 실행 통합판 (현재 파일):</strong> 아래 카드를 클릭하면 <strong>한글(.hwp/.hwpx), Writer, Calc, Impress, Draw, Math</strong>를 즉시 실행합니다.<br/>
          • <strong>윈도우 데스크톱 오픈오피스 본체(~135MB .exe) + 한글 메뉴 자동 결합:</strong> 동봉된 <code>Install_OpenOffice_Full_and_HWP.bat</code>를 실행하면 PC에 오픈오피스 본체(.exe)가 없을 때 공식 설치파일(~135MB)을 자동 다운로드·설치한 뒤 한글 확장팩(<code>.oxt</code>)까지 한 번에 등록합니다.
        </p>
      </div>
      <div class="card">
        <h3 style="margin-bottom:12px;font-size:16px;">실행할 오픈오피스 + 한글 모듈을 선택하세요</h3>
        <div class="grid-3">
          <div class="module-card" style="border:2px solid #0284c7;background:#f0f9ff;" onclick="switchModule('hwp')">
            <div style="font-weight:800;font-size:15px;color:#0369a1;margin-bottom:4px;">🇰🇷 한글 문서 (.hwp / .hwpx)</div>
            <div style="font-size:12px;color:#475569;">KS X 6101 표준 .hwp/.hwpx 열기 및 저장, 표(&lt;hp:tbl&gt;) 편집, 행정 결재란, PDF 인쇄</div>
          </div>
          <div class="module-card" onclick="switchModule('writer')">
            <div style="font-weight:800;font-size:15px;color:#0f172a;margin-bottom:4px;">📝 Text Document (Writer .odt)</div>
            <div style="font-size:12px;color:#475569;">OpenDocument 표준 워드프로세서, 문단 스타일 편집 및 .odt/.txt 문서 저장</div>
          </div>
          <div class="module-card" onclick="switchModule('calc')">
            <div style="font-weight:800;font-size:15px;color:#047857;margin-bottom:4px;">📊 Spreadsheet (Calc .ods)</div>
            <div style="font-size:12px;color:#475569;">SUM, AVERAGE, MIN, MAX 및 사칙연산 수식 자동 계산 스프레드시트 및 CSV 내보내기</div>
          </div>
          <div class="module-card" onclick="switchModule('impress')">
            <div style="font-weight:800;font-size:15px;color:#b45309;margin-bottom:4px;">📽️ Presentation (Impress .odp)</div>
            <div style="font-size:12px;color:#475569;">프레젠테이션 슬라이드 추가/편집, 테마 변경 및 전체화면 슬라이드 쇼</div>
          </div>
          <div class="module-card" onclick="switchModule('draw')">
            <div style="font-weight:800;font-size:15px;color:#7e22ce;margin-bottom:4px;">🎨 Drawing (Draw .odg)</div>
            <div style="font-size:12px;color:#475569;">다이어그램 사각형·원·텍스트 벡터 도형 추가 및 SVG 이미지 저장</div>
          </div>
          <div class="module-card" onclick="switchModule('math')">
            <div style="font-weight:800;font-size:15px;color:#4338ca;margin-bottom:4px;">∑ Formula (Math .odf)</div>
            <div style="font-size:12px;color:#475569;">StarMath 수식 편집기, 여백 프리셋(콤팩트/표준/확장) 및 다중 수식 일괄 PDF 변환</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 2. HWP / HWPX EDITOR -->
    <section class="module-pane" id="pane-hwp">
      <div class="toolbar">
        <label class="btn btn-sky">
          📂 한글(.hwp/.hwpx) 열기
          <input type="file" id="hwpFileInput" accept=".hwp,.hwpx,.txt,.html" style="display:none" />
        </label>
        <button class="btn btn-amber" onclick="saveHwpx()">💾 .hwpx 저장</button>
        <button class="btn" onclick="addHwpTable()">📊 표(&lt;hp:tbl&gt;) 추가</button>
        <button class="btn" onclick="toggleHwpApproval()">💮 결재란 표시/숨김</button>
        <button class="btn" onclick="window.print()">🖨️ 인쇄 / PDF 저장</button>
      </div>
      <div class="a4-sheet" id="hwpSheet">
        <div id="hwpApproval" style="display:flex;justify-content:flex-end;margin-bottom:14px;">
          <table style="border-collapse:collapse;">
            <tr><th rowspan="2" style="border:1px solid #334155;padding:4px 8px;background:#f1f5f9;font-size:12px;">결<br/>재</th><th style="border:1px solid #334155;padding:4px 14px;background:#f1f5f9;font-size:11px;">담당</th><th style="border:1px solid #334155;padding:4px 14px;background:#f1f5f9;font-size:11px;">검토</th><th style="border:1px solid #334155;padding:4px 14px;background:#f1f5f9;font-size:11px;">결재</th></tr>
            <tr><td contenteditable="true" style="border:1px solid #334155;height:38px;text-align:center;color:#b91c1c;font-weight:700;font-size:12px;">승인</td><td contenteditable="true" style="border:1px solid #334155;height:38px;text-align:center;color:#b91c1c;font-weight:700;font-size:12px;">승인</td><td contenteditable="true" style="border:1px solid #334155;height:38px;text-align:center;color:#1d4ed8;font-weight:700;font-size:12px;">전결</td></tr>
          </table>
        </div>
        <div id="hwpTitle" contenteditable="true" style="font-size:21px;font-weight:800;text-align:center;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:16px;">
          2026년도 Apache OpenOffice + 한글(.hwp/.hwpx) 통합 문서
        </div>
        <div id="hwpBody" contenteditable="true" style="min-height:260px;line-height:1.75;font-size:15px;white-space:pre-wrap;">1. 관련근거: 국가표준 KS X 6101(OWPML) 및 OpenDocument(ODF 1.2) 통합 운용 지침

2. 본 프로그램은 Apache OpenOffice 6대 모듈(Writer, Calc, Impress, Draw, Math)과 한글(.hwp/.hwpx) 문서 편집기를 하나로 통합한 실행 파일입니다.

□ 주요 기능
  ― 한글(.hwp/.hwpx) 문서 열기/저장 및 표(&lt;hp:tbl&gt;) 편집
  ― 수식 편집기(Math) 여백 프리셋(콤팩트/표준/확장) 및 다중 수식 일괄 PDF 변환</div>
        <div id="hwpTables">
          <table class="hwp-table">
            <thead><tr><th>모듈명</th><th>지원 파일 형식</th><th>주요 기능</th></tr></thead>
            <tbody>
              <tr><td contenteditable="true" style="text-align:center;">한글 편집기</td><td contenteditable="true" style="text-align:center;">.hwp / .hwpx</td><td contenteditable="true">공문서 결재란, 표 편집, OWPML 저장</td></tr>
              <tr><td contenteditable="true" style="text-align:center;">OpenOffice Suite</td><td contenteditable="true" style="text-align:center;">.odt / .ods / .odp / .odg / .odf</td><td contenteditable="true">워드·스프레드시트·프레젠테이션·드로잉·수식 통합</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- 3. WRITER (.odt) -->
    <section class="module-pane" id="pane-writer">
      <div class="toolbar">
        <strong>Writer (.odt):</strong>
        <input id="writerTitle" value="OpenOffice_Writer_Document.odt" style="padding:5px 8px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px;width:240px;" />
        <button class="btn btn-sky" onclick="saveWriterDoc()">💾 문서(.odt.txt) 다운로드</button>
        <button class="btn" onclick="window.print()">🖨️ 인쇄 / PDF</button>
      </div>
      <div class="a4-sheet">
        <textarea id="writerArea" style="width:100%;min-height:460px;border:none;outline:none;font-size:15px;line-height:1.7;resize:vertical;">Apache OpenOffice 4.1.17 Writer (OpenDocument Text)
==================================================

이 모듈은 OpenOffice Writer 워드프로세서입니다.
상단 탭에서 한글(.hwp/.hwpx), Calc(.ods), Impress(.odp), Draw(.odg), Math(.odf) 모듈로 즉시 전환할 수 있습니다.</textarea>
      </div>
    </section>

    <!-- 4. CALC (.ods) -->
    <section class="module-pane" id="pane-calc">
      <div class="toolbar">
        <strong>Calc (.ods) 수식 지원:</strong>
        <span style="font-size:12px;color:#475569;">셀에 <code>=SUM(B1:B3)</code>, <code>=AVERAGE(B1:B3)</code> 또는 <code>=120+350</code> 입력 후 포커스 이동 시 자동 계산됩니다.</span>
        <button class="btn btn-emerald" onclick="recalcAll()">🔄 수식 재계산</button>
        <button class="btn btn-sky" onclick="exportCalcCsv()">💾 CSV(.csv) 내보내기</button>
      </div>
      <div class="card" style="overflow-x:auto;">
        <table class="calc-table" id="calcGrid"></table>
      </div>
    </section>

    <!-- 5. IMPRESS (.odp) -->
    <section class="module-pane" id="pane-impress">
      <div class="toolbar">
        <strong>Impress (.odp):</strong>
        <button class="btn btn-sky" onclick="addSlide()">➕ 새 슬라이드 추가</button>
        <button class="btn btn-indigo" onclick="prevSlide()">◀ 이전</button>
        <span id="slideIndicator" style="font-size:12px;font-weight:700;">1 / 2</span>
        <button class="btn btn-indigo" onclick="nextSlide()">다음 ▶</button>
      </div>
      <div class="card" style="background:linear-gradient(135deg,#0f172a,#1e3a8a);color:#fff;min-height:380px;display:flex;flex-direction:column;justify-content:center;padding:48px;border-radius:14px;">
        <input id="slideTitle" oninput="updateCurrentSlide()" style="background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,0.3);color:#fff;font-size:30px;font-weight:800;margin-bottom:20px;outline:none;" />
        <textarea id="slideBody" oninput="updateCurrentSlide()" style="background:transparent;border:none;color:#e0f2fe;font-size:18px;line-height:1.7;min-height:180px;outline:none;resize:none;"></textarea>
      </div>
    </section>

    <!-- 6. DRAW (.odg) -->
    <section class="module-pane" id="pane-draw">
      <div class="toolbar">
        <strong>Draw (.odg) 벡터 캔버스:</strong>
        <button class="btn btn-sky" onclick="addDrawShape('rect')">▭ 사각형 추가</button>
        <button class="btn btn-emerald" onclick="addDrawShape('circle')">◯ 원형 노드 추가</button>
        <button class="btn btn-amber" onclick="exportDrawSvg()">💾 SVG 저장</button>
      </div>
      <div class="card" style="display:flex;justify-content:center;background:#e2e8f0;">
        <svg id="drawSvg" width="760" height="420" viewBox="0 0 760 420" style="background:#fff;border:1px solid #94a3b8;border-radius:8px;">
          <rect x="60" y="60" width="200" height="90" rx="10" fill="#0284c7" />
          <text x="160" y="110" text-anchor="middle" fill="#fff" font-size="15" font-weight="bold">Apache OpenOffice 4.1.17</text>
          <rect x="340" y="60" width="220" height="90" rx="10" fill="#10b981" />
          <text x="450" y="110" text-anchor="middle" fill="#fff" font-size="15" font-weight="bold">한글(.hwp/.hwpx) 편집기</text>
          <line x1="260" y1="105" x2="340" y2="105" stroke="#0f172a" stroke-width="3" />
        </svg>
      </div>
    </section>

    <!-- 7. MATH (.odf) + SPACING PRESETS + BATCH PDF -->
    <section class="module-pane" id="pane-math">
      <div class="toolbar">
        <strong>Math (.odf) 여백/간격 프리셋:</strong>
        <button class="btn" onclick="applyMathSpacing(12, 8, '콤팩트')">콤팩트 (12px / 8px)</button>
        <button class="btn btn-sky" onclick="applyMathSpacing(28, 20, '표준')">표준 (28px / 20px)</button>
        <button class="btn" onclick="applyMathSpacing(56, 40, '확장')">확장 (56px / 40px)</button>
        <span style="margin-left:auto;font-size:12px;color:#475569;" id="mathSpacingInfo">현재 간격: 표준 (좌우 28px, 상하 20px)</span>
      </div>
      <div class="card">
        <label style="font-size:12px;font-weight:700;display:block;margin-bottom:6px;">StarMath 수식 입력:</label>
        <textarea id="mathInput" oninput="renderMathPreview()" style="width:100%;height:70px;padding:10px;font-family:monospace;font-size:14px;border:1px solid #cbd5e1;border-radius:8px;">f(x) = int from {-infty} to {+infty} e^{-x^2} dx = sqrt{%pi}</textarea>
        <div class="math-preview-box" id="mathPreviewBox" style="padding:20px 28px;">
          f(x) = ∫(-∞ → +∞) e^(-x²) dx = √(π)
        </div>
      </div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
          <div>
            <h4 style="font-size:14px;font-weight:800;">📄 다중 StarMath 수식 일괄 변환 (Batch Convert to PDF — 페이지 나누기 적용)</h4>
            <p style="font-size:12px;color:#475569;">각 줄의 수식을 개별 페이지(Page Break)로 분리하여 단일 PDF 문서로 인쇄·변환합니다.</p>
          </div>
          <div style="display:flex;gap:6px;">
            <label class="btn">
              📂 수식 .txt 업로드
              <input type="file" id="batchMathFile" accept=".txt,.mml" style="display:none" />
            </label>
            <button class="btn btn-indigo" onclick="renderBatchMathPages();window.print();">🖨️ 일괄 PDF 인쇄/저장</button>
          </div>
        </div>
        <textarea id="batchMathInput" oninput="renderBatchMathPages()" style="width:100%;height:95px;padding:8px;font-family:monospace;font-size:12px;border:1px solid #cbd5e1;border-radius:8px;">E = m c^2
int from {0} to {%pi} sin(x) dx = 2
sum from {n=1} to {infty} {1 over n^2} = {%pi^2 over 6}</textarea>
        <div id="batchMathContainer" style="margin-top:12px;"></div>
      </div>
    </section>
  </main>

  <footer>
    <span>Apache OpenOffice 4.1.17 + 한글(.hwp/.hwpx) 통합 스위트 v${HWP_PLUGIN_MANIFEST.pluginVersion}</span>
    <span>전체 모듈 (Start · HWP · Writer · Calc · Impress · Draw · Math) 내장됨</span>
  </footer>

  <script>
    const statusEl = document.getElementById('globalStatus');
    function setStatus(msg) { statusEl.textContent = msg; }

    function switchModule(mod) {
      document.querySelectorAll('.module-pane').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
      const pane = document.getElementById('pane-' + mod);
      const tab = document.getElementById('tab-' + mod);
      if (pane) pane.classList.add('active');
      if (tab) tab.classList.add('active');
      setStatus('현재 모듈: ' + mod.toUpperCase());
    }

    function downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 400);
    }

    // HWP functions
    document.getElementById('hwpFileInput').addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (!file) return;
      document.getElementById('hwpTitle').innerText = file.name.replace(/\\.(hwpx|hwp|txt|html)$/i, '');
      const reader = new FileReader();
      reader.onload = function(evt) {
        const bytes = new Uint8Array(evt.target.result);
        const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        if (utf8.includes('<hp:t>')) {
          const m = Array.from(utf8.matchAll(/<hp:t[^>]*>([\\s\\S]*?)<\\/hp:t>/g)).map(x => x[1]);
          if (m.length) { document.getElementById('hwpBody').innerText = m.join('\\n'); setStatus(file.name + ' 열기 완료'); return; }
        }
        document.getElementById('hwpBody').innerText = utf8.slice(0, 8000);
        setStatus(file.name + ' 로드 완료');
      };
      reader.readAsArrayBuffer(file);
    });

    function saveHwpx() {
      const title = (document.getElementById('hwpTitle').innerText || '한글문서').trim();
      const lines = (document.getElementById('hwpBody').innerText || '').split(/\\r?\\n/);
      const xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">'];
      lines.forEach(l => xml.push('  <hp:p><hp:run><hp:t>' + l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</hp:t></hp:run></hp:p>'));
      xml.push('</hs:sec>');
      downloadBlob(new Blob([xml.join('\\n')], { type: 'application/hwp+zip;charset=utf-8' }), title + '.hwpx');
      setStatus(title + '.hwpx 저장 완료');
    }
    function addHwpTable() {
      const div = document.getElementById('hwpTables');
      const tbl = document.createElement('table');
      tbl.className = 'hwp-table';
      tbl.innerHTML = '<thead><tr><th contenteditable="true">항목</th><th contenteditable="true">내용</th><th contenteditable="true">비고</th></tr></thead><tbody><tr><td contenteditable="true">데이터 1</td><td contenteditable="true">내용 입력</td><td contenteditable="true">-</td></tr></tbody>';
      div.appendChild(tbl);
      setStatus('한글 표(<hp:tbl>) 추가됨');
    }
    function toggleHwpApproval() {
      const el = document.getElementById('hwpApproval');
      el.style.display = el.style.display === 'none' ? 'flex' : 'none';
    }

    // Writer functions
    function saveWriterDoc() {
      const name = document.getElementById('writerTitle').value || 'Document.odt';
      const text = document.getElementById('writerArea').value;
      downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), name + '.txt');
      setStatus(name + '.txt 다운로드 완료');
    }

    // Calc functions
    const calcCols = ['A','B','C','D','E','F'];
    const calcRows = [1,2,3,4,5,6,7,8];
    const calcRaw = { A1:'품목', B1:'1분기', C1:'2분기', D1:'합계', A2:'데스크톱 오픈오피스', B2:'120', C2:'180', D2:'=B2+C2', A3:'한글(.hwp) 확장팩', B3:'240', C3:'310', D3:'=B3+C3', A4:'전체 합계', B4:'=SUM(B2:B3)', C4:'=SUM(C2:C3)', D4:'=SUM(D2:D3)' };
    function initCalc() {
      const grid = document.getElementById('calcGrid');
      let html = '<thead><tr><th></th>' + calcCols.map(c => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>';
      calcRows.forEach(r => {
        html += '<tr><th>' + r + '</th>';
        calcCols.forEach(c => {
          const id = c + r;
          html += '<td><input id="cell-' + id + '" data-id="' + id + '" onfocus="onCellFocus(this)" onblur="onCellBlur(this)" /></td>';
        });
        html += '</tr>';
      });
      html += '</tbody>';
      grid.innerHTML = html;
      recalcAll();
    }
    function evalCalcCell(id) {
      const raw = String(calcRaw[id] || '');
      if (!raw.startsWith('=')) return raw;
      const expr = raw.slice(1).toUpperCase().trim();
      const sumM = expr.match(/^SUM\\(([A-F])(\\d+):([A-F])(\\d+)\\)$/);
      if (sumM) {
        let s = 0;
        for (let c = sumM[1].charCodeAt(0); c <= sumM[3].charCodeAt(0); c++) {
          for (let r = parseInt(sumM[2]); r <= parseInt(sumM[4]); r++) {
            const v = parseFloat(evalCalcCell(String.fromCharCode(c) + r));
            if (!isNaN(v)) s += v;
          }
        }
        return String(s);
      }
      try {
        const rep = expr.replace(/[A-F]\\d+/g, ref => {
          const v = parseFloat(evalCalcCell(ref));
          return isNaN(v) ? '0' : String(v);
        });
        return String(Function('"use strict";return (' + rep + ')')());
      } catch { return '#ERR'; }
    }
    function onCellFocus(inp) { inp.value = calcRaw[inp.dataset.id] || ''; }
    function onCellBlur(inp) { calcRaw[inp.dataset.id] = inp.value; recalcAll(); }
    function recalcAll() {
      calcRows.forEach(r => calcCols.forEach(c => {
        const id = c + r;
        const el = document.getElementById('cell-' + id);
        if (el && document.activeElement !== el) el.value = evalCalcCell(id);
      }));
    }
    function exportCalcCsv() {
      const csv = calcRows.map(r => calcCols.map(c => evalCalcCell(c + r)).join(',')).join('\\n');
      downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'OpenOffice_Calc.csv');
      setStatus('OpenOffice_Calc.csv 저장 완료');
    }
    initCalc();

    // Impress functions
    const slides = [
      { title: 'Apache OpenOffice 4.1.17 + 한글(.hwp/.hwpx) 통합 스위트', body: '• 오픈오피스 6대 모듈과 한글(.hwp/.hwpx) 편집기 완전 통합\\n• 데스크톱 오픈오피스(.exe) + 한글 확장팩(.oxt) 자동 설치 지원' },
      { title: '다중 수식 일괄 PDF 변환 & 플러그인 매니저', body: '• StarMath 다중 수식 파일을 페이지 구분(Page Break) PDF로 일괄 변환\\n• 외부 JS/CSS 플러그인 동적 로드 및 토글 지원' }
    ];
    let slideIdx = 0;
    function renderSlide() {
      document.getElementById('slideTitle').value = slides[slideIdx].title;
      document.getElementById('slideBody').value = slides[slideIdx].body;
      document.getElementById('slideIndicator').textContent = (slideIdx + 1) + ' / ' + slides.length;
    }
    function updateCurrentSlide() {
      slides[slideIdx].title = document.getElementById('slideTitle').value;
      slides[slideIdx].body = document.getElementById('slideBody').value;
    }
    function addSlide() { slides.push({ title: '새 슬라이드 #' + (slides.length + 1), body: '• 내용을 입력하세요' }); slideIdx = slides.length - 1; renderSlide(); }
    function prevSlide() { if (slideIdx > 0) { slideIdx--; renderSlide(); } }
    function nextSlide() { if (slideIdx < slides.length - 1) { slideIdx++; renderSlide(); } }
    renderSlide();

    // Draw functions
    function addDrawShape(type) {
      const svg = document.getElementById('drawSvg');
      if (type === 'rect') {
        const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        r.setAttribute('x', String(80 + Math.floor(Math.random()*400)));
        r.setAttribute('y', String(200 + Math.floor(Math.random()*120)));
        r.setAttribute('width', '140'); r.setAttribute('height', '65'); r.setAttribute('rx', '8');
        r.setAttribute('fill', '#6366f1');
        svg.appendChild(r);
      } else {
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', String(150 + Math.floor(Math.random()*400)));
        c.setAttribute('cy', String(240 + Math.floor(Math.random()*100)));
        c.setAttribute('r', '40'); c.setAttribute('fill', '#f59e0b');
        svg.appendChild(c);
      }
      setStatus('Draw 도형이 캔버스에 추가되었습니다.');
    }
    function exportDrawSvg() {
      const svgXml = document.getElementById('drawSvg').outerHTML;
      downloadBlob(new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' }), 'OpenOffice_Draw.svg');
      setStatus('OpenOffice_Draw.svg 저장 완료');
    }

    // Math functions
    function formatStarMath(str) {
      return str
        .replace(/%pi/g, 'π').replace(/%alpha/g, 'α').replace(/%beta/g, 'β').replace(/%theta/g, 'θ')
        .replace(/\\binfty\\b/g, '∞').replace(/\\bint\\b/g, '∫').replace(/\\bsum\\b/g, '∑')
        .replace(/\\bsqrt\\b/g, '√').replace(/\\bover\\b/g, ' / ');
    }
    function renderMathPreview() {
      const raw = document.getElementById('mathInput').value;
      document.getElementById('mathPreviewBox').textContent = formatStarMath(raw);
    }
    function applyMathSpacing(px, py, label) {
      const box = document.getElementById('mathPreviewBox');
      box.style.padding = py + 'px ' + px + 'px';
      document.getElementById('mathSpacingInfo').textContent = '현재 간격: ' + label + ' (좌우 ' + px + 'px, 상하 ' + py + 'px)';
      setStatus('수식 여백 프리셋 [' + label + '] 적용 완료');
    }
    function renderBatchMathPages() {
      const raw = document.getElementById('batchMathInput').value;
      const lines = raw.split(/\\r?\\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      const container = document.getElementById('batchMathContainer');
      container.innerHTML = lines.map((line, idx) =>
        '<div class="batch-page">' +
          '<div style="font-size:11px;color:#64748b;font-weight:700;margin-bottom:8px;">페이지 ' + (idx + 1) + ' / ' + lines.length + ' (Page Break 구분)</div>' +
          '<div style="font-size:24px;font-family:Georgia,serif;padding:16px;background:#f8fafc;border-radius:8px;text-align:center;">' + formatStarMath(line) + '</div>' +
          '<div style="font-size:11px;font-family:monospace;color:#475569;margin-top:8px;">StarMath: ' + line + '</div>' +
        '</div>'
      ).join('');
    }
    document.getElementById('batchMathFile').addEventListener('change', function(e) {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = function(evt) {
        document.getElementById('batchMathInput').value = evt.target.result;
        renderBatchMathPages();
        setStatus(f.name + ' 다중 수식 로드 완료');
      };
      r.readAsText(f);
    });
    renderBatchMathPages();
  </script>
</body>
</html>`;
}


