/**
 * Ultra-Low-Latency Streaming Text Chunker for TTS
 * Emits the very first phrase boundary (<15-20 chars / 2-3 words) instantly for minimal Time-to-First-Audio (TTFA).
 * Subsequent chunks follow natural sentence/clause boundaries without splitting mid-word.
 */

export class TextChunker {
  private buffer = '';
  private isFirstChunk = true;
  private minSubsequentChunkChars = 24;

  /**
   * Append a new streaming token and return any completed speech chunks ready for immediate TTS.
   */
  public push(token: string): string[] {
    this.buffer += token;
    const readyChunks: string[] = [];

    while (true) {
      if (this.isFirstChunk) {
        // Fast-path for First Chunk: emit at first punctuation mark (. , ! ? ; : — \n) with >= 10 chars or >= 2 words
        const match = this.buffer.match(/([.?!]+|\n+|[,;:—]+)\s*/);
        if (match && match.index !== undefined) {
          const splitIndex = match.index + match[0].length;
          const candidate = this.buffer.slice(0, splitIndex).trim();
          const words = candidate.split(/\s+/).filter(Boolean);

          // Avoid breaking incomplete numeric decimals like "3." or initials
          if (!/\d\.$/.test(candidate) && (candidate.length >= 10 || words.length >= 2)) {
            readyChunks.push(candidate);
            this.buffer = this.buffer.slice(splitIndex);
            this.isFirstChunk = false;
            continue;
          }
        }

        // If no punctuation yet but buffer reached 32+ chars, split cleanly on last whitespace boundary
        if (this.buffer.length >= 32) {
          const lastSpaceIdx = this.buffer.lastIndexOf(' ');
          if (lastSpaceIdx > 14) {
            const candidate = this.buffer.slice(0, lastSpaceIdx).trim();
            readyChunks.push(candidate);
            this.buffer = this.buffer.slice(lastSpaceIdx + 1);
            this.isFirstChunk = false;
            continue;
          }
        }
        break;
      }

      // Subsequent chunks: balance sentence naturalness and streaming throughput
      const match = this.buffer.match(/([.?!]+|\n+|[,;:—]+)\s*/);
      if (!match || match.index === undefined) {
        // If buffer is becoming long without punctuation, split at word boundary
        if (this.buffer.length >= 70) {
          const lastSpaceIdx = this.buffer.lastIndexOf(' ');
          if (lastSpaceIdx > 35) {
            const candidate = this.buffer.slice(0, lastSpaceIdx).trim();
            readyChunks.push(candidate);
            this.buffer = this.buffer.slice(lastSpaceIdx + 1);
            continue;
          }
        }
        break;
      }

      const splitIndex = match.index + match[0].length;
      const candidate = this.buffer.slice(0, splitIndex).trim();
      const words = candidate.split(/\s+/).filter(Boolean);
      const isSentenceEnd = /[.?!]/.test(match[1]);

      // Guard against splitting decimals like "99.9%" or abbreviations
      if (/\d\.\d*$/.test(candidate)) {
        break;
      }

      if (candidate.length >= this.minSubsequentChunkChars || (isSentenceEnd && words.length >= 3) || candidate.length > 55) {
        readyChunks.push(candidate);
        this.buffer = this.buffer.slice(splitIndex);
      } else if (isSentenceEnd && this.buffer.length > splitIndex) {
        if (words.length >= 2) {
          readyChunks.push(candidate);
          this.buffer = this.buffer.slice(splitIndex);
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return readyChunks;
  }

  /**
   * Flush any remaining text in buffer at end of stream.
   */
  public flush(): string | null {
    const remaining = this.buffer.trim();
    this.buffer = '';
    this.isFirstChunk = true;
    return remaining.length > 0 ? remaining : null;
  }

  /**
   * Clear buffer on interruption.
   */
  public clear(): void {
    this.buffer = '';
    this.isFirstChunk = true;
  }
}
