import assert from 'node:assert/strict';
import { test } from 'node:test';
import { documentUri } from '../src/utils/documentUri.ts';

test('accepts document URIs returned directly by Android', () => {
  const uri = 'content://com.android.providers.downloads.documents/document/41';
  assert.equal(documentUri(uri), uri);
});

test('extracts the document URI from SDK 54 serialized Intent results', () => {
  const uri = 'content://com.android.externalstorage.documents/document/primary%3ADownload%2Frevenue.csv';
  assert.equal(documentUri(`Intent { dat=${uri} flg=0x43 }`), uri);
  assert.equal(documentUri('Intent { dat=content://com.android.providers.downloads.documents/document/41 flg=0x43 (has extras) }'),
    'content://com.android.providers.downloads.documents/document/41');
});

test('rejects missing URIs and unsupported destinations before writing', () => {
  for (const value of ['', 'Intent { flg=0x43 }', 'file:///tmp/report.csv', 'https://example.com/report.csv']) {
    assert.throws(() => documentUri(value));
  }
});
