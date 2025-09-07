const oracledb = require('oracledb');
const path = require('path');
// Thick 모드 명시적 설정
oracledb.thin = false;
oracledb.initOracleClient();

// Oracle DB 연결 설정
const dbConfig = {
  user: 'eds',
  password: 'eds-eds',
  connectString: 'adam.nepes.co.kr:1521/ADAM'
};

// 불량 데이터 조회 함수
async function getDefectData() {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    
    const result = await connection.execute(`
      WITH SIMAX_DISTINCT AS (
        SELECT *
        FROM (
          SELECT A.*,
                ROW_NUMBER() OVER (PARTITION BY LOTID, WNO ORDER BY TRANSTIME DESC) AS RN
          FROM TESTDATA_SIMAX A
        )
        WHERE RN = 1
      )
      SELECT
          TO_CHAR(MIN(TO_DATE(B.TRANS_TIME, 'YYYYMMDDHH24MISS')), 'YY"년" MM"월" DD"일" HH24"시" MI"분"') AS "날짜",
          A.LOTID AS "LOT",
          B.SLOTID AS "SLOT",
          MIN(A.DEVICE) AS "DEVICE",
          MIN(A.EQPID) AS "EQPID",
          MIN(A.PCID) AS "PCID",
          SUM(CASE WHEN B.FAILCODE = '1' THEN 1 ELSE 0 END) AS BURNT,
          SUM(CASE WHEN B.FAILCODE = '2' THEN 1 ELSE 0 END) AS PROBE_DAMAGE,
          SUM(CASE WHEN B.FAILCODE = '3' THEN 1 ELSE 0 END) AS BUMP_DAMAGE,
          SUM(CASE WHEN B.FAILCODE = '4' THEN 1 ELSE 0 END) AS PROBE_MISALIGN,
          SUM(CASE WHEN B.FAILCODE = '5' THEN 1 ELSE 0 END) AS PATTERN_DAMAGE,
          SUM(CASE WHEN B.FAILCODE = '6' THEN 1 ELSE 0 END) AS RAW_MATERIAL,
          SUM(CASE WHEN B.FAILCODE = '7' THEN 1 ELSE 0 END) AS DISCOLOR,
          SUM(CASE WHEN B.FAILCODE = '8' THEN 1 ELSE 0 END) AS NO_PROBE_MARK,
          SUM(CASE WHEN B.FAILCODE = '9' THEN 1 ELSE 0 END) AS FOREIGN_MATERIAL,
          SUM(CASE WHEN B.FAILCODE = 'A' THEN 1 ELSE 0 END) AS MISSING_BUMP,
          SUM(CASE WHEN B.FAILCODE = 'B' THEN 1 ELSE 0 END) AS BIG_BALL,
          SUM(CASE WHEN B.FAILCODE = 'C' THEN 1 ELSE 0 END) AS AG_RICH
      FROM
          SIMAX_DISTINCT A
      INNER JOIN 
          TDMS_VIFAILLST@MOSDB_LINK B
          ON A.LOTID = B.LOTNO
         AND A.WNO = B.SLOTID
       WHERE B.FAILCODE <> '9'
      GROUP BY A.LOTID, B.SLOTID
      ORDER BY A.LOTID, B.SLOTID
    `, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    return result.rows;
  } catch (error) {
    console.error('DB 조회 오류:', error);
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('DB 연결 종료 오류:', err);
      }
    }
  }
}

module.exports = { getDefectData };