// Oracle DB 기준 
// const { contextBridge, ipcRenderer } = require('electron');

// contextBridge.exposeInMainWorld('electronAPI', {
//   getDefectData: () => ipcRenderer.invoke('get-defect-data')
// });

const { contextBridge, ipcRenderer } = require('electron');

// Electron API 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 기존 OracleDB API는 주석 처리
  // getDefectData: () => ipcRenderer.invoke('get-defect-data'),
  
  // Excel 파일 읽기 API 추가
  readExcelFile: (filename) => ipcRenderer.invoke('read-excel-file', filename),
  
  // 테스트 API
  testIpc: () => ipcRenderer.invoke('test-ipc'),
  testApi: () => ipcRenderer.invoke('test-api'),
  
  // FTP 이미지 가져오기 API 추가
  getFtpImage: (imageType) => ipcRenderer.invoke('get-ftp-image', imageType),
  getAllFtpImages: () => ipcRenderer.invoke('get-all-ftp-images'),
  
  // 엑셀 다운로드 API 추가
  exportExcel: (data) => ipcRenderer.invoke('export-excel', data),
  
  // ========================================
  // index2.html 관련 API 추가
  // ========================================
  
  // LOTID별 데이터 필터링
  filterDataByLotid: (lotid) => ipcRenderer.invoke('filter-data-by-lotid', lotid),
  
  // 불량 원인 분석 데이터 생성
  generateDefectAnalysis: (lotid) => ipcRenderer.invoke('generate-defect-analysis', lotid),
  
  // 차트 데이터 생성
  generateChartData: (lotid) => ipcRenderer.invoke('generate-chart-data', lotid),
  
  // 마인드맵 데이터 생성
  generateMindmapData: (lotid) => ipcRenderer.invoke('generate-mindmap-data', lotid),
  
  // Analytics 대시보드 데이터
  getAnalyticsData: () => ipcRenderer.invoke('get-analytics-data'),
  
  // PDF 리포트 생성
  generatePdfReport: (reportData) => ipcRenderer.invoke('generate-pdf-report', reportData),
  
  // 페이지 캡처
  capturePage: () => ipcRenderer.invoke('capture-page'),
  
  // 다운로드 진행 상황
  getDownloadProgress: () => ipcRenderer.invoke('get-download-progress'),
  
  // 빌드 디버깅 정보
  debugBuildInfo: () => ipcRenderer.invoke('debug-build-info')
});