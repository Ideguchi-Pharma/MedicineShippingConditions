import { createReadStream } from 'fs'; //Node.jsのツール。大きなファイルでもメモリを使い過ぎないようにする
import { Readable } from 'stream'; //巨大なデータを効率的に扱うための仕組み
import { parse_and_filter_data } from './parser'; //Excel解析の結果を呼び出す(parser.ts)
import { upsert_data_and_clean_up } from './spanner';  //データベース接続のツール(spanner.ts)

// --- メイン処理 ---
async function main() {
  console.log('--- バッチ処理を開始します ---');

  try {
    // --- STEP 1: ファイルの読み込み ---
    const today = new Date(); //現在の日付データを読み込む
    today.setDate(today.getDate() - 1); //1日前のデータが更新されるため、取得した日付オブジェクトを1日戻す
    const year = today.getFullYear().toString().slice(-2); //2025から下2桁を取り出す
    const month = (today.getMonth() + 1.).toString().padStart(2, '0'); //0から始まるため、+1、
    const day = today.getDate().toString().padStart(2, '0'); //Dateが1桁の場合、先頭に0を追加

    const file_name = `${year}${month}${day}iyakuhinkyoukyu.xlsx` //動的なExcelファイル名を指定
    const file_path = `./${file_name}`; // プロジェクトルートのExcelファイルを指定
    console.log(`[MAIN] ファイルを読み込みます: ${file_path}`);
    const stream: Readable = createReadStream(file_path); //streamという箱にExcelファイルへの蛇口を作成（Readable型を指定）
    
    // --- STEP 2: データの解析とフィルタリング ---
    console.log('[MAIN] ファイルの解析を開始します...');
    const products = await parse_and_filter_data(stream); //parser.tsへstreamに入っているデータを渡して解析・フィルタリング処理を依頼。この処理が完了してデータが返されるまで、index.tsの動きはストップ
    console.log(`[MAIN] 解析完了。処理対象データ: ${products.length}件`);

    // --- STEP 3: Spannerへの投入とクリーンアップ ---
    if (products.length > 0) {
      console.log('[MAIN] Spannerへのデータ投入処理を開始します...'); 
      await upsert_data_and_clean_up(products); //spanner.tsに、parser.tsで処理が完了したデータを渡して、データベースの洗い替えを依頼。この処理が完了するまでindex.tsの動きはストップ
    } else {
      console.log('[MAIN] 処理対象データが0件のため、Spannerへの投入はスキップします。');
    } 

  } catch (error) {
    console.error('[MAIN] バッチ処理中に致命的なエラーが発生しました:', error);
    process.exit(1); // エラーが発生した場合、プロセスを異常終了させる
  }

  console.log('--- バッチ処理が正常に完了しました ---');
}

// プログラム実行
main();