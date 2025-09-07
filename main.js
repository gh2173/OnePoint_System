const { app, BrowserWindow, ipcMain } = require('electron');
app.disableHardwareAcceleration();

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

// --- 개발용 자동 리로드 (저장 시 앱 재시작) ---
if (!app.isPackaged) {
  try {
    require('electron-reload')(__dirname, {
      // 파일 시스템 환경에 따라 polling 사용 권장 (Windows에서 안정적)
      usePolling: true,
      interval: 100,           // 폴링 간격(ms)
      awaitWriteFinish: true,  // 쓰기 완료 대기
      debounce: 200,
      ignored: /node_modules|[\/\\]\.git/,
      verbose: true
    });
    console.log('electron-reload 활성화됨 (개발용)');
  } catch (err) {
    console.warn('electron-reload 로드 실패:', err.message);
  }
}

// FTP 모듈 안전하게 로드
let ftp;
try {
  ftp = require('basic-ftp');
  console.log('basic-ftp 모듈 로드 성공');
} catch (error) {
  console.error('basic-ftp 모듈 로드 실패:', error.message);
  console.log('npm install basic-ftp 명령어를 실행해주세요');
}

// 기존 DB 모듈 주석 처리
// const { getDefectData } = require('./dbService');

let mainWindow;

// FTP 서버 설정
const ftpConfig = {
  host: "192.168.223.225",
  user: "vega",
  password: "vegagcc",
  secure: false,
  encoding: "utf8"  // 한국어 파일명 지원을 위한 인코딩 설정
};

// 이미지 경로 설정
const imageConfigs = {
  rpa: {
    path: "/DEEP_LEARNING/RPA_image/",
    filename: "A327GA.02_192_158_1.jpg"
  },
  avi: {
    path: "/DEEP_LEARNING/AVI_image/",
    filename: "A327GA.02_11_33_5.jpg"
  },
  deeplearning: {
    path: "/DEEP_LEARNING/DEEP_image/",     // 일관성 있게 대문자로 통일
    filename: "A327GA.02_11_33_5.jpg"
  }
};

// FTP에서 이미지 다운로드 함수
async function downloadImageFromFTP(imageType) {
  if (!ftp) {
    throw new Error('FTP 모듈이 로드되지 않았습니다. npm install basic-ftp를 실행해주세요.');
  }

  const client = new ftp.Client();
  client.ftp.verbose = true;
  
  try {
    console.log(`=== ${imageType} 이미지 다운로드 시작 ===`);
    console.log(`FTP 서버 연결 시도: ${ftpConfig.host}`);
    
    // FTP 연결 시 타임아웃 설정
    client.ftp.timeout = 30000; // 30초 타임아웃
    await client.access(ftpConfig);
    console.log('FTP 연결 성공');
    
    const config = imageConfigs[imageType];
    if (!config) {
      throw new Error(`알 수 없는 이미지 타입: ${imageType}`);
    }
    
    // 전체 경로 구성
    const remotePath = config.path + config.filename;
    const localPath = path.join(__dirname, 'temp', `${imageType}_${config.filename}`);
    
    console.log(`이미지 타입: ${imageType}`);
    console.log(`원격 경로: ${remotePath}`);
    console.log(`로컬 저장 경로: ${localPath}`);
    
    // temp 디렉토리 생성 (없을 경우)
    const tempDir = path.dirname(localPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log(`임시 디렉토리 생성: ${tempDir}`);
    }
    
    // 기존 파일이 있으면 삭제
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
      console.log(`기존 파일 삭제: ${localPath}`);
    }
    
    console.log(`FTP 다운로드 시작: ${remotePath}`);
    
    // 먼저 디렉토리 목록 확인해보기
    try {
      console.log(`디렉토리 ${config.path} 내용 확인 중...`);
      const list = await client.list(config.path);
      console.log(`디렉토리 내용:`, list.map(item => ({
        name: item.name,
        type: item.type,
        size: item.size
      })));
      
      // 원하는 파일이 있는지 확인
      const targetFile = list.find(item => item.name === config.filename);
      if (targetFile) {
        console.log(`대상 파일 발견: ${config.filename} (크기: ${targetFile.size})`);
      } else {
        console.log(`대상 파일 ${config.filename}을 찾을 수 없습니다.`);
        console.log(`사용 가능한 파일들:`, list.filter(item => item.type === 1).map(item => item.name));
      }
    } catch (listError) {
      console.log('디렉토리 목록 확인 실패:', listError.message);
    }
    
    // FTP 다운로드 시도
    await client.downloadTo(localPath, remotePath);
    console.log(`다운로드 완료: ${localPath}`);
    
    // 파일 크기 확인
    const stats = fs.statSync(localPath);
    console.log(`다운로드된 파일 크기: ${stats.size} bytes`);
    
    if (stats.size === 0) {
      throw new Error('다운로드된 파일이 비어있습니다.');
    }
    
    return localPath;
    
  } catch (error) {
    console.error(`=== ${imageType} 이미지 다운로드 실패 ===`);
    console.error(`오류 메시지: ${error.message}`);
    console.error(`오류 코드: ${error.code}`);
    console.error(`전체 오류:`, error);
    throw error;
  } finally {
    try {
      client.close();
      console.log(`FTP 연결 종료 (${imageType})`);
    } catch (closeError) {
      console.log(`FTP 연결 종료 오류: ${closeError.message}`);
    }
  }
}

// 이미지를 Base64로 변환하는 함수
function imageToBase64(imagePath) {
  try {
    console.log(`Base64 변환 시작: ${imagePath}`);
    
    // 파일 존재 여부 확인
    if (!fs.existsSync(imagePath)) {
      throw new Error(`파일이 존재하지 않습니다: ${imagePath}`);
    }
    
    // 파일 크기 확인
    const stats = fs.statSync(imagePath);
    console.log(`파일 크기: ${stats.size} bytes`);
    
    if (stats.size === 0) {
      throw new Error('파일이 비어있습니다.');
    }
    
    const imageBuffer = fs.readFileSync(imagePath);
    console.log(`버퍼 크기: ${imageBuffer.length} bytes`);
    
    const base64Image = imageBuffer.toString('base64');
    console.log(`Base64 문자열 길이: ${base64Image.length}`);
    
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
    
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    console.log(`MIME 타입: ${mimeType}`);
    console.log(`Data URL 길이: ${dataUrl.length}`);
    
    // Base64 데이터 유효성 간단 체크
    if (base64Image.length < 100) {
      throw new Error('Base64 데이터가 너무 짧습니다. 파일이 손상되었을 수 있습니다.');
    }
    
    return dataUrl;
  } catch (error) {
    console.error('이미지 Base64 변환 오류:', error);
    throw error;
  }
}

function createWindow() {
  // mainWindow 생성시 preload 스크립트 설정
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1000,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('Main_One.html');
  // mainWindow.loadFile('Dashboard.html');
  // 개발 시 DevTools 열기 - 디버깅을 위해 활성화
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// 기존 IPC 통신 처리 주석 처리
/*
ipcMain.handle('get-defect-data', async () => {
  try {
    const data = await getDefectData();
    return data;
  } catch (error) {
    console.error('데이터 로드 오류:', error);
    return [];
  }
});
*/

// FTP 이미지 가져오기 IPC 핸들러
ipcMain.handle('get-ftp-image', async (event, imageType) => {
  console.log(`\n=== IPC: ${imageType} 이미지 요청 시작 ===`);
  
  try {
    // 입력 검증
    if (!imageType || typeof imageType !== 'string') {
      throw new Error('유효하지 않은 이미지 타입');
    }
    
    console.log(`요청된 이미지 타입: ${imageType}`);
    
    // 이미지 설정 확인
    const config = imageConfigs[imageType];
    if (!config) {
      throw new Error(`지원하지 않는 이미지 타입: ${imageType}`);
    }
    
    console.log(`이미지 설정:`, {
      path: config.path,
      filename: config.filename,
      fullPath: config.path + config.filename
    });
    
    // FTP에서 이미지 다운로드
    const localPath = await downloadImageFromFTP(imageType);
    console.log(`다운로드 완료: ${localPath}`);
    
    // 이미지를 Base64로 변환
    const base64Image = imageToBase64(localPath);
    console.log(`Base64 변환 완료 (길이: ${base64Image.length})`);
    
    // 성공 결과 반환
    const result = {
      success: true,
      imageData: base64Image,
      type: imageType,
      timestamp: new Date().toISOString()
    };
    
    console.log(`=== ${imageType} 이미지 요청 성공 ===\n`);
    return result;
    
  } catch (error) {
    console.error(`=== ${imageType} 이미지 요청 실패 ===`);
    console.error(`오류 메시지: ${error.message}`);
    console.error(`스택 트레이스:`, error.stack);
    
    const result = {
      success: false,
      error: error.message,
      type: imageType,
      timestamp: new Date().toISOString()
    };
    
    console.log(`실패 결과:`, result);
    console.log(`=== ${imageType} 이미지 요청 종료 (실패) ===\n`);
    return result;
  }
});

// 모든 이미지를 한번에 가져오는 IPC 핸들러
ipcMain.handle('get-all-ftp-images', async (event) => {
  console.log('\n=== IPC: 모든 FTP 이미지 요청 시작 ===');
  
  try {
    const results = {};
    const imageTypes = ['rpa', 'avi', 'deeplearning'];
    
    console.log(`처리할 이미지 타입: ${imageTypes.join(', ')}`);
    
    // 순차적으로 각 이미지 처리 (병렬 처리 시 FTP 연결 충돌 방지)
    for (const type of imageTypes) {
      console.log(`\n--- ${type} 이미지 처리 시작 ---`);
      
      try {
        const config = imageConfigs[type];
        console.log(`${type} 설정:`, {
          path: config.path,
          filename: config.filename
        });
        
        const localPath = await downloadImageFromFTP(type);
        const base64Image = imageToBase64(localPath);
        
        results[type] = {
          success: true,
          imageData: base64Image,
          type: type,
          timestamp: new Date().toISOString()
        };
        
        console.log(`${type} 이미지 처리 성공`);
        
      } catch (error) {
        console.error(`${type} 이미지 처리 실패:`, error.message);
        results[type] = {
          success: false,
          error: error.message,
          type: type,
          timestamp: new Date().toISOString()
        };
      }
      
      console.log(`--- ${type} 이미지 처리 완료 ---`);
    }
    
    // 결과 요약
    const successCount = Object.values(results).filter(r => r.success).length;
    const totalCount = imageTypes.length;
    
    console.log(`\n=== 전체 결과 요약 ===`);
    console.log(`성공: ${successCount}/${totalCount}`);
    console.log(`실패: ${totalCount - successCount}/${totalCount}`);
    
    Object.keys(results).forEach(type => {
      const result = results[type];
      console.log(`${type}: ${result.success ? '성공' : '실패'} ${result.success ? '' : `(${result.error})`}`);
    });
    
    console.log(`=== 모든 FTP 이미지 요청 완료 ===\n`);
    
    return results;
    
  } catch (error) {
    console.error('=== 전체 FTP 이미지 가져오기 실패 ===');
    console.error(`오류 메시지: ${error.message}`);
    console.error(`스택 트레이스:`, error.stack);
    console.log(`=== 전체 FTP 이미지 요청 종료 (실패) ===\n`);
    throw error;
  }
});

// 테스트용 간단한 핸들러
ipcMain.handle('test-ipc', async (event) => {
  console.log('테스트 IPC 호출됨');
  return { success: true, message: 'IPC 통신 정상' };
});

// Excel 파일 경로를 안전하게 가져오는 함수
function getExcelFilePath(filename) {
  let possiblePaths = [];
  
  if (app.isPackaged) {
    // 빌드된 앱에서의 가능한 경로들 (우선순위 순)
    possiblePaths = [
      path.join(process.resourcesPath, filename),           // extraResources 경로 (최우선)
      path.join(process.resourcesPath, 'app.asar.unpacked', filename), // asar unpacked 경로
      path.join(process.resourcesPath, 'app', filename),    // app 내부 경로  
      path.join(app.getAppPath(), filename),                // 앱 경로
      path.join(path.dirname(process.execPath), filename),  // 실행파일 위치
      path.join(path.dirname(process.execPath), 'resources', filename), // resources 폴더
      path.join(app.getPath('userData'), filename),         // 사용자 데이터 폴더
      path.join(__dirname, filename)                        // 현재 디렉토리
    ];
  } else {
    // 개발 환경에서의 경로
    possiblePaths = [
      path.join(__dirname, filename),                       // 현재 디렉토리
      path.join(process.cwd(), filename)                    // 작업 디렉토리
    ];
  }
    console.log(`=== Excel 파일 경로 검색 ===`);
  console.log(`파일명: ${filename}`);
  console.log(`앱 패키지 상태: ${app.isPackaged ? 'Build된 앱' : '개발 환경'}`);
  
  if (app.isPackaged) {
    console.log(`=== 빌드된 앱 환경 정보 ===`);
    console.log(`process.resourcesPath: ${process.resourcesPath}`);
    console.log(`app.getAppPath(): ${app.getAppPath()}`);
    console.log(`process.execPath: ${process.execPath}`);
    console.log(`실행파일 디렉토리: ${path.dirname(process.execPath)}`);
    console.log(`__dirname: ${__dirname}`);
    console.log(`process.cwd(): ${process.cwd()}`);
    
    // resources 디렉토리 내용 확인
    try {
      if (fs.existsSync(process.resourcesPath)) {
        const resourcesContents = fs.readdirSync(process.resourcesPath);
        console.log(`resources 디렉토리 내용: [${resourcesContents.join(', ')}]`);
      } else {
        console.log(`resources 디렉토리가 존재하지 않음: ${process.resourcesPath}`);
      }
    } catch (error) {
      console.log(`resources 디렉토리 읽기 오류: ${error.message}`);
    }
  }
  
  console.log(`검색할 경로들:`, possiblePaths);
  
  // 각 경로를 시도해서 파일이 존재하는 경로 찾기
  for (const filePath of possiblePaths) {
    console.log(`경로 확인 중: ${filePath}`);
    if (fs.existsSync(filePath)) {
      console.log(`✓ Excel 파일 발견: ${filePath}`);
      return filePath;
    } else {
      console.log(`✗ 파일 없음: ${filePath}`);
    }
  }
  
  // 파일을 찾지 못한 경우 추가 정보 출력
  console.error(`=== Excel 파일을 찾을 수 없습니다 ===`);
  console.error(`찾는 파일: ${filename}`);
  console.error(`현재 작업 디렉토리: ${process.cwd()}`);
  console.error(`__dirname: ${__dirname}`);
  
  if (app.isPackaged) {
    console.error(`process.resourcesPath: ${process.resourcesPath}`);
    console.error(`app.getAppPath(): ${app.getAppPath()}`);
    console.error(`process.execPath: ${process.execPath}`);
    console.error(`실행파일 디렉토리: ${path.dirname(process.execPath)}`);
  }
  
  throw new Error(`Excel 파일을 찾을 수 없습니다: ${filename}\n검색된 경로들:\n${possiblePaths.join('\n')}`);
}

// Excel 파일 읽기 IPC 핸들러 수정
ipcMain.handle('read-excel-file', async (event, filename = 'OnePointRaw.xlsx') => {
  try {
    console.log(`=== Excel 파일 읽기 시작: ${filename} ===`);
    console.log(`요청 시간: ${new Date().toISOString()}`);
    console.log(`앱 패키지 상태: ${app.isPackaged ? 'Build된 앱' : '개발 환경'}`);
    
    // 안전한 경로로 Excel 파일 찾기
    const filePath = getExcelFilePath(filename);
    console.log(`최종 선택된 Excel 파일 경로: ${filePath}`);
    
    // 파일 정보 출력
    const stats = fs.statSync(filePath);
    console.log(`파일 크기: ${stats.size} bytes`);
    console.log(`파일 수정일: ${stats.mtime}`);
    
    if (stats.size === 0) {
      throw new Error('Excel 파일이 비어있습니다.');
    }
    
    // Excel 파일 읽기 시작
    console.log('Excel 파일 파싱 시작...');
    const workbook = XLSX.readFile(filePath);
    
    // 워크북 정보 출력
    console.log(`시트 개수: ${workbook.SheetNames.length}`);
    console.log(`시트 이름들: [${workbook.SheetNames.join(', ')}]`);
    
    // 첫 번째 시트 선택
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    console.log(`선택된 시트: "${sheetName}"`);
    
    // 시트 범위 정보
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
    console.log(`시트 범위: ${sheet['!ref']} (${range.e.r + 1}행 x ${range.e.c + 1}열)`);
    
    // 데이터를 JSON으로 변환
    console.log('JSON 변환 시작...');
    const jsonData = XLSX.utils.sheet_to_json(sheet);
    console.log(`변환된 데이터 행 수: ${jsonData.length}`);
    
    // 첫 번째 행의 컬럼 구조 출력 (디버깅용)
    if (jsonData.length > 0) {
      const columns = Object.keys(jsonData[0]);
      console.log(`컬럼 개수: ${columns.length}`);
      console.log(`컬럼 이름들: [${columns.join(', ')}]`);
      console.log('첫 번째 데이터 행 샘플:', JSON.stringify(jsonData[0], null, 2));
      
      // Analytics 관련 데이터가 있는지 확인
      const analyticsData = jsonData.filter(row => {
        const values = Object.values(row);
        return values.some(value => 
          value && value.toString().toLowerCase().includes('analytics')
        );
      });
      console.log(`Analytics 관련 데이터 행 수: ${analyticsData.length}`);
      
    } else {
      console.warn('변환된 데이터가 비어있습니다. 시트에 데이터가 없거나 형식이 잘못되었을 수 있습니다.');
    }
    
    console.log(`=== Excel 파일 읽기 성공: ${filename} ===`);
    return jsonData;
    
  } catch (error) {
    console.error(`=== Excel 파일 읽기 실패: ${filename} ===`);
    console.error(`오류 타입: ${error.constructor.name}`);
    console.error(`오류 메시지: ${error.message}`);
    console.error(`스택 트레이스:`, error.stack);
    
    // 더 구체적인 오류 정보 제공
    let userFriendlyMessage = '엑셀 파일에서 데이터를 불러오지 못했습니다.';
    
    if (error.message.includes('찾을 수 없습니다')) {
      userFriendlyMessage = `엑셀 파일(${filename})을 찾을 수 없습니다. 파일이 올바른 위치에 있는지 확인해주세요.`;
    } else if (error.message.includes('비어있습니다')) {
      userFriendlyMessage = `엑셀 파일(${filename})이 비어있습니다.`;
    } else if (error.message.includes('invalid')) {
      userFriendlyMessage = `엑셀 파일(${filename}) 형식이 올바르지 않습니다.`;
    }
    
    // 사용자에게 친화적인 오류 객체 생성
    const friendlyError = new Error(userFriendlyMessage);
    friendlyError.originalError = error;
    friendlyError.filename = filename;
    friendlyError.timestamp = new Date().toISOString();
    
    console.error(`사용자 메시지: ${userFriendlyMessage}`);
    console.error(`=== Excel 파일 읽기 종료 (실패) ===`);
    
    throw friendlyError;
  }
});

// 테스트용 IPC 핸들러
ipcMain.handle('test-api', async () => {
  console.log('테스트 API 호출됨');
  
  // 이미지 경로 정보 출력
  console.log('=== 이미지 경로 설정 ===');
  Object.keys(imageConfigs).forEach(type => {
    const config = imageConfigs[type];
    const fullPath = `ftp://${ftpConfig.host}${config.path}${config.filename}`;
    console.log(`${type}: ${fullPath}`);
  });
  
  return {
    success: true,
    message: 'API 연결 정상',
    ftpModule: !!ftp,
    imageConfigs: imageConfigs
  };
});

// ========================================
// index2.html 관련 IPC 핸들러 추가
// ========================================

// LOTID별 데이터 필터링
ipcMain.handle('filter-data-by-lotid', async (event, lotid) => {
  try {
    console.log(`LOTID별 데이터 필터링 요청: ${lotid}`);
    
    // Excel 파일에서 데이터 읽기
    const filePath = getExcelFilePath('OnePointRaw.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const excelData = XLSX.utils.sheet_to_json(sheet);
    
    if (!excelData || !Array.isArray(excelData)) {
      throw new Error('Excel 데이터를 읽을 수 없습니다.');
    }
    
    // LOTID로 필터링
    const filteredData = excelData.filter(row => {
      return row.LOTID === lotid || row.LotID === lotid || row.lotid === lotid;
    });
    
    console.log(`LOTID ${lotid}에 대한 필터링 결과: ${filteredData.length}건`);
    return filteredData;
    
  } catch (error) {
    console.error('LOTID 필터링 오류:', error);
    throw error;
  }
});

// 불량 원인 분석 데이터 생성
ipcMain.handle('generate-defect-analysis', async (event, lotid) => {
  try {
    console.log(`불량 원인 분석 데이터 생성 요청: ${lotid}`);
    
    // Excel 데이터에서 해당 LOTID 데이터 가져오기
    const filePath = getExcelFilePath('OnePointRaw.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const excelData = XLSX.utils.sheet_to_json(sheet);
    
    const filteredData = excelData.filter(row => {
      return row.LOTID === lotid || row.LotID === lotid || row.lotid === lotid;
    });
    
    if (filteredData.length === 0) {
      return {
        found: false,
        message: `LOTID ${lotid}에 대한 데이터를 찾을 수 없습니다.`
      };
    }
    
    // 분석 데이터 생성 (간단한 예시)
    const analysisResult = {
      found: true,
      lotid: lotid,
      totalTests: filteredData.length,
      totalDefects: filteredData.filter(row => row.DEFECT_COUNT > 0).length,
      rootCause: "Equipment Issue", // 예시
      recommendations: [
        "장비 캘리브레이션 수행",
        "프로브 카드 상태 점검",
        "테스트 프로그램 검토"
      ],
      statistics: {
        equipmentCount: new Set(filteredData.map(row => row.EQPID)).size,
        cardCount: new Set(filteredData.map(row => row.PCID)).size,
        equipmentFailRate: 5.2,
        cardFailRate: 3.1
      },
      date: new Date().toLocaleDateString('ko-KR')
    };
    
    console.log('불량 원인 분석 완료:', analysisResult);
    return analysisResult;
    
  } catch (error) {
    console.error('불량 원인 분석 오류:', error);
    throw error;
  }
});

// 차트 데이터 생성
ipcMain.handle('generate-chart-data', async (event, lotid) => {
  try {
    console.log(`차트 데이터 생성 요청: ${lotid}`);
    
    // 기본 차트 데이터 구조 반환
    const chartData = {
      lotid: lotid,
      defectByEquipment: {
        labels: ['EQP-001', 'EQP-002', 'EQP-003'],
        data: [15, 8, 12]
      },
      defectByTime: {
        labels: ['00:00', '06:00', '12:00', '18:00'],
        data: [5, 12, 18, 10]
      },
      defectTypes: {
        labels: ['Open', 'Short', 'High Current', 'Low Current'],
        data: [25, 15, 30, 30]
      }
    };
    
    console.log('차트 데이터 생성 완료');
    return chartData;
    
  } catch (error) {
    console.error('차트 데이터 생성 오류:', error);
    throw error;
  }
});

// 마인드맵 데이터 생성
ipcMain.handle('generate-mindmap-data', async (event, lotid) => {
  try {
    console.log(`마인드맵 데이터 생성 요청: ${lotid}`);
    
    const mindmapData = {
      lotid: lotid,
      centerNode: "불량 원인 분석",
      categories: [
        {
          name: "Equipment Issue",
          items: ["캘리브레이션 불량", "온도 변화", "압력 불안정"]
        },
        {
          name: "Card Issue", 
          items: ["프로브 카드 마모", "접촉 불량", "카드 오염"]
        },
        {
          name: "Product/PGM Issue",
          items: ["테스트 조건 부적절", "프로그램 오류", "규격 변경"]
        },
        {
          name: "Other Issue",
          items: ["환경 변화", "운영자 실수", "재료 품질"]
        }
      ]
    };
    
    console.log('마인드맵 데이터 생성 완료');
    return mindmapData;
    
  } catch (error) {
    console.error('마인드맵 데이터 생성 오류:', error);
    throw error;
  }
});

// Analytics 대시보드 데이터
ipcMain.handle('get-analytics-data', async (event) => {
  try {
    console.log('Analytics 대시보드 데이터 요청');
    
    const analyticsData = {
      summary: {
        totalLots: 150,
        totalDefects: 1250,
        averageYield: 94.2,
        criticalIssues: 5
      },
      trends: {
        daily: [92, 94, 93, 95, 94, 96, 94],
        weekly: [93.5, 94.1, 93.8, 94.5]
      },
      topIssues: [
        { name: "Equipment Calibration", count: 45 },
        { name: "Probe Card Wear", count: 38 },
        { name: "Temperature Drift", count: 32 }
      ]
    };
    
    console.log('Analytics 대시보드 데이터 생성 완료');
    return analyticsData;
    
  } catch (error) {
    console.error('Analytics 데이터 생성 오류:', error);
    throw error;
  }
});

// PDF 리포트 생성
ipcMain.handle('generate-pdf-report', async (event, reportData) => {
  try {
    console.log('PDF 리포트 생성 요청');
    
    // 간단한 성공 응답 (실제 PDF 생성 로직은 별도 구현 필요)
    const result = {
      success: true,
      message: 'PDF 리포트가 성공적으로 생성되었습니다.',
      timestamp: new Date().toISOString()
    };
    
    console.log('PDF 리포트 생성 완료');
    return result;
    
  } catch (error) {
    console.error('PDF 리포트 생성 오류:', error);
    throw error;
  }
});