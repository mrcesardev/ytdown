const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve('src/app/api/files/[...filename]/route.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = module.paths;
mod._compile(compiled, filename);
const { GET } = mod.exports;
const request = (headers = {}) => new Request('http://localhost/api/files/test', { headers });

test('preserves percent/unicode names and streams bytes', async () => {
  const original = global.fetch;
  try {
    global.fetch = async (url) => {
      assert.equal(decodeURIComponent(new URL(url).pathname.split('/').pop()), '100% ação%20.mp3');
      return new Response('audio');
    };
    const response = await GET(request(), {params: {filename: ['100% ação%20.mp3']}});
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'audio');
    assert.match(response.headers.get('content-disposition'), /filename\*=UTF-8''/);
  } finally { global.fetch = original; }
});
test('preserves range/if-range, status 206 and validators', async () => {
  const original = global.fetch;
  try {
    global.fetch = async (_, options) => {
      assert.equal(options.headers.Range, 'bytes=2-5');
      assert.equal(options.headers['If-Range'], '"version"');
      return new Response('2345', {status:206, headers:{'content-range':'bytes 2-5/10', 'etag':'"version"'}});
    };
    const response = await GET(request({range:'bytes=2-5','if-range':'"version"'}), {params:{filename:['test.mp3']}});
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('etag'), '"version"');
    assert.equal(response.headers.get('content-range'), 'bytes 2-5/10');
    assert.equal(await response.text(), '2345');
  } finally { global.fetch = original; }
});
for (const status of [404, 416, 500]) test(`preserves upstream ${status}`, async () => {
  const original = global.fetch;
  try {
    global.fetch = async () => new Response('error', {status, headers:{'content-range':'bytes */10'}});
    const response = await GET(request(), {params:{filename:['test.mp3']}});
    assert.equal(response.status, status);
    assert.equal(response.headers.get('content-range'), 'bytes */10');
  } finally { global.fetch = original; }
});
test('connection failure returns 502', async () => {
  const original = global.fetch;
  try {
    global.fetch = async () => {throw new Error('offline');};
    assert.equal((await GET(request(), {params:{filename:['test.mp3']}})).status, 502);
  } finally { global.fetch = original; }
});
