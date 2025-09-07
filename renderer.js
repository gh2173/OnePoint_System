// 차트 인스턴스 저장 변수
let chart1Instance = null;
let chart2Instance = null;
let chart3Instance = null;
let chart4Instance = null;
let chart4EqpInstance = null;
let chart4PcInstance = null;

// 데이터 저장 변수
let defectData = null;

// 색상 팔레트 정의
const colorPalette = [
  'rgba(74, 108, 247, 1)',    // 파랑
  'rgba(255, 99, 132, 1)',    // 빨강
  'rgba(255, 159, 64, 1)',    // 주황
  'rgba(75, 192, 192, 1)',    // 청록
  'rgba(153, 102, 255, 1)',   // 보라
  'rgba(255, 205, 86, 1)',    // 노랑
  'rgba(201, 203, 207, 1)',   // 회색
  'rgba(54, 162, 235, 1)',    // 하늘
  'rgba(45, 204, 112, 1)'     // 초록
];

// FAILCODE 종류와 해당 컬럼명 매핑
const failCodes = [
  { code: '1', name: 'Burnt', column: 'BURNT' },
  { code: '2', name: 'Probe_Damage', column: 'PROBE_DAMAGE' },
  { code: '3', name: 'Bump_Damage', column: 'BUMP_DAMAGE' },
  { code: '4', name: 'Probe_Misalign', column: 'PROBE_MISALIGN' },
  { code: '5', name: 'Pattern_Damage', column: 'PATTERN_DAMAGE' },
  { code: '6', name: 'Raw_Material', column: 'RAW_MATERIAL' },
  { code: '7', name: 'DISCOLOR', column: 'DISCOLOR' },
  { code: '8', name: 'No_Probe_Mark', column: 'NO_PROBE_MARK' },
  { code: '9', name: 'Foreign_Material', column: 'FOREIGN_MATERIAL' },
  { code: 'A', name: 'Missing_Bump', column: 'MISSING_BUMP' },
  { code: 'B', name: 'Big_Ball', column: 'BIG_BALL' },
  { code: 'C', name: 'Ag_rich', column: 'AG_RICH' }
];

// Risk Level 정의
const riskLevels = {
  critical: { rate: 3, slots: 3, color: 'rgba(139, 0, 0, 1)', bgColor: 'rgba(139, 0, 0, 0.1)' },
  high: { rate: 3, slots: 1, color: 'rgba(255, 0, 0, 1)', bgColor: 'rgba(255, 0, 0, 0.1)' },
  medium: { rate: 2, slots: 2, color: 'rgba(255, 165, 0, 1)', bgColor: 'rgba(255, 165, 0, 0.1)' },
  low: { rate: 2, slots: 1, color: 'rgba(255, 255, 0, 1)', bgColor: 'rgba(255, 255, 0, 0.1)' }
};

// SLOT별 Risk Level 계산 함수 (개별 SLOT 기준)
function calculateSlotRiskLevel(slotData) {
  // 입력 검증: slotData가 객체인지 확인
  if (!slotData || typeof slotData !== 'object') {
    console.error('calculateSlotRiskLevel: slotData가 올바르지 않습니다:', slotData);
    return { level: 'normal', rate: 0, slots: 0 };
  }
  
  const netdie = Number(slotData.NETDIE) || 0;
  
  // 해당 SLOT의 모든 FAILCODE 합계 계산
  const totalFailcodes = 
    (Number(slotData.BURNT) || 0) +
    (Number(slotData.PROBE_DAMAGE) || 0) +
    (Number(slotData.BUMP_DAMAGE) || 0) +
    (Number(slotData.PROBE_MISALIGN) || 0) +
    (Number(slotData.PATTERN_DAMAGE) || 0) +
    (Number(slotData.RAW_MATERIAL) || 0) +
    (Number(slotData.DISCOLOR) || 0) +
    (Number(slotData.NO_PROBE_MARK) || 0) +
    (Number(slotData.FOREIGN_MATERIAL) || 0) +
    (Number(slotData.MISSING_BUMP) || 0) +
    (Number(slotData.BIG_BALL) || 0) +
    (Number(slotData.AG_RICH) || 0);
  
  // 발생율 계산: (FAILCODE(SUM) / NETDIE) * 100
  const defectRate = netdie > 0 ? (totalFailcodes / netdie) * 100 : 0;
  const slotCount = 1; // 개별 SLOT이므로 1
  
  // Risk Level 판정 (우선순위: Critical > High > Medium > Low)
  if (defectRate >= riskLevels.critical.rate && slotCount >= riskLevels.critical.slots) {
    return { level: 'critical', rate: defectRate, slots: slotCount };
  } else if (defectRate >= riskLevels.high.rate && slotCount >= riskLevels.high.slots) {
    return { level: 'high', rate: defectRate, slots: slotCount };
  } else if (defectRate >= riskLevels.medium.rate && slotCount >= riskLevels.medium.slots) {
    return { level: 'medium', rate: defectRate, slots: slotCount };
  } else if (defectRate >= riskLevels.low.rate && slotCount >= riskLevels.low.slots) {
    return { level: 'low', rate: defectRate, slots: slotCount };
  }
  
  return { level: 'normal', rate: defectRate, slots: slotCount };
}

// LOT별 Risk Level 계산 함수 (기존 유지 - Summary용)
function calculateRiskLevel(lotData) {
  // 입력 검증: lotData가 배열인지 확인
  if (!Array.isArray(lotData)) {
    console.error('calculateRiskLevel: lotData가 배열이 아닙니다:', lotData);
    return { level: 'normal', rate: 0, slots: 0 };
  }
  
  if (lotData.length === 0) {
    return { level: 'normal', rate: 0, slots: 0 };
  }
  
  // 해당 LOT의 모든 SLOT에서 NETDIE와 FAILCODE 합계 계산
  let totalNetdie = 0;
  let totalFailcodes = 0;
  let validSlots = 0; // 발생율이 계산된 SLOT 수
  let totalRate = 0; // 전체 발생율의 합
  
  lotData.forEach(item => {
    const netdie = Number(item.NETDIE) || 0;
    const failcodes = 
      (Number(item.BURNT) || 0) +
      (Number(item.PROBE_DAMAGE) || 0) +
      (Number(item.BUMP_DAMAGE) || 0) +
      (Number(item.PROBE_MISALIGN) || 0) +
      (Number(item.PATTERN_DAMAGE) || 0) +
      (Number(item.RAW_MATERIAL) || 0) +
      (Number(item.DISCOLOR) || 0) +
      (Number(item.NO_PROBE_MARK) || 0) +
      (Number(item.FOREIGN_MATERIAL) || 0) +
      (Number(item.MISSING_BUMP) || 0) +
      (Number(item.BIG_BALL) || 0) +
      (Number(item.AG_RICH) || 0);
    
    totalNetdie += netdie;
    totalFailcodes += failcodes;
    
    // 각 SLOT별 발생율 계산하여 평균 구하기
    if (netdie > 0) {
      const slotRate = (failcodes / netdie) * 100;
      totalRate += slotRate;
      validSlots++;
    }
  });
  
  const slotCount = lotData.length;
  
  // 평균 발생율 계산
  const avgDefectRate = validSlots > 0 ? totalRate / validSlots : 0;
  
  // Risk Level 판정 (우선순위: Critical > High > Medium > Low)
  if (avgDefectRate >= riskLevels.critical.rate && slotCount >= riskLevels.critical.slots) {
    return { level: 'critical', rate: avgDefectRate, slots: slotCount };
  } else if (avgDefectRate >= riskLevels.high.rate && slotCount >= riskLevels.high.slots) {
    return { level: 'high', rate: avgDefectRate, slots: slotCount };
  } else if (avgDefectRate >= riskLevels.medium.rate && slotCount >= riskLevels.medium.slots) {
    return { level: 'medium', rate: avgDefectRate, slots: slotCount };
  } else if (avgDefectRate >= riskLevels.low.rate && slotCount >= riskLevels.low.slots) {
    return { level: 'low', rate: avgDefectRate, slots: slotCount };
  }
  
  return { level: 'normal', rate: avgDefectRate, slots: slotCount };
}

// Spec Out 여부 확인 함수 (호환성을 위해 여러 방식 지원)
function isSpecOut(param1, param2) {
  // 새로운 방식 1: isSpecOut(lotData) - lotData가 배열인 경우 (LOT별)
  if (Array.isArray(param1)) {
    const riskInfo = calculateRiskLevel(param1);
    return riskInfo.level !== 'normal';
  }
  
  // 새로운 방식 2: isSpecOut(slotData) - slotData가 객체인 경우 (SLOT별)
  if (typeof param1 === 'object' && param1 !== null && !Array.isArray(param1)) {
    const riskInfo = calculateSlotRiskLevel(param1);
    return riskInfo.level !== 'normal';
  }
  
  // 기존 방식: isSpecOut(failcodeColumn, value) - 하위 호환성을 위해 유지
  // 하지만 새로운 Risk Level 시스템에서는 항상 false 반환 (개별 FAILCODE 기준 제거됨)
  if (typeof param1 === 'string' && typeof param2 === 'number') {
    console.warn('isSpecOut: 기존 방식 호출이 감지되었습니다. 새로운 Risk Level 시스템에서는 LOT/SLOT 단위로만 판정합니다.');
    return false;
  }
  
  console.error('isSpecOut: 잘못된 매개변수입니다:', param1, param2);
  return false;
}

// 차트 색상 가져오기 함수
function getChartColor(index) {
  return colorPalette[index % colorPalette.length];
}

// 차트 1: LOT별 불량 유형 및 발생 현황 (수정)
function createDefectChart(data, failcodeFilter = 'all') {
  // 기존 차트 제거
  if (chart1Instance) {
    chart1Instance.destroy();
  }
  
  // 로딩 표시 제거, 차트 표시
  const loadingEl = document.querySelector('#chart1Container .loading');
  if (loadingEl) loadingEl.style.display = 'none';
  
  const chartEl = document.getElementById('chart1');
  if (!chartEl) {
    console.error('차트1 요소를 찾을 수 없습니다.');
    return;
  }
  
  chartEl.style.display = 'block';
  
  // 데이터가 없을 경우 처리
  if (!data || data.length === 0) {
    const container = document.getElementById('chart1Container');
    if (container) {
      container.innerHTML = '<div class="error-message">데이터가 없습니다.</div>';
    }
    return;
  }
  console.log('차트 데이터:', data);

  // LOT 목록 추출 (X축) - DATE 기준 오름차순 정렬
  const lotWithDates = [...new Set(data.map(item => item.LOT))].map(lot => {
    // 해당 LOT의 첫 번째 데이터에서 날짜 추출
    const lotData = data.find(item => item.LOT === lot);
    return {
      lot: lot,
      date: lotData ? (lotData.DATE || lotData['날짜'] || lotData.date || '') : ''
    };
  });
  
  // DATE 기준으로 정렬
  lotWithDates.sort((a, b) => {
    const dateA = a.date;
    const dateB = b.date;
    
    // 날짜 문자열 비교 (한국어 형식 "23년 05월 22일" 포함)
    if (dateA < dateB) return -1;
    if (dateA > dateB) return 1;
    return 0;
  });
    const lots = lotWithDates.map(item => item.lot);
  console.log('날짜순 정렬된 LOT 목록:', lots);
  
  // 사용할 FAILCODE 필터링
  let filteredFailCodes = failCodes;
  if (failcodeFilter !== 'all') {
    filteredFailCodes = failCodes.filter(code => code.column === failcodeFilter);
  }
  
  // LOT별 Risk Level 정보 저장 객체
  const lotRiskInfo = {};
  lots.forEach(lot => {
    const lotData = data.filter(item => item.LOT === lot);
    lotRiskInfo[lot] = calculateRiskLevel(lotData);
  });
  
  // X축 인덱스별 Spec Out 발생 여부 저장 배열
  const specOutIndices = lots.map(lot => lotRiskInfo[lot].level !== 'normal');
  
  // 데이터셋 생성
  const datasets = filteredFailCodes.map((failCode, index) => {
    const color = getChartColor(index);
    
    // 각 LOT별 해당 FAILCODE 값 추출
    const dataPoints = lots.map((lot, lotIndex) => {
      // 해당 LOT의 모든 슬롯에서 FAILCODE 값 합산
      const lotData = data.filter(item => item.LOT === lot);
      const value = lotData.reduce((sum, item) => sum + (Number(item[failCode.column]) || 0), 0);
      
      return value;
    });
    
    // 모든 데이터 포인트가 0인 경우 차트에서 제외
    if (dataPoints.every(value => value === 0)) {
      return null; // null 반환하여 나중에 필터링
    }
    
    // Risk Level에 따른 포인트 스타일 설정
    const pointBackgroundColor = lots.map(lot => {
      const riskInfo = lotRiskInfo[lot];
      if (riskInfo.level !== 'normal') {
        return riskLevels[riskInfo.level].color;
      }
      return color;
    });
    
    const pointBorderColor = lots.map(lot => {
      const riskInfo = lotRiskInfo[lot];
      if (riskInfo.level !== 'normal') {
        return riskLevels[riskInfo.level].color;
      }
      return color;
    });
    
    const pointRadius = lots.map(lot => {
      const riskInfo = lotRiskInfo[lot];
      return riskInfo.level !== 'normal' ? 8 : 4;
    });

    return {
      label: `${failCode.name}`,
      data: dataPoints,
      borderColor: color,
      backgroundColor: color.replace('1)', '0.15)'),
      borderWidth: 4,
      fill: true,
      tension: 0.3,
      pointBackgroundColor: pointBackgroundColor,
      pointBorderColor: pointBorderColor,
      pointRadius: pointRadius.map(r => r + 1), // 포인트 크기 증가
      pointHoverRadius: 10,
      // 3D 효과를 위한 향상된 설정
      pointBorderWidth: 3,
      pointHoverBorderWidth: 4,
      pointStyle: 'circle',
      pointRotation: 0,
      // 라인 스타일링
      borderCapStyle: 'round',
      borderJoinStyle: 'round',
      // 그라데이션 효과를 위한 설정
      segment: {
        borderColor: function(ctx) {
          const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
          gradient.addColorStop(0, color);
          gradient.addColorStop(1, color.replace('1)', '0.6)'));
          return gradient;
        }      }
    };
  }).filter(dataset => dataset !== null); // null인 데이터셋(모든 값이 0인 경우) 필터링

  // 불량율 데이터셋 추가 (새로운 계산 방식)
  const defectRateData = lots.map(lot => {
    const riskInfo = lotRiskInfo[lot];
    return riskInfo.rate; // 이미 계산된 발생율 사용
  });
  
  // 불량율 막대차트 데이터셋 추가 (Risk Level별 색상 적용)
  datasets.push({
    type: 'bar',
    label: 'Spec Out (발생율) %',
    data: defectRateData,
    backgroundColor: lots.map(lot => {
      const riskInfo = lotRiskInfo[lot];
      if (riskInfo.level !== 'normal') {
        return riskLevels[riskInfo.level].bgColor;
      }
      return 'rgba(135, 206, 235, 0.8)'; // 기본 색상
    }),
    borderColor: lots.map(lot => {
      const riskInfo = lotRiskInfo[lot];
      if (riskInfo.level !== 'normal') {
        return riskLevels[riskInfo.level].color;
      }
      return 'rgba(70, 130, 180, 1)'; // 기본 테두리 색상
    }),
    borderWidth: 2,
    // 3D 효과를 위한 설정
    borderRadius: {
      topLeft: 6,
      topRight: 6,
      bottomLeft: 0,
      bottomRight: 0
    },
    borderSkipped: false,
    yAxisID: 'y1'
  });

  // 배경 영역 설정을 위한 플러그인 생성
  const bgPlugin = {
    id: 'customCanvasBackgroundColor',
    beforeDraw: (chart) => {
      const ctx = chart.canvas.getContext('2d');
      const chartArea = chart.chartArea;
      const xAxis = chart.scales.x;
      
      // X축 각 구간별 너비 계산
      const stepWidth = chartArea.width / lots.length;
      
      // Spec Out 발생한 구간에 배경색 적용
      ctx.save();
      specOutIndices.forEach((isOut, i) => {
        if (isOut) {
          const x = xAxis.getPixelForTick(i) - stepWidth/2;
          ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
          ctx.fillRect(x, chartArea.top, stepWidth, chartArea.height);
          
          // 경계선 추가
          ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, chartArea.top);
          ctx.lineTo(x, chartArea.bottom);
          ctx.moveTo(x + stepWidth, chartArea.top);
          ctx.lineTo(x + stepWidth, chartArea.bottom);
          ctx.stroke();
        }      });
      ctx.restore();
    }
  };
  // 3D 효과를 위한 라인 그림자 플러그인 (개선된 버전)
  const lineShadowPlugin = {
    id: 'lineShadowEffect',
    beforeDatasetsDraw: function(chart) {
      const ctx = chart.ctx;
      
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        if (dataset.type !== 'bar') { // 라인 차트에만 적용
          const meta = chart.getDatasetMeta(datasetIndex);
          
          if (meta.data && meta.data.length > 0) {
            ctx.save();
            
            // 다중 그림자 효과
            const shadows = [
              { offsetX: 2, offsetY: 2, blur: 8, color: 'rgba(0, 0, 0, 0.15)' },
              { offsetX: 4, offsetY: 4, blur: 12, color: 'rgba(0, 0, 0, 0.1)' },
              { offsetX: 6, offsetY: 6, blur: 16, color: 'rgba(0, 0, 0, 0.05)' }
            ];
            
            shadows.forEach(shadow => {
              ctx.shadowColor = shadow.color;
              ctx.shadowBlur = shadow.blur;
              ctx.shadowOffsetX = shadow.offsetX;
              ctx.shadowOffsetY = shadow.offsetY;
              
              // 라인 그리기
              ctx.strokeStyle = dataset.borderColor;
              ctx.lineWidth = dataset.borderWidth;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.beginPath();
              
              meta.data.forEach((point, index) => {
                if (index === 0) {
                  ctx.moveTo(point.x, point.y);
                } else {
                  ctx.lineTo(point.x, point.y);
                }
              });
              
              ctx.stroke();
            });
            
            // 포인트에 글로우 효과 추가
            meta.data.forEach((point, index) => {
              ctx.shadowColor = dataset.borderColor.replace('1)', '0.4)');
              ctx.shadowBlur = 8;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 0;
              
              ctx.fillStyle = dataset.pointBackgroundColor[index] || dataset.borderColor;
              ctx.beginPath();
              ctx.arc(point.x, point.y, dataset.pointRadius[index] + 1, 0, 2 * Math.PI);
              ctx.fill();
            });
            
            ctx.restore();
          }
        }
      });
    }
  };

  // 3D 효과를 위한 바 차트 플러그인
  const barShadowPlugin = {
    id: 'barShadowEffect',
    afterDatasetsDraw: function(chart) {
      const ctx = chart.ctx;
      
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        if (dataset.type === 'bar') { // 바 차트에만 적용
          const meta = chart.getDatasetMeta(datasetIndex);
          
          meta.data.forEach((bar, index) => {
            if (bar && dataset.data[index] > 0) {
              ctx.save();
              
              // 바의 위치와 크기 계산
              const barWidth = bar.width;
              const barHeight = Math.abs(bar.y - bar.base);
              const x = bar.x - barWidth / 2;
              const y = Math.min(bar.y, bar.base);
              
              // 3D 측면 효과를 위한 추가 도형
              const depth = 4;
              
              // 오른쪽 측면
              ctx.fillStyle = 'rgba(255, 140, 0, 0.6)';
              ctx.beginPath();
              ctx.moveTo(x + barWidth, y);
              ctx.lineTo(x + barWidth + depth, y - depth);
              ctx.lineTo(x + barWidth + depth, y + barHeight - depth);
              ctx.lineTo(x + barWidth, y + barHeight);
              ctx.closePath();
              ctx.fill();
              
              // 상단 면
              ctx.fillStyle = 'rgba(255, 140, 0, 0.8)';
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x + depth, y - depth);
              ctx.lineTo(x + barWidth + depth, y - depth);
              ctx.lineTo(x + barWidth, y);
              ctx.closePath();
              ctx.fill();
              
              ctx.restore();
            }
          });
        }
      });
    }
  };

  // 배경 그라데이션 플러그인
  const backgroundGradientPlugin = {
    id: 'backgroundGradient',
    beforeDraw: function(chart) {
      const ctx = chart.ctx;
      const chartArea = chart.chartArea;
      
      // 전체 차트에 3D 효과를 위한 그라데이션 배경
      const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.05)');
        ctx.save();
      ctx.fillStyle = gradient;
      ctx.fillRect(chartArea.left, chartArea.top, chartArea.width, chartArea.height);
      ctx.restore();
    }
  };

  // 불량율 레이블 플러그인
  const defectRateLabelsPlugin = {
    id: 'defectRateLabels',
    afterDatasetsDraw: function(chart) {
      const ctx = chart.ctx;
      
      // 불량율 데이터셋 찾기 (바 차트이면서 레이블이 '불량율 (%)'인 것)
      const defectRateDatasetIndex = chart.data.datasets.findIndex(
        dataset => dataset.label === '불량율 (%)' && dataset.type === 'bar'
      );
      
      if (defectRateDatasetIndex === -1) return;
      
      const meta = chart.getDatasetMeta(defectRateDatasetIndex);
      const dataset = chart.data.datasets[defectRateDatasetIndex];
      
      ctx.save();
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      
      meta.data.forEach((bar, index) => {
        if (bar && dataset.data[index] > 0) {
          const rate = dataset.data[index];
          const centerX = bar.x;
          const topY = bar.y - 8;
          
          // 배경 박스 그리기
          const text = rate.toFixed(1);
          const textWidth = ctx.measureText(text).width;
          const padding = 6;
          
          // 3D 효과가 있는 배경 박스
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.fillRect(centerX - textWidth/2 - padding, topY - 18, textWidth + padding*2, 16);
          ctx.strokeStyle = '#FF8C00';
          ctx.lineWidth = 2;
          ctx.strokeRect(centerX - textWidth/2 - padding, topY - 18, textWidth + padding*2, 16);
          
          // 3D 효과를 위한 그림자
          ctx.fillStyle = 'rgba(255, 140, 0, 0.2)';
          ctx.fillRect(centerX - textWidth/2 - padding + 2, topY - 16, textWidth + padding*2, 16);
          
          // 텍스트 그리기
          ctx.fillStyle = rate > 10 ? '#d32f2f' : rate > 5 ? '#f57c00' : '#2e7d32';
          ctx.font = 'bold 12px Arial';
          ctx.fillText(text, centerX, topY - 6);
        }
      });
      
      ctx.restore();
    }
  };
  // 차트 생성
  const ctx = chartEl.getContext('2d');
  chart1Instance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: lots,
      datasets: datasets
    },    options: {
      responsive: true,
      maintainAspectRatio: false,
      // 애니메이션 효과 추가
      animation: {
        duration: 2000,
        easing: 'easeInOutQuart',
        delay: (context) => {
          return context.type === 'data' && context.mode === 'default' ? context.dataIndex * 100 : 0;
        }
      },
      interaction: {
        mode: 'index',
        intersect: false,
        // 호버 애니메이션 추가
        axis: 'x'
      },
      // 호버 효과 개선
      hover: {
        animationDuration: 400,
        intersect: false
      },
      plugins: {
        title: {
          display: true,
          text: '불량 유형 및 발생 현황 / 불량율',
          font: { size: 16 }
        },
        legend: {
          position: 'top',
          labels: { 
            usePointStyle: true,
            boxWidth: 10 
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            afterLabel: function(context) {
              const value = context.raw;
              const datasetIndex = context.datasetIndex;
              
              // 불량율 데이터셋인 경우
              if (context.dataset.label === '불량율 (%)') {
                return `불량율: ${value.toFixed(2)}%`;
              }
              
              // FAILCODE 데이터셋인 경우
              if (datasetIndex < filteredFailCodes.length) {
                const failCode = filteredFailCodes[datasetIndex];
                if (isSpecOut(failCode.column, value)) {
                  return `⚠️ Spec Out! (제한: ${failCode.spec_limit})`;
                }
              }
              return '';
            }
          }
        }
      },      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          beginAtZero: true,
          title: {
            display: true,
            text: '발생칩(수)',
            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#ffffff' : '#333'
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          beginAtZero: true,
          title: {
            display: true,
            text: '불량율 (%)',
            color: '#FF8C00'
          },
          grid: {
            drawOnChartArea: false,
          },
          ticks: {
            callback: function(value) {
              return value.toFixed(1) + '%';
            }
          }
        },
        x: {
          title: {
            display: true,
            text: 'LOT',
            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#ffffff' : '#333'
          }
        }
      }    },
    plugins: [bgPlugin, lineShadowPlugin, barShadowPlugin, backgroundGradientPlugin, defectRateLabelsPlugin]
  });
    // 차트 하단에 DATE 기준 정렬 안내 메시지 추가
  const chartContainer = chartEl.parentNode;
  const existingDateNotice = chartContainer.querySelector('.date-sort-notice');
  
  if (!existingDateNotice) {
    const dateNotice = document.createElement('div');
    dateNotice.className = 'date-sort-notice';
    dateNotice.innerHTML = '<i class="fas fa-info-circle"></i> X축은 DATE 기준 오름차순으로 정렬되어 모니터링됩니다';
    dateNotice.style.textAlign = 'center';
    dateNotice.style.marginTop = '15px';
    dateNotice.style.fontSize = '13px';
    dateNotice.style.color = '#666';
    dateNotice.style.fontStyle = 'italic';
    dateNotice.style.backgroundColor = '#f0f8ff';
    dateNotice.style.padding = '8px 12px';
    dateNotice.style.borderRadius = '4px';
    dateNotice.style.border = '1px solid #e0e8f0';
    chartContainer.appendChild(dateNotice);
  }

  // 요약 정보 업데이트
  updateChart1Summary(data, failcodeFilter);
}

function createEquipmentChart(data, failcodeFilter = 'all') {
  // 기존 차트 제거
  if (chart2Instance) {
    chart2Instance.destroy();
  }
  
  const chartEl = document.getElementById('chart2');
  if (!chartEl) {
    console.error('차트2 요소를 찾을 수 없습니다.');
    return;
  }
  
  // 데이터가 없을 경우 처리
  if (!data || data.length === 0) {
    const parentEl = chartEl.parentNode;
    if (parentEl) {
      parentEl.innerHTML = '<h2>2. 장비 연속성 및 현황</h2><div class="error-message">데이터가 없습니다.</div>';
    }
    return;
  }
  // EQPID 목록 추출 (X축) - 필드명 체크 및 대체, DATE 기준 오름차순 정렬
  const equipmentWithDates = [...new Set(data.map(item => {
    // EQPID 필드명 체크
    if (item.EQPID !== undefined) return item.EQPID;
    if (item.EQP_ID !== undefined) return item.EQP_ID;
    if (item.EQUIPMENT_ID !== undefined) return item.EQUIPMENT_ID;
    if (item.EQUIPMENT !== undefined) return item.EQUIPMENT;
    if (item.EQP !== undefined) return item.EQP;
    
    
    // 필드를 찾을 수 없으면 'Unknown' 반환
    console.warn('EQPID 필드를 찾을 수 없습니다:', item);
    return 'Unknown';
  }))].map(eqpid => {
    // 해당 설비의 첫 번째 데이터에서 날짜 추출
    const eqpData = data.find(item => {
      const itemEqpid = item.EQPID || item.EQP_ID || item.EQUIPMENT_ID || item.EQUIPMENT || item.EQP;
      return itemEqpid === eqpid;
    });
    return {
      eqpid: eqpid,
      date: eqpData ? (eqpData.DATE || eqpData['날짜'] || eqpData.date || '') : ''
    };
  });
  
  // DATE 기준으로 정렬
  equipmentWithDates.sort((a, b) => {
    const dateA = a.date;
    const dateB = b.date;
    
    // 날짜 문자열 비교
    if (dateA < dateB) return -1;
    if (dateA > dateB) return 1;
    return 0;
  });
  
  const equipments = equipmentWithDates.map(item => item.eqpid);
  console.log('날짜순 정렬된 EQPID 목록:', equipments);
  
  // 사용할 FAILCODE 필터링
  let filteredFailCodes = failCodes;
  if (failcodeFilter !== 'all') {
    filteredFailCodes = failCodes.filter(code => code.column === failcodeFilter);
  }
  
  // 각 설비별 불량 발생 LOT 정보 맵 생성 (추가)
  // 구조: { eqpid: { lotName: { failCode: count, ... }, ... }, ... }
  const equipmentLotDefects = {};
  
  equipments.forEach(eqpid => {
    equipmentLotDefects[eqpid] = {};
    
    // 해당 설비에서 처리된 LOT 목록
    const eqpData = data.filter(item => {
      const itemEqpid = item.EQPID || item.EQP_ID || item.EQUIPMENT_ID || item.EQUIPMENT || item.EQP;
      return itemEqpid === eqpid;
    });
    
    // LOT별로 불량 정보 집계
    eqpData.forEach(item => {
      const lot = item.LOT;
      if (!equipmentLotDefects[eqpid][lot]) {
        equipmentLotDefects[eqpid][lot] = {};
      }
      
      // 모든 불량 코드 또는 선택된 불량 코드에 대해 카운트
      if (failcodeFilter !== 'all') {
        const count = Number(item[failcodeFilter] || 0);
        if (count > 0) {
          equipmentLotDefects[eqpid][lot][failcodeFilter] = 
            (equipmentLotDefects[eqpid][lot][failcodeFilter] || 0) + count;
        }
      } else {
        filteredFailCodes.forEach(fc => {
          const count = Number(item[fc.column] || 0);
          if (count > 0) {
            equipmentLotDefects[eqpid][lot][fc.column] = 
              (equipmentLotDefects[eqpid][lot][fc.column] || 0) + count;
          }
        });
      }
    });
  });
  
  // 각 설비별 불량 유형 데이터 집계 (LOT 개수로 변경)
  const datasets = filteredFailCodes.map((failCode, index) => {
    const color = getChartColor(index);
    
    // 각 설비별 해당 FAILCODE가 발생한 LOT 개수 추출
    const dataPoints = equipments.map((eqpid) => {
      // 해당 EQPID의 모든 데이터에서 FAILCODE 발생한 LOT 목록 추출
      const eqpData = data.filter(item => {
        const itemEqpid = item.EQPID || item.EQP_ID || item.EQUIPMENT_ID || item.EQUIPMENT || item.EQP;
        return itemEqpid === eqpid;
      });
      
      // 해당 설비에서 불량이 발생한 LOT들의 집합 생성
      const lotsWithDefect = new Set();
      eqpData.forEach(item => {
        if ((Number(item[failCode.column]) || 0) > 0) {
          lotsWithDefect.add(item.LOT);
        }
      });
      
      return lotsWithDefect.size; // LOT 개수
    });
    
    // 모든 데이터 포인트가 0인 경우 차트에서 제외
    if (dataPoints.every(value => value === 0)) {
      return null; // null 반환하여 나중에 필터링
    }
    
    return {
      label: `${failCode.name}`,
      data: dataPoints,
      borderColor: color,
      backgroundColor: color.replace('1)', '0.2)'),
      borderWidth: 2,
      fill: false,
      tension: 0.4,
      pointBackgroundColor: color,
      pointBorderColor: color,
      pointRadius: 4,
      pointHoverRadius: 6
    };
  }).filter(dataset => dataset !== null); // null인 데이터셋(모든 값이 0인 경우) 필터링

  // 차트 생성
  const ctx = chartEl.getContext('2d');
  chart2Instance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: equipments,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick: function(e, elements, chart) {
        console.log('차트 클릭됨!', e, elements);
        
        if (elements && elements.length > 0) {
          const index = elements[0].index;
          const eqpid = equipments[index];
          console.log('클릭한 설비:', eqpid);
          showEquipmentDefectDetails(eqpid, equipmentLotDefects[eqpid]);
        } else {
          // 클릭한 위치에서 가장 가까운 포인트 찾기
          try {
            const canvasPosition = Chart.helpers.getRelativePosition(e, chart);
            const dataX = chart2Instance.scales.x.getValueForPixel(canvasPosition.x);
            
            // 근사치 확인 (클릭 영역 범위 넓힘)
            const index = Math.round(dataX);
            if (index >= 0 && index < equipments.length) {
              const eqpid = equipments[index];
              console.log('근처 설비 클릭:', eqpid);
              showEquipmentDefectDetails(eqpid, equipmentLotDefects[eqpid]);
            }
          } catch (error) {
            console.error('클릭 이벤트 처리 중 오류:', error);
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: '설비별 불량 현황',
          font: { size: 16 }
        },
        legend: {
          position: 'top',
          labels: { 
            usePointStyle: true,
            boxWidth: 10 
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            // 툴팁 제목에 설비 정보 추가
            title: function(tooltipItems) {
              return `설비: ${tooltipItems[0].label}`;
            },
            // 툴팁 내용에 해당 설비에서 불량이 발생한 LOT 정보 추가
            afterBody: function(tooltipItems) {
              const eqpid = tooltipItems[0].label;
              const lotDefects = equipmentLotDefects[eqpid];
              
              if (!lotDefects) return '';
              
              // LOT별 불량 정보 포맷팅
              let details = ['▼ 불량 발생 LOT 목록 ▼'];
              const lots = Object.keys(lotDefects);
              
              // LOT이 너무 많으면 최대 10개만 표시
              const maxLots = lots.length > 10 ? 10 : lots.length;
              
              for (let i = 0; i < maxLots; i++) {
                const lot = lots[i];
                const defects = lotDefects[lot];
                
                // 각 LOT의 불량 칩 합산
                let totalDefects = 0;
                let defectDetails = [];
                
                Object.entries(defects).forEach(([code, count]) => {
                  totalDefects += count;
                  // 불량 코드명 찾기
                  const failCodeInfo = failCodes.find(fc => fc.column === code);
                  const codeName = failCodeInfo ? failCodeInfo.name : code;
                  defectDetails.push(`${codeName}: ${count}칩`);
                });
                
                // LOT별 불량 정보 포맷팅
                details.push(`• ${lot}: 총 ${totalDefects}칩 (${defectDetails.join(', ')})`);
              }
              
              // 더 많은 LOT이 있을 경우 표시
              if (lots.length > 10) {
                details.push(`... 외 ${lots.length - 10}개 LOT에서도 발생`);
              }
              
              return details;
            }
          }
        }
      },      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: '발생된 LOT(개수)',
            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#ffffff' : '#333'
          }
        },
        x: {
          title: {
            display: true,
            text: '설비(EQPID)',
            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#ffffff' : '#333'
          }
        }
      }
    }
  });
  
  // 차트 요소에 시각적인 클릭 피드백 추가
  if (chartEl) {
    chartEl.style.cursor = 'pointer'; // 마우스 커서를 포인터로 변경
    
    // 클릭 시 시각적 효과 추가
    chartEl.addEventListener('click', function() {
      console.log('차트 영역 클릭됨!');
      this.style.outline = '2px solid rgba(74, 108, 247, 0.5)';
      setTimeout(() => {
        this.style.outline = 'none';
      }, 200);
    });
  }

  // 차트 하단에 클릭 안내 메시지 추가
  const chartContainer = chartEl.parentNode;
  const existingHint = chartContainer.querySelector('.chart-click-hint');
  
  if (!existingHint) {
    const clickHint = document.createElement('div');
    clickHint.className = 'chart-click-hint';
    clickHint.textContent = '💡 차트를 클릭하면 해당 설비의 상세 정보를 볼 수 있습니다.';
    clickHint.style.textAlign = 'center';
    clickHint.style.marginTop = '10px';
    clickHint.style.fontSize = '14px';
    clickHint.style.color = '#666';
    chartContainer.appendChild(clickHint);
  }
  // 차트 하단에 DATE 기준 정렬 안내 메시지 추가
  const chart2Container = chartEl.parentNode;
  const existingDateNotice2 = chart2Container.querySelector('.date-sort-notice');
  
  if (!existingDateNotice2) {
    const dateNotice2 = document.createElement('div');
    dateNotice2.className = 'date-sort-notice';
    dateNotice2.innerHTML = '<i class="fas fa-info-circle"></i> X축은 DATE 기준 오름차순으로 정렬되어 모니터링됩니다';
    dateNotice2.style.textAlign = 'center';
    dateNotice2.style.marginTop = '15px';
    dateNotice2.style.fontSize = '13px';
    dateNotice2.style.color = '#666';
    dateNotice2.style.fontStyle = 'italic';
    dateNotice2.style.backgroundColor = '#f0f8ff';
    dateNotice2.style.padding = '8px 12px';
    dateNotice2.style.borderRadius = '4px';
    dateNotice2.style.border = '1px solid #e0e8f0';
    chart2Container.appendChild(dateNotice2);
  }

  // 설비 차트 요약 정보 업데이트
  updateEquipmentSummary(data, failcodeFilter);
}


// 설비별 불량 상세 정보 표시 함수 (수정)
function showEquipmentDefectDetails(eqpid, lotDefects) {
  // 이미 모달이 있으면 제거
  let modal = document.getElementById('defectDetailModal');
  if (modal) {
    document.body.removeChild(modal);
  }
  
  // 새 모달 생성
  modal = document.createElement('div');
  modal.id = 'defectDetailModal';
  modal.className = 'modal';
  
  // 모달 스타일
  modal.style.position = 'fixed';
  modal.style.left = '0';
  modal.style.top = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';
  modal.style.zIndex = '1000';
    // 모달 컨텐츠
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  
  // 다크모드 지원을 위한 스타일 설정
  const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
  modalContent.style.backgroundColor = isDarkMode ? '#1e293b' : '#fff';
  modalContent.style.color = isDarkMode ? '#f1f5f9' : '#333';
  modalContent.style.padding = '20px';
  modalContent.style.borderRadius = '5px';
  modalContent.style.width = '90%';
  modalContent.style.maxWidth = '1000px'; // 더 넓게 설정
  modalContent.style.maxHeight = '90vh';
  modalContent.style.overflowY = 'auto';
  modalContent.style.border = isDarkMode ? '1px solid #334155' : 'none';
  
  // 모달 헤더
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.marginBottom = '20px';
    // 제목
  const title = document.createElement('h3');
  title.textContent = `설비 ${eqpid} 불량 상세 분석`;
  title.style.margin = '0';
  title.style.color = isDarkMode ? '#f1f5f9' : '#333';
  
  // 닫기 버튼
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.border = 'none';
  closeBtn.style.background = 'none';
  closeBtn.style.fontSize = '24px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.color = isDarkMode ? '#f1f5f9' : '#333';
  closeBtn.style.borderRadius = '4px';
  closeBtn.style.padding = '5px 10px';
  closeBtn.onmouseover = () => {
    closeBtn.style.backgroundColor = isDarkMode ? '#334155' : '#f0f0f0';
  };
  closeBtn.onmouseout = () => {
    closeBtn.style.backgroundColor = 'transparent';
  };
  closeBtn.onclick = () => {
    document.body.removeChild(modal);
  };
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  
  // 차트 컨테이너 생성 (이제 한 개의 차트만 포함)
  const chartsContainer = document.createElement('div');
  chartsContainer.style.display = 'flex';
  chartsContainer.style.flexDirection = 'column';
  chartsContainer.style.gap = '30px';
  chartsContainer.style.marginBottom = '20px';
  
  // 1. LOT별 총 불량 칩 차트 영역
  const totalDefectsChartContainer = document.createElement('div');
  totalDefectsChartContainer.style.width = '100%';
  totalDefectsChartContainer.style.height = '300px';
  totalDefectsChartContainer.style.position = 'relative';
  
  const totalDefectsCanvas = document.createElement('canvas');
  totalDefectsCanvas.id = 'totalDefectsChart';
  totalDefectsChartContainer.appendChild(totalDefectsCanvas);
  
  // 차트 컨테이너에 LOT별 불량 칩 차트만 추가
  chartsContainer.appendChild(totalDefectsChartContainer);
  
  // 모달에 컨텐츠 추가
  modalContent.appendChild(header);
  modalContent.appendChild(chartsContainer);
  modal.appendChild(modalContent);
  
  // 모달을 페이지에 추가
  document.body.appendChild(modal);
  
  // LOT 데이터 준비
  if (!lotDefects || Object.keys(lotDefects).length === 0) {
    const noDataMessage = document.createElement('p');
    noDataMessage.textContent = '불량 데이터가 없습니다.';
    noDataMessage.style.textAlign = 'center';
    noDataMessage.style.fontSize = '16px';
    noDataMessage.style.marginTop = '20px';
    modalContent.appendChild(noDataMessage);
    return;
  }
  
  // 1. LOT별 총 불량 칩 차트 생성
  const lotNames = Object.keys(lotDefects).sort();
  const totalDefectCounts = lotNames.map(lot => {
    const defects = lotDefects[lot];
    return Object.values(defects).reduce((sum, count) => sum + count, 0);
  });
  
  // 상위 10개 LOT만 표시
  let sortedLotData = [...lotNames].map((lot, idx) => ({
    lot,
    count: totalDefectCounts[idx]
  })).sort((a, b) => b.count - a.count);
  
  if (sortedLotData.length > 10) {
    // 정렬 후 상위 10개만 추출
    sortedLotData = sortedLotData.slice(0, 10);
  }
  
  // LOT별 총 불량 칩 차트 생성
  const totalDefectsCtx = document.getElementById('totalDefectsChart').getContext('2d');
  
  new Chart(totalDefectsCtx, {
    type: 'bar',
    data: {
      labels: sortedLotData.map(item => item.lot),
      datasets: [{
        label: '총 불량 칩',
        data: sortedLotData.map(item => item.count),
        backgroundColor: 'rgba(74, 108, 247, 0.7)',
        borderColor: 'rgba(74, 108, 247, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'LOT별 총 불량 칩 (상위 10개)',
          font: { size: 16, weight: 'bold' }
        },
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.parsed.y}칩`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: '불량 칩'
          }
        },
        x: {
          title: {
            display: true,
            text: 'LOT'
          },
          ticks: {
            maxRotation: 45,
            minRotation: 45
          }
        }
      }
    }
  });
  
  // 테이블 섹션 추가 (상세 데이터용)
  const tableSection = document.createElement('div');
  tableSection.style.marginTop = '30px';
  
  const tableSectionTitle = document.createElement('h4');
  tableSectionTitle.textContent = '불량 발생 상세 데이터';
  tableSectionTitle.style.marginBottom = '10px';
  tableSection.appendChild(tableSectionTitle);
  
  // 테이블 생성
  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.fontSize = '14px';
  
  // 테이블 헤더
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  const headers = ['LOT', '총 불량 칩', '불량 유형별 칩', 'Spec Out'];
  headers.forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    th.style.padding = '8px';
    th.style.borderBottom = '1px solid #ddd';
    th.style.textAlign = 'left';
    th.style.backgroundColor = '#f2f2f2';
    headerRow.appendChild(th);
  });
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // 테이블 바디
  const tbody = document.createElement('tbody');
  
  if (lotDefects) {
    // LOT별로 정렬 (알파벳 순)
    const sortedLots = Object.keys(lotDefects).sort();
    
    sortedLots.forEach(lot => {
      const defects = lotDefects[lot];
      const row = document.createElement('tr');
      
      // LOT 셀
      const lotCell = document.createElement('td');
      lotCell.textContent = lot;
      lotCell.style.padding = '8px';
      lotCell.style.borderBottom = '1px solid #ddd';
      
      // 총 불량 칩 셀
      const totalDefects = Object.values(defects).reduce((sum, count) => sum + count, 0);
      const totalCell = document.createElement('td');
      totalCell.textContent = totalDefects;
      totalCell.style.padding = '8px';
      totalCell.style.borderBottom = '1px solid #ddd';
      
      // 불량 유형별 칩 셀
      const detailsCell = document.createElement('td');
      detailsCell.style.padding = '8px';
      detailsCell.style.borderBottom = '1px solid #ddd';
      
      const defectDetails = Object.entries(defects).map(([code, count]) => {
        const failCodeInfo = failCodes.find(fc => fc.column === code);
        const codeName = failCodeInfo ? failCodeInfo.name : code;
        return `${codeName}: ${count}칩`;
      });
      
      detailsCell.textContent = defectDetails.join(', ');
      
      // Spec Out 셀
      const specOutCell = document.createElement('td');
      specOutCell.style.padding = '8px';
      specOutCell.style.borderBottom = '1px solid #ddd';
      
      // 각 불량 코드별로 Spec Out 확인
      const specOuts = Object.entries(defects)
        .filter(([code, count]) => isSpecOut(code, count))
        .map(([code, count]) => {
          const failCodeInfo = failCodes.find(fc => fc.column === code);
          const codeName = failCodeInfo ? failCodeInfo.name : code;
          const limit = failCodeInfo ? failCodeInfo.spec_limit : '?';
          return `${codeName} (${count}/${limit})`;
        });
      
      if (specOuts.length > 0) {
        specOutCell.textContent = `⚠️ ${specOuts.join(', ')}`;
        specOutCell.style.color = '#d32f2f';
      } else {
        specOutCell.textContent = 'OK';
        specOutCell.style.color = '#2e7d32';
      }
      
      row.appendChild(lotCell);
      row.appendChild(totalCell);
      row.appendChild(detailsCell);
      row.appendChild(specOutCell);
      
      tbody.appendChild(row);
    });
  }
  
  table.appendChild(tbody);
  tableSection.appendChild(table);
  
  modalContent.appendChild(tableSection);
  
  // 모달 외부 클릭 시 닫기
  modal.addEventListener('click', function(event) {
    if (event.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

// P/C별 불량 상세 정보 표시 함수
function showProbecardDefectDetails(pcid, lotDefects) {
  // 이미 모달이 있으면 제거
  let modal = document.getElementById('probecardDetailModal');
  if (modal) {
    document.body.removeChild(modal);
  }
  
  // 새 모달 생성
  modal = document.createElement('div');
  modal.id = 'probecardDetailModal';
  modal.className = 'modal';
  
  // 모달 스타일
  modal.style.position = 'fixed';
  modal.style.left = '0';
  modal.style.top = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';
  modal.style.zIndex = '1000';
    // 모달 컨텐츠
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  
  // 다크모드 지원을 위한 스타일 설정
  const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
  modalContent.style.backgroundColor = isDarkMode ? '#1e293b' : '#fff';
  modalContent.style.color = isDarkMode ? '#f1f5f9' : '#333';
  modalContent.style.padding = '20px';
  modalContent.style.borderRadius = '5px';
  modalContent.style.width = '90%';
  modalContent.style.maxWidth = '1000px';
  modalContent.style.maxHeight = '90vh';
  modalContent.style.overflowY = 'auto';
  modalContent.style.border = isDarkMode ? '1px solid #334155' : 'none';
  
  // 모달 헤더
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.marginBottom = '20px';
  
  // 제목
  const title = document.createElement('h3');
  title.textContent = `P/C ${pcid} 불량 상세 분석`;
  title.style.margin = '0';
  title.style.color = isDarkMode ? '#f1f5f9' : '#333';
  
  // 닫기 버튼
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.border = 'none';
  closeBtn.style.background = 'none';
  closeBtn.style.fontSize = '24px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.color = isDarkMode ? '#f1f5f9' : '#333';
  closeBtn.style.borderRadius = '4px';
  closeBtn.style.padding = '5px 10px';
  closeBtn.onmouseover = () => {
    closeBtn.style.backgroundColor = isDarkMode ? '#334155' : '#f0f0f0';
  };
  closeBtn.onmouseout = () => {
    closeBtn.style.backgroundColor = 'transparent';
  };
  closeBtn.onclick = () => {
    document.body.removeChild(modal);
  };
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  
  // 차트 컨테이너 생성
  const chartsContainer = document.createElement('div');
  chartsContainer.style.display = 'flex';
  chartsContainer.style.flexDirection = 'column';
  chartsContainer.style.gap = '30px';
  chartsContainer.style.marginBottom = '20px';
  
  // LOT별 총 불량 칩 차트 영역
  const totalDefectsChartContainer = document.createElement('div');
  totalDefectsChartContainer.style.width = '100%';
  totalDefectsChartContainer.style.height = '300px';
  totalDefectsChartContainer.style.position = 'relative';
  
  const totalDefectsCanvas = document.createElement('canvas');
  totalDefectsCanvas.id = 'pcTotalDefectsChart';
  totalDefectsChartContainer.appendChild(totalDefectsCanvas);
  
  // 차트 컨테이너에 LOT별 불량 칩 차트 추가
  chartsContainer.appendChild(totalDefectsChartContainer);
  
  // 모달에 컨텐츠 추가
  modalContent.appendChild(header);
  modalContent.appendChild(chartsContainer);
  modal.appendChild(modalContent);
  
  // 모달을 페이지에 추가
  document.body.appendChild(modal);
  
  // LOT 데이터 준비
  if (!lotDefects || Object.keys(lotDefects).length === 0) {
    const noDataMessage = document.createElement('p');
    noDataMessage.textContent = '불량 데이터가 없습니다.';
    noDataMessage.style.textAlign = 'center';
    noDataMessage.style.fontSize = '16px';
    noDataMessage.style.marginTop = '20px';
    modalContent.appendChild(noDataMessage);
    return;
  }
  
  // LOT별 총 불량 칩 차트 생성
  const lotNames = Object.keys(lotDefects).sort();
  const totalDefectCounts = lotNames.map(lot => {
    const defects = lotDefects[lot];
    return Object.values(defects).reduce((sum, count) => sum + count, 0);
  });
  
  // 상위 10개 LOT만 표시
  let sortedLotData = [...lotNames].map((lot, idx) => ({
    lot,
    count: totalDefectCounts[idx]
  })).sort((a, b) => b.count - a.count);
  
  if (sortedLotData.length > 10) {
    // 정렬 후 상위 10개만 추출
    sortedLotData = sortedLotData.slice(0, 10);
  }
    // LOT별 총 불량 칩 차트 생성
  const totalDefectsCtx = document.getElementById('pcTotalDefectsChart').getContext('2d');
  
  new Chart(totalDefectsCtx, {
    type: 'bar',
    data: {
      labels: sortedLotData.map(item => item.lot),
      datasets: [{
        label: '총 불량 칩',
        data: sortedLotData.map(item => item.count),
        backgroundColor: 'rgba(255, 99, 132, 0.7)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'LOT별 총 불량 칩 (상위 10개)',
          font: { size: 16, weight: 'bold' }
        },
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.parsed.y}칩`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: '불량 칩'
          }
        },
        x: {
          title: {
            display: true,
            text: 'LOT'
          },
          ticks: {
            maxRotation: 45,
            minRotation: 45
          }
        }
      }
    }
  });
  
  // 테이블 섹션 추가 (상세 데이터용)
  const tableSection = document.createElement('div');
  tableSection.style.marginTop = '30px';
  
  const tableSectionTitle = document.createElement('h4');
  tableSectionTitle.textContent = '불량 발생 상세 데이터';
  tableSectionTitle.style.marginBottom = '10px';
  tableSectionTitle.style.color = isDarkMode ? '#f1f5f9' : '#333';
  tableSection.appendChild(tableSectionTitle);
  
  // 테이블 생성
  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.fontSize = '14px';
  table.style.backgroundColor = isDarkMode ? '#1e293b' : '#fff';
  
  // 테이블 헤더
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  const headers = ['LOT', '총 불량 칩', '불량 유형별 칩', 'Spec Out'];
  headers.forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    th.style.padding = '8px';
    th.style.borderBottom = isDarkMode ? '1px solid #475569' : '1px solid #ddd';
    th.style.textAlign = 'left';
    th.style.backgroundColor = isDarkMode ? '#334155' : '#f2f2f2';
    th.style.color = isDarkMode ? '#f1f5f9' : '#333';
    headerRow.appendChild(th);
  });
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // 테이블 바디
  const tbody = document.createElement('tbody');
  
  if (lotDefects) {
    // LOT별로 정렬 (알파벳 순)
    const sortedLots = Object.keys(lotDefects).sort();
    
    sortedLots.forEach(lot => {
      const defects = lotDefects[lot];
      const row = document.createElement('tr');
      
      // LOT 셀
      const lotCell = document.createElement('td');
      lotCell.textContent = lot;
      lotCell.style.padding = '8px';
      lotCell.style.borderBottom = '1px solid #ddd';
      
      // 총 불량 칩 셀
      const totalDefects = Object.values(defects).reduce((sum, count) => sum + count, 0);
      const totalCell = document.createElement('td');
      totalCell.textContent = totalDefects;
      totalCell.style.padding = '8px';
      totalCell.style.borderBottom = '1px solid #ddd';
      
      // 불량 유형별 칩 셀
      const detailsCell = document.createElement('td');
      detailsCell.style.padding = '8px';
      detailsCell.style.borderBottom = '1px solid #ddd';
      
      const defectDetails = Object.entries(defects).map(([code, count]) => {
        const failCodeInfo = failCodes.find(fc => fc.column === code);
        const codeName = failCodeInfo ? failCodeInfo.name : code;
        return `${codeName}: ${count}칩`;
      });
      
      detailsCell.textContent = defectDetails.join(', ');
      
      // Spec Out 셀
      const specOutCell = document.createElement('td');
      specOutCell.style.padding = '8px';
      specOutCell.style.borderBottom = '1px solid #ddd';
      
      // 각 불량 코드별로 Spec Out 확인
      const specOuts = Object.entries(defects)
        .filter(([code, count]) => isSpecOut(code, count))
        .map(([code, count]) => {
          const failCodeInfo = failCodes.find(fc => fc.column === code);
          const codeName = failCodeInfo ? failCodeInfo.name : code;
          const limit = failCodeInfo ? failCodeInfo.spec_limit : '?';
          return `${codeName} (${count}/${limit})`;
        });
      
      if (specOuts.length > 0) {
        specOutCell.textContent = `⚠️ ${specOuts.join(', ')}`;
        specOutCell.style.color = '#d32f2f';
      } else {
        specOutCell.textContent = 'OK';
        specOutCell.style.color = '#2e7d32';
      }
      
      row.appendChild(lotCell);
      row.appendChild(totalCell);
      row.appendChild(detailsCell);
      row.appendChild(specOutCell);
      
      tbody.appendChild(row);
    });
  }
  
  table.appendChild(tbody);
  tableSection.appendChild(table);
  
  modalContent.appendChild(tableSection);
  
  // 모달 외부 클릭 시 닫기
  modal.addEventListener('click', function(event) {
    if (event.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

// 차트 3: P/C별(PCID) 불량 현황 수정
function createProbecardChart(data, failcodeFilter = 'all') {
  // 기존 차트 제거
  if (chart3Instance) {
    chart3Instance.destroy();
  }
  
  const chartEl = document.getElementById('chart3');
  if (!chartEl) {
    console.error('차트3 요소를 찾을 수 없습니다.');
    return;
  }
  
  // 데이터가 없을 경우 처리
  if (!data || data.length === 0) {
    const parentEl = chartEl.parentNode;
    if (parentEl) {
      parentEl.innerHTML = '<h2>3. P/C 연속성 및 현황</h2><div class="error-message">데이터가 없습니다.</div>';
    }
    return;
  }
  // PCID 목록 추출 (X축) - 필드명 체크 및 대체, DATE 기준 오름차순 정렬
  const probecardWithDates = [...new Set(data.map(item => {
    // PCID 필드명 체크
    if (item.PCID !== undefined) return item.PCID;
    if (item.PC_ID !== undefined) return item.PC_ID;
    if (item.PROBE_CARD_ID !== undefined) return item.PROBE_CARD_ID;
    if (item.PROBECARD_ID !== undefined) return item.PROBECARD_ID;
    if (item.PROBE_CARD !== undefined) return item.PROBE_CARD;
    
    // 필드를 찾을 수 없으면 'Unknown' 반환
    console.warn('PCID 필드를 찾을 수 없습니다:', item);
    return 'Unknown';
  }))].map(pcid => {
    // 해당 P/C의 첫 번째 데이터에서 날짜 추출
    const pcData = data.find(item => {
      const itemPcid = item.PCID || item.PC_ID || item.PROBE_CARD_ID || item.PROBECARD_ID || item.PROBE_CARD;
      return itemPcid === pcid;
    });
    return {
      pcid: pcid,
      date: pcData ? (pcData.DATE || pcData['날짜'] || pcData.date || '') : ''
    };
  });
  
  // DATE 기준으로 정렬
  probecardWithDates.sort((a, b) => {
    const dateA = a.date;
    const dateB = b.date;
    
    // 날짜 문자열 비교
    if (dateA < dateB) return -1;
    if (dateA > dateB) return 1;
    return 0;
  });
  
  const probecards = probecardWithDates.map(item => item.pcid);
  console.log('날짜순 정렬된 PCID 목록:', probecards);
  
  // 사용할 FAILCODE 필터링
  let filteredFailCodes = failCodes;
  if (failcodeFilter !== 'all') {
    filteredFailCodes = failCodes.filter(code => code.column === failcodeFilter);
  }
  
  // 각 P/C별 불량 발생 LOT 정보 맵 생성 (추가)
  // 구조: { pcid: { lotName: { failCode: count, ... }, ... }, ... }
  const probecardLotDefects = {};
  
  probecards.forEach(pcid => {
    probecardLotDefects[pcid] = {};
    
    // 해당 P/C에서 처리된 LOT 목록
    const pcData = data.filter(item => {
      const itemPcid = item.PCID || item.PC_ID || item.PROBE_CARD_ID || item.PROBECARD_ID || item.PROBE_CARD;
      return itemPcid === pcid;
    });
    
    // LOT별로 불량 정보 집계
    pcData.forEach(item => {
      const lot = item.LOT;
      if (!probecardLotDefects[pcid][lot]) {
        probecardLotDefects[pcid][lot] = {};
      }
      
      // 모든 불량 코드 또는 선택된 불량 코드에 대해 카운트
      if (failcodeFilter !== 'all') {
        const count = Number(item[failcodeFilter] || 0);
        if (count > 0) {
          probecardLotDefects[pcid][lot][failcodeFilter] = 
            (probecardLotDefects[pcid][lot][failcodeFilter] || 0) + count;
        }
      } else {
        filteredFailCodes.forEach(fc => {
          const count = Number(item[fc.column] || 0);
          if (count > 0) {
            probecardLotDefects[pcid][lot][fc.column] = 
              (probecardLotDefects[pcid][lot][fc.column] || 0) + count;
          }
        });
      }
    });
  });
  
  // 각 P/C별 불량 유형 데이터 집계 (LOT 개수로 변경)
  const datasets = filteredFailCodes.map((failCode, index) => {
    const color = getChartColor(index);
    
    // 각 P/C별 해당 FAILCODE가 발생한 LOT 개수 추출
    const dataPoints = probecards.map((pcid) => {
      // 해당 PCID의 모든 데이터에서 FAILCODE 발생한 LOT 목록 추출
      const pcData = data.filter(item => {
        const itemPcid = item.PCID || item.PC_ID || item.PROBE_CARD_ID || item.PROBECARD_ID || item.PROBE_CARD;
        return itemPcid === pcid;
      });
      
      // 해당 P/C에서 불량이 발생한 LOT들의 집합 생성
      const lotsWithDefect = new Set();
      pcData.forEach(item => {
        if ((Number(item[failCode.column]) || 0) > 0) {
          lotsWithDefect.add(item.LOT);
        }
      });
      
      return lotsWithDefect.size; // LOT 개수
    });
    
    // 모든 데이터 포인트가 0인 경우 차트에서 제외
    if (dataPoints.every(value => value === 0)) {
      return null; // null 반환하여 나중에 필터링
    }
    
    return {
      label: `${failCode.name}`,
      data: dataPoints,
      borderColor: color,
      backgroundColor: color.replace('1)', '0.2)'),
      borderWidth: 2,
      fill: false,
      tension: 0.4,
      pointBackgroundColor: color,
      pointBorderColor: color,
      pointRadius: 4,
      pointHoverRadius: 6
    };
  }).filter(dataset => dataset !== null); // null인 데이터셋(모든 값이 0인 경우) 필터링

  // 차트 생성
  const ctx = chartEl.getContext('2d');
  chart3Instance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: probecards,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick: function(e, elements, chart) {
        console.log('P/C 차트 클릭됨!', e, elements);
        
        if (elements && elements.length > 0) {
          const index = elements[0].index;
          const pcid = probecards[index];
          console.log('클릭한 P/C:', pcid);
          showProbecardDefectDetails(pcid, probecardLotDefects[pcid]);
        } else {
          // 클릭한 위치에서 가장 가까운 포인트 찾기
          try {
            const canvasPosition = Chart.helpers.getRelativePosition(e, chart);
            const dataX = chart3Instance.scales.x.getValueForPixel(canvasPosition.x);
            
            // 근사치 확인 (클릭 영역 범위 넓힘)
            const index = Math.round(dataX);
            if (index >= 0 && index < probecards.length) {
              const pcid = probecards[index];
              console.log('근처 P/C 클릭:', pcid);
              showProbecardDefectDetails(pcid, probecardLotDefects[pcid]);
            }
          } catch (error) {
            console.error('클릭 이벤트 처리 중 오류:', error);
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: 'P/C별 불량 현황',
          font: { size: 16 }
        },
        legend: {
          position: 'top',
          labels: { 
            usePointStyle: true,
            boxWidth: 10 
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            // 툴팁 제목에 P/C 정보 추가
            title: function(tooltipItems) {
              return `P/C: ${tooltipItems[0].label}`;
            },
            // 툴팁 내용에 해당 P/C에서 불량이 발생한 LOT 정보 추가
            afterBody: function(tooltipItems) {
              const pcid = tooltipItems[0].label;
              const lotDefects = probecardLotDefects[pcid];
              
              if (!lotDefects) return '';
              
              // LOT별 불량 정보 포맷팅
              let details = ['▼ 불량 발생 LOT 목록 ▼'];
              const lots = Object.keys(lotDefects);
              
              // LOT이 너무 많으면 최대 10개만 표시
              const maxLots = lots.length > 10 ? 10 : lots.length;
              
              for (let i = 0; i < maxLots; i++) {
                const lot = lots[i];
                const defects = lotDefects[lot];
                
                // 각 LOT의 불량 칩 합산
                let totalDefects = 0;
                let defectDetails = [];
                
                Object.entries(defects).forEach(([code, count]) => {
                  totalDefects += count;
                  // 불량 코드명 찾기
                  const failCodeInfo = failCodes.find(fc => fc.column === code);
                  const codeName = failCodeInfo ? failCodeInfo.name : code;
                  defectDetails.push(`${codeName}: ${count}칩`);
                });
                
                // LOT별 불량 정보 포맷팅
                details.push(`• ${lot}: 총 ${totalDefects}칩 (${defectDetails.join(', ')})`);
              }
              
              // 더 많은 LOT이 있을 경우 표시
              if (lots.length > 10) {
                details.push(`... 외 ${lots.length - 10}개 LOT에서도 발생`);
              }
              
              return details;
            }
          }
        }
      },      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: '발생된 LOT(개수)',
            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#ffffff' : '#333'
          }
        },
        x: {
          title: {
            display: true,
            text: '카드(PCID)',
            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#ffffff' : '#333'
          }
        }
      }
    }
  });
  
  // 차트 요소에 시각적인 클릭 피드백 추가
  if (chartEl) {
    chartEl.style.cursor = 'pointer'; // 마우스 커서를 포인터로 변경
    
    // 클릭 시 시각적 효과 추가
    chartEl.addEventListener('click', function() {
      console.log('차트 영역 클릭됨!');
      this.style.outline = '2px solid rgba(74, 108, 247, 0.5)';
      setTimeout(() => {
        this.style.outline = 'none';
      }, 200);
    });
  }
  // 차트 하단에 클릭 안내 메시지 추가
  const chartContainer = chartEl.parentNode;
  const existingHint = chartContainer.querySelector('.chart-click-hint');
  
  if (!existingHint) {
    const clickHint = document.createElement('div');
    clickHint.className = 'chart-click-hint';
    clickHint.textContent = '💡 차트를 클릭하면 해당 P/C의 상세 정보를 볼 수 있습니다.';
    clickHint.style.textAlign = 'center';
    clickHint.style.marginTop = '10px';
    clickHint.style.fontSize = '14px';
    clickHint.style.color = '#666';
    chartContainer.appendChild(clickHint);
  }
  
  // 차트 하단에 DATE 기준 정렬 안내 메시지 추가
  const existingDateNotice3 = chartContainer.querySelector('.date-sort-notice');
  
  if (!existingDateNotice3) {
    const dateNotice3 = document.createElement('div');
    dateNotice3.className = 'date-sort-notice';
    dateNotice3.innerHTML = '<i class="fas fa-info-circle"></i> X축은 DATE 기준 오름차순으로 정렬되어 모니터링됩니다';
    dateNotice3.style.textAlign = 'center';
    dateNotice3.style.marginTop = '10px';
    dateNotice3.style.fontSize = '13px';
    dateNotice3.style.color = '#666';
    dateNotice3.style.fontStyle = 'italic';
    dateNotice3.style.backgroundColor = '#f0f8ff';
    dateNotice3.style.padding = '8px 12px';
    dateNotice3.style.borderRadius = '4px';
    dateNotice3.style.border = '1px solid #e0e8f0';
    chartContainer.appendChild(dateNotice3);
  }
  // P/C 차트 요약 정보 업데이트
  updateProbecardSummary(data, failcodeFilter);
}

// 차트 4: 불량 발생 패턴 분석 (누적 막대그래프)
function createChart4(data, failcodeFilter = 'all') {
  // 기존 차트 제거
  if (chart4Instance) {
    chart4Instance.destroy();
  }
  
  const chartEl = document.getElementById('chart4');
  if (!chartEl) {
    console.error('차트4 요소를 찾을 수 없습니다.');
    return;
  }
  
  // 데이터가 없을 경우 처리
  if (!data || data.length === 0) {
    const parentEl = chartEl.parentNode;
    if (parentEl) {
      parentEl.innerHTML = '<h2>4. 불량 발생 패턴 분석</h2><div class="error-message">데이터가 없습니다.</div>';
    }
    return;
  }
    // DATE별 불량 발생 현황 집계
  const dateData = {};
  
  // 날짜를 년월일까지만 변환하는 함수
  function formatDateToYMD(dateStr) {
    if (!dateStr || dateStr === 'Unknown') return 'Unknown';
    
    // "23년 05월 22일 14시 30분" 형식을 "23년 05월 22일"로 변환
    if (dateStr.includes('년') && dateStr.includes('월') && dateStr.includes('일')) {
      const match = dateStr.match(/(\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일/);
      if (match) {
        const year = match[1].padStart(2, '0');
        const month = match[2].padStart(2, '0');
        const day = match[3].padStart(2, '0');
        return `${year}년 ${month}월 ${day}일`;
      }
    }
    
    // 기타 형식의 경우 원본 반환
    return dateStr;
  }
  
  data.forEach(item => {
    const originalDate = item.DATE || item['날짜'] || item.date || 'Unknown';
    const date = formatDateToYMD(originalDate);
    if (!dateData[date]) {
      dateData[date] = { zeroDefects: 0, nonZeroDefects: 0 };
    }
    
    // 선택된 불량 유형에 따라 불량 발생 여부 확인
    let hasDefect = false;
    
    if (failcodeFilter === 'all') {
      // 모든 불량 유형 확인
      hasDefect = failCodes.some(fc => Number(item[fc.column] || 0) > 0);
    } else {
      // 특정 불량 유형만 확인
      hasDefect = Number(item[failcodeFilter] || 0) > 0;
    }
    
    if (hasDefect) {
      dateData[date].nonZeroDefects++;
    } else {
      dateData[date].zeroDefects++;
    }
  });
  
  // 날짜순으로 정렬
  const sortedDates = Object.keys(dateData).sort();
  
  // 차트 데이터 준비
  const zeroDefectData = sortedDates.map(date => dateData[date].zeroDefects);
  const nonZeroDefectData = sortedDates.map(date => dateData[date].nonZeroDefects);
    // 각 날짜별 불량률 계산
  const defectRates = sortedDates.map(date => {
    const total = dateData[date].zeroDefects + dateData[date].nonZeroDefects;
    return total > 0 ? ((dateData[date].nonZeroDefects / total) * 100).toFixed(1) : 0;
  });

  // 차트 생성
  const ctx = chartEl.getContext('2d');
  chart4Instance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sortedDates,
      datasets: [        {
          label: '불량 미발생',
          data: zeroDefectData,
          backgroundColor: 'rgba(54, 162, 235, 0.8)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 2,
          // 3D 효과를 위한 설정
          borderRadius: {
            topLeft: 6,
            topRight: 6,
            bottomLeft: 0,
            bottomRight: 0
          },
          borderSkipped: false,
        },
        {
          label: '불량 발생',
          data: nonZeroDefectData,
          backgroundColor: 'rgba(255, 99, 132, 0.8)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 2,
          // 3D 효과를 위한 설정
          borderRadius: {
            topLeft: 6,
            topRight: 6,
            bottomLeft: 0,
            bottomRight: 0
          },
          borderSkipped: false,
        }
      ]
    },    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: '날짜별 불량 발생 패턴',
          font: { size: 16 }
        },
        legend: {
          position: 'top'
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            title: function(tooltipItems) {
              return `날짜: ${tooltipItems[0].label}`;
            },
            afterBody: function(tooltipItems) {
              const date = tooltipItems[0].label;
              const zeroCount = dateData[date].zeroDefects;
              const nonZeroCount = dateData[date].nonZeroDefects;
              const total = zeroCount + nonZeroCount;
              const defectRate = total > 0 ? ((nonZeroCount / total) * 100).toFixed(1) : 0;
              
              return [
                `총 데이터: ${total}건`,
                `불량 발생률: ${defectRate}%`
              ];
            }
          }
        }      },
      scales: {
        x: {
          stacked: true,
          title: {
            display: true,
            text: '날짜',
            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#ffffff' : '#333'
          }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          title: {
            display: true,
            text: '발생 건수',
            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#ffffff' : '#333'
          }
        }
      }
    },
    plugins: [{
      id: 'defectRateLabels',
      afterDatasetsDraw: function(chart) {
        const ctx = chart.ctx;
        const chartArea = chart.chartArea;
        
        chart.data.labels.forEach((label, index) => {
          const meta0 = chart.getDatasetMeta(0); // 불량 미발생 데이터셋
          const meta1 = chart.getDatasetMeta(1); // 불량 발생 데이터셋
          
          if (meta0.data[index] && meta1.data[index]) {
            const bar0 = meta0.data[index];
            const bar1 = meta1.data[index];
            
            // 스택된 바의 최상단 위치 계산
            const topY = Math.min(bar0.y, bar1.y) - 10;
            const centerX = bar1.x;
            
            // 불량률 계산
            const rate = defectRates[index];
            
            // 레이블 스타일 설정
            ctx.save();
            ctx.fillStyle = '#333';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            
            // 배경 박스 그리기
            const text = `${rate}%`;
            const textWidth = ctx.measureText(text).width;
            const padding = 6;
            
            // 배경 박스 (3D 효과)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(centerX - textWidth/2 - padding, topY - 20, textWidth + padding*2, 16);
            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 1;
            ctx.strokeRect(centerX - textWidth/2 - padding, topY - 20, textWidth + padding*2, 16);
            
            // 3D 효과를 위한 그림자
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(centerX - textWidth/2 - padding + 2, topY - 18, textWidth + padding*2, 16);
            
            // 텍스트 그리기
            ctx.fillStyle = rate > 50 ? '#d32f2f' : rate > 20 ? '#f57c00' : '#2e7d32';
            ctx.font = 'bold 11px Arial';
            ctx.fillText(text, centerX, topY - 8);
            
            ctx.restore();
          }
        });
      }    }, {
      id: 'threeDEffect',
      beforeDatasetsDraw: function(chart) {
        const ctx = chart.ctx;
        const chartArea = chart.chartArea;
        
        // 각 바에 3D 그림자 효과 추가
        chart.data.datasets.forEach((dataset, datasetIndex) => {
          const meta = chart.getDatasetMeta(datasetIndex);
          
          meta.data.forEach((bar, index) => {
            if (bar && dataset.data[index] > 0) {
              ctx.save();
              
              // 그림자 설정
              ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
              ctx.shadowBlur = 8;
              ctx.shadowOffsetX = 4;
              ctx.shadowOffsetY = 4;
              
              // 바의 위치와 크기 계산
              const barWidth = bar.width;
              const barHeight = Math.abs(bar.y - bar.base);
              const x = bar.x - barWidth / 2;
              const y = Math.min(bar.y, bar.base);
              
              // 3D 측면 효과를 위한 추가 도형
              const depth = 6;
              
              // 오른쪽 측면
              ctx.fillStyle = datasetIndex === 0 ? 'rgba(54, 162, 235, 0.6)' : 'rgba(255, 99, 132, 0.6)';
              ctx.beginPath();
              ctx.moveTo(x + barWidth, y);
              ctx.lineTo(x + barWidth + depth, y - depth);
              ctx.lineTo(x + barWidth + depth, y + barHeight - depth);
              ctx.lineTo(x + barWidth, y + barHeight);
              ctx.closePath();
              ctx.fill();
              
              // 상단 면
              ctx.fillStyle = datasetIndex === 0 ? 'rgba(54, 162, 235, 0.9)' : 'rgba(255, 99, 132, 0.9)';
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x + depth, y - depth);
              ctx.lineTo(x + barWidth + depth, y - depth);
              ctx.lineTo(x + barWidth, y);
              ctx.closePath();
              ctx.fill();
              
              ctx.restore();
            }
          });
        });
      },
      beforeDraw: function(chart) {
        const ctx = chart.ctx;
        const chartArea = chart.chartArea;
        
        // 전체 차트에 3D 효과를 위한 그라데이션 배경
        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.05)');
        
        ctx.save();
        ctx.fillStyle = gradient;
        ctx.fillRect(chartArea.left, chartArea.top, chartArea.width, chartArea.height);
        ctx.restore();
      }
    }]  });
    // 차트 요약 정보 업데이트
  updateChart4Summary(data, failcodeFilter);
  
  // 서브 차트들도 함께 생성
  createChart4Eqp(data, failcodeFilter);
  createChart4Pc(data, failcodeFilter);
}

// 차트 4-EQP: 설비별(EQP_ID) 불량 발생 패턴 분석 (누적 막대그래프)
function createChart4Eqp(data, failcodeFilter = 'all') {
  // 기존 차트 제거
  if (chart4EqpInstance) {
    chart4EqpInstance.destroy();
  }
  
  const chartEl = document.getElementById('chart4Eqp');
  if (!chartEl) {
    console.error('차트4Eqp 요소를 찾을 수 없습니다.');
    return;
  }
  
  // 데이터가 없을 경우 처리
  if (!data || data.length === 0) {
    const parentEl = chartEl.parentNode;
    if (parentEl) {
      parentEl.innerHTML = '<div class="error-message">데이터가 없습니다.</div>';
    }
    return;
  }
  
  // EQP_ID별 불량 발생 현황 집계
  const eqpData = {};
  
  data.forEach(item => {
    // EQP_ID 필드명 확인 및 대체
    let eqpid;
    if (item.EQPID !== undefined) eqpid = item.EQPID;
    else if (item.EQP_ID !== undefined) eqpid = item.EQP_ID;
    else if (item.EQUIPMENT_ID !== undefined) eqpid = item.EQUIPMENT_ID;
    else if (item.EQUIPMENT !== undefined) eqpid = item.EQUIPMENT;
    else if (item.EQP !== undefined) eqpid = item.EQP;
    else if (item['설비'] !== undefined) eqpid = item['설비'];
    else {
      console.warn('EQP_ID 필드를 찾을 수 없습니다:', item);
      eqpid = 'Unknown';
    }
    
    if (!eqpData[eqpid]) {
      eqpData[eqpid] = { zeroDefects: 0, nonZeroDefects: 0 };
    }
    
    // 선택된 불량 유형에 따라 불량 발생 여부 확인
    let hasDefect = false;
    
    if (failcodeFilter === 'all') {
      // 모든 불량 유형 확인
      hasDefect = failCodes.some(fc => Number(item[fc.column] || 0) > 0);
    } else {
      // 특정 불량 유형만 확인
      hasDefect = Number(item[failcodeFilter] || 0) > 0;
    }
    
    if (hasDefect) {
      eqpData[eqpid].nonZeroDefects++;
    } else {
      eqpData[eqpid].zeroDefects++;
    }
  });
  
  // EQP_ID 순으로 정렬
  const sortedEqpIds = Object.keys(eqpData).sort();
  
  // 차트 데이터 준비
  const zeroDefectData = sortedEqpIds.map(eqpid => eqpData[eqpid].zeroDefects);
  const nonZeroDefectData = sortedEqpIds.map(eqpid => eqpData[eqpid].nonZeroDefects);
  
  // 각 EQP_ID별 불량률 계산
  const defectRates = sortedEqpIds.map(eqpid => {
    const total = eqpData[eqpid].zeroDefects + eqpData[eqpid].nonZeroDefects;
    return total > 0 ? ((eqpData[eqpid].nonZeroDefects / total) * 100).toFixed(1) : 0;
  });

  // 차트 생성
  const ctx = chartEl.getContext('2d');
  chart4EqpInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sortedEqpIds,
      datasets: [
        {
          label: '불량 미발생',
          data: zeroDefectData,
          backgroundColor: 'rgba(54, 162, 235, 0.8)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 2,
          borderRadius: {
            topLeft: 6,
            topRight: 6,
            bottomLeft: 0,
            bottomRight: 0
          },
          borderSkipped: false,
        },
        {
          label: '불량 발생',
          data: nonZeroDefectData,
          backgroundColor: 'rgba(255, 99, 132, 0.8)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 2,
          borderRadius: {
            topLeft: 6,
            topRight: 6,
            bottomLeft: 0,
            bottomRight: 0
          },
          borderSkipped: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: '설비별 불량 발생 패턴',
          font: { size: 14 }
        },
        legend: {
          position: 'top'
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            title: function(tooltipItems) {
              return `설비: ${tooltipItems[0].label}`;
            },
            afterBody: function(tooltipItems) {
              const eqpid = tooltipItems[0].label;
              const zeroCount = eqpData[eqpid].zeroDefects;
              const nonZeroCount = eqpData[eqpid].nonZeroDefects;
              const total = zeroCount + nonZeroCount;
              const defectRate = total > 0 ? ((nonZeroCount / total) * 100).toFixed(1) : 0;
              
              return [
                `총 데이터: ${total}건`,
                `불량 발생률: ${defectRate}%`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,          title: {
            display: true,
            text: '설비(EQP_ID)',
            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#ffffff' : '#333'
          }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          title: {
            display: true,
            text: '발생 건수',
            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#ffffff' : '#333'
          }
        }
      }
    },
    plugins: [{
      id: 'defectRateLabels',
      afterDatasetsDraw: function(chart) {
        const ctx = chart.ctx;
        
        chart.data.labels.forEach((label, index) => {
          const meta0 = chart.getDatasetMeta(0); // 불량 미발생 데이터셋
          const meta1 = chart.getDatasetMeta(1); // 불량 발생 데이터셋
          
          if (meta0.data[index] && meta1.data[index]) {
            const bar0 = meta0.data[index];
            const bar1 = meta1.data[index];
            
            // 스택된 바의 최상단 위치 계산
            const topY = Math.min(bar0.y, bar1.y) - 10;
            const centerX = bar1.x;
            
            // 불량률 계산
            const rate = defectRates[index];
            
            // 레이블 스타일 설정
            ctx.save();
            ctx.fillStyle = '#333';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            
            // 배경 박스 그리기
            const text = `${rate}%`;
            const textWidth = ctx.measureText(text).width;
            const padding = 4;
            
            // 배경 박스 (3D 효과)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(centerX - textWidth/2 - padding, topY - 16, textWidth + padding*2, 14);
            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 1;
            ctx.strokeRect(centerX - textWidth/2 - padding, topY - 16, textWidth + padding*2, 14);
            
            // 3D 효과를 위한 그림자
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(centerX - textWidth/2 - padding + 2, topY - 14, textWidth + padding*2, 14);
            
            // 텍스트 그리기
            ctx.fillStyle = rate > 50 ? '#d32f2f' : rate > 20 ? '#f57c00' : '#2e7d32';
            ctx.font = 'bold 10px Arial';
            ctx.fillText(text, centerX, topY - 4);
            
            ctx.restore();
          }
        });
      }
    }, {
      id: 'threeDEffect',
      beforeDatasetsDraw: function(chart) {
        const ctx = chart.ctx;
        const chartArea = chart.chartArea;
        
        // 각 바에 3D 그림자 효과 추가
        chart.data.datasets.forEach((dataset, datasetIndex) => {
          const meta = chart.getDatasetMeta(datasetIndex);
          
          meta.data.forEach((bar, index) => {
            if (bar && dataset.data[index] > 0) {
              ctx.save();
              
              // 그림자 설정
              ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
              ctx.shadowBlur = 6;
              ctx.shadowOffsetX = 3;
              ctx.shadowOffsetY = 3;
              
              // 바의 위치와 크기 계산
              const barWidth = bar.width;
              const barHeight = Math.abs(bar.y - bar.base);
              const x = bar.x - barWidth / 2;
              const y = Math.min(bar.y, bar.base);
              
              // 3D 측면 효과를 위한 추가 도형
              const depth = 4;
              
              // 오른쪽 측면
              ctx.fillStyle = datasetIndex === 0 ? 'rgba(54, 162, 235, 0.6)' : 'rgba(255, 99, 132, 0.6)';
              ctx.beginPath();
              ctx.moveTo(x + barWidth, y);
              ctx.lineTo(x + barWidth + depth, y - depth);
              ctx.lineTo(x + barWidth + depth, y + barHeight - depth);
              ctx.lineTo(x + barWidth, y + barHeight);
              ctx.closePath();
              ctx.fill();
              
              // 상단 면
              ctx.fillStyle = datasetIndex === 0 ? 'rgba(54, 162, 235, 0.9)' : 'rgba(255, 99, 132, 0.9)';
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x + depth, y - depth);
              ctx.lineTo(x + barWidth + depth, y - depth);
              ctx.lineTo(x + barWidth, y);
              ctx.closePath();
              ctx.fill();
              
              ctx.restore();
            }
          });
        });
      },
      beforeDraw: function(chart) {
        const ctx = chart.ctx;
        const chartArea = chart.chartArea;
        
        // 전체 차트에 3D 효과를 위한 그라데이션 배경
        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.05)');
        
        ctx.save();
        ctx.fillStyle = gradient;
        ctx.fillRect(chartArea.left, chartArea.top, chartArea.width, chartArea.height);
        ctx.restore();
      }
    }]
  });
}

// 차트 4-PC: 프로브카드별(PCID) 불량 발생 패턴 분석 (누적 막대그래프)
function createChart4Pc(data, failcodeFilter = 'all') {
  // 기존 차트 제거
  if (chart4PcInstance) {
    chart4PcInstance.destroy();
  }
  
  const chartEl = document.getElementById('chart4Pc');
  if (!chartEl) {
    console.error('차트4Pc 요소를 찾을 수 없습니다.');
    return;
  }
  
  // 데이터가 없을 경우 처리
  if (!data || data.length === 0) {
    const parentEl = chartEl.parentNode;
    if (parentEl) {
      parentEl.innerHTML = '<div class="error-message">데이터가 없습니다.</div>';
    }
    return;
  }
  
  // PCID별 불량 발생 현황 집계
  const pcData = {};
  
  data.forEach(item => {
    // PCID 필드명 확인 및 대체
    let pcid;
    if (item.PCID !== undefined) pcid = item.PCID;
    else if (item.PC_ID !== undefined) pcid = item.PC_ID;
    else if (item.PROBE_CARD_ID !== undefined) pcid = item.PROBE_CARD_ID;
    else if (item.PROBECARD_ID !== undefined) pcid = item.PROBECARD_ID;
    else if (item.PROBE_CARD !== undefined) pcid = item.PROBE_CARD;
    else if (item['프로브카드'] !== undefined) pcid = item['프로브카드'];
    else {
      console.warn('PCID 필드를 찾을 수 없습니다:', item);
      pcid = 'Unknown';
    }
    
    if (!pcData[pcid]) {
      pcData[pcid] = { zeroDefects: 0, nonZeroDefects: 0 };
    }
    
    // 선택된 불량 유형에 따라 불량 발생 여부 확인
    let hasDefect = false;
    
    if (failcodeFilter === 'all') {
      // 모든 불량 유형 확인
      hasDefect = failCodes.some(fc => Number(item[fc.column] || 0) > 0);
    } else {
      // 특정 불량 유형만 확인
      hasDefect = Number(item[failcodeFilter] || 0) > 0;
    }
    
    if (hasDefect) {
      pcData[pcid].nonZeroDefects++;
    } else {
      pcData[pcid].zeroDefects++;
    }
  });
  
  // PCID 순으로 정렬
  const sortedPcIds = Object.keys(pcData).sort();
  
  // 차트 데이터 준비
  const zeroDefectData = sortedPcIds.map(pcid => pcData[pcid].zeroDefects);
  const nonZeroDefectData = sortedPcIds.map(pcid => pcData[pcid].nonZeroDefects);
  
  // 각 PCID별 불량률 계산
  const defectRates = sortedPcIds.map(pcid => {
    const total = pcData[pcid].zeroDefects + pcData[pcid].nonZeroDefects;
    return total > 0 ? ((pcData[pcid].nonZeroDefects / total) * 100).toFixed(1) : 0;
  });

  // 차트 생성
  const ctx = chartEl.getContext('2d');
  chart4PcInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sortedPcIds,
      datasets: [
        {
          label: '불량 미발생',
          data: zeroDefectData,
          backgroundColor: 'rgba(75, 192, 192, 0.8)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 2,
          borderRadius: {
            topLeft: 6,
            topRight: 6,
            bottomLeft: 0,
            bottomRight: 0
          },
          borderSkipped: false,
        },
        {
          label: '불량 발생',
          data: nonZeroDefectData,
          backgroundColor: 'rgba(255, 159, 64, 0.8)',
          borderColor: 'rgba(255, 159, 64, 1)',
          borderWidth: 2,
          borderRadius: {
            topLeft: 6,
            topRight: 6,
            bottomLeft: 0,
            bottomRight: 0
          },
          borderSkipped: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: '프로브카드별 불량 발생 패턴',
          font: { size: 14 }
        },
        legend: {
          position: 'top'
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            title: function(tooltipItems) {
              return `프로브카드: ${tooltipItems[0].label}`;
            },
            afterBody: function(tooltipItems) {
              const pcid = tooltipItems[0].label;
              const zeroCount = pcData[pcid].zeroDefects;
              const nonZeroCount = pcData[pcid].nonZeroDefects;
              const total = zeroCount + nonZeroCount;
              const defectRate = total > 0 ? ((nonZeroCount / total) * 100).toFixed(1) : 0;
              
              return [
                `총 데이터: ${total}건`,
                `불량 발생률: ${defectRate}%`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          title: {
            display: true,
            text: '프로브카드(PCID)',
            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#ffffff' : '#333'
          }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          title: {
            display: true,
            text: '발생 건수',
            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#ffffff' : '#333'
          }
        }
      }    },
    plugins: [
      {
        id: 'defectRateLabels',
        afterDatasetsDraw: function(chart) {
          const ctx = chart.ctx;
          
          chart.data.labels.forEach((label, index) => {
            const meta0 = chart.getDatasetMeta(0); // 불량 미발생 데이터셋
            const meta1 = chart.getDatasetMeta(1); // 불량 발생 데이터셋
            
            if (meta0.data[index] && meta1.data[index]) {
              const bar0 = meta0.data[index];
              const bar1 = meta1.data[index];
              
              // 스택된 바의 최상단 위치 계산
              const topY = Math.min(bar0.y, bar1.y) - 10;
              const centerX = bar1.x;
              
              // 불량률 계산
              const rate = defectRates[index];
              
              // 레이블 스타일 설정
              ctx.save();
              
              // 3D 그림자 효과
              const text = `${rate}%`;
              const textWidth = ctx.measureText(text).width;
              const padding = 6;
              
              // 그림자 배경 박스 (3D 효과)
              ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
              ctx.fillRect(centerX - textWidth/2 - padding + 2, topY - 16 + 2, textWidth + padding*2, 16);
              
              // 메인 배경 박스 (그라디언트)
              const gradient = ctx.createLinearGradient(
                centerX - textWidth/2 - padding, topY - 16, 
                centerX - textWidth/2 - padding, topY
              );
              gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
              gradient.addColorStop(1, 'rgba(240, 240, 240, 0.95)');
              ctx.fillStyle = gradient;
              ctx.fillRect(centerX - textWidth/2 - padding, topY - 16, textWidth + padding*2, 16);
              
              // 테두리와 하이라이트
              ctx.strokeStyle = '#ddd';
              ctx.lineWidth = 1;
              ctx.strokeRect(centerX - textWidth/2 - padding, topY - 16, textWidth + padding*2, 16);
              
              // 상단 하이라이트 (3D 효과)
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(centerX - textWidth/2 - padding, topY - 16);
              ctx.lineTo(centerX + textWidth/2 + padding, topY - 16);
              ctx.stroke();
              
              // 텍스트 그림자
              ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
              ctx.font = 'bold 10px Arial';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(text, centerX + 1, topY - 7);
              
              // 메인 텍스트
              ctx.fillStyle = rate > 50 ? '#d32f2f' : rate > 20 ? '#f57c00' : '#2e7d32';
              ctx.fillText(text, centerX, topY - 8);
              
              ctx.restore();
            }
          });
        }
      },
      {
        id: 'threeDEffect',
        beforeDatasetsDraw: function(chart) {
          const ctx = chart.ctx;
          const chartArea = chart.chartArea;
          
          // 3D 바 효과 그리기
          chart.data.datasets.forEach((dataset, datasetIndex) => {
            const meta = chart.getDatasetMeta(datasetIndex);
            if (!meta.hidden) {
              meta.data.forEach((bar, index) => {
                if (bar && typeof bar.x !== 'undefined' && typeof bar.y !== 'undefined') {
                  const barWidth = bar.width;
                  const barHeight = Math.abs(bar.base - bar.y);
                  
                  if (barHeight > 2) { // 작은 바는 3D 효과 제외
                    const depth = 6;
                    const baseColor = dataset.backgroundColor;
                    
                    // 사이드 면 (더 어두운 색)
                    let sideColor;
                    if (datasetIndex === 0) {
                      sideColor = 'rgba(60, 153, 153, 0.9)'; // 청록색 계열
                    } else {
                      sideColor = 'rgba(204, 127, 51, 0.9)'; // 오렌지색 계열
                    }
                    
                    // 우측 사이드 면
                    ctx.fillStyle = sideColor;
                    ctx.beginPath();
                    ctx.moveTo(bar.x + barWidth/2, bar.y);
                    ctx.lineTo(bar.x + barWidth/2 + depth, bar.y - depth);
                    ctx.lineTo(bar.x + barWidth/2 + depth, bar.base - depth);
                    ctx.lineTo(bar.x + barWidth/2, bar.base);
                    ctx.closePath();
                    ctx.fill();
                    
                    // 상단 면 (밝은 색)
                    let topColor;
                    if (datasetIndex === 0) {
                      topColor = 'rgba(90, 220, 220, 0.9)'; // 밝은 청록색
                    } else {
                      topColor = 'rgba(255, 190, 120, 0.9)'; // 밝은 오렌지색
                    }
                    
                    ctx.fillStyle = topColor;
                    ctx.beginPath();
                    ctx.moveTo(bar.x - barWidth/2, bar.y);
                    ctx.lineTo(bar.x - barWidth/2 + depth, bar.y - depth);
                    ctx.lineTo(bar.x + barWidth/2 + depth, bar.y - depth);
                    ctx.lineTo(bar.x + barWidth/2, bar.y);
                    ctx.closePath();
                    ctx.fill();
                    
                    // 상단 면 테두리
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                  }
                }
              });
            }
          });
        }
      },
      {
        id: 'backgroundGradient',
        beforeDraw: function(chart) {
          const ctx = chart.ctx;
          const chartArea = chart.chartArea;
          
          // 배경 그라디언트
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(240, 248, 255, 0.3)');
          gradient.addColorStop(1, 'rgba(230, 230, 250, 0.3)');
          
          ctx.fillStyle = gradient;
          ctx.fillRect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
          
          // 차트 영역 그림자
          ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
          ctx.shadowBlur = 15;
          ctx.shadowOffsetX = 3;
          ctx.shadowOffsetY = 3;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.fillRect(chartArea.left - 2, chartArea.top - 2, chartArea.right - chartArea.left + 4, chartArea.bottom - chartArea.top + 4);
          
          // 그림자 리셋
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }
      }
    ]
  });
}

// 차트 4 요약 정보 업데이트 함수
function updateChart4Summary(data, failcodeFilter = 'all') {
  const summaryEl = document.getElementById('chart4Summary');
  if (!summaryEl) {
    console.error('차트4 요약 요소를 찾을 수 없습니다.');
    return;
  }
  
  if (!data || data.length === 0) {
    summaryEl.innerHTML = '<p>데이터가 없습니다.</p>';
    return;
  }
  
  // 전체 데이터 건수
  const totalCount = data.length;
  
  // 불량 발생 건수 계산
  let defectCount = 0;
  
  data.forEach(item => {
    let hasDefect = false;
    
    if (failcodeFilter === 'all') {
      hasDefect = failCodes.some(fc => Number(item[fc.column] || 0) > 0);
    } else {
      hasDefect = Number(item[failcodeFilter] || 0) > 0;
    }
    
    if (hasDefect) {
      defectCount++;
    }
  });
  
  const defectRate = totalCount > 0 ? ((defectCount / totalCount) * 100).toFixed(1) : 0;
  const noDefectCount = totalCount - defectCount;
  
  // 날짜별 분석
  const dateAnalysis = {};
  data.forEach(item => {
    const date = item.DATE || item['날짜'] || item.date || 'Unknown';
    if (!dateAnalysis[date]) {
      dateAnalysis[date] = { total: 0, defects: 0 };
    }
    
    dateAnalysis[date].total++;
    
    let hasDefect = false;
    if (failcodeFilter === 'all') {
      hasDefect = failCodes.some(fc => Number(item[fc.column] || 0) > 0);
    } else {
      hasDefect = Number(item[failcodeFilter] || 0) > 0;
    }
    
    if (hasDefect) {
      dateAnalysis[date].defects++;
    }
  });
  
  // 최고 불량률 날짜 찾기
  let maxDefectDate = '';
  let maxDefectRate = 0;
  
  Object.entries(dateAnalysis).forEach(([date, stats]) => {
    const rate = stats.total > 0 ? (stats.defects / stats.total) * 100 : 0;
    if (rate > maxDefectRate) {
      maxDefectRate = rate;
      maxDefectDate = date;
    }
  });
  
  const failCodeName = failcodeFilter === 'all' ? '전체 불량' : 
    failCodes.find(fc => fc.column === failcodeFilter)?.name || failcodeFilter;
    let summaryHTML = `
    <p><strong>분석 대상:</strong> ${failCodeName}</p>
    <p><strong>총 데이터:</strong> ${totalCount}건</p>
    <p><strong>불량 발생:</strong> ${defectCount}건 (${defectRate}%)</p>
    <p><strong>정상 데이터:</strong> ${noDefectCount}건 (${(100 - defectRate).toFixed(1)}%)</p>
  `;
  
  summaryEl.innerHTML = summaryHTML;
}

// Spec Out LOT에 대한 세부 데이터 테이블을 보여주는 함수
function showSpecOutDetails(selectedFailcode = 'all', sourceData = null) {
  // 현재 필터링된 데이터를 사용하거나 전역 defectData 사용
  const dataToUse = sourceData || defectData;
  if (!dataToUse) return;

  // 선택된 FAILCODE에 따라 데이터 필터링
  let filteredData = [...dataToUse];

  if (selectedFailcode !== 'all') {
    // 특정 FAILCODE가 선택된 경우 - column 이름으로도 검색 가능하도록 수정
    const selectedCode = failCodes.find(fc => fc.code === selectedFailcode || fc.column === selectedFailcode);
    if (!selectedCode) return;
    
    // 해당 FAILCODE가 1 이상인 데이터만 필터링
    filteredData = dataToUse.filter(row => row[selectedCode.column] > 0);
  }
  // SLOT별 Risk Level 기반 Spec Out 확인 (Low 이상만 추출)
  const specOutData = [];
  
  filteredData.forEach(row => {
    const slotRiskInfo = calculateSlotRiskLevel(row);
    
    // Low 이상 (Low, Medium, High, Critical)만 추출
    if (slotRiskInfo.level !== 'normal') {
      specOutData.push({
        ...row,
        riskLevel: slotRiskInfo.level,
        defectRate: slotRiskInfo.rate, // SLOT별 개별 발생율
        slotCount: slotRiskInfo.slots
      });
    }
  });

  if (specOutData.length === 0) {
    alert('표시할 Spec Out 데이터가 없습니다. (Risk Level Low 이상 조건)');
    return;
  }

  // 모달 생성
  const modal = document.createElement('div');
  modal.className = 'consecutive-data-modal';
  
  // 모달 내용 컨테이너
  const modalContent = document.createElement('div');
  modalContent.className = 'consecutive-data-modal-content';
    // 헤더
  const header = document.createElement('div');
  header.className = 'consecutive-data-modal-header';
  
  const title = document.createElement('h3');
  title.innerHTML = `⚠️ Spec Out LOT 세부 데이터 (Risk Level 기반)`;
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'consecutive-data-modal-close';
  closeBtn.innerHTML = '×';
  closeBtn.onclick = () => document.body.removeChild(modal);
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  
  // 테이블 컨테이너
  const tableContainer = document.createElement('div');
  tableContainer.className = 'consecutive-data-table-container';
  
  // 테이블 생성
  const table = document.createElement('table');
  table.className = 'consecutive-data-table';
  
  // 테이블 헤더
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  // EQP_ID와 PCID 필드 동적 감지
  const firstItem = specOutData[0];
  const eqpField = ['EQPID', 'EQP_ID', 'EQUIPMENT_ID', 'EQUIPMENT', 'EQP'].find(field => firstItem[field] !== undefined);
  const pcField = ['PCID', 'PC_ID', 'PROBE_CARD_ID', 'PROBECARD_ID', 'PROBE_CARD'].find(field => firstItem[field] !== undefined);
  const dateField = ['DATE', '날짜', 'date', 'Date', 'TEST_DATE', 'TESTDATE'].find(field => firstItem[field] !== undefined);
  
  // 컬럼 정의 (Risk Level 정보 포함)
  const basicColumns = [];
  
  if (dateField) {
    basicColumns.push({ key: dateField, label: '날짜' });
  }
  basicColumns.push(
    { key: 'LOT', label: 'LOT' },
    { key: 'SLOT', label: 'SLOT' },
    { key: 'DEVICE', label: 'DEVICE' }
  );
  
  if (eqpField) {
    basicColumns.push({ key: eqpField, label: '장비ID' });
  }
  if (pcField) {
    basicColumns.push({ key: pcField, label: '프로브카드ID' });
  }
    // Risk Level 정보 컬럼 추가 (SLOT별 개별 계산)
  basicColumns.push(
    { key: 'riskLevel', label: 'Risk Level' },
    { key: 'defectRate', label: '발생율(%)' }
  );
  
  // FAILCODE 컬럼들 (모든 FAILCODE 표시)
  const failcodeColumns = failCodes.map(fc => ({ 
    key: fc.column, 
    label: fc.name
  }));
  
  // 전체 컬럼 배열 생성
  const columns = [...basicColumns, ...failcodeColumns];
  
  // 헤더 생성
  columns.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col.label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // 테이블 바디
  const tbody = document.createElement('tbody');  // 데이터 행 생성
  specOutData.forEach(item => {
    const row = document.createElement('tr');
    
    // Risk Level에 따른 행 스타일링
    const riskLevel = item.riskLevel;
    if (riskLevel !== 'normal') {
      row.style.backgroundColor = riskLevels[riskLevel].bgColor;
      row.style.borderLeft = `4px solid ${riskLevels[riskLevel].color}`;
    }
    
    columns.forEach(col => {
      const td = document.createElement('td');
      
      // 값 추출
      let value = '';
        if (col.key === 'riskLevel') {
        value = item.riskLevel.toUpperCase();
        td.style.fontWeight = 'bold';
        td.style.color = riskLevels[item.riskLevel].color;
      } else if (col.key === 'defectRate') {
        value = item.defectRate.toFixed(2) + '%';
        td.style.fontWeight = 'bold';
      } else {
        value = item[col.key] || '';
        if (!value && col.label === '날짜') {
          // 날짜 필드의 경우 다양한 필드명 시도
          value = item.DATE || item['날짜'] || item.date || item.Date || item.TEST_DATE || item.TESTDATE || '';
        }
      }
      
      // FAILCODE 컬럼인 경우 하이라이트
      if (failCodes.some(fc => fc.column === col.key) && Number(value) > 0) {
        td.style.backgroundColor = '#fff3cd';
        td.style.fontWeight = 'bold';
      }
      
      td.textContent = value;
      row.appendChild(td);
    });
    
    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  tableContainer.appendChild(table);
  
  // 모달 조립
  modalContent.appendChild(header);
  modalContent.appendChild(tableContainer);
  modal.appendChild(modalContent);
  
  // 모달을 페이지에 추가
  document.body.appendChild(modal);
  
  // ESC 키로 모달 닫기
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      document.body.removeChild(modal);
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
  
  // 모달 배경 클릭으로 닫기
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
      document.removeEventListener('keydown', handleEscape);
    }
  });
}

// 동일 불량 LOT 연속 발생 여부 체크 함수
function checkConsecutiveDefectsInLot(data) {
  // LOT+SLOT별로 그룹화하여 FAILCODE 분석
  const lotSlotGroups = {};
  
  data.forEach(item => {
    const lot = item.LOT;
    const slot = item.SLOT;
    
    if (!lotSlotGroups[lot]) {
      lotSlotGroups[lot] = {};
    }
    if (!lotSlotGroups[lot][slot]) {
      lotSlotGroups[lot][slot] = {};
    }
    
    // 각 FAILCODE에 대해 불량 수 저장
    failCodes.forEach(fc => {
      const count = Number(item[fc.column] || 0);
      if (count > 0) {
        if (!lotSlotGroups[lot][slot][fc.column]) {
          lotSlotGroups[lot][slot][fc.column] = 0;
        }
        lotSlotGroups[lot][slot][fc.column] += count;
      }
    });
  });
  
  // LOT별로 연속 불량 발생 여부 체크
  const consecutiveDefects = [];
  
  Object.keys(lotSlotGroups).forEach(lot => {
    const slots = lotSlotGroups[lot];
    const slotKeys = Object.keys(slots);
    
    if (slotKeys.length < 2) return; // 최소 2개 SLOT이 있어야 연속성 체크 가능
    
    // 각 FAILCODE별로 여러 SLOT에서 발생했는지 체크
    failCodes.forEach(fc => {
      const slotsWithThisDefect = [];
      
      slotKeys.forEach(slot => {
        if (slots[slot][fc.column] && slots[slot][fc.column] > 0) {
          slotsWithThisDefect.push({
            slot: slot,
            count: slots[slot][fc.column]
          });
        }
      });
      
      // 동일한 FAILCODE가 2개 이상의 SLOT에서 발생한 경우
      if (slotsWithThisDefect.length >= 2) {
        consecutiveDefects.push({
          lot: lot,
          failcode: fc.name,
          failcodeColumn: fc.column,
          slots: slotsWithThisDefect,
          totalCount: slotsWithThisDefect.reduce((sum, s) => sum + s.count, 0)
        });
      }
    });
  });
    return consecutiveDefects;
}

// 여러 연속 불량 선택 모달 표시 함수
function showMultipleConsecutiveDefectSelector(consecutiveDefects, allData) {
  // 모달 생성
  const modal = document.createElement('div');
  modal.className = 'consecutive-data-modal';
  
  // 모달 내용 컨테이너
  const modalContent = document.createElement('div');
  modalContent.className = 'consecutive-data-modal-content';
  modalContent.style.maxWidth = '600px';
  modalContent.style.width = '90%';
  
  // 헤더
  const header = document.createElement('div');
  header.className = 'consecutive-data-modal-header';
  
  const title = document.createElement('h3');
  title.innerHTML = `🔄 연속 불량 선택 (${consecutiveDefects.length}칩)`;
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'consecutive-data-modal-close';
  closeBtn.innerHTML = '×';
  closeBtn.onclick = () => document.body.removeChild(modal);
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  
  // 연속 불량 목록
  const listContainer = document.createElement('div');
  listContainer.style.padding = '20px 0';
  
  const description = document.createElement('p');
  description.innerHTML = '상세 데이터를 확인할 연속 불량을 선택하세요:';
  description.style.marginBottom = '15px';
  description.style.fontSize = '14px';
  description.style.color = '#666';
  
  listContainer.appendChild(description);
  
  consecutiveDefects.forEach((cd, index) => {
    const item = document.createElement('div');
    item.style.cssText = `
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 12px;
      margin: 8px 0;
      cursor: pointer;
      transition: all 0.2s ease;
      background: #f9f9f9;
    `;
    
    item.innerHTML = `
      <div style="font-weight: bold; color: #333; margin-bottom: 4px;">${cd.lot} - ${cd.failcode}</div>
      <div style="font-size: 13px; color: #666;">SLOT ${cd.slots.map(s => `${s.slot}(${s.count}칩)`).join(', ')} - 총 ${cd.totalCount}칩</div>
    `;
    
    item.addEventListener('mouseover', () => {
      item.style.background = '#e3f2fd';
      item.style.borderColor = '#2196f3';
      item.style.transform = 'translateY(-2px)';
      item.style.boxShadow = '0 4px 8px rgba(33,150,243,0.2)';
    });
    
    item.addEventListener('mouseout', () => {
      item.style.background = '#f9f9f9';
      item.style.borderColor = '#ddd';
      item.style.transform = 'translateY(0)';
      item.style.boxShadow = 'none';
    });
    
    item.addEventListener('click', () => {
      document.body.removeChild(modal);
      showConsecutiveDefectDetails(cd, allData);
    });
    
    listContainer.appendChild(item);
  });
  
  // 모달 조립
  modalContent.appendChild(header);
  modalContent.appendChild(listContainer);
  modal.appendChild(modalContent);
  
  // 모달을 페이지에 추가
  document.body.appendChild(modal);
  
  // ESC 키로 모달 닫기
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      document.body.removeChild(modal);
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
  
  // 모달 배경 클릭으로 닫기
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
      document.removeEventListener('keydown', handleEscape);
    }
  });
}

// 연속 불량 데이터 상세 테이블 모달 표시 함수
function showConsecutiveDefectDetails(consecutiveDefect, allData) {
  // 모달 생성
  const modal = document.createElement('div');
  modal.className = 'consecutive-data-modal';
  
  // 모달 내용 컨테이너
  const modalContent = document.createElement('div');
  modalContent.className = 'consecutive-data-modal-content';
  
  // 헤더
  const header = document.createElement('div');
  header.className = 'consecutive-data-modal-header';
  
  const title = document.createElement('h3');
  title.innerHTML = `🔄 연속 불량 상세 데이터 - ${consecutiveDefect.lot} (${consecutiveDefect.failcode})`;
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'consecutive-data-modal-close';
  closeBtn.innerHTML = '×';
  closeBtn.onclick = () => document.body.removeChild(modal);
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  
  // 테이블 컨테이너
  const tableContainer = document.createElement('div');
  tableContainer.className = 'consecutive-data-table-container';
  
  // 해당 LOT의 모든 데이터 필터링
  const lotData = allData.filter(item => item.LOT === consecutiveDefect.lot);
  
  // 테이블 생성
  const table = document.createElement('table');
  table.className = 'consecutive-data-table';
  // 테이블 헤더
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  // EQP_ID, PCID, DATE 필드 동적 감지
  const firstItem = lotData[0];
  const eqpField = ['EQPID', 'EQP_ID', 'EQUIPMENT_ID', 'EQUIPMENT', 'EQP'].find(field => firstItem && firstItem[field] !== undefined);
  const pcField = ['PCID', 'PC_ID', 'PROBE_CARD_ID', 'PROBECARD_ID', 'PROBE_CARD'].find(field => firstItem && firstItem[field] !== undefined);
  const dateField = ['DATE', '날짜', 'date', 'Date', 'TEST_DATE', 'TESTDATE'].find(field => firstItem && firstItem[field] !== undefined);
  
  // 컬럼 정의 (주요 컬럼들을 먼저 표시) - 동적 감지된 필드명 사용
  const basicColumns = [];
  
  if (dateField) {
    basicColumns.push({ key: dateField, label: '날짜' });
  }
  basicColumns.push(
    { key: 'LOT', label: 'LOT' },
    { key: 'SLOT', label: 'SLOT' },
    { key: 'DEVICE', label: 'DEVICE' }
  );
  
  if (eqpField) {
    basicColumns.push({ key: eqpField, label: '장비ID' });
  }
  if (pcField) {
    basicColumns.push({ key: pcField, label: '프로브카드ID' });
  }
  
  // 주요 FAILCODE 컬럼을 먼저 추가
  const mainFailcodeColumn = { 
    key: consecutiveDefect.failcodeColumn, 
    label: `${consecutiveDefect.failcode} ⭐`,
    isMain: true 
  };
  
  // 다른 FAILCODE 컬럼들
  const otherFailcodeColumns = failCodes
    .filter(fc => fc.column !== consecutiveDefect.failcodeColumn)
    .map(fc => ({ key: fc.column, label: fc.name, spec_limit: fc.spec_limit }));
  
  // 전체 컬럼 배열 생성
  const columns = [...basicColumns, mainFailcodeColumn, ...otherFailcodeColumns];
  
  // 헤더 생성
  columns.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col.label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // 테이블 바디
  const tbody = document.createElement('tbody');
    // 연속 불량이 발생한 SLOT 목록
  const consecutiveSlots = consecutiveDefect.slots.map(s => s.slot);
  
  // 데이터 행 생성
  lotData.forEach(item => {
    const row = document.createElement('tr');
    
    columns.forEach(col => {
      const td = document.createElement('td');
      
      // 값 추출 - 날짜 필드의 경우 여러 가능한 필드명에서 값 찾기
      let value = item[col.key] || '';
      if (!value && col.label === '날짜') {
        // 날짜 필드의 경우 다양한 필드명 시도
        value = item.DATE || item['날짜'] || item.date || item.Date || item.TEST_DATE || item.TESTDATE || '';
      }
      
      td.textContent = value;
      
      // 연속 불량이 발생한 SLOT의 해당 FAILCODE 셀 강조
      if (col.key === consecutiveDefect.failcodeColumn && 
          consecutiveSlots.includes(item.SLOT) && 
          Number(value) > 0) {
        td.className = 'consecutive-highlight';
      }
      
      row.appendChild(td);
    });
    
    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  tableContainer.appendChild(table);
  
  // 모달 조립
  modalContent.appendChild(header);
  modalContent.appendChild(tableContainer);
  modal.appendChild(modalContent);
  
  // 모달을 페이지에 추가
  document.body.appendChild(modal);
  
  // ESC 키로 모달 닫기
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      document.body.removeChild(modal);
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
  
  // 모달 배경 클릭으로 닫기
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
      document.removeEventListener('keydown', handleEscape);
    }
  });
}

// 차트 1 요약 정보 업데이트 (Spec Out 및 연속 불량 정보 추가)
function updateChart1Summary(data, failcodeFilter = 'all') {
  const summaryEl = document.getElementById('chart1Summary');
  if (!summaryEl) {
    console.error('차트1 요약 요소를 찾을 수 없습니다.');
    return;
  }
  
  if (!data || data.length === 0) {
    summaryEl.innerHTML = '<p>데이터가 없습니다.</p>';
    return;
  }
  
  // 동일 불량 LOT 연속 발생 여부 체크
  const consecutiveDefects = checkConsecutiveDefectsInLot(data);  // 선택된 FAILCODE에 따라 요약 정보 생성
  if (failcodeFilter !== 'all') {
    // 특정 FAILCODE가 선택된 경우
    const failCode = failCodes.find(code => code.column === failcodeFilter);
    if (!failCode) return;
    
    const totalDefects = data.reduce((sum, item) => sum + Number(item[failcodeFilter] || 0), 0);
    const uniqueLots = new Set(data.map(item => item.LOT)).size;
    
    // LOT 별 해당 FAILCODE 개수 계산
    const lotDefects = {};
    data.forEach(item => {
      const lot = item.LOT;
      if (!lotDefects[lot]) lotDefects[lot] = 0;
      lotDefects[lot] += Number(item[failcodeFilter] || 0);
    });
    
    // 최다 발생 LOT 찾기
    let maxDefectLot = '';
    let maxDefectCount = 0;
      // Spec Out LOT 목록 (새로운 Risk Level 기반)
    const specOutLots = [];
    const lots = [...new Set(data.map(item => item.LOT))];
    
    lots.forEach(lot => {
      const lotData = data.filter(item => item.LOT === lot);
      const riskInfo = calculateRiskLevel(lotData);
      
      if (riskInfo.level !== 'normal') {
        specOutLots.push(`${lot} (${riskInfo.level.toUpperCase()}: ${riskInfo.rate.toFixed(2)}%, ${riskInfo.slots}장)`);
      }
    });
    
    // 해당 FAILCODE에 대한 연속 불량 필터링
    const filteredConsecutiveDefects = consecutiveDefects.filter(cd => cd.failcodeColumn === failcodeFilter);
      // 요약 정보 HTML 업데이트 (새로운 형식)
    let summaryHTML = `
      <p><strong>불량 유형:</strong> ${failCode.name}</p>
      <p><strong>총 발생칩:</strong> ${totalDefects}칩</p>
      <p><strong>발생 LOT 수:</strong> ${uniqueLots}개</p>
      <p><strong>최다 발생 LOT:</strong> ${maxDefectLot} (${maxDefectCount}칩)</p>    `;    // Spec Out LOT 추가 정보 (프레임으로 감싸기) - 새로운 Risk Level 기반
    if (specOutLots.length > 0) {
      summaryHTML += `
        <div class="spec-out-frame">
          <div class="spec-out-warning">⚠️ Spec Out LOT (Risk Level 기반)</div>
          <div class="spec-out-content">
            <ul class="spec-out-list">
              ${specOutLots.map(lot => `<li>${lot}</li>`).join('')}
            </ul>
            <p class="spec-out-details-trigger" style="font-size: 12px; color: #666; cursor: pointer; text-decoration: underline; margin-top: 5px;">세부 사항을 보려면 클릭하시오.</p>
          </div>
        </div>
      `;
    }
    
    // 연속 불량 정보 추가 (프레임으로 감싸기)
    if (filteredConsecutiveDefects.length > 0) {
      summaryHTML += `
        <div class="consecutive-defects-frame">
          <div class="consecutive-defects-section">
            <div class="spec-out-warning">🔄 동일 불량 LOT 연속 발생</div>
          </div>
          <div class="spec-out-content">
            <ul class="spec-out-list">
              ${filteredConsecutiveDefects.map((cd, index) => 
            `<li data-consecutive-index="${index}" style="padding-left: 1em;">${cd.lot}: SLOT ${cd.slots.map(s => `${s.slot}(${s.count}칩)`).join(', ')} - 총 ${cd.totalCount}칩</li>`
              ).join('')}
            </ul>
            <p class="consecutive-details-trigger" style="font-size: 12px; color: #666; cursor: pointer; text-decoration: underline; margin-top: 5px;"> 세부 사항을 보려면 클릭하시오.</p>
          </div>
        </div>
      `;
    } else {
      summaryHTML += `
        <div class="no-consecutive-defects-frame">
          <div class="no-consecutive-defects">✅ 동일 불량 LOT 연속 발생 없음</div>
        </div>
      `;
    }
      summaryEl.innerHTML = summaryHTML;    // Spec Out 세부 사항 클릭 이벤트 추가
    if (specOutLots.length > 0) {
      const specOutDetailsTrigger = summaryEl.querySelector('.spec-out-details-trigger');
      if (specOutDetailsTrigger) {
        specOutDetailsTrigger.addEventListener('click', () => {
          showSpecOutDetails(failcodeFilter, data);
        });
      }
    }
    
    // 연속 불량 세부 사항 클릭 이벤트 추가 (텍스트 클릭 시 모달 표시)
    if (filteredConsecutiveDefects.length > 0) {
      const detailsTrigger = summaryEl.querySelector('.consecutive-details-trigger');
      if (detailsTrigger) {
        detailsTrigger.addEventListener('click', () => {
          // 첫 번째 연속 불량에 대한 상세 데이터 표시 (또는 모든 연속 불량 선택 UI 추가 가능)
          if (filteredConsecutiveDefects.length === 1) {
            showConsecutiveDefectDetails(filteredConsecutiveDefects[0], data);
          } else {
            // 여러 연속 불량이 있는 경우 선택할 수 있는 UI 표시
            showMultipleConsecutiveDefectSelector(filteredConsecutiveDefects, data);
          }
        });
      }
    }
  } else {
    // 모든 FAILCODE가 선택된 경우
    const totalDefects = data.reduce((sum, item) => {
    return sum + 
        Number(item.BURNT || 0) +
        Number(item.PROBE_DAMAGE || 0) +
        Number(item.BUMP_DAMAGE || 0) +
        Number(item.PROBE_MISALIGN || 0) +
        Number(item.PATTERN_DAMAGE || 0) +
        Number(item.RAW_MATERIAL || 0) +
        Number(item.DISCOLOR || 0) +
        Number(item.NO_PROBE_MARK || 0) +
        Number(item.FOREIGN_MATERIAL || 0) +
        Number(item.MISSING_BUMP || 0) +
        Number(item.BIG_BALL || 0) +
        Number(item.AG_RICH || 0);
    }, 0);

    const uniqueLots = new Set(data.map(item => item.LOT)).size;

    const defectCounts = {
    'Burnt': data.reduce((sum, item) => sum + Number(item.BURNT || 0), 0),
    'Probe_Damage': data.reduce((sum, item) => sum + Number(item.PROBE_DAMAGE || 0), 0),
    'Bump_Damage': data.reduce((sum, item) => sum + Number(item.BUMP_DAMAGE || 0), 0),
    'Probe_Misalign': data.reduce((sum, item) => sum + Number(item.PROBE_MISALIGN || 0), 0),
    'Pattern_Damage': data.reduce((sum, item) => sum + Number(item.PATTERN_DAMAGE || 0), 0),
    'Raw_Material': data.reduce((sum, item) => sum + Number(item.RAW_MATERIAL || 0), 0),
    'DISCOLOR': data.reduce((sum, item) => sum + Number(item.DISCOLOR || 0), 0),
    'No_Probe_Mark': data.reduce((sum, item) => sum + Number(item.NO_PROBE_MARK || 0), 0),
    'Foreign_Material': data.reduce((sum, item) => sum + Number(item.FOREIGN_MATERIAL || 0), 0),
    'Missing_Bump': data.reduce((sum, item) => sum + Number(item.MISSING_BUMP || 0), 0),
    'Big_Ball': data.reduce((sum, item) => sum + Number(item.BIG_BALL || 0), 0),
    'Ag_rich': data.reduce((sum, item) => sum + Number(item.AG_RICH || 0), 0)
    };

    const maxDefect = Object.entries(defectCounts).reduce((max, entry) => 
    entry[1] > max[1] ? entry : max, ['', 0]);    // LOT별로 Spec Out 확인 (새로운 Risk Level 기반)
    const lots = [...new Set(data.map(item => item.LOT))];
    const specOutLots = [];

    lots.forEach(lot => {
      const lotData = data.filter(item => item.LOT === lot);
      const riskInfo = calculateRiskLevel(lotData);
      
      if (riskInfo.level !== 'normal') {
        specOutLots.push(`${lot} (${riskInfo.level.toUpperCase()}: ${riskInfo.rate.toFixed(2)}%, ${riskInfo.slots}장)`);
      }
    });

    let summaryHTML = `
    <p><strong>총 불량 칩:</strong> ${totalDefects}칩</p>
    <p><strong>분석된 LOT 수:</strong> ${uniqueLots}개</p>
    <p><strong>주요 불량 유형:</strong> ${maxDefect[0]} (${maxDefect[1]}칩)</p>    `;    // Spec Out LOT 목록 추가 (프레임으로 감싸기) - 새로운 Risk Level 기반
    if (specOutLots.length > 0) {
      summaryHTML += `
        <div class="spec-out-frame">
          <div class="spec-out-warning">⚠️ Spec Out LOT (Risk Level 기반)</div>
          <div class="spec-out-content">
            <ul class="spec-out-list">
              ${specOutLots.map(lot => `<li>${lot}</li>`).join('')}
            </ul>
            <p class="spec-out-details-trigger" style="font-size: 12px; color: #666; cursor: pointer; text-decoration: underline; margin-top: 5px;">세부 사항을 보려면 클릭하시오.</p>
          </div>
        </div>
      `;
    }
    
    // 전체 연속 불량 정보 추가 (프레임으로 감싸기)
    if (consecutiveDefects.length > 0) {
      summaryHTML += `
        <div class="consecutive-defects-frame">
          <div class="consecutive-defects-section">
            <div class="spec-out-warning">🔄 동일 불량 LOT 연속 발생</div>
          </div>
          <div class="spec-out-content">
            <ul class="spec-out-list">
              ${consecutiveDefects.map((cd, index) => 
                `<li data-consecutive-index="${index}">${cd.lot} - ${cd.failcode}: SLOT ${cd.slots.map(s => `${s.slot}(${s.count}칩)`).join(', ')} (총 ${cd.totalCount}칩)</li>`
              ).join('')}
            </ul>
            <p class="consecutive-details-trigger" style="font-size: 12px; color: #666; cursor: pointer; text-decoration: underline; margin-top: 5px;">세부 사항을 보려면 클릭하시오.</p>
          </div>
        </div>
      `;
    } else {
      summaryHTML += `
        <div class="no-consecutive-defects-frame">
          <div class="no-consecutive-defects">✅ 동일 불량 LOT 연속 발생 없음</div>
        </div>
      `;
    }
      summaryEl.innerHTML = summaryHTML;    // Spec Out 세부 사항 클릭 이벤트 추가
    if (specOutLots.length > 0) {
      const specOutDetailsTrigger = summaryEl.querySelector('.spec-out-details-trigger');
      if (specOutDetailsTrigger) {
        specOutDetailsTrigger.addEventListener('click', () => {
          showSpecOutDetails('all', data);
        });
      }
    }
    
    // 연속 불량 세부 사항 클릭 이벤트 추가 (텍스트 클릭 시 모달 표시)
    if (consecutiveDefects.length > 0) {
      const detailsTrigger = summaryEl.querySelector('.consecutive-details-trigger');
      if (detailsTrigger) {
        detailsTrigger.addEventListener('click', () => {
          // 첫 번째 연속 불량에 대한 상세 데이터 표시 (또는 모든 연속 불량 선택 UI 추가 가능)
          if (consecutiveDefects.length === 1) {
            showConsecutiveDefectDetails(consecutiveDefects[0], data);
          } else {
            // 여러 연속 불량이 있는 경우 선택할 수 있는 UI 표시
            showMultipleConsecutiveDefectSelector(consecutiveDefects, data);
          }
        });
      }
    }
  }
}

// 설비 차트 요약 정보 업데이트 (Spec Out 정보 추가)
function updateEquipmentSummary(data, failcodeFilter = 'all') {
  console.log('updateEquipmentSummary 함수 시작 - data:', data?.length, 'failcodeFilter:', failcodeFilter);
  
  // stat-card의 chart2Summary 요소를 직접 타겟으로 설정
  const chart2SummaryCard = document.getElementById('chart2Summary');
  
  console.log('chart2Summary 요소 찾기 결과:', chart2SummaryCard);
  
  if (!chart2SummaryCard) {
    console.error('chart2Summary 요소를 찾을 수 없습니다.');
    return;
  }
  
  if (!data || data.length === 0) {
    chart2SummaryCard.innerHTML = '<p class="text-sm text-gray-600">데이터가 없습니다.</p>';
    return;
  }
  
  // EQPID 필드명 확인 및 대체
  const getEqpId = (item) => {
    return item.EQPID || item.EQP_ID || item.EQUIPMENT_ID || item.EQUIPMENT || item.EQP || 'Unknown';
  };
  
  // 설비 수 계산
  const uniqueEquipments = new Set(data.map(item => getEqpId(item))).size;
    // 설비별 불량 수 계산 (FAILCODE 필터 적용)
  const equipmentDefects = {};
  
  if (failcodeFilter !== 'all') {
    // 특정 FAILCODE에 대한 설비별 불량 수
    data.forEach(item => {
      const eqpid = getEqpId(item);
      if (!equipmentDefects[eqpid]) equipmentDefects[eqpid] = 0;
      equipmentDefects[eqpid] += Number(item[failcodeFilter] || 0);
    });
  } else {
    // 모든 FAILCODE에 대한 설비별 불량 수
    data.forEach(item => {
      const eqpid = getEqpId(item);
      if (!equipmentDefects[eqpid]) equipmentDefects[eqpid] = 0;
      
      equipmentDefects[eqpid] += 
        Number(item.BURNT || 0) +
        Number(item.PROBE_DAMAGE || 0) +
        Number(item.BUMP_DAMAGE || 0) +
        Number(item.PROBE_MISALIGN || 0) +
        Number(item.PATTERN_DAMAGE || 0) +
        Number(item.RAW_MATERIAL || 0) +
        Number(item.DISCOLOR || 0) +
        Number(item.NO_PROBE_MARK || 0) +
        Number(item.FOREIGN_MATERIAL || 0) +
        Number(item.MISSING_BUMP || 0) +
        Number(item.BIG_BALL || 0) +
        Number(item.AG_RICH || 0);
    });
  }
  
  // 불량 발생 설비와 미발생 설비 분류
  const defectEquipments = [];
  const noDefectEquipments = [];
  
  Object.entries(equipmentDefects).forEach(([eqpid, count]) => {
    if (count > 0) {
      defectEquipments.push(eqpid);
    } else {
      noDefectEquipments.push(eqpid);
    }  });
  // Spec Out 설비 목록 (새로운 Risk Level 기반)
  const specOutEquipments = [];
  const equipments = [...new Set(data.map(item => getEqpId(item)))];
  
  equipments.forEach(eqpid => {
    const eqpData = data.filter(item => getEqpId(item) === eqpid);
    
    // 해당 설비에서 처리된 LOT들을 확인
    const lots = [...new Set(eqpData.map(item => item.LOT))];
    const specOutLots = [];
    
    lots.forEach(lot => {
      const lotData = eqpData.filter(item => item.LOT === lot);
      const riskInfo = calculateRiskLevel(lotData);
      
      if (riskInfo.level !== 'normal') {
        specOutLots.push(`${lot}(${riskInfo.level.toUpperCase()})`);
      }
    });
    
    if (specOutLots.length > 0) {
      specOutEquipments.push(`${eqpid}: ${specOutLots.join(', ')}`);
    }
  });
    // 집중 발생 설비 계산 (특정 불량유형이 필터링된 경우에만)
  let focusEquipmentInfo = '';
  console.log('집중 발생 설비 계산 시작 - failcodeFilter:', failcodeFilter);
  
  if (failcodeFilter !== 'all') {
    console.log('특정 불량유형 필터 적용됨:', failcodeFilter);
    const equipmentOccurrenceRates = {};
    
    // 각 설비별로 전체 인스턴스 수와 불량 발생 인스턴스 수를 계산
    data.forEach(item => {
      const eqpid = getEqpId(item);
      if (!equipmentOccurrenceRates[eqpid]) {
        equipmentOccurrenceRates[eqpid] = {
          totalInstances: 0,
          defectInstances: 0
        };
      }
      
      equipmentOccurrenceRates[eqpid].totalInstances++;
      
      // 해당 불량유형이 0이 아닌 값을 가지는 경우 불량 발생 인스턴스로 계산
      const defectValue = Number(item[failcodeFilter] || 0);
      if (defectValue > 0) {
        equipmentOccurrenceRates[eqpid].defectInstances++;
        console.log(`설비 ${eqpid}에서 ${failcodeFilter} 불량 발생:`, defectValue);
      }
    });
    
    console.log('설비별 발생률 통계:', equipmentOccurrenceRates);
      // 발생률 계산 및 상위 2개 설비 찾기
    const equipmentRates = [];
    
    Object.entries(equipmentOccurrenceRates).forEach(([eqpid, stats]) => {
      if (stats.totalInstances > 0) {
        const rate = (stats.defectInstances / stats.totalInstances) * 100;
        console.log(`설비 ${eqpid}: ${stats.defectInstances}/${stats.totalInstances} = ${rate.toFixed(1)}%`);
        if (rate > 0) {
          equipmentRates.push({
            equipment: eqpid,
            rate: rate,
            defectInstances: stats.defectInstances,
            totalInstances: stats.totalInstances
          });
        }
      }
    });
    
    // 발생률 순으로 정렬하고 상위 2개 선택
    equipmentRates.sort((a, b) => b.rate - a.rate);
    const top2Equipment = equipmentRates.slice(0, 2);
    
    console.log('상위 2개 집중 발생 설비:', top2Equipment);
      if (top2Equipment.length > 0) {
      let focusEquipmentLines = [];
      
      top2Equipment.forEach((eq, index) => {
        const label = index === 0 ? '집중 발생 설비 1위' : '집중 발생 설비 2위';
        const detail = `${eq.equipment} ${eq.rate.toFixed(1)}% (${eq.defectInstances}회/${eq.totalInstances}회)`;
        focusEquipmentLines.push(`<p><strong>${label}:</strong> ${detail}</p>`);
      });
      
      // 집중 발생 설비를 프레임으로 감싸기
      focusEquipmentInfo = `
        <div class="focus-equipment-frame">
          <div class="focus-equipment-header" style="color: #fff;">📊 집중 발생 설비 분석(SLOT기준)</div>
          <div class="focus-equipment-content" style="color: #fff;">
        ${focusEquipmentLines.join('')}
          </div>
        </div>
      `;
      console.log('집중 발생 설비 HTML 생성:', focusEquipmentInfo);
    } else {
      console.log('집중 발생 설비 없음');
    }
  } else {
    console.log('전체 불량 필터 - 집중 발생 설비 계산 안함');
  }
    // 요약 정보 HTML 업데이트 (새로운 Risk Level 기반)
  let summaryTitle = '모든 불량';
  
  if (failcodeFilter !== 'all') {
    const failCode = failCodes.find(code => code.column === failcodeFilter);
    if (failCode) {
      summaryTitle = failCode.name;
    }
  }let summaryHTML = `
    <div class="equipment-summary-content">
      <p class="text-sm mb-2"><strong style="color: #2563eb;">전체 진행 설비:</strong> <span style="color: #2563eb;">${uniqueEquipments}개</span></p>
      <p class="text-sm mb-2"><strong style="color: #2563eb;">미발생 설비:</strong> <span style="color: #2563eb;">${noDefectEquipments.length > 0 ? noDefectEquipments.join(', ') : '없음'}</span></p>
      <p class="text-sm mb-2"><strong style="color: #dc2626;">불량 발생 설비:</strong> <span style="color: #dc2626;">${defectEquipments.length}개</span></p>
      ${focusEquipmentInfo}
    </div>
  `;
  
  console.log('장비 summary 데이터 계산 완료:');
  console.log('- 전체 진행 설비:', uniqueEquipments, '개');
  console.log('- 미발생 설비:', noDefectEquipments);
  console.log('- 불량 발생 설비:', defectEquipments.length, '개');
  console.log('- 집중 발생 설비 정보:', focusEquipmentInfo ? '있음' : '없음');
  
  // Spec Out 설비가 있으면 추가
  if (specOutEquipments.length > 0) {    summaryHTML += `
      <div class="spec-out-warning" style="background: rgba(255, 152, 0, 0.1); border: 1px solid rgba(255, 152, 0, 0.3); border-radius: 6px; padding: 8px; margin: 8px 0; font-size: 12px;">
        ⚠️ Spec Out 발생 설비 (Risk Level 기반):
        <div class="spec-out-list" style="margin-top: 4px;">
          ${specOutEquipments.map(eq => `<div style="font-size: 11px;">• ${eq}</div>`).join('')}
        </div>
      </div>
    `;
    console.log('Spec Out 설비 추가:', specOutEquipments);
  }
  
  console.log('chart2SummaryCard에 직접 데이터 설정');
  chart2SummaryCard.innerHTML = summaryHTML;
  console.log('chart2SummaryCard 데이터 설정 완료');
}

// P/C 차트 요약 정보 업데이트 (Spec Out 정보 추가)
function updateProbecardSummary(data, failcodeFilter = 'all') {
  console.log('updateProbecardSummary 함수 시작 - data:', data?.length, 'failcodeFilter:', failcodeFilter);
  
  // stat-card의 chart3Summary 요소를 직접 타겟으로 설정
  const chart3SummaryCard = document.getElementById('chart3Summary');
  
  console.log('chart3Summary 요소 찾기 결과:', chart3SummaryCard);
  
  if (!chart3SummaryCard) {
    console.error('chart3Summary 요소를 찾을 수 없습니다.');
    return;
  }
  
  if (!data || data.length === 0) {
    chart3SummaryCard.innerHTML = '<p class="text-sm text-gray-600">데이터가 없습니다.</p>';
    return;
  }
  
  // PCID 필드명 확인 및 대체
  const getPcId = (item) => {
    return item.PCID || item.PC_ID || item.PROBE_CARD_ID || item.PROBECARD_ID || item.PROBE_CARD || 'Unknown';
  };
  
  // P/C 수 계산
  const uniqueProbecards = new Set(data.map(item => getPcId(item))).size;
    // P/C별 불량 수 계산 (FAILCODE 필터 적용)
  const probecardDefects = {};
  
  if (failcodeFilter !== 'all') {
    // 특정 FAILCODE에 대한 P/C별 불량 수
    data.forEach(item => {
      const pcid = getPcId(item);
      if (!probecardDefects[pcid]) probecardDefects[pcid] = 0;
      probecardDefects[pcid] += Number(item[failcodeFilter] || 0);
    });
  } else {
    // 모든 FAILCODE에 대한 P/C별 불량 수
    data.forEach(item => {
      const pcid = getPcId(item);
      if (!probecardDefects[pcid]) probecardDefects[pcid] = 0;
      
      probecardDefects[pcid] += 
        Number(item.BURNT || 0) +
        Number(item.PROBE_DAMAGE || 0) +
        Number(item.BUMP_DAMAGE || 0) +
        Number(item.PROBE_MISALIGN || 0) +
        Number(item.PATTERN_DAMAGE || 0) +
        Number(item.RAW_MATERIAL || 0) +
        Number(item.DISCOLOR || 0) +
        Number(item.NO_PROBE_MARK || 0) +
        Number(item.FOREIGN_MATERIAL || 0) +
        Number(item.MISSING_BUMP || 0) +
        Number(item.BIG_BALL || 0) +
        Number(item.AG_RICH || 0);
    });
  }
  
  // 불량 발생 P/C와 미발생 P/C 분류
  const defectProbecards = [];
  const noDefectProbecards = [];
  
  Object.entries(probecardDefects).forEach(([pcid, count]) => {
    if (count > 0) {
      defectProbecards.push(pcid);
    } else {
      noDefectProbecards.push(pcid);
    }
  });
  // Spec Out P/C 목록 (새로운 Risk Level 기반)
  const specOutCards = [];
  const probecards = [...new Set(data.map(item => getPcId(item)))];
  
  probecards.forEach(pcid => {
    const pcData = data.filter(item => getPcId(item) === pcid);
    
    // 해당 P/C에서 처리된 LOT들을 확인
    const lots = [...new Set(pcData.map(item => item.LOT))];
    const specOutLots = [];
    
    lots.forEach(lot => {
      const lotData = pcData.filter(item => item.LOT === lot);
      const riskInfo = calculateRiskLevel(lotData);
      
      if (riskInfo.level !== 'normal') {
        specOutLots.push(`${lot}(${riskInfo.level.toUpperCase()})`);
      }
    });
    
    if (specOutLots.length > 0) {
      specOutCards.push(`${pcid}: ${specOutLots.join(', ')}`);
    }
  });
  
  // 집중 발생 P/C 계산 (특정 불량유형이 필터링된 경우에만)
  let focusProbecardInfo = '';
  console.log('집중 발생 P/C 계산 시작 - failcodeFilter:', failcodeFilter);
  
  if (failcodeFilter !== 'all') {
    console.log('특정 불량유형 필터 적용됨:', failcodeFilter);
    const probecardOccurrenceRates = {};
    
    // 각 P/C별로 전체 인스턴스 수와 불량 발생 인스턴스 수를 계산
    data.forEach(item => {
      const pcid = getPcId(item);
      if (!probecardOccurrenceRates[pcid]) {
        probecardOccurrenceRates[pcid] = {
          totalInstances: 0,
          defectInstances: 0
        };
      }
      
      probecardOccurrenceRates[pcid].totalInstances++;
      
      // 해당 불량유형이 0이 아닌 값을 가지는 경우 불량 발생 인스턴스로 계산
      const defectValue = Number(item[failcodeFilter] || 0);
      if (defectValue > 0) {
        probecardOccurrenceRates[pcid].defectInstances++;
        console.log(`P/C ${pcid}에서 ${failcodeFilter} 불량 발생:`, defectValue);
      }
    });
    
    console.log('P/C별 발생률 통계:', probecardOccurrenceRates);
    
    // 발생률 계산 및 상위 2개 P/C 찾기
    const probecardRates = [];
    
    Object.entries(probecardOccurrenceRates).forEach(([pcid, stats]) => {
      if (stats.totalInstances > 0) {
        const rate = (stats.defectInstances / stats.totalInstances) * 100;
        console.log(`P/C ${pcid}: ${stats.defectInstances}/${stats.totalInstances} = ${rate.toFixed(1)}%`);
        if (rate > 0) {
          probecardRates.push({
            probecard: pcid,
            rate: rate,
            defectInstances: stats.defectInstances,
            totalInstances: stats.totalInstances
          });
        }
      }
    });
    
    // 발생률 순으로 정렬하고 상위 2개 선택
    probecardRates.sort((a, b) => b.rate - a.rate);
    const top2Probecards = probecardRates.slice(0, 2);
    
    console.log('상위 2개 집중 발생 P/C:', top2Probecards);
    
    if (top2Probecards.length > 0) {
      let focusProbecardLines = [];
      
      top2Probecards.forEach((pc, index) => {
        const label = index === 0 ? '집중 발생 P/C 1위' : '집중 발생 P/C 2위';
        const detail = `${pc.probecard} ${pc.rate.toFixed(1)}% (${pc.defectInstances}회/${pc.totalInstances}회)`;
        focusProbecardLines.push(`<p><strong>${label}:</strong> ${detail}</p>`);
      });
      
      // 집중 발생 P/C를 프레임으로 감싸기
      focusProbecardInfo = `
        <div class="focus-equipment-frame">
          <div class="focus-equipment-header" style="color: #fff;">📊 집중 발생 P/C 분석</div>
          <div class="focus-equipment-content" style="color: #fff;">
        ${focusProbecardLines.join('')}
          </div>
        </div>
      `;
      console.log('집중 발생 P/C HTML 생성:', focusProbecardInfo);
    } else {
      console.log('집중 발생 P/C 없음');
    }
  } else {
    console.log('전체 불량 필터 - 집중 발생 P/C 계산 안함');
  }  // 요약 정보 HTML 업데이트
  let summaryHTML = `
    <div class="probecard-summary-content">
      <p class="text-sm mb-2"><strong style="color: #2563eb;">전체 진행 P/C:</strong> <span style="color: #2563eb;">${uniqueProbecards}개</span></p>
      <p class="text-sm mb-2"><strong style="color: #dc2626;">불량 발생 P/C:</strong> <span style="color: #dc2626;">${defectProbecards.length}개</span></p>
      <p class="text-sm mb-2"><strong style="color: #2563eb;">미발생 P/C:</strong> <span style="color: #2563eb;">${noDefectProbecards.length > 0 ? noDefectProbecards.join(', ') : '없음'}</span></p>
      ${focusProbecardInfo}
    </div>
  `;
  
  console.log('P/C summary 데이터 계산 완료:');
  console.log('- 전체 진행 P/C:', uniqueProbecards, '개');
  console.log('- 불량 발생 P/C:', defectProbecards.length, '개');
  console.log('- 미발생 P/C:', noDefectProbecards);
  console.log('- 집중 발생 P/C 정보:', focusProbecardInfo ? '있음' : '없음');
    // Spec Out P/C가 있으면 추가 (새로운 Risk Level 기반)
  if (specOutCards.length > 0) {
    summaryHTML += `
      <div class="spec-out-warning" style="background: rgba(255, 152, 0, 0.1); border: 1px solid rgba(255, 152, 0, 0.3); border-radius: 6px; padding: 8px; margin: 8px 0; font-size: 12px;">
        ⚠️ Spec Out 발생 P/C (Risk Level 기반):
        <div class="spec-out-list" style="margin-top: 4px;">
          ${specOutCards.map(pc => `<div style="font-size: 11px;">• ${pc}</div>`).join('')}
        </div>
      </div>
    `;
    console.log('Spec Out P/C 추가:', specOutCards);
  }
    
  console.log('chart3SummaryCard에 직접 데이터 설정');
  chart3SummaryCard.innerHTML = summaryHTML;
  console.log('chart3SummaryCard 데이터 설정 완료');
}

// DEVICE 속성값 중 랜덤한 값을 찾아서 필터에 디폴트로 설정하고, 해당 DEVICE의 최대 FAILCODE도 자동 설정
function setDefaultDeviceFilter(data) {
  if (!data || data.length === 0) {
    console.log('데이터가 없어 디폴트 필터를 설정할 수 없습니다.');
    return;
  }
  
  // 고유한 DEVICE 속성값들을 수집
  const uniqueDevices = new Set();
  
  data.forEach(item => {
    const device = item.DEVICE;
    if (device && device.trim() !== '') {
      uniqueDevices.add(device.trim());
    }
  });
  
  const deviceArray = Array.from(uniqueDevices);
  console.log('사용 가능한 DEVICE 목록:', deviceArray);
  
  // 랜덤하게 DEVICE 선택
  let randomDevice = '';
  
  if (deviceArray.length > 0) {
    const randomIndex = Math.floor(Math.random() * deviceArray.length);
    randomDevice = deviceArray[randomIndex];
  }
  
  console.log('랜덤 선택된 DEVICE:', randomDevice);
  
  // 필터 입력 필드에 랜덤 DEVICE 값 설정
  if (randomDevice) {
    const lotFilterInput = document.getElementById('lotFilter');
    const filterTypeSelect = document.getElementById('filterType');
    const failcodeFilterSelect = document.getElementById('failcodeFilter');
    
    if (lotFilterInput && filterTypeSelect && failcodeFilterSelect) {
      // 필터 타입을 'device'로 설정
      filterTypeSelect.value = 'device';
      
      // 필터 입력 필드에 랜덤 DEVICE 값 설정
      lotFilterInput.value = randomDevice;
      
      // 선택된 DEVICE의 데이터만 필터링
      const deviceFilteredData = filterData(data, 'device', randomDevice, null, null);
      
      // FAILCODE별 합계 계산하여 가장 큰 값을 가진 FAILCODE 찾기
      const failcodeSums = {};
      
      // 각 FAILCODE별 합계 계산
      failCodes.forEach(failCode => {
        failcodeSums[failCode.column] = 0;
        deviceFilteredData.forEach(item => {
          failcodeSums[failCode.column] += Number(item[failCode.column] || 0);
        });
      });
      
      console.log('선택된 DEVICE의 FAILCODE별 합계:', failcodeSums);
      
      // 가장 큰 합계를 가진 FAILCODE 찾기
      let maxFailcodeColumn = '';
      let maxSum = -1;
      
      Object.keys(failcodeSums).forEach(column => {
        if (failcodeSums[column] > maxSum) {
          maxSum = failcodeSums[column];
          maxFailcodeColumn = column;
        }
      });
      
      console.log('최대 합계 FAILCODE:', maxFailcodeColumn, '합계:', maxSum);
      
      // FAILCODE 필터에 최대 합계 FAILCODE 설정 (합계가 0보다 큰 경우에만)
      if (maxSum > 0 && maxFailcodeColumn) {
        failcodeFilterSelect.value = maxFailcodeColumn;
        console.log('디폴트 FAILCODE 필터 설정 완료:', maxFailcodeColumn);
      } else {
        failcodeFilterSelect.value = 'all';
        console.log('불량이 없는 DEVICE로 FAILCODE 필터는 "all"로 설정');
      }
      
      console.log('디폴트 필터 설정 완료 - 랜덤 DEVICE:', randomDevice, ', 최대 FAILCODE:', maxFailcodeColumn);
        // 자동으로 필터 적용 (DEVICE + FAILCODE 모두 적용된 차트를 즉시 표시)
      const selectedFailcode = failcodeFilterSelect.value;
        // 차트 업데이트 (DEVICE 필터만 적용된 데이터와 FAILCODE 필터 값 전달)
      createDefectChart(deviceFilteredData, selectedFailcode);
      createEquipmentChart(deviceFilteredData, selectedFailcode);
      createProbecardChart(deviceFilteredData, selectedFailcode);
      createChart4(deviceFilteredData, selectedFailcode);
      createChart4Eqp(deviceFilteredData, selectedFailcode);
      createChart4Pc(deviceFilteredData, selectedFailcode);
      
      console.log('디폴트 필터 자동 적용 완료 - DEVICE:', randomDevice, ', FAILCODE:', selectedFailcode);
    } else {
      console.warn('필터 UI 요소를 찾을 수 없습니다.');
    }
  } else {
    console.log('설정할 디폴트 DEVICE가 없습니다.');
  }
}

// 필터링 함수 (DATE 필터 추가)
function filterData(data, filterType, filterValue, dateFrom, dateTo) {
  let filteredData = data;
  
  // 텍스트 필터 적용
  if (filterValue && filterValue.trim() !== '') {
    const searchValue = filterValue.toLowerCase().trim();
    
    filteredData = filteredData.filter(item => {
      // 각 필드의 다양한 가능한 이름 처리
      const lot = String(item.LOT || '');
      const device = String(item.DEVICE || '');
      const eqpid = String(item.EQPID || item.EQP_ID || item.EQUIPMENT_ID || item.EQUIPMENT || item.EQP || '');
      const pcid = String(item.PCID || item.PC_ID || item.PROBE_CARD_ID || item.PROBECARD_ID || item.PROBE_CARD || '');
        if (filterType === 'all') {
        return lot.toLowerCase() === searchValue || 
               device.toLowerCase() === searchValue || 
               eqpid.toLowerCase() === searchValue || 
               pcid.toLowerCase() === searchValue;
      }
      else if (filterType === 'lot') {
        return lot.toLowerCase() === searchValue;
      }
      else if (filterType === 'device') {
        return device.toLowerCase() === searchValue;
      }
      else if (filterType === 'eqpid') {
        return eqpid.toLowerCase() === searchValue;
      }
      else if (filterType === 'pcid') {
        return pcid.toLowerCase() === searchValue;
      }
      return true;
    });
  }
  
  // 날짜 필터 적용
  if (dateFrom || dateTo) {
    filteredData = filteredData.filter(item => {
      const itemDate = item['날짜'] || item.DATE || item.date;
      if (!itemDate) return true; // 날짜 정보가 없으면 포함
      
      // 날짜 문자열을 Date 객체로 변환
      let parsedDate;
      
      // 다양한 날짜 형식 파싱
      if (typeof itemDate === 'string') {
        // "23년 05월 22일 14시 30분" 형식 처리
        if (itemDate.includes('년') && itemDate.includes('월') && itemDate.includes('일')) {
          const dateMatch = itemDate.match(/(\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일/);
          if (dateMatch) {
            const year = 2000 + parseInt(dateMatch[1]);
            const month = parseInt(dateMatch[2]) - 1; // JavaScript month는 0부터 시작
            const day = parseInt(dateMatch[3]);
            parsedDate = new Date(year, month, day);
          }
        }
        // ISO 형식이나 기타 표준 형식
        else {
          parsedDate = new Date(itemDate);
        }
      } else {
        parsedDate = new Date(itemDate);
      }
      
      // 유효하지 않은 날짜는 포함
      if (isNaN(parsedDate.getTime())) {
        return true;
      }
      
      // 날짜만 비교 (시간 제거)
      const itemDateOnly = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
      
      // 시작 날짜 체크
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        if (itemDateOnly < fromDate) return false;
      }
      
      // 종료 날짜 체크
      if (dateTo) {
        const toDate = new Date(dateTo);
        if (itemDateOnly > toDate) return false;
      }
      
      return true;
    });
  }
  
  return filteredData;
}

// 데이터 로드 및 차트 초기화
async function loadData() {
  try {
    // 로딩 표시
    const loadingEl = document.querySelector('#chart1Container .loading');
    if (loadingEl) loadingEl.style.display = 'flex';
    
    const chartEl = document.getElementById('chart1');
    if (chartEl) chartEl.style.display = 'none';
    
    try {
      // Excel 파일에서 데이터 읽기
      if (window.electronAPI && window.electronAPI.readExcelFile) {
        console.log('Excel 파일에서 데이터를 읽는 중...');
        const excelData = await window.electronAPI.readExcelFile('OnePointRaw.xlsx');
        console.log('Excel 데이터:', excelData);
        
        if (excelData && excelData.length > 0) {
          // 데이터 필드 검사 및 디버깅 정보 출력
          const firstRow = excelData[0];
          console.log('Excel 데이터 구조:', Object.keys(firstRow));
          
          // 필드명 사전 확인
          const hasEqpId = excelData.some(item => 
            item.EQPID !== undefined || 
            item.EQP_ID !== undefined || 
            item.EQUIPMENT_ID !== undefined ||
            item.EQUIPMENT !== undefined ||
            item.EQP !== undefined
          );
          
          const hasPcId = excelData.some(item => 
            item.PCID !== undefined || 
            item.PC_ID !== undefined || 
            item.PROBE_CARD_ID !== undefined ||
            item.PROBECARD_ID !== undefined ||
            item.PROBE_CARD !== undefined
          );
          
          console.log('EQPID 필드 존재:', hasEqpId);
          console.log('PCID 필드 존재:', hasPcId);
          
          defectData = excelData;
          console.log('데이터 로드 완료:', defectData.length);
        } else {
          console.error('Excel 파일에서 데이터를 읽지 못했습니다.');
          const container = document.getElementById('chart1Container');
          if (container) {
            container.innerHTML = '<div class="error-message">엑셀 파일에서 데이터를 불러오지 못했습니다.</div>';
          }
          return;
        }
      } else {
        console.error('Excel 파일 읽기 API를 찾을 수 없습니다.');
        const container = document.getElementById('chart1Container');
        if (container) {
          container.innerHTML = '<div class="error-message">Excel API를 찾을 수 없습니다.</div>';
        }
        return;
      }
    } catch (apiError) {
      console.error('데이터 로드 오류:', apiError);
      const container = document.getElementById('chart1Container');
      if (container) {
        container.innerHTML = `<div class="error-message">데이터 로드 오류: ${apiError.message}</div>`;
      }
      return;
    }
    
    // 데이터가 없으면 종료
    if (!defectData || defectData.length === 0) {
      console.error('표시할 데이터가 없습니다.');
      const container = document.getElementById('chart1Container');
      if (container) {
        container.innerHTML = '<div class="error-message">표시할 데이터가 없습니다.</div>';
      }
      return;
    }    console.log('차트에 표시할 데이터:', defectData);
    
    // DEVICE 속성값 중 가장 많은 인스턴스를 가진 값을 찾아서 디폴트 필터로 설정
    // (이 함수 내에서 차트도 자동으로 생성됨)
    setDefaultDeviceFilter(defectData);      // Spec Out 관련 스타일 및 DATE 정렬 안내 메시지 스타일 추가
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .spec-out-warning {
        color: #d32f2f;
        font-weight: bold;
        margin-top: 15px;
      }
      .spec-out-list {
        color: #d32f2f;
        padding-left: 20px;
        margin-top: 5px;
      }
      .focus-equipment-frame {
        border: 2px solid #2196F3;
        border-radius: 8px;
        margin: 15px 0;
        background: linear-gradient(135deg, #e3f2fd 0%, #f8fffe 100%);
        box-shadow: 0 2px 8px rgba(33, 150, 243, 0.2);
        overflow: hidden;
      }
      .focus-equipment-header {
        background: linear-gradient(135deg, #2196F3, #1976D2);
        color: white;
        padding: 10px 15px;
        font-weight: bold;
        font-size: 14px;
        border-bottom: 1px solid #1976D2;
      }
      .focus-equipment-content {
        padding: 15px;
      }
      .focus-equipment-content p {
        margin: 8px 0;
        color: #1565C0;
        font-size: 13px;
      }
      .focus-equipment-content strong {
        color: #0D47A1;
      }
      .date-sort-notice {
        text-align: center;
        margin-top: 15px;
        font-size: 13px;
        color: #666;
        font-style: italic;
        background-color: #f0f8ff;
        padding: 8px 12px;
        border-radius: 4px;
        border: 1px solid #e0e8f0;
      }
      .date-sort-notice i {
        margin-right: 6px;
        color: #4a9eff;
      }      /* 다크모드 지원 */
      [data-theme="dark"] .focus-equipment-frame {
        border-color: #64B5F6;
        background: linear-gradient(135deg, #1a1a2e 0%, #2a2a3e 100%);
        box-shadow: 0 2px 8px rgba(100, 181, 246, 0.2);
      }
      [data-theme="dark"] .focus-equipment-header {
        background: linear-gradient(135deg, #1976D2, #1565C0);
        border-bottom-color: #1565C0;
      }
      [data-theme="dark"] .focus-equipment-content p {
        color: #64B5F6;
      }
      [data-theme="dark"] .focus-equipment-content strong {
        color: #90CAF9;
      }
      [data-theme="dark"] .date-sort-notice {
        background-color: #1a1a2e;
        color: #b3b3b3;
        border-color: #404040;
      }
      [data-theme="dark"] .date-sort-notice i {
        color: #6fa8dc;
      }
    `;
    document.head.appendChild(styleElement);
    
  } catch (error) {
    console.error('데이터 로드 전체 오류:', error);
    
    // 오류 표시
    const container = document.getElementById('chart1Container');
    if (container) {
      container.innerHTML = `<div class="error-message">데이터 로드 오류: ${error.message}</div>`;
    }
  }
}

// 필터 적용 버튼 이벤트 리스너 수정
document.addEventListener('DOMContentLoaded', function() {
  const applyFilterBtn = document.getElementById('applyFilter');
  if (applyFilterBtn) {
    applyFilterBtn.addEventListener('click', function() {
      const filterInput = document.getElementById('lotFilter');
      const filterTypeSelect = document.getElementById('filterType');
      const failcodeFilterSelect = document.getElementById('failcodeFilter');
      const dateFromInput = document.getElementById('dateFromFilter');
      const dateToInput = document.getElementById('dateToFilter');
      
      if (filterInput && filterTypeSelect && failcodeFilterSelect && defectData) {
        const filterValue = filterInput.value;
        const filterType = filterTypeSelect.value;
        const failcodeFilter = failcodeFilterSelect.value;
        const dateFrom = dateFromInput ? dateFromInput.value : null;
        const dateTo = dateToInput ? dateToInput.value : null;
        
        // 데이터 필터링 (LOT, DEVICE 등 조칩 필터링 + 날짜 필터링)
        const filteredData = filterData(defectData, filterType, filterValue, dateFrom, dateTo);
        
        console.log('필터 적용:', {
          filterType,
          filterValue,
          failcodeFilter,
          dateFrom,
          dateTo,
          originalCount: defectData.length,
          filteredCount: filteredData.length
        });          // 모든 차트에 필터링 적용
        createDefectChart(filteredData, failcodeFilter);
        createEquipmentChart(filteredData, failcodeFilter);
        createProbecardChart(filteredData, failcodeFilter);
        createChart4(filteredData, failcodeFilter);
        createChart4Eqp(filteredData, failcodeFilter);
        createChart4Pc(filteredData, failcodeFilter);
      }
    });
  }  
  // Enter 키 이벤트 추가 (모든 입력 필드에)
  const filterInput = document.getElementById('lotFilter');
  const dateFromInput = document.getElementById('dateFromFilter');
  const dateToInput = document.getElementById('dateToFilter');
  
  [filterInput, dateFromInput, dateToInput].forEach(input => {
    if (input) {
      input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          const applyBtn = document.getElementById('applyFilter');
          if (applyBtn) applyBtn.click();
        }
      });
    }  });
  
  // 리셋 필터 버튼 이벤트 리스너 추가
  const resetFilterBtn = document.getElementById('resetFilter');
  if (resetFilterBtn) {
    resetFilterBtn.addEventListener('click', function() {
      // 모든 필터 입력 필드 초기화
      const filterInput = document.getElementById('lotFilter');
      const filterTypeSelect = document.getElementById('filterType');
      const failcodeFilterSelect = document.getElementById('failcodeFilter');
      const dateFromInput = document.getElementById('dateFromFilter');
      const dateToInput = document.getElementById('dateToFilter');
      
      if (filterInput) filterInput.value = '';
      if (filterTypeSelect) filterTypeSelect.value = 'all';
      if (failcodeFilterSelect) failcodeFilterSelect.value = 'all';
      if (dateFromInput) dateFromInput.value = '';
      if (dateToInput) dateToInput.value = '';        // 원본 데이터로 차트 재생성
      if (defectData) {
        console.log('필터 초기화 - 원본 데이터로 차트 업데이트');
        createDefectChart(defectData, 'all');
        createEquipmentChart(defectData, 'all');
        createProbecardChart(defectData, 'all');
        createChart4(defectData, 'all');
        createChart4Eqp(defectData, 'all');
        createChart4Pc(defectData, 'all');
      }
    });
  }
  
  // FAILCODE 필터 셀렉트박스 초기화
  const failcodeFilterSelect = document.getElementById('failcodeFilter');
  if (failcodeFilterSelect) {
    // 기존 옵션 제거
    failcodeFilterSelect.innerHTML = '';
    
    // 기본 옵션 추가
    const defaultOption = document.createElement('option');
    defaultOption.value = 'all';
    defaultOption.textContent = '모든 불량';
    failcodeFilterSelect.appendChild(defaultOption);
    
    // FAILCODE 옵션 추가 - Spec 제한값 표시 추가
    failCodes.forEach(failCode => {
      const option = document.createElement('option');
      option.value = failCode.column;
      option.textContent = `${failCode.name} (Spec: ${failCode.spec_limit})`;
      failcodeFilterSelect.appendChild(option);
    });
  }
    // 데이터 로드
  loadData();
  
  // Chart 1 높이 자동 조절 설정
  setupChart1HeightObserver();
});

// Chart 1 높이를 Summary 영역에 맞게 동적으로 조절하는 함수
function adjustChart1Height() {
  const summaryElement = document.getElementById('chart1Summary');
  const chartElement = document.getElementById('chart1');
  
  if (summaryElement && chartElement) {
    const summaryHeight = summaryElement.offsetHeight;
    const minHeight = 300;
    const maxHeight = 600;
    
    // Summary 높이에 기반하여 Chart 높이 계산 (최소/최대값 적용)
    const calculatedHeight = Math.max(minHeight, Math.min(maxHeight, summaryHeight + 50));
    
    chartElement.style.height = `${calculatedHeight}px`;
    
    // Chart.js 인스턴스가 있으면 리사이즈
    if (chart1Instance) {
      chart1Instance.resize();
    }
  }
}

// Chart 1의 Summary 영역 변화를 감지하여 높이를 자동 조절하는 Observer 설정
function setupChart1HeightObserver() {
  const summaryElement = document.getElementById('chart1Summary');
  
  if (summaryElement) {
    // ResizeObserver를 사용하여 Summary 영역의 크기 변화 감지
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        // Summary 영역 크기가 변경되면 Chart 1 높이 조절
        adjustChart1Height();
      }
    });
    
    resizeObserver.observe(summaryElement);
    
    // MutationObserver를 사용하여 Summary 내용 변화 감지
    const mutationObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' || mutation.type === 'subtree') {
          // 내용이 변경되면 잠시 후 높이 조절 (DOM 업데이트 완료 대기)
          setTimeout(() => {
            adjustChart1Height();
          }, 100);
        }
      });
    });
    
    mutationObserver.observe(summaryElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
}