/**
 * Shopify Data Mapper
 * Transformiert Shopify-Daten für Datenbank-Import
 */

class ShopifyDataMapper {
  
  /**
   * Mappe Produkte für DB-Import
   */
  static mapProducts(products) {
    return products.map(product => ({
      id: product.id?.toString() || '',
      title: product.title || '',
      handle: product.handle || '',
      description: product.description || product.body_html?.substring(0, 2000) || '',
      vendor: product.vendor || '',
      product_type: product.product_type || '',
      status: product.status || 'active',
      published_at: product.published_at || new Date().toISOString(),
      created_at: product.created_at || new Date().toISOString(),
      updated_at: product.updated_at || new Date().toISOString(),
      tags: Array.isArray(product.tags) ? product.tags.join(', ') : (product.tags || ''),
      template_suffix: product.template_suffix || '',
      // Neue Felder aus getProducts()
      product_id: product.product_id?.toString() || product.id?.toString() || '',
      variant_id: product.variant_id?.toString() || '',
      variant_title: product.variant_title || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      price: product.price ? parseFloat(product.price) : null,
      compare_at_price: product.compare_at_price ? parseFloat(product.compare_at_price) : null,
      weight: product.weight ? parseFloat(product.weight) : null,
      weight_unit: product.weight_unit || 'kg',
      inventory_quantity: product.inventory_quantity ? parseInt(product.inventory_quantity) : 0,
      inventory_management: product.inventory_management || '',
      images_json: product.images_json || JSON.stringify([]),
      main_image: product.main_image || '',
      collections_json: product.collections_json || JSON.stringify([])
    }));
  }

  /**
   * Mappe Bestellungen für DB-Import
   */
  static mapOrders(orders) {
    return orders.map(order => ({
      id: order.id?.toString() || '',
      order_number: order.order_number?.toString() || '',
      email: order.email || '',
      customer_name: order.customer?.first_name + ' ' + order.customer?.last_name || 'Unknown',
      customer_email: order.customer?.email || '',
      total_price: parseFloat(order.total_price) || 0,
      subtotal_price: parseFloat(order.subtotal_price) || 0,
      total_tax: parseFloat(order.total_tax) || 0,
      total_shipping: parseFloat(order.total_shipping_price_set?.shop_money?.amount) || 0,
      currency: order.currency || 'EUR',
      financial_status: order.financial_status || 'pending',
      fulfillment_status: order.fulfillment_status || 'unfulfilled',
      line_items_count: order.line_items?.length || 0,
      note: order.note || '',
      tags: order.tags?.join(', ') || '',
      created_at: order.created_at || new Date().toISOString(),
      updated_at: order.updated_at || new Date().toISOString(),
      confirmed_at: order.confirmed_at || null,
      cancelled_at: order.cancelled_at || null
    }));
  }

  /**
   * Mappe Kunden für DB-Import
   */
  static mapCustomers(customers) {
    return customers.map(customer => ({
      id: customer.id?.toString() || '',
      email: customer.email || '',
      first_name: customer.first_name || '',
      last_name: customer.last_name || '',
      phone: customer.phone || '',
      state: customer.state || '',
      total_spent: parseFloat(customer.total_spent) || 0,
      orders_count: parseInt(customer.orders_count) || 0,
      verified_email: customer.verified_email || false,
      tax_exempt: customer.tax_exempt || false,
      marketing_opt_in: customer.marketing_opt_in_level || '',
      note: customer.note || '',
      created_at: customer.created_at || new Date().toISOString(),
      updated_at: customer.updated_at || new Date().toISOString(),
      address_count: (customer.addresses?.length || 0)
    }));
  }

  /**
   * Mappe Varianten für DB-Import
   */
  static mapVariants(variants, productId) {
    return variants.map(variant => ({
      id: variant.id?.toString() || '',
      product_id: productId?.toString() || variant.product_id?.toString() || '',
      sku: variant.sku || '',
      title: variant.title || '',
      option1: variant.option1 || '',
      option2: variant.option2 || '',
      option3: variant.option3 || '',
      price: parseFloat(variant.price) || 0,
      compare_at_price: variant.compare_at_price ? parseFloat(variant.compare_at_price) : 0,
      cost: variant.cost ? parseFloat(variant.cost) : 0,
      inventory_quantity: parseInt(variant.inventory_quantity) || 0,
      weight: parseFloat(variant.weight) || 0,
      weight_unit: variant.weight_unit || 'kg',
      created_at: variant.created_at || new Date().toISOString(),
      updated_at: variant.updated_at || new Date().toISOString()
    }));
  }

  /**
   * Mappe Fulfillments für DB-Import
   */
  static mapFulfillments(fulfillments, orderId) {
    return fulfillments.map(fulfillment => ({
      id: fulfillment.id?.toString() || '',
      order_id: orderId?.toString() || fulfillment.order_id?.toString() || '',
      status: fulfillment.status || 'pending',
      tracking_company: fulfillment.tracking_info?.company || '',
      tracking_number: fulfillment.tracking_info?.number || '',
      tracking_url: fulfillment.tracking_info?.url || '',
      line_items_count: fulfillment.line_items?.length || 0,
      created_at: fulfillment.created_at || new Date().toISOString(),
      updated_at: fulfillment.updated_at || new Date().toISOString()
    }));
  }

  /**
   * Konvertiere für allgemeinen Datenbank-Import
   */
  static convertForDatabase(dataType, data, extra = {}) {
    switch (dataType) {
      case 'products':
        return this.mapProducts(data);
      case 'orders':
        return this.mapOrders(data);
      case 'customers':
        return this.mapCustomers(data);
      case 'variants':
        return this.mapVariants(data, extra.productId);
      case 'fulfillments':
        return this.mapFulfillments(data, extra.orderId);
      default:
        return data;
    }
  }

  /**
   * Generiere Standard-Tabellenname
   */
  static getTableName(dataType) {
    const prefix = 'shopify_';
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    return `${prefix}${dataType}_${timestamp}`;
  }

  /**
   * Generiere CREATE TABLE Statement
   */
  static getCreateTableSQL(tableName, dataType) {
    const schemas = {
      products: `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          handle TEXT,
          description TEXT,
          vendor TEXT,
          product_type TEXT,
          status TEXT,
          published_at TIMESTAMP,
          created_at TIMESTAMP,
          updated_at TIMESTAMP,
          tags TEXT,
          template_suffix TEXT,
          imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
      orders: `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id TEXT PRIMARY KEY,
          order_number TEXT UNIQUE,
          email TEXT,
          customer_name TEXT,
          customer_email TEXT,
          total_price DECIMAL(10,2),
          subtotal_price DECIMAL(10,2),
          total_tax DECIMAL(10,2),
          total_shipping DECIMAL(10,2),
          currency TEXT,
          financial_status TEXT,
          fulfillment_status TEXT,
          line_items_count INTEGER,
          note TEXT,
          tags TEXT,
          created_at TIMESTAMP,
          updated_at TIMESTAMP,
          confirmed_at TIMESTAMP,
          cancelled_at TIMESTAMP,
          imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
      customers: `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE,
          first_name TEXT,
          last_name TEXT,
          phone TEXT,
          state TEXT,
          total_spent DECIMAL(10,2),
          orders_count INTEGER,
          verified_email BOOLEAN,
          tax_exempt BOOLEAN,
          marketing_opt_in TEXT,
          note TEXT,
          created_at TIMESTAMP,
          updated_at TIMESTAMP,
          address_count INTEGER,
          imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
      variants: `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL,
          sku TEXT UNIQUE,
          title TEXT,
          option1 TEXT,
          option2 TEXT,
          option3 TEXT,
          price DECIMAL(10,2),
          compare_at_price DECIMAL(10,2),
          cost DECIMAL(10,2),
          inventory_quantity INTEGER,
          weight DECIMAL(10,2),
          weight_unit TEXT,
          created_at TIMESTAMP,
          updated_at TIMESTAMP,
          imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
      fulfillments: `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          status TEXT,
          tracking_company TEXT,
          tracking_number TEXT,
          tracking_url TEXT,
          line_items_count INTEGER,
          created_at TIMESTAMP,
          updated_at TIMESTAMP,
          imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `
    };

    return schemas[dataType] || null;
  }
}

module.exports = ShopifyDataMapper;
