import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { parseAndFilterData } from './parser';
import { upsertDataAndCleanUp } from './spanner'; 

// --- メイン処理 ---
async function main() {
  console.log('--- バッチ処理を開始します ---');

  try {
    // --- STEP 1: ファイルの読み込み ---
    const filePath = './data.xlsx'; // プロジェクトルートのExcelファイルを指定
    console.log(`[MAIN] ファイルを読み込みます: ${filePath}`);
    const stream: Readable = createReadStream(filePath);
    
    // --- STEP 2: データの解析とフィルタリング ---
    console.log('[MAIN] ファイルの解析を開始します...');
    const products = await parseAndFilterData(stream);
    console.log(`[MAIN] 解析完了。処理対象データ: ${products.length}件`);

    // --- STEP 3: Spannerへの投入とクリーンアップ ---
    if (products.length > 0) {
      console.log('[MAIN] Spannerへのデータ投入処理を開始します...');
      await upsertDataAndCleanUp(products);
    } else {
      console.log('[MAIN] 処理対象データが0件のため、Spannerへの投入はスキップします。');
    }

  } catch (error) {
    console.error('[MAIN] バッチ処理中に致命的なエラーが発生しました:', error);
    // エラーが発生した場合、プロセスを異常終了させる
    process.exit(1);
  }

  console.log('--- バッチ処理が正常に完了しました ---');
}

// プログラム実行
main();