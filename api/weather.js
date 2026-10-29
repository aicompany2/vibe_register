// Vercel 서버리스 함수: 공공데이터포털(기상청 단기예보 - 초단기실황) 프록시
// 환경변수 DATA_GO_KR_KEY 는 서버에서만 읽습니다. (VITE_ 접두사를 붙이지 마세요!)
const ENDPOINT = 'http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst';

// Encoding 키(%2B, %2F 포함)든 Decoding 키(+, / 포함)든 상관없이 "정확히 한 번만" 인코딩된 키로 만든다.
// → 이중 인코딩(SERVICE_KEY_IS_NOT_REGISTERED_ERROR 의 단골 원인)을 막는다.
function normalizeKey(raw) {
  let k = String(raw || '').trim();
  if (/%[0-9A-Fa-f]{2}/.test(k)) {
    try { k = decodeURIComponent(k); } catch { /* 이미 디코딩된 키로 간주 */ }
  }
  return encodeURIComponent(k);
}

// 초단기실황은 매 정시 생성, 약 40분 뒤 조회 가능 → 한국시간 기준 40분 전의 정시를 사용
function kstBase(now = new Date()) {
  const t = new Date(now.getTime() + 9 * 3600 * 1000 - 40 * 60 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return {
    base_date: `${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}`,
    base_time: `${p(t.getUTCHours())}00`,
  };
}

const CATEGORY = { T1H: 'temp', REH: 'humidity', WSD: 'wind', RN1: 'rain', PTY: 'ptyCode' };
const PTY = { 0: '맑음/흐림(강수 없음)', 1: '비', 2: '비/눈', 3: '눈', 5: '빗방울', 6: '빗방울눈날림', 7: '눈날림' };

export default async function handler(req, res) {
  const raw = process.env.DATA_GO_KR_KEY;
  if (!raw) return res.status(500).json({ error: '서버에 DATA_GO_KR_KEY 환경변수가 설정되지 않았어요.' });

  // 기본값: 제주시 격자 (nx=52, ny=38). 서귀포는 nx=52, ny=33 정도
  const nx = String(parseInt(req.query.nx, 10) || 52);
  const ny = String(parseInt(req.query.ny, 10) || 38);
  const { base_date, base_time } = kstBase();

  // serviceKey 는 이미 인코딩된 문자열이므로 URLSearchParams 에 넣지 않고 직접 이어 붙인다.
  const rest = new URLSearchParams({ pageNo: '1', numOfRows: '20', dataType: 'JSON', base_date, base_time, nx, ny });
  const url = `${ENDPOINT}?serviceKey=${normalizeKey(raw)}&${rest.toString()}`;

  try {
    const r = await fetch(url);
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch {
      // 오류 시 XML 로 오는 경우가 있음 (예: 인증키 문제)
      return res.status(502).json({ error: '공공데이터포털이 JSON 이 아닌 응답을 보냈어요.', detail: text.slice(0, 300) });
    }

    const header = data?.response?.header;
    if (!header) {
      const m = data?.OpenAPI_ServiceResponse?.cmmMsgHeader;
      return res.status(502).json({ error: m ? `${m.errMsg} (${m.returnReasonCode})` : '알 수 없는 응답 형식', detail: m?.returnAuthMsg });
    }
    if (header.resultCode !== '00') return res.status(502).json({ error: `${header.resultMsg} (${header.resultCode})` });

    const out = { base_date, base_time, nx, ny };
    for (const it of data.response.body?.items?.item || []) {
      const key = CATEGORY[it.category];
      if (key) out[key] = Number(it.obsrValue);
    }
    out.pty = PTY[out.ptyCode] || '';
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=600');
    return res.status(200).json(out);
  } catch (e) {
    return res.status(502).json({ error: '공공데이터포털에 연결하지 못했어요.' });
  }
}
