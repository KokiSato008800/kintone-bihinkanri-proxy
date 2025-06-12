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
        
        const data = await apiResponse.json();
        
        console.log(`✅ API応答成功: JAN=${jan_code}`);
        console.log('📊 完全なAPIレスポンス:', JSON.stringify(data, null, 2));
        console.log('🔍 レスポンス構造分析:', {
            responseType: typeof data,
            topLevelKeys: Object.keys(data),
            hasKeys: Boolean(data.keys),
            keysLength: data.keys ? data.keys.length : 0,
            keysType: data.keys ? typeof data.keys : 'undefined',
            keysIsArray: Array.isArray(data.keys),
            firstFewKeys: data.keys ? data.keys.slice(0, 5) : [],
        });
        
        // 他の可能なフィールドもチェック
        const possibleFields = [
            'name', 'product_name', 'productName', 'title',
            'manufacturer', 'maker', 'company', 'brand',
            'model', 'model_name', 'modelName', 'model_number',
            'specs', 'specifications', 'spec_data', 'attributes',
            'category', 'description', 'details'
        ];
        
        const foundFields = {};
        possibleFields.forEach(field => {
            if (data[field] !== undefined) {
                foundFields[field] = data[field];
            }
        });
        
        console.log('🔍 検出されたフィールド:', foundFields);
        
        // データの有無を正確に判定
        const hasRealData = (data.keys && data.keys.length > 0) || Object.keys(foundFields).length > 0;
        
        if (!hasRealData) {
            // データがない場合は仮データを返す（仕様書準拠）
            console.log('❌ 製品データが見つかりません - 仮データを返します');
            
            const mockProductData = {
                name: generateMockProductName(jan_code),
                manufacturer_name: generateMockManufacturer(jan_code),
                model_name: generateMockModel(jan_code),
                specs: generateMockSpecs(jan_code)
            };
            
            return res.status(200).json({
                success: true,
                janCode: jan_code,
                data: mockProductData,
                dataSource: 'mock',
                debug: {
                    apiStatus: apiResponse?.status || 'no_response',
                    dataStructure: Object.keys(mockProductData),
                    hasRealData: false,
                    usedMockData: true,
                    note: 'Mock data generated according to API specification'
                },
                timestamp: new Date().toISOString()
            });
        }
        
        // 実際のデータをそのまま返す
        const responseData = data;
        
        // 成功レスポンス
        res.status(200).json({
            success: true,
            janCode: jan_code,
            data: responseData,
            dataSource: hasRealData ? 'api' : 'mock',
            debug: {
                apiStatus: apiResponse.status,
                dataStructure: Object.keys(data),
                keysCount: data.keys ? data.keys.length : 0,
                hasRealData: hasRealData,
                usedMockData: !hasRealData
            },
            timestamp: new Date().toISOString()
        });
        
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
