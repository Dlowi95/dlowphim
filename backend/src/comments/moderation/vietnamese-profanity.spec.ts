import { maskVietnameseProfanity } from './vietnamese-profanity';

describe('maskVietnameseProfanity', () => {
  it.each([
    ['đm phim hay', '*** phim hay'],
    ['d.m.m phim hay', '*** phim hay'],
    ['d c m phim hay', '*** phim hay'],
    ['v.c.l phim hay', '*** phim hay'],
    ['địt mẹ mày', '*** mày'],
    ['đụ má', '***'],
    ['đéo hiểu', '*** hiểu'],
    ['óc chó', '***'],
  ])('masks common Vietnamese profanity: %s', (input, expected) => {
    expect(maskVietnameseProfanity(input).content).toBe(expected);
  });

  it.each([
    'Gửi DM cho mình nhé',
    'Email có CC cho quản trị viên',
    'Các bạn xem phim vui vẻ',
    'Admin phản hồi rất nhanh',
    'Chiếc lon nước ở trên bàn',
  ])('does not mask common safe text: %s', (input) => {
    const result = maskVietnameseProfanity(input);
    expect(result.content).toBe(input);
    expect(result.maskedCount).toBe(0);
  });

  it('returns unique moderation flags and the number of replacements', () => {
    const result = maskVietnameseProfanity('đm, đ.m và vcl');
    expect(result.content).toBe('***, *** và ***');
    expect(result.matchedTerms).toEqual(expect.arrayContaining(['dmm', 'vcl']));
    expect(result.maskedCount).toBe(3);
  });
});
