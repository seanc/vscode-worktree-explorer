import * as assert from 'assert';
import * as vscode from 'vscode';
import { sortEntries } from '../../src/tree';
import type { FileSystemEntry } from '../../src/filesystem';

function file(name: string): FileSystemEntry {
  return { uri: vscode.Uri.file(`/root/${name}`), name, type: vscode.FileType.File };
}

function dir(name: string): FileSystemEntry {
  return { uri: vscode.Uri.file(`/root/${name}`), name, type: vscode.FileType.Directory };
}

suite('sortEntries', () => {
  test('foldersFirst: directories before files, each alphabetical', () => {
    const result = sortEntries([file('b.txt'), dir('z'), file('a.txt'), dir('a')], 'foldersFirst');
    assert.deepStrictEqual(
      result.map((e) => e.name),
      ['a', 'z', 'a.txt', 'b.txt']
    );
  });

  test('filesFirst: files before directories, each alphabetical', () => {
    const result = sortEntries([dir('z'), file('b.txt'), file('a.txt'), dir('a')], 'filesFirst');
    assert.deepStrictEqual(
      result.map((e) => e.name),
      ['a.txt', 'b.txt', 'a', 'z']
    );
  });

  test('mixed: alphabetical regardless of type', () => {
    const result = sortEntries([dir('b'), file('a.txt'), dir('c')], 'mixed');
    assert.deepStrictEqual(
      result.map((e) => e.name),
      ['a.txt', 'b', 'c']
    );
  });

  test('name comparison is case-insensitive', () => {
    const result = sortEntries([file('Banana.txt'), file('apple.txt')], 'mixed');
    assert.deepStrictEqual(
      result.map((e) => e.name),
      ['apple.txt', 'Banana.txt']
    );
  });

  test('URI is a stable tie-breaker for equal names under different case', () => {
    const a = { uri: vscode.Uri.file('/root/AAA'), name: 'file', type: vscode.FileType.File };
    const b = { uri: vscode.Uri.file('/root/BBB'), name: 'file', type: vscode.FileType.File };
    const result = sortEntries([b, a], 'mixed');
    assert.deepStrictEqual(
      result.map((e) => e.uri.toString()),
      [a.uri.toString(), b.uri.toString()]
    );
  });
});
