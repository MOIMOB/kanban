import { parseEmbedConfig, parseEmbedCredentials } from './embed';

describe('parseEmbedConfig', () => {
  it('defaults to stored theme, editable, toolbar shown', () => {
    expect(parseEmbedConfig({})).toEqual({ theme: null, readonly: false, toolbar: true });
  });

  it('reads theme, readonly and toolbar', () => {
    expect(parseEmbedConfig({ theme: 'dark', readonly: 'true', toolbar: 'false' })).toEqual({
      theme: 'dark',
      readonly: true,
      toolbar: false,
    });
    expect(parseEmbedConfig({ readonly: '1', toolbar: '0' })).toMatchObject({ readonly: true, toolbar: false });
  });

  it('ignores unknown theme values', () => {
    expect(parseEmbedConfig({ theme: 'purple' }).theme).toBeNull();
  });
});

describe('parseEmbedCredentials', () => {
  it('reads url-encoded email and password', () => {
    expect(parseEmbedCredentials('email=wall%40example.com&password=p%26ss')).toEqual({
      email: 'wall@example.com',
      password: 'p&ss',
    });
  });

  it('returns null when either is missing', () => {
    expect(parseEmbedCredentials(null)).toBeNull();
    expect(parseEmbedCredentials('email=a@b.c')).toBeNull();
  });
});
