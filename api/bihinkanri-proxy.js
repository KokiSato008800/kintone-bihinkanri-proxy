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
            // データがない場合はエラーレスポンス
            console.log('❌ 製品データが見つかりません');
            return res.status(404).json({
                success: false,
                error: '製品情報が見つかりませんでした',
                errorType: 'ProductNotFound',
                message: `JAN コード ${jan_code} に対応する製品情報がデータベースに存在しません`,
                janCode: jan_code,
                suggestion: '手動で製品情報を入力してください',
                timestamp: new Date().toISOString()
            });
        }
        
        // 実際のデータをそのまま返す（仮データは使用しない）
        const responseData = data;
        
        // 成功レスポンス（仮データ対応）
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
        
        // 実際のAPIエラーを返す（デバッグ用）
        res.status(500).json({
            success: false,
            error: 'API呼び出しエラー',
            errorType: error.name,
            message: error.message,
            janCode: req.query.jan_code,
            timestamp: new Date().toISOString(),
            // フォールバック用モックデータ
            fallbackData: {
                name: `フォールバック製品 (JAN: ${req.query.jan_code})`,
                manufacturer: 'フォールバックメーカー',
                model: `MODEL-${req.query.jan_code?.slice(-4) || '0000'}`,
                keys: [
                    '転送速度: USB 3.0',
                    'ポート数: 4',
                    '重量（g）: 150',
                    '材質: プラスチック',
                    'データ転送方法: USB',
                    'サイズ（外形寸法高さ、幅、長さ）: 10x5x2cm',
                    '表示内容: LED インジケーター'
                ]
            }
        });
    }
} 
