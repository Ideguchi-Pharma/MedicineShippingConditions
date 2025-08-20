import * as Pumpify from 'pumpify';

declare function checkpointStream(isCheckpointFn: checkpointStream.CheckpointFunction): checkpointStream.CheckpointStream;
declare function checkpointStream(config: checkpointStream.CheckpointConfig): checkpointStream.CheckpointStream;

declare namespace checkpointStream {
  interface CheckpointStream extends Pumpify {
    flush(callback: FlushCallback): void;
    reset(): void;
  }

  interface CheckpointConfig {
    isCheckpointFn: CheckpointFunction,
    maxQueued?: number,
    objectMode?: boolean
  }

  type CheckpointFunction = (chunk: any) => boolean;
  type FlushCallback = (streamEnded: boolean) => void;

  /**
   * Convenience method for creating object streams.
   */
  function obj(isCheckpointFn: CheckpointFunction): CheckpointStream;
  function obj(config: CheckpointConfig): CheckpointStream;
}

export = checkpointStream;
