import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanResult, offlineGridQuery, structuredSchema } from '../src/lib/gridquery';

test('structuredSchema drops constraints structured outputs reject, keeps property names', () => {
  const schema = {
    type: 'object',
    properties: {
      pattern: { type: 'string', pattern: '^[a-z]+$', minLength: 1 },
      sortModel: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'object', properties: { colId: { type: 'string', enum: ['amount', 'riskScore'] } }, required: ['colId'] } },
      amount: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
    },
    required: ['pattern'],
    $defs: { maxItems: { type: 'integer', maximum: 10 } },
  };
  const out = structuredSchema(schema) as Record<string, any>;
  const text = JSON.stringify(out);
  for (const keyword of ['"minItems"', '"maximum"', '"minimum"', '"minLength"', '"pattern":"']) assert.ok(!text.includes(keyword), `${keyword} should be removed`);
  assert.ok(out.properties.pattern, 'a property named "pattern" is kept');
  assert.ok(out.$defs.maxItems, 'a $defs entry named "maxItems" is kept');
  assert.equal(out.additionalProperties, false);
  assert.equal(out.properties.sortModel.items.additionalProperties, false);
  assert.deepEqual(out.properties.sortModel.items.properties.colId.enum, ['amount', 'riskScore']);
  assert.equal(out.properties.amount.anyOf.length, 2);
});

test('cleanResult keeps only state properties the grid can ignore', () => {
  const out = cleanResult(
    { gridState: { filter: {} }, propertiesToIgnore: ['sideBar', 'columnOrder', 'madeUp', 'sort', 'sort'], explanation: 'Blocked over $50.' },
    ['aggregation', 'sort', 'columnOrder', 'sideBar'],
  );
  assert.deepEqual(out.propertiesToIgnore, ['sideBar', 'columnOrder', 'sort']);
  assert.throws(() => cleanResult({ propertiesToIgnore: [], explanation: 'x' }, ['sort']));
});

test('offline parser answers the Risk Ops example question', () => {
  const out = offlineGridQuery('Blocked payments over $50 by merchant');
  const filter = (out.gridState.filter as { filterModel: Record<string, unknown> }).filterModel;
  assert.deepEqual(filter.verdict, { filterType: 'set', values: ['block'] });
  assert.deepEqual(filter.amount, { filterType: 'number', type: 'greaterThan', filter: 50 });
  assert.deepEqual(out.gridState.rowGroup, { groupColIds: ['merchant'] });
});
