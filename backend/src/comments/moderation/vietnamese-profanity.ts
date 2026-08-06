export type ProfanityFilterResult = {
  content: string;
  matchedTerms: string[];
  maskedCount: number;
};

type ProfanityRule = {
  key: string;
  pattern: RegExp;
};

/**
 * Danh sách mặc định chỉ chứa từ tục/chửi trực tiếp có độ chắc chắn cao.
 * Không thêm các từ quá ngắn như "cc", "cl", "dm" (không dấu) vì dễ
 * chặn nhầm nội dung hợp lệ. Các biến thể phổ biến có thể chèn khoảng trắng,
 * dấu chấm, gạch nối hoặc kéo dài ký tự.
 */
export const VIETNAMESE_PROFANITY_RULES: ProfanityRule[] = [
  { key: 'dit-me', pattern: /(?<![\p{L}\p{N}])(?:đ[\s._*~-]*[ịi][\s._*~-]*t|d[\s._*~-]*[i1][\s._*~-]*t)[\s._*~-]*(?:m[ẹe]|m[\s._*~-]*[ẹe])(?![\p{L}\p{N}])/giu },
  { key: 'du-ma', pattern: /(?<![\p{L}\p{N}])đ[\s._*~-]*ụ[\s._*~-]*m[áa](?![\p{L}\p{N}])/giu },
  { key: 'dcm', pattern: /(?<![\p{L}\p{N}])(?:đ|d)[\s._*~-]*c[\s._*~-]*m+(?![\p{L}\p{N}])/giu },
  { key: 'dmm', pattern: /(?<![\p{L}\p{N}])(?:đ[\s._*~-]*m+|d[\s._*~-]*m(?:[\s._*~-]*m)+)(?![\p{L}\p{N}])/giu },
  { key: 'vcl', pattern: /(?<![\p{L}\p{N}])v[\s._*~-]*(?:c|k)[\s._*~-]*l+(?![\p{L}\p{N}])/giu },
  { key: 'vl', pattern: /(?<![\p{L}\p{N}])v[\s._*~-]*l+(?![\p{L}\p{N}])/giu },
  { key: 'cac', pattern: /(?<![\p{L}\p{N}])c[\s._*~-]*[ặạ][\s._*~-]*(?:c|k)(?![\p{L}\p{N}])/giu },
  { key: 'lon', pattern: /(?<![\p{L}\p{N}])(?:l[\s._*~-]*ồ[\s._*~-]*n|loz+)(?![\p{L}\p{N}])/giu },
  { key: 'deo', pattern: /(?<![\p{L}\p{N}])đ[\s._*~-]*(?:é[\s._*~-]*o|ế[\s._*~-]*ch)(?![\p{L}\p{N}])/giu },
  { key: 'du', pattern: /(?<![\p{L}\p{N}])đ[\s._*~-]*ụ+(?![\p{L}\p{N}])/giu },
  { key: 'di', pattern: /(?<![\p{L}\p{N}])(?:con[\s._*~-]+)?đ[\s._*~-]*ĩ(?![\p{L}\p{N}])/giu },
  { key: 'oc-cho', pattern: /(?<![\p{L}\p{N}])ó[\s._*~-]*c[\s._*~-]+ch[óo](?![\p{L}\p{N}])/giu },
  { key: 'suc-vat', pattern: /(?<![\p{L}\p{N}])súc[\s._*~-]+vật(?![\p{L}\p{N}])/giu },
  { key: 'cho-chet', pattern: /(?<![\p{L}\p{N}])ch[óo][\s._*~-]+chết(?![\p{L}\p{N}])/giu },
  { key: 'khon-nan', pattern: /(?<![\p{L}\p{N}])khốn[\s._*~-]+nạn(?![\p{L}\p{N}])/giu },
  { key: 'mat-day', pattern: /(?<![\p{L}\p{N}])mất[\s._*~-]+dạy(?![\p{L}\p{N}])/giu },
];

export function maskVietnameseProfanity(value: string): ProfanityFilterResult {
  let content = value;
  const matchedTerms = new Set<string>();
  let maskedCount = 0;

  for (const rule of VIETNAMESE_PROFANITY_RULES) {
    content = content.replace(rule.pattern, () => {
      matchedTerms.add(rule.key);
      maskedCount += 1;
      return '***';
    });
  }

  return {
    content,
    matchedTerms: [...matchedTerms],
    maskedCount,
  };
}
