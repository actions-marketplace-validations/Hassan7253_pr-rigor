const API = 'https://api.github.com';

function headers(token) {
  const result = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'pr-rigor'
  };
  if (token) result.Authorization = `Bearer ${token}`;
  return result;
}

export async function githubRequest(path, { token = '', method = 'GET', body, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(`${API}${path}`, {
    method,
    headers: { ...headers(token), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    const text = await response.text();
    const remaining = response.headers.get('x-ratelimit-remaining');
    const reset = response.headers.get('x-ratelimit-reset');
    const rate = remaining === '0' ? ` Rate limit resets at ${new Date(Number(reset) * 1000).toISOString()}.` : '';
    throw new Error(`GitHub API ${response.status}: ${text.slice(0, 500)}${rate}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function paginate(pathFactory, { token = '', maxPages = 30 } = {}) {
  const results = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const batch = await githubRequest(pathFactory(page), { token });
    if (!Array.isArray(batch)) throw new Error('Expected a paginated GitHub API array response.');
    results.push(...batch);
    if (batch.length < 100) break;
  }
  return results;
}

export async function fetchPullRequest(owner, repo, number, token = '') {
  return githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}`, { token });
}

export async function fetchPullFiles(owner, repo, number, token = '') {
  return paginate(
    (page) => `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}/files?per_page=100&page=${page}`,
    { token }
  );
}

export async function fetchRepositoryJson(owner, repo, filePath, ref, token = '') {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  try {
    const response = await githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}${query}`, { token });
    if (response?.type !== 'file' || !response.content) throw new Error(`${filePath} is not a file.`);
    const text = Buffer.from(response.content.replaceAll('\n', ''), response.encoding || 'base64').toString('utf8');
    return JSON.parse(text);
  } catch (error) {
    if (/GitHub API 404:/.test(error.message)) return {};
    throw new Error(`Cannot load ${filePath} from ${owner}/${repo}: ${error.message}`);
  }
}

export async function upsertComment(owner, repo, number, token, markdown) {
  if (!token) throw new Error('A token is required to post a comment.');
  const marker = '<!-- pr-rigor-report -->';
  const comments = await paginate(
    (page) => `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${number}/comments?per_page=100&page=${page}`,
    { token, maxPages: 10 }
  );
  const existing = comments.find((comment) => {
    const body = typeof comment.body === 'string' ? comment.body : '';
    return body.includes(marker) && (comment.user?.type === 'Bot' || comment.performed_via_github_app);
  });

  if (existing) {
    return githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/comments/${existing.id}`, {
      token,
      method: 'PATCH',
      body: { body: markdown }
    });
  }

  return githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${number}/comments`, {
    token,
    method: 'POST',
    body: { body: markdown }
  });
}
