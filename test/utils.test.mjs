import assert from 'node:assert/strict';
import { test } from 'node:test';
import utils from '../dist/utils.js';

const { removeCircularReferences, serialize } = utils;

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
        0: 'present',
    });
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
