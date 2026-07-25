import { type Response } from "express";

export interface SSEMessage {
  chunk?: string;
  full?: string;
  done?: boolean;
  error?: string;
  [key: string]: unknown;
}

export class SSEHelper {
  private res: Response;
  private isClosed: boolean = false;

  constructor(res: Response) {
    this.res = res;
    this.setupHeaders();
  }

  private setupHeaders() {
    this.res.setHeader("Content-Type", "text/event-stream");
    this.res.setHeader("Cache-Control", "no-cache");
    this.res.setHeader("Connection", "keep-alive");
    this.res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
    this.res.setHeader("Access-Control-Allow-Origin", "*");
    this.res.setHeader("Access-Control-Allow-Headers", "Cache-Control");
  }

  /**
   * Send a message to the client
   */
  send(message: SSEMessage) {
    if (this.isClosed) return;
    this.res.write(`data: ${JSON.stringify(message)}\n\n`);
  }

  /**
   * Send a chunk of text
   */
  sendChunk(chunk: string, full?: string) {
    this.send({ chunk, full: full ?? "" });
  }

  /**
   * Send a completion signal
   */
  sendComplete(summary: string) {
    this.send({ done: true, summary });
  }

  /**
   * Send an error message
   */
  sendError(error: string) {
    this.send({ error });
    this.close();
  }

  /**
   * Close the SSE connection
   */
  close() {
    if (this.isClosed) return;
    this.isClosed = true;
    this.res.end();
  }

  /**
   * Check if the connection is still open
   */
  isConnectionOpen(): boolean {
    return !this.isClosed && !this.res.writableEnded;
  }

  /**
   * Handle client disconnect
   */
  onDisconnect(callback: () => void) {
    this.res.on("close", () => {
      this.isClosed = true;
      callback();
    });
  }
}
