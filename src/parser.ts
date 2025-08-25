import { Readable } from 'stream';
import * as xlsx from 'xlsx';
import { logger } from './logger'; //ログを記録するツール(logger.ts)

interface medicine {
  drug_category: string;
  therapeutic_category: string;
  ingredient_name: string;
  package_unit: string | null;
  yj_code: string;
  product_name: string;
  manufacturer: string;
  product_type: string;
  is_basic_drug: string | null;
  is_stable_supply_drug: string | null;
  listing_date: string | null; 
  shipping_status: string | null;
  status_update_date: string | null;
  reason: string | null;
  resolution_estimate: string | null;
  resolution_or_discontinuation_date: string | null;
  shipment_volume_status: string | null;
  shipment_volume_improvement_date: string | null;
  shipment_volume_improvement_amount: string | null;
  other_info_update_date: string | null;
  is_new: string | null;
}

export function translate_row_to_medicine(row: any): Omit<medicine, 'updated_at'> { //テスト対象
    return {
      drug_category: row['①薬剤区分'],
      therapeutic_category: row['②薬効分類\r\n（保険薬収載時点の薬効分類を記載）'],
      ingredient_name: row['③成分名'],
      package_unit: row['④規格単位\r\n※全角'] || null,
      yj_code: row['⑤YJコード'],
      product_name: row['⑥品名\r\n（承認書に記載の正式名称）\r\n※全角'],
      manufacturer: row['⑦製造販売業者名'],
      product_type: row['⑧製品区分'],
      is_basic_drug: row['⑨基礎的\r\n医薬品'] || null,
      is_stable_supply_drug: row['⑩安定確保医薬品'] || null,
      listing_date: parse_date_or_null(row['⑪薬価収載年月日']),
      shipping_status: row['⑫製造販売業者の\r\n「出荷対応」の状況'] || null,
      status_update_date: parse_date_or_null(row['⑬当該品目の⑫の情報を更新した日（本項目を報告内容として追加した令和7年5月13日以降に⑫の情報を更新した品目についてのみ記載）']),
      reason: row['⑭限定出荷/供給停止の理由\r\n'] || null,
      resolution_estimate: row['⑮限定出荷の解除見込み／\r\n供給停止の解消見込み'] || null,
      resolution_or_discontinuation_date: row['⑯限定出荷の解除見込み／\r\n供給停止の解消見込み／\r\n販売中止品の在庫消尽時期'] || null,
      shipment_volume_status: row['⑰製造販売業者の\r\n「出荷量」の現在の状況'] || null,
      shipment_volume_improvement_date: row['⑱製造販売業者の「出荷量」の改善（増加）見込み時期'] || null,
      shipment_volume_improvement_amount: row['⑲⑱を任意選択した場合の「出荷量」の改善（増加）見込み量'] || null,
      other_info_update_date: parse_date_or_null(row['⑳当該品目の⑫以外の情報を更新した日']),
      is_new: row['更新有無（更新有りの場合、Newと表示）'] || null,
    };
  }

/**
 * 文字列を'YYYY-MM-DD'形式の日付オブジェクトに変換する。
 * 空白や日付として不正な文字列の場合は null を返す。
 * @param dateStr 変換したい文字列
 * @returns Dateオブジェクト、または null
 */
export function parse_date_or_null(dateStr: any): string | null { //テスト対象
    if (!dateStr) return null; //空だった場合、nullを返す
    const str = String(dateStr).trim(); //文字列かどうかのチェックと前後の空白があれば削除
    if (["未定", "-", "薬価基準未収載"].includes(str) || str === '') {
      return null; //上記の文字列または空白だった場合、nullを返す　
    }
    const date = new Date(str); //タイムスタンプを返そうとする
    if (isNaN(date.getTime())) { //is Not a number?　数字ではないですか？
      return null; //Nanが真だった場合、nullを返す
    }
    // ★Spannerが要求する "YYYY-MM-DD" 形式の文字列を生成して返す
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // 月は0から始まるため+1。1桁の場合は先頭に0を付与
    const day = String(date.getDate()).padStart(2, '0'); //1桁の場合は先頭に0を付与
    
    return `${year}-${month}-${day}`; //YYYY-MM-DDの形に成型する
  }
/**
 * ReadableStreamをBufferに変換するヘルパー関数
 * @param stream 入力ストリーム
 */
export async function stream_to_buffer(stream: Readable): Promise<Buffer> { //async=非同期で行う。(この関数を呼び出すときにawaitを使うことができる。)　扱うデータはstreamでReadable型を指定。Buffer型のデータを渡すことを約束し、後から渡している。(この関数の処理待ちでプログラムが止まらないようにするため)
  const chunks: Buffer[] = []; //chunksという空の配列の箱を用意　Bufferはデータのかけらを扱うための特別な箱
  for await (const chunk of stream) { //for文　streamにデータが届くたびに手に取る
    chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk)); //手に取ったデータをchunksに追加していく。for文のため、データが届かなくなるまで実行する。
  }
  return Buffer.concat(chunks); //chunksに入っているデータのかけら達を繋ぎ合わせ(=concat)、1つのデータに成型して返す。
}
/**
 * Excelファイルのストリームを解析し、DB投入用のオブジェクト配列を生成する
 * @param stream 入力となるファイルのReadableStream
 * @returns DB投入可能なオブジェクトの配列
 */
export async function parse_and_filter_data(stream: Readable): Promise<Omit<medicine, 'updated_at'>[]> { //テスト対象
  const buffer = await stream_to_buffer(stream); //ファイルをひとまとめにしてbufferに格納（前述）
  const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true }); //bufferに入っているデータをExcelファイルとして認識させる
  const sheetName = workbook.SheetNames[0]; //1シート目を指定
  const sheet = workbook.Sheets[sheetName]; //上で指定したシートを取り出してsheetに格納
  let json_data: any[] = xlsx.utils.sheet_to_json(sheet, { range: 1, defval: null }); //ExcelシートをJSONに変換。ヘッダーは2行目に位置している。defval: nullはヘッダー以下の行に数千行先までデータがない場合に、その列自体を無視されないようにするために付けている

  const initial_row_count = json_data.length; // フィルターをかける前の行数を記録
  json_data = json_data.filter(row => { // 全てのセルが空(null)である行を配列から除外する
    return Object.values(row).some(cellValue => {
    // チェック1: 本当の空(null)か？
    if (cellValue === null) {
        return false; // nullなら無効
    }
    // チェック2: もし文字列なら、空白を取り除いても空か？
    if (typeof cellValue === 'string' && cellValue.trim() === '') {
        return false; // 空白だけの文字列なら無効
    }
    // 上記のチェックを両方クリアすれば、有効なデータ
    return true;
    });
   });

  const removed_empty_row_count = initial_row_count - json_data.length; // 削除した空行の数を計算
  if (removed_empty_row_count > 0) {
    logger.info(`[PARSER] データが入力されていない空の行を ${removed_empty_row_count}件削除しました。`);
  } else {
    logger.info(`[PARSER] データが入力されていない空の行はありませんでした。`)
  }

  //※エラーが解消したため、コメントアウト
  //if (json_data.length > 0) {
  //  logger.info('Excelから読み込んだ最初の行のキー（ヘッダー名）:', Object.keys(json_data[0])); //ヘッダー名を全てコンソールに表示（全カラムが読み込まれているか確認するため）
  //}

    const translated_medicines = json_data.map(translate_row_to_medicine);
    
    // 1. まず、全データからYJコードのリストだけを抜き出す
    const yj_codes = translated_medicines.map(med => med.yj_code).filter(Boolean);
    // 2. Setの「重複を許さない」性質を使い、ユニークな件数を一瞬で計算
    const unique_yj_code_count = new Set(yj_codes).size;
    // 3. 元の総数からユニークな件数を引いて、重複件数を算出
    const duplicate_count = yj_codes.length - unique_yj_code_count;

    if (duplicate_count > 0) { // ログに記録する
      logger.info(`[PARSER] 重複チェック: ${duplicate_count}件の重複したYJコードが見つかりました。(DB投入時に後着優先で上書きされます)`);
    } else {
      logger.info(`[PARSER] 重複チェック:重複したYJコードはありませんでした。`)
    }

    const medicines =translated_medicines.filter(medicine => {
      // YJコードがNULLや空文字のデータを除外する
      return medicine.yj_code && String(medicine.yj_code).trim() !== '';
    });

    const excluded_count = translated_medicines.length - medicines.length;
    if (excluded_count > 0) {
      logger.info(`[PARSER] YJコードが空のため、${excluded_count}件のデータを除外しました。`) //除外した件数をコンソールに表示（削除される件数は2件のはずだが、完全な空白行183行も入っているため、185行と表示される）
    } else {
      logger.info(`[PARSER] YJコードが空のデータはありませんでした。`)
    }

  return medicines;
}