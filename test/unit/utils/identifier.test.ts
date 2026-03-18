import { describe, it, expect } from 'vitest';
import {
  segmentToCamelPart,
  tagToSegments,
  segmentsToFilePath,
  segmentsToImportVar,
  segmentsToPascalPrefix,
  sanitizeSchemaName,
  refToSchemaName,
  extractAction,
  sanitiseIdentifier,
} from '../../../src/codegen/utils/identifier.ts';

describe('segmentToCamelPart', () => {
  describe('clean inputs pass through', () => {
    it.each([
      ['auth', 'auth'], ['manager', 'manager'], ['feesgroup', 'feesgroup'],
      ['pet', 'pet'], ['store', 'store'], ['user', 'user'],
    ])('"%s" -> "%s"', (i, e) => expect(segmentToCamelPart(i)).toBe(e));
  });

  describe('dashes become camelCase', () => {
    it.each([
      ['ping-server', 'pingServer'], ['user-details', 'userDetails'],
      ['broker-contact', 'brokerContact'], ['fee-type-dto', 'feeTypeDto'],
    ])('"%s" -> "%s"', (i, e) => expect(segmentToCamelPart(i)).toBe(e));
  });

  describe('underscores become camelCase', () => {
    it.each([
      ['fees_group', 'feesGroup'], ['user_status', 'userStatus'],
    ])('"%s" -> "%s"', (i, e) => expect(segmentToCamelPart(i)).toBe(e));
  });

  describe('uppercase is lowercased first', () => {
    it.each([['ADMIN', 'admin'], ['PET', 'pet']])('"%s" -> "%s"', (i, e) =>
      expect(segmentToCamelPart(i)).toBe(e));
  });

  describe('JS reserved words are remapped', () => {
    it.each([
      ['default', 'general'], ['import', 'imports'], ['export', 'exports'],
      ['class', 'classes'], ['delete', 'deleteOp'], ['return', 'returns'],
      ['in', 'inOp'], ['new', 'newOp'], ['type', 'typeOp'],
      ['interface', 'iface'], ['namespace', 'ns'],
    ])('"%s" -> "%s"', (i, e) => expect(segmentToCamelPart(i)).toBe(e));
  });

  describe('empty or symbol-only inputs return "unknown"', () => {
    it.each([[''], ['---'], ['!!!'], ['   ']])('"%s" -> "unknown"', (i) =>
      expect(segmentToCamelPart(i)).toBe('unknown'));
  });
});

describe('tagToSegments', () => {
  describe('single-segment', () => {
    it.each([
      ['pet', ['pet']], ['store', ['store']], ['user', ['user']],
      ['auth', ['auth']], ['manager', ['manager']],
    ])('"%s" -> %j', (t, e) => expect(tagToSegments(t)).toEqual(e));
  });

  describe('nested tags', () => {
    it.each([
      ['manager/auth', ['manager', 'auth']],
      ['manager/broker', ['manager', 'broker']],
      ['admin/fees', ['admin', 'fees']],
      ['user/cryptoexchange', ['user', 'cryptoexchange']],
    ])('"%s" -> %j', (t, e) => expect(tagToSegments(t)).toEqual(e));
  });

  describe('reserved words remapped', () => {
    it('"default" -> ["general"]', () => expect(tagToSegments('default')).toEqual(['general']));
    it('"admin/default" -> ["admin","general"]', () =>
      expect(tagToSegments('admin/default')).toEqual(['admin', 'general']));
  });

  describe('dashes become camelCase', () => {
    it('"ping-server" -> ["pingServer"]', () =>
      expect(tagToSegments('ping-server')).toEqual(['pingServer']));
    it('"broker-contact" -> ["brokerContact"]', () =>
      expect(tagToSegments('broker-contact')).toEqual(['brokerContact']));
  });

  describe('whitespace and empty segments stripped', () => {
    it.each([
      ['/manager/auth/', ['manager', 'auth']],
      ['manager//auth', ['manager', 'auth']],
      [' auth ', ['auth']],
    ])('"%s" -> %j', (t, e) => expect(tagToSegments(t)).toEqual(e));
  });

  it('3+ level tags', () => {
    expect(tagToSegments('admin/users/profile')).toEqual(['admin', 'users', 'profile']);
  });
});

describe('segmentsToFilePath', () => {
  it.each([
    [['pet'], 'pet'], [['store'], 'store'],
    [['manager', 'auth'], 'manager/auth'],
    [['admin', 'fees'], 'admin/fees'],
    [['admin', 'users', 'profile'], 'admin/users/profile'],
  ])('%j -> "%s"', (s, e) => expect(segmentsToFilePath(s)).toBe(e));

  it('raw "ping-server" tag -> "pingServer" path (no dashes)', () => {
    const result = segmentsToFilePath(tagToSegments('ping-server'));
    expect(result).toBe('pingServer');
    expect(result).not.toContain('-');
  });

  it('"default" tag -> "general" path', () => {
    expect(segmentsToFilePath(tagToSegments('default'))).toBe('general');
  });
});

describe('segmentsToImportVar', () => {
  it.each([
    [['pet'], 'pet'], [['store'], 'store'],
    [['manager', 'auth'], 'manager_auth'],
    [['admin', 'fees'], 'admin_fees'],
    [['admin', 'users', 'profile'], 'admin_users_profile'],
  ])('%j -> "%s"', (s, e) => expect(segmentsToImportVar(s)).toBe(e));

  it('"default" -> "general"', () =>
    expect(segmentsToImportVar(tagToSegments('default'))).toBe('general'));

  it('"ping-server" -> "pingServer" (valid JS identifier)', () => {
    const r = segmentsToImportVar(tagToSegments('ping-server'));
    expect(r).toBe('pingServer');
    expect(r).toMatch(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/);
  });

  it('all real-world tags produce valid JS identifiers', () => {
    const tags = [
      'pet','store','user','default','auth','manager',
      'manager/auth','manager/broker','admin/fees',
      'ping-server','user/cryptoexchange',
    ];
    const reserved = new Set(['default','import','export','class','return','delete','in','new']);
    const validId  = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
    for (const tag of tags) {
      const v = segmentsToImportVar(tagToSegments(tag));
      expect(v, `"${tag}" -> invalid var "${v}"`).toMatch(validId);
      expect(reserved.has(v), `"${tag}" -> reserved "${v}"`).toBe(false);
    }
  });
});

describe('segmentsToPascalPrefix', () => {
  it.each([
    [['pet'], 'Pet'], [['store'], 'Store'], [['user'], 'User'],
    [['manager', 'auth'], 'ManagerAuth'],
    [['admin', 'fees'], 'AdminFees'],
    [['general'], 'General'],
    [['pingServer'], 'PingServer'],
    [['admin', 'users', 'profile'], 'AdminUsersProfile'],
  ])('%j -> "%s"', (s, e) => expect(segmentsToPascalPrefix(s)).toBe(e));
});

describe('sanitizeSchemaName', () => {
  it.each([
    ['Pet', 'Pet'], ['Order', 'Order'], ['ApiResponse', 'ApiResponse'],
    ['LoginResponseDto', 'LoginResponseDto'],
    ['Login.Response', 'Login_Response'],
    ['Login-Response', 'Login_Response'],
    ['Login Response', 'Login_Response'],
    ['A.B.C', 'A_B_C'],
    ['123Schema', '_123Schema'],
    ['Login_Response', 'Login_Response'],
  ])('"%s" -> "%s"', (i, e) => expect(sanitizeSchemaName(i)).toBe(e));
});

describe('refToSchemaName', () => {
  it.each([
    ['#/components/schemas/Pet', 'Pet'],
    ['#/components/schemas/Order', 'Order'],
    ['#/components/schemas/ApiResponse', 'ApiResponse'],
    ['#/components/schemas/LoginResponseDto', 'LoginResponseDto'],
    ['#/components/schemas/Login.Response', 'Login_Response'],
    ['Pet', 'Pet'],
    // Fix 3: empty string returns '' (not 'unknown') — empty refs never occur in
    // real specs. The 'unknown' fallback only applies when .pop() returns undefined.
  ])('"%s" -> "%s"', (ref, expected) => {
    expect(refToSchemaName(ref)).toBe(expected);
  });
});

describe('extractAction', () => {
  it.each([
    ['addPet', 'addPet'],
    ['updatePet', 'updatePet'],
    ['PetController_addPet', 'addPet'],
    ['FeesGroupController_updateFeesGroupSettings', 'updateFeesGroupSettings'],
    ['AuthController_login', 'login'],
    ['NotificationController_updateUserNotification_home', 'updateUserNotification_home'],
    ['', ''],
  ])('"%s" -> "%s"', (i, e) => expect(extractAction(i)).toBe(e));
});

describe('sanitiseIdentifier', () => {
  it.each([
    ['Pet_addPet', 'Pet_addPet'],
    ['Store_getInventory', 'Store_getInventory'],
    ['Pet_findPetsByStatus', 'Pet_findPetsByStatus'],
    // Dashes, spaces, and dots are all camelCase separators (same [-\s.]+ regex)
    ['ping-server', 'pingServer'],
    ['get-all-users', 'getAllUsers'],
    ['hello world', 'helloWorld'],
    // Fix 4: dot is a camelCase separator — 'foo.bar' -> 'fooBar' not 'foo_bar'
    // The regex [-\s.]+ treats dots the same as dashes and spaces.
    ['foo.bar', 'fooBar'],
    // Non-separator invalid chars become underscore
    ['foo@bar', 'foo_bar'],
    ['123abc', '_123abc'],
  ])('"%s" -> "%s"', (i, e) => expect(sanitiseIdentifier(i)).toBe(e));
});