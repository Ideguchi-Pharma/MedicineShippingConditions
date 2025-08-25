import winston from 'winston';

// ログのフォーマットを定義
const log_format = winston.format.printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level.toUpperCase()}]: ${message}`; //「時刻、[重要度]： ログの内容」の形式で表示させる。
});

// ロガー（ログ専門家）の作成
export const logger = winston.createLogger({ //winston.createLogger:winstonライブラリの命令文:ロガーを作成
  level: 'info', // 'info'レベル以上のログを記録する(感度を設定)
  format: winston.format.combine( //出力内容の設定(組み合わせる)
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), //タイムスタンプを押す
    log_format //上で設定したログのフォーマットで出力
  ),
  transports: [ //transports：書き出し先を指定する（[]で囲むと、複数の出力先を指定できる）
    // 1. エラーログは 'error.log' という名前のファイルに書き出す
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    // 2. 全てのログは 'combined.log' という名前のファイルに書き出す（levelを指定していないので、info以上(全て)のログを書き出す）
    new winston.transports.File({ filename: 'combined.log' }),
    // 3. ターミナルにも分かりやすく色付きで表示する
    new winston.transports.Console({
      format: winston.format.combine( //ターミナルに出力する場合はこのフォーマットで出力する
        winston.format.colorize(), //重要度に合わせて色を付ける
        log_format
      )
    })
  ],
});

const status_log_format = winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${message}`;
  });

  export const status_logger = winston.createLogger({
     level: 'info',
     format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        status_log_format
    ),
    transports: [ 
    new winston.transports.File({ filename: 'status.log' }) // 記録先は 'status.log' ファイルのみ
    ],
});