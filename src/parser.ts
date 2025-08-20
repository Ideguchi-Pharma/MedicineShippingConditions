import { Readable } from 'stream';
import * as xlsx from 'xlsx';

// DBのテーブル定義に合わせたデータ型（Interface）を定義
// これにより、コード内でtypoなどのミスを防げる
interface Medicine {
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
  listing_date: Date | null; // 元データに文字列が入るためstring
  shipping_status: string | null;
  status_update_date: Date | null;
  reason: string | null;
  resolution_estimate: string | null;
  resolution_or_discontinuation_date: string | null;
  shipment_volume_status: string | null;
  shipment_volume_improvement_date: string | null;
  shipment_volume_improvement_amount: string | null;
  other_info_update_date: Date | null;
  is_new: string | null;
}

/**
 * 文字列を'YYYY-MM-DD'形式の日付オブジェクトに変換する。
 * 空白や日付として不正な文字列の場合は null を返す。
 * @param dateStr 変換したい文字列
 * @returns Dateオブジェクト、または null
 */
function parseDateOrNull(dateStr: any): Date | null {
  if (!dateStr) return null;

  const str = String(dateStr).trim();
  if (["未定", "-", "薬価基準未収載"].includes(str) || str === '') {
    return null;
  }
  
  const date = new Date(str);
  if (isNaN(date.getTime())) {
    return null;
  }
  
  // SpannerはDateオブジェクトを直接受け取れるので、オブジェクトを返す
  return date;
}

/**
 * ReadableStreamをBufferに変換するヘルパー関数
 * @param stream 入力ストリーム
 */
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Excelファイルのストリームを解析し、DB投入用のオブジェクト配列を生成する
 * @param stream 入力となるファイルのReadableStream
 * @returns DB投入可能なオブジェクトの配列
 */
export async function parseAndFilterData(stream: Readable): Promise<Omit<Medicine, 'updated_at'>[]> {
  const buffer = await streamToBuffer(stream);
  const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // ExcelシートをJSONに変換（ヘッダーは実際のExcelに合わせて調整が必要）
  // 注：実際のExcelファイルのヘッダー名と完全に一致させる必要があります
  const jsonData: any[] = xlsx.utils.sheet_to_json(sheet, { range: 1 });

  if (jsonData.length > 0) {
    console.log('Excelから読み込んだ最初の行のキー（ヘッダー名）:', Object.keys(jsonData[0]));
  }

  const medicines = jsonData
    .map(row => {
      // Excelのヘッダー名（日本語）を、DBの列名（英語）に変換する
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
        listing_date: parseDateOrNull(row['⑪薬価収載年月日']), // 文字列として保持
        shipping_status: row['⑫製造販売業者の\r\n「出荷対応」の状況'] || null,
        status_update_date: parseDateOrNull(row['⑬当該品目の⑫の情報を更新した日（本項目を報告内容として追加した令和7年5月13日以降に⑫の情報を更新した品目についてのみ記載）']),
        reason: row['⑭限定出荷/供給停止の理由\r\n'] || null,
        resolution_estimate: row['⑮限定出荷の解除見込み／\r\n供給停止の解消見込み'] || null,
        resolution_or_discontinuation_date: row['⑯限定出荷の解除見込み／\r\n供給停止の解消見込み／\r\n販売中止品の在庫消尽時期'] || null,
        shipment_volume_status: row['⑰製造販売業者の\r\n「出荷量」の現在の状況'] || null,
        shipment_volume_improvement_date: row['⑱製造販売業者の「出荷量」の改善（増加）見込み時期'] || null,
        shipment_volume_improvement_amount: row['⑲⑱を任意選択した場合の「出荷量」の改善（増加）見込み量'] || null,
        other_info_update_date: parseDateOrNull(row['⑳当該品目の⑫以外の情報を更新した日']),
        is_new: row['更新有無（更新有りの場合、Newと表示）'] || null,
      };
    })
    .filter(medicine => {
      // YJコードがNULLや空文字のデータを除外する
      return medicine.yj_code && String(medicine.yj_code).trim() !== '';
    });

  return medicines;
}