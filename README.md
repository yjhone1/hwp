# Apache OpenOffice® 4.1.17 + 한글(.hwp/.hwpx) 통합 스위트

Apache OpenOffice 6대 전 모듈(시작 센터, Writer `.odt`, Calc `.ods`, Impress `.odp`, Draw `.odg`, Math `.odf`)과 한글(.hwp/.hwpx) 문서 편집기 및 OXT 확장팩 통합 프로젝트입니다.

---

## 🚀 주요 구성 내용

1. **오픈오피스 6대 핵심 모듈 (전체 내장)**
   - **시작 센터 (Start Center)**: 전 모듈 런처 및 통합 다운로드/확장팩 관리
   - **Writer (.odt)**: 국제 표준 OpenDocument 워드프로세서
   - **Calc (.ods)**: SUM, AVERAGE, MIN, MAX 및 사칙연산 수식 지원 스프레드시트
   - **Impress (.odp)**: 프레젠테이션 슬라이드 제작 및 전체화면 슬라이드 쇼
   - **Draw (.odg)**: 벡터 다이어그램 및 순서도 작성 캔버스
   - **Math (.odf)**: StarMath 수식 편집기, 여백 프리셋(콤팩트/표준/확장), 다중 수식 일괄 PDF 변환(Batch PDF)
   - **한글 문서 (.hwp / .hwpx)**: KS X 6101(OWPML) 및 HWP 5.0 호환 편집기, 표(`<hp:tbl>`) 편집 및 셀 병합, 행정기관 표준 결재란, 원고지 분량 계산

2. **GitHub Actions 윈도우 배포판 자동 빌드 CI/CD (`.github/workflows/build-windows.yml`)**
   - 로컬에서 `yjhone1/openoffice-hwp` 저장소의 `master` 또는 `main` 브랜치로 푸시(push)하면 GitHub Actions가 자동으로 실행됩니다.
   - Vite 웹 애플리케이션 빌드, 무설치 독립 실행판 통합, 윈도우 배포 압축 파일(`OpenOffice-4.1.17-HWP-Windows-Distribution.zip`) 생성을 자동으로 수행하여 GitHub Actions 아티팩트로 다운로드할 수 있습니다.

3. **데스크톱 오픈오피스 한글 확장팩 수동 설치 지원 (`.oxt`)**
   - 오픈오피스 데스크톱 버전에 사용자가 직접 수동으로 한글 기능을 추가할 수 있는 표준 확장팩(`Apache_OpenOffice_HWP_Extension_v2.2.0.oxt`) 및 수동 설치 가이드(`수동_설치_방법_안내.txt`)를 제공합니다.

---

## 🛠️ 오픈오피스 데스크톱에 한글(.hwp/.hwpx) 확장팩 수동 추가 방법

1. Apache OpenOffice(오픈오피스) 프로그램을 실행합니다.
2. 상단 메뉴에서 **[도구 (Tools)] > [확장 관리자 (Extension Manager...)]**를 클릭합니다. (단축키: `Ctrl + Alt + E`)
3. 확장 관리자 창 하단의 **[추가 (Add...)]** 버튼을 클릭합니다.
4. `Apache_OpenOffice_HWP_Extension_v2.2.0.oxt` 파일을 선택하고 **[열기]**를 누릅니다.
5. 사용권 계약 화면에서 **[수락 (Accept)]**을 누르면 설치가 완료됩니다.
6. 오픈오피스를 완전히 종료한 후 다시 실행하면 상단 메뉴바에 **[한글(.hwp/.hwpx)]** 메뉴가 활성화됩니다!

---

## 🌐 개발 및 배포 아키텍처 (아파치 원본 동적 복제 + 한글 확장팩 독립 푸시)

본 프로젝트는 **2.5GB의 아파치 오픈오피스 C++ 전체 소스를 개인 저장소에 직접 올리지 않고**, 공식 확장팩 표준에 따라 개발·배포됩니다:

1. **아파치 공식 소스(AOO41X) 동적 복제 및 개발**:
   - `fetch-apache-openoffice.bat` (윈도우) 또는 `fetch-apache-openoffice.sh` (맥/리눅스)를 실행하면, 아파치 공식 저장소(`apache/openoffice`, AOO41X 브랜치)의 최신 소스를 `aoo-official-source`로 복제하고 본 한글 확장팩 소스를 `main/extensions/hwp`에 자동 연결합니다.
   - 오픈오피스 버전이 4.1.18, 4.2.0 등으로 업데이트되어도 스크립트 실행만으로 새 버전을 즉시 불러와 한글 확장팩 호환성을 검증할 수 있습니다.

2. **한글 확장팩 단독 빌드 (.oxt)**:
   - `build-oxt.bat` (또는 `npm run build:oxt`)를 실행하면 `openoffice-extension-oxt/` 소스로부터 `Apache_OpenOffice_HWP_Extension_v2.2.0.oxt` 바이너리 확장팩이 빌드됩니다.

3. **깃허브(`yjhone1/openoffice-hwp`)에는 한글 확장팩만 가볍고 완전하게 푸시**:
   - `push-to-github.bat` (또는 수동 Git 명령어)을 실행하여 `yjhone1/openoffice-hwp`로 푸시합니다:
   ```bash
   git init
   git checkout -B master
   git remote add origin https://github.com/yjhone1/openoffice-hwp.git
   git add .
   git commit -m "feat: Apache OpenOffice Korean (HWP/HWPX) Extension suite & automated CI/CD"
   git push -u origin master --force
   ```

4. **GitHub Actions 윈도우 배포판 자동 빌드**:
   - `yjhone1/openoffice-hwp`로 푸시되면 `.github/workflows/build-windows.yml`이 자동으로 실행되어 아파치 공식 소스를 불러와 한글 확장팩과 결합하고, `OpenOffice-4.1.17-HWP-Windows-Distribution.zip` 윈도우 배포판과 `Apache_OpenOffice_HWP_Extension_v2.2.0.oxt` 독립 확장팩을 빌드 및 산출물(Artifacts)로 업로드합니다!

---

## 💻 로컬 개발 및 빌드 명령어

```bash
# 1. 의존성 설치
npm install

# 2. 로컬 웹 개발 서버 실행
npm run dev

# 3. 한글 확장팩 (.oxt) 빌드
npm run build:oxt

# 4. 프로덕션 빌드
npm run build
```

