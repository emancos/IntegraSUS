import { Injectable } from '@nestjs/common';
import * as fs from 'fs';

export interface LayoutColumn {
  coluna: string;
  tamanho: number;
  inicio: number;
  fim: number;
  tipo: string;
}

@Injectable()
export class ParserService {
  parseLayout(layoutPath: string): LayoutColumn[] {
    const content = fs.readFileSync(layoutPath, 'utf8');
    const lines = content.split(/\r?\n/);
    const columns: LayoutColumn[] = [];

    let isFirst = true;
    for (const line of lines) {
      if (!line.trim()) continue;
      if (isFirst) {
        isFirst = false;
        continue;
      }
      
      const parts = line.split(',');
      if (parts.length >= 5) {
        columns.push({
          coluna: parts[0].trim(),
          tamanho: parseInt(parts[1].trim(), 10),
          inicio: parseInt(parts[2].trim(), 10),
          fim: parseInt(parts[3].trim(), 10),
          tipo: parts[4].trim(),
        });
      }
    }
    return columns;
  }

  *parseData(dataPath: string, layout: LayoutColumn[]): IterableIterator<any> {
    const content = fs.readFileSync(dataPath, 'latin1'); 
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      if (!line.trim()) continue;
      
      const row: any = {};
      for (const col of layout) {
        const start = col.inicio - 1;
        const val = line.substring(start, start + col.tamanho).trim();
        row[col.coluna] = val;
      }
      yield row;
    }
  }
}