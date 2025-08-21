import { Readable } from 'stream'; //巨大なデータを効率的に扱うための仕組み
import fetch from 'node-fetch'; //ファイルをダウンロードする
import cron from 'node-cron'; //プログラムの実行スケジュールを指定する
import { parse_and_filter_data } from './parser'; //Excel解析の結果を呼び出す(parser.ts)
import { upsert_data_and_clean_up } from './spanner';  //データベース接続のツール(spanner.ts)

// --- メイン処理 ---
async function run_batch_process() {
  console.log(`--- ${new Date().toLocaleString()} バッチ処理を開始します ---`);

  try {
    // --- STEP 1: ファイルの読み込み ---
    const today = new Date(); //現在の日付データを読み込む
    today.setDate(today.getDate() - 1); //1日前のデータが更新されるため、取得した日付オブジェクトを1日戻す
    const year = today.getFullYear().toString().slice(-2); //2025から下2桁を取り出す
    const month = (today.getMonth() + 1.).toString().padStart(2, '0'); //0から始まるため、+1、
    const day = today.getDate().toString().padStart(2, '0'); //Dateが1桁の場合、先頭に0を追加

    const file_name = `${year}${month}${day}iyakuhinkyoukyu.xlsx` //動的なExcelファイル名を指定
    const download_url = `https://www.mhlw.go.jp/content/10800000/${file_name}`; // プロジェクトルートのExcelファイルを指定
    console.log(`[MAIN] ファイルをダウンロードします: ${download_url}`);
    const responce = await fetch(download_url);

    if(!responce.ok) {
        console.log(`[MAIN] ダウンロードに失敗しました。ステータス：${responce.statusText}`)
    }

    const stream = responce.body as Readable ; 
    
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
    //process.exit(1); スケジュール実行の場合、プロセスは終了させずにエラーを記録する
  }

  console.log(`--- ${new Date().toLocaleString()} バッチ処理が正常に完了しました ---`);
}

// --- スケジュール設定 ---
// '0 8 * * *' は「毎日 朝8時0分」を意味するcron形式のスケジュール(分　時　日　月　曜日)
console.log('バッチ処理のスケジュールを設定しました。毎日AM9:30に実行されます...');
cron.schedule('20 16 * * *', () => {
  console.log('スケジュールされたタスクを実行します...');
  run_batch_process();
}, {
  timezone: "Asia/Tokyo" // タイムゾーンを日本時間に設定
});

// プログラムを手動で実行する場合は、下記のコメントアウトを外す
//run_batch_process();