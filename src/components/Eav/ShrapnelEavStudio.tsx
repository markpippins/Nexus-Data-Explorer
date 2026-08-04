import React, { useState } from 'react';
import {
  Layers,
  Code,
  Eye,
  PlusCircle,
  Database,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Zap,
  Terminal,
  Settings,
  RefreshCw,
  Copy,
  Check,
  Table as TableIcon,
  Play,
  ArrowRight,
  ShieldCheck,
  FileCode,
  Tag
} from 'lucide-react';
import { SchemaObject, TableObject } from '../../types/database';

interface ShrapnelEavStudioProps {
  schemas: SchemaObject[];
  activeSchemaName: string;
  onUpdateSchema: (updatedSchemas: SchemaObject[]) => void;
  onRunQueryInConsole: (sql: string) => void;
}

export const ShrapnelEavStudio: React.FC<ShrapnelEavStudioProps> = ({
  schemas,
  activeSchemaName,
  onUpdateSchema,
  onRunQueryInConsole,
}) => {
  const [activeTab, setActiveTab] = useState<'inspector' | 'encoder' | 'fields' | 'customizer'>('inspector');
  const [selectedObjectId, setSelectedObjectId] = useState<number>(1);
  const [copiedSql, setCopiedSql] = useState(false);

  // Encoder state
  const [encoderJson, setEncoderJson] = useState<string>(
    JSON.stringify(
      {
        full_name: 'David Miller',
        user_age: 28,
        is_active: true,
        credit_score: 810.0,
        metadata: { role: 'analyst', department: 'Risk' },
      },
      null,
      2
    )
  );
  const [encodeStatus, setEncodeStatus] = useState<string | null>(null);

  // Customizer state
  const [clientViewName, setClientViewName] = useState('v_client_users');
  const [selectedFields, setSelectedFields] = useState<string[]>(['full_name', 'user_age', 'is_active', 'credit_score']);
  const [customizerStatus, setCustomizerStatus] = useState<string | null>(null);

  // Find shrapnel or active schema
  const shrapnelSchema = schemas.find((s) => s.category === 'shrapnel' || s.name === 'shrapnel') || schemas.find((s) => s.name === activeSchemaName);
  const isShrapnelCategory = shrapnelSchema?.category === 'shrapnel' || shrapnelSchema?.name === 'shrapnel';

  // Extract EAV tables
  const objectInstanceTable = shrapnelSchema?.tables.find((t) => t.name === 'object_instance');
  const fieldTable = shrapnelSchema?.tables.find((t) => t.name === 'field');
  const fieldTypeTable = shrapnelSchema?.tables.find((t) => t.name === 'field_type');
  const valueTable = shrapnelSchema?.tables.find((t) => t.name === 'value');
  const oavTable = shrapnelSchema?.tables.find((t) => t.name === 'object_attribute_value');

  const valueStringTable = shrapnelSchema?.tables.find((t) => t.name === 'value_string');
  const valueLongTable = shrapnelSchema?.tables.find((t) => t.name === 'value_long');
  const valueDoubleTable = shrapnelSchema?.tables.find((t) => t.name === 'value_double');
  const valueBooleanTable = shrapnelSchema?.tables.find((t) => t.name === 'value_boolean');
  const valueTimestampTable = shrapnelSchema?.tables.find((t) => t.name === 'value_timestamp');
  const valueJsonbTable = shrapnelSchema?.tables.find((t) => t.name === 'value_jsonb');

  // Decode object instance dynamically
  const decodeObject = (objId: number) => {
    if (!oavTable || !fieldTable) return { values: {}, bindings: [] };

    const objectBindings = oavTable.data.filter((b) => b.object_id === objId);
    const decodedValues: Record<string, any> = {};
    const detailedBindings: any[] = [];

    objectBindings.forEach((binding) => {
      const field = fieldTable.data.find((f) => f.id === binding.field_id);
      if (!field) return;

      const propName = field.property_name;
      const valId = binding.value_id;
      let val: any = null;
      let typeName = 'Unknown';

      // Find physical value from 1:1 extension tables
      const strRow = valueStringTable?.data.find((v) => v.id === valId);
      const longRow = valueLongTable?.data.find((v) => v.id === valId);
      const dblRow = valueDoubleTable?.data.find((v) => v.id === valId);
      const boolRow = valueBooleanTable?.data.find((v) => v.id === valId);
      const tsRow = valueTimestampTable?.data.find((v) => v.id === valId);
      const jsonRow = valueJsonbTable?.data.find((v) => v.id === valId);

      if (strRow !== undefined) {
        val = strRow.val;
        typeName = 'String';
      } else if (longRow !== undefined) {
        val = longRow.val;
        typeName = 'Long';
      } else if (dblRow !== undefined) {
        val = dblRow.val;
        typeName = 'Double';
      } else if (boolRow !== undefined) {
        val = boolRow.val;
        typeName = 'Boolean';
      } else if (tsRow !== undefined) {
        val = tsRow.val;
        typeName = 'Timestamp';
      } else if (jsonRow !== undefined) {
        try {
          val = typeof jsonRow.val === 'string' ? JSON.parse(jsonRow.val) : jsonRow.val;
        } catch {
          val = jsonRow.val;
        }
        typeName = 'JSONB';
      }

      decodedValues[propName] = val;
      detailedBindings.push({
        field_id: field.id,
        property_name: propName,
        label: field.label || field.name,
        value_id: valId,
        type: typeName,
        value: val,
        bound_at: binding.bound_at,
      });
    });

    return { values: decodedValues, bindings: detailedBindings };
  };

  const currentDecoded = decodeObject(selectedObjectId);

  // Handle marking schema as category='shrapnel'
  const handleMarkAsShrapnel = () => {
    const updated = schemas.map((s) => {
      if (s.name === (shrapnelSchema?.name || activeSchemaName)) {
        return { ...s, category: 'shrapnel' };
      }
      return s;
    });
    onUpdateSchema(updated);
  };

  // Perform object encoding
  const handleEncodeObject = () => {
    try {
      const parsed = JSON.parse(encoderJson);
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Payload must be a valid JSON object.');
      }

      if (!shrapnelSchema || !objectInstanceTable || !fieldTable || !valueTable || !oavTable) {
        throw new Error('shrapnel tables missing in current schema.');
      }

      const newObjId = (objectInstanceTable.data.length > 0 ? Math.max(...objectInstanceTable.data.map((d) => d.id)) : 0) + 1;
      objectInstanceTable.data.push({ id: newObjId, created_at: new Date().toISOString() });
      objectInstanceTable.rowCount = objectInstanceTable.data.length;

      let valueIdCounter = (valueTable.data.length > 0 ? Math.max(...valueTable.data.map((v) => v.id)) : 100) + 1;
      let oavIdCounter = (oavTable.data.length > 0 ? Math.max(...oavTable.data.map((o) => o.id)) : 0) + 1;

      Object.entries(parsed).forEach(([key, val]) => {
        // Find or create field
        let fieldObj = fieldTable.data.find((f) => f.property_name === key);
        if (!fieldObj) {
          const newFieldId = fieldTable.data.length + 1;
          let typeCode = 2; // default string
          if (typeof val === 'number') typeCode = Number.isInteger(val) ? 1 : 3;
          else if (typeof val === 'boolean') typeCode = 4;
          else if (typeof val === 'object') typeCode = 6;

          fieldObj = {
            id: newFieldId,
            property_name: key,
            name: key.replace(/_/g, ' ').toUpperCase(),
            label: key,
            field_type_code: typeCode,
            is_calculated: false,
            field_index: fieldTable.data.length + 1,
            created_at: new Date().toISOString(),
          };
          fieldTable.data.push(fieldObj);
          fieldTable.rowCount = fieldTable.data.length;
        }

        const newValId = valueIdCounter++;
        const typeCode = fieldObj.field_type_code;

        // Insert into value base
        valueTable.data.push({ id: newValId, value_type_code: typeCode, created_at: new Date().toISOString() });
        valueTable.rowCount = valueTable.data.length;

        // Insert into physical extension table
        if (typeCode === 1 && valueLongTable) valueLongTable.data.push({ id: newValId, val: Number(val) });
        else if (typeCode === 2 && valueStringTable) valueStringTable.data.push({ id: newValId, val: String(val) });
        else if (typeCode === 3 && valueDoubleTable) valueDoubleTable.data.push({ id: newValId, val: Number(val) });
        else if (typeCode === 4 && valueBooleanTable) valueBooleanTable.data.push({ id: newValId, val: Boolean(val) });
        else if (typeCode === 6 && valueJsonbTable) valueJsonbTable.data.push({ id: newValId, val: typeof val === 'object' ? JSON.stringify(val) : String(val) });
        else if (valueStringTable) valueStringTable.data.push({ id: newValId, val: String(val) });

        // Insert into junction table
        oavTable.data.push({
          id: oavIdCounter++,
          object_id: newObjId,
          field_id: fieldObj.id,
          value_id: newValId,
          bound_at: new Date().toISOString(),
        });
        oavTable.rowCount = oavTable.data.length;
      });

      onUpdateSchema([...schemas]);
      setSelectedObjectId(newObjId);
      setEncodeStatus(`Success! Created object instance #${newObjId} with ${Object.keys(parsed).length} bound values.`);
      setTimeout(() => setEncodeStatus(null), 4000);
    } catch (err: any) {
      setEncodeStatus(`Error encoding object: ${err.message}`);
    }
  };

  // Generate and apply customized domain views
  const handleApplyCustomView = () => {
    if (!shrapnelSchema) return;

    const selectedCols = fieldTable?.data.filter((f) => selectedFields.includes(f.property_name)) || [];
    const selectClauses = selectedCols.map((f) => {
      if (f.field_type_code === 2) return `    MAX(CASE WHEN f.property_name = '${f.property_name}' THEN v_str.val END) AS ${f.property_name}`;
      if (f.field_type_code === 1) return `    MAX(CASE WHEN f.property_name = '${f.property_name}' THEN v_lng.val END) AS ${f.property_name}`;
      if (f.field_type_code === 3) return `    MAX(CASE WHEN f.property_name = '${f.property_name}' THEN v_dbl.val END) AS ${f.property_name}`;
      if (f.field_type_code === 4) return `    MAX(CASE WHEN f.property_name = '${f.property_name}' THEN v_bool.val END) AS ${f.property_name}`;
      return `    MAX(CASE WHEN f.property_name = '${f.property_name}' THEN v_str.val END) AS ${f.property_name}`;
    });

    const ddl = `CREATE OR REPLACE VIEW ${shrapnelSchema.name}.${clientViewName} AS
SELECT 
    o.id AS object_id,
${selectClauses.join(',\n')},
    o.created_at
FROM ${shrapnelSchema.name}.object_instance o
LEFT JOIN ${shrapnelSchema.name}.object_attribute_value oav ON o.id = oav.object_id
LEFT JOIN ${shrapnelSchema.name}.field f ON oav.field_id = f.id
LEFT JOIN ${shrapnelSchema.name}.value_string v_str ON oav.value_id = v_str.id
LEFT JOIN ${shrapnelSchema.name}.value_long v_lng ON oav.value_id = v_lng.id
LEFT JOIN ${shrapnelSchema.name}.value_boolean v_bool ON oav.value_id = v_bool.id
LEFT JOIN ${shrapnelSchema.name}.value_double v_dbl ON oav.value_id = v_dbl.id
GROUP BY o.id, o.created_at;`;

    // Add view to schema
    const newView = {
      name: clientViewName,
      schema: shrapnelSchema.name,
      comment: `Customized domain view generated for client access on ${shrapnelSchema.name}`,
      definition: ddl,
    };

    const existingIdx = shrapnelSchema.views.findIndex((v) => v.name === clientViewName);
    if (existingIdx !== -1) {
      shrapnelSchema.views[existingIdx] = newView;
    } else {
      shrapnelSchema.views.push(newView);
    }

    onUpdateSchema([...schemas]);
    setCustomizerStatus(`Successfully generated & applied view "${clientViewName}" to ${shrapnelSchema.name} schema!`);
    setTimeout(() => setCustomizerStatus(null), 4000);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0F1115] text-[#E2E8F0] font-sans overflow-hidden select-text">
      {/* Top Banner */}
      <div className="bg-[#181A1F] border-b border-[#2D3139] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 bg-purple-900/50 border border-purple-700/60 text-purple-300 rounded-lg">
            <Layers className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-white tracking-wide">
                shrapnel Relational Object Store Studio
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-purple-950/80 text-purple-300 border border-purple-700/50 rounded-full font-semibold">
                EAV Engine
              </span>
            </div>
            <p className="text-[11px] text-[#94A3B8]">
              Decoupled Data Definitions (metadata) and Concrete Values with DB-level guard triggers
            </p>
          </div>
        </div>

        {/* Category Guard Indicator */}
        <div className="flex items-center space-x-2">
          {isShrapnelCategory ? (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-950/60 border border-emerald-700/60 rounded text-xs font-mono text-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Schema Category: <strong className="text-emerald-200">shrapnel</strong></span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1 px-2.5 py-1 bg-amber-950/60 border border-amber-700/60 rounded text-xs font-mono text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Standard Schema</span>
              </div>
              <button
                onClick={handleMarkAsShrapnel}
                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded transition-colors"
              >
                Mark as 'shrapnel' Category
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Non-Shrapnel Category Enforcement Notice */}
      {!isShrapnelCategory && (
        <div className="bg-amber-950/40 border-b border-amber-800/50 p-3 px-4 flex items-center justify-between text-xs text-amber-200 font-mono shrink-0">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              EAV-specific Relational Object Store tools are limited to schemas categorized as <strong>'shrapnel'</strong>. Mark this schema or switch to the <code>shrapnel</code> schema to access full EAV features.
            </span>
          </div>
          <button
            onClick={handleMarkAsShrapnel}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-xs shrink-0 transition-colors"
          >
            Enable Shrapnel Category
          </button>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="bg-[#181A1F] border-b border-[#2D3139] px-4 flex items-center space-x-1 text-xs font-mono shrink-0">
        <button
          onClick={() => setActiveTab('inspector')}
          className={`px-3 py-2 flex items-center space-x-1.5 border-b-2 font-medium transition-colors ${
            activeTab === 'inspector'
              ? 'border-purple-500 text-purple-300 bg-[#0F1115]'
              : 'border-transparent text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#2D3139]/50'
          }`}
        >
          <Eye className="w-3.5 h-3.5 text-purple-400" />
          <span>1. Object Decoder & Inspector</span>
        </button>

        <button
          onClick={() => setActiveTab('encoder')}
          className={`px-3 py-2 flex items-center space-x-1.5 border-b-2 font-medium transition-colors ${
            activeTab === 'encoder'
              ? 'border-purple-500 text-purple-300 bg-[#0F1115]'
              : 'border-transparent text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#2D3139]/50'
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
          <span>2. Object Encoder (Create)</span>
        </button>

        <button
          onClick={() => setActiveTab('fields')}
          className={`px-3 py-2 flex items-center space-x-1.5 border-b-2 font-medium transition-colors ${
            activeTab === 'fields'
              ? 'border-purple-500 text-purple-300 bg-[#0F1115]'
              : 'border-transparent text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#2D3139]/50'
          }`}
        >
          <TableIcon className="w-3.5 h-3.5 text-cyan-400" />
          <span>3. Field & Type Registry</span>
        </button>

        <button
          onClick={() => setActiveTab('customizer')}
          className={`px-3 py-2 flex items-center space-x-1.5 border-b-2 font-medium transition-colors ${
            activeTab === 'customizer'
              ? 'border-purple-500 text-purple-300 bg-[#0F1115]'
              : 'border-transparent text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#2D3139]/50'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>4. Client Domain Customizer (Views)</span>
        </button>
      </div>

      {/* Main Tab View Body */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {/* TAB 1: OBJECT DECODER & INSPECTOR */}
        {activeTab === 'inspector' && (
          <div className="space-y-4 max-w-6xl mx-auto">
            {/* Instance Selector */}
            <div className="bg-[#181A1F] border border-[#2D3139] p-3 rounded-lg flex items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <label className="text-xs font-mono font-semibold text-[#94A3B8]">Select Object Instance ID:</label>
                <div className="flex items-center space-x-1">
                  {objectInstanceTable?.data.map((obj) => (
                    <button
                      key={obj.id}
                      onClick={() => setSelectedObjectId(obj.id)}
                      className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                        selectedObjectId === obj.id
                          ? 'bg-purple-600 text-white font-bold shadow'
                          : 'bg-[#2D3139] hover:bg-[#3B414D] text-[#94A3B8]'
                      }`}
                    >
                      Object #{obj.id}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() =>
                  onRunQueryInConsole(
                    `SELECT * FROM ${shrapnelSchema?.name || 'shrapnel'}.fn_decode_shrapnel_object(${selectedObjectId});`
                  )
                }
                className="px-2.5 py-1 bg-[#2D3139] hover:bg-[#3B414D] text-xs font-mono text-purple-300 rounded border border-purple-700/50 flex items-center space-x-1.5 transition-colors"
              >
                <Terminal className="w-3.5 h-3.5 text-purple-400" />
                <span>Run SQL Decode Function</span>
              </button>
            </div>

            {/* Decoded Views Split Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left: Flat JSON Payload */}
              <div className="bg-[#181A1F] border border-[#2D3139] rounded-lg p-3.5 flex flex-col h-96">
                <div className="flex items-center justify-between pb-2 border-b border-[#2D3139] mb-2">
                  <span className="text-xs font-mono font-bold text-emerald-400 flex items-center space-x-1.5">
                    <Code className="w-4 h-4" />
                    <span>Decoded Object JSON Representation</span>
                  </span>
                  <span className="text-[10px] font-mono text-[#64748B]">
                    ID: #{selectedObjectId}
                  </span>
                </div>
                <div className="flex-1 bg-[#0F1115] border border-[#2D3139] rounded p-3 font-mono text-xs text-emerald-300 overflow-auto custom-scrollbar">
                  <pre>{JSON.stringify(currentDecoded.values, null, 2)}</pre>
                </div>
              </div>

              {/* Right: Detailed Junction Bindings */}
              <div className="bg-[#181A1F] border border-[#2D3139] rounded-lg p-3.5 flex flex-col h-96">
                <div className="flex items-center justify-between pb-2 border-b border-[#2D3139] mb-2">
                  <span className="text-xs font-mono font-bold text-cyan-400 flex items-center space-x-1.5">
                    <Database className="w-4 h-4" />
                    <span>Physical Junction Bindings (object_attribute_value)</span>
                  </span>
                  <span className="text-[10px] font-mono text-[#64748B]">
                    {currentDecoded.bindings.length} fields bound
                  </span>
                </div>
                <div className="flex-1 overflow-auto custom-scrollbar border border-[#2D3139] rounded bg-[#0F1115]">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-[#181A1F] text-[#94A3B8] text-[10px] uppercase border-b border-[#2D3139] sticky top-0">
                      <tr>
                        <th className="p-2">Property</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Resolved Value</th>
                        <th className="p-2">Value ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2D3139] text-[#E2E8F0]">
                      {currentDecoded.bindings.map((b, i) => (
                        <tr key={i} className="hover:bg-[#181A1F]">
                          <td className="p-2 font-bold text-purple-300">{b.property_name}</td>
                          <td className="p-2">
                            <span className="px-1.5 py-0.5 text-[10px] bg-blue-950 text-blue-300 border border-blue-800 rounded">
                              {b.type}
                            </span>
                          </td>
                          <td className="p-2 text-emerald-300 font-semibold truncate max-w-xs">
                            {typeof b.value === 'object' ? JSON.stringify(b.value) : String(b.value)}
                          </td>
                          <td className="p-2 text-[#64748B]">#{b.value_id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: OBJECT ENCODER */}
        {activeTab === 'encoder' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            <div className="bg-[#181A1F] border border-[#2D3139] rounded-lg p-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#2D3139] mb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <PlusCircle className="w-4 h-4 text-emerald-400" />
                    <span>Single-Transaction EAV Object Encoder</span>
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    Atomically inserts object instance, infers field types, writes physical value tables, and links junction bindings.
                  </p>
                </div>
              </div>

              {encodeStatus && (
                <div
                  className={`p-3 rounded text-xs font-mono mb-3 ${
                    encodeStatus.startsWith('Error')
                      ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                      : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                  }`}
                >
                  {encodeStatus}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-mono font-semibold text-[#94A3B8]">
                  Entity Properties JSON Payload:
                </label>
                <textarea
                  value={encoderJson}
                  onChange={(e) => setEncoderJson(e.target.value)}
                  rows={10}
                  className="w-full bg-[#0F1115] border border-[#2D3139] rounded p-3 font-mono text-xs text-emerald-300 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="mt-4 flex justify-end space-x-2">
                <button
                  onClick={handleEncodeObject}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded shadow flex items-center space-x-2 transition-all"
                >
                  <Zap className="w-4 h-4 text-amber-300 fill-current" />
                  <span>Encode & Insert Object Instance</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: FIELD & TYPE REGISTRY */}
        {activeTab === 'fields' && (
          <div className="space-y-4 max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Field Types */}
              <div className="bg-[#181A1F] border border-[#2D3139] rounded-lg p-3.5">
                <h3 className="text-xs font-mono font-bold text-cyan-400 mb-2 uppercase">
                  shrapnel.field_type Registry (Codes 1..7)
                </h3>
                <div className="overflow-auto border border-[#2D3139] rounded bg-[#0F1115]">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-[#181A1F] text-[#94A3B8] text-[10px] border-b border-[#2D3139]">
                      <tr>
                        <th className="p-2">Code</th>
                        <th className="p-2">Name</th>
                        <th className="p-2">PostgreSQL Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2D3139]">
                      {fieldTypeTable?.data.map((ft) => (
                        <tr key={ft.code} className="hover:bg-[#181A1F]">
                          <td className="p-2 font-bold text-amber-400">#{ft.code}</td>
                          <td className="p-2 font-semibold text-purple-300">{ft.name}</td>
                          <td className="p-2 text-[#94A3B8]">{ft.pg_type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Fields */}
              <div className="bg-[#181A1F] border border-[#2D3139] rounded-lg p-3.5">
                <h3 className="text-xs font-mono font-bold text-emerald-400 mb-2 uppercase">
                  shrapnel.field Attributes ({fieldTable?.data.length || 0})
                </h3>
                <div className="overflow-auto border border-[#2D3139] rounded bg-[#0F1115]">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-[#181A1F] text-[#94A3B8] text-[10px] border-b border-[#2D3139]">
                      <tr>
                        <th className="p-2">Property Key</th>
                        <th className="p-2">Type Code</th>
                        <th className="p-2">Index</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2D3139]">
                      {fieldTable?.data.map((f) => (
                        <tr key={f.id} className="hover:bg-[#181A1F]">
                          <td className="p-2 font-bold text-purple-300">{f.property_name}</td>
                          <td className="p-2">
                            <span className="px-1.5 py-0.5 bg-blue-950 text-blue-300 rounded text-[10px]">
                              Type #{f.field_type_code}
                            </span>
                          </td>
                          <td className="p-2 text-[#64748B]">{f.field_index}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CLIENT DOMAIN CUSTOMIZER */}
        {activeTab === 'customizer' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            <div className="bg-[#181A1F] border border-[#2D3139] rounded-lg p-4">
              <div className="pb-3 border-b border-[#2D3139] mb-3">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Domain-Specific Client Customizer (Views & Functions)</span>
                </h3>
                <p className="text-xs text-[#94A3B8] mt-1">
                  Pivots EAV entity properties into flat relational views custom-tailored for domain clients.
                </p>
              </div>

              {customizerStatus && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs font-mono rounded mb-3">
                  {customizerStatus}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-mono font-semibold text-[#94A3B8]">Client View Name:</label>
                  <input
                    type="text"
                    value={clientViewName}
                    onChange={(e) => setClientViewName(e.target.value)}
                    className="w-full bg-[#0F1115] border border-[#2D3139] rounded px-3 py-1.5 text-xs text-white font-mono mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono font-semibold text-[#94A3B8]">
                    Select EAV Properties to Pivot into Flat Columns:
                  </label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {fieldTable?.data.map((f) => {
                      const isSelected = selectedFields.includes(f.property_name);
                      return (
                        <button
                          key={f.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedFields(selectedFields.filter((s) => s !== f.property_name));
                            } else {
                              setSelectedFields([...selectedFields, f.property_name]);
                            }
                          }}
                          className={`px-2.5 py-1 rounded text-xs font-mono border transition-colors ${
                            isSelected
                              ? 'bg-purple-900/60 border-purple-500 text-purple-200'
                              : 'bg-[#0F1115] border-[#2D3139] text-[#64748B]'
                          }`}
                        >
                          {f.property_name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleApplyCustomView}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded shadow flex items-center space-x-2 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Generate & Apply View to {shrapnelSchema?.name || 'shrapnel'} Schema</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
