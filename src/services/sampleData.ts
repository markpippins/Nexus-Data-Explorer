import { DBConnection, SchemaObject } from '../types/database';

export const INITIAL_CONNECTIONS: DBConnection[] = [
  {
    id: 'conn-ecommerce-prod',
    name: 'ecommerce_prod (PG 16.2)',
    engine: 'postgres',
    host: 'db-us-east1.internal.cloud.net',
    port: 5432,
    database: 'ecommerce_main',
    username: 'pg_admin',
    ssl: true,
    color: '#3b82f6', // Blue
    status: 'connected',
    isSample: true,
    createdAt: '2026-01-15T08:00:00Z',
  },
  {
    id: 'conn-financial-ledger',
    name: 'finance_ledger (PG 15.4)',
    engine: 'postgres',
    host: 'fin-db.internal.cloud.net',
    port: 5432,
    database: 'financial_ledger',
    username: 'ledger_service',
    ssl: true,
    color: '#10b981', // Emerald Green
    status: 'connected',
    isSample: true,
    createdAt: '2026-02-01T10:30:00Z',
  },
  {
    id: 'conn-saas-analytics',
    name: 'saas_analytics (PG 16.0)',
    engine: 'postgres',
    host: 'analytics-primary.cloud.net',
    port: 5432,
    database: 'telemetry_db',
    username: 'data_analyst',
    ssl: true,
    color: '#8b5cf6', // Purple
    status: 'connected',
    isSample: true,
    createdAt: '2026-03-10T14:20:00Z',
  },
];

export const SHRAPNEL_SCHEMA: SchemaObject = {
  name: 'shrapnel',
  category: 'shrapnel',
  comment: 'Relational Object Store / Entity-Attribute-Value (EAV) system backed by PostgreSQL',
  tables: [
    {
      name: 'field_type',
      schema: 'shrapnel',
      rowCount: 7,
      comment: 'Type registry (1 Long, 2 String, 3 Double, 4 Boolean, 5 Timestamp, 6 JSONB, 7 UUID)',
      columns: [
        { name: 'code', type: 'INT', isPrimaryKey: true, isNullable: false },
        { name: 'name', type: 'VARCHAR(50)', isNullable: false },
        { name: 'description', type: 'TEXT', isNullable: true },
        { name: 'pg_type', type: 'VARCHAR(50)', isNullable: false },
      ],
      data: [
        { code: 1, name: 'Long', description: '64-bit integer', pg_type: 'bigint' },
        { code: 2, name: 'String', description: 'Variable text', pg_type: 'text' },
        { code: 3, name: 'Double', description: 'Double precision floating point', pg_type: 'double precision' },
        { code: 4, name: 'Boolean', description: 'True/false boolean', pg_type: 'boolean' },
        { code: 5, name: 'Timestamp', description: 'Date and time with time zone', pg_type: 'timestamptz' },
        { code: 6, name: 'JSONB', description: 'Binary JSON object or array', pg_type: 'jsonb' },
        { code: 7, name: 'UUID', description: 'Universally unique identifier', pg_type: 'uuid' },
      ],
    },
    {
      name: 'field',
      schema: 'shrapnel',
      rowCount: 6,
      comment: 'Attribute definitions and unique property_name keys',
      columns: [
        { name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false },
        { name: 'property_name', type: 'VARCHAR(100)', isNullable: false },
        { name: 'name', type: 'VARCHAR(100)', isNullable: false },
        { name: 'label', type: 'VARCHAR(100)', isNullable: true },
        { name: 'field_type_code', type: 'INT', isNullable: false, isForeignKey: true, referencesTable: 'field_type', referencesColumn: 'code' },
        { name: 'is_calculated', type: 'BOOLEAN', isNullable: false, defaultValue: 'false' },
        { name: 'field_index', type: 'INT', isNullable: false, defaultValue: '0' },
        { name: 'created_at', type: 'TIMESTAMP', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      ],
      indexes: [
        { name: 'idx_field_property_name', columns: ['property_name'], isUnique: true }
      ],
      data: [
        { id: 1, property_name: 'full_name', name: 'Full Name', label: 'Customer Full Name', field_type_code: 2, is_calculated: false, field_index: 1, created_at: '2026-07-29 12:00:00' },
        { id: 2, property_name: 'user_age', name: 'Age', label: 'User Age', field_type_code: 1, is_calculated: false, field_index: 2, created_at: '2026-07-29 12:00:00' },
        { id: 3, property_name: 'is_active', name: 'Active Flag', label: 'Account Active', field_type_code: 4, is_calculated: false, field_index: 3, created_at: '2026-07-29 12:00:00' },
        { id: 4, property_name: 'credit_score', name: 'Score', label: 'Credit Rating', field_type_code: 3, is_calculated: false, field_index: 4, created_at: '2026-07-29 12:00:00' },
        { id: 5, property_name: 'last_login', name: 'Last Login', label: 'Timestamp of last access', field_type_code: 5, is_calculated: false, field_index: 5, created_at: '2026-07-29 12:00:00' },
        { id: 6, property_name: 'metadata', name: 'System Meta', label: 'JSON Metadata payload', field_type_code: 6, is_calculated: false, field_index: 6, created_at: '2026-07-29 12:00:00' },
      ],
    },
    {
      name: 'object_instance',
      schema: 'shrapnel',
      rowCount: 3,
      comment: 'Concrete entity object instances',
      columns: [
        { name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false },
        { name: 'created_at', type: 'TIMESTAMP', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      ],
      data: [
        { id: 1, created_at: '2026-07-29 12:00:00' },
        { id: 2, created_at: '2026-07-29 12:05:00' },
        { id: 3, created_at: '2026-07-29 12:10:00' },
      ],
    },
    {
      name: 'value',
      schema: 'shrapnel',
      rowCount: 9,
      comment: 'Base entry for one concrete value, references value_type_code',
      columns: [
        { name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false },
        { name: 'value_type_code', type: 'INT', isNullable: false, isForeignKey: true, referencesTable: 'field_type', referencesColumn: 'code' },
        { name: 'created_at', type: 'TIMESTAMP', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      ],
      data: [
        { id: 101, value_type_code: 2, created_at: '2026-07-29 12:00:00' },
        { id: 102, value_type_code: 1, created_at: '2026-07-29 12:00:00' },
        { id: 103, value_type_code: 4, created_at: '2026-07-29 12:00:00' },
        { id: 104, value_type_code: 2, created_at: '2026-07-29 12:05:00' },
        { id: 105, value_type_code: 1, created_at: '2026-07-29 12:05:00' },
        { id: 106, value_type_code: 3, created_at: '2026-07-29 12:05:00' },
        { id: 107, value_type_code: 2, created_at: '2026-07-29 12:10:00' },
        { id: 108, value_type_code: 5, created_at: '2026-07-29 12:10:00' },
        { id: 109, value_type_code: 6, created_at: '2026-07-29 12:10:00' },
      ],
    },
    {
      name: 'value_string',
      schema: 'shrapnel',
      rowCount: 3,
      comment: '1:1 String physical value table',
      columns: [
        { name: 'id', type: 'INT', isPrimaryKey: true, isNullable: false, isForeignKey: true, referencesTable: 'value', referencesColumn: 'id' },
        { name: 'val', type: 'TEXT', isNullable: false },
      ],
      data: [
        { id: 101, val: 'Alice Vance' },
        { id: 104, val: 'Bob Dylan' },
        { id: 107, val: 'Charlie Brown' },
      ],
    },
    {
      name: 'value_long',
      schema: 'shrapnel',
      rowCount: 2,
      comment: '1:1 Long physical value table',
      columns: [
        { name: 'id', type: 'INT', isPrimaryKey: true, isNullable: false, isForeignKey: true, referencesTable: 'value', referencesColumn: 'id' },
        { name: 'val', type: 'BIGINT', isNullable: false },
      ],
      data: [
        { id: 102, val: 30 },
        { id: 105, val: 42 },
      ],
    },
    {
      name: 'value_double',
      schema: 'shrapnel',
      rowCount: 1,
      comment: '1:1 Double precision physical value table',
      columns: [
        { name: 'id', type: 'INT', isPrimaryKey: true, isNullable: false, isForeignKey: true, referencesTable: 'value', referencesColumn: 'id' },
        { name: 'val', type: 'DOUBLE PRECISION', isNullable: false },
      ],
      data: [
        { id: 106, val: 785.50 },
      ],
    },
    {
      name: 'value_boolean',
      schema: 'shrapnel',
      rowCount: 1,
      comment: '1:1 Boolean physical value table',
      columns: [
        { name: 'id', type: 'INT', isPrimaryKey: true, isNullable: false, isForeignKey: true, referencesTable: 'value', referencesColumn: 'id' },
        { name: 'val', type: 'BOOLEAN', isNullable: false },
      ],
      data: [
        { id: 103, val: true },
      ],
    },
    {
      name: 'value_timestamp',
      schema: 'shrapnel',
      rowCount: 1,
      comment: '1:1 Timestamp physical value table',
      columns: [
        { name: 'id', type: 'INT', isPrimaryKey: true, isNullable: false, isForeignKey: true, referencesTable: 'value', referencesColumn: 'id' },
        { name: 'val', type: 'TIMESTAMPTZ', isNullable: false },
      ],
      data: [
        { id: 108, val: '2026-08-01 10:30:00+00' },
      ],
    },
    {
      name: 'value_jsonb',
      schema: 'shrapnel',
      rowCount: 1,
      comment: '1:1 JSONB physical value table',
      columns: [
        { name: 'id', type: 'INT', isPrimaryKey: true, isNullable: false, isForeignKey: true, referencesTable: 'value', referencesColumn: 'id' },
        { name: 'val', type: 'JSONB', isNullable: false },
      ],
      data: [
        { id: 109, val: '{"role": "admin", "permissions": ["read", "write", "decode"]}' },
      ],
    },
    {
      name: 'value_uuid',
      schema: 'shrapnel',
      rowCount: 0,
      comment: '1:1 UUID physical value table',
      columns: [
        { name: 'id', type: 'INT', isPrimaryKey: true, isNullable: false, isForeignKey: true, referencesTable: 'value', referencesColumn: 'id' },
        { name: 'val', type: 'UUID', isNullable: false },
      ],
      data: [],
    },
    {
      name: 'object_attribute_value',
      schema: 'shrapnel',
      rowCount: 9,
      comment: 'Junction binding: (object_id, field_id) -> value_id',
      columns: [
        { name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false },
        { name: 'object_id', type: 'INT', isNullable: false, isForeignKey: true, referencesTable: 'object_instance', referencesColumn: 'id' },
        { name: 'field_id', type: 'INT', isNullable: false, isForeignKey: true, referencesTable: 'field', referencesColumn: 'id' },
        { name: 'value_id', type: 'INT', isNullable: false, isForeignKey: true, referencesTable: 'value', referencesColumn: 'id' },
        { name: 'bound_at', type: 'TIMESTAMP', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      ],
      indexes: [
        { name: 'uq_object_field', columns: ['object_id', 'field_id'], isUnique: true },
      ],
      data: [
        { id: 1, object_id: 1, field_id: 1, value_id: 101, bound_at: '2026-07-29 12:00:00' },
        { id: 2, object_id: 1, field_id: 2, value_id: 102, bound_at: '2026-07-29 12:00:00' },
        { id: 3, object_id: 1, field_id: 3, value_id: 103, bound_at: '2026-07-29 12:00:00' },
        { id: 4, object_id: 2, field_id: 1, value_id: 104, bound_at: '2026-07-29 12:05:00' },
        { id: 5, object_id: 2, field_id: 2, value_id: 105, bound_at: '2026-07-29 12:05:00' },
        { id: 6, object_id: 2, field_id: 4, value_id: 106, bound_at: '2026-07-29 12:05:00' },
        { id: 7, object_id: 3, field_id: 1, value_id: 107, bound_at: '2026-07-29 12:10:00' },
        { id: 8, object_id: 3, field_id: 5, value_id: 108, bound_at: '2026-07-29 12:10:00' },
        { id: 9, object_id: 3, field_id: 6, value_id: 109, bound_at: '2026-07-29 12:10:00' },
      ],
    },
  ],
  views: [
    {
      name: 'v_client_customers',
      schema: 'shrapnel',
      comment: 'Domain-specific client view pivoting shrapnel EAV attributes into standard tabular columns',
      definition: `CREATE OR REPLACE VIEW shrapnel.v_client_customers AS
SELECT 
    o.id AS object_id,
    MAX(CASE WHEN f.property_name = 'full_name' THEN v_str.val END) AS full_name,
    MAX(CASE WHEN f.property_name = 'user_age' THEN v_lng.val END) AS age,
    MAX(CASE WHEN f.property_name = 'is_active' THEN v_bool.val END) AS is_active,
    MAX(CASE WHEN f.property_name = 'credit_score' THEN v_dbl.val END) AS credit_score,
    o.created_at
FROM shrapnel.object_instance o
LEFT JOIN shrapnel.object_attribute_value oav ON o.id = oav.object_id
LEFT JOIN shrapnel.field f ON oav.field_id = f.id
LEFT JOIN shrapnel.value_string v_str ON oav.value_id = v_str.id
LEFT JOIN shrapnel.value_long v_lng ON oav.value_id = v_lng.id
LEFT JOIN shrapnel.value_boolean v_bool ON oav.value_id = v_bool.id
LEFT JOIN shrapnel.value_double v_dbl ON oav.value_id = v_dbl.id
GROUP BY o.id, o.created_at;`,
    }
  ],
  triggers: [
    {
      name: 'trg_value_extension_type_guard',
      schema: 'shrapnel',
      tableName: 'value_string',
      timing: 'BEFORE',
      event: 'INSERT',
      functionName: 'fn_guard_value_extension_type()',
      definition: `CREATE TRIGGER trg_value_extension_type_guard
BEFORE INSERT OR UPDATE ON shrapnel.value_string
FOR EACH ROW EXECUTE FUNCTION shrapnel.fn_guard_value_extension_type();`
    }
  ],
  procedures: [
    {
      name: 'fn_decode_shrapnel_object',
      schema: 'shrapnel',
      returnType: 'JSONB',
      parameters: [{ name: 'p_object_id', type: 'INT' }],
      comment: 'Decodes all EAV bindings for a given object instance into a flat JSON object',
      definition: `CREATE OR REPLACE FUNCTION shrapnel.fn_decode_shrapnel_object(p_object_id INT)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB := '{}'::jsonb;
BEGIN
    SELECT jsonb_object_agg(f.property_name, COALESCE(
        to_jsonb(vs.val),
        to_jsonb(vl.val),
        to_jsonb(vd.val),
        to_jsonb(vb.val),
        to_jsonb(vt.val),
        vj.val,
        to_jsonb(vu.val)
    )) INTO v_result
    FROM shrapnel.object_attribute_value oav
    JOIN shrapnel.field f ON oav.field_id = f.id
    LEFT JOIN shrapnel.value_string vs ON oav.value_id = vs.id
    LEFT JOIN shrapnel.value_long vl ON oav.value_id = vl.id
    LEFT JOIN shrapnel.value_double vd ON oav.value_id = vd.id
    LEFT JOIN shrapnel.value_boolean vb ON oav.value_id = vb.id
    LEFT JOIN shrapnel.value_timestamp vt ON oav.value_id = vt.id
    LEFT JOIN shrapnel.value_jsonb vj ON oav.value_id = vj.id
    LEFT JOIN shrapnel.value_uuid vu ON oav.value_id = vu.id
    WHERE oav.object_id = p_object_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;`,
    }
  ]
};

export const ECOMMERCE_SCHEMAS: SchemaObject[] = [
  {
    name: 'public',
    category: 'standard',
    tables: [
      {
        name: 'customers',
        schema: 'public',
        rowCount: 8,
        comment: 'User profiles and account metadata',
        columns: [
          { name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false },
          { name: 'email', type: 'VARCHAR(255)', isNullable: false },
          { name: 'first_name', type: 'VARCHAR(100)', isNullable: false },
          { name: 'last_name', type: 'VARCHAR(100)', isNullable: false },
          { name: 'country', type: 'VARCHAR(50)', isNullable: true, defaultValue: "'US'" },
          { name: 'loyalty_tier', type: 'VARCHAR(20)', isNullable: false, defaultValue: "'BRONZE'" },
          { name: 'total_spent', type: 'NUMERIC(10,2)', isNullable: false, defaultValue: '0.00' },
          { name: 'created_at', type: 'TIMESTAMP', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
        ],
        indexes: [
          { name: 'idx_customers_email', columns: ['email'], isUnique: true },
          { name: 'idx_customers_country', columns: ['country'], isUnique: false },
        ],
        data: [
          { id: 1, email: 'eleanor.vane@gmail.com', first_name: 'Eleanor', last_name: 'Vane', country: 'US', loyalty_tier: 'PLATINUM', total_spent: 3450.80, created_at: '2025-01-12 10:15:00' },
          { id: 2, email: 'marcus.aurelius@rome.org', first_name: 'Marcus', last_name: 'Aurelius', country: 'IT', loyalty_tier: 'GOLD', total_spent: 1890.00, created_at: '2025-02-04 14:22:10' },
          { id: 3, email: 'sophia.chen@tech.io', first_name: 'Sophia', last_name: 'Chen', country: 'CA', loyalty_tier: 'PLATINUM', total_spent: 4120.50, created_at: '2025-02-18 09:05:40' },
          { id: 4, email: 'liam.neeson@action.uk', first_name: 'Liam', last_name: 'Neeson', country: 'UK', loyalty_tier: 'SILVER', total_spent: 650.00, created_at: '2025-03-01 11:45:00' },
          { id: 5, email: 'amara.diallo@dakar.sn', first_name: 'Amara', last_name: 'Diallo', country: 'FR', loyalty_tier: 'GOLD', total_spent: 2300.25, created_at: '2025-03-15 16:30:12' },
          { id: 6, email: 'devin.miller@startup.co', first_name: 'Devin', last_name: 'Miller', country: 'US', loyalty_tier: 'BRONZE', total_spent: 140.00, created_at: '2025-04-02 08:12:00' },
          { id: 7, email: 'yuki.tanaka@tokyo.jp', first_name: 'Yuki', last_name: 'Tanaka', country: 'JP', loyalty_tier: 'SILVER', total_spent: 890.00, created_at: '2025-04-10 19:00:00' },
          { id: 8, email: 'carmen.santiago@globe.org', first_name: 'Carmen', last_name: 'Santiago', country: 'ES', loyalty_tier: 'GOLD', total_spent: 1750.90, created_at: '2025-05-01 12:00:00' },
        ],
      },
      {
        name: 'products',
        schema: 'public',
        rowCount: 6,
        comment: 'Catalog of e-commerce items',
        columns: [
          { name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false },
          { name: 'sku', type: 'VARCHAR(50)', isNullable: false },
          { name: 'title', type: 'VARCHAR(200)', isNullable: false },
          { name: 'category', type: 'VARCHAR(100)', isNullable: false },
          { name: 'price', type: 'NUMERIC(10,2)', isNullable: false },
          { name: 'stock_quantity', type: 'INT', isNullable: false, defaultValue: '0' },
          { name: 'rating', type: 'NUMERIC(3,2)', isNullable: true, defaultValue: '5.00' },
          { name: 'is_active', type: 'BOOLEAN', isNullable: false, defaultValue: 'true' },
        ],
        indexes: [
          { name: 'idx_products_sku', columns: ['sku'], isUnique: true },
          { name: 'idx_products_category', columns: ['category'], isUnique: false },
        ],
        data: [
          { id: 101, sku: 'AUDIO-ANC-01', title: 'Noise-Canceling Wireless Headphones', category: 'Electronics', price: 299.99, stock_quantity: 45, rating: 4.8, is_active: true },
          { id: 102, sku: 'DESK-CHAIR-ERG', title: 'Ergonomic Mesh Task Chair', category: 'Furniture', price: 449.00, stock_quantity: 12, rating: 4.6, is_active: true },
          { id: 103, sku: 'DISP-4K-27', title: '27-inch 4K IPS Developer Monitor', category: 'Electronics', price: 620.50, stock_quantity: 28, rating: 4.9, is_active: true },
          { id: 104, sku: 'KEYB-MECH-RGB', title: 'Mechanical Tactile Keyboard', category: 'Electronics', price: 159.00, stock_quantity: 85, rating: 4.7, is_active: true },
          { id: 105, sku: 'LAMP-LED-SMART', title: 'Smart Minimalist Desk Lamp', category: 'Home', price: 89.95, stock_quantity: 110, rating: 4.5, is_active: true },
          { id: 106, sku: 'STAND-LAPTOP-AL', title: 'Aluminum Adjustable Laptop Stand', category: 'Accessories', price: 54.99, stock_quantity: 200, rating: 4.8, is_active: true },
        ],
      },
      {
        name: 'orders',
        schema: 'public',
        rowCount: 7,
        comment: 'Customer transactions log',
        columns: [
          { name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false },
          { name: 'customer_id', type: 'INT', isNullable: false, isForeignKey: true, referencesTable: 'customers', referencesColumn: 'id' },
          { name: 'status', type: 'VARCHAR(30)', isNullable: false, defaultValue: "'PENDING'" },
          { name: 'total_amount', type: 'NUMERIC(10,2)', isNullable: false },
          { name: 'shipping_address', type: 'TEXT', isNullable: false },
          { name: 'payment_method', type: 'VARCHAR(50)', isNullable: false },
          { name: 'created_at', type: 'TIMESTAMP', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
        ],
        indexes: [
          { name: 'idx_orders_customer_id', columns: ['customer_id'], isUnique: false },
          { name: 'idx_orders_status', columns: ['status'], isUnique: false },
        ],
        data: [
          { id: 1001, customer_id: 1, status: 'DELIVERED', total_amount: 748.99, shipping_address: '742 Evergreen Terrace, Springfield, US', payment_method: 'CREDIT_CARD', created_at: '2026-06-01 10:20:00' },
          { id: 1002, customer_id: 2, status: 'SHIPPED', total_amount: 449.00, shipping_address: 'Piazza Venezia 1, Rome, IT', payment_method: 'PAYPAL', created_at: '2026-06-12 15:40:00' },
          { id: 1003, customer_id: 3, status: 'DELIVERED', total_amount: 1069.50, shipping_address: '100 King St West, Toronto, CA', payment_method: 'CREDIT_CARD', created_at: '2026-06-15 09:12:00' },
          { id: 1004, customer_id: 1, status: 'DELIVERED', total_amount: 159.00, shipping_address: '742 Evergreen Terrace, Springfield, US', payment_method: 'APPLE_PAY', created_at: '2026-07-02 11:05:00' },
          { id: 1005, customer_id: 5, status: 'PROCESSING', total_amount: 89.95, shipping_address: '12 Rue de la Paix, Paris, FR', payment_method: 'CREDIT_CARD', created_at: '2026-07-20 18:30:00' },
          { id: 1006, customer_id: 7, status: 'DELIVERED', total_amount: 890.00, shipping_address: 'Shinjuku 3-Chome, Tokyo, JP', payment_method: 'STRIPE', created_at: '2026-07-25 08:00:00' },
          { id: 1007, customer_id: 4, status: 'CANCELLED', total_amount: 299.99, shipping_address: '221B Baker St, London, UK', payment_method: 'CREDIT_CARD', created_at: '2026-07-28 14:10:00' },
        ],
      },
      {
        name: 'order_items',
        schema: 'public',
        rowCount: 10,
        comment: 'Line items contained in orders',
        columns: [
          { name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false },
          { name: 'order_id', type: 'INT', isNullable: false, isForeignKey: true, referencesTable: 'orders', referencesColumn: 'id' },
          { name: 'product_id', type: 'INT', isNullable: false, isForeignKey: true, referencesTable: 'products', referencesColumn: 'id' },
          { name: 'quantity', type: 'INT', isNullable: false },
          { name: 'unit_price', type: 'NUMERIC(10,2)', isNullable: false },
        ],
        data: [
          { id: 501, order_id: 1001, product_id: 102, quantity: 1, unit_price: 449.00 },
          { id: 502, order_id: 1001, product_id: 101, quantity: 1, unit_price: 299.99 },
          { id: 503, order_id: 1002, product_id: 102, quantity: 1, unit_price: 449.00 },
          { id: 504, order_id: 1003, product_id: 103, quantity: 1, unit_price: 620.50 },
          { id: 505, order_id: 1003, product_id: 102, quantity: 1, unit_price: 449.00 },
          { id: 506, order_id: 1004, product_id: 104, quantity: 1, unit_price: 159.00 },
          { id: 507, order_id: 1005, product_id: 105, quantity: 1, unit_price: 89.95 },
          { id: 508, order_id: 1006, product_id: 103, quantity: 1, unit_price: 620.50 },
          { id: 509, order_id: 1006, product_id: 101, quantity: 1, unit_price: 269.50 },
          { id: 510, order_id: 1007, product_id: 101, quantity: 1, unit_price: 299.99 },
        ],
      }
    ],
    views: [
      {
        name: 'v_customer_order_summary',
        schema: 'public',
        definition: `CREATE OR REPLACE VIEW public.v_customer_order_summary AS
SELECT 
    c.id AS customer_id,
    c.email,
    c.first_name || ' ' || c.last_name AS full_name,
    c.loyalty_tier,
    COUNT(o.id) AS total_orders,
    COALESCE(SUM(o.total_amount), 0) AS total_order_value,
    MAX(o.created_at) AS last_order_date
FROM public.customers c
LEFT JOIN public.orders o ON c.id = o.customer_id
GROUP BY c.id, c.email, c.first_name, c.last_name, c.loyalty_tier;`,
        comment: 'Aggregated order statistics per customer'
      },
      {
        name: 'v_popular_products',
        schema: 'public',
        definition: `CREATE OR REPLACE VIEW public.v_popular_products AS
SELECT 
    p.id,
    p.sku,
    p.title,
    p.category,
    p.price,
    SUM(oi.quantity) AS total_units_sold,
    SUM(oi.quantity * oi.unit_price) AS total_revenue
FROM public.products p
JOIN public.order_items oi ON p.id = oi.product_id
JOIN public.orders o ON oi.order_id = o.id
WHERE o.status != 'CANCELLED'
GROUP BY p.id, p.sku, p.title, p.category, p.price
ORDER BY total_units_sold DESC;`,
        comment: 'Product sales performance ranking'
      }
    ],
    triggers: [
      {
        name: 'trg_recalculate_customer_spend',
        schema: 'public',
        tableName: 'orders',
        timing: 'AFTER',
        event: 'INSERT',
        functionName: 'fn_update_customer_loyalty()',
        definition: `CREATE TRIGGER trg_recalculate_customer_spend
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.fn_update_customer_loyalty();`
      },
      {
        name: 'trg_audit_product_price_change',
        schema: 'public',
        tableName: 'products',
        timing: 'BEFORE',
        event: 'UPDATE',
        functionName: 'fn_log_price_delta()',
        definition: `CREATE TRIGGER trg_audit_product_price_change
BEFORE UPDATE OF price ON public.products
FOR EACH ROW
WHEN (OLD.price IS DISTINCT FROM NEW.price)
EXECUTE FUNCTION public.fn_log_price_delta();`
      }
    ],
    procedures: [
      {
        name: 'fn_update_customer_loyalty',
        schema: 'public',
        returnType: 'TRIGGER',
        parameters: [],
        definition: `CREATE OR REPLACE FUNCTION public.fn_update_customer_loyalty()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.customers
    SET total_spent = (
        SELECT COALESCE(SUM(total_amount), 0)
        FROM public.orders
        WHERE customer_id = NEW.customer_id AND status != 'CANCELLED'
    ),
    loyalty_tier = CASE
        WHEN (SELECT COALESCE(SUM(total_amount), 0) FROM public.orders WHERE customer_id = NEW.customer_id) >= 3000 THEN 'PLATINUM'
        WHEN (SELECT COALESCE(SUM(total_amount), 0) FROM public.orders WHERE customer_id = NEW.customer_id) >= 1500 THEN 'GOLD'
        WHEN (SELECT COALESCE(SUM(total_amount), 0) FROM public.orders WHERE customer_id = NEW.customer_id) >= 500 THEN 'SILVER'
        ELSE 'BRONZE'
    END
    WHERE id = NEW.customer_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;`
      },
      {
        name: 'fn_restock_product',
        schema: 'public',
        returnType: 'VOID',
        parameters: [
          { name: 'p_product_id', type: 'INT' },
          { name: 'p_quantity', type: 'INT' }
        ],
        definition: `CREATE OR REPLACE FUNCTION public.fn_restock_product(p_product_id INT, p_quantity INT)
RETURNS VOID AS $$
BEGIN
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Restock quantity must be greater than zero.';
    END IF;

    UPDATE public.products
    SET stock_quantity = stock_quantity + p_quantity,
        is_active = true
    WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;`
      }
    ]
  },
  {
    name: 'sales',
    tables: [
      {
        name: 'discounts',
        schema: 'sales',
        rowCount: 4,
        comment: 'Active promotional coupon codes',
        columns: [
          { name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false },
          { name: 'code', type: 'VARCHAR(50)', isNullable: false },
          { name: 'discount_percent', type: 'NUMERIC(5,2)', isNullable: false },
          { name: 'valid_until', type: 'TIMESTAMP', isNullable: false },
          { name: 'usage_limit', type: 'INT', isNullable: false, defaultValue: '1000' }
        ],
        data: [
          { id: 1, code: 'SUMMER2026', discount_percent: 15.00, valid_until: '2026-08-31 23:59:59', usage_limit: 500 },
          { id: 2, code: 'WELCOME10', discount_percent: 10.00, valid_until: '2026-12-31 23:59:59', usage_limit: 10000 },
          { id: 3, code: 'VIP25', discount_percent: 25.00, valid_until: '2026-09-15 23:59:59', usage_limit: 100 },
          { id: 4, code: 'BLACKFRIDAY', discount_percent: 30.00, valid_until: '2026-11-30 23:59:59', usage_limit: 2000 }
        ]
      }
    ],
    views: [],
    triggers: [],
    procedures: []
  },
  SHRAPNEL_SCHEMA
];

export const FINANCIAL_SCHEMAS: SchemaObject[] = [
  {
    name: 'public',
    tables: [
      {
        name: 'chart_of_accounts',
        schema: 'public',
        rowCount: 5,
        columns: [
          { name: 'account_code', type: 'VARCHAR(20)', isPrimaryKey: true, isNullable: false },
          { name: 'account_name', type: 'VARCHAR(150)', isNullable: false },
          { name: 'account_type', type: 'VARCHAR(50)', isNullable: false }, // ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
          { name: 'balance', type: 'NUMERIC(14,2)', isNullable: false, defaultValue: '0.00' },
          { name: 'currency', type: 'VARCHAR(3)', isNullable: false, defaultValue: "'USD'" }
        ],
        data: [
          { account_code: '1010', account_name: 'Operating Cash Account', account_type: 'ASSET', balance: 1250400.50, currency: 'USD' },
          { account_code: '1100', account_name: 'Accounts Receivable', account_type: 'ASSET', balance: 340200.00, currency: 'USD' },
          { account_code: '2010', account_name: 'Accounts Payable', account_type: 'LIABILITY', balance: 185600.00, currency: 'USD' },
          { account_code: '3000', account_name: 'Retained Earnings', account_type: 'EQUITY', balance: 905000.50, currency: 'USD' },
          { account_code: '4000', account_name: 'SaaS Subscription Revenue', account_type: 'REVENUE', balance: 500000.00, currency: 'USD' }
        ]
      },
      {
        name: 'journal_entries',
        schema: 'public',
        rowCount: 5,
        columns: [
          { name: 'id', type: 'BIGSERIAL', isPrimaryKey: true, isNullable: false },
          { name: 'account_code', type: 'VARCHAR(20)', isNullable: false, isForeignKey: true, referencesTable: 'chart_of_accounts', referencesColumn: 'account_code' },
          { name: 'entry_type', type: 'VARCHAR(10)', isNullable: false }, // DEBIT or CREDIT
          { name: 'amount', type: 'NUMERIC(14,2)', isNullable: false },
          { name: 'description', type: 'TEXT', isNullable: false },
          { name: 'entry_date', type: 'TIMESTAMP', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' }
        ],
        data: [
          { id: 9001, account_code: '1010', entry_type: 'DEBIT', amount: 50000.00, description: 'Customer Invoice #4029 Payment Received', entry_date: '2026-07-01 10:00:00' },
          { id: 9002, account_code: '4000', entry_type: 'CREDIT', amount: 50000.00, description: 'SaaS Enterprise Annual Contract Recognition', entry_date: '2026-07-01 10:00:00' },
          { id: 9003, account_code: '2010', entry_type: 'DEBIT', amount: 12500.00, description: 'AWS Infrastructure Bill Payment', entry_date: '2026-07-05 14:30:00' },
          { id: 9004, account_code: '1010', entry_type: 'CREDIT', amount: 12500.00, description: 'AWS Infrastructure Outflow', entry_date: '2026-07-05 14:30:00' },
          { id: 9005, account_code: '1100', entry_type: 'DEBIT', amount: 75000.00, description: 'Invoice Issued to Acme Corp', entry_date: '2026-07-15 09:00:00' }
        ]
      }
    ],
    views: [
      {
        name: 'v_trial_balance',
        schema: 'public',
        definition: `CREATE OR REPLACE VIEW public.v_trial_balance AS
SELECT 
    ca.account_code,
    ca.account_name,
    ca.account_type,
    SUM(CASE WHEN je.entry_type = 'DEBIT' THEN je.amount ELSE 0 END) AS total_debits,
    SUM(CASE WHEN je.entry_type = 'CREDIT' THEN je.amount ELSE 0 END) AS total_credits
FROM public.chart_of_accounts ca
LEFT JOIN public.journal_entries je ON ca.account_code = je.account_code
GROUP BY ca.account_code, ca.account_name, ca.account_type;`,
        comment: 'Debits vs Credits trial balance view'
      }
    ],
    triggers: [],
    procedures: []
  }
];

export const SAAS_SCHEMAS: SchemaObject[] = [
  {
    name: 'public',
    tables: [
      {
        name: 'organization_subscriptions',
        schema: 'public',
        rowCount: 4,
        columns: [
          { name: 'org_id', type: 'UUID', isPrimaryKey: true, isNullable: false },
          { name: 'org_name', type: 'VARCHAR(100)', isNullable: false },
          { name: 'plan', type: 'VARCHAR(50)', isNullable: false },
          { name: 'mrr', type: 'NUMERIC(10,2)', isNullable: false },
          { name: 'status', type: 'VARCHAR(20)', isNullable: false, defaultValue: "'ACTIVE'" },
          { name: 'renews_at', type: 'DATE', isNullable: false }
        ],
        data: [
          { org_id: 'a1b2c3d4-0001', org_name: 'Stripe Global Inc', plan: 'ENTERPRISE', mrr: 2500.00, status: 'ACTIVE', renews_at: '2026-12-31' },
          { org_id: 'a1b2c3d4-0002', org_name: 'Vercel Cloud Labs', plan: 'GROWTH', mrr: 850.00, status: 'ACTIVE', renews_at: '2026-09-15' },
          { org_id: 'a1b2c3d4-0003', org_name: 'Linear Workflows', plan: 'ENTERPRISE', mrr: 4200.00, status: 'ACTIVE', renews_at: '2027-01-01' },
          { org_id: 'a1b2c3d4-0004', org_name: 'Acme Rocket Co', plan: 'STARTER', mrr: 199.00, status: 'PAST_DUE', renews_at: '2026-07-28' }
        ]
      }
    ],
    views: [],
    triggers: [],
    procedures: []
  }
];
