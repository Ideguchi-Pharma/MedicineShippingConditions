//テスト対象
// translate_row_to_medicine　重要な部品のため、テストする
// parse_date_or_null　重要な部品のため、テストする
// parse_and_filter_data　メイン関数のため、テスト必須
// stream_to_bufferはストリームをモックする必要があるため、後回し

import { 
    translate_row_to_medicine,
    parse_date_or_null,
    parse_and_filter_data
 } from "./parser";

//---translate_row_to_medicineのテスト---
describe('translate_row_to_medicine',() => {
    //テスト1.一般的なデータが正しく翻訳されるかどうか ※どのカラム名も今後の変更に合わせて修正する可能性があるため、全てテストする
    test('should translate a typical row object collectly', () => {
        const mock_row = {
            '①薬剤区分': '抗生物質',
            '②薬効分類\r\n（保険薬収載時点の薬効分類を記載）': '抗ウイルス剤',
            '③成分名': 'ビダラビン',
            '④規格単位\r\n※全角': '３００ｍｇ１瓶',
            '⑤YJコード': '6250400D1044',
            '⑥品名\r\n（承認書に記載の正式名称）\r\n※全角': 'アラセナ－Ａ点滴静注用３００ｍｇ',
            '⑦製造販売業者名': '持田',
            '⑧製品区分': '先発品',
            '⑨基礎的\r\n医薬品': '基礎的医薬品',
            '⑩安定確保医薬品': 'C',
            '⑪薬価収載年月日': '1984/11/22',
            '⑫製造販売業者の\r\n「出荷対応」の状況': '①通常出荷',
            '⑬当該品目の⑫の情報を更新した日（本項目を報告内容として追加した令和7年5月13日以降に⑫の情報を更新した品目についてのみ記載）': '2025/6/11',
            '⑭限定出荷/供給停止の理由\r\n': '１．需要増',
            '⑮限定出荷の解除見込み／\r\n供給停止の解消見込み': 'ウ． 未定',
            '⑯限定出荷の解除見込み／\r\n供給停止の解消見込み／\r\n販売中止品の在庫消尽時期': '2025年10月頃在庫消尽見込み',
            '⑰製造販売業者の\r\n「出荷量」の現在の状況': 'B．出荷量減少',
            '⑱製造販売業者の「出荷量」の改善（増加）見込み時期': 'e．３か月超',
            '⑲⑱を任意選択した場合の「出荷量」の改善（増加）見込み量': '130',
            '⑳当該品目の⑫以外の情報を更新した日': '2025/7/24',
            '今回掲載時の更新有無（更新有りの場合、Newと表示）': 'New',
        };
        const result = translate_row_to_medicine(mock_row);

        expect(result.drug_category).toBe('抗生物質');
        expect(result.therapeutic_category).toBe('抗ウイルス剤');
        expect(result.ingredient_name).toBe('ビダラビン');
        expect(result.package_unit).toBe('３００ｍｇ１瓶');
        expect(result.yj_code).toBe('6250400D1044');
        expect(result.product_name).toBe('アラセナ－Ａ点滴静注用３００ｍｇ')
        expect(result.manufacturer).toBe('持田');
        expect(result.product_type).toBe('先発品');
        expect(result.is_basic_drug).toBe('基礎的医薬品')
        expect(result.is_stable_supply_drug).toBe('C');
        expect(result.listing_date).toBe('1984-11-22');
        expect(result.shipping_status).toBe('①通常出荷');
        expect(result.status_update_date).toBe('2025-06-11');
        expect(result.reason).toBe('１．需要増');
        expect(result.resolution_estimate).toBe('ウ． 未定');
        expect(result.resolution_or_discontinuation_date).toBe('2025年10月頃在庫消尽見込み');
        expect(result.shipment_volume_status).toBe('B．出荷量減少');
        expect(result.shipment_volume_improvement_date).toBe('e．３か月超');
        expect(result.shipment_volume_improvement_amount).toBe('130');
        expect(result.other_info_update_date).toBe('2025-07-24')
        expect(result.is_new).toBe('New');
    });
})
//Geminiコメント
//expectを一つ一つ書く代わりに、toEqualを使ってオブジェクト全体を一度に比較することもできますが、
// このようにプロパティを一つずつ検証する方が、テストが失敗したときに**「どのプロパティで問題が起きたのか」が
// 一目瞭然**になるため、より親切なテストになります。

//2.値が空の場合に、正しくnullになるかをテストする

//---parse_date_or_nullのテスト---