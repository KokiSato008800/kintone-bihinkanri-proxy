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
        
        // より包括的なデータ検出ロジック
        const foundFields = {};
        const possibleFields = [
            'name', 'product_name', 'productName', 'title',
            'manufacturer', 'maker', 'company', 'brand',
            'model', 'model_name', 'modelName', 'model_number',
            'specs', 'specifications', 'spec_data', 'attributes',
            'category', 'description', 'details', 'keys'
        ];
        
        try {
            possibleFields.forEach(field => {
                if (data && data[field] !== undefined && data[field] !== null && data[field] !== '') {
                    foundFields[field] = data[field];
                }
            });
            console.log('🔍 検出されたフィールド:', foundFields);
        } catch (fieldError) {
            console.error('❌ フィールド検出エラー:', fieldError.message);
            console.log('🔍 検出されたフィールド: エラーのため空');
        }
        
        // 実際のAPIデータ構造を直接確認
        let hasProductInfo = false;
        try {
            hasProductInfo = Boolean(
                data && (
                    (data.keys && Array.isArray(data.keys) && data.keys.length > 0) ||
                    data.name || data.product_name || data.productName ||
                    data.manufacturer || data.maker || data.brand ||
                    data.model || data.model_name ||
                    Object.keys(data).length > 2 // 基本的にデータが存在する場合
                )
            );
            
            console.log('📊 データ存在判定:', {
                hasKeys: Boolean(data && data.keys && data.keys.length > 0),
                hasProductName: Boolean(data && (data.name || data.product_name || data.productName)),
                hasManufacturer: Boolean(data && (data.manufacturer || data.maker || data.brand)),
                hasModel: Boolean(data && (data.model || data.model_name)),
                dataKeysCount: data ? Object.keys(data).length : 0,
                hasProductInfo
            });
        } catch (judgeError) {
            console.error('❌ データ存在判定エラー:', judgeError.message);
            hasProductInfo = false;
        }
        
        // 実際のデータを正しい形式に変換
        let productData = null;
        try {
            productData = transformApiData(data);
            console.log('🔄 データ変換結果:', productData);
        } catch (transformError) {
            console.error('❌ データ変換エラー:', transformError.message);
            productData = null;
        }
        
        // 🔍 DEBUG: データ存在判定を一時的にスキップして必ず生データを返す
        console.log('🚨 DEBUG MODE: データ存在判定をスキップして生データを強制返却');
        
        // const hasRealData = hasProductInfo;
        // 
        // if (!hasRealData) {
        //     // データがない場合は仮データを返す（仕様書準拠）
        //     console.log('❌ 製品データが見つかりません - 仮データを返します');
        //     
        //     const mockProductData = {
        //         name: generateMockProductName(jan_code),
        //         manufacturer_name: generateMockManufacturer(jan_code),
        //         model_name: generateMockModel(jan_code),
        //         specs: generateMockSpecs(jan_code)
        //     };
        //     
        //     return res.status(200).json({
        //         success: true,
        //         janCode: jan_code,
        //         data: mockProductData,
        //         dataSource: 'mock',
        //         debug: {
        //             apiStatus: apiResponse?.status || 'no_response',
        //             dataStructure: Object.keys(mockProductData),
        //             hasRealData: false,
        //             usedMockData: true,
        //             note: 'Mock data generated according to API specification'
        //         },
        //         timestamp: new Date().toISOString()
        //     });
        // }
        
        // 🔍 DEBUG: 一時的に生データをそのまま返す
        console.log('🚨 生データを返却します');
        console.log('📊 返却するデータ:', JSON.stringify(data, null, 2));
        
        try {
            const response = {
                success: true,
                janCode: jan_code,
                data: data || {}, // 加工せずに生データを返す（nullの場合は空オブジェクト）
                dataSource: 'api_raw_debug',
                debug: {
                    note: 'This is raw API response for debugging - forced return',
                    dataType: typeof data,
                    topLevelKeys: data ? Object.keys(data) : [],
                    apiStatus: apiResponse.status,
                    hasRealData: true,
                    usedMockData: false,
                    foundFields: foundFields,
                    hasProductInfo: hasProductInfo
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
                usedMockData: true,
                note: 'Mock data generated due to API error'
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
        manufacturer_name: extractValue(apiData, ['manufacturer', 'maker', 'company', 'brand']),
        model_name: extractValue(apiData, ['model', 'model_name', 'modelName', 'model_number']),
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
