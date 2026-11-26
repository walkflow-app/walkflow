import { describe, expect, it } from 'vitest';
import { resolveUsageBase, usageCountUrl } from './usage-url';

describe('resolveUsageBase', () => {
  it('is the GoatCounter site that was set, without a trailing slash', () => {
    expect(resolveUsageBase('walkflow-app/walkflow', 'https://walkflow.goatcounter.com')).toBe('https://walkflow.goatcounter.com');
    expect(resolveUsageBase('', 'https://walkflow.goatcounter.com/')).toBe('https://walkflow.goatcounter.com');
    expect(resolveUsageBase('', 'https://my-site2.goatcounter.com')).toBe('https://my-site2.goatcounter.com');
  });

  it('is the official counting site for the official repository when nothing is set', () => {
    expect(resolveUsageBase('walkflow-app/walkflow')).toBe('https://walkflow.goatcounter.com');
    expect(resolveUsageBase('walkflow-app/walkflow', '')).toBe('https://walkflow.goatcounter.com');
  });

  it('has no default for any other repository, a fork or an empty one: nothing set, nothing sent', () => {
    for (const repo of ['', 'someone/walkflow', 'walkflow-app/other', 'walkflow-app/walkflow-fork', 'Walkflow-App/walkflow', 'walkflow-app/walkflow/x'])
      expect(resolveUsageBase(repo), repo).toBeNull();
    expect(resolveUsageBase('someone/walkflow', '')).toBeNull();
    expect(resolveUsageBase('', '')).toBeNull();
  });

  it('lets the override beat the default, and an invalid override gives nothing (never the default)', () => {
    expect(resolveUsageBase('walkflow-app/walkflow', 'https://other.goatcounter.com')).toBe('https://other.goatcounter.com');
    expect(resolveUsageBase('walkflow-app/walkflow', 'https://example.org')).toBeNull();
    expect(resolveUsageBase('walkflow-app/walkflow', ' ')).toBeNull();
  });

  it('accepts nothing but https://<code>.goatcounter.com', () => {
    for (const bad of [
      'walkflow', 'walkflow.goatcounter.com', 'http://walkflow.goatcounter.com', 'https://goatcounter.com', 'https://.goatcounter.com',
      'https://example.org', 'https://walkflow.goatcounter.com.evil.example', 'https://walkflow.goatcounter.com-evil.example',
      'https://evil.example/walkflow.goatcounter.com', 'https://a.b.goatcounter.com', 'https://walkflow.goatcounter.com/count',
      'https://walkflow.goatcounter.com/x/', 'https://walkflow.goatcounter.com?x=1', 'https://walkflow.goatcounter.com/#x',
      'https://walkflow.goatcounter.com:8443', 'https://user:pw@walkflow.goatcounter.com', 'https://user@walkflow.goatcounter.com',
      'https://-x.goatcounter.com', 'javascript:alert(1)', 'http://localhost:8099', ' ',
    ]) expect(resolveUsageBase('walkflow-app/walkflow', bad), bad).toBeNull();
  });
});

describe('usageCountUrl', () => {
  it('is the public counting address with the name as page and title, as an event', () => {
    expect(usageCountUrl('https://walkflow.goatcounter.com', 'app.web.v0.7.2')).toBe('https://walkflow.goatcounter.com/count?p=app.web.v0.7.2&t=app.web.v0.7.2&e=true');
  });
});
