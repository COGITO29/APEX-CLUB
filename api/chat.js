// Vercel Serverless Function: OpenAI(GPT) 챗봇 프록시
// OPENAI_API_KEY 는 Vercel 프로젝트의 Environment Variables 에만 저장합니다. (코드/저장소에 넣지 마세요)

const SYSTEM_PROMPT = `당신은 프리미엄 피트니스 클럽 "APEX CLUB"의 AI 상담 도우미입니다.
- 항상 친절하고 간결한 한국어 존댓말로 답하고, 답변은 3~4문장 이내로 합니다.
- 아는 정보: 해외 명품 머신 구비, 1:1 맞춤 정밀 체형분석, 프라이빗 1인 샤워룸, 100% 예약제 프라이빗 운영, 전문 자격과 입상 경력을 갖춘 트레이너(김지후 헤드 트레이너, 이서현 시니어 트레이너), 1회 무료 체험 제공.
- 가격, 회원권 요금, 영업시간, 위치, 이벤트 등 위에 없는 정보는 절대 지어내지 말고 "담당 매니저가 상담 시 정확히 안내해 드립니다"라고 답합니다.
- 의학적 진단이나 치료 조언은 하지 않고, 통증·질환이 있으면 전문의 상담을 권합니다.
- 관심을 보이면 페이지 하단의 [상담 예약하기] 폼으로 1회 무료 체험을 신청하도록 자연스럽게 안내합니다.
- 헬스장과 무관한 요청(코딩, 번역, 시사 등)은 정중히 사양하고 클럽 관련 질문으로 안내합니다.`;

const MAX_MESSAGES = 10;
const MAX_CHARS = 500;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'missing_api_key' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || !Array.isArray(body.messages)) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  const messages = body.messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));

  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'invalid_request' });
  }

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        max_tokens: 400,
        temperature: 0.6,
      }),
    });

    if (!r.ok) {
      console.error('OpenAI error', r.status, await r.text());
      return res.status(502).json({ error: 'upstream_error' });
    }

    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) return res.status(502).json({ error: 'empty_reply' });

    return res.status(200).json({ reply });
  } catch (e) {
    console.error('chat handler failed', e);
    return res.status(500).json({ error: 'server_error' });
  }
};
