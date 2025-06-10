// Vercel Serverless Function - JANコード製品情報プロキシ
export default async function handler(req, res) {
    // CORS対応ヘッダーを設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Account-ID');
    
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
        
        // 実際のAPIへリクエスト
        const apiResponse = await fetch(`https://api.bihinkanri.cloud/public-prod/spec-forms?jan_code=${encodeURIComponent(jan_code)}`, {
            method: 'GET',
            headers: {
                'Authorization': 'ApiKey_e1dd7831-baea-447f-a047-435dbcd3f26d',
                'X-Account-ID': '3541',
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        
        if (!apiResponse.ok) {
            throw new Error(`API Error: ${apiResponse.status} ${apiResponse.statusText}`);
        }
        
        const data = await apiResponse.json();
        
        console.log(`✅ API応答成功: JAN=${jan_code}`);
        
        // 成功レスポンス
        res.status(200).json({
            success: true,
            janCode: jan_code,
            data: data,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ プロキシエラー:', error);
        
        // エラーレスポンス
        res.status(500).json({
            success: false,
            error: 'API呼び出しエラー',
            message: error.message,
            timestamp: new Date().toISOString(),
            // 開発用にモックデータを返す
            mockData: error.message.includes('fetch') ? {
                name: `モック製品 (JAN: ${req.query.jan_code})`,
                manufacturer: 'モックメーカー',
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
            } : null
        });
    }
} 
