// Vercel 서버리스 함수: 제주특별자치도 서귀포시_직영관광지 관람객수 추이 (data.go.kr / odcloud, 15125100)
// 환경변수 DATA_GO_KR_KEY 는 서버에서만 읽습니다. (VITE_ 접두사를 붙이지 마세요!)
const ENDPOINT = 'https://api.odcloud.kr/api/15125100/v1/uddi:32a1b877-af20-4505-a76a-fd389ebd30ca'; // 관람객수 추이_20251002

// Encoding 키(%2B …)든 Decoding 키(+ …)든 "정확히 한 번만" 인코딩된 키로 만든다. (이중 인코딩 방지)
function normalizeKey(raw) {
  let k = String(raw || '').trim();
  if (/%[0-9A-Fa-f]{2}/.test(k)) {
    try { k = decodeURIComponent(k); } catch { /* 이미 디코딩된 키로 간주 */ }
  }
  return encodeURIComponent(k);
}

export default async function handler(req, res) {
  const raw = process.env.DATA_GO_KR_KEY;
  if (!raw) return res.status(500).json({ error: '서버에 DATA_GO_KR_KEY 환경변수가 설정되지 않았어요.' });

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const perPage = Math.min(Math.max(parseInt(req.query.perPage, 10) || 100, 1), 1000);

  // serviceKey 는 이미 인코딩된 문자열이므로 URLSearchParams 에 넣지 않고 직접 이어 붙인다.
  const rest = new URLSearchParams({ page: String(page), perPage: String(perPage), returnType: 'JSON' });
  const url = `${ENDPOINT}?serviceKey=${normalizeKey(raw)}&${rest.toString()}`;

  try {
    const r = await fetch(url);
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch {
      return res.status(502).json({ error: '공공데이터포털이 JSON 이 아닌 응답을 보냈어요.', detail: text.slice(0, 300) });
    }
    if (!r.ok) return res.status(502).json({ error: `공공데이터포털 오류 (${r.status})`, detail: data.msg || data.message || '' });

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
    return res.status(200).json({
      total: data.totalCount || 0,
      // 예: { 기준연도, 기준월, 천지연폭포, 천제연폭포, 정방폭포, 중문대포 주상절리대, 산방산_용머리, 감귤박물관, 데이터기준일자 }
      rows: data.data || [],
    });
  } catch (e) {
    return res.status(502).json({ error: '공공데이터포털에 연결하지 못했어요.' });
  }
}
