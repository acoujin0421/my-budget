// api/save.js - Vercel Serverless API
// GitHub의 data.json을 업데이트합니다. (budgets, expenses 저장)

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST만 허용합니다." });

  try {
    const body = req.body || {};
    const budgets = body.budgets;
    const expenses = body.expenses;

    if (!Array.isArray(budgets) || !Array.isArray(expenses)) {
      return res.status(400).json({ error: "`budgets`와 `expenses` 배열이 필요합니다." });
    }

    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";

    if (!token || !owner || !repo) {
      return res.status(500).json({ error: "Vercel 환경변수가 설정되지 않았습니다." });
    }

    const path = "data.json";
    const apiBase = "https://api.github.com";
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    const getUrl = `${apiBase}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
    const getRes = await fetch(getUrl, { headers });
    if (!getRes.ok) {
      const txt = await getRes.text().catch(() => "");
      return res.status(500).json({ error: `data.json 조회 실패: ${getRes.status} ${txt}` });
    }

    const existing = await getRes.json();
    const sha = existing.sha;

    const newContentObj = { budgets, expenses };
    const newContent = Buffer.from(JSON.stringify(newContentObj, null, 2), "utf8").toString("base64");

    const putUrl = `${apiBase}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
    const putRes = await fetch(putUrl, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Update data.json from budget app",
        content: newContent,
        sha,
        branch,
      }),
    });

    if (!putRes.ok) {
      const txt = await putRes.text().catch(() => "");
      return res.status(500).json({ error: `data.json 업데이트 실패: ${putRes.status} ${txt}` });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "서버 오류" });
  }
};
