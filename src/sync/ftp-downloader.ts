import { Client } from 'basic-ftp';
import * as fs from 'fs';
import { Writable } from 'stream';
import { ProgressBar } from './progress.utils.js';

class RangeWriteStream extends Writable {
  private fd: number;
  private pos: number;
  private endByte: number;
  private totalWritten: number = 0;
  private onProgress: (bytes: number) => void;

  constructor(fd: number, start: number, end: number, onProgress: (bytes: number) => void) {
    super();
    this.fd = fd;
    this.pos = start;
    this.endByte = end;
    this.onProgress = onProgress;
  }

  _write(chunk: Buffer, encoding: string, callback: (error?: Error | null) => void) {
    const remaining = this.endByte - this.pos + 1;
    let data = chunk;
    let finishedChunk = false;

    if (data.length >= remaining) {
      data = data.slice(0, remaining);
      finishedChunk = true;
    }

    fs.write(this.fd, data, 0, data.length, this.pos, (err, written) => {
      if (err) return callback(err);
      
      this.pos += written;
      this.totalWritten += written;
      this.onProgress(written);

      if (finishedChunk) {
        // Stop accepting more data
        this.emit('range_done');
        return callback(new Error('RANGE_DONE')); // Break the stream safely
      }
      
      callback();
    });
  }
}

export async function downloadFtpMultithreaded(
  host: string, 
  remotePath: string, 
  localPath: string, 
  threads: number = 8
) {
  const masterClient = new Client();
  try {
    await masterClient.access({ host });
    const size = await masterClient.size(remotePath);
    masterClient.close();

    if (size === undefined || size === 0) {
      throw new Error("Could not determine file size on FTP");
    }

    // Pre-allocate file
    const fd = fs.openSync(localPath, 'w');
    fs.writeSync(fd, Buffer.alloc(1), 0, 1, size - 1);
    fs.closeSync(fd);

    const fdWrite = fs.openSync(localPath, 'r+');
    const chunkSize = Math.ceil(size / threads);
    const progressBar = new ProgressBar(`Downloading CNES (${threads} threads)`, size);

    const promises = [];
    const clients: Client[] = [];

    for (let i = 0; i < threads; i++) {
      const start = i * chunkSize;
      let end = start + chunkSize - 1;
      if (end >= size) end = size - 1;
      
      if (start > end) break;

      const client = new Client();
      clients.push(client);

      promises.push(downloadChunk(client, host, remotePath, start, end, fdWrite, (bytes) => {
        progressBar.add(bytes);
      }));
    }

    try {
      await Promise.all(promises);
      progressBar.finish();
    } catch (err) {
      clients.forEach(c => {
        try { c.close(); } catch (e) {}
      });
      throw err;
    } finally {
      fs.closeSync(fdWrite);
    }
  } catch (err) {
    throw err;
  }
}

async function downloadChunk(client: Client, host: string, remotePath: string, start: number, end: number, fd: number, onProgress: (bytes: number) => void) {
  try {
    await client.access({ host });
    const rangeStream = new RangeWriteStream(fd, start, end, onProgress);
    
    try {
      await client.downloadTo(rangeStream, remotePath, start);
    } catch (e: any) {
      if (e.message !== 'RANGE_DONE') {
        throw e;
      }
    }
  } finally {
    client.close();
  }
}
