const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Cache
let priceCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 dakika

function isCacheValid() {
  if (!priceCache || !cacheTimestamp) return false;
  return (Date.now() - cacheTimestamp) < CACHE_DURATION;
}

// Döviz.com API
async function fetchFromDovizCom() {
  try {
    console.log('📡 Döviz.com...');
    
    const response = await axios.get(
      'https://www.doviz.com/api/v1/golds',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        timeout: 10000,
      }
    );

    if (response.status === 200 && response.data) {
      const data = response.data;
      
      const parsePrice = (key) => {
        if (!data[key]) return 0;
        const price = data[key].selling || data[key].buying || 0;
        return parseFloat(String(price).replace(',', '.'));
      };

      const prices = {
        gram: parsePrice('gram-altin'),
        ceyrek: parsePrice('ceyrek-altin'),
        yarim: parsePrice('yarim-altin'),
        tam: parsePrice('tam-altin'),
        ons: parsePrice('ons'),
      };

      if (prices.gram > 5000 && prices.gram < 7000) {
        return { ...prices, source: 'doviz.com' };
      }
    }
  } catch (error) {
    console.log('⚠️ Döviz.com hatası:', error.message);
  }
  return null;
}

// API endpoint
app.get('/api/gold', async (req, res) => {
  try {
    console.log('🔥 İstek alındı');

    let priceData;

    if (isCacheValid()) {
      console.log('✅ Cache');
      priceData = priceCache;
    } else {
      console.log('🔄 API çağrılıyor...');
      
      priceData = await fetchFromDovizCom();
      
      if (!priceData || priceData.gram < 5000) {
        console.log('⚠️ Fallback');
        priceData = {
          gram: 5547.49,
          ceyrek: 8876.0,
          yarim: 17752.0,
          tam: 35504.0,
          ons: 172552.0,
          source: 'fallback',
        };
      }
      
      priceCache = priceData;
      cacheTimestamp = Date.now();
    }

    res.json({
      success: true,
      source: priceData.source,
      data: {
        gram: parseFloat(priceData.gram.toFixed(2)),
        ceyrek: parseFloat(priceData.ceyrek.toFixed(2)),
        yarim: parseFloat(priceData.yarim.toFixed(2)),
        tam: parseFloat(priceData.tam.toFixed(2)),
        ons: parseFloat(priceData.ons.toFixed(2)),
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ Hata:', error.message);
    
    res.json({
      success: true,
      source: 'fallback',
      data: {
        gram: 5547.49,
        ceyrek: 8876.0,
        yarim: 17752.0,
        tam: 35504.0,
        ons: 172552.0,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
