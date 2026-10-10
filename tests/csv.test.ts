/*
 * تست CSV: escape، محافظ فرمول، BOM و CRLF
 */
import { describe, expect, it } from 'vitest';
import { buildCsv, escapeCell, guardFormula, type CsvHeaders } from '../src/shared/csv';

const headers: CsvHeaders = {
  date: 'Date',
  start: 'Start',
  end: 'End',
  duration: 'Duration',
  hours: 'Hours',
  project: 'Project',
  client: 'Client',
  description: 'Description',
  rate: 'Rate',
  amount: 'Amount',
};

describe('csv', () => {
  it('محافظ فرمول', () => {
    for (const s of ['=1+1', '+SUM(A1)', '-2', '@cmd', '\tx', '\rx']) {
      expect(guardFormula(s).startsWith("'")).toBe(true);
    }
    expect(guardFormula('normal')).toBe('normal');
    expect(guardFormula('a=b')).toBe('a=b');
  });

  it('escape کاما، کوتیشن و خط جدید', () => {
    expect(escapeCell('a,b')).toBe('"a,b"');
    expect(escapeCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCell('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCell('plain')).toBe('plain');
  });

  it('فایل با BOM و CRLF و ردیف‌های درست ساخته می‌شه', () => {
    const csv = buildCsv(
      [
        {
          startedAt: new Date(2025, 0, 15, 9, 0, 0).toISOString(),
          endedAt: new Date(2025, 0, 15, 10, 30, 0).toISOString(),
          projectName: 'Site, v2',
          client: '=HYPERLINK("x")',
          description: 'کار روی "لندینگ"',
          hourlyRateCents: 6000,
        },
        {
          startedAt: new Date(2025, 0, 15, 11, 0, 0).toISOString(),
          endedAt: new Date(2025, 0, 15, 11, 0, 1).toISOString(),
          projectName: 'B',
          client: '',
          description: '',
          hourlyRateCents: null,
        },
      ],
      headers,
    );
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('Date,Start,End,Duration,Hours,Project,Client,Description,Rate,Amount');
    expect(lines[1]).toBe(
      '2025-01-15,09:00:00,10:30:00,1:30:00,1.50,"Site, v2","\'=HYPERLINK(""x"")","کار روی ""لندینگ""",60.00,90.00',
    );
    expect(lines[2]).toBe('2025-01-15,11:00:00,11:00:01,0:00:01,0.00,B,,,,');
  });
});
