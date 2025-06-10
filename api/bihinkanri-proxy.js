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
        
        console.log(`✅ API応答成功: JAN=${jan_code}`, {
            responseStatus: apiResponse.status,
            dataKeys: Object.keys(data),
            keysLength: data.keys ? data.keys.length : 'keys property not found',
            fullResponse: data
        });
        
        // データが空の場合は仮データを使用
        const hasRealData = data.keys && data.keys.length > 0;
        const responseData = hasRealData ? data : {
            name: `サンプル製品 (JAN: ${jan_code})`,
            manufacturer: "サンプルメーカー",
            model: `MODEL-${jan_code.slice(-4)}`,
            keys: [
                "転送速度: USB 3.0",
                "ポート数: 4ポート",
                "重量（g）: 150",
                "材質: プラスチック",
                "データ転送方法: USB",
                "サイズ（外形寸法高さ、幅、長さ）: 10cm x 5cm x 2cm",
                "表示内容: LED インジケーター",
                "対応OS: Windows, Mac, Linux",
                "電源: USBバスパワー",
                "保証期間: 1年間"
            ]
        };
        
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
