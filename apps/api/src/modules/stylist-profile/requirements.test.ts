import { describe, expect, it } from 'vitest';
import { parseRequirements, serializeRequirements, requirementTexts } from './requirements.js';

describe('requirements normalization', () => {
  it('parses legacy string arrays', () => {
    expect(parseRequirements(['Hair washed', '  '])).toEqual([{ text: 'Hair washed' }]);
  });

  it('parses structured items', () => {
    expect(
      parseRequirements([{ text: 'Bring hair', catalogKey: 'bring_own_hair' }, { text: 'Custom' }]),
    ).toEqual([
      { text: 'Bring hair', catalogKey: 'bring_own_hair' },
      { text: 'Custom' },
    ]);
  });

  it('serializes mixed inputs', () => {
    expect(serializeRequirements(['A', { text: 'B', catalogKey: 'k' }])).toEqual([
      { text: 'A' },
      { text: 'B', catalogKey: 'k' },
    ]);
  });

  it('exposes plain texts', () => {
    expect(requirementTexts([{ text: 'One' }, { text: 'Two' }])).toEqual(['One', 'Two']);
  });
});
