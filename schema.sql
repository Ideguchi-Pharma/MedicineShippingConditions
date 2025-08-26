CREATE TABLE MedicineShippingConditions (
    drug_category                       STRING(MAX) NOT NULL, -- ①薬剤区分
    therapeutic_category                STRING(MAX) NOT NULL, -- ②薬効分類
    ingredient_name                     STRING(MAX) NOT NULL, -- ③成分名
    package_unit                        STRING(MAX),          -- ④規格単位
    yj_code                             STRING(MAX) NOT NULL, -- ⑤YJコード(主キー)
    product_name                        STRING(MAX) NOT NULL, -- ⑥品名
    manufacturer                        STRING(MAX) NOT NULL, -- ⑦製造販売業者名
    product_type                        STRING(MAX) NOT NULL, -- ⑧製品区分
    is_basic_drug                       STRING(MAX),          -- ⑨基礎的医薬品
    is_stable_supply_drug               STRING(MAX),          -- ⑩安定確保医薬品
    listing_date                        DATE,                 -- ⑪薬価収載年月日 ※日付以外の記載があったり、空白の場合はNULLにする
    shipping_status                     STRING(MAX),          -- ⑫製造販売業者の「出荷対応」の状況
    status_update_date                  DATE,                 -- ⑬当該品目の⑫の情報を更新した日
    reason                              STRING(MAX),          -- ⑭限定出荷/供給停止の理由
    resolution_estimate                 STRING(MAX),          -- ⑮限定出荷の解除見込み/供給停止の解消見込み
    resolution_or_discontinuation_date  STRING(MAX),          -- ⑯限定出荷の解除見込み/供給停止の解消見込み/販売中止品の在庫消尽時期
    shipment_volume_status              STRING(MAX),          -- ⑰製造販売業者の「出荷量」の現在の状況
    shipment_volume_improvement_date    STRING(MAX),          -- ⑱製造販売業者の「出荷量」の改善（増加）見込み時期
    shipment_volume_improvement_amount  STRING(MAX),          -- ⑲⑱を任意選択した場合の「出荷量」の改善（増加）見込み量
    other_info_update_date              DATE,                 -- ⑳当該品目の⑫以外の情報を更新した日
    is_new                              STRING(MAX),          -- 今回掲載時の更新有無（更新有りの場合、Newと表示）
    -- 管理用項目
    updated_at                          TIMESTAMP NOT NULL 
) PRIMARY KEY (yj_code);