@echo off
chcp 65001 >nul
setlocal

echo ============================================================================
echo   [Apache OpenOffice 한글(.hwp/.hwpx) 편집기 및 확장팩 자동 설치기 v1.2.0]
echo   1. 사용자 프로필(AppData)에 무설치 독립형 한글 편집기 엔진 자동 복사
echo   2. 데스크톱 오픈오피스 설치 폴더 자동 감지 및 메뉴 확장팩(.oxt) 등록
echo   3. 바탕화면 바로가기 생성 및 즉시 실행 지원
echo ============================================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "AOO_USER_HWP_DIR=%APPDATA%\OpenOffice\4\user\hwp-editor"

echo [1/3] 사용자 프로필 폴더에 한글 편집기 파일 복사 중...
if not exist "%AOO_USER_HWP_DIR%" mkdir "%AOO_USER_HWP_DIR%" 2>nul

if exist "%SCRIPT_DIR%Apache_OpenOffice_HWP_Standalone.html" (
    copy /Y "%SCRIPT_DIR%Apache_OpenOffice_HWP_Standalone.html" "%AOO_USER_HWP_DIR%\" >nul 2>nul
    echo       - Apache_OpenOffice_HWP_Standalone.html 복사 완료
)
if exist "%SCRIPT_DIR%Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html" (
    copy /Y "%SCRIPT_DIR%Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html" "%AOO_USER_HWP_DIR%\" >nul 2>nul
    echo       - Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html 복사 완료
)

echo.
echo [2/3] 오픈오피스 설치 경로 및 unopkg 실행 도구 탐색 중...
set "UNOPKG_PATH="
if exist "%SCRIPT_DIR%program\unopkg.com" set "UNOPKG_PATH=%SCRIPT_DIR%program\unopkg.com"
if "%UNOPKG_PATH%"=="" if exist "%SCRIPT_DIR%unopkg.com" set "UNOPKG_PATH=%SCRIPT_DIR%unopkg.com"
if "%UNOPKG_PATH%"=="" if exist "%SCRIPT_DIR%..\program\unopkg.com" set "UNOPKG_PATH=%SCRIPT_DIR%..\program\unopkg.com"
if "%UNOPKG_PATH%"=="" if exist "%ProgramFiles(x86)%\OpenOffice 4\program\unopkg.com" set "UNOPKG_PATH=%ProgramFiles(x86)%\OpenOffice 4\program\unopkg.com"
if "%UNOPKG_PATH%"=="" if exist "%ProgramFiles%\OpenOffice 4\program\unopkg.com" set "UNOPKG_PATH=%ProgramFiles%\OpenOffice 4\program\unopkg.com"
if "%UNOPKG_PATH%"=="" if exist "C:\Program Files (x86)\OpenOffice 4\program\unopkg.com" set "UNOPKG_PATH=C:\Program Files (x86)\OpenOffice 4\program\unopkg.com"
if "%UNOPKG_PATH%"=="" if exist "C:\Program Files\OpenOffice 4\program\unopkg.com" set "UNOPKG_PATH=C:\Program Files\OpenOffice 4\program\unopkg.com"
if "%UNOPKG_PATH%"=="" if exist "C:\openoffice4\program\unopkg.com" set "UNOPKG_PATH=C:\openoffice4\program\unopkg.com"
if "%UNOPKG_PATH%"=="" if exist "%SCRIPT_DIR%program\unopkg.exe" set "UNOPKG_PATH=%SCRIPT_DIR%program\unopkg.exe"
if "%UNOPKG_PATH%"=="" if exist "%ProgramFiles(x86)%\OpenOffice 4\program\unopkg.exe" set "UNOPKG_PATH=%ProgramFiles(x86)%\OpenOffice 4\program\unopkg.exe"
if "%UNOPKG_PATH%"=="" if exist "%ProgramFiles%\OpenOffice 4\program\unopkg.exe" set "UNOPKG_PATH=%ProgramFiles%\OpenOffice 4\program\unopkg.exe"

if "%UNOPKG_PATH%"=="" goto NoUnopkg

echo       - 오픈오피스 unopkg 도구 확인됨: "%UNOPKG_PATH%"

if exist "%SCRIPT_DIR%Apache_OpenOffice_HWP_Extension_v1.2.0.oxt" (
    echo.
    echo [3/3] 오픈오피스에 한글(.hwp/.hwpx) 메뉴 확장팩(.oxt) 등록 중...
    "%UNOPKG_PATH%" add -f "%SCRIPT_DIR%Apache_OpenOffice_HWP_Extension_v1.2.0.oxt"
    echo.
    echo [완료] 오픈오피스 메뉴바에 [한글(.hwp/.hwpx)] 메뉴가 성공적으로 등록되었습니다!
    echo        ※ 만약 오픈오피스가 열려 있었다면 완전히 종료한 후 다시 실행해 주세요.
    goto MakeShortcut
) else (
    echo [안내] "%SCRIPT_DIR%Apache_OpenOffice_HWP_Extension_v1.2.0.oxt" 파일을 찾지 못했습니다.
    goto MakeShortcut
)

:NoUnopkg
echo.
echo [안내 2/3] PC에서 unopkg.com 자동 탐색에 실패했습니다.
echo            오픈오피스 실행 후 상단 메뉴 [도구] - [확장 관리자] - [추가]를 눌러
echo            "%SCRIPT_DIR%Apache_OpenOffice_HWP_Extension_v1.2.0.oxt" 파일을 선택하시면 바로 등록됩니다.

:MakeShortcut
echo.
echo [안내] 바탕화면 바로가기 생성 중...
set "DESK_DIR=%USERPROFILE%\Desktop"
if not exist "%DESK_DIR%" if exist "%USERPROFILE%\OneDrive\Desktop" set "DESK_DIR=%USERPROFILE%\OneDrive\Desktop"
if not exist "%DESK_DIR%" if exist "%PUBLIC%\Desktop" set "DESK_DIR=%PUBLIC%\Desktop"

if exist "%DESK_DIR%" (
    if exist "%AOO_USER_HWP_DIR%\Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html" (
        echo [InternetShortcut] > "%DESK_DIR%\오픈오피스 4.1.17 + 한글(HWP) 통합스위트.url"
        echo URL=file:///%AOO_USER_HWP_DIR:\=/%/Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html >> "%DESK_DIR%\오픈오피스 4.1.17 + 한글(HWP) 통합스위트.url"
        echo       - 바탕화면에 [오픈오피스 4.1.17 + 한글(HWP) 통합스위트] 바로가기 생성 완료
    )
    if exist "%AOO_USER_HWP_DIR%\Apache_OpenOffice_HWP_Standalone.html" (
        echo [InternetShortcut] > "%DESK_DIR%\오픈오피스 한글(HWP·HWPX) 편집기.url"
        echo URL=file:///%AOO_USER_HWP_DIR:\=/%/Apache_OpenOffice_HWP_Standalone.html >> "%DESK_DIR%\오픈오피스 한글(HWP·HWPX) 편집기.url"
        echo       - 바탕화면에 [오픈오피스 한글(HWP·HWPX) 편집기] 바로가기 생성 완료
    )
)

echo.
echo ============================================================================
echo   [설치 완료] 한글(.hwp/.hwpx) 편집기 설정이 성공적으로 완료되었습니다!
echo   지금 바로 오픈오피스를 실행하여 상단 [한글(.hwp/.hwpx)] 메뉴를 이용해 보세요.
echo ============================================================================
pause
