import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileText,
  FileCode2,
  Table,
  Presentation,
  PenTool,
  Sigma,
  Home,
  Download,
  Plus,
  Trash2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Play,
  Square,
  Circle,
  FolderOpen,
  Search,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Star,
  Folder,
  FolderPlus,
  RotateCcw,
  RotateCw,
  History,
  Package,
  Upload,
  Layers,
  BookOpen,
  Check,
  GitBranch,
  ExternalLink,
  Code2,
  Copy,
} from 'lucide-react';
import JSZip from 'jszip';
import HwpEditor from './components/HwpEditor';
import {
  HWP_PLUGIN_MANIFEST,
  UPGRADE_GUIDE_MARKDOWN,
  generateOxtManifestXml,
  generateOxtDescriptionXml,
  generateOxtAddonsXcu,
  generateFullOpenOfficeWithHwpStandaloneHtml,
} from './plugins/hwp-extension/pluginManifest';
import {
  createFullDownloadZipBlob,
  generateWindowsInstallBat,
  generateManualInstallBat,
  MANUAL_INSTALL_GUIDE_TEXT,
  APACHE_OPENOFFICE_OFFICIAL_REPO_URL,
  APACHE_OPENOFFICE_AOO41X_ZIP_URL,
  APACHE_OPENOFFICE_TRUNK_ZIP_URL,
  APACHE_OPENOFFICE_SOURCE_MIRRORS_URL,
  APACHE_OPENOFFICE_SOURCE_INTEGRATION_GUIDE_TEXT,
  generateSetupOpenOfficeHwpRepoBat,
  generateFetchApacheOpenOfficeBat,
  generateBuildOxtBat,
} from './plugins/hwp-extension/fullProjectExporter';
import { jsPDF } from 'jspdf';

type AppMode = 'start' | 'writer' | 'hwp' | 'calc' | 'impress' | 'draw' | 'math';

interface RecentDoc {
  id: string;
  title: string;
  type: Exclude<AppMode, 'start'>;
  updatedAt: string;
  extension: string;
}

interface Slide {
  id: string;
  title: string;
  subtitle: string;
  bullets: string[];
  notes: string;
  theme: 'ocean' | 'slate' | 'emerald' | 'amber';
}

interface DrawShape {
  id: string;
  type: 'rect' | 'circle' | 'line' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  label?: string;
}

interface MathFavorite {
  id: string;
  name: string;
  code: string;
  folder: string;
  createdAt: string;
}

interface MathHistoryEntry {
  id: string;
  formula: string;
  actionLabel: string;
  timestamp: string;
}

interface BatchFormulaItem {
  id: string;
  title: string;
  formula: string;
  rendered: string;
  latex: string;
}

const DEFAULT_BATCH_STARMATH_TEXT = `# 1. 가우스 표준정규분포 확률밀도함수
f(x) = {1} over {sigma sqrt{2 %pi}} e^{- {{(x - %mu)^2} over {2 %sigma^2}}}

# 2. 이차방정식 근의 공식 (Quadratic Formula)
x = {-b +- sqrt{b^2 - 4ac}} over {2a}

# 3. 스톡스 정리 (Stokes' Theorem)
oint_{%partial S} F cdot dr = iint_{S} (nabla times F) cdot dS

# 4. 리만 제타 급수 (Basel Problem)
sum_{n=1}^{infinity} {1} over {n^2} = {%pi^2} over {6}

# 5. 오일러 항등식 (Euler's Identity)
e^{i %pi} + 1 = 0`;

function formatStarMathToNotation(formula: string): string {
  return formula
    .replace(/%pi/g, 'π')
    .replace(/%sigma/g, 'σ')
    .replace(/sigma/g, 'σ')
    .replace(/%mu/g, 'μ')
    .replace(/%alpha/g, 'α')
    .replace(/%beta/g, 'β')
    .replace(/%gamma/g, 'γ')
    .replace(/%theta/g, 'θ')
    .replace(/%lambda/g, 'λ')
    .replace(/%omega/g, 'ω')
    .replace(/%Delta/g, 'Δ')
    .replace(/%Sigma/g, 'Σ')
    .replace(/%Omega/g, 'Ω')
    .replace(/\binfinity\b/g, '∞')
    .replace(/\bpartial\b/g, '∂')
    .replace(/\bnabla\b/g, '∇')
    .replace(/\biint\b/g, '∬')
    .replace(/\boint\b/g, '∮')
    .replace(/\btimes\b/g, '×')
    .replace(/\bdiv\b/g, '÷')
    .replace(/\bapprox\b/g, '≈')
    .replace(/\btoward\b/g, '→')
    .replace(/\bin\b/g, '∈')
    .replace(/\bsubset\b/g, '⊂')
    .replace(/\+-/g, '±')
    .replace(/-\+/g, '∓')
    .replace(/<>/g, '≠')
    .replace(/<=/g, '≤')
    .replace(/>=/g, '≥')
    .replace(/sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\{([^}]+)\}\s+over\s+\{([^}]+)\}/g, '($1) / ($2)')
    .replace(/int_\{([^}]+)\}\^\{([^}]+)\}/g, '∫[$1 → $2]')
    .replace(/sum_\{([^}]+)\}\^\{([^}]+)\}/g, '∑[$1 .. $2]')
    .replace(/lim_\{([^}]+)\}/g, 'lim[$1]')
    .replace(/([{}])/g, '');
}

function convertStarMathToLatex(formula: string): string {
  if (!formula.trim()) return '';
  let latex = formula;
  const overPattern = /\{([^{}]+)\}\s+over\s+\{([^{}]+)\}/g;
  let safety = 0;
  while (overPattern.test(latex) && safety < 10) {
    latex = latex.replace(overPattern, '\\frac{$1}{$2}');
    safety += 1;
  }
  latex = latex.replace(/(\S+)\s+over\s+(\S+)/g, '\\frac{$1}{$2}');

  return latex
    .replace(/\bsqrt\s*\{/g, '\\sqrt{')
    .replace(/\biint\b/g, '\\iint')
    .replace(/\boint\b/g, '\\oint')
    .replace(/\bint\b/g, '\\int')
    .replace(/\bsum\b/g, '\\sum')
    .replace(/\bprod\b/g, '\\prod')
    .replace(/\blim\b/g, '\\lim')
    .replace(/%pi\b/g, '\\pi')
    .replace(/%sigma\b/g, '\\sigma')
    .replace(/\bsigma\b/g, '\\sigma')
    .replace(/%mu\b/g, '\\mu')
    .replace(/%alpha\b/g, '\\alpha')
    .replace(/%beta\b/g, '\\beta')
    .replace(/%gamma\b/g, '\\gamma')
    .replace(/%theta\b/g, '\\theta')
    .replace(/%lambda\b/g, '\\lambda')
    .replace(/%omega\b/g, '\\omega')
    .replace(/%Delta\b/g, '\\Delta')
    .replace(/%Sigma\b/g, '\\Sigma')
    .replace(/%Omega\b/g, '\\Omega')
    .replace(/\binfinity\b/g, '\\infty')
    .replace(/%partial\b/g, '\\partial')
    .replace(/\bpartial\b/g, '\\partial')
    .replace(/\bnabla\b/g, '\\nabla')
    .replace(/\btimes\b/g, '\\times')
    .replace(/\bdiv\b/g, '\\div')
    .replace(/\bcdot\b/g, '\\cdot')
    .replace(/\bapprox\b/g, '\\approx')
    .replace(/\btoward\b/g, '\\to')
    .replace(/\bin\b/g, '\\in')
    .replace(/\bsubset\b/g, '\\subset')
    .replace(/\+-/g, '\\pm')
    .replace(/-\+/g, '\\mp')
    .replace(/<>/g, '\\neq')
    .replace(/<=/g, '\\leq')
    .replace(/>=/g, '\\geq');
}

function parseBatchStarMathText(rawText: string): BatchFormulaItem[] {
  const lines = rawText.split(/\r?\n/);
  const items: BatchFormulaItem[] = [];
  let pendingTitle = '';

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
      pendingTitle = trimmed.replace(/^(#|\/\/)\s*/, '').trim();
      continue;
    }

    let title = pendingTitle;
    let formula = trimmed;

    if (trimmed.includes('::')) {
      const parts = trimmed.split('::');
      const left = parts[0]?.trim();
      const right = parts.slice(1).join('::').trim();
      if (left && right) {
        title = left;
        formula = right;
      }
    }

    const index = items.length + 1;
    items.push({
      id: `batch-formula-${index}`,
      title: title || `StarMath Formula #${index}`,
      formula,
      rendered: formatStarMathToNotation(formula),
      latex: convertStarMathToLatex(formula),
    });
    pendingTitle = '';
  }

  return items;
}

const INITIAL_MATH_FORMULA =
  'f(x) = {1} over {sigma sqrt{2 %pi}} e^{- {{(x - %mu)^2} over {2 %sigma^2}}}';

const INITIAL_MATH_FOLDERS: string[] = ['물리학', '통계학', '기하학'];

const INITIAL_MATH_FAVORITES: MathFavorite[] = [
  {
    id: 'fav-1',
    name: '피타고라스 정리',
    code: 'a^{2} + b^{2} = c^{2}',
    folder: '기하학',
    createdAt: '기본 즐겨찾기',
  },
  {
    id: 'fav-2',
    name: '표준정규분포 확률밀도함수',
    code: 'f(x) = {1} over {sigma sqrt{2 %pi}} e^{- {{(x - %mu)^2} over {2 %sigma^2}}}',
    folder: '통계학',
    createdAt: '기본 즐겨찾기',
  },
  {
    id: 'fav-3',
    name: '스톡스 정리 (Stokes Theorem)',
    code: 'oint_{%partial S} F cdot dr = iint_{S} (nabla times F) cdot dS',
    folder: '물리학',
    createdAt: '기본 즐겨찾기',
  },
];

interface StarMathSuggestion {
  keyword: string;
  snippet: string;
  symbol: string;
  label: string;
  category: string;
}

const STARMATH_AUTOCOMPLETE_ITEMS: StarMathSuggestion[] = [
  { keyword: 'sum', snippet: 'sum_{n=1}^{infinity} ', symbol: '∑', label: '급수 합 (Sigma Summation)', category: '미적분/구조' },
  { keyword: 'sqrt', snippet: 'sqrt{x}', symbol: '√', label: '제곱근 (Square Root)', category: '미적분/구조' },
  { keyword: 'int', snippet: 'int_{a}^{b} ', symbol: '∫', label: '정적분 (Definite Integral)', category: '미적분/구조' },
  { keyword: 'iint', snippet: 'iint_{D} ', symbol: '∬', label: '이중적분 (Double Integral)', category: '미적분/구조' },
  { keyword: 'oint', snippet: 'oint_{C} ', symbol: '∮', label: '선적분 / 폐곡선 적분 (Contour Integral)', category: '미적분/구조' },
  { keyword: 'over', snippet: '{a} over {b}', symbol: 'a/b', label: '분수 구조 (Fraction)', category: '미적분/구조' },
  { keyword: 'lim', snippet: 'lim_{x toward 0} ', symbol: 'lim', label: '극한 (Limit)', category: '미적분/구조' },
  { keyword: 'prod', snippet: 'prod_{i=1}^{n} ', symbol: '∏', label: '연속 곱 (Product)', category: '미적분/구조' },
  { keyword: 'infinity', snippet: 'infinity', symbol: '∞', label: '무한대 (Infinity)', category: '기호/연산' },
  { keyword: 'partial', snippet: 'partial', symbol: '∂', label: '편미분 기호 (Partial Derivative)', category: '미적분/구조' },
  { keyword: 'nabla', snippet: 'nabla', symbol: '∇', label: '나블라 / 그래디언트 (Nabla)', category: '미적분/구조' },
  { keyword: 'toward', snippet: 'toward', symbol: '→', label: '화살표 / 수렴 방향 (Toward)', category: '기호/연산' },
  { keyword: 'approx', snippet: 'approx', symbol: '≈', label: '근사값 (Approximately Equal)', category: '기호/연산' },
  { keyword: 'times', snippet: 'times', symbol: '×', label: '곱셈 / 외적 (Times)', category: '기호/연산' },
  { keyword: 'div', snippet: 'div', symbol: '÷', label: '나눗셈 (Division)', category: '기호/연산' },
  { keyword: 'cdot', snippet: 'cdot', symbol: '·', label: '가운데점 / 내적 (Dot Product)', category: '기호/연산' },
  { keyword: 'in', snippet: 'in', symbol: '∈', label: '원소 포함 (Element Of)', category: '집합/논리' },
  { keyword: 'subset', snippet: 'subset', symbol: '⊂', label: '부분집합 (Subset)', category: '집합/논리' },
  { keyword: '%pi', snippet: '%pi', symbol: 'π', label: '원주율 파이 (Pi)', category: '그리스 문자' },
  { keyword: 'pi', snippet: '%pi', symbol: 'π', label: '원주율 파이 (%pi 변환)', category: '그리스 문자' },
  { keyword: '%sigma', snippet: '%sigma', symbol: 'σ', label: '시그마 소문자 (Sigma)', category: '그리스 문자' },
  { keyword: 'sigma', snippet: '%sigma', symbol: 'σ', label: '시그마 소문자 (%sigma)', category: '그리스 문자' },
  { keyword: '%Sigma', snippet: '%Sigma', symbol: 'Σ', label: '시그마 대문자 (Capital Sigma)', category: '그리스 문자' },
  { keyword: '%mu', snippet: '%mu', symbol: 'μ', label: '뮤 / 평균 (Mu)', category: '그리스 문자' },
  { keyword: 'mu', snippet: '%mu', symbol: 'μ', label: '뮤 / 평균 (%mu)', category: '그리스 문자' },
  { keyword: '%alpha', snippet: '%alpha', symbol: 'α', label: '알파 (Alpha)', category: '그리스 문자' },
  { keyword: 'alpha', snippet: '%alpha', symbol: 'α', label: '알파 (%alpha)', category: '그리스 문자' },
  { keyword: '%beta', snippet: '%beta', symbol: 'β', label: '베타 (Beta)', category: '그리스 문자' },
  { keyword: 'beta', snippet: '%beta', symbol: 'β', label: '베타 (%beta)', category: '그리스 문자' },
  { keyword: '%gamma', snippet: '%gamma', symbol: 'γ', label: '감마 (Gamma)', category: '그리스 문자' },
  { keyword: 'gamma', snippet: '%gamma', symbol: 'γ', label: '감마 (%gamma)', category: '그리스 문자' },
  { keyword: '%theta', snippet: '%theta', symbol: 'θ', label: '세타 (Theta)', category: '그리스 문자' },
  { keyword: 'theta', snippet: '%theta', symbol: 'θ', label: '세타 (%theta)', category: '그리스 문자' },
  { keyword: '%lambda', snippet: '%lambda', symbol: 'λ', label: '람다 / 고유값 (Lambda)', category: '그리스 문자' },
  { keyword: 'lambda', snippet: '%lambda', symbol: 'λ', label: '람다 (%lambda)', category: '그리스 문자' },
  { keyword: '%omega', snippet: '%omega', symbol: 'ω', label: '오메가 소문자 (Omega)', category: '그리스 문자' },
  { keyword: 'omega', snippet: '%omega', symbol: 'ω', label: '오메가 (%omega)', category: '그리스 문자' },
  { keyword: '%Delta', snippet: '%Delta', symbol: 'Δ', label: '델타 변화량 (Capital Delta)', category: '그리스 문자' },
  { keyword: 'Delta', snippet: '%Delta', symbol: 'Δ', label: '델타 변화량 (%Delta)', category: '그리스 문자' },
  { keyword: '%Omega', snippet: '%Omega', symbol: 'Ω', label: '오메가 대문자 (Capital Omega)', category: '그리스 문자' },
];

const INITIAL_DOCS: RecentDoc[] = [
  { id: '0', title: '2026년도_오픈소스_문서표준_도입계획', type: 'hwp', updatedAt: '방금 전', extension: '.hwpx' },
  { id: '1', title: '정보화사업_추진실적_공문서', type: 'hwp', updatedAt: '오늘, 오전 11:15', extension: '.hwp' },
  { id: '2', title: 'Apache_OpenOffice_4.1.17_Release_Notes', type: 'writer', updatedAt: '오늘, 오전 10:42', extension: '.odt' },
  { id: '3', title: 'Q4_Budget_And_Resource_Allocation', type: 'calc', updatedAt: '어제, 오후 4:15', extension: '.ods' },
  { id: '4', title: 'OpenDocument_Architecture_Overview', type: 'impress', updatedAt: '10월 28일', extension: '.odp' },
  { id: '5', title: 'UNO_Component_System_Diagram', type: 'draw', updatedAt: '10월 24일', extension: '.odg' },
];

const INITIAL_CELLS: Record<string, string> = {
  A1: 'Component',
  B1: 'Q1 Downloads',
  C1: 'Q2 Downloads',
  D1: 'Total',
  A2: 'Writer',
  B2: '142000',
  C2: '158000',
  D2: '=B2+C2',
  A3: 'Calc',
  B3: '98000',
  C3: '112000',
  D3: '=B3+C3',
  A4: 'Impress',
  B4: '64000',
  C4: '71000',
  D4: '=B4+C4',
  A5: 'Draw & Math',
  B5: '41000',
  C5: '49000',
  D5: '=B5+C5',
  A6: 'Total Suite',
  B6: '=SUM(B2:B5)',
  C6: '=SUM(C2:C5)',
  D6: '=SUM(D2:D5)',
  A7: 'Average',
  B7: '=AVERAGE(B2:B5)',
  C7: '=AVERAGE(C2:C5)',
  D7: '=AVERAGE(D2:D5)',
};

const INITIAL_SLIDES: Slide[] = [
  {
    id: 's1',
    title: 'Apache OpenOffice® Productivity Suite',
    subtitle: 'Open-Standard Office Suite for Word Processing, Spreadsheets & Presentations',
    bullets: [
      'Native OASIS OpenDocument Format (ODF) & KS X 6101 (.hwpx / .hwp) support',
      'Cross-platform architecture powered by UNO component model',
      'Integrated Writer, HWP/HWPX, Calc, Impress, Draw, and Math modules',
    ],
    notes: 'Welcome the audience and highlight the 20+ year heritage of OpenOffice.',
    theme: 'ocean',
  },
  {
    id: 's2',
    title: 'Core Architecture & Modules',
    subtitle: 'Modular Design from the Apache OpenOffice Source Tree',
    bullets: [
      'VCL (Visual Class Library) for cross-platform rendering',
      'Universal Network Objects (UNO) for language-independent APIs',
      'CoinMP & Hunspell integration for solver and spellcheck capabilities',
    ],
    notes: 'Discuss how the original C++ codebase separates UI from document models.',
    theme: 'slate',
  },
  {
    id: 's3',
    title: 'OpenDocument (ISO/IEC 26300) & HWPX (KS X 6101)',
    subtitle: 'Future-Proof Document Interoperability',
    bullets: [
      '.odt, .hwp, .hwpx for structured text & Korean official documents',
      '.ods for financial & scientific spreadsheets',
      '.odp & .odg for presentations and vector graphics',
    ],
    notes: 'Conclude with open standards benefits.',
    theme: 'emerald',
  },
];

const INITIAL_SHAPES: DrawShape[] = [
  { id: 'sh1', type: 'rect', x: 70, y: 70, width: 170, height: 70, color: '#0284c7', label: 'Application Layer' },
  { id: 'sh2', type: 'rect', x: 300, y: 70, width: 170, height: 70, color: '#0d9488', label: 'UNO Framework' },
  { id: 'sh3', type: 'rect', x: 185, y: 200, width: 170, height: 70, color: '#4f46e5', label: 'VCL Graphics Engine' },
  { id: 'sh4', type: 'circle', x: 540, y: 135, width: 110, height: 110, color: '#d97706', label: 'ODF / HWPX XML' },
];

const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const ROWS = Array.from({ length: 16 }, (_, i) => i + 1);

export default function App() {
  const [mode, setMode] = useState<AppMode>('start');
  const [statusMessage, setStatusMessage] = useState<string>('준비 완료 — Apache OpenOffice 4.1.17 Web Suite');
  const [hwpFilename, setHwpFilename] = useState<string>('2026년도_오픈소스_문서표준_도입계획.hwpx');

  // Writer state
  const [docTitle, setDocTitle] = useState('Apache_OpenOffice_4.1.17_Release_Notes.odt');
  const [writerContent, setWriterContent] = useState(
    `Apache OpenOffice 4.1.17 — Architecture & Overview\n\nApache OpenOffice (AOO) is a full-featured office productivity suite based on open standards. It is the continuation of the OpenOffice.org project and provides native support for the OASIS OpenDocument Format (ISO/IEC 26300).\n\n1. Core Modules Included\n• Writer — A word processor for creating letters, books, reports, newsletters, and brochures.\n• 한글 문서 (.hwp / .hwpx) — Korean Hangul word processor supporting KS X 6101 HWPX & HWP 5.0 documents.\n• Calc — A feature-packed spreadsheet with natural-language formulas, scenario managers, and data analysis.\n• Impress — The fastest, most powerful way to create effective multimedia presentations.\n• Draw — Produces everything from simple diagrams and flowcharts to 3D artwork.\n• Math — Lets you create mathematical equations with a graphic user interface or by directly typing StarMath formulas.\n\n2. Technical Highlights\nBuilt atop the Universal Network Objects (UNO) component model and the Visual Class Library (VCL), OpenOffice separates document storage, layout rendering, and accessibility bridges into clean, modular subsystems.`
  );
  const [fontFamily, setFontFamily] = useState<'sans' | 'serif' | 'mono'>('serif');
  const [fontSize, setFontSize] = useState<number>(16);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');
  const [searchQuery, setSearchQuery] = useState('');

  // Calc state
  const [cells, setCells] = useState<Record<string, string>>(INITIAL_CELLS);
  const [selectedCell, setSelectedCell] = useState<string>('D6');

  // Impress state
  const [slides, setSlides] = useState<Slide[]>(INITIAL_SLIDES);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isPresenting, setIsPresenting] = useState(false);

  // Draw state
  const [shapes, setShapes] = useState<DrawShape[]>(INITIAL_SHAPES);
  const [selectedShapeId, setSelectedShapeId] = useState<string>('sh1');

  // Math state
  const [mathFormula, setMathFormula] = useState<string>(INITIAL_MATH_FORMULA);
  const [mathHistory, setMathHistory] = useState<MathHistoryEntry[]>([
    {
      id: 'hist-initial',
      formula: INITIAL_MATH_FORMULA,
      actionLabel: '초기 수식 로드 (가우스 정규분포)',
      timestamp: '시작 상태',
    },
  ]);
  const [mathHistoryIndex, setMathHistoryIndex] = useState<number>(0);
  const [mathHistorySearchQuery, setMathHistorySearchQuery] = useState<string>('');
  const lastTypingHistoryTimeRef = useRef<number>(0);
  const [mathPreviewAlign, setMathPreviewAlign] = useState<'left' | 'center' | 'right'>('center');
  const [mathPaddingY, setMathPaddingY] = useState<number>(40); // 상하 여백 (px, step 8)
  const [mathPaddingX, setMathPaddingX] = useState<number>(32); // 좌우 여백 (px, step 8)
  const [showLatexPreview, setShowLatexPreview] = useState<boolean>(false);
  const [mathPdfTitle, setMathPdfTitle] = useState<string>(
    'Apache OpenOffice 4.1.17 Math — 수식 문서'
  );
  const [isMathPdfPromptOpen, setIsMathPdfPromptOpen] = useState<boolean>(false);
  const [isMathExportMenuOpen, setIsMathExportMenuOpen] = useState<boolean>(false);
  const [isMathBatchModalOpen, setIsMathBatchModalOpen] = useState<boolean>(false);
  const [mathBatchRawText, setMathBatchRawText] = useState<string>(DEFAULT_BATCH_STARMATH_TEXT);
  const [mathBatchUploadedFileName, setMathBatchUploadedFileName] = useState<string>(
    'sample_starmath_formulas.txt'
  );
  const [mathBatchDocTitle, setMathBatchDocTitle] = useState<string>(
    'Apache OpenOffice 4.1.17 Math — 다중 수식 일괄 변환 문서 (Batch PDF)'
  );
  const mathBatchFileInputRef = useRef<HTMLInputElement | null>(null);
  const [mathFolders, setMathFolders] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('aoo_math_folders');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_MATH_FOLDERS;
  });
  const [activeFavoriteFolder, setActiveFavoriteFolder] = useState<string>('전체');
  const [selectedSaveFolder, setSelectedSaveFolder] = useState<string>('물리학');
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [mathFavorites, setMathFavorites] = useState<MathFavorite[]>(() => {
    try {
      const saved = localStorage.getItem('aoo_math_favorites');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: MathFavorite) => ({
            ...item,
            folder: item.folder || '물리학',
          }));
        }
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_MATH_FAVORITES;
  });
  const [newFavoriteName, setNewFavoriteName] = useState<string>('');
  const [favoriteSearchQuery, setFavoriteSearchQuery] = useState<string>('');
  const [mathAutocompleteQuery, setMathAutocompleteQuery] = useState<string>('');
  const [mathAutocompleteRange, setMathAutocompleteRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [mathAutocompleteIndex, setMathAutocompleteIndex] = useState<number>(0);
  const [isMathAutocompleteOpen, setIsMathAutocompleteOpen] = useState<boolean>(false);
  const mathTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Record formula changes into Math work history and support Undo / Redo
  const updateMathFormulaWithHistory = (
    nextFormula: string,
    actionLabel: string,
    coalesceTyping = false
  ) => {
    setMathFormula(nextFormula);

    const now = Date.now();
    const timeStr = new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    setMathHistory((prevHistory) => {
      const currentEntry = prevHistory[mathHistoryIndex];
      if (currentEntry && currentEntry.formula === nextFormula) {
        return prevHistory;
      }

      const sliced = prevHistory.slice(0, mathHistoryIndex + 1);

      // Coalesce rapid consecutive keystrokes within 900ms into the latest typing entry
      if (
        coalesceTyping &&
        sliced.length > 1 &&
        sliced[sliced.length - 1].actionLabel === '수식 직접 타이핑' &&
        now - lastTypingHistoryTimeRef.current < 900
      ) {
        lastTypingHistoryTimeRef.current = now;
        const updatedLast: MathHistoryEntry = {
          ...sliced[sliced.length - 1],
          formula: nextFormula,
          timestamp: timeStr,
        };
        return [...sliced.slice(0, -1), updatedLast];
      }

      if (coalesceTyping) {
        lastTypingHistoryTimeRef.current = now;
      } else {
        lastTypingHistoryTimeRef.current = 0;
      }

      const newEntry: MathHistoryEntry = {
        id: `hist-${now}-${Math.random().toString(36).slice(2, 6)}`,
        formula: nextFormula,
        actionLabel,
        timestamp: timeStr,
      };
      const nextList = [...sliced, newEntry].slice(-40); // Keep up to 40 steps
      setMathHistoryIndex(nextList.length - 1);
      return nextList;
    });
  };

  const canMathUndo = mathHistoryIndex > 0;
  const canMathRedo = mathHistoryIndex < mathHistory.length - 1;

  const handleMathUndo = () => {
    if (mathHistoryIndex <= 0) {
      setStatusMessage('더 이상 되돌릴(Undo) 이전 작업 내역이 없습니다.');
      return;
    }
    const prevIdx = mathHistoryIndex - 1;
    const target = mathHistory[prevIdx];
    if (target) {
      setMathHistoryIndex(prevIdx);
      setMathFormula(target.formula);
      setIsMathAutocompleteOpen(false);
      setStatusMessage(
        `실행 취소(Undo): [${target.actionLabel}] 상태로 복원됨 (${prevIdx + 1}/${mathHistory.length})`
      );
    }
  };

  const handleMathRedo = () => {
    if (mathHistoryIndex >= mathHistory.length - 1) {
      setStatusMessage('더 이상 다시 실행할(Redo) 다음 작업 내역이 없습니다.');
      return;
    }
    const nextIdx = mathHistoryIndex + 1;
    const target = mathHistory[nextIdx];
    if (target) {
      setMathHistoryIndex(nextIdx);
      setMathFormula(target.formula);
      setIsMathAutocompleteOpen(false);
      setStatusMessage(
        `다시 실행(Redo): [${target.actionLabel}] 상태로 복원됨 (${nextIdx + 1}/${mathHistory.length})`
      );
    }
  };

  const handleJumpToMathHistory = (targetIdx: number) => {
    const target = mathHistory[targetIdx];
    if (!target) return;
    setMathHistoryIndex(targetIdx);
    setMathFormula(target.formula);
    setIsMathAutocompleteOpen(false);
    setStatusMessage(
      `작업 히스토리 이동: #${targetIdx + 1} [${target.actionLabel}] 상태로 되돌렸습니다.`
    );
  };

  const filteredMathHistory = useMemo(() => {
    const q = mathHistorySearchQuery.trim().toLowerCase();
    const indexed = mathHistory.map((entry, actualIdx) => ({ entry, actualIdx })).reverse();
    if (!q) return indexed;
    return indexed.filter(({ entry, actualIdx }) => {
      const stepLabel = `#${actualIdx + 1}`;
      return (
        entry.actionLabel.toLowerCase().includes(q) ||
        entry.formula.toLowerCase().includes(q) ||
        entry.timestamp.toLowerCase().includes(q) ||
        stepLabel.includes(q)
      );
    });
  }, [mathHistory, mathHistorySearchQuery]);

  const filteredMathFavorites = useMemo(() => {
    const q = favoriteSearchQuery.trim().toLowerCase();
    return mathFavorites.filter((fav) => {
      const matchesFolder =
        activeFavoriteFolder === '전체' || fav.folder === activeFavoriteFolder;
      if (!matchesFolder) return false;
      if (!q) return true;
      return (
        fav.name.toLowerCase().includes(q) ||
        fav.code.toLowerCase().includes(q) ||
        fav.folder.toLowerCase().includes(q)
      );
    });
  }, [mathFavorites, activeFavoriteFolder, favoriteSearchQuery]);

  const saveFoldersToStorage = (nextFolders: string[]) => {
    setMathFolders(nextFolders);
    try {
      localStorage.setItem('aoo_math_folders', JSON.stringify(nextFolders));
    } catch {
      // ignore storage errors
    }
  };

  const saveFavoritesToStorage = (nextList: MathFavorite[]) => {
    setMathFavorites(nextList);
    try {
      localStorage.setItem('aoo_math_favorites', JSON.stringify(nextList));
    } catch {
      // ignore storage errors
    }
  };

  const handleCreateMathFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setStatusMessage('생성할 폴더 이름을 입력해주세요.');
      return;
    }
    if (trimmed === '전체' || mathFolders.includes(trimmed)) {
      setStatusMessage(`'${trimmed}' 폴더가 이미 존재합니다.`);
      return;
    }
    const nextFolders = [...mathFolders, trimmed];
    saveFoldersToStorage(nextFolders);
    setSelectedSaveFolder(trimmed);
    setActiveFavoriteFolder(trimmed);
    setNewFolderName('');
    setStatusMessage(`새 즐겨찾기 폴더 '${trimmed}'을(를) 생성했습니다.`);
  };

  const handleDeleteMathFolder = (folderToDelete: string) => {
    if (mathFolders.length <= 1) {
      setStatusMessage('최소 1개의 폴더는 유지되어야 합니다.');
      return;
    }
    const remainingFolders = mathFolders.filter((f) => f !== folderToDelete);
    const fallbackFolder = remainingFolders[0];
    saveFoldersToStorage(remainingFolders);

    const updatedFavs = mathFavorites.map((fav) =>
      fav.folder === folderToDelete ? { ...fav, folder: fallbackFolder } : fav
    );
    saveFavoritesToStorage(updatedFavs);

    if (activeFavoriteFolder === folderToDelete) {
      setActiveFavoriteFolder('전체');
    }
    if (selectedSaveFolder === folderToDelete) {
      setSelectedSaveFolder(fallbackFolder);
    }
    setStatusMessage(
      `'${folderToDelete}' 폴더를 삭제하고 내부 수식을 '${fallbackFolder}' 폴더로 이동했습니다.`
    );
  };

  const handleMoveFavoriteFolder = (favId: string, targetFolder: string) => {
    const updated = mathFavorites.map((fav) =>
      fav.id === favId ? { ...fav, folder: targetFolder } : fav
    );
    saveFavoritesToStorage(updated);
    setStatusMessage(`수식을 '${targetFolder}' 폴더로 이동했습니다.`);
  };

  const handleAddMathFavorite = () => {
    const trimmedFormula = mathFormula.trim();
    if (!trimmedFormula) {
      setStatusMessage('즐겨찾기에 저장할 수식을 먼저 입력해주세요.');
      return;
    }
    const targetFolder = selectedSaveFolder || mathFolders[0] || '물리학';
    const label =
      newFavoriteName.trim() || `저장된 수식 #${mathFavorites.length + 1}`;
    const newFav: MathFavorite = {
      id: `fav-${Date.now()}`,
      name: label,
      code: trimmedFormula,
      folder: targetFolder,
      createdAt: new Date().toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    const updated = [newFav, ...mathFavorites];
    saveFavoritesToStorage(updated);
    setNewFavoriteName('');
    setStatusMessage(`'${targetFolder}' 폴더에 '${label}' 수식을 저장했습니다.`);
  };

  const handleRemoveMathFavorite = (id: string, name: string) => {
    const updated = mathFavorites.filter((item) => item.id !== id);
    saveFavoritesToStorage(updated);
    setStatusMessage(`즐겨찾기에서 '${name}' 수식을 삭제했습니다.`);
  };

  const insertMathSymbol = (snippet: string, label: string) => {
    const el = mathTextareaRef.current;
    if (el) {
      const start = el.selectionStart ?? mathFormula.length;
      const end = el.selectionEnd ?? mathFormula.length;
      const next = mathFormula.slice(0, start) + snippet + mathFormula.slice(end);
      updateMathFormulaWithHistory(next, `기호 삽입: ${label}`);
      setStatusMessage(`수식 기호 삽입됨: ${label} (${snippet.trim()})`);
      requestAnimationFrame(() => {
        el.focus();
        const cursor = start + snippet.length;
        el.setSelectionRange(cursor, cursor);
      });
    } else {
      const next = `${mathFormula} ${snippet}`;
      updateMathFormulaWithHistory(next, `기호 삽입: ${label}`);
      setStatusMessage(`수식 기호 삽입됨: ${label}`);
    }
  };

  // Helper to evaluate Calc formulas
  const evaluateCell = (cellId: string, visited = new Set<string>()): string => {
    if (visited.has(cellId)) return '#REF!';
    const raw = cells[cellId] ?? '';
    if (!raw.startsWith('=')) return raw;

    visited.add(cellId);
    const expr = raw.slice(1).trim().toUpperCase();

    const expandRange = (rangeStr: string): number[] => {
      const [start, end] = rangeStr.split(':');
      if (!start || !end) return [];
      const startCol = start.charCodeAt(0);
      const endCol = end.charCodeAt(0);
      const startRow = parseInt(start.slice(1), 10);
      const endRow = parseInt(end.slice(1), 10);
      const vals: number[] = [];
      for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
        for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
          const id = `${String.fromCharCode(c)}${r}`;
          const v = parseFloat(evaluateCell(id, new Set(visited)));
          if (!Number.isNaN(v)) vals.push(v);
        }
      }
      return vals;
    };

    const sumMatch = expr.match(/^SUM\(([A-Z]\d+:[A-Z]\d+)\)$/);
    if (sumMatch) {
      const nums = expandRange(sumMatch[1]);
      return nums.reduce((a, b) => a + b, 0).toString();
    }

    const avgMatch = expr.match(/^AVERAGE\(([A-Z]\d+:[A-Z]\d+)\)$/);
    if (avgMatch) {
      const nums = expandRange(avgMatch[1]);
      return nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(0) : '0';
    }

    const maxMatch = expr.match(/^MAX\(([A-Z]\d+:[A-Z]\d+)\)$/);
    if (maxMatch) {
      const nums = expandRange(maxMatch[1]);
      return nums.length ? Math.max(...nums).toString() : '0';
    }

    const minMatch = expr.match(/^MIN\(([A-Z]\d+:[A-Z]\d+)\)$/);
    if (minMatch) {
      const nums = expandRange(minMatch[1]);
      return nums.length ? Math.min(...nums).toString() : '0';
    }

    try {
      const replaced = expr.replace(/[A-Z]\d+/g, (ref) => {
        const val = parseFloat(evaluateCell(ref, new Set(visited)));
        return Number.isNaN(val) ? '0' : val.toString();
      });
      if (/^[0-9+\-*/().\s]+$/.test(replaced)) {
        const result = Function(`"use strict"; return (${replaced})`)();
        return typeof result === 'number' && Number.isFinite(result) ? String(result) : '#ERR';
      }
      return '#NAME?';
    } catch {
      return '#ERR';
    }
  };

  // Word and character statistics for Writer
  const writerStats = useMemo(() => {
    const trimmed = writerContent.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = writerContent.length;
    const lines = writerContent.split('\n').length;
    return { words, chars, lines };
  }, [writerContent]);

  // Global download state & helper so any download in the app also provides a direct native <a download> button
  const [globalDownload, setGlobalDownload] = useState<{
    filename: string;
    url: string;
    sizeLabel: string;
    description: string;
  } | null>(null);

  // Pre-generated full download ZIP so the bright green <a download> button works on first click from page load
  const [readyFullZip, setReadyFullZip] = useState<{
    filename: string;
    url: string;
    sizeLabel: string;
  } | null>(null);

  // Manual Extension Installation Modal state
  const [isManualInstallModalOpen, setIsManualInstallModalOpen] = useState<boolean>(false);

  // Apache OpenOffice Official Source Integration Modal state
  const [isApacheSourceModalOpen, setIsApacheSourceModalOpen] = useState<boolean>(false);
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null);

  const handleDownloadSetupRepoBat = () => {
    const bat = generateSetupOpenOfficeHwpRepoBat('yjhone1/openoffice-hwp', 'master');
    const blob = new Blob([bat], { type: 'application/x-bat;charset=utf-8' });
    triggerGlobalDownload(
      blob,
      'setup-openoffice-hwp-repo.bat',
      '한글 확장팩 소스 및 CI/CD를 yjhone1/openoffice-hwp에 원클릭 푸시하는 도우미'
    );
    setStatusMessage('한글 확장팩 푸시 도우미(setup-openoffice-hwp-repo.bat)를 다운로드했습니다.');
  };

  const handleDownloadFetchAooBat = () => {
    const bat = generateFetchApacheOpenOfficeBat();
    const blob = new Blob([bat], { type: 'application/x-bat;charset=utf-8' });
    triggerGlobalDownload(
      blob,
      'fetch-apache-openoffice.bat',
      '아파치 공식 저장소(AOO41X) 최신 원본 소스 동적 복제 및 한글확장팩 연동 도우미'
    );
    setStatusMessage('아파치 공식 소스 복제 도우미(fetch-apache-openoffice.bat)를 다운로드했습니다.');
  };

  const handleDownloadBuildOxtBat = () => {
    const bat = generateBuildOxtBat();
    const blob = new Blob([bat], { type: 'application/x-bat;charset=utf-8' });
    triggerGlobalDownload(
      blob,
      'build-oxt.bat',
      'Apache OpenOffice 한글 확장팩(.oxt) 바이너리 빌드 도우미'
    );
    setStatusMessage('확장팩 빌드 스크립트(build-oxt.bat)를 다운로드했습니다.');
  };

  const handleDownloadApacheSourceGuide = () => {
    const blob = new Blob([APACHE_OPENOFFICE_SOURCE_INTEGRATION_GUIDE_TEXT], {
      type: 'text/plain;charset=utf-8',
    });
    triggerGlobalDownload(
      blob,
      '아파치_오픈오피스_연동_및_한글확장팩_푸시가이드.txt',
      '아파치 공식 소스 동적 복제 및 한글 확장팩 개발·푸시 상세 안내'
    );
    setStatusMessage('한글 확장팩 개발·푸시 가이드 문서를 다운로드했습니다.');
  };

  const copyToClipboard = (text: string, index: number) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedCodeIndex(index);
      setStatusMessage('명령어가 클립보드에 복사되었습니다.');
      setTimeout(() => setCopiedCodeIndex(null), 2500);
    }
  };

  useEffect(() => {
    let active = true;
    let createdUrl = '';
    createFullDownloadZipBlob()
      .then(({ blob, filename }) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        const sizeKb = Math.max(0.1, blob.size / 1024).toFixed(1);
        setReadyFullZip({
          filename,
          url: createdUrl,
          sizeLabel: `${sizeKb} KB`,
        });
      })
      .catch(() => {
        // ignore pre-generation errors
      });
    return () => {
      active = false;
      if (createdUrl) {
        try {
          URL.revokeObjectURL(createdUrl);
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const handleDownloadManualInstallGuide = () => {
    const blob = new Blob([MANUAL_INSTALL_GUIDE_TEXT], { type: 'text/plain;charset=utf-8' });
    triggerGlobalDownload(
      blob,
      '오픈오피스_한글확장팩_수동설치_안내.txt',
      '오픈오피스 데스크톱 한글 확장팩(.oxt) 수동 추가 방법 안내 문서'
    );
    setStatusMessage('수동 설치 안내 문서(오픈오피스_한글확장팩_수동설치_안내.txt)를 다운로드했습니다.');
  };

  const handleDownloadManualInstallBat = () => {
    const bat = generateManualInstallBat();
    const blob = new Blob([bat], { type: 'application/x-bat;charset=utf-8' });
    triggerGlobalDownload(
      blob,
      '수동_확장팩_설치_도우미.bat',
      '오픈오피스 확장 관리자 GUI를 열어주는 1클릭 수동 설치 배치파일'
    );
    setStatusMessage('수동 설치 도우미 배치파일(수동_확장팩_설치_도우미.bat)을 다운로드했습니다.');
  };

  const triggerGlobalDownload = (blob: Blob, filename: string, description: string) => {
    const url = URL.createObjectURL(blob);
    const sizeKb = Math.max(0.1, blob.size / 1024).toFixed(1);
    setGlobalDownload((prev) => {
      if (prev?.url) {
        try {
          URL.revokeObjectURL(prev.url);
        } catch {
          // ignore
        }
      }
      return {
        filename,
        url,
        sizeLabel: `${sizeKb} KB`,
        description,
      };
    });

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.className = 'hidden';
    document.body.appendChild(a);
    a.click();
    window.setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 500);
  };

  // Global 1-click download for Apache OpenOffice HWP Extension (.oxt)
  const handleGlobalDownloadOxt = async () => {
    const zip = new JSZip();
    zip.file('META-INF/manifest.xml', generateOxtManifestXml());
    zip.file('description.xml', generateOxtDescriptionXml('4.1.0'));
    zip.file('Addons.xcu', generateOxtAddonsXcu());
    zip.file('pluginManifest.json', JSON.stringify(HWP_PLUGIN_MANIFEST, null, 2));
    zip.file('UPGRADE_INTEGRATION_GUIDE.md', UPGRADE_GUIDE_MARKDOWN);

    const blob = await zip.generateAsync({ type: 'blob' });
    const outName = `Apache_OpenOffice_HWP_Extension_v${HWP_PLUGIN_MANIFEST.pluginVersion}.oxt`;
    triggerGlobalDownload(
      blob,
      outName,
      'Apache OpenOffice 전 버전 호환 한글(.hwp/.hwpx) 확장팩 (.oxt)'
    );
    setStatusMessage(`한글 확장팩(${outName}) 다운로드가 준비되었습니다.`);
  };

  // Global 1-click download for Portable HWP Plugin Package (.zip)
  const handleGlobalDownloadPortableZip = async () => {
    const zip = new JSZip();
    zip.file('UPGRADE_INTEGRATION_GUIDE.md', UPGRADE_GUIDE_MARKDOWN);
    zip.file(
      'src/plugins/hwp-extension/pluginManifest.json',
      JSON.stringify(HWP_PLUGIN_MANIFEST, null, 2)
    );
    const shScript = `#!/usr/bin/env bash
TARGET_DIR="\${1:-.}"
mkdir -p "\$TARGET_DIR/src/components" "\$TARGET_DIR/src/plugins/hwp-extension"
cp -f src/plugins/hwp-extension/pluginManifest.json "\$TARGET_DIR/src/plugins/hwp-extension/"
(cd "\$TARGET_DIR" && npm install jszip)
echo "한글(.hwp/.hwpx) 독립 플러그인 이식 완료!"
`;
    zip.file('install-hwp-plugin.sh', shScript);
    zip.file('META-INF/manifest.xml', generateOxtManifestXml());
    zip.file('description.xml', generateOxtDescriptionXml('4.1.0'));

    const blob = await zip.generateAsync({ type: 'blob' });
    const outName = `openoffice-hwp-portable-plugin-v${HWP_PLUGIN_MANIFEST.pluginVersion}.zip`;
    triggerGlobalDownload(
      blob,
      outName,
      '상위 버전 오픈오피스 자동 이식 스크립트 포함 독립 플러그인 (.zip)'
    );
    setStatusMessage(`독립형 한글 플러그인 패키지(${outName}) 다운로드가 준비되었습니다.`);
  };

  // Global 1-click FULL DOWNLOAD (오픈오피스 6대 모듈 전체 + 한글 편집기 + .oxt 확장팩 + 135MB 본체 자동설치기 통합 .zip)
  const handleGlobalFullDownload = async () => {
    const { blob, filename } = await createFullDownloadZipBlob();
    triggerGlobalDownload(
      blob,
      filename,
      '오픈오피스 6대 모듈(Writer·Calc·Impress·Draw·Math) + 한글편집기 통합 실행판 + 전체 소스 + 데스크톱 오픈오피스(135MB) 자동결합 설치기'
    );
    setStatusMessage(
      `오픈오피스+한글편집기 통합 패키지(${filename})가 생성되었습니다.`
    );
  };

  // Direct 1-click download of the All-in-One Standalone OpenOffice (6 modules) + HWP Suite HTML
  const handleDownloadFullSuiteStandaloneHtml = () => {
    const html = generateFullOpenOfficeWithHwpStandaloneHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const outName = 'Apache_OpenOffice_4.1.17_Full_Suite_with_HWP.html';
    triggerGlobalDownload(
      blob,
      outName,
      '오픈오피스 6대 모듈(시작센터·Writer·Calc·Impress·Draw·Math) + 한글(.hwp/.hwpx) 무설치 통합 실행 파일'
    );
    setStatusMessage(
      `오픈오피스 전 모듈 + 한글편집기 통합 실행 파일(${outName})을 다운로드했습니다. 더블클릭하면 즉시 실행됩니다.`
    );
  };

  // Direct 1-click download of Windows Auto-Installer (.bat) that downloads 135MB OpenOffice .exe + registers HWP .oxt
  const handleDownloadAutoInstallerBat = () => {
    const bat = generateWindowsInstallBat();
    const blob = new Blob([bat], { type: 'application/x-bat;charset=utf-8' });
    const outName = 'Install_OpenOffice_Full_and_HWP.bat';
    triggerGlobalDownload(
      blob,
      outName,
      '윈도우 데스크톱 오픈오피스 본체(~135MB .exe) 자동 다운로드·설치 + 한글(.oxt) 메뉴 자동 결합 배치 파일'
    );
    setStatusMessage(
      `데스크톱 오픈오피스 본체(135MB) + 한글편집기 통합 자동 설치기(${outName})를 다운로드했습니다.`
    );
  };

  // Export handler
  const handleDownload = () => {
    if (mode === 'start' || mode === 'hwp') {
      handleGlobalFullDownload();
      return;
    }
    let content = '';
    let filename = 'document.txt';
    if (mode === 'writer') {
      content = writerContent;
      filename = docTitle.replace(/\.odt$/, '') + '.txt';
    } else if (mode === 'calc') {
      content = ROWS.map((r) => COLS.map((c) => evaluateCell(`${c}${r}`)).join(',')).join('\n');
      filename = 'spreadsheet.csv';
    } else if (mode === 'impress') {
      content = JSON.stringify(slides, null, 2);
      filename = 'presentation.json';
    } else if (mode === 'draw') {
      content = JSON.stringify(shapes, null, 2);
      filename = 'drawing.json';
    } else if (mode === 'math') {
      content = mathFormula;
      filename = 'formula.mml';
    }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    triggerGlobalDownload(blob, filename, `${mode.toUpperCase()} 문서 내보내기 파일`);
    setStatusMessage(`${filename} 파일을 다운로드했습니다.`);
  };

  // Convert StarMath syntax to readable mathematical notation
  const formattedMathPreview = useMemo(() => {
    return formatStarMathToNotation(mathFormula);
  }, [mathFormula]);

  // Convert StarMath syntax to standard LaTeX syntax
  const convertedLatexPreview = useMemo(() => {
    return convertStarMathToLatex(mathFormula);
  }, [mathFormula]);

  // Parsed list of multiple StarMath formulas for Batch Convert
  const parsedBatchFormulas = useMemo(() => {
    return parseBatchStarMathText(mathBatchRawText);
  }, [mathBatchRawText]);

  // Upload a .txt / .mml / .math text file containing multiple StarMath formulas
  const handleBatchFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = typeof evt.target?.result === 'string' ? evt.target.result : '';
      setMathBatchRawText(text);
      setMathBatchUploadedFileName(file.name);
      const cleanName = file.name.replace(/\.(txt|mml|math|csv)$/i, '');
      if (cleanName) {
        setMathBatchDocTitle(`${cleanName} — StarMath 일괄 변환 수식집`);
      }
      const count = parseBatchStarMathText(text).length;
      setStatusMessage(
        `'${file.name}' 파일에서 총 ${count}개의 StarMath 수식을 불러왔습니다. (각 수식은 페이지 나누기로 구분됩니다)`
      );
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  // Download a sample .txt file with multiple StarMath formulas for testing Batch Convert
  const handleDownloadSampleBatchTxt = () => {
    const blob = new Blob([DEFAULT_BATCH_STARMATH_TEXT], {
      type: 'text/plain;charset=utf-8',
    });
    triggerGlobalDownload(
      blob,
      'sample_starmath_batch_formulas.txt',
      '다중 StarMath 수식 일괄 변환용 샘플 텍스트 파일 (.txt)'
    );
    setStatusMessage(
      '다중 수식 샘플 파일(sample_starmath_batch_formulas.txt)을 다운로드했습니다.'
    );
  };

  // Batch Convert all uploaded/listed StarMath formulas into a single multi-page PDF document (1 formula per page)
  const handleBatchConvertPdf = () => {
    if (parsedBatchFormulas.length === 0) {
      setStatusMessage('일괄 변환할 StarMath 수식이 없습니다. 텍스트 파일을 업로드하거나 수식을 입력해주세요.');
      return;
    }

    const docHeader =
      mathBatchDocTitle.trim() ||
      'Apache OpenOffice 4.1.17 Math — Batch Formula Document';
    const totalPages = parsedBatchFormulas.length;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    const pdfWidth = pdf.internal.pageSize.getWidth();

    const scale = 2;
    const width = 794; // A4 width at 96 DPI
    const height = 640;

    parsedBatchFormulas.forEach((item, pageIdx) => {
      // Separate each formula by a page break
      if (pageIdx > 0) {
        pdf.addPage();
      }

      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.scale(scale, scale);

      // 1. Page white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // 2. Top Header Banner with Document Title & Page Break Indicator
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(40, 32, width - 80, 58);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 17px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(docHeader.slice(0, 52), 58, 58);

      ctx.fillStyle = '#93c5fd';
      ctx.font = '12px sans-serif';
      ctx.fillText(
        `Source: ${mathBatchUploadedFileName || 'Batch Input'}  •  Formula #${pageIdx + 1}: ${item.title}`,
        58,
        78
      );

      // Page number badge on right of header
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(width - 165, 45, 108, 30);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`PAGE ${pageIdx + 1} / ${totalPages}`, width - 111, 65);

      // 3. Formula Title Section
      ctx.textAlign = 'left';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`[수식 ${pageIdx + 1}] ${item.title}`, 40, 122);

      // 4. Rendered Mathematical Formula Box
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('RENDERED MATHEMATICAL FORMULA (렌더링된 수식)', 40, 146);

      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.fillRect(40, 156, width - 80, 185);
      ctx.strokeRect(40, 156, width - 80, 185);

      ctx.fillStyle = '#0f172a';
      ctx.font = '28px Georgia, "Times New Roman", serif';
      ctx.textAlign = mathPreviewAlign;
      ctx.textBaseline = 'middle';

      const previewText = item.rendered || '(Empty Formula)';
      const horizontalMargin = Math.max(24, mathPaddingX);
      const maxLineWidth = width - 80 - horizontalMargin * 2;
      const words = previewText.split(' ');
      const lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (ctx.measureText(testLine).width > maxLineWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      const lineHeightPx = 38;
      const startY = 248 - ((lines.length - 1) * lineHeightPx) / 2;
      const textX =
        mathPreviewAlign === 'left'
          ? 40 + horizontalMargin
          : mathPreviewAlign === 'right'
          ? width - 40 - horizontalMargin
          : width / 2;

      lines.forEach((line, idx) => {
        ctx.fillText(line, textX, startY + idx * lineHeightPx);
      });

      // 5. StarMath Markup Source Box
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('STARMATH MARKUP COMMAND (원본 StarMath 수식 코드)', 40, 372);

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(40, 382, width - 80, 86);
      ctx.fillStyle = '#6ee7b7';
      ctx.font = '13px monospace';

      const rawLines = (item.formula || '').match(/.{1,78}/g) || [''];
      rawLines.slice(0, 3).forEach((rLine, idx) => {
        ctx.fillText(rLine, 56, 410 + idx * 22);
      });

      // 6. Converted LaTeX Box
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('CONVERTED LATEX SYNTAX (LaTeX 변환 코드)', 40, 496);

      ctx.fillStyle = '#fffbeb';
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 1;
      ctx.fillRect(40, 506, width - 80, 68);
      ctx.strokeRect(40, 506, width - 80, 68);

      ctx.fillStyle = '#92400e';
      ctx.font = '13px monospace';
      const latexLines = (item.latex || '').match(/.{1,78}/g) || [''];
      latexLines.slice(0, 2).forEach((lLine, idx) => {
        ctx.fillText(lLine, 56, 534 + idx * 22);
      });

      // 7. Page Footer with Page Break Notice
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.fillText(
        `Apache OpenOffice 4.1.17 Math Batch Convert • Page ${pageIdx + 1} of ${totalPages} (Separated by Page Break) • ${new Date().toLocaleDateString('ko-KR')}`,
        40,
        608
      );

      const imgData = canvas.toDataURL('image/png');
      const pdfHeight = (height / width) * pdfWidth;
      pdf.addImage(imgData, 'PNG', 0, 8, pdfWidth, pdfHeight);
    });

    const outFilename = `OpenOffice_Math_Batch_${totalPages}Pages.pdf`;
    const pdfArrayBuffer = pdf.output('arraybuffer');
    const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
    triggerGlobalDownload(
      pdfBlob,
      outFilename,
      `다중 StarMath 수식 ${totalPages}개 일괄 변환 PDF 문서 (수식별 페이지 구분 적용)`
    );
    setIsMathBatchModalOpen(false);
    setStatusMessage(
      `총 ${totalPages}개의 StarMath 수식을 각각 페이지 나누기(Page Break)하여 단일 PDF('${outFilename}')로 일괄 변환했습니다.`
    );
  };

  // Export rendered Math formula to a PDF file with user-provided header title
  const handleExportMathPdf = (customTitle?: string) => {
    const headerTitle =
      (customTitle ?? mathPdfTitle).trim() ||
      'Apache OpenOffice 4.1.17 Math — Formula Document';

    const scale = 2;
    const width = 794; // A4 width at 96 DPI
    const height = 560;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale);

    // White page background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Header banner with custom document title
    ctx.fillStyle = '#0369a1';
    ctx.fillRect(40, 36, width - 80, 54);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(headerTitle, 60, 68);

    // Section 1: Rendered Equation Preview Box
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('RENDERED MATHEMATICAL FORMULA (실시간 렌더링 수식)', 40, 125);

    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.fillRect(40, 138, width - 80, 180);
    ctx.strokeRect(40, 138, width - 80, 180);

    // Draw the rendered formula text with selected alignment, margins, and wrapping
    ctx.fillStyle = '#0f172a';
    ctx.font = '28px Georgia, "Times New Roman", serif';
    ctx.textAlign = mathPreviewAlign;
    ctx.textBaseline = 'middle';

    const previewText = formattedMathPreview || '(Empty Formula)';
    const horizontalMargin = Math.max(24, mathPaddingX);
    const maxLineWidth = width - 80 - horizontalMargin * 2;
    const words = previewText.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxLineWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    const lineHeightPx = 40;
    const verticalOffset = (mathPaddingY - 40) * 0.5;
    const startY = 228 + verticalOffset - ((lines.length - 1) * lineHeightPx) / 2;
    const textX =
      mathPreviewAlign === 'left'
        ? 40 + horizontalMargin
        : mathPreviewAlign === 'right'
        ? width - 40 - horizontalMargin
        : width / 2;
    lines.forEach((line, idx) => {
      ctx.fillText(line, textX, startY + idx * lineHeightPx);
    });

    // Section 2: StarMath Markup Source Box
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('STARMATH MARKUP COMMAND (원본 수식 코드)', 40, 358);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(40, 370, width - 80, 100);
    ctx.fillStyle = '#6ee7b7';
    ctx.font = '14px monospace';

    const rawText = mathFormula || '';
    const rawLines = rawText.match(/.{1,78}/g) || [''];
    rawLines.slice(0, 3).forEach((rLine, idx) => {
      ctx.fillText(rLine, 58, 402 + idx * 24);
    });

    // Footer
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText(
      `Generated by Apache OpenOffice 4.1.17 Math • ${new Date().toLocaleDateString('ko-KR')}`,
      40,
      515
    );

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (height / width) * pdfWidth;
    pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
    pdf.save('OpenOffice_Math_Formula.pdf');
    setIsMathPdfPromptOpen(false);
    setStatusMessage(`'${headerTitle}' 머리글이 적용된 OpenOffice_Math_Formula.pdf 파일을 다운로드했습니다.`);
  };

  // Export rendered Math formula to a high-DPI PNG image file
  const handleExportMathPng = () => {
    const scale = 2;
    const width = 760;
    const verticalPad = Math.max(24, mathPaddingY);
    const horizontalPad = Math.max(24, mathPaddingX);
    const height = Math.max(240, 160 + verticalPad * 2);

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale);

    // Outer background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Formula card box
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.fillRect(24, 24, width - 48, height - 68);
    ctx.strokeRect(24, 24, width - 48, height - 68);

    // Formula text with user alignment and margins
    ctx.fillStyle = '#0f172a';
    ctx.font = '30px Georgia, "Times New Roman", serif';
    ctx.textAlign = mathPreviewAlign;
    ctx.textBaseline = 'middle';

    const previewText = formattedMathPreview || '(Empty Formula)';
    const maxLineWidth = width - 48 - horizontalPad * 2;
    const words = previewText.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxLineWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    const lineHeightPx = 42;
    const boxCenterY = 24 + (height - 68) / 2;
    const startY = boxCenterY - ((lines.length - 1) * lineHeightPx) / 2;
    const textX =
      mathPreviewAlign === 'left'
        ? 24 + horizontalPad
        : mathPreviewAlign === 'right'
        ? width - 24 - horizontalPad
        : width / 2;

    lines.forEach((line, idx) => {
      ctx.fillText(line, textX, startY + idx * lineHeightPx);
    });

    // Subtle footer caption
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#64748b';
    ctx.font = '11px monospace';
    const rawCaption = (mathFormula || '').slice(0, 85);
    ctx.fillText(`StarMath: ${rawCaption}`, 26, height - 18);

    canvas.toBlob((blob) => {
      if (!blob) return;
      triggerGlobalDownload(
        blob,
        'OpenOffice_Math_Formula.png',
        '수식 편집기 고해상도 PNG 이미지'
      );
      setIsMathExportMenuOpen(false);
      setStatusMessage('수식을 고해상도 PNG 이미지(OpenOffice_Math_Formula.png)로 다운로드했습니다.');
    }, 'image/png');
  };

  // Export rendered Math formula to a scalable vector graphics (SVG) file
  const handleExportMathSvg = () => {
    const escapeXml = (str: string) =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const width = 760;
    const verticalPad = Math.max(24, mathPaddingY);
    const horizontalPad = Math.max(24, mathPaddingX);
    const height = Math.max(220, 140 + verticalPad * 2);
    const boxHeight = height - 64;

    const previewText = formattedMathPreview || '(Empty Formula)';
    const anchor =
      mathPreviewAlign === 'left'
        ? 'start'
        : mathPreviewAlign === 'right'
        ? 'end'
        : 'middle';
    const textX =
      mathPreviewAlign === 'left'
        ? 24 + horizontalPad
        : mathPreviewAlign === 'right'
        ? width - 24 - horizontalPad
        : width / 2;
    const textY = 20 + boxHeight / 2 + 10;

    const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>Apache OpenOffice 4.1.17 Math Formula</title>
  <desc>StarMath: ${escapeXml(mathFormula)} | LaTeX: ${escapeXml(convertedLatexPreview)}</desc>
  <rect width="100%" height="100%" fill="#ffffff" rx="12" />
  <rect x="20" y="20" width="${width - 40}" height="${boxHeight}" rx="10" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" />
  <text x="${textX}" y="${textY}" text-anchor="${anchor}" font-family="Georgia, 'Times New Roman', serif" font-size="28" fill="#0f172a">
    ${escapeXml(previewText)}
  </text>
  <text x="24" y="${height - 16}" font-family="monospace" font-size="11" fill="#64748b">
    StarMath: ${escapeXml(mathFormula)}
  </text>
</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    triggerGlobalDownload(
      blob,
      'OpenOffice_Math_Formula.svg',
      '수식 편집기 SVG 벡터 그래픽 파일'
    );
    setIsMathExportMenuOpen(false);
    setStatusMessage('수식을 SVG 벡터 그래픽(OpenOffice_Math_Formula.svg)으로 다운로드했습니다.');
  };

  // Filtered StarMath autocomplete suggestions based on current token at cursor
  const mathAutocompleteSuggestions = useMemo(() => {
    if (!isMathAutocompleteOpen || !mathAutocompleteQuery) return [];
    const q = mathAutocompleteQuery.toLowerCase();
    const qClean = q.replace(/^%/, '');

    const matches = STARMATH_AUTOCOMPLETE_ITEMS.filter((item) => {
      const kw = item.keyword.toLowerCase();
      const kwClean = kw.replace(/^%/, '');
      return kw.startsWith(q) || kwClean.startsWith(qClean) || kwClean.includes(qClean);
    });

    // Deduplicate by snippet so e.g. '%pi' and 'pi' don't show twice for the same query
    const seenSnippets = new Set<string>();
    const unique: StarMathSuggestion[] = [];
    for (const m of matches) {
      const key = `${m.symbol}:${m.snippet}`;
      if (!seenSnippets.has(key)) {
        seenSnippets.add(key);
        unique.push(m);
      }
      if (unique.length >= 7) break;
    }
    return unique;
  }, [isMathAutocompleteOpen, mathAutocompleteQuery]);

  // Inspect token right before cursor position to trigger StarMath autocomplete popup
  const handleMathInputWithAutocomplete = (val: string, caretPos: number) => {
    const beforeCaret = val.slice(0, caretPos);
    const tokenMatch = beforeCaret.match(/(%[a-zA-Z]*|[a-zA-Z]{1,16})$/);
    if (tokenMatch && tokenMatch[1].length >= 1) {
      const token = tokenMatch[1];
      const start = caretPos - token.length;
      setMathAutocompleteQuery(token);
      setMathAutocompleteRange({ start, end: caretPos });
      setMathAutocompleteIndex(0);
      setIsMathAutocompleteOpen(true);
    } else {
      setIsMathAutocompleteOpen(false);
      setMathAutocompleteQuery('');
      setMathAutocompleteRange(null);
    }
  };

  // Replace partial token with selected StarMath suggestion snippet
  const applyMathAutocompleteSuggestion = (suggestion: StarMathSuggestion) => {
    const textarea = mathTextareaRef.current;
    const start = mathAutocompleteRange ? mathAutocompleteRange.start : mathFormula.length;
    const end = mathAutocompleteRange ? mathAutocompleteRange.end : mathFormula.length;

    const nextFormula =
      mathFormula.slice(0, start) + suggestion.snippet + mathFormula.slice(end);
    updateMathFormulaWithHistory(
      nextFormula,
      `자동완성 적용: ${suggestion.keyword} (${suggestion.symbol})`
    );
    setIsMathAutocompleteOpen(false);
    setMathAutocompleteQuery('');
    setMathAutocompleteRange(null);
    setStatusMessage(
      `자동완성 적용: '${suggestion.keyword}' → ${suggestion.snippet} (${suggestion.label})`
    );

    requestAnimationFrame(() => {
      if (textarea) {
        textarea.focus();
        const nextCursor = start + suggestion.snippet.length;
        textarea.setSelectionRange(nextCursor, nextCursor);
      }
    });
  };

  const activeSlide = slides[activeSlideIndex] || slides[0];
  const selectedShape = shapes.find((s) => s.id === selectedShapeId) || shapes[0];

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800 select-none">
      {/* Top Application Title & Menu Bar */}
      <header className="bg-gradient-to-r from-sky-800 via-sky-700 to-blue-800 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-2 min-h-14 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMode('start')}
              className="flex items-center gap-2.5 text-left group focus:outline-none"
              title="Return to Apache OpenOffice Start Center"
            >
              <div className="w-9 h-9 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center border border-white/25 group-hover:bg-white/25 transition">
                <span className="font-bold text-lg tracking-tighter text-sky-100">AOO</span>
              </div>
              <div>
                <div className="font-semibold tracking-tight text-base flex items-center gap-2">
                  Apache OpenOffice®
                  <span className="text-xs font-medium bg-sky-950/60 border border-sky-400/30 px-2 py-0.5 rounded text-sky-200">
                    4.1.17 Web Suite
                  </span>
                </div>
                <div className="text-xs text-sky-200 hidden sm:block">
                  OpenDocument & 한글(.hwp/.hwpx) 통합 오피스
                </div>
              </div>
            </button>
          </div>

          {/* Module Switcher Navigation */}
          <nav className="flex items-center gap-1 bg-sky-950/40 p-1 rounded-lg border border-white/10 overflow-x-auto max-w-full">
            <button
              onClick={() => setMode('start')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition shrink-0 ${
                mode === 'start'
                  ? 'bg-white text-sky-900 shadow-sm'
                  : 'text-sky-100 hover:bg-white/10'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              시작 센터
            </button>
            <button
              onClick={() => setMode('hwp')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition shrink-0 ${
                mode === 'hwp'
                  ? 'bg-white text-sky-900 shadow-sm'
                  : 'text-sky-100 hover:bg-white/10'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              한글 (.hwp/.hwpx)
            </button>
            <button
              onClick={() => setMode('writer')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition shrink-0 ${
                mode === 'writer'
                  ? 'bg-white text-sky-900 shadow-sm'
                  : 'text-sky-100 hover:bg-white/10'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Writer
            </button>
            <button
              onClick={() => setMode('calc')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition shrink-0 ${
                mode === 'calc'
                  ? 'bg-white text-sky-900 shadow-sm'
                  : 'text-sky-100 hover:bg-white/10'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              Calc
            </button>
            <button
              onClick={() => setMode('impress')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition shrink-0 ${
                mode === 'impress'
                  ? 'bg-white text-sky-900 shadow-sm'
                  : 'text-sky-100 hover:bg-white/10'
              }`}
            >
              <Presentation className="w-3.5 h-3.5" />
              Impress
            </button>
            <button
              onClick={() => setMode('draw')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition shrink-0 ${
                mode === 'draw'
                  ? 'bg-white text-sky-900 shadow-sm'
                  : 'text-sky-100 hover:bg-white/10'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              Draw
            </button>
            <button
              onClick={() => setMode('math')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition shrink-0 ${
                mode === 'math'
                  ? 'bg-white text-sky-900 shadow-sm'
                  : 'text-sky-100 hover:bg-white/10'
              }`}
            >
              <Sigma className="w-3.5 h-3.5" />
              Math
            </button>
          </nav>

          {/* Clean Action Buttons: No redundant GitHub buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {readyFullZip ? (
              <a
                href={readyFullZip.url}
                download={readyFullZip.filename}
                onClick={() =>
                  setStatusMessage(
                    `한글 확장팩 전체 소스 패키지(${readyFullZip.filename})를 저장합니다.`
                  )
                }
                className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-extrabold px-3.5 py-1.5 rounded-md shadow-sm border border-emerald-300 transition shrink-0"
                title="yjhone1/openoffice-hwp에 푸시할 한글 확장팩 소스코드 + OXT 빌더 + GitHub Actions CI/CD (.zip)"
              >
                <Download className="w-3.5 h-3.5" />
                한글 확장팩 소스 다운로드 (.zip)
              </a>
            ) : (
              <button
                onClick={handleGlobalFullDownload}
                className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-extrabold px-3.5 py-1.5 rounded-md shadow-sm border border-emerald-300 transition shrink-0"
                title="yjhone1/openoffice-hwp에 푸시할 한글 확장팩 소스코드 + OXT 빌더 + GitHub Actions CI/CD (.zip)"
              >
                <Download className="w-3.5 h-3.5" />
                한글 확장팩 소스 다운로드 (.zip)
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsApacheSourceModalOpen(true)}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-md shadow-sm transition shrink-0"
              title="아파치 공식 소스(AOO41X) 동적 복제 및 openoffice-hwp 푸시 아키텍처 안내"
            >
              <GitBranch className="w-3.5 h-3.5" />
              아파치 공식 소스 연동 구조
            </button>

            <button
              onClick={handleGlobalDownloadOxt}
              className="flex items-center gap-1 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold px-3 py-1.5 rounded-md shadow-sm transition shrink-0"
              title="오픈오피스 [도구 > 확장 관리자]에서 직접 등록할 수 있는 한글 확장팩 (.oxt)"
            >
              <Download className="w-3.5 h-3.5" />
              한글 확장팩 수동설치 (.oxt)
            </button>

            <button
              type="button"
              onClick={() => setIsManualInstallModalOpen(true)}
              className="flex items-center gap-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-3 py-1.5 rounded-md shadow-sm transition shrink-0"
              title="오픈오피스에 한글 기능을 수동으로 추가하는 방법 안내"
            >
              <BookOpen className="w-3.5 h-3.5" />
              수동 설치 방법
            </button>

            {mode === 'math' && (
              <button
                onClick={() => setIsMathPdfPromptOpen(true)}
                className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium px-3 py-1.5 rounded-md shadow-sm transition shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Export to PDF
              </button>
            )}
            {mode !== 'start' && mode !== 'hwp' && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 bg-sky-500 hover:bg-sky-600 text-white text-xs font-medium px-3 py-1.5 rounded-md shadow-sm transition shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                파일 다운로드
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Global Direct Download Link Bar (샌드박스 환경에서도 1클릭 직접 다운로드 보장) */}
      {globalDownload && (
        <div className="bg-emerald-900 text-white border-b border-emerald-700 px-4 py-2">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500 text-white font-bold text-[11px]">
                <Download className="w-3 h-3" /> 다운로드 파일 생성됨
              </span>
              <span className="font-bold text-emerald-200">{globalDownload.filename}</span>
              <span className="text-emerald-300/90">
                ({globalDownload.sizeLabel} · {globalDownload.description})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={globalDownload.url}
                download={globalDownload.filename}
                className="inline-flex items-center gap-1.5 bg-white text-emerald-950 hover:bg-emerald-100 font-bold px-3 py-1 rounded-md shadow-xs transition"
              >
                <Download className="w-3.5 h-3.5" />
                내 컴퓨터로 직접 다운로드 ({globalDownload.filename})
              </a>
              <button
                type="button"
                onClick={() => setGlobalDownload(null)}
                className="text-emerald-300 hover:text-white px-1.5 py-0.5"
              >
                닫기 ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 flex flex-col">
        {mode === 'start' && (
          <div className="space-y-5 my-auto py-2">
            {/* Clean Download & Manual Install Center Card on Start Center */}
            <div className="bg-gradient-to-r from-emerald-50 via-sky-50 to-indigo-50 border-2 border-emerald-500/80 rounded-xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-2xl">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-950 bg-indigo-200/80 border border-indigo-400 px-2.5 py-0.5 rounded-full">
                  <GitBranch className="w-3.5 h-3.5" />
                  아파치 공식 최신 소스(AOO41X) 동적 복제 &amp; 한글 확장팩(openoffice-hwp) 깃허브 푸시
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  한글 확장팩 소스 다운로드 &amp; 깃허브(yjhone1/openoffice-hwp) 배포
                </h2>
                <p className="text-xs text-slate-700 leading-relaxed">
                  • <strong>아파치 최신 소스 동적 복제</strong>: 2.5GB 원본 소스를 저장소에 직접 올리지 않고, 빌드 시 공식 저장소(<code>apache/openoffice</code>, AOO41X 브랜치)에서 항상 최신 버전을 불러와 한글 확장팩과 결합합니다.<br />
                  • <strong>한글 확장팩 전용 깃허브 푸시</strong>: <code>yjhone1/openoffice-hwp</code>에는 순수 한글 확장팩 소스(OXT 패키지, 한글 웹 편집기, 자동 빌드 CI/CD)만 가볍고 완전하게 푸시합니다.<br />
                  • <strong>GitHub Actions 자동 빌드</strong>: 푸시 즉시 깃허브에서 아파치 공식 소스를 불러와 윈도우 배포판(<code>OpenOffice-4.1.17-HWP-Windows-Distribution.zip</code>)과 확장팩(<code>.oxt</code>)을 자동 빌드합니다.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {readyFullZip ? (
                  <a
                    href={readyFullZip.url}
                    download={readyFullZip.filename}
                    onClick={() =>
                      setStatusMessage(
                        `한글 확장팩 소스코드 패키지(${readyFullZip.filename})를 저장합니다.`
                      )
                    }
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-lg shadow-sm border border-emerald-500 transition"
                  >
                    <Download className="w-4 h-4" />
                    한글 확장팩 소스 다운로드 (.zip) {readyFullZip.sizeLabel && `(${readyFullZip.sizeLabel})`}
                  </a>
                ) : (
                  <button
                    onClick={handleGlobalFullDownload}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-lg shadow-sm border border-emerald-500 transition"
                  >
                    <Download className="w-4 h-4" />
                    한글 확장팩 소스 다운로드 (.zip)
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsApacheSourceModalOpen(true)}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-lg shadow-xs transition"
                >
                  <GitBranch className="w-4 h-4" />
                  연동 구조 및 푸시 안내
                </button>

                <button
                  onClick={handleGlobalDownloadOxt}
                  className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold px-3.5 py-2.5 rounded-lg shadow-xs transition"
                >
                  <Download className="w-4 h-4" />
                  한글 확장팩 (.oxt) 받기
                </button>

                <button
                  type="button"
                  onClick={() => setIsManualInstallModalOpen(true)}
                  className="flex items-center gap-1.5 bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold px-3.5 py-2.5 rounded-lg shadow-xs transition"
                >
                  <BookOpen className="w-4 h-4" />
                  수동 설치 방법 안내
                </button>

                <button
                  type="button"
                  onClick={handleDownloadFullSuiteStandaloneHtml}
                  className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold px-3 py-2.5 rounded-lg shadow-xs transition"
                  title="오프라인에서 단독 실행 가능한 무설치 통합 파일"
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  무설치 통합실행판 (.html)
                </button>
              </div>
            </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns: Application Launchers */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="border-b border-slate-100 pb-4 mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">
                    Apache OpenOffice® 4.1.17 시작 센터
                  </h1>
                  <p className="text-sm text-slate-500 mt-0.5">
                    편집할 문서 모듈(.hwp, .hwpx, .odt, .ods, .odp)을 선택하세요
                  </p>
                </div>
                <span className="text-xs font-medium text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-md">
                  ODF 1.2 & HWPX 표준
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* HWP / HWPX Korean Word Processor Card */}
                <button
                  onClick={() => {
                    setMode('hwp');
                    setStatusMessage('한글 문서(.hwp / .hwpx) 편집기를 열었습니다.');
                  }}
                  className="flex items-start gap-4 p-4 rounded-xl border-2 border-sky-500/80 bg-sky-50/30 hover:bg-sky-50/80 transition text-left group"
                >
                  <div className="w-12 h-12 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:bg-sky-700 transition">
                    <span className="font-bold text-base">한글</span>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 group-hover:text-sky-700 flex items-center gap-1.5">
                      한글 문서 (.hwp / .hwpx)
                      <span className="text-[10px] font-bold bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded">
                        NEW
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      .hwp 및 .hwpx 파일 열기/저장, 공문서 결재란, 줄간격 160%, 표 편집 및 원고지 매수 계산 지원.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setMode('writer');
                    setStatusMessage('Opened OpenOffice Writer (.odt)');
                  }}
                  className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 hover:border-sky-500 hover:bg-sky-50/40 transition text-left group"
                >
                  <div className="w-12 h-12 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 group-hover:bg-sky-600 group-hover:text-white transition">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 group-hover:text-sky-700">
                      Text Document (Writer .odt)
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      국제 표준 OpenDocument(.odt) 텍스트 워드프로세서 및 스타일 편집기.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setMode('calc');
                    setStatusMessage('Opened OpenOffice Calc (.ods)');
                  }}
                  className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 transition text-left group"
                >
                  <div className="w-12 h-12 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition">
                    <Table className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 group-hover:text-emerald-700">
                      Spreadsheet (Calc .ods)
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      SUM, AVERAGE, MIN, MAX 및 사칙연산 수식을 지원하는 스프레드시트.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setMode('impress');
                    setStatusMessage('Opened OpenOffice Impress (.odp)');
                  }}
                  className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/40 transition text-left group"
                >
                  <div className="w-12 h-12 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:bg-amber-600 group-hover:text-white transition">
                    <Presentation className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 group-hover:text-amber-700">
                      Presentation (Impress .odp)
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      슬라이드 테마, 발표자 노트 및 전체화면 슬라이드 쇼 프레젠테이션.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setMode('draw');
                    setStatusMessage('Opened OpenOffice Draw (.odg)');
                  }}
                  className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50/40 transition text-left group"
                >
                  <div className="w-12 h-12 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition">
                    <PenTool className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 group-hover:text-purple-700">
                      Drawing (Draw .odg)
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      아키텍처 다이어그램 및 순서도 작성을 위한 벡터 드로잉 캔버스.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setMode('math');
                    setStatusMessage('Opened OpenOffice Math (.odf)');
                  }}
                  className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 transition text-left group"
                >
                  <div className="w-12 h-12 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition">
                    <Sigma className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 group-hover:text-indigo-700">
                      Formula Editor (Math .odf)
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      StarMath 수식 마크업 편집기 및 실시간 수학 기호 렌더링.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Right Column: Recent Documents & Info */}
            <div className="flex flex-col gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-sky-600" />
                    최근 문서 (.hwpx, .hwp, .odt)
                  </h2>
                </div>
                <div className="space-y-2.5">
                  {INITIAL_DOCS.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => {
                        setMode(doc.type);
                        if (doc.type === 'writer') setDocTitle(doc.title + doc.extension);
                        if (doc.type === 'hwp') setHwpFilename(doc.title + doc.extension);
                        setStatusMessage(`불러옴: ${doc.title}${doc.extension}`);
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition text-left"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-medium text-slate-800 truncate">
                          {doc.title}
                          <span className="text-sky-600 font-semibold">{doc.extension}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{doc.updatedAt}</div>
                      </div>
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded shrink-0 ${
                          doc.type === 'hwp'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {doc.type === 'hwp' ? '한글' : doc.type}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 text-slate-200 rounded-xl p-5 text-xs space-y-2">
                <div className="font-semibold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Apache OpenOffice 4.1.17 + 한글(.hwp/.hwpx)
                </div>
                <p className="text-slate-400 leading-relaxed">
                  기존 OpenOffice 5대 모듈(Writer, Calc, Impress, Draw, Math)에 더해 국가표준 개방형 한글(.hwpx) 및 .hwp 전용 편집기가 통합되었습니다.
                </p>
              </div>
            </div>
          </div>
          </div>
        )}

        {/* HWP / HWPX MODULE */}
        {mode === 'hwp' && (
          <HwpEditor
            initialFilename={hwpFilename}
            onStatusChange={(msg) => setStatusMessage(msg)}
            onDownloadFullProject={handleGlobalFullDownload}
          />
        )}

        {/* WRITER MODULE */}
        {mode === 'writer' && (
          <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Writer Toolbar */}
            <div className="border-b border-slate-200 bg-slate-50 p-2.5 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="text-xs font-medium bg-white border border-slate-300 rounded px-2.5 py-1.5 w-64 focus:outline-none focus:border-sky-600"
              />

              <div className="h-5 w-px bg-slate-300 mx-1" />

              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value as 'sans' | 'serif' | 'mono')}
                className="text-xs bg-white border border-slate-300 rounded px-2 py-1.5"
              >
                <option value="serif">Liberation Serif</option>
                <option value="sans">Liberation Sans</option>
                <option value="mono">Liberation Mono</option>
              </select>

              <select
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="text-xs bg-white border border-slate-300 rounded px-2 py-1.5"
              >
                {[12, 14, 16, 18, 20, 24].map((sz) => (
                  <option key={sz} value={sz}>
                    {sz} pt
                  </option>
                ))}
              </select>

              <div className="h-5 w-px bg-slate-300 mx-1" />

              <button
                onClick={() => setIsBold(!isBold)}
                className={`p-1.5 rounded border ${
                  isBold ? 'bg-sky-100 border-sky-400 text-sky-800' : 'bg-white border-slate-200 text-slate-700'
                }`}
                title="Bold"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsItalic(!isItalic)}
                className={`p-1.5 rounded border ${
                  isItalic ? 'bg-sky-100 border-sky-400 text-sky-800' : 'bg-white border-slate-200 text-slate-700'
                }`}
                title="Italic"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsUnderline(!isUnderline)}
                className={`p-1.5 rounded border ${
                  isUnderline ? 'bg-sky-100 border-sky-400 text-sky-800' : 'bg-white border-slate-200 text-slate-700'
                }`}
                title="Underline"
              >
                <Underline className="w-3.5 h-3.5" />
              </button>

              <div className="h-5 w-px bg-slate-300 mx-1" />

              <button
                onClick={() => setTextAlign('left')}
                className={`p-1.5 rounded border ${
                  textAlign === 'left' ? 'bg-sky-100 border-sky-400 text-sky-800' : 'bg-white border-slate-200'
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTextAlign('center')}
                className={`p-1.5 rounded border ${
                  textAlign === 'center' ? 'bg-sky-100 border-sky-400 text-sky-800' : 'bg-white border-slate-200'
                }`}
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTextAlign('right')}
                className={`p-1.5 rounded border ${
                  textAlign === 'right' ? 'bg-sky-100 border-sky-400 text-sky-800' : 'bg-white border-slate-200'
                }`}
              >
                <AlignRight className="w-3.5 h-3.5" />
              </button>

              <div className="ml-auto flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    placeholder="Find in document..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-300 rounded w-44 focus:outline-none focus:border-sky-600"
                  />
                </div>
              </div>
            </div>

            {/* Horizontal Page Ruler */}
            <div className="bg-slate-200/70 border-b border-slate-300 px-8 py-1 text-[10px] font-mono text-slate-500 flex justify-between">
              <span>0 cm</span>
              <span>2 cm</span>
              <span>4 cm</span>
              <span>6 cm</span>
              <span>8 cm</span>
              <span>10 cm</span>
              <span>12 cm</span>
              <span>14 cm</span>
              <span>16 cm</span>
            </div>

            {/* Document Page Canvas */}
            <div className="flex-1 bg-slate-200/60 p-6 overflow-y-auto flex justify-center">
              <div className="w-full max-w-3xl bg-white shadow-md border border-slate-300 min-h-[540px] p-10 flex flex-col">
                {searchQuery && (
                  <div className="mb-3 text-xs bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1.5 rounded flex items-center justify-between">
                    <span>
                      Matches for "{searchQuery}":{' '}
                      <strong>
                        {writerContent.toLowerCase().split(searchQuery.toLowerCase()).length - 1}
                      </strong>
                    </span>
                    <button onClick={() => setSearchQuery('')} className="underline text-[11px]">
                      Clear
                    </button>
                  </div>
                )}
                <textarea
                  value={writerContent}
                  onChange={(e) => setWriterContent(e.target.value)}
                  style={{
                    fontSize: `${fontSize}px`,
                    fontWeight: isBold ? 700 : 400,
                    fontStyle: isItalic ? 'italic' : 'normal',
                    textDecoration: isUnderline ? 'underline' : 'none',
                    textAlign,
                  }}
                  className={`w-full flex-1 resize-none focus:outline-none leading-relaxed text-slate-900 ${
                    fontFamily === 'serif'
                      ? 'font-serif'
                      : fontFamily === 'mono'
                      ? 'font-mono'
                      : 'font-sans'
                  }`}
                />
              </div>
            </div>

            {/* Writer Footer Bar */}
            <div className="border-t border-slate-200 bg-slate-50 px-4 py-1.5 text-xs text-slate-600 flex items-center justify-between">
              <div>Page 1 / 1 — Default Page Style</div>
              <div className="flex items-center gap-4">
                <span>Words: {writerStats.words}</span>
                <span>Characters: {writerStats.chars}</span>
                <span>Lines: {writerStats.lines}</span>
              </div>
            </div>
          </div>
        )}

        {/* CALC MODULE */}
        {mode === 'calc' && (
          <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Formula Bar */}
            <div className="border-b border-slate-200 bg-slate-50 p-2.5 flex items-center gap-2">
              <div className="px-3 py-1 bg-white border border-slate-300 rounded text-xs font-mono font-semibold text-sky-800 w-16 text-center">
                {selectedCell}
              </div>
              <span className="text-xs font-serif italic text-slate-500 px-1">fx</span>
              <input
                type="text"
                value={cells[selectedCell] ?? ''}
                onChange={(e) =>
                  setCells((prev) => ({
                    ...prev,
                    [selectedCell]: e.target.value,
                  }))
                }
                placeholder="Enter value or formula (e.g. =SUM(B2:B5) or =B2+C2)"
                className="flex-1 text-xs font-mono bg-white border border-slate-300 rounded px-3 py-1.5 focus:outline-none focus:border-sky-600"
              />
              <div className="text-xs text-slate-500 hidden md:block">
                Evaluated: <strong className="text-slate-800">{evaluateCell(selectedCell)}</strong>
              </div>
            </div>

            {/* Spreadsheet Grid */}
            <div className="flex-1 overflow-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="w-10 border-r border-slate-300 py-1.5 text-center text-slate-500 font-medium">
                      #
                    </th>
                    {COLS.map((col) => (
                      <th
                        key={col}
                        className="border-r border-slate-300 py-1.5 px-2 text-center font-semibold text-slate-700 min-w-[110px]"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => (
                    <tr key={row} className="border-b border-slate-200">
                      <td className="bg-slate-100 border-r border-slate-300 text-center font-mono text-slate-500 py-1">
                        {row}
                      </td>
                      {COLS.map((col) => {
                        const id = `${col}${row}`;
                        const isSelected = selectedCell === id;
                        const rawVal = cells[id] ?? '';
                        const displayVal = evaluateCell(id);
                        return (
                          <td
                            key={id}
                            onClick={() => setSelectedCell(id)}
                            className={`border-r border-slate-200 px-2 py-1 cursor-cell transition ${
                              isSelected
                                ? 'ring-2 ring-inset ring-sky-600 bg-sky-50/30'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            {isSelected ? (
                              <input
                                type="text"
                                value={rawVal}
                                onChange={(e) =>
                                  setCells((prev) => ({
                                    ...prev,
                                    [id]: e.target.value,
                                  }))
                                }
                                className="w-full bg-transparent focus:outline-none font-mono text-xs"
                                autoFocus
                              />
                            ) : (
                              <div
                                className={`truncate ${
                                  row === 1
                                    ? 'font-semibold text-slate-900'
                                    : !Number.isNaN(Number(displayVal)) && displayVal !== ''
                                    ? 'text-right font-mono text-slate-800'
                                    : 'text-slate-700'
                                }`}
                              >
                                {displayVal}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sheet Tabs */}
            <div className="border-t border-slate-200 bg-slate-100 px-3 py-1.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                <span className="bg-white border border-slate-300 px-3 py-0.5 rounded font-medium text-sky-800 shadow-2xs">
                  Sheet1_ReleaseMetrics
                </span>
              </div>
              <div className="text-slate-500">
                Supported functions: <code className="font-mono">SUM</code>,{' '}
                <code className="font-mono">AVERAGE</code>, <code className="font-mono">MIN</code>,{' '}
                <code className="font-mono">MAX</code>, arithmetic (<code className="font-mono">=B2+C2</code>)
              </div>
            </div>
          </div>
        )}

        {/* IMPRESS MODULE */}
        {mode === 'impress' && (
          <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Impress Toolbar */}
            <div className="border-b border-slate-200 bg-slate-50 p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const newSlide: Slide = {
                      id: `s${Date.now()}`,
                      title: `New Slide ${slides.length + 1}`,
                      subtitle: 'Click to edit slide subtitle',
                      bullets: ['First key point', 'Second key point'],
                      notes: 'Speaker notes for this slide.',
                      theme: 'ocean',
                    };
                    setSlides([...slides, newSlide]);
                    setActiveSlideIndex(slides.length);
                  }}
                  className="flex items-center gap-1 bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium px-3 py-1.5 rounded"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Slide
                </button>
                {slides.length > 1 && (
                  <button
                    onClick={() => {
                      const updated = slides.filter((_, idx) => idx !== activeSlideIndex);
                      setSlides(updated);
                      setActiveSlideIndex(Math.max(0, activeSlideIndex - 1));
                    }}
                    className="flex items-center gap-1 bg-white hover:bg-red-50 text-red-600 border border-slate-300 text-xs font-medium px-2.5 py-1.5 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Slide
                  </button>
                )}

                <div className="h-5 w-px bg-slate-300 mx-1" />

                <span className="text-xs text-slate-600">Theme:</span>
                {(['ocean', 'slate', 'emerald', 'amber'] as const).map((th) => (
                  <button
                    key={th}
                    onClick={() => {
                      const copy = [...slides];
                      copy[activeSlideIndex] = { ...activeSlide, theme: th };
                      setSlides(copy);
                    }}
                    className={`text-xs capitalize px-2.5 py-1 rounded border ${
                      activeSlide.theme === th
                        ? 'bg-sky-100 border-sky-500 text-sky-900 font-medium'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    {th}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setIsPresenting(true)}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3.5 py-1.5 rounded shadow-xs"
              >
                <Play className="w-3.5 h-3.5" />
                Start Slide Show
              </button>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-4 overflow-hidden">
              {/* Left Slide Sorter */}
              <div className="border-r border-slate-200 bg-slate-50 p-3 space-y-2.5 overflow-y-auto">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Slides ({slides.length})
                </div>
                {slides.map((sl, idx) => (
                  <button
                    key={sl.id}
                    onClick={() => setActiveSlideIndex(idx)}
                    className={`w-full text-left p-3 rounded-lg border transition ${
                      idx === activeSlideIndex
                        ? 'bg-white border-sky-500 ring-2 ring-sky-500/20 shadow-xs'
                        : 'bg-white/70 border-slate-200 hover:bg-white'
                    }`}
                  >
                    <div className="text-[11px] font-semibold text-slate-400">Slide {idx + 1}</div>
                    <div className="text-xs font-semibold text-slate-800 truncate mt-0.5">
                      {sl.title}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{sl.subtitle}</div>
                  </button>
                ))}
              </div>

              {/* Center Slide Editor */}
              <div className="md:col-span-3 p-6 bg-slate-100 flex flex-col gap-4 overflow-y-auto">
                <div
                  className={`rounded-xl shadow-md p-10 min-h-[360px] flex flex-col justify-between text-white transition ${
                    activeSlide.theme === 'ocean'
                      ? 'bg-gradient-to-br from-sky-800 via-blue-900 to-slate-900'
                      : activeSlide.theme === 'emerald'
                      ? 'bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-900'
                      : activeSlide.theme === 'amber'
                      ? 'bg-gradient-to-br from-amber-700 via-orange-800 to-slate-900'
                      : 'bg-gradient-to-br from-slate-800 via-slate-900 to-black'
                  }`}
                >
                  <div>
                    <input
                      type="text"
                      value={activeSlide.title}
                      onChange={(e) => {
                        const copy = [...slides];
                        copy[activeSlideIndex] = { ...activeSlide, title: e.target.value };
                        setSlides(copy);
                      }}
                      className="w-full bg-transparent text-2xl md:text-3xl font-bold border-b border-white/20 pb-2 focus:outline-none focus:border-white"
                    />
                    <input
                      type="text"
                      value={activeSlide.subtitle}
                      onChange={(e) => {
                        const copy = [...slides];
                        copy[activeSlideIndex] = { ...activeSlide, subtitle: e.target.value };
                        setSlides(copy);
                      }}
                      className="w-full bg-transparent text-sm md:text-base text-white/80 mt-2 focus:outline-none"
                    />

                    <div className="mt-6 space-y-2.5">
                      {activeSlide.bullets.map((b, bIdx) => (
                        <div key={bIdx} className="flex items-center gap-2.5">
                          <span className="w-2 h-2 rounded-full bg-sky-300 shrink-0" />
                          <input
                            type="text"
                            value={b}
                            onChange={(e) => {
                              const newBullets = [...activeSlide.bullets];
                              newBullets[bIdx] = e.target.value;
                              const copy = [...slides];
                              copy[activeSlideIndex] = { ...activeSlide, bullets: newBullets };
                              setSlides(copy);
                            }}
                            className="flex-1 bg-white/5 hover:bg-white/10 focus:bg-white/15 rounded px-2.5 py-1 text-sm text-white focus:outline-none"
                          />
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const copy = [...slides];
                          copy[activeSlideIndex] = {
                            ...activeSlide,
                            bullets: [...activeSlide.bullets, 'New bullet point'],
                          };
                          setSlides(copy);
                        }}
                        className="text-xs text-sky-200 hover:text-white underline mt-2 inline-block"
                      >
                        + Add Bullet Point
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-white/60 pt-6 border-t border-white/15">
                    <span>Apache OpenOffice Impress</span>
                    <span>
                      Slide {activeSlideIndex + 1} of {slides.length}
                    </span>
                  </div>
                </div>

                {/* Speaker Notes */}
                <div className="bg-white rounded-lg border border-slate-200 p-3">
                  <div className="text-xs font-semibold text-slate-500 mb-1">Speaker Notes</div>
                  <textarea
                    value={activeSlide.notes}
                    onChange={(e) => {
                      const copy = [...slides];
                      copy[activeSlideIndex] = { ...activeSlide, notes: e.target.value };
                      setSlides(copy);
                    }}
                    rows={2}
                    className="w-full text-xs text-slate-700 resize-none focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Fullscreen Slide Show Modal */}
            {isPresenting && (
              <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-12 text-white">
                <div className="flex justify-between items-center">
                  <span className="text-xs uppercase tracking-widest text-slate-400">
                    OpenOffice Impress Slide Show — Slide {activeSlideIndex + 1} / {slides.length}
                  </span>
                  <button
                    onClick={() => setIsPresenting(false)}
                    className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded text-xs"
                  >
                    Exit Presentation
                  </button>
                </div>

                <div className="max-w-4xl mx-auto w-full my-auto space-y-6">
                  <h1 className="text-4xl md:text-5xl font-bold">{activeSlide.title}</h1>
                  <p className="text-xl text-sky-300">{activeSlide.subtitle}</p>
                  <ul className="space-y-4 pt-4 text-lg">
                    {activeSlide.bullets.map((item, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center justify-center gap-4">
                  <button
                    disabled={activeSlideIndex === 0}
                    onClick={() => setActiveSlideIndex((i) => Math.max(0, i - 1))}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    disabled={activeSlideIndex === slides.length - 1}
                    onClick={() => setActiveSlideIndex((i) => Math.min(slides.length - 1, i + 1))}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DRAW MODULE */}
        {mode === 'draw' && (
          <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 p-2.5 flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  const id = `sh${Date.now()}`;
                  setShapes([
                    ...shapes,
                    {
                      id,
                      type: 'rect',
                      x: 120,
                      y: 120,
                      width: 150,
                      height: 65,
                      color: '#0284c7',
                      label: 'New Box',
                    },
                  ]);
                  setSelectedShapeId(id);
                }}
                className="flex items-center gap-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-xs px-2.5 py-1.5 rounded"
              >
                <Square className="w-3.5 h-3.5 text-sky-600" />
                Rectangle
              </button>
              <button
                onClick={() => {
                  const id = `sh${Date.now()}`;
                  setShapes([
                    ...shapes,
                    {
                      id,
                      type: 'circle',
                      x: 240,
                      y: 150,
                      width: 100,
                      height: 100,
                      color: '#0d9488',
                      label: 'Node',
                    },
                  ]);
                  setSelectedShapeId(id);
                }}
                className="flex items-center gap-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-xs px-2.5 py-1.5 rounded"
              >
                <Circle className="w-3.5 h-3.5 text-teal-600" />
                Ellipse
              </button>

              {selectedShape && (
                <>
                  <div className="h-5 w-px bg-slate-300 mx-1" />
                  <span className="text-xs text-slate-500">Label:</span>
                  <input
                    type="text"
                    value={selectedShape.label ?? ''}
                    onChange={(e) =>
                      setShapes(
                        shapes.map((s) =>
                          s.id === selectedShape.id ? { ...s, label: e.target.value } : s
                        )
                      )
                    }
                    className="text-xs bg-white border border-slate-300 rounded px-2 py-1 w-40"
                  />
                  <span className="text-xs text-slate-500">X:</span>
                  <input
                    type="number"
                    value={selectedShape.x}
                    onChange={(e) =>
                      setShapes(
                        shapes.map((s) =>
                          s.id === selectedShape.id ? { ...s, x: Number(e.target.value) } : s
                        )
                      )
                    }
                    className="text-xs bg-white border border-slate-300 rounded px-2 py-1 w-16"
                  />
                  <span className="text-xs text-slate-500">Y:</span>
                  <input
                    type="number"
                    value={selectedShape.y}
                    onChange={(e) =>
                      setShapes(
                        shapes.map((s) =>
                          s.id === selectedShape.id ? { ...s, y: Number(e.target.value) } : s
                        )
                      )
                    }
                    className="text-xs bg-white border border-slate-300 rounded px-2 py-1 w-16"
                  />
                  <input
                    type="color"
                    value={selectedShape.color}
                    onChange={(e) =>
                      setShapes(
                        shapes.map((s) =>
                          s.id === selectedShape.id ? { ...s, color: e.target.value } : s
                        )
                      )
                    }
                    className="w-7 h-7 rounded cursor-pointer border border-slate-300"
                  />
                  <button
                    onClick={() => {
                      const remaining = shapes.filter((s) => s.id !== selectedShape.id);
                      setShapes(remaining);
                      if (remaining[0]) setSelectedShapeId(remaining[0].id);
                    }}
                    className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded border border-transparent hover:border-red-200 ml-auto"
                  >
                    Remove Shape
                  </button>
                </>
              )}
            </div>

            <div className="flex-1 bg-slate-100 p-6 flex justify-center items-center overflow-auto">
              <svg
                viewBox="0 0 750 380"
                className="w-full max-w-4xl bg-white rounded-lg shadow-inner border border-slate-300"
              >
                <defs>
                  <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse">
                    <path
                      d="M 25 0 L 0 0 0 25"
                      fill="none"
                      stroke="#f1f5f9"
                      strokeWidth="1"
                    />
                  </pattern>
                </defs>
                <rect width="750" height="380" fill="url(#grid)" />

                {shapes.length >= 3 && (
                  <>
                    <line
                      x1={shapes[0].x + shapes[0].width / 2}
                      y1={shapes[0].y + shapes[0].height}
                      x2={shapes[2].x + shapes[2].width / 2}
                      y2={shapes[2].y}
                      stroke="#94a3b8"
                      strokeWidth="2"
                      strokeDasharray="4"
                    />
                    <line
                      x1={shapes[1].x + shapes[1].width / 2}
                      y1={shapes[1].y + shapes[1].height}
                      x2={shapes[2].x + shapes[2].width / 2}
                      y2={shapes[2].y}
                      stroke="#94a3b8"
                      strokeWidth="2"
                      strokeDasharray="4"
                    />
                  </>
                )}

                {shapes.map((shape) => {
                  const isSel = shape.id === selectedShapeId;
                  return (
                    <g
                      key={shape.id}
                      onClick={() => setSelectedShapeId(shape.id)}
                      className="cursor-pointer"
                    >
                      {shape.type === 'rect' ? (
                        <rect
                          x={shape.x}
                          y={shape.y}
                          width={shape.width}
                          height={shape.height}
                          rx={8}
                          fill={shape.color}
                          stroke={isSel ? '#0f172a' : 'none'}
                          strokeWidth={isSel ? 3 : 0}
                        />
                      ) : (
                        <circle
                          cx={shape.x + shape.width / 2}
                          cy={shape.y + shape.height / 2}
                          r={shape.width / 2}
                          fill={shape.color}
                          stroke={isSel ? '#0f172a' : 'none'}
                          strokeWidth={isSel ? 3 : 0}
                        />
                      )}
                      <text
                        x={shape.x + shape.width / 2}
                        y={shape.y + shape.height / 2 + 4}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="12"
                        fontWeight="600"
                      >
                        {shape.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        {/* MATH MODULE */}
        {mode === 'math' && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-5">
            {/* Left Column: Symbol Insertion Panel + Formula Presets */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-5 overflow-y-auto">
              <div>
                <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-2 mb-3">
                  <Sigma className="w-4 h-4 text-indigo-600" />
                  수식 기호 빠른 삽입 패널
                </h2>

                {/* Category 1: Calculus & Structures */}
                <div className="mb-3">
                  <div className="text-[11px] font-medium text-slate-500 mb-1.5">
                    미적분 · 급수 · 구조
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { symbol: '∑', label: '급수 합 (Sigma)', code: 'sum_{n=1}^{infinity} ' },
                      { symbol: '∫', label: '정적분 (Integral)', code: 'int_{a}^{b} ' },
                      { symbol: '∬', label: '이중적분', code: 'iint ' },
                      { symbol: '∮', label: '선적분', code: 'oint ' },
                      { symbol: 'lim', label: '극한 (Limit)', code: 'lim_{x toward 0} ' },
                      { symbol: '√x', label: '제곱근 (Sqrt)', code: 'sqrt{x} ' },
                      { symbol: 'a/b', label: '분수 (Fraction)', code: '{a} over {b} ' },
                      { symbol: 'xⁿ', label: '위첨자 (거듭제곱)', code: '^{2}' },
                      { symbol: 'xₙ', label: '아래첨자', code: '_{i}' },
                      { symbol: '∂', label: '편미분 (Partial)', code: 'partial ' },
                      { symbol: '∇', label: '나블라 (Nabla)', code: 'nabla ' },
                      { symbol: '∞', label: '무한대 (Infinity)', code: 'infinity ' },
                    ].map((item) => (
                      <button
                        key={item.symbol}
                        onClick={() => insertMathSymbol(item.code, item.label)}
                        title={`${item.label} 삽입: ${item.code.trim()}`}
                        className="h-9 rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-700 font-serif font-semibold text-sm text-slate-800 transition flex items-center justify-center shadow-2xs"
                      >
                        {item.symbol}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category 2: Operators & Relations */}
                <div className="mb-3">
                  <div className="text-[11px] font-medium text-slate-500 mb-1.5">
                    연산자 · 관계 기호
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {[
                      { symbol: '±', label: '플러스마이너스', code: '+- ' },
                      { symbol: '∓', label: '마이너스플러스', code: '-+ ' },
                      { symbol: '×', label: '곱셈', code: 'times ' },
                      { symbol: '÷', label: '나눗셈', code: 'div ' },
                      { symbol: '≠', label: '같지 않음', code: '<> ' },
                      { symbol: '≈', label: '근사값', code: 'approx ' },
                      { symbol: '≤', label: '작거나 같음', code: '<= ' },
                      { symbol: '≥', label: '크거나 같음', code: '>= ' },
                      { symbol: '→', label: '화살표', code: 'toward ' },
                      { symbol: '∈', label: '원소 포함', code: 'in ' },
                      { symbol: '⊂', label: '부분집합', code: 'subset ' },
                      { symbol: '()', label: '괄호 블록', code: '{(x)} ' },
                    ].map((item) => (
                      <button
                        key={item.symbol}
                        onClick={() => insertMathSymbol(item.code, item.label)}
                        title={`${item.label} 삽입: ${item.code.trim()}`}
                        className="h-8 rounded-md border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-700 font-serif font-semibold text-sm text-slate-800 transition flex items-center justify-center"
                      >
                        {item.symbol}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category 3: Greek Letters */}
                <div>
                  <div className="text-[11px] font-medium text-slate-500 mb-1.5">
                    그리스 문자 (Greek)
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {[
                      { symbol: 'π', label: '파이 (pi)', code: '%pi ' },
                      { symbol: 'α', label: '알파 (alpha)', code: '%alpha ' },
                      { symbol: 'β', label: '베타 (beta)', code: '%beta ' },
                      { symbol: 'γ', label: '감마 (gamma)', code: '%gamma ' },
                      { symbol: 'θ', label: '세타 (theta)', code: '%theta ' },
                      { symbol: 'λ', label: '람다 (lambda)', code: '%lambda ' },
                      { symbol: 'μ', label: '뮤 (mu)', code: '%mu ' },
                      { symbol: 'σ', label: '시그마 (sigma)', code: '%sigma ' },
                      { symbol: 'ω', label: '오메가 (omega)', code: '%omega ' },
                      { symbol: 'Δ', label: '델타 (Delta)', code: '%Delta ' },
                      { symbol: 'Σ', label: '대문자 시그마', code: '%Sigma ' },
                      { symbol: 'Ω', label: '대문자 오메가', code: '%Omega ' },
                    ].map((item) => (
                      <button
                        key={item.symbol}
                        onClick={() => insertMathSymbol(item.code, item.label)}
                        title={`${item.label} 삽입: ${item.code.trim()}`}
                        className="h-8 rounded-md border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-700 font-serif text-sm text-slate-800 transition flex items-center justify-center"
                      >
                        {item.symbol}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h3 className="font-semibold text-slate-900 text-xs mb-2">
                  자주 쓰는 수식 템플릿
                </h3>
                <div className="space-y-2">
                  {[
                    {
                      name: '가우스 정규분포 (Gaussian Distribution)',
                      code: 'f(x) = {1} over {sigma sqrt{2 %pi}} e^{- {{(x - %mu)^2} over {2 %sigma^2}}}',
                    },
                    {
                      name: '이차방정식 근의 공식 (Quadratic Formula)',
                      code: 'x = {-b +- sqrt{b^2 - 4ac}} over {2a}',
                    },
                    {
                      name: '오일러 항등식 (Euler’s Identity)',
                      code: 'e^{i %pi} + 1 = 0',
                    },
                    {
                      name: '정적분 (Definite Integral)',
                      code: 'int_{0}^{%pi} sin(x) dx = 2',
                    },
                    {
                      name: '리만 제타 급수 (Riemann Series Sum)',
                      code: 'sum_{n=1}^{infinity} {1} over {n^2} = {%pi^2} over {6}',
                    },
                  ].map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => {
                        updateMathFormulaWithHistory(preset.code, `템플릿 적용: ${preset.name}`);
                        setStatusMessage(`템플릿 적용됨: ${preset.name}`);
                      }}
                      className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition"
                    >
                      <div className="text-xs font-semibold text-slate-800">{preset.name}</div>
                      <div className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                        {preset.code}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Center 2 Columns: Rendered Formula & StarMath Command Editor */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex-1 flex flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    OpenOffice Math — 실시간 수식 미리보기
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Preview Alignment Selector (좌측, 중앙, 우측) */}
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      {(
                        [
                          { align: 'left', label: '좌측', Icon: AlignLeft },
                          { align: 'center', label: '중앙', Icon: AlignCenter },
                          { align: 'right', label: '우측', Icon: AlignRight },
                        ] as const
                      ).map(({ align, label, Icon }) => (
                        <button
                          key={align}
                          onClick={() => {
                            setMathPreviewAlign(align);
                            setStatusMessage(`수식 미리보기 정렬: ${label} 정렬 적용됨`);
                          }}
                          title={`수식 미리보기 ${label} 정렬`}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition ${
                            mathPreviewAlign === align
                              ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200/80'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>

                    {/* LaTeX 미리보기 토글 버튼 */}
                    <button
                      onClick={() => {
                        const next = !showLatexPreview;
                        setShowLatexPreview(next);
                        setStatusMessage(
                          next
                            ? 'LaTeX 미리보기가 활성화되었습니다.'
                            : 'LaTeX 미리보기가 비활성화되었습니다.'
                        );
                      }}
                      title="작성한 StarMath 수식을 LaTeX 문법으로 변환하여 미리보기"
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        showLatexPreview
                          ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-2xs'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/70'
                      }`}
                    >
                      <FileCode2 className="w-3.5 h-3.5" />
                      <span>LaTeX 미리보기</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                          showLatexPreview
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-300 text-slate-700'
                        }`}
                      >
                        {showLatexPreview ? 'ON' : 'OFF'}
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        setIsMathExportMenuOpen(false);
                        setIsMathPdfPromptOpen(true);
                      }}
                      className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-xs transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export to PDF
                    </button>

                    {/* Batch Convert (다중 수식 텍스트 파일 → 단일 PDF 일괄 변환) 버튼 */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsMathExportMenuOpen(false);
                        setIsMathBatchModalOpen(true);
                      }}
                      title="여러 개의 StarMath 수식이 담긴 텍스트 파일(.txt)을 업로드하여 수식마다 페이지가 구분된 단일 PDF로 일괄 변환합니다"
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-xs transition"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>일괄 변환 (Batch PDF)</span>
                      <span className="bg-emerald-800/80 text-emerald-100 text-[10px] font-mono px-1.5 py-0.2 rounded">
                        {parsedBatchFormulas.length}p
                      </span>
                    </button>

                    {/* 기타 형식으로 내보내기 (PNG / SVG / PDF / Batch PDF) 드롭다운 메뉴 */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsMathExportMenuOpen((prev) => !prev)}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                          isMathExportMenuOpen
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                        }`}
                        title="PDF 외에 PNG 이미지 또는 SVG 벡터 형식으로 수식 다운로드"
                      >
                        <Download className="w-3.5 h-3.5 text-indigo-600" />
                        <span>기타 형식으로 내보내기</span>
                      </button>

                      {isMathExportMenuOpen && (
                        <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30">
                          <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            수식 내보내기 형식 선택
                          </div>

                          <button
                            type="button"
                            onClick={handleExportMathPng}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-indigo-50/70 flex items-start gap-2.5 transition"
                          >
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold shrink-0 mt-0.5">
                              PNG
                            </span>
                            <div>
                              <div className="text-xs font-semibold text-slate-800">
                                PNG 이미지로 다운로드 (.png)
                              </div>
                              <div className="text-[11px] text-slate-500">
                                고해상도(2x DPI) 래스터 수식 이미지
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={handleExportMathSvg}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-indigo-50/70 flex items-start gap-2.5 transition"
                          >
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-mono text-[10px] font-bold shrink-0 mt-0.5">
                              SVG
                            </span>
                            <div>
                              <div className="text-xs font-semibold text-slate-800">
                                SVG 벡터로 다운로드 (.svg)
                              </div>
                              <div className="text-[11px] text-slate-500">
                                확대해도 깨지지 않는 표준 벡터 그래픽
                              </div>
                            </div>
                          </button>

                          <div className="border-t border-slate-100 mt-1 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setIsMathExportMenuOpen(false);
                                setIsMathPdfPromptOpen(true);
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-indigo-50/70 flex items-start gap-2.5 transition"
                            >
                              <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-mono text-[10px] font-bold shrink-0 mt-0.5">
                                PDF
                              </span>
                              <div>
                                <div className="text-xs font-semibold text-slate-800">
                                  PDF 문서로 내보내기 (.pdf)
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  사용자 지정 머리글 제목 포함 문서
                                </div>
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setIsMathExportMenuOpen(false);
                                setIsMathBatchModalOpen(true);
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-emerald-50/80 flex items-start gap-2.5 transition"
                            >
                              <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-mono text-[10px] font-bold shrink-0 mt-0.5">
                                BATCH
                              </span>
                              <div>
                                <div className="text-xs font-semibold text-slate-800">
                                  다중 수식 파일 일괄 PDF 변환
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  .txt 업로드 → 수식별 페이지 구분 단일 PDF
                                </div>
                              </div>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 여백/간격 설정 제어 패널 (Margin & Spacing Sliders & Presets) */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      여백 / 간격 설정 (수식 배치 여백 조절)
                    </span>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 font-medium mr-0.5">
                        간격 프리셋:
                      </span>
                      {[
                        { name: '콤팩트', py: 16, px: 16, desc: '상하 16px · 좌우 16px' },
                        { name: '표준', py: 40, px: 32, desc: '상하 40px · 좌우 32px' },
                        { name: '확장', py: 64, px: 56, desc: '상하 64px · 좌우 56px' },
                      ].map((preset) => {
                        const isActive =
                          mathPaddingY === preset.py && mathPaddingX === preset.px;
                        return (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => {
                              setMathPaddingY(preset.py);
                              setMathPaddingX(preset.px);
                              setStatusMessage(
                                `수식 여백 프리셋 '${preset.name}' 적용됨 (${preset.desc})`
                              );
                            }}
                            title={`${preset.name} 간격 프리셋 (${preset.desc})`}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition ${
                              isActive
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                : 'bg-white hover:bg-indigo-50 text-slate-700 border-slate-200 hover:border-indigo-300'
                            }`}
                          >
                            {preset.name}
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => {
                          setMathPaddingY(40);
                          setMathPaddingX(32);
                          setStatusMessage('수식 위아래(40px) 및 좌우(32px) 여백을 기본값으로 초기화했습니다.');
                        }}
                        className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 hover:underline ml-1 transition"
                      >
                        기본값 초기화
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Vertical Margin Slider (위아래 여백) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">위아래(상하) 여백</span>
                        <span className="font-mono font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded text-[11px]">
                          {mathPaddingY}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={8}
                        max={80}
                        step={8}
                        value={mathPaddingY}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setMathPaddingY(val);
                          setStatusMessage(`수식 위아래 여백: ${val}px`);
                        }}
                        className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                      />
                    </div>

                    {/* Horizontal Margin Slider (좌우 여백) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">좌우 여백</span>
                        <span className="font-mono font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded text-[11px]">
                          {mathPaddingX}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={8}
                        max={80}
                        step={8}
                        value={mathPaddingX}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setMathPaddingX(val);
                          setStatusMessage(`수식 좌우 여백: ${val}px`);
                        }}
                        className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex items-center justify-center">
                  <div
                    className={`w-full text-2xl md:text-3xl font-serif text-slate-900 bg-slate-50 rounded-xl border border-slate-200 break-all transition-all ${
                      mathPreviewAlign === 'left'
                        ? 'text-left'
                        : mathPreviewAlign === 'right'
                        ? 'text-right'
                        : 'text-center'
                    } ${
                      (
                        {
                          8: 'py-2',
                          16: 'py-4',
                          24: 'py-6',
                          32: 'py-8',
                          40: 'py-10',
                          48: 'py-12',
                          56: 'py-14',
                          64: 'py-16',
                          72: 'py-20',
                          80: 'py-24',
                        } as Record<number, string>
                      )[mathPaddingY] || 'py-10'
                    } ${
                      (
                        {
                          8: 'px-2',
                          16: 'px-4',
                          24: 'px-6',
                          32: 'px-8',
                          40: 'px-10',
                          48: 'px-12',
                          56: 'px-14',
                          64: 'px-16',
                          72: 'px-20',
                          80: 'px-24',
                        } as Record<number, string>
                      )[mathPaddingX] || 'px-8'
                    }`}
                  >
                    {formattedMathPreview || '수식을 입력하거나 왼쪽 기호 버튼을 클릭하세요'}
                  </div>
                </div>

                {/* LaTeX 문법 변환 미리보기 패널 (토글 활성화 시 표시) */}
                {showLatexPreview && (
                  <div className="mt-4 bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                          <FileCode2 className="w-3.5 h-3.5 text-amber-700" />
                          LaTeX 변환 미리보기 (StarMath → LaTeX)
                        </span>
                        <span className="text-[11px] text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded font-mono">
                          실시간 자동 변환
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            if (!convertedLatexPreview) return;
                            navigator.clipboard?.writeText(convertedLatexPreview);
                            setStatusMessage('변환된 LaTeX 수식 코드가 클립보드에 복사되었습니다.');
                          }}
                          className="text-[11px] font-semibold bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-md transition"
                        >
                          LaTeX 코드 복사
                        </button>
                        <button
                          onClick={() => {
                            if (!convertedLatexPreview) return;
                            navigator.clipboard?.writeText(`$$${convertedLatexPreview}$$`);
                            setStatusMessage('디스플레이 수식($$...$$) 형태로 클립보드에 복사되었습니다.');
                          }}
                          className="text-[11px] font-semibold bg-amber-700 hover:bg-amber-800 text-white px-2.5 py-1 rounded-md transition"
                        >
                          $$...$$ 복사
                        </button>
                      </div>
                    </div>

                    <div className="font-mono text-xs bg-slate-900 text-amber-300 p-3 rounded-lg border border-slate-800 break-all select-all">
                      {convertedLatexPreview || '% 변환할 StarMath 수식을 입력하세요'}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 relative">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600">
                      StarMath 수식 명령어 입력창 (커서 위치에 기호가 바로 삽입됩니다)
                    </span>
                    <span className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-medium">
                      자동완성 지원 (예: sum, sqrt, int, over, pi)
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleMathUndo}
                      disabled={!canMathUndo}
                      title="이전 수식 상태로 되돌리기 (Undo, Ctrl+Z)"
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border transition ${
                        canMathUndo
                          ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                          : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      }`}
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Undo</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleMathRedo}
                      disabled={!canMathRedo}
                      title="다음 수식 상태로 다시 실행 (Redo, Ctrl+Y)"
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border transition ${
                        canMathRedo
                          ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                          : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      }`}
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>Redo</span>
                    </button>
                    <button
                      onClick={() => {
                        updateMathFormulaWithHistory('', '수식 전체 지우기');
                        setIsMathAutocompleteOpen(false);
                        setStatusMessage('수식 입력창을 비웠습니다.');
                      }}
                      className="text-xs text-slate-500 hover:text-red-600 px-2 py-1 transition"
                    >
                      전체 지우기
                    </button>
                  </div>
                </div>

                {/* StarMath Autocomplete Popup */}
                {isMathAutocompleteOpen && mathAutocompleteSuggestions.length > 0 && (
                  <div className="mb-2.5 bg-slate-900 border border-indigo-500/70 rounded-xl shadow-lg overflow-hidden">
                    <div className="bg-slate-800/90 px-3 py-1.5 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5 text-indigo-300 font-semibold">
                        <span>StarMath 문법 자동완성 제안</span>
                        <span className="bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 px-1.5 py-0.2 rounded font-mono">
                          "{mathAutocompleteQuery}"
                        </span>
                      </div>
                      <div className="text-slate-400 font-mono text-[10px]">
                        ↑↓ 이동 · Enter/Tab 선택 · Esc 닫기
                      </div>
                    </div>

                    <div className="divide-y divide-slate-800/80 max-h-52 overflow-y-auto">
                      {mathAutocompleteSuggestions.map((item, idx) => {
                        const isSelected = idx === mathAutocompleteIndex;
                        return (
                          <button
                            key={`${item.keyword}-${idx}`}
                            type="button"
                            onMouseDown={(e) => {
                              // Prevent textarea blur before applying suggestion
                              e.preventDefault();
                              applyMathAutocompleteSuggestion(item);
                            }}
                            onMouseEnter={() => setMathAutocompleteIndex(idx)}
                            className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 transition ${
                              isSelected
                                ? 'bg-indigo-600/30 text-white'
                                : 'hover:bg-slate-800/70 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-serif text-sm text-amber-300 shrink-0">
                                {item.symbol}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-emerald-300">
                                    {item.keyword}
                                  </span>
                                  <span className="text-xs text-slate-200 truncate">
                                    {item.label}
                                  </span>
                                </div>
                                <div className="font-mono text-[11px] text-slate-400 truncate">
                                  삽입 구문: <span className="text-indigo-300">{item.snippet}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                {item.category}
                              </span>
                              {isSelected && (
                                <span className="text-[10px] font-mono bg-indigo-600 text-white px-1.5 py-0.5 rounded">
                                  Enter ↵
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <textarea
                  ref={mathTextareaRef}
                  value={mathFormula}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    const caret = e.target.selectionStart ?? nextVal.length;
                    updateMathFormulaWithHistory(nextVal, '수식 직접 타이핑', true);
                    handleMathInputWithAutocomplete(nextVal, caret);
                  }}
                  onKeyDown={(e) => {
                    // Keyboard shortcuts for Undo (Ctrl+Z) and Redo (Ctrl+Y or Ctrl+Shift+Z)
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                      e.preventDefault();
                      if (e.shiftKey) {
                        handleMathRedo();
                      } else {
                        handleMathUndo();
                      }
                      return;
                    }
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                      e.preventDefault();
                      handleMathRedo();
                      return;
                    }

                    if (isMathAutocompleteOpen && mathAutocompleteSuggestions.length > 0) {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setMathAutocompleteIndex(
                          (prev) => (prev + 1) % mathAutocompleteSuggestions.length
                        );
                        return;
                      }
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setMathAutocompleteIndex(
                          (prev) =>
                            (prev - 1 + mathAutocompleteSuggestions.length) %
                            mathAutocompleteSuggestions.length
                        );
                        return;
                      }
                      if (e.key === 'Enter' || e.key === 'Tab') {
                        e.preventDefault();
                        const chosen =
                          mathAutocompleteSuggestions[mathAutocompleteIndex] ||
                          mathAutocompleteSuggestions[0];
                        if (chosen) {
                          applyMathAutocompleteSuggestion(chosen);
                        }
                        return;
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        setIsMathAutocompleteOpen(false);
                        return;
                      }
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setIsMathAutocompleteOpen(false), 150);
                  }}
                  rows={4}
                  placeholder="예: sum, sqrt, int, over, lim 등을 입력하면 StarMath 자동완성 팝업이 표시됩니다"
                  className="w-full font-mono text-xs bg-slate-900 text-emerald-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 작업 히스토리 (Work History & Undo/Redo Timeline) 패널 */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <History className="w-4 h-4 text-indigo-600" />
                      작업 히스토리 (자동 변경 기록 및 복원)
                    </h3>
                    <span className="text-[11px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                      단계 {mathHistoryIndex + 1} / {mathHistory.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleMathUndo}
                      disabled={!canMathUndo}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                        canMathUndo
                          ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200'
                          : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      }`}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      실행 취소 (Undo)
                    </button>
                    <button
                      type="button"
                      onClick={handleMathRedo}
                      disabled={!canMathRedo}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                        canMathRedo
                          ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200'
                          : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      }`}
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      다시 실행 (Redo)
                    </button>
                    {mathHistory.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const currentSnap: MathHistoryEntry = {
                            id: `hist-reset-${Date.now()}`,
                            formula: mathFormula,
                            actionLabel: '히스토리 기준점 재설정',
                            timestamp: new Date().toLocaleTimeString('ko-KR', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            }),
                          };
                          setMathHistory([currentSnap]);
                          setMathHistoryIndex(0);
                          setMathHistorySearchQuery('');
                          setStatusMessage('작업 히스토리를 현재 수식 기준으로 정리했습니다.');
                        }}
                        className="text-[11px] text-slate-500 hover:text-red-600 px-2 py-1 transition"
                      >
                        기록 비우기
                      </button>
                    )}
                  </div>
                </div>

                {/* 작업 히스토리 실시간 키워드 검색 및 필터링 입력창 */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      value={mathHistorySearchQuery}
                      onChange={(e) => setMathHistorySearchQuery(e.target.value)}
                      placeholder="히스토리 검색 (작업명, 수식 코드, 단계 #번호, 시간)..."
                      className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
                    />
                    {mathHistorySearchQuery && (
                      <button
                        type="button"
                        onClick={() => setMathHistorySearchQuery('')}
                        title="검색어 지우기"
                        className="absolute right-2 top-1.5 text-xs text-slate-400 hover:text-slate-700 px-1"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {mathHistorySearchQuery.trim() && (
                    <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg shrink-0">
                      검색 결과 {filteredMathHistory.length}건
                    </span>
                  )}
                </div>

                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                  {filteredMathHistory.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded-xl">
                      '{mathHistorySearchQuery}' 키워드와 일치하는 작업 히스토리 내역이 없습니다.
                    </div>
                  ) : (
                    filteredMathHistory.map(({ entry, actualIdx }) => {
                      const isCurrent = actualIdx === mathHistoryIndex;
                      const isFuture = actualIdx > mathHistoryIndex;

                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => handleJumpToMathHistory(actualIdx)}
                          className={`w-full text-left px-3 py-2 rounded-lg border flex items-center justify-between gap-3 transition ${
                            isCurrent
                              ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 shadow-2xs'
                              : isFuture
                              ? 'bg-slate-50/50 border-dashed border-slate-200 text-slate-400 hover:bg-slate-100'
                              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                  isCurrent
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                #{actualIdx + 1}
                              </span>
                              <span className="text-xs font-semibold truncate">
                                {entry.actionLabel}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                {entry.timestamp}
                              </span>
                            </div>
                            <div className="font-mono text-[11px] text-slate-500 truncate mt-0.5">
                              {entry.formula || '(빈 수식)'}
                            </div>
                          </div>

                          <div className="shrink-0">
                            {isCurrent ? (
                              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                                현재 상태
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-slate-500 hover:text-indigo-600">
                                이 상태로 복원
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Right Dedicated Side Panel: Favorites with Folder Management */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                      수식 즐겨찾기
                    </h2>
                    <span className="text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                      총 {mathFavorites.length}개
                    </span>
                  </div>

                  {/* Quick Search Input for Favorites (수식 이름 또는 내용 검색) */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      value={favoriteSearchQuery}
                      onChange={(e) => setFavoriteSearchQuery(e.target.value)}
                      placeholder="수식 이름 또는 내용(코드) 검색..."
                      className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition"
                    />
                    {favoriteSearchQuery && (
                      <button
                        onClick={() => setFavoriteSearchQuery('')}
                        title="검색어 지우기"
                        className="absolute right-2 top-1.5 text-xs text-slate-400 hover:text-slate-700 px-1"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* Folder Creation & Folder Filter Tabs */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                  <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-indigo-600" />
                    폴더별 분류 관리
                  </div>

                  {/* New Folder Input */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateMathFolder();
                      }}
                      placeholder="새 폴더명 (예: 미적분학)"
                      className="flex-1 min-w-0 text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={handleCreateMathFolder}
                      className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shrink-0 transition"
                      title="새 폴더 생성"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      폴더 추가
                    </button>
                  </div>

                  {/* Folder Filter Pills */}
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    <button
                      onClick={() => setActiveFavoriteFolder('전체')}
                      className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition ${
                        activeFavoriteFolder === '전체'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      전체 ({mathFavorites.length})
                    </button>
                    {mathFolders.map((folder) => {
                      const count = mathFavorites.filter((f) => f.folder === folder).length;
                      const isActive = activeFavoriteFolder === folder;
                      return (
                        <div key={folder} className="inline-flex items-center">
                          <button
                            onClick={() => {
                              setActiveFavoriteFolder(folder);
                              setSelectedSaveFolder(folder);
                            }}
                            className={`text-[11px] px-2.5 py-1 rounded-l-md font-medium transition flex items-center gap-1 ${
                              isActive
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <span>{folder}</span>
                            <span
                              className={`text-[10px] ${
                                isActive ? 'text-indigo-200' : 'text-slate-400'
                              }`}
                            >
                              ({count})
                            </span>
                          </button>
                          {mathFolders.length > 1 && (
                            <button
                              onClick={() => handleDeleteMathFolder(folder)}
                              title={`'${folder}' 폴더 삭제`}
                              className={`px-1.5 py-1 rounded-r-md text-[10px] border-y border-r transition ${
                                isActive
                                  ? 'bg-indigo-700 border-indigo-700 text-indigo-200 hover:text-white'
                                  : 'bg-white border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50'
                              }`}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Save Current Formula to Selected Folder Form */}
                <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-900">
                      현재 수식 즐겨찾기 저장
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-amber-800 shrink-0">
                      저장 폴더:
                    </span>
                    <select
                      value={selectedSaveFolder}
                      onChange={(e) => setSelectedSaveFolder(e.target.value)}
                      className="flex-1 text-xs bg-white border border-amber-300 rounded-lg px-2 py-1 text-slate-800 font-medium focus:outline-none focus:border-amber-500"
                    >
                      {mathFolders.map((folder) => (
                        <option key={folder} value={folder}>
                          📁 {folder}
                        </option>
                      ))}
                    </select>
                  </div>

                  <input
                    type="text"
                    value={newFavoriteName}
                    onChange={(e) => setNewFavoriteName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddMathFavorite();
                    }}
                    placeholder="수식 이름 (예: 맥스웰 방정식)"
                    className="w-full text-xs bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={handleAddMathFavorite}
                    className="w-full flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold py-1.5 px-3 rounded-lg shadow-2xs transition"
                  >
                    <Star className="w-3.5 h-3.5 fill-white" />
                    '{selectedSaveFolder}' 폴더에 추가
                  </button>
                </div>

                {/* Filtered Favorites List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                    <span>
                      {activeFavoriteFolder === '전체'
                        ? '전체 폴더 수식 목록'
                        : `📁 '${activeFavoriteFolder}' 폴더 수식 목록`}
                      {favoriteSearchQuery.trim() && ` (${filteredMathFavorites.length}건 일치)`}
                    </span>
                    <span>클릭 시 불러오기</span>
                  </div>

                  {filteredMathFavorites.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-8 border border-dashed border-slate-200 rounded-xl">
                      {favoriteSearchQuery.trim() ? (
                        <>
                          '{favoriteSearchQuery}' 검색 결과가 없습니다.
                          <br />
                          다른 수식 이름이나 기호로 검색해보세요.
                        </>
                      ) : (
                        <>
                          이 폴더에 저장된 수식이 없습니다.
                          <br />위에서 폴더를 선택해 수식을 추가해보세요.
                        </>
                      )}
                    </div>
                  ) : (
                    filteredMathFavorites.map((fav) => (
                      <div
                        key={fav.id}
                        className="group relative rounded-xl border border-slate-200 hover:border-amber-400 bg-slate-50/60 hover:bg-amber-50/30 p-3 transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            onClick={() => {
                              updateMathFormulaWithHistory(
                                fav.code,
                                `즐겨찾기 불러오기: [${fav.folder}] ${fav.name}`
                              );
                              setStatusMessage(
                                `[${fav.folder}] '${fav.name}' 수식을 불러왔습니다.`
                              );
                            }}
                            className="flex-1 text-left focus:outline-none"
                            title="클릭하여 이 수식을 편집기로 불러오기"
                          >
                            <div className="text-xs font-semibold text-slate-800 group-hover:text-amber-800 flex items-center gap-1">
                              <Star className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
                              <span className="truncate">{fav.name}</span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 break-all line-clamp-2 mt-1">
                              {fav.code}
                            </div>
                          </button>

                          <button
                            onClick={() => handleRemoveMathFavorite(fav.id, fav.name)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition shrink-0"
                            title="즐겨찾기 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-slate-200/70 text-[10px] text-slate-400">
                          <select
                            value={fav.folder}
                            onChange={(e) =>
                              handleMoveFavoriteFolder(fav.id, e.target.value)
                            }
                            title="소속 폴더 변경"
                            className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px] text-slate-600 font-medium focus:outline-none focus:border-indigo-400"
                          >
                            {mathFolders.map((folder) => (
                              <option key={folder} value={folder}>
                                📁 {folder}
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={() => insertMathSymbol(fav.code + ' ', fav.name)}
                            className="text-indigo-600 hover:underline font-medium shrink-0"
                          >
                            + 커서 이어붙이기
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                폴더 및 즐겨찾기 수식은 브라우저에 자동 저장됩니다.
              </div>
            </div>

            {/* PDF Header Title Prompt Modal */}
            {isMathPdfPromptOpen && (
              <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      PDF 머리글 문서 제목 입력
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      생성될 수식 PDF 상단 머리글(Header)에 표시할 문서 제목을 입력하세요.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      문서 제목 (PDF Header)
                    </label>
                    <input
                      type="text"
                      value={mathPdfTitle}
                      onChange={(e) => setMathPdfTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleExportMathPdf(mathPdfTitle);
                        } else if (e.key === 'Escape') {
                          setIsMathPdfPromptOpen(false);
                        }
                      }}
                      placeholder="예: 2026 미적분학 수식 정리 노트"
                      autoFocus
                      className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => setIsMathPdfPromptOpen(false)}
                      className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                    >
                      취소
                    </button>
                    <button
                      onClick={() => handleExportMathPdf(mathPdfTitle)}
                      className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg shadow-xs transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      PDF 다운로드
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Batch Convert Modal (다중 StarMath 수식 텍스트 파일 업로드 → 페이지 구분 단일 PDF 일괄 변환) */}
            {isMathBatchModalOpen && (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                  {/* Modal Header */}
                  <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
                        <Layers className="w-5 h-5" />
                      </span>
                      <div>
                        <h3 className="text-base font-bold flex items-center gap-2">
                          <span>다중 StarMath 수식 일괄 PDF 변환 (Batch Convert)</span>
                          <span className="text-[11px] bg-emerald-500 text-slate-950 font-extrabold px-2 py-0.5 rounded-full">
                            총 {parsedBatchFormulas.length}페이지 (수식별 페이지 구분)
                          </span>
                        </h3>
                        <p className="text-xs text-slate-300 mt-0.5">
                          여러 개의 StarMath 수식이 담긴 텍스트 파일(.txt, .mml, .math)을 업로드하면, 각 수식을 페이지 나누기(Page Break)로 구분하여 단일 PDF 문서로 변환합니다.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsMathBatchModalOpen(false)}
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition"
                    >
                      닫기 (ESC)
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 overflow-y-auto space-y-5 flex-1">
                    {/* Top Action Bar: Upload .txt file + Sample file download + Add current/favorites */}
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-emerald-950 flex items-center gap-2">
                          <Upload className="w-4 h-4 text-emerald-700" />
                          <span>1단계: 다중 StarMath 수식 텍스트 파일(.txt) 업로드</span>
                          {mathBatchUploadedFileName && (
                            <span className="font-mono text-[11px] bg-white text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded">
                              현재 파일: {mathBatchUploadedFileName}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-emerald-800">
                          줄바꿈(1줄당 1수식)으로 구분된 텍스트 파일을 선택하세요. <code className="font-mono bg-white/80 px-1 rounded"># 수식 제목</code> 주석이나 <code className="font-mono bg-white/80 px-1 rounded">제목 :: 수식</code> 형식도 자동으로 인식합니다.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={mathBatchFileInputRef}
                          type="file"
                          accept=".txt,.mml,.math,.csv"
                          onChange={handleBatchFileUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => mathBatchFileInputRef.current?.click()}
                          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-xs transition cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>텍스트 파일 업로드 (.txt)</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleDownloadSampleBatchTxt}
                          className="flex items-center gap-1.5 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-semibold px-3 py-2 rounded-lg transition"
                          title="업로드 테스트용 다중 StarMath 수식 샘플 .txt 파일을 내 컴퓨터로 받습니다"
                        >
                          <Download className="w-3.5 h-3.5 text-emerald-700" />
                          <span>샘플 .txt 파일 받기</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const favLines = mathFavorites
                              .map((f) => `# ${f.name} (${f.folder})\n${f.code}`)
                              .join('\n\n');
                            setMathBatchRawText((prev) =>
                              prev.trim() ? `${prev.trim()}\n\n${favLines}` : favLines
                            );
                            setStatusMessage(
                              `즐겨찾기 수식 ${mathFavorites.length}개를 일괄 변환 목록에 추가했습니다.`
                            );
                          }}
                          className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold px-3 py-2 rounded-lg transition"
                        >
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                          <span>즐겨찾기 수식 전체 추가</span>
                        </button>
                      </div>
                    </div>

                    {/* PDF Document Title Input */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        2단계: 통합 PDF 문서 머리글 제목 (각 페이지 상단 헤더에 표시)
                      </label>
                      <input
                        type="text"
                        value={mathBatchDocTitle}
                        onChange={(e) => setMathBatchDocTitle(e.target.value)}
                        placeholder="예: 2026 공학수학 핵심 StarMath 수식 모음집"
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Two-Column Split: Left = Raw StarMath Batch Textarea, Right = Page-by-Page Preview List */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Left: Editable Batch StarMath Source */}
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700">
                            다중 StarMath 수식 원본 (줄바꿈으로 수식 구분)
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (!mathFormula.trim()) return;
                                setMathBatchRawText((prev) =>
                                  prev.trim()
                                    ? `${prev.trim()}\n\n# 현재 편집기 수식\n${mathFormula.trim()}`
                                    : `# 현재 편집기 수식\n${mathFormula.trim()}`
                                );
                              }}
                              className="text-[11px] font-semibold text-indigo-600 hover:underline"
                            >
                              + 현재 편집기 수식 추가
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMathBatchRawText(DEFAULT_BATCH_STARMATH_TEXT);
                                setMathBatchUploadedFileName('sample_starmath_formulas.txt');
                              }}
                              className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
                            >
                              기본 샘플 복원
                            </button>
                          </div>
                        </div>

                        <textarea
                          value={mathBatchRawText}
                          onChange={(e) => setMathBatchRawText(e.target.value)}
                          rows={12}
                          placeholder={'# 수식 1 제목\na^{2} + b^{2} = c^{2}\n\n# 수식 2 제목\nx = {-b +- sqrt{b^2 - 4ac}} over {2a}'}
                          className="w-full flex-1 font-mono text-xs bg-slate-900 text-emerald-300 p-3.5 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      {/* Right: Page-by-Page Formula Preview (Shows Page 1, Page 2, ... with Page Breaks) */}
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700">
                            페이지별 수식 변환 미리보기 (1수식 = 1페이지 자동 분할)
                          </span>
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            총 {parsedBatchFormulas.length}페이지 생성 예정
                          </span>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-72 overflow-y-auto space-y-2.5">
                          {parsedBatchFormulas.length === 0 ? (
                            <div className="text-xs text-slate-400 text-center py-12">
                              변환할 StarMath 수식이 없습니다. 왼쪽 입력창에 수식을 입력하거나 .txt 파일을 업로드하세요.
                            </div>
                          ) : (
                            parsedBatchFormulas.map((item, idx) => (
                              <div key={item.id} className="space-y-2">
                                {idx > 0 && (
                                  <div className="flex items-center gap-2 py-0.5">
                                    <div className="flex-1 border-t border-dashed border-slate-300" />
                                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                                      ✂ Page Break (페이지 나누기 — Page {idx + 1})
                                    </span>
                                    <div className="flex-1 border-t border-dashed border-slate-300" />
                                  </div>
                                )}

                                <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-2xs space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="bg-indigo-600 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded shrink-0">
                                        Page {idx + 1}
                                      </span>
                                      <span className="text-xs font-bold text-slate-800 truncate">
                                        {item.title}
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        updateMathFormulaWithHistory(
                                          item.formula,
                                          `일괄 변환 목록 #${idx + 1} 수식 불러오기`
                                        );
                                        setIsMathBatchModalOpen(false);
                                        setStatusMessage(
                                          `일괄 변환 목록의 Page ${idx + 1} ('${item.title}') 수식을 편집기로 불러왔습니다.`
                                        );
                                      }}
                                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline shrink-0"
                                    >
                                      편집기로 열기
                                    </button>
                                  </div>

                                  <div className="text-base font-serif text-slate-900 bg-slate-50 border border-slate-200/80 rounded px-3 py-2 text-center break-all">
                                    {item.rendered}
                                  </div>

                                  <div className="text-[11px] font-mono text-slate-500 truncate">
                                    StarMath: <span className="text-slate-700">{item.formula}</span>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">
                      각 수식은 현재 설정된 정렬(<strong>{mathPreviewAlign}</strong>) 및 여백(<strong>{mathPaddingY}px / {mathPaddingX}px</strong>) 규격으로 개별 페이지에 렌더링됩니다.
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsMathBatchModalOpen(false)}
                        className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white transition"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        disabled={parsedBatchFormulas.length === 0}
                        onClick={handleBatchConvertPdf}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold px-5 py-2 rounded-lg shadow-sm transition cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>
                          단일 PDF로 일괄 변환 및 다운로드 ({parsedBatchFormulas.length}페이지)
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Apache OpenOffice Desktop HWP Extension Manual Addition Guide Modal */}
      {isManualInstallModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-sky-900 via-sky-800 to-indigo-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-sky-500/30 border border-sky-400/40 px-2.5 py-0.5 rounded-full text-sky-200 mb-1">
                  데스크톱 오픈오피스 수동 설치 안내
                </div>
                <h3 className="text-base sm:text-lg font-bold">
                  오픈오피스에 한글(.hwp/.hwpx) 편집기 수동 추가 방법
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsManualInstallModalOpen(false)}
                className="text-slate-300 hover:text-white text-sm font-bold px-2.5 py-1 rounded-md hover:bg-white/10 transition"
              >
                닫기 ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto text-xs text-slate-700">
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
                <p className="text-sky-950 font-medium leading-relaxed">
                  오픈오피스에는 기본적으로 외부 기능을 추가할 수 있는 <strong>[확장 관리자 (Extension Manager)]</strong>가 탑재되어 있습니다. 
                  아래 안내에 따라 <strong>한글 확장팩(<code>.oxt</code>)</strong>을 선택하시면 오픈오피스 상단 메뉴바에 <strong>[한글(.hwp/.hwpx)]</strong> 항목이 즉시 생성됩니다.
                </p>
              </div>

              {/* Step-by-Step Guide */}
              <div className="space-y-3">
                <div className="flex gap-3 items-start p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="w-6 h-6 rounded-full bg-sky-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs mb-0.5">
                      오픈오피스 실행 후 [확장 관리자] 메뉴 열기
                    </h4>
                    <p className="text-slate-600 leading-relaxed">
                      PC에 설치된 Apache OpenOffice를 실행한 뒤, 상단 메뉴바에서 <strong>[도구 (Tools)] &gt; [확장 관리자... (Extension Manager...)]</strong>를 클릭합니다. (단축키: <code>Ctrl + Alt + E</code>)
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="w-6 h-6 rounded-full bg-sky-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs mb-0.5">
                      창 하단의 [추가 (Add...)] 버튼 클릭
                    </h4>
                    <p className="text-slate-600 leading-relaxed">
                      확장 관리자 대화상자 창의 하단에 위치한 <strong>[추가(Add...)]</strong> 버튼을 클릭합니다.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="w-6 h-6 rounded-full bg-sky-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs mb-0.5">
                      한글 확장팩 파일 (Apache_OpenOffice_HWP_Extension_v{HWP_PLUGIN_MANIFEST.pluginVersion}.oxt) 선택
                    </h4>
                    <p className="text-slate-600 leading-relaxed">
                      파일 선택 창에서 다운로드하신 <strong><code>Apache_OpenOffice_HWP_Extension_v{HWP_PLUGIN_MANIFEST.pluginVersion}.oxt</code></strong> 파일을 선택하고 <strong>[열기]</strong>를 누릅니다.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="w-6 h-6 rounded-full bg-sky-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    4
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs mb-0.5">
                      사용권 계약 [수락] 및 오픈오피스 재실행
                    </h4>
                    <p className="text-slate-600 leading-relaxed">
                      확장 소프트웨어 사용권 계약 화면이 나타나면 스크롤을 내린 후 <strong>[수락(Accept)]</strong>을 클릭합니다. 설치가 끝나면 <strong>[닫기]</strong>를 누르고, 실행 중인 오픈오피스를 완전히 종료한 후 다시 실행하면 상단 메뉴바에 <strong>[한글(.hwp/.hwpx)]</strong> 및 <strong>[파일 &gt; 한글 문서 열기 및 편집]</strong> 메뉴가 활성화됩니다!
                    </p>
                  </div>
                </div>
              </div>

              {/* Download Buttons for Manual Install Files */}
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                  📥 수동 설치에 필요한 파일 직접 받기:
                </h4>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGlobalDownloadOxt}
                    className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3.5 py-2 rounded-lg shadow-2xs transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    한글 확장팩 (.oxt) 다운로드
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadManualInstallBat}
                    className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold px-3.5 py-2 rounded-lg shadow-2xs transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    수동설치 도우미 (.bat) 다운로드
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadManualInstallGuide}
                    className="flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold px-3 py-2 rounded-lg transition"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    수동설치 안내문 (.txt) 다운로드
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex justify-end">
              <button
                type="button"
                onClick={() => setIsManualInstallModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition"
              >
                확인 완료 (닫기)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apache OpenOffice Official Source Integration & GitHub Push Modal */}
      {isApacheSourceModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-sky-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-lg">
                  <GitBranch className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                    Apache OpenOffice® 소스 연동 &amp; 한글 확장팩 깃허브 푸시 아키텍처
                  </h3>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    아파치 공식 최신 소스(AOO41X) 동적 복제 연동 + 한글확장팩만 yjhone1/openoffice-hwp에 푸시
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsApacheSourceModalOpen(false)}
                className="text-indigo-200 hover:text-white p-1 rounded-md text-sm transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
              {/* Architecture Strategy Box */}
              <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/70 space-y-2">
                <h4 className="font-bold text-indigo-950 text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  새로운 개발 및 배포 구조 (아파치 원본 동적 복제 + 한글 확장팩 독립 푸시)
                </h4>
                <p className="text-slate-700 leading-relaxed">
                  • <strong>아파치 원본 소스는 항상 최신으로 동적 복제</strong>: 2.5GB에 달하는 오픈오피스 C++ 전체 소스를 개인 저장소에 직접 보관하지 않습니다. 개발 및 빌드 시에만 아파치 공식 저장소(<code>apache/openoffice</code>, AOO41X 브랜치)에서 원본 소스를 복제(fetch)하여 한글 확장팩을 결합합니다. 오픈오피스 버전이 바뀌더라도 스크립트 실행 한 번으로 새 버전을 즉시 불러올 수 있습니다.<br />
                  • <strong>깃허브(<code>yjhone1/openoffice-hwp</code>)에는 한글 확장팩만 푸시</strong>: 본 저장소는 순수한 [한글(.hwp/.hwpx) 확장팩] 소스코드(OXT 패키지 소스, HWP/HWPX 웹 편집기, 자동 빌드 CI/CD)만 가볍고 완전하게 관리합니다.<br />
                  • <strong>GitHub Actions 자동 빌드</strong>: 깃허브에 푸시하면 GitHub Actions 워크플로가 아파치 공식 소스를 동적으로 불러와 윈도우 배포판(<code>OpenOffice-4.1.17-HWP-Windows-Distribution.zip</code>)과 확장팩(<code>.oxt</code>)을 자동 빌드합니다.
                </p>
              </div>

              {/* Developer Helper Scripts */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  🛠️ 원클릭 자동화 개발 도우미 스크립트:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                    <div className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5 text-indigo-600" />
                      1. 아파치 최신 소스 복제 &amp; 연동
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      아파치 공식 AOO41X 소스를 자동 복제하여 한글 확장팩 소스를 <code>main/extensions/hwp</code>에 연결합니다.
                    </p>
                    <button
                      type="button"
                      onClick={handleDownloadFetchAooBat}
                      className="w-full flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-2.5 rounded text-xs transition"
                    >
                      fetch-apache-openoffice.bat 받기
                    </button>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                    <div className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      2. 한글 확장팩 깃허브 푸시
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      한글 확장팩 전체 소스를 <code>yjhone1/openoffice-hwp</code>(master 브랜치)로 즉시 푸시합니다.
                    </p>
                    <button
                      type="button"
                      onClick={handleDownloadSetupRepoBat}
                      className="w-full flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-2.5 rounded text-xs transition"
                    >
                      push-to-github.bat 받기
                    </button>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                    <div className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5 text-amber-600" />
                      3. 한글 확장팩 (.oxt) 빌드
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      <code>openoffice-extension-oxt/</code> 소스로부터 <code>.oxt</code> 확장팩 바이너리를 빌드합니다.
                    </p>
                    <button
                      type="button"
                      onClick={handleDownloadBuildOxtBat}
                      className="w-full flex items-center justify-center gap-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-1.5 px-2.5 rounded text-xs transition"
                    >
                      build-oxt.bat 받기
                    </button>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                    <div className="font-bold text-xs text-sky-950 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-sky-600" />
                      4. 상세 개발·푸시 가이드 문서
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      아키텍처 설명, 오픈오피스 소스 연동 및 CI/CD 자동 빌드 상세 설명 문서입니다.
                    </p>
                    <button
                      type="button"
                      onClick={handleDownloadApacheSourceGuide}
                      className="w-full flex items-center justify-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold py-1.5 px-2.5 rounded text-xs transition"
                    >
                      가이드 안내문 (.txt) 받기
                    </button>
                  </div>
                </div>
              </div>

              {/* Direct Git Commands */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-900 text-slate-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-sky-400 flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5" />
                    yjhone1/openoffice-hwp 푸시 명령어 (수동 실행용)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `git init\ngit checkout -B master\ngit remote add origin https://github.com/yjhone1/openoffice-hwp.git\ngit add .\ngit commit -m "feat: Apache OpenOffice Korean (HWP/HWPX) Extension suite & automated CI/CD"\ngit push -u origin master --force`,
                        2
                      )
                    }
                    className="flex items-center gap-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded transition"
                  >
                    {copiedCodeIndex === 2 ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" /> 복사 완료!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> 푸시 명령어 복사
                      </>
                    )}
                  </button>
                </div>
                <pre className="font-mono text-[11px] leading-relaxed p-3 bg-black/60 rounded-lg overflow-x-auto text-emerald-300 whitespace-pre">
{`# 1. 한글 확장팩 소스 다운로드(.zip) 압축 해제 후 해당 폴더에서 실행:
git init
git checkout -B master
git remote add origin https://github.com/yjhone1/openoffice-hwp.git
git add .
git commit -m "feat: Apache OpenOffice Korean (HWP/HWPX) Extension suite & automated CI/CD"
git push -u origin master --force`}
                </pre>
              </div>

              {/* Official Source Reference Link */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50 text-[11px]">
                <span className="text-slate-600">
                  아파치 공식 원본: <strong>apache/openoffice (AOO41X)</strong>
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={APACHE_OPENOFFICE_AOO41X_ZIP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-700 hover:underline font-semibold"
                  >
                    <Download className="w-3 h-3" /> AOO41X 소스 (.zip, ~400MB)
                  </a>
                  <span className="text-slate-300">|</span>
                  <a
                    href={APACHE_OPENOFFICE_OFFICIAL_REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sky-700 hover:underline font-semibold"
                  >
                    <ExternalLink className="w-3 h-3" /> 공식 깃허브 방문
                  </a>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500">
                대상 레포지터리: <code>https://github.com/yjhone1/openoffice-hwp</code>
              </span>
              <button
                type="button"
                onClick={() => setIsApacheSourceModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Status Bar */}
      <footer className="bg-white border-t border-slate-200 px-4 py-1.5 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span>{statusMessage}</span>
          <span>Apache License 2.0 • ODF & KS X 6101 (.hwpx/.hwp)</span>
        </div>
      </footer>
    </div>
  );
}
