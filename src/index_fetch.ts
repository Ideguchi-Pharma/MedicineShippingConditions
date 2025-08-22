import { Readable } from 'stream'; //巨大なデータを効率的に扱うための仕組み
import fetch from 'node-fetch'; //ファイルをダウンロードする
import cron from 'node-cron'; //プログラムの実行スケジュールを指定する
import { parse_and_filter_data } from './parser'; //Excel解析の結果を呼び出す(parser.ts)
import { upsert_data_and_clean_up } from './spanner';  //データベース接続のツール(spanner.ts)

// ---設定値---
const CRON_SCHEDULE = '*/1 * * * *'; // cron形式のスケジュール(分　時　日　月　曜日)
const SCHEDULE = '1分ごと';
const TIME_ZONE = 'Asia/Tokyo'; //日本時間に設定
const BASE_URL = 'https://www.mhlw.go.jp/content/10800000/';

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
    const download_url = `${BASE_URL}${file_name}`; // プロジェクトルートのExcelファイルを指定
    console.log(`[MAIN] ファイルをダウンロードします: ${download_url}`);

    let response;
    try {
      response = await fetch(download_url); //URL先にあるファイルをダウンロードする
    } catch(error: any) {
      if (error.code === 'ENOTFOUND') { //ネットワークレベルのエラー（サーバーに到達できなかったなど）
        throw new Error(`ネットワークエラー: 指定されたホストが見つかりません。URLを確認してください。 (${download_url})`); //検証済
      } //その他の予期せぬネットワークエラー
        throw new Error(`ネットワークエラー: ファイルのダウンロード中に問題が発生しました。 ${error.message}`);
    }

    if(!response.ok) { //サーバーから応答があったものの、それが成功（200番台）ではなかった場合の処理
      if (response.status === 404) { //HTTPレベルのエラー（404はその日のファイルがまだない可能性が高い）
      throw new Error(`ファイルが見つかりません(404 Not Found)。本日のファイルはまだ公開されていない可能性があります。 URL: ${download_url}`); //検証済
      } //500番台のサーバーエラー等、その他のHTTPエラー
      throw new Error(`ダウンロードに失敗しました。サーバーからの応答ステータス: ${response.status} ${response.statusText}`);
    }

    const stream =response.body as Readable; //responseからbodyを取り出し、Readable型としてstreamに保存する
    
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
console.log(`バッチ処理のスケジュールを設定しました。${SCHEDULE}に実行されます...`);
cron.schedule(CRON_SCHEDULE, () => {
    console.log('スケジュールされたタスクを実行します...');
    run_batch_process();
}, {
    timezone: TIME_ZONE 
});

// プログラムを手動で実行する場合は、下記のコメントアウトを外す。スケジュール機能を使用する場合は、必ずコメントアウトする。
//run_batch_process();

//fetchが失敗した時のログを詳細にする（ファイルが見つからない、ネットワーク不良など）
//