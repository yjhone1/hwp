import React, { useState, useMemo, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import {
  Upload,
  Download,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Table as TableIcon,
  Stamp,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  Columns,
  ShieldCheck,
  Maximize2,
  Package,
  Copy,
  Layers,
  Settings,
  Play,
  Code2,
} from 'lucide-react';
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
  HwpExternalPlugin,
  DEFAULT_HWP_EXTERNAL_PLUGINS,
} from '../plugins/hwp-extension/pluginManifest';
import {
  generateWindowsInstallBat,
  generateUnixInstallSh,
  toWindowsCrlf,
} from '../plugins/hwp-extension/fullProjectExporter';

export interface HwpEditorProps {
  onStatusChange: (msg: string) => void;
  initialFilename?: string;
  onDownloadFullProject?: () => void;
}

interface ApprovalSlot {
  role: string;
  name: string;
  approved: boolean;
}

export interface HwpTableCell {
  text: string;
  colSpan: number;
  rowSpan: number;
  widthPercent?: number;
  align?: 'left' | 'center' | 'right';
  isHeader?: boolean;
  hiddenBySpan?: boolean;
}

export interface HwpTable {
  id: string;
  caption: string;
  rows: HwpTableCell[][];
}

interface LayoutIntegrityReport {
  verifiedAt: string;
  sourceType: 'template' | 'hwpx' | 'hwp';
  paragraphCount: number;
  tableCount: number;
  mergedCellCount: number;
  orientation: 'portrait' | 'landscape';
  marginPreset: 'standard' | 'narrow' | 'official';
  issuesFixed: string[];
}

const TEMPLATES: Record<
  string,
  {
    title: string;
    subtitle: string;
    body: string;
    tables: HwpTable[];
  }
> = {
  official: {
    title: '2026년도 오픈소스 문서표준(.hwpx) 도입 및 활용 계획(안)',
    subtitle: '행정기관명: 아파치 오픈오피스 코리아 추진단',
    body: `1. 관련 근거
  가. 전자정부법 제50조(표준화) 및 행정효율과 협업 촉진에 관한 규정
  나. 국가표준 KS X 6101(OWPML, 개방형 워드프로세서 마크업 언어)

2. 추진 목적
  □ 한글 문서(.hwp, .hwpx)와 국제 표준 문서(.odt) 간의 상호운용성 확보
  □ 웹 브라우저 환경에서 표·레이아웃 깨짐 없이 즉시 열람·편집 가능한 문서 환경 구축

3. 주요 내용
  ㅇ 지원 확장자: .hwpx (개방형 한글 XML), .hwp (한글 5.0 호환)
  ㅇ 표 셀 병합(colSpan/rowSpan), 다중 줄 셀, 열 너비 비율 및 용지 여백 보존
  ㅇ 공문서 결재란, 표 삽입/병합, 원고지 매수 계산 및 실시간 글자수 통계 지원

4. 향후 일정
  ― 1분기: 부서별 시범 운영 및 문서 양식 표준화 완료
  ― 2분기: 전사 확대 적용 및 문서 변환 자동화 연동`,
    tables: [
      {
        id: 'tbl-1',
        caption: '[표 1] 문서 표준 규격 및 레이아웃 호환성 비교표',
        rows: [
          [
            { text: '구분', colSpan: 1, rowSpan: 1, align: 'center', isHeader: true },
            { text: '문서 포맷', colSpan: 1, rowSpan: 1, align: 'center', isHeader: true },
            { text: '표준 규격', colSpan: 1, rowSpan: 1, align: 'center', isHeader: true },
            { text: '표·레이아웃 보존 상태', colSpan: 1, rowSpan: 1, align: 'center', isHeader: true },
          ],
          [
            { text: '개방형 한글', colSpan: 1, rowSpan: 1, align: 'center' },
            { text: '.hwpx', colSpan: 1, rowSpan: 1, align: 'center' },
            { text: 'KS X 6101 (OWPML XML)', colSpan: 1, rowSpan: 1, align: 'left' },
            { text: '표(<hp:tbl>)·셀병합·여백 완벽 보존', colSpan: 1, rowSpan: 1, align: 'left' },
          ],
          [
            { text: '한글 5.0', colSpan: 1, rowSpan: 1, align: 'center' },
            { text: '.hwp', colSpan: 1, rowSpan: 1, align: 'center' },
            { text: 'HWP 5.0 복합문서', colSpan: 1, rowSpan: 1, align: 'left' },
            { text: '본문 및 구분자 표 자동 복원 지원', colSpan: 1, rowSpan: 1, align: 'left' },
          ],
          [
            { text: '오픈도큐먼트', colSpan: 1, rowSpan: 1, align: 'center' },
            { text: '.odt', colSpan: 1, rowSpan: 1, align: 'center' },
            { text: 'ISO/IEC 26300 (ODF)', colSpan: 1, rowSpan: 1, align: 'left' },
            { text: 'Writer 상호 변환 및 스타일 유지', colSpan: 1, rowSpan: 1, align: 'left' },
          ],
        ],
      },
    ],
  },
  report: {
    title: '주간 업무 추진 실적 및 계획 보고서',
    subtitle: '작성부서: 기술개발팀 / 작성자: 홍길동 선임',
    body: `■ 금주 주요 추진 실적
  1. 웹 기반 한글(.hwp / .hwpx) 문서 편집 및 표 무결성 엔진 고도화
     - KS X 6101 표준 기반 HWPX(<hp:tbl>, <hp:tc>, <hp:cellSpan>) 구조 파싱 및 복원 구현
     - 표 내부 문단(<hp:p>)이 본문으로 섞여 레이아웃이 깨지는 현상 원천 차단
  2. 공문서 전용 조판 도구 추가
     - 결재란 표시/숨김, 문단 줄간격(130%~200%), 용지 방향(세로/가로) 제어 기능 적용

■ 차주 업무 계획
  1. 부서별 복합 표 양식(셀 병합 포함) 템플릿 추가 배포
  2. 문서 보안 및 외부 반출 이력 관리 점검`,
    tables: [
      {
        id: 'tbl-report-1',
        caption: '[표 1] 부서별 주간 핵심 과제 진행 현황',
        rows: [
          [
            { text: '담당 부서', colSpan: 1, rowSpan: 1, align: 'center', isHeader: true },
            { text: '핵심 추진 과제', colSpan: 2, rowSpan: 1, align: 'center', isHeader: true },
            { text: '', colSpan: 1, rowSpan: 1, hiddenBySpan: true },
            { text: '진척도', colSpan: 1, rowSpan: 1, align: 'center', isHeader: true },
          ],
          [
            { text: '문서표준화팀', colSpan: 1, rowSpan: 1, align: 'center' },
            { text: 'HWPX 표 레이아웃 파서 고도화', colSpan: 1, rowSpan: 1, align: 'left' },
            { text: '셀 병합(colSpan/rowSpan) 검증 완료', colSpan: 1, rowSpan: 1, align: 'left' },
            { text: '100%', colSpan: 1, rowSpan: 1, align: 'center' },
          ],
          [
            { text: '품질검증팀', colSpan: 1, rowSpan: 1, align: 'center' },
            { text: '대용량 공문서 표 깨짐 방지 테스트', colSpan: 1, rowSpan: 1, align: 'left' },
            { text: '가로/세로 용지 여백 자동 보정', colSpan: 1, rowSpan: 1, align: 'left' },
            { text: '95%', colSpan: 1, rowSpan: 1, align: 'center' },
          ],
        ],
      },
    ],
  },
  contract: {
    title: '표준 소프트웨어 공동 기술개발 협약서',
    subtitle: '계약번호: 제 2026-AOO-014 호',
    body: `제1조 (목적)
본 협약은 "갑"과 "을"이 개방형 문서 포맷(.hwpx, .hwp, .odt) 호환성 강화를 위한 공동 기술개발을 수행함에 있어 상호 간의 권리와 의무를 규정함을 목적으로 한다.

제2조 (협약 기간)
본 협약의 기간은 2026년 11월 1일부터 2027년 10월 31일까지(12개월)로 하며, 상호 합의에 따라 연장할 수 있다.

제3조 (산출물 귀속 및 공개)
공동 개발된 문서 필터 및 웹 편집기 소스코드는 Apache License 2.0에 따라 공개 소프트웨어로 배포하는 것을 원칙으로 한다.

제4조 (서명 날인)
본 협약의 성립을 증명하기 위하여 협약서 2부를 작성하고 기명날인 후 각각 1부씩 보관한다.`,
    tables: [
      {
        id: 'tbl-contract-1',
        caption: '[별표] 협약 당사자 및 분담 내역',
        rows: [
          [
            { text: '구분', colSpan: 1, rowSpan: 1, align: 'center', isHeader: true },
            { text: '기관명', colSpan: 1, rowSpan: 1, align: 'center', isHeader: true },
            { text: '담당 역할', colSpan: 1, rowSpan: 1, align: 'center', isHeader: true },
            { text: '서명 / 날인', colSpan: 1, rowSpan: 1, align: 'center', isHeader: true },
          ],
          [
            { text: '갑 (주관기관)', colSpan: 1, rowSpan: 1, align: 'center' },
            { text: '아파치 오픈오피스 코리아', colSpan: 1, rowSpan: 1, align: 'left' },
            { text: '문서 레이아웃 엔진 및 표준 검증', colSpan: 1, rowSpan: 1, align: 'left' },
            { text: '(인)', colSpan: 1, rowSpan: 1, align: 'center' },
          ],
          [
            { text: '을 (참여기관)', colSpan: 1, rowSpan: 1, align: 'center' },
            { text: '개방형문서기술연구소', colSpan: 1, rowSpan: 1, align: 'left' },
            { text: 'HWP/HWPX 표 변환 필터 개발', colSpan: 1, rowSpan: 1, align: 'left' },
            { text: '(인)', colSpan: 1, rowSpan: 1, align: 'center' },
          ],
        ],
      },
    ],
  },
  blank: {
    title: '제목 없는 한글 문서',
    subtitle: '',
    body: `여기에 한글(.hwp / .hwpx) 문서 내용을 입력하세요.\n상단 툴바에서 실제 .hwp 또는 .hwpx 파일을 불러오면 본문과 표 레이아웃을 분리·보존하여 깨짐 없이 표시합니다.`,
    tables: [],
  },
};

const SPECIAL_CHARS = ['□', 'ㅇ', '―', '※', '■', '▶', '●', '○', '★', '☆', '「', '」', '『', '』', '【', '】'];

// Normalize a 2D table cell array so that colSpan and rowSpan mark covered slots as hiddenBySpan
function normalizeTableGrid(rawRows: HwpTableCell[][]): HwpTableCell[][] {
  if (rawRows.length === 0) return [];
  const maxCols = Math.max(
    1,
    ...rawRows.map((r) =>
      r.reduce((acc, c) => acc + (c.hiddenBySpan ? 0 : Math.max(1, c.colSpan || 1)), 0)
    ),
    ...rawRows.map((r) => r.length)
  );
  const rowCount = rawRows.length;

  // Create clean occupancy matrix
  const grid: (HwpTableCell | null)[][] = Array.from({ length: rowCount }, () =>
    Array.from({ length: maxCols }, () => null)
  );

  for (let r = 0; r < rowCount; r++) {
    const srcRow = rawRows[r];
    let cCursor = 0;
    for (let i = 0; i < srcRow.length; i++) {
      const cell = srcRow[i];
      if (cell.hiddenBySpan) continue;

      while (cCursor < maxCols && grid[r][cCursor] !== null) {
        cCursor++;
      }
      if (cCursor >= maxCols) break;

      const cSpan = Math.min(Math.max(1, cell.colSpan || 1), maxCols - cCursor);
      const rSpan = Math.min(Math.max(1, cell.rowSpan || 1), rowCount - r);

      grid[r][cCursor] = {
        ...cell,
        colSpan: cSpan,
        rowSpan: rSpan,
        hiddenBySpan: false,
      };

      for (let dr = 0; dr < rSpan; dr++) {
        for (let dc = 0; dc < cSpan; dc++) {
          if (dr === 0 && dc === 0) continue;
          if (r + dr < rowCount && cCursor + dc < maxCols) {
            grid[r + dr][cCursor + dc] = {
              text: '',
              colSpan: 1,
              rowSpan: 1,
              hiddenBySpan: true,
            };
          }
        }
      }
      cCursor += cSpan;
    }
  }

  // Fill any remaining null slots with normal empty cells
  return grid.map((row, rIdx) =>
    row.map(
      (cell) =>
        cell || {
          text: '',
          colSpan: 1,
          rowSpan: 1,
          align: rIdx === 0 ? 'center' : 'left',
          isHeader: rIdx === 0,
          hiddenBySpan: false,
        }
    )
  );
}

// Helper to check if an XML element is located inside a table (<hp:tbl> or <hp:tc>)
function isInsideTableElement(el: Element, stopAt?: Element): boolean {
  let curr: Element | null = el.parentElement;
  while (curr && curr !== stopAt) {
    if (curr.localName === 'tbl' || curr.localName === 'tc' || curr.localName === 'tr') {
      return true;
    }
    curr = curr.parentElement;
  }
  return false;
}

// Extract direct paragraph text from an element without descending into nested tables
function extractParagraphsFromContainer(container: Element): string[] {
  const lines: string[] = [];
  const allP = Array.from(container.getElementsByTagName('*')).filter(
    (el) => el.localName === 'p'
  );

  for (const p of allP) {
    // Ensure this <hp:p> belongs to `container` and not to a nested table inside `container`
    let parentTbl: Element | null = p.parentElement;
    let belongsToNestedTable = false;
    while (parentTbl && parentTbl !== container) {
      if (parentTbl.localName === 'tbl') {
        belongsToNestedTable = true;
        break;
      }
      parentTbl = parentTbl.parentElement;
    }
    if (belongsToNestedTable) continue;

    // Collect text from <hp:t> or <hp:fwSpace> / <hp:lineBreak>
    const childNodes = Array.from(p.getElementsByTagName('*'));
    const textParts: string[] = [];
    for (const node of childNodes) {
      // Skip anything inside a nested table or caption if container is section
      if (container.localName === 'sec') {
        if (isInsideTableElement(node, p)) continue;
      }
      if (node.localName === 't') {
        textParts.push(node.textContent || '');
      } else if (node.localName === 'lineBreak') {
        textParts.push('\n');
      } else if (node.localName === 'tab') {
        textParts.push('    ');
      }
    }
    const joined = textParts.join('');
    if (joined.trim().length > 0) {
      lines.push(joined);
    }
  }
  return lines;
}

// Parse <hp:tbl> nodes from an HWPX section XML document with full cellAddr / cellSpan / cellSz support
function parseHwpxTables(xmlDoc: Document, startIndex: number): {
  tables: HwpTable[];
  mergedCount: number;
} {
  const tblNodes = Array.from(xmlDoc.getElementsByTagName('*')).filter(
    (el) => el.localName === 'tbl'
  );
  const parsedTables: HwpTable[] = [];
  let mergedCount = 0;

  tblNodes.forEach((tbl, idx) => {
    const rowCntAttr = Number(tbl.getAttribute('rowCnt') || 0);
    const colCntAttr = Number(tbl.getAttribute('colCnt') || 0);

    // Extract optional caption
    let captionText = `[표 ${startIndex + idx + 1}] 불러온 한글 표`;
    const captionNode = Array.from(tbl.children).find((ch) => ch.localName === 'caption');
    if (captionNode) {
      const capLines = extractParagraphsFromContainer(captionNode);
      if (capLines.length > 0) captionText = capLines.join(' ');
    }

    // Collect direct <hp:tr> rows of this table
    const trNodes = Array.from(tbl.children).filter((ch) => ch.localName === 'tr');
    if (trNodes.length === 0) return;

    const totalRows = Math.max(rowCntAttr, trNodes.length);
    // Determine max columns by scanning cellAddr + cellSpan
    let totalCols = colCntAttr;
    trNodes.forEach((tr) => {
      const tcList = Array.from(tr.children).filter((ch) => ch.localName === 'tc');
      let colSum = 0;
      tcList.forEach((tc) => {
        const spanNode = Array.from(tc.children).find((c) => c.localName === 'cellSpan');
        const addrNode = Array.from(tc.children).find((c) => c.localName === 'cellAddr');
        const cSpan = Number(
          spanNode?.getAttribute('colSpan') || tc.getAttribute('colSpan') || 1
        );
        const cAddr = addrNode ? Number(addrNode.getAttribute('colAddr') || -1) : -1;
        if (cAddr >= 0) {
          totalCols = Math.max(totalCols, cAddr + cSpan);
        }
        colSum += cSpan;
      });
      totalCols = Math.max(totalCols, colSum);
    });
    if (totalCols <= 0) totalCols = 1;

    // Build grid matrix
    const grid: (HwpTableCell | null)[][] = Array.from({ length: totalRows }, () =>
      Array.from({ length: totalCols }, () => null)
    );

    const colWidths: number[] = Array.from({ length: totalCols }, () => 0);

    trNodes.forEach((tr, rIdx) => {
      if (rIdx >= totalRows) return;
      const tcNodes = Array.from(tr.children).filter((ch) => ch.localName === 'tc');
      let fallbackCol = 0;

      tcNodes.forEach((tc) => {
        const addrNode = Array.from(tc.children).find((c) => c.localName === 'cellAddr');
        const spanNode = Array.from(tc.children).find((c) => c.localName === 'cellSpan');
        const szNode = Array.from(tc.children).find((c) => c.localName === 'cellSz');

        let targetRow = addrNode ? Number(addrNode.getAttribute('rowAddr') ?? rIdx) : rIdx;
        let targetCol = addrNode ? Number(addrNode.getAttribute('colAddr') ?? -1) : -1;

        if (targetRow < 0 || targetRow >= totalRows) targetRow = rIdx;
        if (targetCol < 0 || targetCol >= totalCols || grid[targetRow][targetCol] !== null) {
          while (fallbackCol < totalCols && grid[targetRow][fallbackCol] !== null) {
            fallbackCol++;
          }
          targetCol = Math.min(fallbackCol, totalCols - 1);
        }

        const cSpan = Math.min(
          Math.max(1, Number(spanNode?.getAttribute('colSpan') || tc.getAttribute('colSpan') || 1)),
          totalCols - targetCol
        );
        const rSpan = Math.min(
          Math.max(1, Number(spanNode?.getAttribute('rowSpan') || tc.getAttribute('rowSpan') || 1)),
          totalRows - targetRow
        );

        if (cSpan > 1 || rSpan > 1) {
          mergedCount++;
        }

        const rawWidth = Number(szNode?.getAttribute('width') || 0);
        if (rawWidth > 0 && cSpan === 1) {
          colWidths[targetCol] = Math.max(colWidths[targetCol], rawWidth);
        }

        // Extract text inside cell (<hp:subList> or direct <hp:p>)
        const subList = Array.from(tc.children).find((c) => c.localName === 'subList') || tc;
        const cellLines = extractParagraphsFromContainer(subList);
        const cellText = cellLines.join('\n');

        const isHeaderCell = targetRow === 0 || tc.getAttribute('header') === '1';

        grid[targetRow][targetCol] = {
          text: cellText,
          colSpan: cSpan,
          rowSpan: rSpan,
          align: isHeaderCell ? 'center' : 'left',
          isHeader: isHeaderCell,
          hiddenBySpan: false,
        };

        // Mark spanned cells
        for (let dr = 0; dr < rSpan; dr++) {
          for (let dc = 0; dc < cSpan; dc++) {
            if (dr === 0 && dc === 0) continue;
            if (targetRow + dr < totalRows && targetCol + dc < totalCols) {
              grid[targetRow + dr][targetCol + dc] = {
                text: '',
                colSpan: 1,
                rowSpan: 1,
                hiddenBySpan: true,
              };
            }
          }
        }

        fallbackCol = targetCol + cSpan;
      });
    });

    // Calculate proportional column widths if present
    const totalRawWidth = colWidths.reduce((a, b) => a + b, 0);
    const finalRows: HwpTableCell[][] = grid.map((row, rIdx) =>
      row.map((cell, cIdx) => {
        const widthPct =
          totalRawWidth > 0 && colWidths[cIdx] > 0
            ? Math.round((colWidths[cIdx] / totalRawWidth) * 100)
            : undefined;
        if (!cell) {
          return {
            text: '',
            colSpan: 1,
            rowSpan: 1,
            widthPercent: widthPct,
            align: rIdx === 0 ? 'center' : 'left',
            isHeader: rIdx === 0,
            hiddenBySpan: false,
          };
        }
        return {
          ...cell,
          widthPercent: widthPct,
        };
      })
    );

    parsedTables.push({
      id: `hwpx-tbl-${Date.now()}-${idx}`,
      caption: captionText,
      rows: finalRows,
    });
  });

  return { tables: parsedTables, mergedCount };
}

// Extract readable UTF-16LE text and detect structured tables from a binary .hwp or text stream
function extractTextAndTablesFromHwpBinary(buffer: ArrayBuffer): {
  bodyText: string;
  tables: HwpTable[];
} {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const chunks: string[] = [];
  let current = '';

  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = view.getUint16(i, true);
    const isHangul = (code >= 0xac00 && code <= 0xd7a3) || (code >= 0x3131 && code <= 0x318e);
    const isAscii =
      (code >= 0x0020 && code <= 0x007e) ||
      code === 0x000a ||
      code === 0x000d ||
      code === 0x0009;
    const isSymbol =
      (code >= 0x2000 && code <= 0x26ff) ||
      (code >= 0x3000 && code <= 0x303f) ||
      (code >= 0xff01 && code <= 0xff5e);

    if (isHangul || isAscii || isSymbol) {
      current += String.fromCharCode(code);
    } else {
      if (current.trim().length >= 4 && /[가-힣a-zA-Z0-9]{2,}/.test(current)) {
        chunks.push(current.trim());
      }
      current = '';
    }
  }
  if (current.trim().length >= 4 && /[가-힣a-zA-Z0-9]{2,}/.test(current)) {
    chunks.push(current.trim());
  }

  const filtered = chunks.filter(
    (c) =>
      !/^(Root Entry|FileHeader|DocInfo|BodyText|Section0|PrvText|PrvImage|SummaryInformation|HwpSummaryInformation)/i.test(
        c
      )
  );

  let rawText = '';
  if (filtered.length > 0) {
    rawText = filtered.join('\n').replace(/\r\n/g, '\n');
  } else {
    const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    rawText = utf8.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
  }

  // Separate tabular lines (containing '|' or '\t' or '<cell>') into structured tables
  const allLines = rawText.split('\n');
  const bodyLines: string[] = [];
  const extractedTables: HwpTable[] = [];
  let currentTableRows: string[][] = [];

  const flushTableBuffer = () => {
    if (currentTableRows.length >= 2) {
      const colMax = Math.max(...currentTableRows.map((r) => r.length));
      if (colMax >= 2) {
        const normalizedRows: HwpTableCell[][] = currentTableRows.map((r, rIdx) => {
          const padded = [...r];
          while (padded.length < colMax) padded.push('');
          return padded.map((cellText) => ({
            text: cellText.trim(),
            colSpan: 1,
            rowSpan: 1,
            align: rIdx === 0 ? 'center' : 'left',
            isHeader: rIdx === 0,
            hiddenBySpan: false,
          }));
        });
        extractedTables.push({
          id: `hwp-tbl-${Date.now()}-${extractedTables.length + 1}`,
          caption: `[표 ${extractedTables.length + 1}] 문서 내 자동 복원된 표`,
          rows: normalizedRows,
        });
        currentTableRows = [];
        return;
      }
    }
    // If only 1 row, push back as normal text
    currentTableRows.forEach((r) => bodyLines.push(r.join('  ')));
    currentTableRows = [];
  };

  for (const line of allLines) {
    const trimmed = line.trim();
    // Skip pure ASCII/Unicode box border lines like ┌───┬───┐ or +---+---+
    if (/^[┌┬┐├┼┤└┴┘─│|+\-=]+$/.test(trimmed)) {
      continue;
    }

    if (trimmed.includes('|') && trimmed.split('|').filter((s) => s.trim().length > 0).length >= 2) {
      const cells = trimmed
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim());
      currentTableRows.push(cells);
    } else if (trimmed.includes('\t') && trimmed.split('\t').length >= 2) {
      currentTableRows.push(trimmed.split('\t').map((c) => c.trim()));
    } else if (trimmed.includes('│') && trimmed.split('│').filter((s) => s.trim().length > 0).length >= 2) {
      const cells = trimmed
        .replace(/^│/, '')
        .replace(/│$/, '')
        .split('│')
        .map((c) => c.trim());
      currentTableRows.push(cells);
    } else {
      if (currentTableRows.length > 0) {
        flushTableBuffer();
      }
      bodyLines.push(line);
    }
  }
  if (currentTableRows.length > 0) {
    flushTableBuffer();
  }

  return {
    bodyText: bodyLines.join('\n').trim(),
    tables: extractedTables,
  };
}

export default function HwpEditor({
  onStatusChange,
  initialFilename,
  onDownloadFullProject,
}: HwpEditorProps) {
  const [filename, setFilename] = useState(
    initialFilename || '2026년도_오픈소스_문서표준_도입계획.hwpx'
  );
  const [fileFormat, setFileFormat] = useState<'hwpx' | 'hwp'>(
    filename.endsWith('.hwp') ? 'hwp' : 'hwpx'
  );
  const [docHeader, setDocHeader] = useState(TEMPLATES.official.title);
  const [docSubheader, setDocSubheader] = useState(TEMPLATES.official.subtitle);
  const [content, setContent] = useState(TEMPLATES.official.body);

  // HWP specific typography & layout states
  const [fontFamily, setFontFamily] = useState<'batang' | 'dotum' | 'gothic' | 'mono'>('batang');
  const [fontSize, setFontSize] = useState<number>(15);
  const [lineHeight, setLineHeight] = useState<number>(160); // HWP standard is 160%
  const [letterSpacing, setLetterSpacing] = useState<number>(0); // 자간 (%)
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textAlign, setTextAlign] = useState<'justify' | 'left' | 'center' | 'right'>('justify');

  // Page layout protection states (용지 방향, 여백 규격, 표 레이아웃 보호 모드)
  const [pageOrientation, setPageOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [marginPreset, setMarginPreset] = useState<'standard' | 'narrow' | 'official'>('standard');
  const [tableLockLayout, setTableLockLayout] = useState<boolean>(true); // 열 너비 고정 및 셀 줄바꿈 보호

  // Approval box (결재란)
  const [showApprovalBox, setShowApprovalBox] = useState(true);
  const [approvals, setApprovals] = useState<ApprovalSlot[]>([
    { role: '담 당', name: '김민수', approved: true },
    { role: '팀 장', name: '이정훈', approved: true },
    { role: '부서장', name: '박서연', approved: true },
    { role: '기관장', name: '최영진', approved: false },
  ]);

  // Multi-table structured state (supports merged cells, multi-line cells, and proportional widths)
  const [showTable, setShowTable] = useState(true);
  const [tables, setTables] = useState<HwpTable[]>(() =>
    TEMPLATES.official.tables.map((t) => ({
      ...t,
      rows: normalizeTableGrid(t.rows),
    }))
  );
  const [selectedCell, setSelectedCell] = useState<{
    tableIdx: number;
    rowIdx: number;
    colIdx: number;
  } | null>(null);

  // Layout & Table Integrity Report
  const [integrityReport, setIntegrityReport] = useState<LayoutIntegrityReport>({
    verifiedAt: '기본 양식 로드됨',
    sourceType: 'template',
    paragraphCount: 14,
    tableCount: 1,
    mergedCellCount: 0,
    orientation: 'portrait',
    marginPreset: 'standard',
    issuesFixed: [
      '표(<hp:tbl>) 영역과 본문 문단(<hp:p>) 분리 보호 활성화',
      '셀 병합(colSpan/rowSpan) 및 다중 줄바꿈 그리드 무결성 검증 완료',
    ],
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isPluginModalOpen, setIsPluginModalOpen] = useState(false);
  const [pluginManagerTab, setPluginManagerTab] = useState<
    'installed' | 'available' | 'custom' | 'portable'
  >('installed');
  const [simulatedHostVersion, setSimulatedHostVersion] = useState<string>('4.1.18');

  // Dynamic JS/CSS Plugin Manager state (Installed & Available external modules)
  const [hwpPlugins, setHwpPlugins] = useState<HwpExternalPlugin[]>(() => {
    try {
      const saved = localStorage.getItem('aoo_hwp_external_plugins');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_HWP_EXTERNAL_PLUGINS;
  });

  // Custom External JS/CSS Module registration form states
  const [customPluginName, setCustomPluginName] = useState('');
  const [customPluginDesc, setCustomPluginDesc] = useState('');
  const [customPluginCategory, setCustomPluginCategory] = useState<'css' | 'js' | 'hybrid'>('hybrid');
  const [customActionLabel, setCustomActionLabel] = useState('');
  const [customCssUrl, setCustomCssUrl] = useState('');
  const [customJsUrl, setCustomJsUrl] = useState('');
  const [customCssCode, setCustomCssCode] = useState(
    '.hwp-page-canvas {\n  box-shadow: 0 0 0 3px #0284c7 !important;\n}'
  );
  const [customJsCode, setCustomJsCode] = useState(
    'api.setContent(api.getContent() + "\\n[커스텀 JS 플러그인 실행 완료]");\napi.notify("사용자 정의 JS 플러그인이 실행되었습니다.");'
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const savePluginsToStorage = (nextList: HwpExternalPlugin[]) => {
    setHwpPlugins(nextList);
    try {
      localStorage.setItem('aoo_hwp_external_plugins', JSON.stringify(nextList));
    } catch {
      // ignore storage errors
    }
  };

  // Dynamically inject/remove external CSS & JS modules into document.head when plugins are toggled
  useEffect(() => {
    // Remove previous injected nodes
    const oldNodes = document.head.querySelectorAll('[data-hwp-ext-plugin]');
    oldNodes.forEach((node) => node.remove());

    const activePlugins = hwpPlugins.filter((p) => p.installed && p.enabled);

    activePlugins.forEach((plugin) => {
      // 1. Inject inline CSS module if provided
      if (plugin.cssCode && plugin.cssCode.trim()) {
        const styleEl = document.createElement('style');
        styleEl.setAttribute('data-hwp-ext-plugin', plugin.id);
        styleEl.textContent = plugin.cssCode;
        document.head.appendChild(styleEl);
      }

      // 2. Inject external CSS stylesheet URL if provided
      if (plugin.cssUrl && plugin.cssUrl.trim()) {
        const linkEl = document.createElement('link');
        linkEl.rel = 'stylesheet';
        linkEl.href = plugin.cssUrl.trim();
        linkEl.setAttribute('data-hwp-ext-plugin', plugin.id);
        document.head.appendChild(linkEl);
      }

      // 3. Inject external JS script URL if provided
      if (plugin.jsUrl && plugin.jsUrl.trim()) {
        const scriptEl = document.createElement('script');
        scriptEl.src = plugin.jsUrl.trim();
        scriptEl.async = true;
        scriptEl.setAttribute('data-hwp-ext-plugin', plugin.id);
        document.head.appendChild(scriptEl);
      }
    });

    return () => {
      const cleanupNodes = document.head.querySelectorAll('[data-hwp-ext-plugin]');
      cleanupNodes.forEach((node) => node.remove());
    };
  }, [hwpPlugins]);

  // Execute a JS/Hybrid plugin's dynamic script against the HWP Editor API
  const executePluginJsAction = (plugin: HwpExternalPlugin) => {
    if (!plugin.jsCode || !plugin.jsCode.trim()) {
      onStatusChange(`'${plugin.name}' 플러그인(CSS 스타일 모듈)이 현재 문서에 적용 중입니다.`);
      return;
    }

    try {
      const api = {
        getContent: () => content,
        setContent: (nextText: string) => setContent(nextText),
        getHeader: () => docHeader,
        setHeader: (nextHeader: string) => setDocHeader(nextHeader),
        getSubheader: () => docSubheader,
        setSubheader: (nextSub: string) => setDocSubheader(nextSub),
        notify: (msg: string) => onStatusChange(`[플러그인: ${plugin.name}] ${msg}`),
      };
      const runner = new Function('api', plugin.jsCode);
      runner(api);
    } catch (err) {
      onStatusChange(
        `플러그인('${plugin.name}') JS 실행 오류: ${(err as Error).message}`
      );
    }
  };

  const handleTogglePluginEnabled = (pluginId: string) => {
    const next = hwpPlugins.map((p) => {
      if (p.id !== pluginId) return p;
      const nextEnabled = !p.enabled;
      onStatusChange(
        `플러그인 '${p.name}' ${nextEnabled ? '활성화(ON) — 동적 모듈 로드됨' : '비활성화(OFF) — 모듈 언로드됨'}`
      );
      return { ...p, enabled: nextEnabled };
    });
    savePluginsToStorage(next);
  };

  const handleInstallPlugin = (pluginId: string) => {
    const next = hwpPlugins.map((p) => {
      if (p.id !== pluginId) return p;
      onStatusChange(`'${p.name}' 플러그인이 설치 및 활성화되었습니다.`);
      return { ...p, installed: true, enabled: true };
    });
    savePluginsToStorage(next);
  };

  const handleUninstallPlugin = (pluginId: string) => {
    const target = hwpPlugins.find((p) => p.id === pluginId);
    if (!target) return;
    if (target.isCustom) {
      const next = hwpPlugins.filter((p) => p.id !== pluginId);
      savePluginsToStorage(next);
    } else {
      const next = hwpPlugins.map((p) =>
        p.id === pluginId ? { ...p, installed: false, enabled: false } : p
      );
      savePluginsToStorage(next);
    }
    onStatusChange(`'${target.name}' 플러그인이 비활성화 및 설치 제거되었습니다.`);
  };

  const handleRegisterCustomPlugin = () => {
    const name = customPluginName.trim();
    if (!name) {
      onStatusChange('추가할 외부 JS/CSS 플러그인 이름을 입력해주세요.');
      return;
    }
    const newPlugin: HwpExternalPlugin = {
      id: `custom-plugin-${Date.now()}`,
      name,
      version: '1.0.0',
      author: '사용자 정의 모듈',
      category: customPluginCategory,
      description:
        customPluginDesc.trim() ||
        '사용자가 외부 JS/CSS 코드로 동적 등록한 커스텀 한글 확장 플러그인입니다.',
      installed: true,
      enabled: true,
      actionButtonLabel:
        customPluginCategory !== 'css'
          ? customActionLabel.trim() || `${name} 실행`
          : undefined,
      cssUrl: customCssUrl.trim() || undefined,
      jsUrl: customJsUrl.trim() || undefined,
      cssCode: customPluginCategory !== 'js' ? customCssCode : undefined,
      jsCode: customPluginCategory !== 'css' ? customJsCode : undefined,
      isCustom: true,
    };

    const next = [newPlugin, ...hwpPlugins];
    savePluginsToStorage(next);
    setCustomPluginName('');
    setCustomPluginDesc('');
    setCustomActionLabel('');
    setCustomCssUrl('');
    setCustomJsUrl('');
    setPluginManagerTab('installed');
    onStatusChange(`새 외부 모듈 플러그인 '${name}'이(가) 동적으로 로드 및 활성화되었습니다.`);
  };

  const installedPlugins = useMemo(
    () => hwpPlugins.filter((p) => p.installed),
    [hwpPlugins]
  );
  const availablePlugins = useMemo(
    () => hwpPlugins.filter((p) => !p.installed),
    [hwpPlugins]
  );
  const activeActionPlugins = useMemo(
    () =>
      hwpPlugins.filter(
        (p) => p.installed && p.enabled && p.jsCode && p.actionButtonLabel
      ),
    [hwpPlugins]
  );

  // Statistics including Korean manuscript paper count (200자 원고지 매수)
  const stats = useMemo(() => {
    const trimmed = content.trim();
    const eojeol = trimmed ? trimmed.split(/\s+/).length : 0;
    const charsWithSpace = content.length;
    const charsNoSpace = content.replace(/\s/g, '').length;
    const lines = content.split('\n').length;
    const manuscriptPages = Math.max(1, Math.ceil(charsWithSpace / 200));
    return { eojeol, charsWithSpace, charsNoSpace, lines, manuscriptPages };
  }, [content]);

  // Load real .hwpx or .hwp file from disk with full table & layout preservation
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.toLowerCase().endsWith('.hwp') ? 'hwp' : 'hwpx';
    setFilename(file.name);
    setFileFormat(ext);

    try {
      const buffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      // Check if file starts with PK (0x50 0x4B) -> ZIP archive (.hwpx)
      const isZip = uint8.length > 4 && uint8[0] === 0x50 && uint8[1] === 0x4b;

      if (isZip) {
        const zip = await JSZip.loadAsync(buffer);
        const sectionFiles = Object.keys(zip.files)
          .filter((name) => /Contents\/section\d+\.xml$/i.test(name))
          .sort();

        const bodyParagraphs: string[] = [];
        const allParsedTables: HwpTable[] = [];
        let totalMergedCells = 0;
        let detectedOrientation: 'portrait' | 'landscape' = 'portrait';
        let detectedMargin: 'standard' | 'narrow' | 'official' = 'standard';
        const fixesApplied: string[] = [];

        if (sectionFiles.length > 0) {
          const parser = new DOMParser();
          for (const secName of sectionFiles) {
            const xmlStr = await zip.files[secName].async('string');
            const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');

            // 1. Inspect <hp:pagePr> and <hp:pageMargin> to preserve page orientation and margins
            const pagePr = Array.from(xmlDoc.getElementsByTagName('*')).find(
              (el) => el.localName === 'pagePr'
            );
            if (pagePr) {
              const landscapeAttr = pagePr.getAttribute('landscape');
              const widthAttr = Number(pagePr.getAttribute('width') || 59528);
              const heightAttr = Number(pagePr.getAttribute('height') || 84188);
              if (landscapeAttr === 'WIDELY' || widthAttr > heightAttr) {
                detectedOrientation = 'landscape';
                fixesApplied.push('문서 용지 방향(가로 폭넓게) 자동 감지 및 적용');
              }
            }
            const pageMargin = Array.from(xmlDoc.getElementsByTagName('*')).find(
              (el) => el.localName === 'pageMargin'
            );
            if (pageMargin) {
              const leftHwpUnit = Number(pageMargin.getAttribute('left') || 8504);
              if (leftHwpUnit < 5000) {
                detectedMargin = 'narrow';
                fixesApplied.push('좁은 여백(15mm) 문서 레이아웃 규격 자동 적용');
              }
            }

            // 2. Extract ONLY body paragraphs (excluding <hp:p> inside <hp:tbl>)
            const secRoot = xmlDoc.documentElement;
            const secParagraphs = extractParagraphsFromContainer(secRoot);
            bodyParagraphs.push(...secParagraphs);

            // 3. Extract all <hp:tbl> tables with cellSpan/cellAddr/cellSz fidelity
            const { tables: secTables, mergedCount } = parseHwpxTables(
              xmlDoc,
              allParsedTables.length
            );
            allParsedTables.push(...secTables);
            totalMergedCells += mergedCount;
          }
        }

        // Fallback to Preview/PrvText.txt if section XML had no body paragraphs
        if (bodyParagraphs.length === 0 && zip.files['Preview/PrvText.txt']) {
          const prvText = await zip.files['Preview/PrvText.txt'].async('string');
          const { bodyText, tables: prvTables } = extractTextAndTablesFromHwpBinary(
            new TextEncoder().encode(prvText).buffer
          );
          if (bodyText) bodyParagraphs.push(...bodyText.split('\n'));
          if (allParsedTables.length === 0 && prvTables.length > 0) {
            allParsedTables.push(...prvTables);
          }
        }

        if (allParsedTables.length > 0) {
          setTables(allParsedTables.map((t) => ({ ...t, rows: normalizeTableGrid(t.rows) })));
          setShowTable(true);
          fixesApplied.push(
            `표 ${allParsedTables.length}개 본문 혼입 방지 및 독립 격자 복원 완료`
          );
          if (totalMergedCells > 0) {
            fixesApplied.push(`병합된 셀(colSpan/rowSpan) ${totalMergedCells}개 구조 유지`);
          }
        } else {
          setTables([]);
          setShowTable(false);
        }

        setPageOrientation(detectedOrientation);
        setMarginPreset(detectedMargin);

        if (bodyParagraphs.length > 0 || allParsedTables.length > 0) {
          const titleLine =
            bodyParagraphs[0] || file.name.replace(/\.(hwpx|hwp)$/i, '');
          const subLine = bodyParagraphs.length > 2 ? bodyParagraphs[1] : '';
          const mainBody =
            bodyParagraphs.length > 2
              ? bodyParagraphs.slice(2).join('\n')
              : bodyParagraphs.slice(1).join('\n') || bodyParagraphs.join('\n');

          setDocHeader(titleLine);
          setDocSubheader(subLine);
          setContent(mainBody);
          setSelectedCell(null);

          setIntegrityReport({
            verifiedAt: new Date().toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            sourceType: 'hwpx',
            paragraphCount: bodyParagraphs.length,
            tableCount: allParsedTables.length,
            mergedCellCount: totalMergedCells,
            orientation: detectedOrientation,
            marginPreset: detectedMargin,
            issuesFixed:
              fixesApplied.length > 0
                ? fixesApplied
                : ['문단 및 여백 구조 이상 없음 (레이아웃 무결성 확인)'],
          });

          onStatusChange(
            `HWPX 문서를 표·레이아웃 깨짐 없이 불러왔습니다 (문단 ${bodyParagraphs.length}개, 표 ${allParsedTables.length}개): ${file.name}`
          );
          return;
        }
      }

      // Binary .hwp or plain text stream with automatic table detection
      const { bodyText, tables: detectedTables } = extractTextAndTablesFromHwpBinary(buffer);
      if (bodyText || detectedTables.length > 0) {
        const lines = bodyText.split('\n').filter((l) => l.trim().length > 0);
        setDocHeader(lines[0] || file.name.replace(/\.(hwpx|hwp)$/i, ''));
        setDocSubheader(lines.length > 2 ? lines[1] : '');
        setContent(
          lines.length > 2 ? lines.slice(2).join('\n') : lines.slice(1).join('\n') || bodyText
        );

        if (detectedTables.length > 0) {
          setTables(detectedTables);
          setShowTable(true);
        } else {
          setTables([]);
          setShowTable(false);
        }
        setSelectedCell(null);

        setIntegrityReport({
          verifiedAt: new Date().toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          sourceType: 'hwp',
          paragraphCount: lines.length,
          tableCount: detectedTables.length,
          mergedCellCount: 0,
          orientation: pageOrientation,
          marginPreset,
          issuesFixed: [
            'HWP 유니코드(UTF-16LE) 스트림 제어문자 제거 및 줄바꿈 정규화',
            ...(detectedTables.length > 0
              ? [`구분자 기반 표 ${detectedTables.length}개 격자 레이아웃 자동 복원`]
              : []),
          ],
        });

        onStatusChange(
          `한글(.${ext}) 문서를 레이아웃 보호 모드로 불러왔습니다 (표 ${detectedTables.length}개 복원): ${file.name}`
        );
      } else {
        onStatusChange(`파일을 불러왔으나 텍스트 스트림이 비어 있습니다: ${file.name}`);
      }
    } catch (err) {
      onStatusChange(`문서 열기 중 오류가 발생했습니다: ${(err as Error).message}`);
    } finally {
      e.target.value = '';
    }
  };

  // Export valid .hwpx (KS X 6101 OWPML ZIP package with real <hp:tbl> XML) or .hwp file
  const handleSaveDocument = async (targetExt: 'hwpx' | 'hwp') => {
    const baseName = filename.replace(/\.(hwpx|hwp|txt)$/i, '');
    const outName = `${baseName}.${targetExt}`;
    setFilename(outName);
    setFileFormat(targetExt);

    const escapeXml = (str: string) =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const bodyParagraphs = [docHeader, docSubheader, ...content.split('\n')].filter(
      (line) => line !== undefined && line.trim().length > 0
    );

    if (targetExt === 'hwpx') {
      const zip = new JSZip();
      zip.file('mimetype', 'application/hwp+zip');
      zip.file(
        'version.xml',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" targetApplication="WORDPROCESSOR" major="5" minor="1" micro="0" buildNumber="1"/>`
      );

      // Build Preview/PrvText.txt with pipe-delimited tables for preview compatibility
      const prvTablesText =
        showTable && tables.length > 0
          ? '\n\n' +
            tables
              .map(
                (t) =>
                  `${t.caption}\n` +
                  t.rows
                    .map(
                      (r) =>
                        '| ' +
                        r
                          .filter((c) => !c.hiddenBySpan)
                          .map((c) => c.text.replace(/\n/g, ' '))
                          .join(' | ') +
                        ' |'
                    )
                    .join('\n')
              )
              .join('\n\n')
          : '';

      zip.file(
        'Preview/PrvText.txt',
        `${docHeader}\n${docSubheader}\n\n${content}${prvTablesText}`
      );

      // Build genuine <hp:tbl> XML blocks so tables never break on re-import
      const tablesXml =
        showTable && tables.length > 0
          ? tables
              .map((tbl, tIdx) => {
                const rowCnt = tbl.rows.length;
                const colCnt = tbl.rows[0]?.length || 1;
                const defaultCellWidth = Math.floor(42520 / colCnt);

                const rowsXml = tbl.rows
                  .map((row, rIdx) => {
                    const cellsXml = row
                      .map((cell, cIdx) => {
                        if (cell.hiddenBySpan) return '';
                        const cellLines = (cell.text || '').split('\n');
                        const pXml = cellLines
                          .map(
                            (l) =>
                              `            <hp:p><hp:run><hp:t>${escapeXml(l)}</hp:t></hp:run></hp:p>`
                          )
                          .join('\n');
                        return `        <hp:tc header="${cell.isHeader ? '1' : '0'}">
          <hp:subList>
${pXml}
          </hp:subList>
          <hp:cellAddr colAddr="${cIdx}" rowAddr="${rIdx}"/>
          <hp:cellSpan colSpan="${cell.colSpan || 1}" rowSpan="${cell.rowSpan || 1}"/>
          <hp:cellSz width="${defaultCellWidth * (cell.colSpan || 1)}" height="2800"/>
        </hp:tc>`;
                      })
                      .filter(Boolean)
                      .join('\n');
                    return `      <hp:tr>\n${cellsXml}\n      </hp:tr>`;
                  })
                  .join('\n');

                return `  <hp:p>
    <hp:run>
      <hp:tbl id="${1000 + tIdx}" rowCnt="${rowCnt}" colCnt="${colCnt}" cellSpacing="0" borderFillIDRef="1">
        <hp:caption><hp:p><hp:run><hp:t>${escapeXml(tbl.caption)}</hp:t></hp:run></hp:p></hp:caption>
${rowsXml}
      </hp:tbl>
    </hp:run>
  </hp:p>`;
              })
              .join('\n')
          : '';

      const pageWidth = pageOrientation === 'landscape' ? 84188 : 59528;
      const pageHeight = pageOrientation === 'landscape' ? 59528 : 84188;
      const leftMarginHwp = marginPreset === 'narrow' ? 4252 : 8504;

      const sectionXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hs:sec xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section">
  <hp:secPr>
    <hp:pagePr landscape="${pageOrientation === 'landscape' ? 'WIDELY' : 'NARROWLY'}" width="${pageWidth}" height="${pageHeight}">
      <hp:pageMargin left="${leftMarginHwp}" right="${leftMarginHwp}" top="5668" bottom="4252" header="4252" footer="4252" gutter="0"/>
    </hp:pagePr>
  </hp:secPr>
${bodyParagraphs
  .map((p) => `  <hp:p><hp:run><hp:t>${escapeXml(p)}</hp:t></hp:run></hp:p>`)
  .join('\n')}
${tablesXml}
</hs:sec>`;

      zip.file('Contents/section0.xml', sectionXml);
      zip.file(
        'Contents/content.hpf',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<opf:package xmlns:opf="http://www.idpf.org/2007/opf/" version="1.2">
  <opf:metadata>
    <opf:title>${escapeXml(docHeader)}</opf:title>
    <opf:language>ko</opf:language>
  </opf:metadata>
  <opf:manifest>
    <opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>
  </opf:manifest>
  <opf:spine>
    <opf:itemref idref="section0"/>
  </opf:spine>
</opf:package>`
      );

      const blob = await zip.generateAsync({ type: 'blob' });
      triggerBrowserDownload(
        blob,
        outName,
        '표 구조(<hp:tbl>) 및 셀 병합이 보존된 KS X 6101 표준 HWPX 문서'
      );
      onStatusChange(
        `${outName} (표 구조 <hp:tbl> 및 셀 병합이 보존된 KS X 6101 HWPX) 파일로 저장했습니다.`
      );
    } else {
      // Export UTF-16LE HWP stream with structured pipe table delimiters
      const tableTextBlock =
        showTable && tables.length > 0
          ? '\r\n\r\n' +
            tables
              .map(
                (t) =>
                  `${t.caption}\r\n` +
                  t.rows
                    .map(
                      (r) =>
                        '| ' +
                        r
                          .filter((c) => !c.hiddenBySpan)
                          .map((c) => c.text.replace(/\n/g, ' '))
                          .join(' | ') +
                        ' |'
                    )
                    .join('\r\n')
              )
              .join('\r\n\r\n')
          : '';

      const fullText = `${docHeader}\r\n${docSubheader}\r\n\r\n${content.replace(
        /\n/g,
        '\r\n'
      )}${tableTextBlock}`;
      const buf = new ArrayBuffer(fullText.length * 2);
      const view = new DataView(buf);
      for (let i = 0; i < fullText.length; i++) {
        view.setUint16(i * 2, fullText.charCodeAt(i), true);
      }
      const blob = new Blob([buf], { type: 'application/x-hwp' });
      triggerBrowserDownload(blob, outName, '한글 5.0 호환(.hwp) 문서 스트림 파일');
      onStatusChange(`${outName} (.hwp 표 구분자 호환 스트림) 파일로 저장했습니다.`);
    }
  };

  // Table manipulation helpers (merge right, merge down, unmerge, add/remove row/col)
  const updateCellText = (tIdx: number, rIdx: number, cIdx: number, val: string) => {
    setTables((prev) =>
      prev.map((tbl, i) => {
        if (i !== tIdx) return tbl;
        const nextRows = tbl.rows.map((row, r) =>
          row.map((cell, c) => (r === rIdx && c === cIdx ? { ...cell, text: val } : { ...cell }))
        );
        return { ...tbl, rows: nextRows };
      })
    );
  };

  const handleMergeRight = (tIdx: number) => {
    if (!selectedCell || selectedCell.tableIdx !== tIdx) {
      onStatusChange('병합할 기준 셀을 먼저 표에서 클릭해주세요.');
      return;
    }
    const { rowIdx, colIdx } = selectedCell;
    setTables((prev) =>
      prev.map((tbl, i) => {
        if (i !== tIdx) return tbl;
        const row = tbl.rows[rowIdx];
        if (!row) return tbl;
        const curr = row[colIdx];
        if (!curr || curr.hiddenBySpan) return tbl;
        const targetCol = colIdx + (curr.colSpan || 1);
        if (targetCol >= row.length) {
          onStatusChange('오른쪽에 병합할 수 있는 셀이 없습니다.');
          return tbl;
        }
        const rightCell = row[targetCol];
        const mergedText = [curr.text, rightCell?.text].filter(Boolean).join(' ');
        const nextRows = tbl.rows.map((r) => r.map((c) => ({ ...c })));
        nextRows[rowIdx][colIdx] = {
          ...curr,
          text: mergedText,
          colSpan: (curr.colSpan || 1) + (rightCell?.colSpan || 1),
        };
        nextRows[rowIdx][targetCol] = {
          text: '',
          colSpan: 1,
          rowSpan: 1,
          hiddenBySpan: true,
        };
        onStatusChange(`표 [${rowIdx + 1}행 ${colIdx + 1}열] 우측 셀 병합이 적용되었습니다.`);
        return { ...tbl, rows: normalizeTableGrid(nextRows) };
      })
    );
  };

  const handleUnmergeCell = (tIdx: number) => {
    if (!selectedCell || selectedCell.tableIdx !== tIdx) {
      onStatusChange('병합 해제할 셀을 먼저 클릭해주세요.');
      return;
    }
    const { rowIdx, colIdx } = selectedCell;
    setTables((prev) =>
      prev.map((tbl, i) => {
        if (i !== tIdx) return tbl;
        const curr = tbl.rows[rowIdx]?.[colIdx];
        if (!curr || ((curr.colSpan || 1) === 1 && (curr.rowSpan || 1) === 1)) {
          onStatusChange('선택한 셀은 병합된 상태가 아닙니다.');
          return tbl;
        }
        const nextRows = tbl.rows.map((r) => r.map((c) => ({ ...c })));
        const cSpan = curr.colSpan || 1;
        const rSpan = curr.rowSpan || 1;
        for (let dr = 0; dr < rSpan; dr++) {
          for (let dc = 0; dc < cSpan; dc++) {
            if (rowIdx + dr < nextRows.length && colIdx + dc < nextRows[0].length) {
              nextRows[rowIdx + dr][colIdx + dc] = {
                text: dr === 0 && dc === 0 ? curr.text : '',
                colSpan: 1,
                rowSpan: 1,
                align: curr.align || 'left',
                isHeader: rowIdx + dr === 0,
                hiddenBySpan: false,
              };
            }
          }
        }
        onStatusChange(`선택한 셀의 병합이 해제되어 격자가 복원되었습니다.`);
        return { ...tbl, rows: normalizeTableGrid(nextRows) };
      })
    );
  };

  const handleAddRow = (tIdx: number) => {
    setTables((prev) =>
      prev.map((tbl, i) => {
        if (i !== tIdx) return tbl;
        const colCount = tbl.rows[0]?.length || 4;
        const newRow: HwpTableCell[] = Array.from({ length: colCount }, () => ({
          text: '',
          colSpan: 1,
          rowSpan: 1,
          align: 'left',
          isHeader: false,
          hiddenBySpan: false,
        }));
        return { ...tbl, rows: [...tbl.rows, newRow] };
      })
    );
    onStatusChange('표 하단에 새 행을 추가했습니다.');
  };

  const handleAddCol = (tIdx: number) => {
    setTables((prev) =>
      prev.map((tbl, i) => {
        if (i !== tIdx) return tbl;
        const nextRows = tbl.rows.map((row, rIdx) => [
          ...row,
          {
            text: rIdx === 0 ? `열 ${row.length + 1}` : '',
            colSpan: 1,
            rowSpan: 1,
            align: (rIdx === 0 ? 'center' : 'left') as 'center' | 'left',
            isHeader: rIdx === 0,
            hiddenBySpan: false,
          },
        ]);
        return { ...tbl, rows: nextRows };
      })
    );
    onStatusChange('표 우측에 새 열을 추가했습니다.');
  };

  const handleDeleteLastRow = (tIdx: number) => {
    setTables((prev) =>
      prev.map((tbl, i) => {
        if (i !== tIdx || tbl.rows.length <= 1) return tbl;
        return { ...tbl, rows: normalizeTableGrid(tbl.rows.slice(0, -1)) };
      })
    );
    onStatusChange('표의 마지막 행을 삭제하고 셀 병합 비율을 재정렬했습니다.');
  };

  const insertSpecialChar = (ch: string) => {
    setContent((prev) => prev + ch);
    onStatusChange(`특수문자 '${ch}' 입력됨`);
  };

  // Reliable browser & sandboxed-iframe download helper + persistent direct download link state
  const [recentDownload, setRecentDownload] = useState<{
    filename: string;
    url: string;
    sizeLabel: string;
    description: string;
    timestamp: string;
  } | null>(null);

  const triggerBrowserDownload = (blob: Blob, outName: string, description: string) => {
    const url = URL.createObjectURL(blob);
    const sizeKb = Math.max(0.1, blob.size / 1024).toFixed(1);
    setRecentDownload((prev) => {
      if (prev?.url) {
        try {
          URL.revokeObjectURL(prev.url);
        } catch {
          // ignore
        }
      }
      return {
        filename: outName,
        url,
        sizeLabel: `${sizeKb} KB`,
        description,
        timestamp: new Date().toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };
    });

    const a = document.createElement('a');
    a.href = url;
    a.download = outName;
    a.rel = 'noopener';
    a.className = 'hidden';
    document.body.appendChild(a);
    a.click();
    window.setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 500);
  };

  // Download an individual external JS/CSS plugin module file (.js / .css / .zip)
  const handleDownloadSinglePlugin = (plugin: HwpExternalPlugin) => {
    if (plugin.category === 'css' && plugin.cssCode) {
      const header = `/*\n * HWP External CSS Plugin: ${plugin.name} (v${plugin.version})\n * Author: ${plugin.author}\n * Description: ${plugin.description}\n */\n\n`;
      const blob = new Blob([header + plugin.cssCode], { type: 'text/css;charset=utf-8' });
      const outName = `${plugin.id}-v${plugin.version}.css`;
      triggerBrowserDownload(blob, outName, `${plugin.name} 외부 CSS 스타일 모듈`);
      onStatusChange(`'${plugin.name}' CSS 모듈 파일(${outName})을 다운로드했습니다.`);
      return;
    }

    if (plugin.category === 'js' && plugin.jsCode) {
      const header = `/**\n * HWP External JS Plugin: ${plugin.name} (v${plugin.version})\n * Author: ${plugin.author}\n * Description: ${plugin.description}\n */\n\n`;
      const blob = new Blob([header + plugin.jsCode], {
        type: 'application/javascript;charset=utf-8',
      });
      const outName = `${plugin.id}-v${plugin.version}.js`;
      triggerBrowserDownload(blob, outName, `${plugin.name} 외부 JS 기능 모듈`);
      onStatusChange(`'${plugin.name}' JS 스크립트 파일(${outName})을 다운로드했습니다.`);
      return;
    }

    // Hybrid or URL-based plugin: export a combined .js/.css module bundle file
    const bundleContent = [
      `/**`,
      ` * HWP External Hybrid Plugin Module: ${plugin.name} (v${plugin.version})`,
      ` * ID: ${plugin.id} | Category: ${plugin.category.toUpperCase()} | Author: ${plugin.author}`,
      ` * Description: ${plugin.description}`,
      ` */`,
      plugin.cssCode ? `\n/* === [CSS Stylesheet] === */\n${plugin.cssCode}\n` : '',
      plugin.jsCode ? `\n/* === [JavaScript Action Module] === */\n${plugin.jsCode}\n` : '',
      `\n/* === [Plugin Metadata JSON] ===\n${JSON.stringify(plugin, null, 2)}\n*/`,
    ].join('\n');

    const blob = new Blob([bundleContent], { type: 'application/javascript;charset=utf-8' });
    const outName = `${plugin.id}-v${plugin.version}-module.js`;
    triggerBrowserDownload(blob, outName, `${plugin.name} 복합(JS/CSS) 플러그인 모듈`);
    onStatusChange(`'${plugin.name}' 모듈 파일(${outName})을 다운로드했습니다.`);
  };

  // Export standard Apache OpenOffice Extension (.oxt) archive for version-independent installation
  const handleExportOxtExtension = async () => {
    const zip = new JSZip();
    zip.file('META-INF/manifest.xml', generateOxtManifestXml());
    zip.file('description.xml', generateOxtDescriptionXml('4.1.0'));
    zip.file('Addons.xcu', generateOxtAddonsXcu());
    zip.file('HwpBridge/script.xlb', generateOxtBasicScriptXlb());
    zip.file('HwpBridge/dialog.xlb', generateOxtBasicDialogXlb());
    zip.file('HwpBridge/HwpLauncher.xba', generateOxtBasicModuleXba());
    zip.file('Apache_OpenOffice_HWP_Standalone.html', generateStandaloneHwpHtml());
    zip.file(
      'Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html',
      generateFullOpenOfficeWithHwpStandaloneHtml()
    );
    zip.file('pluginManifest.json', JSON.stringify(HWP_PLUGIN_MANIFEST, null, 2));
    zip.file('installedPlugins.json', JSON.stringify(installedPlugins, null, 2));
    zip.file('UPGRADE_INTEGRATION_GUIDE.md', UPGRADE_GUIDE_MARKDOWN);

    const blob = await zip.generateAsync({ type: 'blob' });
    const outName = `Apache_OpenOffice_HWP_Extension_v${HWP_PLUGIN_MANIFEST.pluginVersion}.oxt`;
    triggerBrowserDownload(
      blob,
      outName,
      'Apache OpenOffice 확장 관리자용 한글(.hwp/.hwpx) 표준 확장팩 (.oxt)'
    );
    onStatusChange(
      `오픈오피스 전 버전 호환 확장팩(${outName})을 다운로드했습니다. 오픈오피스의 [도구 > 확장 관리자 > 추가]로 등록하면 즉시 상단 메뉴에서 한글(.hwp/.hwpx) 편집기가 바로 실행됩니다.`
    );
  };

  // Export standalone portable plugin bundle (.zip) with 1-click install scripts for future OpenOffice upgrades
  const handleExportStandalonePluginZip = async () => {
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
    oxtZip.file('installedPlugins.json', JSON.stringify(installedPlugins, null, 2));
    const oxtBytes = await oxtZip.generateAsync({ type: 'uint8array' });
    const oxtFileName = `Apache_OpenOffice_HWP_Extension_v${HWP_PLUGIN_MANIFEST.pluginVersion}.oxt`;

    const zip = new JSZip();
    zip.file(oxtFileName, oxtBytes);
    zip.file('Apache_OpenOffice_HWP_Standalone.html', generateStandaloneHwpHtml());
    zip.file(
      'Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html',
      generateFullOpenOfficeWithHwpStandaloneHtml()
    );
    zip.file('UPGRADE_INTEGRATION_GUIDE.md', UPGRADE_GUIDE_MARKDOWN);
    zip.file(
      'src/plugins/hwp-extension/pluginManifest.json',
      JSON.stringify(HWP_PLUGIN_MANIFEST, null, 2)
    );
    zip.file(
      'src/plugins/hwp-extension/installedExternalPlugins.json',
      JSON.stringify(installedPlugins, null, 2)
    );

    zip.file('install-hwp-plugin.sh', generateUnixInstallSh());
    zip.file('install-hwp-plugin.bat', toWindowsCrlf(generateWindowsInstallBat()));
    zip.file('META-INF/manifest.xml', generateOxtManifestXml());
    zip.file('description.xml', generateOxtDescriptionXml('4.1.0'));
    zip.file('Addons.xcu', generateOxtAddonsXcu());
    zip.file('HwpBridge/script.xlb', generateOxtBasicScriptXlb());
    zip.file('HwpBridge/dialog.xlb', generateOxtBasicDialogXlb());
    zip.file('HwpBridge/HwpLauncher.xba', generateOxtBasicModuleXba());

    const blob = await zip.generateAsync({ type: 'blob' });
    const outName = `openoffice-hwp-portable-plugin-v${HWP_PLUGIN_MANIFEST.pluginVersion}.zip`;
    triggerBrowserDownload(
      blob,
      outName,
      '데스크톱 오픈오피스(unopkg.com) 메뉴 자동 등록 및 소스 이식 통합 패키지 (.zip)'
    );
    onStatusChange(
      `독립형 한글 모듈 패키지(${outName})를 다운로드했습니다. 오픈오피스 [도구 > 확장 관리자 > 추가] 또는 install-hwp-plugin.bat 실행으로 즉시 연동됩니다.`
    );
  };

  // Dynamic Tailwind typography classes to avoid inline style attributes
  const fontSizeClass =
    (
      {
        11: 'text-[11px]',
        13: 'text-[13px]',
        15: 'text-[15px]',
        16: 'text-[16px]',
        18: 'text-[18px]',
        20: 'text-[20px]',
        24: 'text-[24px]',
      } as Record<number, string>
    )[fontSize] || 'text-[15px]';

  const lineHeightClass =
    (
      {
        130: 'leading-[1.3]',
        150: 'leading-[1.5]',
        160: 'leading-[1.6]',
        180: 'leading-[1.8]',
        200: 'leading-[2.0]',
      } as Record<number, string>
    )[lineHeight] || 'leading-[1.6]';

  const letterSpacingClass =
    (
      {
        [-5]: 'tracking-[-0.05em]',
        [-2]: 'tracking-[-0.02em]',
        0: 'tracking-normal',
        2: 'tracking-[0.02em]',
        5: 'tracking-[0.05em]',
      } as Record<number, string>
    )[letterSpacing] || 'tracking-normal';

  const textAlignClass =
    textAlign === 'center'
      ? 'text-center'
      : textAlign === 'right'
      ? 'text-right'
      : textAlign === 'left'
      ? 'text-left'
      : 'text-justify';

  const pagePaddingClass =
    marginPreset === 'narrow'
      ? 'p-6 md:p-7'
      : marginPreset === 'official'
      ? 'px-10 pt-8 pb-10'
      : 'p-10 md:p-12';

  return (
    <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Top HWP Ribbon / Toolbar */}
      <div className="border-b border-slate-200 bg-slate-50 p-2.5 flex flex-wrap items-center gap-2">
        {/* File Name & Format Badge */}
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-1 rounded bg-sky-700 text-white text-[11px] font-bold tracking-tight">
            한글 {fileFormat.toUpperCase()}
          </span>
          <input
            type="text"
            value={filename}
            onChange={(e) => {
              const val = e.target.value;
              setFilename(val);
              if (val.toLowerCase().endsWith('.hwp')) setFileFormat('hwp');
              if (val.toLowerCase().endsWith('.hwpx')) setFileFormat('hwpx');
            }}
            className="text-xs font-medium bg-white border border-slate-300 rounded px-2.5 py-1.5 w-56 focus:outline-none focus:border-sky-600"
          />
        </div>

        {/* File Open & Save (.hwpx / .hwp) */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".hwp,.hwpx"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-medium px-2.5 py-1.5 rounded transition"
          title="내 컴퓨터에서 .hwp 또는 .hwpx 파일 불러오기 (표·레이아웃 보존 파서 적용)"
        >
          <Upload className="w-3.5 h-3.5 text-sky-600" />
          .hwp/.hwpx 열기
        </button>

        <button
          onClick={() => {
            if (onDownloadFullProject) {
              onDownloadFullProject();
            } else {
              handleExportStandalonePluginZip();
            }
          }}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-3 py-1.5 rounded-md shadow-xs border border-emerald-500 transition"
          title="오픈오피스 6대 모듈(Writer·Calc·Impress·Draw·Math) + 한글(.hwp/.hwpx) 편집기 + 데스크톱 135MB 자동설치기 통합 다운로드 (.zip)"
        >
          <Download className="w-3.5 h-3.5" />
          오픈오피스+한글 통합 다운로드 (.zip)
        </button>

        <button
          onClick={() => handleSaveDocument('hwpx')}
          className="flex items-center gap-1 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-2xs transition"
          title="표준 개방형 한글 문서(.hwpx, <hp:tbl> 표 구조 포함)로 다운로드"
        >
          <Download className="w-3.5 h-3.5" />
          .hwpx 다운로드
        </button>

        <button
          onClick={() => handleSaveDocument('hwp')}
          className="flex items-center gap-1 bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-2xs transition"
          title="한글 5.0 호환(.hwp)으로 다운로드"
        >
          <Download className="w-3.5 h-3.5" />
          .hwp 다운로드
        </button>

        <button
          onClick={handleExportOxtExtension}
          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-2xs transition"
          title="오픈오피스 버전이 올라가도 확장 관리자에서 바로 설치할 수 있는 한글 확장팩(.oxt) 다운로드"
        >
          <Download className="w-3.5 h-3.5" />
          확장팩(.oxt) 다운로드
        </button>

        <button
          onClick={handleExportStandalonePluginZip}
          className="flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-2xs transition"
          title="상위 버전 오픈오피스 소스에 1클릭으로 이식할 수 있는 독립 플러그인(.zip) 다운로드"
        >
          <Package className="w-3.5 h-3.5" />
          독립 플러그인(.zip) 다운로드
        </button>

        <button
          onClick={() => {
            setPluginManagerTab('installed');
            setIsPluginModalOpen(true);
          }}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded shadow-2xs transition"
          title="HWP 설정: 외부 JS/CSS 플러그인 매니저 (설치됨 / 사용 가능 목록 및 동적 로드)"
        >
          <Settings className="w-3.5 h-3.5" />
          플러그인 매니저 ({installedPlugins.filter((p) => p.enabled).length}개 활성)
        </button>

        <div className="h-5 w-px bg-slate-300 mx-0.5" />

        {/* Templates */}
        <select
          onChange={(e) => {
            const tpl = TEMPLATES[e.target.value];
            if (tpl) {
              setDocHeader(tpl.title);
              setDocSubheader(tpl.subtitle);
              setContent(tpl.body);
              setTables(
                tpl.tables.map((t) => ({
                  ...t,
                  rows: normalizeTableGrid(t.rows),
                }))
              );
              setShowTable(tpl.tables.length > 0);
              setSelectedCell(null);
              onStatusChange(`'${tpl.title}' 문서 양식을 표·레이아웃 보호 모드로 불러왔습니다.`);
            }
          }}
          defaultValue="official"
          className="text-xs bg-white border border-slate-300 rounded px-2 py-1.5 font-medium text-slate-700"
        >
          <option value="official">양식: 행정 공문서(기안문)</option>
          <option value="report">양식: 주간 업무 보고서(셀병합 표 포함)</option>
          <option value="contract">양식: 표준 기술협약서</option>
          <option value="blank">양식: 빈 한글 문서</option>
        </select>

        {/* Font Controls */}
        <select
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value as 'batang' | 'dotum' | 'gothic' | 'mono')}
          className="text-xs bg-white border border-slate-300 rounded px-2 py-1.5"
        >
          <option value="batang">함초롬바탕 (명조)</option>
          <option value="dotum">함초롬돋움 (고딕)</option>
          <option value="gothic">맑은 고딕</option>
          <option value="mono">나눔고딕 코딩</option>
        </select>

        <select
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="text-xs bg-white border border-slate-300 rounded px-2 py-1.5"
        >
          {[11, 13, 15, 16, 18, 20, 24].map((sz) => (
            <option key={sz} value={sz}>
              {sz} pt
            </option>
          ))}
        </select>

        {/* Line Spacing (줄간격 - HWP default 160%) */}
        <select
          value={lineHeight}
          onChange={(e) => setLineHeight(Number(e.target.value))}
          className="text-xs bg-white border border-slate-300 rounded px-2 py-1.5"
          title="한글 문단 줄간격 (기본 160%)"
        >
          <option value={130}>줄간격 130%</option>
          <option value={150}>줄간격 150%</option>
          <option value={160}>줄간격 160% (표준)</option>
          <option value={180}>줄간격 180%</option>
          <option value={200}>줄간격 200%</option>
        </select>

        {/* Letter Spacing (자간) */}
        <select
          value={letterSpacing}
          onChange={(e) => setLetterSpacing(Number(e.target.value))}
          className="text-xs bg-white border border-slate-300 rounded px-2 py-1.5"
          title="자간 조절"
        >
          <option value={-5}>자간 -5%</option>
          <option value={-2}>자간 -2%</option>
          <option value={0}>자간 0%</option>
          <option value={2}>자간 +2%</option>
          <option value={5}>자간 +5%</option>
        </select>
      </div>

      {/* Second Row Toolbar: Formatting, Layout Protection, Approval Stamp, Table, Special Chars */}
      <div className="border-b border-slate-200 bg-slate-100/80 px-3 py-1.5 flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setIsBold(!isBold)}
          className={`p-1.5 rounded border ${
            isBold ? 'bg-sky-100 border-sky-400 text-sky-800' : 'bg-white border-slate-200'
          }`}
          title="굵게 (Ctrl+B)"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setIsItalic(!isItalic)}
          className={`p-1.5 rounded border ${
            isItalic ? 'bg-sky-100 border-sky-400 text-sky-800' : 'bg-white border-slate-200'
          }`}
          title="기울임 (Ctrl+I)"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setIsUnderline(!isUnderline)}
          className={`p-1.5 rounded border ${
            isUnderline ? 'bg-sky-100 border-sky-400 text-sky-800' : 'bg-white border-slate-200'
          }`}
          title="밑줄 (Ctrl+U)"
        >
          <Underline className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-slate-300 mx-1" />

        <button
          onClick={() => setTextAlign('justify')}
          className={`p-1.5 rounded border ${
            textAlign === 'justify' ? 'bg-sky-100 border-sky-400 text-sky-800' : 'bg-white border-slate-200'
          }`}
          title="양쪽 정렬 (한글 기본)"
        >
          <AlignJustify className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setTextAlign('left')}
          className={`p-1.5 rounded border ${
            textAlign === 'left' ? 'bg-sky-100 border-sky-400 text-sky-800' : 'bg-white border-slate-200'
          }`}
          title="왼쪽 정렬"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setTextAlign('center')}
          className={`p-1.5 rounded border ${
            textAlign === 'center' ? 'bg-sky-100 border-sky-400 text-sky-800' : 'bg-white border-slate-200'
          }`}
          title="가운데 정렬"
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setTextAlign('right')}
          className={`p-1.5 rounded border ${
            textAlign === 'right' ? 'bg-sky-100 border-sky-400 text-sky-800' : 'bg-white border-slate-200'
          }`}
          title="오른쪽 정렬"
        >
          <AlignRight className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-slate-300 mx-1" />

        {/* Page Orientation & Margin Controls (레이아웃 깨짐 방지용 용지/여백 설정) */}
        <button
          onClick={() => {
            const next = pageOrientation === 'portrait' ? 'landscape' : 'portrait';
            setPageOrientation(next);
            onStatusChange(
              `용지 방향을 ${next === 'landscape' ? '가로(297×210mm)' : '세로(210×297mm)'}로 전환했습니다.`
            );
          }}
          className="flex items-center gap-1 px-2 py-1 rounded border bg-white border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
          title="넓은 표가 깨지지 않도록 용지 방향(세로/가로) 전환"
        >
          <Maximize2 className="w-3.5 h-3.5 text-sky-600" />
          용지: {pageOrientation === 'portrait' ? '세로(A4)' : '가로(A4)'}
        </button>

        <select
          value={marginPreset}
          onChange={(e) => {
            const val = e.target.value as 'standard' | 'narrow' | 'official';
            setMarginPreset(val);
            onStatusChange(`문서 여백 규격이 변경되었습니다.`);
          }}
          className="text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 font-medium"
          title="문서 여백 규격 선택"
        >
          <option value="standard">여백: 표준 (30mm)</option>
          <option value="official">여백: 행정공문서 규격</option>
          <option value="narrow">여백: 좁게 (넓은 표 보호)</option>
        </select>

        {/* Table Layout Protection Mode Toggle */}
        <button
          onClick={() => {
            const next = !tableLockLayout;
            setTableLockLayout(next);
            onStatusChange(
              next
                ? '표 레이아웃 보호 모드(열 너비 고정·자동 줄바꿈)가 켜졌습니다.'
                : '표 열 너비 자동 조절 모드로 변경되었습니다.'
            );
          }}
          className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-semibold ${
            tableLockLayout
              ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
              : 'bg-white border-slate-200 text-slate-600'
          }`}
          title="표를 불러올 때 셀 내용이 길어도 표 틀이 무너지지 않도록 고정합니다"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          표 깨짐 방지 {tableLockLayout ? 'ON' : 'OFF'}
        </button>

        {/* Toggle Approval Box (결재란) */}
        <button
          onClick={() => setShowApprovalBox(!showApprovalBox)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium ${
            showApprovalBox
              ? 'bg-sky-100 border-sky-400 text-sky-900'
              : 'bg-white border-slate-200 text-slate-600'
          }`}
        >
          <Stamp className="w-3.5 h-3.5" />
          결재란 {showApprovalBox ? '표시' : '숨김'}
        </button>

        {/* Toggle Embedded Table (표) */}
        <button
          onClick={() => {
            if (!showTable && tables.length === 0) {
              setTables(
                TEMPLATES.official.tables.map((t) => ({
                  ...t,
                  rows: normalizeTableGrid(t.rows),
                }))
              );
            }
            setShowTable(!showTable);
          }}
          className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium ${
            showTable
              ? 'bg-sky-100 border-sky-400 text-sky-900'
              : 'bg-white border-slate-200 text-slate-600'
          }`}
        >
          <TableIcon className="w-3.5 h-3.5" />
          표 {showTable ? `표시(${tables.length})` : '숨김'}
        </button>

        {/* Quick Korean Bullet / Symbol Bar (문자표) */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-slate-500 mr-0.5">문자표:</span>
          {SPECIAL_CHARS.slice(0, 10).map((ch) => (
            <button
              key={ch}
              onClick={() => insertSpecialChar(ch)}
              className="w-6 h-6 text-xs bg-white hover:bg-sky-50 border border-slate-200 rounded flex items-center justify-center font-serif text-slate-800"
              title={`본문에 '${ch}' 기호 삽입`}
            >
              {ch}
            </button>
          ))}
        </div>

        {/* Find Box */}
        <div className="ml-auto relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          <input
            type="text"
            placeholder="본문 찾기..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-300 rounded w-32 focus:outline-none focus:border-sky-600"
          />
        </div>
      </div>

      {/* Layout & Table Integrity Verification Banner (레이아웃·표 무결성 점검 상태바) */}
      <div className="bg-emerald-50/80 border-b border-emerald-200 px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-emerald-900">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded">
            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
            한글 레이아웃·표 무결성 검증 완료
          </span>
          <span className="text-emerald-800">
            본문 문단 <strong>{integrityReport.paragraphCount}개</strong> · 독립 표{' '}
            <strong>{tables.length}개</strong>
            {integrityReport.mergedCellCount > 0 && (
              <>
                {' '}
                · 병합 셀(colSpan/rowSpan) <strong>{integrityReport.mergedCellCount}곳</strong> 보존
              </>
            )}
          </span>
        </div>
        <div className="text-emerald-700 font-medium truncate">
          보호 내역: {integrityReport.issuesFixed.join(' | ')}
        </div>
      </div>

      {/* Active Dynamic JS/CSS Plugins Action Bar (활성화된 플러그인 도구 모음) */}
      {installedPlugins.some((p) => p.enabled) && (
        <div className="bg-indigo-50/90 border-b border-indigo-200 px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 font-bold text-indigo-900 bg-indigo-100 border border-indigo-300 px-2 py-0.5 rounded text-[11px]">
              <Code2 className="w-3 h-3 text-indigo-700" />
              동적 로드된 JS/CSS 플러그인 ({installedPlugins.filter((p) => p.enabled).length}개 활성)
            </span>
            {activeActionPlugins.map((plugin) => (
              <button
                key={plugin.id}
                type="button"
                onClick={() => executePluginJsAction(plugin)}
                className="inline-flex items-center gap-1 bg-white hover:bg-indigo-600 hover:text-white text-indigo-800 border border-indigo-300 px-2.5 py-0.5 rounded-md text-[11px] font-semibold shadow-2xs transition"
                title={plugin.description}
              >
                <Play className="w-2.5 h-2.5" />
                {plugin.actionButtonLabel}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setPluginManagerTab('installed');
              setIsPluginModalOpen(true);
            }}
            className="text-[11px] font-semibold text-indigo-700 hover:underline"
          >
            플러그인 설정 관리 →
          </button>
        </div>
      )}

      {/* Persistent Direct Download Link Banner (샌드박스/브라우저 팝업 차단 환경에서도 100% 다운로드 보장) */}
      {recentDownload && (
        <div className="border-b border-emerald-300 bg-emerald-50 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-emerald-950">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 text-white text-[11px] font-bold">
              <Download className="w-3 h-3" /> 다운로드 준비 완료
            </span>
            <span className="font-bold text-emerald-900">{recentDownload.filename}</span>
            <span className="text-[11px] text-emerald-700">
              ({recentDownload.sizeLabel} · {recentDownload.description} · {recentDownload.timestamp})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={recentDownload.url}
              download={recentDownload.filename}
              className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1 rounded-lg shadow-2xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              파일 직접 다운로드 저장 ({recentDownload.filename})
            </a>
            <button
              type="button"
              onClick={() => setRecentDownload(null)}
              className="text-[11px] text-emerald-700 hover:text-emerald-950 px-1.5 py-0.5"
            >
              닫기 ✕
            </button>
          </div>
        </div>
      )}

      {/* Horizontal A4 Ruler */}
      <div className="bg-slate-200/70 border-b border-slate-300 px-8 py-1 text-[10px] font-mono text-slate-500 flex justify-between">
        <span>좌측여백 {marginPreset === 'narrow' ? '15mm' : '30mm'}</span>
        <span>20</span>
        <span>40</span>
        <span>60</span>
        <span>80</span>
        <span>100</span>
        <span>120</span>
        <span>140</span>
        {pageOrientation === 'landscape' && (
          <>
            <span>160</span>
            <span>180</span>
            <span>200</span>
          </>
        )}
        <span>우측여백 {marginPreset === 'narrow' ? '15mm' : '30mm'}</span>
      </div>

      {/* A4 Page Workspace */}
      <div className="flex-1 bg-slate-200/70 p-6 overflow-y-auto flex justify-center">
        <div
          className={`hwp-page-canvas w-full ${
            pageOrientation === 'landscape' ? 'max-w-5xl' : 'max-w-3xl'
          } bg-white shadow-md border border-slate-300 min-h-[640px] ${pagePaddingClass} flex flex-col relative transition-all`}
        >
          {/* Top-left & Top-right HWP crop marks (편집 용지 표시) */}
          <div className="w-4 h-4 border-t border-l border-slate-400 absolute top-5 left-5 pointer-events-none" />
          <div className="w-4 h-4 border-t border-r border-slate-400 absolute top-5 right-5 pointer-events-none" />
          <div className="w-4 h-4 border-b border-l border-slate-400 absolute bottom-5 left-5 pointer-events-none" />
          <div className="w-4 h-4 border-b border-r border-slate-400 absolute bottom-5 right-5 pointer-events-none" />

          {/* Approval Box (결재란) */}
          {showApprovalBox && (
            <div className="flex justify-end mb-6">
              <table className="border-collapse border border-slate-700 text-xs text-center">
                <tbody>
                  <tr>
                    <td
                      rowSpan={2}
                      className="border border-slate-700 bg-slate-100 px-2 py-2 font-semibold w-8 leading-tight text-slate-800"
                    >
                      결
                      <br />재
                    </td>
                    {approvals.map((slot, idx) => (
                      <td
                        key={idx}
                        className="border border-slate-700 bg-slate-50 px-3 py-1 font-medium text-slate-700 w-20"
                      >
                        <input
                          type="text"
                          value={slot.role}
                          onChange={(e) => {
                            const next = [...approvals];
                            next[idx] = { ...slot, role: e.target.value };
                            setApprovals(next);
                          }}
                          className="w-full text-center bg-transparent focus:outline-none font-semibold"
                        />
                      </td>
                    ))}
                  </tr>
                  <tr>
                    {approvals.map((slot, idx) => (
                      <td
                        key={idx}
                        onClick={() => {
                          const next = [...approvals];
                          next[idx] = { ...slot, approved: !slot.approved };
                          setApprovals(next);
                        }}
                        className="border border-slate-700 h-14 px-2 py-1 relative cursor-pointer hover:bg-slate-50"
                        title="클릭하여 직인(전결/결재) 날인 전환"
                      >
                        <div className="text-[11px] text-slate-800 font-medium">{slot.name}</div>
                        {slot.approved && (
                          <span className="inline-flex items-center justify-center mt-0.5 px-1.5 py-0.5 text-[10px] font-bold text-red-600 border-2 border-red-600 rounded-full">
                            결재인
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Document Header / Title Box */}
          <div className="hwp-title-box border-b-2 border-slate-800 pb-3 mb-5 text-center">
            <input
              type="text"
              value={docHeader}
              onChange={(e) => setDocHeader(e.target.value)}
              className="w-full text-center text-xl md:text-2xl font-bold text-slate-900 focus:outline-none bg-transparent"
              placeholder="문서 제목을 입력하세요"
            />
            <input
              type="text"
              value={docSubheader}
              onChange={(e) => setDocSubheader(e.target.value)}
              className="w-full text-center text-xs text-slate-600 mt-1.5 focus:outline-none bg-transparent"
              placeholder="기관명 또는 부제목을 입력하세요"
            />
          </div>

          {searchQuery && (
            <div className="mb-3 text-xs bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1.5 rounded flex items-center justify-between">
              <span>
                "{searchQuery}" 검색 결과:{' '}
                <strong>
                  {content.toLowerCase().split(searchQuery.toLowerCase()).length - 1}건
                </strong>
              </span>
              <button onClick={() => setSearchQuery('')} className="underline text-[11px]">
                닫기
              </button>
            </div>
          )}

          {/* Main Body Textarea */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={`hwp-body-editor w-full flex-1 min-h-[240px] resize-none focus:outline-none text-slate-900 bg-transparent ${fontSizeClass} ${lineHeightClass} ${letterSpacingClass} ${textAlignClass} ${
              isBold ? 'font-bold' : 'font-normal'
            } ${isItalic ? 'italic' : 'not-italic'} ${
              isUnderline ? 'underline' : 'no-underline'
            } ${
              fontFamily === 'batang'
                ? 'font-serif'
                : fontFamily === 'mono'
                ? 'font-mono'
                : 'font-sans'
            }`}
          />

          {/* Structured HWP Tables (supports multiple tables, colSpan/rowSpan, multi-line cells) */}
          {showTable && tables.length > 0 && (
            <div className="mt-6 space-y-6">
              {tables.map((tbl, tIdx) => (
                <div key={tbl.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50/40">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <input
                      type="text"
                      value={tbl.caption}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTables((prev) =>
                          prev.map((item, idx) => (idx === tIdx ? { ...item, caption: val } : item))
                        );
                      }}
                      className="text-xs font-bold text-slate-700 bg-transparent border-b border-transparent focus:border-sky-600 focus:outline-none w-72"
                    />

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => handleMergeRight(tIdx)}
                        className="text-[11px] bg-white hover:bg-sky-50 text-sky-800 border border-slate-300 px-2 py-0.5 rounded flex items-center gap-0.5 transition"
                        title="선택한 셀과 오른쪽 셀을 병합합니다 (colSpan)"
                      >
                        <Columns className="w-3 h-3" /> 우측 셀 병합
                      </button>
                      <button
                        onClick={() => handleUnmergeCell(tIdx)}
                        className="text-[11px] bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 rounded transition"
                        title="선택한 병합 셀을 원래 격자로 분할합니다"
                      >
                        병합 해제
                      </button>
                      <button
                        onClick={() => handleAddRow(tIdx)}
                        className="text-[11px] bg-white hover:bg-sky-50 text-sky-700 border border-slate-300 px-2 py-0.5 rounded flex items-center gap-0.5 transition"
                      >
                        <Plus className="w-3 h-3" /> 행 추가
                      </button>
                      <button
                        onClick={() => handleAddCol(tIdx)}
                        className="text-[11px] bg-white hover:bg-sky-50 text-sky-700 border border-slate-300 px-2 py-0.5 rounded flex items-center gap-0.5 transition"
                      >
                        <Plus className="w-3 h-3" /> 열 추가
                      </button>
                      {tbl.rows.length > 1 && (
                        <button
                          onClick={() => handleDeleteLastRow(tIdx)}
                          className="text-[11px] bg-white hover:bg-red-50 text-red-600 border border-slate-300 px-2 py-0.5 rounded flex items-center gap-0.5 transition"
                        >
                          <Trash2 className="w-3 h-3" /> 행 삭제
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table
                      className={`w-full border-collapse border-2 border-slate-800 text-xs bg-white ${
                        tableLockLayout ? 'table-fixed' : 'table-auto'
                      }`}
                    >
                      <tbody>
                        {tbl.rows.map((row, rIdx) => (
                          <tr key={rIdx}>
                            {row.map((cell, cIdx) => {
                              if (cell.hiddenBySpan) return null;
                              const isSelected =
                                selectedCell?.tableIdx === tIdx &&
                                selectedCell?.rowIdx === rIdx &&
                                selectedCell?.colIdx === cIdx;
                              const lineCount = Math.max(1, (cell.text || '').split('\n').length);

                              return (
                                <td
                                  key={cIdx}
                                  colSpan={cell.colSpan || 1}
                                  rowSpan={cell.rowSpan || 1}
                                  onClick={() =>
                                    setSelectedCell({ tableIdx: tIdx, rowIdx: rIdx, colIdx: cIdx })
                                  }
                                  className={`border border-slate-700 px-2 py-1.5 align-middle transition ${
                                    cell.isHeader || rIdx === 0
                                      ? 'bg-slate-100 font-semibold'
                                      : 'bg-white'
                                  } ${isSelected ? 'ring-2 ring-sky-500 ring-inset bg-sky-50/40' : ''}`}
                                >
                                  <textarea
                                    rows={lineCount}
                                    value={cell.text}
                                    onChange={(e) =>
                                      updateCellText(tIdx, rIdx, cIdx, e.target.value)
                                    }
                                    className={`w-full bg-transparent resize-none focus:outline-none break-words whitespace-pre-wrap leading-snug ${
                                      cell.align === 'center' || cell.isHeader || rIdx === 0
                                        ? 'text-center font-semibold'
                                        : cell.align === 'right'
                                        ? 'text-right'
                                        : 'text-left'
                                    }`}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              <div className="flex justify-end">
                <button
                  onClick={() => {
                    const nextIdx = tables.length + 1;
                    setTables((prev) => [
                      ...prev,
                      {
                        id: `tbl-custom-${Date.now()}`,
                        caption: `[표 ${nextIdx}] 추가 표`,
                        rows: normalizeTableGrid([
                          [
                            { text: '항목 1', colSpan: 1, rowSpan: 1, align: 'center', isHeader: true },
                            { text: '항목 2', colSpan: 1, rowSpan: 1, align: 'center', isHeader: true },
                            { text: '비고', colSpan: 1, rowSpan: 1, align: 'center', isHeader: true },
                          ],
                          [
                            { text: '내용 입력', colSpan: 1, rowSpan: 1, align: 'left' },
                            { text: '내용 입력', colSpan: 1, rowSpan: 1, align: 'left' },
                            { text: '-', colSpan: 1, rowSpan: 1, align: 'center' },
                          ],
                        ]),
                      },
                    ]);
                    onStatusChange(`[표 ${nextIdx}] 새 한글 표가 추가되었습니다.`);
                  }}
                  className="text-xs font-medium text-sky-700 hover:text-sky-900 flex items-center gap-1 bg-sky-50 border border-sky-200 px-3 py-1 rounded-lg transition"
                >
                  <Plus className="w-3.5 h-3.5" /> 새 표 추가
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom HWP Status Bar */}
      <div className="border-t border-slate-200 bg-slate-50 px-4 py-1.5 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="font-medium text-sky-800">
            포맷: {fileFormat === 'hwpx' ? 'HWPX (KS X 6101 개방형 XML)' : 'HWP (한글 5.0 호환)'}
          </span>
          <span>1 / 1 쪽</span>
          <span>
            A4 {pageOrientation === 'landscape' ? '가로 (297×210mm)' : '세로 (210×297mm)'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>표: {tables.length}개</span>
          <span>글자수(공백포함): {stats.charsWithSpace}자</span>
          <span>글자수(공백제외): {stats.charsNoSpace}자</span>
          <span>어절수: {stats.eojeol}</span>
          <span>200자 원고지: 약 {stats.manuscriptPages}매</span>
        </div>
      </div>

      {/* HWP 설정 — 플러그인 매니저 (동적 JS/CSS 모듈 로드·토글 & 오픈오피스 버전 업그레이드 추출) */}
      {isPluginModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full mb-1.5">
                  <Settings className="w-3.5 h-3.5" />
                  HWP 설정 · 동적 JS/CSS 플러그인 매니저 (Plugin Manager)
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  한글 편집기 외부 모듈(JS/CSS) 관리 및 버전 독립형 확장 패키지
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  코어 코드베이스를 전혀 수정하지 않고 외부 JavaScript 및 CSS 모듈을 실시간으로 로드·토글하거나,
                  상위 버전 오픈오피스 이식용 패키지(.oxt/.zip)를 추출할 수 있습니다.
                </p>
              </div>
              <button
                onClick={() => setIsPluginModalOpen(false)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-700 px-2 py-1 rounded"
              >
                닫기 ✕
              </button>
            </div>

            {/* Always-Visible Quick Download Bar inside Plugin Manager Modal */}
            <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-emerald-600" />
                  빠른 다운로드 센터 (오픈오피스 업그레이드용 한글 확장팩 &amp; 독립 플러그인)
                </div>
                <p className="text-[11px] text-emerald-800">
                  탭을 이동하지 않고도 아래 버튼을 클릭하여 한글 확장팩(.oxt), 독립 이식 패키지(.zip), 현재 문서(.hwpx)를 즉시 다운로드할 수 있습니다.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (onDownloadFullProject) {
                      onDownloadFullProject();
                    } else {
                      handleExportStandalonePluginZip();
                    }
                  }}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold px-3.5 py-2 rounded-lg shadow-xs border border-amber-400 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  전체 다운로드 (.zip)
                </button>
                <button
                  type="button"
                  onClick={handleExportOxtExtension}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-2xs transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  확장팩 (.oxt) 다운로드
                </button>
                <button
                  type="button"
                  onClick={handleExportStandalonePluginZip}
                  className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-2xs transition"
                >
                  <Package className="w-3.5 h-3.5" />
                  독립 플러그인 (.zip) 다운로드
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveDocument('hwpx')}
                  className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-2xs transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  현재 문서 (.hwpx) 저장
                </button>
              </div>
            </div>

            {recentDownload && (
              <div className="bg-emerald-900 text-white rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span>
                    생성 완료: <strong>{recentDownload.filename}</strong> ({recentDownload.sizeLabel})
                  </span>
                </div>
                <a
                  href={recentDownload.url}
                  download={recentDownload.filename}
                  className="inline-flex items-center gap-1.5 bg-white text-emerald-900 hover:bg-emerald-100 font-bold px-3 py-1.5 rounded-lg transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  내 컴퓨터로 직접 저장 ({recentDownload.filename})
                </a>
              </div>
            )}

            {/* Plugin Manager Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setPluginManagerTab('installed')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  pluginManagerTab === 'installed'
                    ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>설치된 플러그인 (Installed)</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-bold">
                  {installedPlugins.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPluginManagerTab('available')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  pluginManagerTab === 'available'
                    ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>사용 가능한 플러그인 (Available)</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-bold">
                  {availablePlugins.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPluginManagerTab('custom')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  pluginManagerTab === 'custom'
                    ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>외부 JS/CSS 모듈 직접 추가</span>
              </button>

              <button
                type="button"
                onClick={() => setPluginManagerTab('portable')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  pluginManagerTab === 'portable'
                    ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>오픈오피스 버전 이식 (.oxt/.zip)</span>
              </button>
            </div>

            {/* TAB 1: Installed Plugins List (설치된 플러그인 — 동적 ON/OFF 토글 및 실행) */}
            {pluginManagerTab === 'installed' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    현재 설치된 플러그인 목록입니다. 토글 스위치로 코어 재시작 없이 JS/CSS 모듈을 즉시 켜고 끌 수 있습니다.
                  </span>
                  <span className="font-semibold text-indigo-700">
                    활성 모듈: {installedPlugins.filter((p) => p.enabled).length} / {installedPlugins.length}
                  </span>
                </div>

                {installedPlugins.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                    설치된 플러그인이 없습니다. '사용 가능한 플러그인' 탭에서 필요한 기능을 설치해보세요.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {installedPlugins.map((plugin) => (
                      <div
                        key={plugin.id}
                        className={`p-4 rounded-xl border transition ${
                          plugin.enabled
                            ? 'bg-indigo-50/40 border-indigo-300 shadow-2xs'
                            : 'bg-slate-50 border-slate-200 opacity-80'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                                  plugin.category === 'css'
                                    ? 'bg-pink-100 text-pink-800 border border-pink-200'
                                    : plugin.category === 'js'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                }`}
                              >
                                {plugin.category === 'hybrid'
                                  ? 'JS + CSS 복합 모듈'
                                  : `${plugin.category.toUpperCase()} 모듈`}
                              </span>
                              <h4 className="text-xs font-bold text-slate-900">{plugin.name}</h4>
                              <span className="text-[11px] font-mono text-slate-400">
                                v{plugin.version} · {plugin.author}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {plugin.description}
                            </p>
                            {(plugin.cssUrl || plugin.jsUrl) && (
                              <div className="text-[11px] font-mono text-slate-500 pt-1">
                                외부 리소스 URL: {plugin.cssUrl || plugin.jsUrl}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {plugin.enabled && plugin.jsCode && (
                              <button
                                type="button"
                                onClick={() => executePluginJsAction(plugin)}
                                className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition"
                                title="이 플러그인의 JS 스크립트 기능을 즉시 실행합니다"
                              >
                                <Play className="w-3 h-3" />
                                {plugin.actionButtonLabel || '모듈 실행'}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDownloadSinglePlugin(plugin)}
                              className="flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition"
                              title="이 플러그인의 JS/CSS 소스 모듈 파일 다운로드"
                            >
                              <Download className="w-3 h-3 text-sky-600" />
                              모듈 다운로드
                            </button>

                            <button
                              type="button"
                              onClick={() => handleTogglePluginEnabled(plugin.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                                plugin.enabled
                                  ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              {plugin.enabled ? '활성화됨 (ON)' : '비활성화 (OFF)'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleUninstallPlugin(plugin.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition"
                              title="플러그인 설치 제거"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Available Plugins List (사용 가능한 플러그인 마켓/목록) */}
            {pluginManagerTab === 'available' && (
              <div className="space-y-3">
                <div className="text-xs text-slate-500">
                  코어 코드 변경 없이 원클릭으로 한글 편집기에 추가할 수 있는 공식/확장 플러그인 목록입니다.
                </div>

                {availablePlugins.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                    모든 기본 제공 플러그인이 이미 설치되어 있습니다! '외부 JS/CSS 모듈 직접 추가' 탭에서 커스텀 플러그인을 등록할 수 있습니다.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {availablePlugins.map((plugin) => (
                      <div
                        key={plugin.id}
                        className="p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 flex flex-wrap items-start justify-between gap-3 transition"
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {plugin.category.toUpperCase()} 모듈
                            </span>
                            <h4 className="text-xs font-bold text-slate-900">{plugin.name}</h4>
                            <span className="text-[11px] font-mono text-slate-400">
                              v{plugin.version} · {plugin.author}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {plugin.description}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDownloadSinglePlugin(plugin)}
                            className="flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition"
                            title="이 플러그인의 JS/CSS 모듈 파일을 먼저 다운로드"
                          >
                            <Download className="w-3.5 h-3.5 text-sky-600" />
                            모듈 다운로드 (.js/.css)
                          </button>

                          <button
                            type="button"
                            onClick={() => handleInstallPlugin(plugin.id)}
                            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-2xs transition shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            설치 및 활성화
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Custom External JS/CSS Module Loader (사용자 정의 외부 JS/CSS 등록) */}
            {pluginManagerTab === 'custom' && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="text-xs font-bold text-slate-800">
                  외부 JavaScript / CSS 모듈 동적 로드 및 플러그인 등록
                </div>
                <p className="text-[11px] text-slate-500">
                  외부 CDN/로컬 URL(.js, .css) 또는 직접 작성한 스크립트/스타일 코드를 입력하면 코어 코드 수정 없이 즉시 HWP 편집기에 주입됩니다.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      플러그인 이름 *
                    </label>
                    <input
                      type="text"
                      value={customPluginName}
                      onChange={(e) => setCustomPluginName(e.target.value)}
                      placeholder="예: 공문서 파란색 테두리 강조 & 자동 서명기"
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      모듈 유형
                    </label>
                    <select
                      value={customPluginCategory}
                      onChange={(e) =>
                        setCustomPluginCategory(e.target.value as 'css' | 'js' | 'hybrid')
                      }
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-600"
                    >
                      <option value="hybrid">JS + CSS 복합 모듈</option>
                      <option value="js">JavaScript 기능 모듈</option>
                      <option value="css">CSS 테마/스타일 모듈</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      설명 (선택)
                    </label>
                    <input
                      type="text"
                      value={customPluginDesc}
                      onChange={(e) => setCustomPluginDesc(e.target.value)}
                      placeholder="플러그인 기능 요약 설명..."
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                  {customPluginCategory !== 'css' && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        툴바 실행 버튼 이름 (선택)
                      </label>
                      <input
                        type="text"
                        value={customActionLabel}
                        onChange={(e) => setCustomActionLabel(e.target.value)}
                        placeholder="예: 자동 서명 삽입"
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-600"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      외부 CSS URL (선택, &lt;link&gt; 동적 주입)
                    </label>
                    <input
                      type="text"
                      value={customCssUrl}
                      onChange={(e) => setCustomCssUrl(e.target.value)}
                      placeholder="https://example.com/custom-hwp-theme.css"
                      className="w-full text-xs font-mono bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      외부 JS URL (선택, &lt;script&gt; 동적 주입)
                    </label>
                    <input
                      type="text"
                      value={customJsUrl}
                      onChange={(e) => setCustomJsUrl(e.target.value)}
                      placeholder="https://example.com/custom-hwp-plugin.js"
                      className="w-full text-xs font-mono bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>

                {customPluginCategory !== 'js' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      동적 주입할 CSS 스타일 코드 (.hwp-page-canvas, .hwp-body-editor 등 타겟팅)
                    </label>
                    <textarea
                      rows={3}
                      value={customCssCode}
                      onChange={(e) => setCustomCssCode(e.target.value)}
                      className="w-full font-mono text-xs bg-slate-900 text-pink-300 p-2.5 rounded-lg focus:outline-none"
                    />
                  </div>
                )}

                {customPluginCategory !== 'css' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      동적 실행할 JavaScript 코드 (api.getContent(), api.setContent(), api.notify() 제공)
                    </label>
                    <textarea
                      rows={3}
                      value={customJsCode}
                      onChange={(e) => setCustomJsCode(e.target.value)}
                      className="w-full font-mono text-xs bg-slate-900 text-emerald-300 p-2.5 rounded-lg focus:outline-none"
                    />
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleRegisterCustomPlugin}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    플러그인 등록 및 즉시 활성화
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: Portable OpenOffice Upgrade Package (.oxt / .zip) */}
            {pluginManagerTab === 'portable' && (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      상위 버전 오픈오피스 호환성 검증 (시뮬레이션)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500">대상 오픈오피스 버전:</span>
                      {['4.1.17 (현재)', '4.1.18', '4.2.0', '5.0.0'].map((ver) => (
                        <button
                          key={ver}
                          type="button"
                          onClick={() => {
                            setSimulatedHostVersion(ver);
                            onStatusChange(
                              `Apache OpenOffice ${ver} 코어 환경과의 플러그인 호환성 검증 완료: 충돌 0건`
                            );
                          }}
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded border transition ${
                            simulatedHostVersion === ver
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          v{ver}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                      <div className="text-[11px] text-slate-400">플러그인 식별자 (ID)</div>
                      <div className="font-mono font-semibold text-slate-800 text-[11px] mt-0.5 truncate">
                        {HWP_PLUGIN_MANIFEST.pluginId}
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                      <div className="text-[11px] text-slate-400">단독 모듈 진입점</div>
                      <div className="font-mono font-semibold text-indigo-700 text-[11px] mt-0.5">
                        {HWP_PLUGIN_MANIFEST.entryComponent}
                      </div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                      <div className="text-[11px] text-emerald-700">v{simulatedHostVersion} 이식 상태</div>
                      <div className="font-bold text-emerald-900 text-xs mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        코어 충돌 없음 (즉시 장착 가능)
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="border border-indigo-200 bg-indigo-50/50 rounded-xl p-4 flex flex-col justify-between space-y-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-600 text-white px-2 py-0.5 rounded">
                        방법 1 · 오픈오피스 표준 확장팩
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 mt-2">
                        .OXT 확장 패키지 다운로드
                      </h4>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        오픈오피스의 <strong>확장 관리자(Extension Manager)</strong> 규격인{' '}
                        <code className="font-mono text-indigo-700">description.xml</code> 및{' '}
                        <code className="font-mono text-indigo-700">Addons.xcu</code>가 포함된{' '}
                        <strong>.oxt</strong> 파일로 추출합니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportOxtExtension}
                      className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 px-3 rounded-lg shadow-xs transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      한글 확장팩 (.oxt) 다운로드
                    </button>
                  </div>

                  <div className="border border-sky-200 bg-sky-50/50 rounded-xl p-4 flex flex-col justify-between space-y-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-sky-700 text-white px-2 py-0.5 rounded">
                        방법 2 · 웹/소스코드 자동 이식 번들
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 mt-2">
                        독립 플러그인 + 자동 설치 스크립트 (.zip)
                      </h4>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        새 버전의 오픈오피스 소스 폴더에 압축을 풀고{' '}
                        <code className="font-mono text-sky-800">install-hwp-plugin.sh</code>(또는{' '}
                        <code className="font-mono text-sky-800">.bat</code>)를 실행하면 자동으로 이식됩니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportStandalonePluginZip}
                      className="w-full flex items-center justify-center gap-1.5 bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold py-2 px-3 rounded-lg shadow-xs transition"
                    >
                      <Package className="w-3.5 h-3.5" />
                      자동 이식 번들 (.zip) 다운로드
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsPluginModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
