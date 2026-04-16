/**
 * Shopify API Modul
 * Client Credentials Grant Flow (für Apps nach 01.01.2026)
 * REST API Integration
 */

const axios = require('axios');

class ShopifyAPI {
  constructor(config) {
    // config kann sein: dbApi (legacy) oder { clientId, clientSecret, dbApi }
    if (config.dbApi) {
      // Neue Form: { clientId, clientSecret, dbApi }
      this.dbApi = config.dbApi;
      this.clientId = config.clientId;
      this.clientSecret = config.clientSecret;
    } else {
      // Legacy: wird dbApi direkt übergeben (für backward compatibility)
      this.dbApi = config;
      this.clientId = null;
      this.clientSecret = null;
    }
    
    this.accessToken = null;
    this.store = null;
    this.apiVersion = '2024-01';
    this.baseUrl = null;
  }

  /**
   * Registriere Shopify Config
   */
  async registerShopify(config) {
    console.log('[Shopify] Registriere Shopify API...');
    if (!config.clientId || !config.clientSecret) {
      throw new Error('Client ID und Client Secret erforderlich');
    }
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    
    // Versuche gespeicherte Tokens zu laden
    await this.restoreStoredTokens();
    return true;
  }

  /**
   * Anforderung für Access Token (Client Credentials Grant Flow)
   */
  async requestAccessToken(store) {
    this.store = store.toLowerCase().replace(/\s+/g, '').replace(/\.myshopify\.com$/i, '');
    
    try {
      console.log('[Shopify] Fordere Access Token an für Store:', this.store);
      
      const response = await axios.post(
        `https://${this.store}.myshopify.com/admin/oauth/access_token`,
        {
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret
        }
      );

      this.accessToken = response.data.access_token;
      this.baseUrl = `https://${this.store}.myshopify.com/admin/api/${this.apiVersion}`;
      
      console.log('[Shopify] ✅ Access Token erhalten');
      
      // Speichere Token
      await this._saveToken();
      
      return { ok: true, store: this.store };
    } catch (error) {
      console.error('[Shopify] ❌ Token-Fehler:', error.response?.data || error.message);
      throw new Error(`Shopify Token-Fehler: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Lade gespeicherte Tokens
   */
  async restoreStoredTokens() {
    try {
      const stored = this.dbApi.getApiKey('shopify');
      if (!stored) {
        console.log('[Shopify] ⚠ Kein gespeicherter Token');
        return;
      }
      
      let tokenData = stored;
      try {
        tokenData = JSON.parse(stored);
      } catch {
        // Fallback: nur ein Token, keine Store-Info
        this.accessToken = stored;
        return;
      }

      this.accessToken = tokenData.access_token;
      this.store = tokenData.store;
      
      if (this.store) {
        this.baseUrl = `https://${this.store}.myshopify.com/admin/api/${this.apiVersion}`;
      }
      
      console.log('[Shopify] ✅ Gespeicherte Tokens geladen');
    } catch (error) {
      console.log('[Shopify] ⚠ Token restore fehlgeschlagen:', error.message);
    }
  }

  /**
   * Speichere Token in DB
   */
  async _saveToken() {
    try {
      const tokenData = {
        access_token: this.accessToken,
        store: this.store,
      };
      
      this.dbApi.saveApiKey('shopify', JSON.stringify(tokenData));
      console.log('[Shopify] ✅ Tokens gespeichert');
    } catch (error) {
      console.error('[Shopify] ⚠ Token speichern fehlgeschlagen:', error.message);
    }
  }

  /**
   * API Request
   */
  async _request(endpoint, options = {}) {
    if (!this.accessToken || !this.baseUrl) {
      throw new Error('Nicht authentifiziert');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'X-Shopify-Access-Token': this.accessToken,
      'Content-Type': 'application/json'
    };

    try {
      const config = {
        url,
        headers,
        ...options
      };

      const response = await axios(config);
      console.log('[Shopify] ✅ API erfolgreich angerufen');
      return response.data;
    } catch (error) {
      console.error('[Shopify] ❌ API-Fehler:', error.response?.data || error.message);
      throw new Error(`Shopify API-Fehler: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  /**
   * Hole Produkte mit ALLEN Details (Varianten, Bilder, Collections)
   */
  async getProducts(limit = 250) {
    console.log('[Shopify] Lade Produkte mit vollständigen Details...');
    
    // KEINE fields limitation - holt alles: variants, images, collections, etc.
    const params = new URLSearchParams({
      limit,
      status: 'active'
    });

    const data = await this._request(`/products.json?${params}`);
    
    const products = data.products || [];
    console.log(`[Shopify] ${products.length} Produkte geladen`);
    
    // Flachschlag: Für jede Variante eine Zeile, mit Produkt + Variant-Info
    const rows = [];
    for (const product of products) {
      const variants = product.variants || [];
      
      if (variants.length === 0) {
        // Produkt ohne Varianten - eine Zeile mit Basisinfos
        rows.push({
          product_id: product.id?.toString() || '',
          title: product.title,
          handle: product.handle,
          description: product.body_html?.replace(/<[^>]*>/g, '') || '',
          vendor: product.vendor,
          product_type: product.product_type,
          status: product.status,
          published_at: product.published_at,
          created_at: product.created_at,
          updated_at: product.updated_at,
          tags: product.tags,
          template_suffix: product.template_suffix,
          // Variant-Infos (leer wenn keine Variante)
          variant_id: null,
          variant_title: null,
          sku: null,
          barcode: null,
          price: null,
          compare_at_price: null,
          weight: null,
          weight_unit: null,
          inventory_quantity: null,
          inventory_management: null,
          // Images
          images_json: JSON.stringify(product.images || []),
          main_image: product.featured_image?.src || null,
          // Collections (als JSON, da dynamisch)
          collections_json: JSON.stringify([])
        });
      } else {
        // Eine Zeile pro Variante mit Produkt + Variant-Daten
        for (const variant of variants) {
          rows.push({
            product_id: product.id?.toString() || '',
            title: product.title,
            handle: product.handle,
            description: product.body_html?.replace(/<[^>]*>/g, '') || '',
            vendor: product.vendor,
            product_type: product.product_type,
            status: product.status,
            published_at: product.published_at,
            created_at: product.created_at,
            updated_at: product.updated_at,
            tags: product.tags,
            template_suffix: product.template_suffix,
            // Variant-Infos
            variant_id: variant.id?.toString() || '',
            variant_title: variant.title,
            sku: variant.sku,
            barcode: variant.barcode,
            price: variant.price,
            compare_at_price: variant.compare_at_price,
            weight: variant.weight,
            weight_unit: variant.weight_unit,
            inventory_quantity: variant.inventory_quantity,
            inventory_management: variant.inventory_management,
            // Images
            images_json: JSON.stringify(product.images || []),
            main_image: product.featured_image?.src || null,
            // Collections (als JSON)
            collections_json: JSON.stringify([])
          });
        }
      }
    }
    
    console.log(`[Shopify] ${rows.length} Zeilen exportiert (Produkte + Varianten)`);
    
    return {
      ok: true,
      dataType: 'products',
      count: rows.length,
      rows: rows,
      schema: {
        // Produkt-Felder
        product_id: 'text',  // Shopify IDs sind 64-bit, zu groß für integer
        title: 'string',
        handle: 'string',
        description: 'text',
        vendor: 'string',
        product_type: 'string',
        status: 'string',
        published_at: 'timestamp',
        created_at: 'timestamp',
        updated_at: 'timestamp',
        tags: 'string',
        template_suffix: 'string',
        // Variant-Felder
        variant_id: 'text',  // Shopify IDs sind 64-bit, zu groß für integer
        variant_title: 'string',
        sku: 'string',
        barcode: 'string',
        price: 'decimal',
        compare_at_price: 'decimal',
        weight: 'decimal',
        weight_unit: 'string',
        inventory_quantity: 'integer',
        inventory_management: 'string',
        // Media
        images_json: 'json',
        main_image: 'string',
        collections_json: 'json'
      }
    };
  }

  /**
   * Hole Bestellungen
   */
  async getOrders(limit = 250, status = 'any') {
    console.log('[Shopify] Lade Bestellungen...');
    
    const params = new URLSearchParams({
      limit,
      status,
      fields: 'id,order_number,created_at,updated_at,total_price,currency,financial_status,fulfillment_status,customer'
    });

    const data = await this._request(`/orders.json?${params}`);
    
    const orders = data.orders || [];
    console.log(`[Shopify] ${orders.length} Bestellungen geladen`);
    
    return {
      ok: true,
      dataType: 'orders',
      count: orders.length,
      rows: orders,
      schema: {
        id: 'string',
        order_number: 'string',
        created_at: 'timestamp',
        total_price: 'number',
        financial_status: 'string',
        fulfillment_status: 'string'
      }
    };
  }

  /**
   * Hole Kunden
   */
  async getCustomers(limit = 250) {
    console.log('[Shopify] Lade Kunden...');
    
    const params = new URLSearchParams({
      limit,
      fields: 'id,email,first_name,last_name,created_at,updated_at,total_spent,orders_count'
    });

    const data = await this._request(`/customers.json?${params}`);
    
    const customers = data.customers || [];
    console.log(`[Shopify] ${customers.length} Kunden geladen`);
    
    return {
      ok: true,
      dataType: 'customers',
      count: customers.length,
      rows: customers,
      schema: {
        id: 'string',
        email: 'string',
        first_name: 'string',
        last_name: 'string',
        total_spent: 'number',
        orders_count: 'number'
      }
    };
  }

  /**
   * Hole Shop-Informationen
   */
  async getShopInfo() {
    console.log('[Shopify] Lade Shop-Info...');
    
    const data = await this._request('/shop.json');
    const shop = data.shop;
    
    console.log('[Shopify] Shop-Info geladen:', shop.name);
    
    return {
      ok: true,
      shop: {
        id: shop.id,
        name: shop.name,
        email: shop.email,
        country: shop.country_code,
        currency: shop.currency,
        timezone: shop.timezone,
        created_at: shop.created_at,
        updated_at: shop.updated_at
      }
    };
  }

  /**
   * Hole Bestand pro Produkt
   */
  async getProductVariants(productId, limit = 250) {
    console.log('[Shopify] Lade Varianten für Produkt:', productId);
    
    const params = new URLSearchParams({
      limit,
      fields: 'id,product_id,sku,title,price,inventory_quantity'
    });

    const data = await this._request(`/products/${productId}/variants.json?${params}`);
    const variants = data.variants || [];
    
    console.log(`[Shopify] ${variants.length} Varianten geladen`);
    
    return {
      ok: true,
      count: variants.length,
      rows: variants
    };
  }

  /**
   * Hole Fulfillments
   */
  async getFulfillments(orderId) {
    console.log('[Shopify] Lade Fulfillments für Order:', orderId);
    
    const data = await this._request(`/orders/${orderId}/fulfillments.json`);
    const fulfillments = data.fulfillments || [];
    
    return {
      ok: true,
      count: fulfillments.length,
      rows: fulfillments
    };
  }
}

module.exports = ShopifyAPI;
