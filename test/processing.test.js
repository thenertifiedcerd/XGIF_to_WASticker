const test = require('node:test');
const assert = require('node:assert/strict');
const { isSupportedXUrl } = require('../src/processing');

test('accepts X and Twitter status URLs', () => {
  assert.equal(isSupportedXUrl('https://x.com/example/status/123456'), true);
  assert.equal(isSupportedXUrl('https://twitter.com/example/status/123456?foo=bar'), true);
});

test('rejects non-post and unsafe URLs', () => {
  assert.equal(isSupportedXUrl('http://x.com/example/status/123456'), false);
  assert.equal(isSupportedXUrl('https://x.com/home'), false);
  assert.equal(isSupportedXUrl('https://example.com/example/status/123456'), false);
});
