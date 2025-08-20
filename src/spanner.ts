import { Spanner } from '@google-cloud/spanner';

// --- エミュレータ用に設定 ---
// ※本番環境に切り替える際は、ここの値を本物の値に書き換えます
const projectId = 'test-project';
const instanceId = 'test-instance';
const databaseId = 'test-database';
// --------------------------------

// Spannerクライアントを初期化
const spanner = new Spanner({ projectId });
const instance = spanner.instance(instanceId);
const database = instance.database(databaseId);

/**
 * 解析済みデータをSpannerに投入し、古いデータを削除する（洗い替え処理）
 * @param products 解析済みの製品データ配列 (parser.tsからの出力)
 */
export async function upsertDataAndCleanUp(products: any[]): Promise<void> {
  // 1. 処理の開始時刻を一度だけ取得し、変数に保存する
  const executionTime = new Date();
  console.log(`[SPANNAR] 処理タイムスタンプ: ${executionTime.toISOString()}`);

  // 2. 解析した全データに、取得した単一のタイムスタンプを`updated_at`として付与する
  const recordsToInsert = products.map(p => ({
    ...p,
    updated_at: executionTime, // テーブル定義のカラム名に合わせる
  }));
  
  // 3. データをSpannerに投入する
  const productTable = database.table('MedicineShippingConditions');
  try {
    console.log(`[SPANNAR] ${recordsToInsert.length}件のデータを投入します...`);
    // Spannerは一度に大量のデータを投入できるので、配列をそのまま渡す
    await productTable.replace(recordsToInsert);
    console.log('[SPANNAR] データの投入が完了しました。');

    // 4. 処理開始時のタイムスタンプより古いデータを削除する
    console.log('[SPANNAR] 古いデータのクリーンアップを開始します...');
    const [rowCount] = await database.runTransactionAsync(async (transaction) => {
      const affectedRows = await transaction.runUpdate({
        sql: `DELETE FROM MedicineShippingConditions WHERE updated_at < @executionTime`,
        params: { executionTime: executionTime },
      });
      await transaction.commit();
      return affectedRows;
    });
    console.log(`[SPANNAR] ${rowCount}件の古いデータを削除しました。`);

  } catch (err) {
    console.error('[SPANNAR] エラーが発生しました:', err);
  } finally {
    // 最後にDB接続を閉じる
    await database.close();
    console.log('[SPANNAR] データベース接続を閉じました。');
  }
}