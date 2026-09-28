import * as readline from 'readline';

export class ProgressBar {
  private total: number;
  private current: number = 0;
  private barLength: number = 40;
  private title: string;

  constructor(title: string, total: number) {
    this.title = title;
    this.total = total;
  }

  update(current: number) {
    this.current = current;
    this.draw();
  }

  add(bytes: number) {
    this.current += bytes;
    if (this.current > this.total) this.current = this.total;
    this.draw();
  }

  private draw() {
    const progress = this.total === 0 ? 0 : this.current / this.total;
    const filledBarLength = Math.round(progress * this.barLength);
    const emptyBarLength = this.barLength - filledBarLength;

    const filledBar = '█'.repeat(filledBarLength);
    const emptyBar = '░'.repeat(emptyBarLength);
    const percentage = (progress * 100).toFixed(2);
    
    const currentMb = (this.current / 1024 / 1024).toFixed(2);
    const totalMb = (this.total / 1024 / 1024).toFixed(2);

    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(`\x1b[36m[${this.title}]\x1b[0m ${filledBar}${emptyBar} ${percentage}% | ${currentMb}MB / ${totalMb}MB`);
  }

  finish() {
    this.current = this.total;
    this.draw();
    console.log(); // New line at the end
  }
}
