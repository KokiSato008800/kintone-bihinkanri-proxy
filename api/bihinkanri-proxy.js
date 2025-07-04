// Vercel Serverless Function - JANコード製品情報プロキシ
export default async function handler(req, res) {
    // CORS対応ヘッダーを設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-KEY, ACCOUNT_ID');
    
    // OPTIONSリクエスト（プリフライト）の処理
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // GETリクエストのみ許可
    if (req.method !== 'GET') {
        return res.status(405).json({ 
            error: 'Method not allowed',
            allowedMethods: ['GET'] 
        });
    }
    
    try {
        const { jan_code } = req.query;
        
        // JANコードの検証
        if (!jan_code) {
            return res.status(400).json({ 
                error: 'JANコードが必要です',
                usage: '?jan_code=4901234567890' 
            });
        }
        
        // JANコード形式の簡易チェック
        const cleanJanCode = jan_code.replace(/\D/g, '');
        if (cleanJanCode.length !== 8 && cleanJanCode.length !== 13) {
            return res.status(400).json({ 
                error: 'JANコードは8桁または13桁の数字である必要があります',
                received: jan_code 
            });
        }
        
        console.log(`📡 プロキシ経由でAPI呼び出し: JAN=${jan_code}`);
        
        // 実際のAPIへリクエスト（タイムアウト制御付き）
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const apiResponse = await fetch(`https://api.bihinkanri.cloud/public-test/spec-forms?jan_cd=${encodeURIComponent(jan_code)}`, {
            method: 'GET',
            headers: {
                'X-API-KEY': 'ApiKey_e1dd7831-baea-447f-a047-435dbcd3f26d',
                'ACCOUNT_ID': '3541',
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!apiResponse.ok) {
            throw new Error(`API Error: ${apiResponse.status} ${apiResponse.statusText}`);
        }
        
        let data;
        try {
            data = await apiResponse.json();
            console.log(`✅ API応答成功: JAN=${jan_code}`);
            console.log('📊 ===== 加工前の生データ =====');
            console.log('Raw API Response:', JSON.stringify(data, null, 2));
            console.log('Data type:', typeof data);
            console.log('Top level keys:', data ? Object.keys(data) : 'null');
            console.log('data.keys exists:', !!data.keys);
            console.log('data.keys type:', typeof data.keys);
            console.log('data.keys value:', data.keys);
            console.log('===== 生データ確認終了 =====');
        } catch (jsonError) {
            console.error('❌ JSON解析エラー:', jsonError.message);
            throw new Error(`JSON parsing failed: ${jsonError.message}`);
        }
        
        // より包括的なデータ検出ロジック（配列対応）
        const foundFields = {};
        const possibleFields = [
            'name', 'product_name', 'productName', 'title',
            'manufacturer_name', 'manufacturer', 'maker', 'company', 'brand',
            'model_name', 'model', 'modelName', 'model_number',
            'specs', 'specifications', 'spec_data', 'attributes',
            'category', 'description', 'details', 'keys'
        ];
        
        try {
            // データが配列の場合は最初の要素をチェック
            const targetData = Array.isArray(data) && data.length > 0 ? data[0] : data;
            
            possibleFields.forEach(field => {
                if (targetData && targetData[field] !== undefined && targetData[field] !== null && targetData[field] !== '') {
                    foundFields[field] = targetData[field];
                }
            });
            console.log('🔍 検出されたフィールド:', foundFields);
            console.log('📊 データ形式:', Array.isArray(data) ? '配列' : 'オブジェクト');
            if (Array.isArray(data)) {
                console.log('📊 配列長:', data.length);
                console.log('📊 最初の要素:', JSON.stringify(data[0], null, 2));
            }
        } catch (fieldError) {
            console.error('❌ フィールド検出エラー:', fieldError.message);
            console.log('🔍 検出されたフィールド: エラーのため空');
        }
        
        // 実際のAPIデータ構造を直接確認（配列対応）
        let hasProductInfo = false;
        try {
            // データが配列の場合は最初の要素をチェック
            const targetData = Array.isArray(data) && data.length > 0 ? data[0] : data;
            
            hasProductInfo = Boolean(
                targetData && (
                    (targetData.keys && Array.isArray(targetData.keys) && targetData.keys.length > 0) ||
                    targetData.name || targetData.product_name || targetData.productName ||
                    targetData.manufacturer_name || targetData.manufacturer || targetData.maker || targetData.brand ||
                    targetData.model_name || targetData.model ||
                    Object.keys(targetData).length > 2 // 基本的にデータが存在する場合
                )
            );
            
            console.log('📊 データ存在判定:', {
                isArray: Array.isArray(data),
                arrayLength: Array.isArray(data) ? data.length : 'not_array',
                hasKeys: Boolean(targetData && targetData.keys && targetData.keys.length > 0),
                hasProductName: Boolean(targetData && (targetData.name || targetData.product_name || targetData.productName)),
                hasManufacturer: Boolean(targetData && (targetData.manufacturer_name || targetData.manufacturer || targetData.maker || targetData.brand)),
                hasModel: Boolean(targetData && (targetData.model_name || targetData.model)),
                dataKeysCount: targetData ? Object.keys(targetData).length : 0,
                hasProductInfo
            });
        } catch (judgeError) {
            console.error('❌ データ存在判定エラー:', judgeError.message);
            hasProductInfo = false;
        }
        
        // 実際のデータを正しい形式に変換（配列対応）
        let productData = null;
        try {
            // データが配列の場合は最初の要素を使用
            const targetData = Array.isArray(data) && data.length > 0 ? data[0] : data;
            productData = transformApiData(targetData);
            console.log('🔄 データ変換結果:', productData);
        } catch (transformError) {
            console.error('❌ データ変換エラー:', transformError.message);
            productData = null;
        }
        
        // 🔍 実際のデータ存在判定に基づく処理
        const hasRealData = hasProductInfo;
        
        if (!hasRealData) {
            // データがない場合は「見つからない」レスポンスを返す
            console.log('❌ 製品データが見つかりません - 見つからない旨を返します');
            
            return res.status(200).json({
                success: false,
                janCode: jan_code,
                data: null,
                dataSource: 'api_no_data',
                error: {
                    type: 'ProductNotFound',
                    message: `JANコード「${jan_code}」の製品情報が見つかりませんでした`,
                    suggestion: '手動で製品情報を入力してください'
                },
                debug: {
                    apiStatus: apiResponse?.status || 'no_response',
                    hasRealData: false,
                    usedMockData: false,
                    foundFields: foundFields,
                    hasProductInfo: hasProductInfo,
                    note: 'No product data found in API response'
                },
                timestamp: new Date().toISOString()
            });
        }
        
        // ✅ 実際のデータを正しい形式で返却
        console.log('✅ 製品データが見つかりました - 変換して返却します');
        console.log('📊 変換前データ:', JSON.stringify(data, null, 2));
        
        try {
            // データが配列の場合は最初の要素を使用、そうでなければそのまま
            const targetData = Array.isArray(data) && data.length > 0 ? data[0] : data;
            
            // 統一形式に変換
            const transformedData = transformApiData(targetData);
            
            const response = {
                success: true,
                janCode: jan_code,
                data: transformedData,
                dataSource: 'api_real_data',
                debug: {
                    originalDataType: typeof data,
                    isArray: Array.isArray(data),
                    arrayLength: Array.isArray(data) ? data.length : 'not_array',
                    apiStatus: apiResponse.status,
                    hasRealData: true,
                    usedMockData: false,
                    foundFields: foundFields,
                    transformedFields: Object.keys(transformedData)
                },
                timestamp: new Date().toISOString()
            };
            
            console.log('📤 最終レスポンス:', JSON.stringify(response, null, 2));
            res.status(200).json(response);
        } catch (responseError) {
            console.error('❌ レスポンス生成エラー:', responseError.message);
            throw responseError;
        }
        
    } catch (error) {
        console.error('❌ プロキシエラー:', error.name, error.message);
        
        // エラーの詳細をログ出力
        if (error.name === 'AbortError') {
            console.log('⏰ タイムアウトエラー: 10秒以内にAPIから応答がありませんでした');
        } else if (error.message.includes('fetch')) {
            console.log('🌐 ネットワークエラー: 外部APIへの接続に失敗しました');
        }
        
        // エラー時は仮データを返す（仕様書準拠）
        console.log('🔄 エラー時のフォールバック: 仮データを返します');
        
        const mockProductData = {
            name: generateMockProductName(req.query.jan_code),
            manufacturer_name: generateMockManufacturer(req.query.jan_code),
            model_name: generateMockModel(req.query.jan_code),
            specs: generateMockSpecs(req.query.jan_code)
        };
        
        res.status(200).json({
            success: true,
            janCode: req.query.jan_code,
            data: mockProductData,
            dataSource: 'mock_fallback',
            debug: {
                originalError: error.message,
                errorType: error.name,
                hasRealData: false,
                usedMockData: true
            },
            timestamp: new Date().toISOString()
        });
    }
}

// 実際のAPIデータを統一形式に変換
function transformApiData(apiData) {
    console.log('🔄 APIデータ変換開始:', apiData);
    
    const transformed = {
        name: extractValue(apiData, ['name', 'product_name', 'productName', 'title']),
        manufacturer_name: extractValue(apiData, ['manufacturer_name', 'manufacturer', 'maker', 'company', 'brand']),
        model_name: extractValue(apiData, ['model_name', 'model', 'modelName', 'model_number']),
        specs: extractSpecs(apiData)
    };
    
    console.log('✅ APIデータ変換完了:', transformed);
    return transformed;
}

// フィールド値抽出ヘルパー
function extractValue(data, candidates) {
    for (const candidate of candidates) {
        const value = data[candidate];
        if (value && typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return null;
}

// スペック情報抽出・変換
function extractSpecs(data) {
    // 1. specsオブジェクトがある場合
    if (data.specs && typeof data.specs === 'object') {
        return data.specs;
    }
    
    // 2. keysが配列の場合、オブジェクトに変換
    if (data.keys && Array.isArray(data.keys)) {
        const specs = {};
        data.keys.forEach((key, index) => {
            if (typeof key === 'string' && key.trim()) {
                specs[`項目${index + 1}`] = key.trim();
            }
        });
        return Object.keys(specs).length > 0 ? specs : null;
    }
    
    // 3. その他のフィールドからスペック情報を構築
    const specFields = ['specifications', 'spec_data', 'attributes', 'details'];
    for (const field of specFields) {
        if (data[field]) {
            if (typeof data[field] === 'object') {
                return data[field];
            } else if (typeof data[field] === 'string') {
                return { '詳細': data[field] };
            }
        }
    }
    
    // 4. 全体のデータからスペック系フィールドを抽出
    const specs = {};
    Object.keys(data).forEach(key => {
        const value = data[key];
        // 基本情報以外をスペックとして扱う
        if (!['name', 'manufacturer', 'model', 'keys'].includes(key) && 
            value && typeof value === 'string' && value.trim()) {
            specs[key] = value.trim();
        }
    });
    
    return Object.keys(specs).length > 0 ? specs : null;
}

// 仮データ生成関数群
function generateMockProductName(janCode) {
    const productTypes = [
        'モニター', 'キーボード', 'マウス', 'スピーカー', 'ヘッドフォン',
        'ウェブカメラ', 'USBハブ', '外付けHDD', 'SDカード', 'LANケーブル'
    ];
    
    const brands = ['PRO', 'ULTRA', 'MAX', 'LITE', 'MINI'];
    const numbers = janCode.slice(-4);
    
    const productType = productTypes[parseInt(janCode[0]) % productTypes.length];
    const brand = brands[parseInt(janCode[1]) % brands.length];
    
    return `${productType} ${brand}-${numbers}`;
}

function generateMockManufacturer(janCode) {
    const manufacturers = [
        'LGエレクトロニクス', 'サムスン', 'ASUS', 'ロジクール', 'エレコム',
        'バッファロー', 'アイ・オー・データ', 'ソニー', 'パナソニック', 'フィリップス'
    ];
    
    return manufacturers[parseInt(janCode[2]) % manufacturers.length];
}

function generateMockModel(janCode) {
    const series = ['WL', 'UL', 'GL', 'BL', 'ML'];
    const numbers = janCode.slice(-6, -2);
    const suffix = ['B', 'W', 'S', 'G', 'R'];
    
    const seriesName = series[parseInt(janCode[3]) % series.length];
    const suffixChar = suffix[parseInt(janCode[4]) % suffix.length];
    
    return `${numbers}${seriesName}-${suffixChar}`;
}

function generateMockSpecs(janCode) {
    // JANコードに基づいて一貫した仕様を生成
    const lastDigit = parseInt(janCode.slice(-1));
    const secondLastDigit = parseInt(janCode.slice(-2, -1));
    
    // モニター系の仕様例
    if (lastDigit % 3 === 0) {
        return {
            "画面サイズ": `${20 + (lastDigit % 15)}インチ`,
            "解像度": lastDigit > 5 ? "2560×1080" : "1920×1080",
            "リフレッシュレート": `${60 + (secondLastDigit * 15)}Hz`,
            "接続端子": "HDMI, DisplayPort, USB-C",
            "消費電力": `${30 + (lastDigit * 5)}W`,
            "重量": `${3 + (lastDigit * 0.5)}kg`
        };
    }
    // 周辺機器系の仕様例
    else if (lastDigit % 3 === 1) {
        return {
            "接続方式": lastDigit > 5 ? "無線2.4GHz" : "有線USB",
            "DPI": `${800 + (secondLastDigit * 400)}`,
            "ボタン数": `${3 + (lastDigit % 5)}`,
            "バッテリー": lastDigit > 5 ? "単3電池×2" : "内蔵リチウム",
            "重量": `${80 + (lastDigit * 10)}g`,
            "保証期間": "1年"
        };
    }
    // ストレージ系の仕様例
    else {
        return {
            "容量": `${Math.pow(2, 8 + (lastDigit % 4))}GB`,
            "インターフェース": "USB 3.0",
            "転送速度": `最大${100 + (secondLastDigit * 50)}MB/s`,
            "フォーマット": "FAT32",
            "対応OS": "Windows, macOS, Linux",
            "耐久性": "防水・防塵 IP67"
        };
    }
} 
