import assert from 'node:assert/strict';
import { test } from 'node:test';
import utils from '../dist/utils.js';

const { deserialize, removeCircularReferences, serialize } = utils;

test('continues to remove a direct self-reference', () => {
    const value = { name: 'value' };
    value.self = value;

    assert.deepEqual(serialize(value), {
        name: 'value',
    });
});

test('serializes a mutual cycle by removing the ancestor reference', () => {
    const first = { name: 'first' };
    const second = { name: 'second' };
    first.second = second;
    second.first = first;

    assert.deepEqual(serialize(first), {
        name: 'first',
        second: {
            name: 'second',
        },
    });
});

test('serializes a deeper cycle by removing only the ancestor reference', () => {
    const first = { name: 'first' };
    const second = { name: 'second' };
    const third = { name: 'third' };
    first.second = second;
    second.third = third;
    third.first = first;

    assert.deepEqual(serialize(first), {
        name: 'first',
        second: {
            name: 'second',
            third: {
                name: 'third',
            },
        },
    });
});

test('serializes a cycle that crosses an array and an object', () => {
    const root = { name: 'root' };
    const child = { name: 'child', parent: root };
    root.children = [child];

    assert.deepEqual(serialize(root), {
        name: 'root',
        children: [{ name: 'child' }],
    });
});

test('removes an ancestor reference from mutually circular arrays', () => {
    const first = [];
    const second = [];
    first.push(second);
    second.push(first);

    removeCircularReferences(first);

    assert.equal(first[0], second);
    assert.equal(0 in second, false);
});

test('preserves repeated references that are not circular', () => {
    const shared = { value: 'shared' };

    assert.deepEqual(serialize({ left: shared, right: shared }), {
        left: { value: 'shared' },
        right: { value: 'shared' },
    });
});

test('preserves a shared descendant when it is not an ancestor in a sibling branch', () => {
    const ancestor = { name: 'ancestor' };
    const sibling = { name: 'sibling' };
    const shared = { name: 'shared', back: ancestor };
    ancestor.shared = shared;
    sibling.shared = shared;

    assert.deepEqual(serialize({ ancestor, sibling }), {
        ancestor: {
            name: 'ancestor',
            shared: { name: 'shared' },
        },
        sibling: {
            name: 'sibling',
            shared: {
                name: 'shared',
                back: { name: 'ancestor' },
            },
        },
    });
});

test('serializes null values and a circular null-prototype object', () => {
    const value = Object.create(null);
    value.label = 'null prototype';
    value.empty = null;
    value.self = value;

    assert.deepEqual(serialize({ value, empty: null }), {
        value: {
            label: 'null prototype',
            empty: null,
        },
        empty: null,
    });
});

test('does not promote inherited enumerable properties into serialized output', () => {
    const inheritedKey = 0xd834;
    Object.defineProperty(Object.prototype, inheritedKey, {
        configurable: true,
        enumerable: true,
        value: true,
    });

    try {
        assert.deepEqual(serialize({ nested: { value: 'own' } }), {
            nested: { value: 'own' },
        });
    } finally {
        delete Object.prototype[inheritedKey];
    }
});

test('copies own properties without invoking inherited setters', () => {
    let setterCalls = 0;
    const prototype = {};
    Object.defineProperty(prototype, 'value', {
        set() {
            setterCalls++;
        },
    });
    const input = Object.create(prototype);
    Object.defineProperty(input, 'value', {
        enumerable: true,
        value: 42,
    });

    assert.deepEqual(serialize(input), { value: 42 });
    assert.equal(setterCalls, 0);
});

test('preserves an own __proto__ property as serialized data', () => {
    const input = {};
    Object.defineProperty(input, '__proto__', {
        enumerable: true,
        value: { own: true },
    });

    const output = serialize(input);

    assert.equal(Object.hasOwn(output, '__proto__'), true);
    assert.deepEqual(output.__proto__, { own: true });
});

test('preserves own data that equals an enumerable prototype property', () => {
    const key = 'serializerOwnValue';
    Object.defineProperty(Object.prototype, key, {
        configurable: true,
        enumerable: true,
        value: 42,
    });
    const input = {};
    Object.defineProperty(input, key, {
        enumerable: true,
        value: 42,
    });

    try {
        const output = serialize(input);
        assert.equal(Object.hasOwn(output, key), true);
        assert.equal(output[key], 42);
    } finally {
        delete Object.prototype[key];
    }
});

test('preserves serializable object instances nested in arrays', () => {
    class PrivateJSON {
        #value = 'private value';

        toJSON() {
            return this.#value;
        }
    }

    const metadata = {};
    metadata.self = metadata;
    const date = new Date('2020-01-02T03:04:05.000Z');
    const number = new Number(3);
    const privateJSON = new PrivateJSON();
    date.metadata = metadata;
    number.metadata = metadata;
    privateJSON.metadata = metadata;

    const output = serialize([date, number, privateJSON]);

    assert.equal(JSON.stringify(output), '["2020-01-02T03:04:05.000Z",3,"private value"]');
    assert.equal(metadata.self, metadata);
});

test('preserves present non-enumerable array indices', () => {
    const input = [];
    Object.defineProperty(input, '0', { value: 'present' });

    assert.deepEqual(serialize(input), ['present']);
});

test('preserves present non-enumerable indices in sparse arrays', () => {
    const input = new Array(2);
    Object.defineProperty(input, '0', { value: 'present' });

    const output = serialize(input);

    assert.deepEqual(output, {
        '!sparsearray': true,
        '!length': 2,
        0: 'present',
    });
});

test('round-trips trailing holes in sparse arrays', () => {
    const input = new Array(3);
    input[0] = 'present';

    const output = deserialize(serialize(input));

    assert.equal(output.length, 3);
    assert.deepEqual(Object.keys(output), ['0']);
    assert.equal(output[0], 'present');
});

test('round-trips sparse array length when JSON omits the final value', () => {
    const input = new Array(3);
    input[2] = undefined;

    const encoded = JSON.parse(JSON.stringify(serialize(input)));
    const output = deserialize(encoded);

    assert.equal(output.length, 3);
    assert.deepEqual(Object.keys(output), []);
});

test('array data cannot overwrite reserved sparse-array length metadata', () => {
    const input = new Array(4);
    input[1] = 'present';
    input['!length'] = 'invalid';

    const encoded = JSON.parse(JSON.stringify(serialize(input)));
    const output = deserialize(encoded);

    assert.equal(encoded['!length'], 4);
    assert.equal(output.length, 4);
    assert.equal(output[1], 'present');
});

test('round-trips nested sparse arrays without materializing their holes', () => {
    const input = new Array(2);
    const inner = new Array(3);
    inner[1] = 'present';
    input[0] = inner;

    const encoded = JSON.parse(JSON.stringify(serialize(input)));
    const output = deserialize(encoded);

    assert.equal(output.length, 2);
    assert.equal(output[0].length, 3);
    assert.deepEqual(Object.keys(output[0]), ['1']);
    assert.equal(output[0][1], 'present');
});

test('round-trips Date values at present sparse-array indices through JSON', () => {
    const input = new Array(4);
    input[1] = new Date('2020-01-02T03:04:05.000Z');

    const serialized = serialize(input);
    const directOutput = deserialize(serialized);
    const encoded = JSON.parse(JSON.stringify(serialized));
    const output = deserialize(encoded);

    assert.equal(directOutput[1] instanceof Date, true);
    assert.equal(directOutput[1].toISOString(), '2020-01-02T03:04:05.000Z');
    assert.equal(encoded[1], '2020-01-02T03:04:05.000Z');
    assert.equal(output.length, 4);
    assert.deepEqual(Object.keys(output), ['1']);
    assert.equal(output[1], '2020-01-02T03:04:05.000Z');
});

test('deserializes sparse arrays with an own hasOwnProperty field', () => {
    const output = deserialize({
        '!sparsearray': true,
        '!length': 2,
        0: 'present',
        hasOwnProperty: 'collision',
    });

    assert.equal(output.length, 2);
    assert.deepEqual(Object.keys(output), ['0']);
    assert.equal(output[0], 'present');
});

test('ignores non-canonical sparse array index keys', () => {
    const output = deserialize({
        '!sparsearray': true,
        '1junk': 'wrong',
        2: 'right',
    });

    assert.equal(output.length, 3);
    assert.equal(1 in output, false);
    assert.equal(output[2], 'right');
});

test('restores sparse array indices without invoking inherited setters', () => {
    let setterCalls = 0;
    Object.defineProperty(Array.prototype, '0', {
        configurable: true,
        set() {
            setterCalls++;
        },
    });

    let output;
    try {
        output = deserialize({
            '!sparsearray': true,
            0: 'present',
        });
    } finally {
        delete Array.prototype[0];
    }

    assert.equal(output[0], 'present');
    assert.equal(setterCalls, 0);
});

test('does not restore an inherited sparse-array marker', () => {
    const input = Object.create({ '!sparsearray': true });
    input.value = 'present';

    assert.deepEqual(deserialize(input), { value: 'present' });
});

test('derives legacy sparse-array length only from own canonical indices', () => {
    const input = Object.create({
        '!length': 100,
        3: 'inherited',
    });
    Object.assign(input, {
        '!sparsearray': true,
        2: 'last own value',
        '02': 'non-canonical',
    });

    const output = deserialize(input);

    assert.equal(output.length, 3);
    assert.equal(output[2], 'last own value');
    assert.equal(Object.hasOwn(output, 3), false);
    assert.equal(Object.hasOwn(output, '02'), false);
});

test('ignores malformed sparse-array lengths and derives length from indices', async (t) => {
    const malformedLengths = [
        ['null', null],
        ['boolean', false],
        ['numeric string', '3'],
        ['negative', -1],
        ['fractional', 1.5],
        ['above maximum', 0x100000000],
        ['NaN', Number.NaN],
        ['infinity', Number.POSITIVE_INFINITY],
    ];

    for (const [name, length] of malformedLengths) {
        await t.test(name, () => {
            const output = deserialize({
                '!sparsearray': true,
                '!length': length,
                2: 'last value',
            });

            assert.equal(output.length, 3);
            assert.equal(output[2], 'last value');
        });
    }
});

test('accepts only exact decimal JavaScript array-index keys at the upper boundary', () => {
    const output = deserialize({
        '!sparsearray': true,
        0: 'zero',
        '-0': 'negative zero',
        '00': 'leading zero',
        '01': 'leading zero one',
        '1.0': 'decimal',
        '1e0': 'exponent',
        '+1': 'positive sign',
        ' 1': 'whitespace',
        4294967294: 'maximum index',
        4294967295: 'array length, not an index',
    });

    assert.equal(output.length, 0xffffffff);
    assert.equal(output[0], 'zero');
    assert.equal(output[0xfffffffe], 'maximum index');
    for (const key of ['-0', '00', '01', '1.0', '1e0', '+1', ' 1', '4294967295']) {
        assert.equal(Object.hasOwn(output, key), false, key);
    }
});

test('recursively restores a sparse array nested in a sparse array', () => {
    const output = deserialize({
        '!sparsearray': true,
        '!length': 2,
        0: {
            '!sparsearray': true,
            '!length': 3,
            1: 'inner value',
        },
    });

    assert.equal(Array.isArray(output[0]), true);
    assert.equal(output[0].length, 3);
    assert.equal(output[0][1], 'inner value');
});

test('preserves an own __proto__ property on sparse arrays', () => {
    const input = new Array(1);
    Object.defineProperty(input, '__proto__', {
        enumerable: true,
        value: { own: true },
    });

    const output = serialize(input);

    assert.equal(Object.getPrototypeOf(output), Object.prototype);
    assert.equal(Object.hasOwn(output, '__proto__'), true);
    assert.deepEqual(output.__proto__, { own: true });
});

test('preserves falsy own data when a prototype property is true', () => {
    const key = 'serializerFalsyValue';
    Object.defineProperty(Object.prototype, key, {
        configurable: true,
        enumerable: true,
        value: true,
    });
    const input = {};
    Object.defineProperty(input, key, {
        enumerable: true,
        value: 0,
    });

    try {
        const output = serialize(input);
        assert.equal(Object.hasOwn(output, key), true);
        assert.equal(output[key], 0);
    } finally {
        delete Object.prototype[key];
    }
});

test('does not call an array-owned hasOwnProperty value', () => {
    const input = ['present'];
    Object.defineProperty(input, 'hasOwnProperty', {
        enumerable: true,
        value: 'own data',
    });

    assert.deepEqual(serialize(input), ['present']);
});

test('copies dense array indices without invoking array properties or setters', () => {
    const input = ['present'];
    Object.defineProperty(input, 'forEach', {
        value: 'own data',
    });
    let setterCalls = 0;
    Object.defineProperty(Array.prototype, '0', {
        configurable: true,
        set() {
            setterCalls++;
        },
    });

    let output;
    try {
        output = serialize(input);
    } finally {
        delete Array.prototype[0];
    }

    assert.deepEqual(output, ['present']);
    assert.equal(setterCalls, 0);
});
