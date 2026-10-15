// -----------------------------------------------------------------------------
// The one HTTP helper of the integration: GET a JSON document or an HTML page
// from a public open-data service, with a timeout and an identifying
// User-Agent. Every service is keyless: no header ever carries a secret.
// -----------------------------------------------------------------------------

export const USER_AGENT =
  'gladys-qualite-eau (Gladys Assistant integration; +https://github.com/guim31/gladys-qualite-eau)';

export class HttpError extends Error {
  /**
   * @param {string} message
   * @param {number|null} status HTTP status, null for a network error or a bad body
   */
  constructor(message, status = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

async function get(fetchImpl, url, accept, timeoutMs) {
  const host = new URL(url).host;
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: accept, 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const reason =
      err?.name === 'TimeoutError' ? `no answer in ${timeoutMs / 1000} s` : err.message;
    throw new HttpError(`${host}: ${reason}`);
  }
  // Hub'Eau answers 206 for a page that has a next one: both are a success.
  if (response.status !== 200 && response.status !== 206) {
    throw new HttpError(`${host}: HTTP ${response.status}`, response.status);
  }
  return { host, response };
}

/**
 * GET `url` and parse its JSON body.
 * @param {Function} fetchImpl fetch
 * @param {string} url
 * @param {object} [options]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<unknown>}
 */
export async function getJson(fetchImpl, url, { timeoutMs = 30000 } = {}) {
  const { host, response } = await get(fetchImpl, url, 'application/json', timeoutMs);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(`${host}: the answer is not JSON`, response.status);
  }
}

/**
 * The charset of a page: its Content-Type header, else its `<meta>`, else
 * UTF-8. The pages of baignades.sante.gouv.fr come from an older web
 * application that may still serve ISO-8859-1.
 */
export function charsetOf(contentType, bytes) {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType ?? '');
  if (fromHeader) {
    return fromHeader[1].toLowerCase();
  }
  const head = Buffer.from(bytes.subarray(0, 2048)).toString('latin1');
  const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head);
  return fromMeta ? fromMeta[1].toLowerCase() : 'utf-8';
}

/** Decode page bytes in their charset; an unknown charset falls back to UTF-8. */
export function decodePage(bytes, contentType) {
  const charset = charsetOf(contentType, bytes);
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

/**
 * GET `url` as text (an HTML page), decoded in its charset.
 * @param {Function} fetchImpl fetch
 * @param {string} url
 * @param {object} [options]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<string>}
 */
export async function getText(fetchImpl, url, { timeoutMs = 30000 } = {}) {
  const { response } = await get(fetchImpl, url, 'text/html', timeoutMs);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return decodePage(bytes, response.headers?.get?.('content-type'));
}
