import { Spanner } from '@google-cloud/spanner';
import { logger } from './logger'; //ログを記録するツール(logger.ts)
import dotenv from 'dotenv'; 
dotenv.config(); //envファイルを読み込む

// --- エミュレータ用に設定 ---
const projectId = process.env.SPANNER_PROJECT_ID || 'test-project';
const instanceId = process.env.SPANNER_INSTANCE_ID || 'test-instance';
const databaseId = process.env.SPANNER_DATABASE_ID || 'test-database';
const TABLE_NAME = process.env.SPANNER_TABLE_NAME || 'MedicineShippingConditions'; 
/**
 * 解析済みデータをSpannerに投入し、古いデータを削除する（洗い替え処理）
 * @param products 解析済みの製品データ配列 (parser.tsからの出力)
 */
export async function upsert_data_and_clean_up(products: any[]): Promise<void> {
  // Spannerクライアントを初期化(内側で行うことで、2回目以降の実行もdatabaseにあくせすできる)
  const spanner = new Spanner({ projectId });
  const instance = spanner.instance(instanceId);
  const database = instance.database(databaseId);
  const product_table = database.table(TABLE_NAME);
  // 1. 処理の開始時刻を一度だけ取得し、変数に保存する
  const execution_time = new Date();
  logger.info(`[SPANNAR] 処理タイムスタンプ: ${execution_time.toISOString()}`);
  // 2. 解析した全データに、取得した単一のタイムスタンプを`updated_at`として付与する
  const records_to_insert = products.map(p => ({
    ...p,
    updated_at: execution_time, // テーブル定義のカラム名に合わせる
  }));
  
  // 3. データをSpannerに投入する
  try {
    logger.info(`[SPANNAR] ${records_to_insert.length}件のデータを投入します...`);
    // Spannerは一度に大量のデータを投入できるので、配列をそのまま渡す
    await product_table.replace(records_to_insert); //replace:もし同じ主キー（YJコード）のデータがあれば新しいデータで丸ごと上書きし、なければ新規データとして追加する
    logger.info('[SPANNAR] データの投入が完了しました。');

    // 4. 処理開始時のタイムスタンプより古いデータを削除する(万が一、古いデータが残っていた場合の処理)
    logger.info('[SPANNAR] 古いデータのクリーンアップを開始します...');
    const [row_count] = await database.runTransactionAsync(async (transaction) => { //runTransactionAsync:この一連の削除処理中にエラーが発生したら全ての削除処理をキャンセルする
      const affected_rows = await transaction.runUpdate({
        sql: `DELETE FROM MedicineShippingConditions WHERE updated_at < @execution_time`, //SQL命令文：replaceで投入したデータのupdate_atより古いデータをデータベースから削除すしてください
        params: { execution_time: execution_time }, //@とparamsはセット。@で空欄を作り、paramsで内容を入れる。(サイバー攻撃を防ぐため)
      });
      await transaction.commit(); //最終的な実行ボタン
      return affected_rows; //削除した件数をrow_countに返す
    });
    logger.info(`[SPANNAR] ${row_count}件の古いデータを削除しました。`);

  } catch (err) {
    logger.error('[SPANNAR] エラーが発生しました:', err);
  } finally {
    // 最後にDB接続を閉じる
    await database.close();
    logger.info('[SPANNAR] データベース接続を閉じました。');
  }
}