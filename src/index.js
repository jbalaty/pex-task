const assert = require('assert');
const Immutable = require('immutable');
const { Map, List } = Immutable;

// =============================================================================
// Code
// 
// My implementation relies on flatten from Immutable.js
// Calls to processStructuredError are recursive and should be probably limited
//  to only certain depth or rewritten into procedural form
// =============================================================================

/**
 * Boolean predicate - if value is of type string
 * @param  {any} value
 */
const isString = (value) => typeof value === 'string';

/**
 * Boolean predicate - checks if value is Immutable.Map or Immutable.List
 * @param {any} value 
 */
const isMapOrList = (value) => Map.isMap(value) || List.isList(value);

/**
 * Convert items in errorList into strings and format them for printing 
 * @param  {Immutable.List} errorsList
 */
function joinErrorMessages(errorsList) {
    assert(List.isList(errorsList), 'Argument errorList should be Immutable.List');
    if (errorsList.isEmpty()) return errorsList;
    // TODO: there can be check if all elements are strings
    return errorsList.map(v => `${v}.`).join(' ');
}

/**
 * Takes Immutable List or Map and flattens the whole structure into array of values, then joins the values into string
 * @param {Immutable.List or Immutable.Map} error 
 */
function flattenError(error) {
    assert(isMapOrList(error), 'Argument should be Immutable.Map or Immutable.List');

    return joinErrorMessages(
        List([error]) // convert Map into List with one elemnt, Lists are wrapped with one more List but it doesn't matter
            .flatten() // the whole object tree is flattened to one level
            .toSet()  // convert List items into set to make them unique
            .toList());// convert this back to List
}

/**
 * Takes List or Map and recursively goes through the objects - when if finds array wholes elements are only string it
 * joins them for priting with joinErrorMessages
 * @param {Immutable.List or Immutable.Map} error 
 */
function processStructuredError(error) {
    if (isMapOrList(error)) {
        if (List.isList(error) && error.every(isString)) {
            return joinErrorMessages(error);
        } else {
            // map for empty object returns empty object
            return error.map(v => processStructuredError(v));
        }
    } else {
        return error;
    }
}


/**
 * Transforms structured errors object into desired shape (for UI)
 * @param {Immutable.Map} errors - main errors object
 * @param {Object} options - currently only supported option is list of keys for which nested structure should be preserved 
 * 
 * options = { preserveStructureForKeys = [] }
 * 
 * eg.
 * transformErrors(errors, { preserveStructureForKeys: ['url', 'urls'] });
 *
 */
function transformErrors(errors, { preserveStructureForKeys = [] } = {}) {
    assert(Map.isMap(errors), 'Argument errors should be Immutable.Map');
    return errors
        .filter(isMapOrList)
        .mapEntries(([key, value]) => {
            if (preserveStructureForKeys.includes(key)) {
                return [key, processStructuredError(value)]
            } else {
                return [key, flattenError(value)];
            }
        });
}

// =============================================================================
// Tests
// =============================================================================


it('should flatten all types of errors', () => {
    assert.deepEqual(flattenError(Immutable.fromJS(
        []
    )).toJS(),
        []);

    assert.deepEqual(flattenError(Immutable.fromJS(
        ['This field is required']
    )),
        'This field is required.');

    assert.deepEqual(flattenError(Immutable.fromJS(
        ['This field is required', 'Only numeric characters are allowed']
    )),
        'This field is required. Only numeric characters are allowed.');


    assert.deepEqual(flattenError(Immutable.fromJS({
        first: ['Only alphanumeric characters are allowed'],
        last: ['Only alphanumeric characters are allowed'],
    })),
        'Only alphanumeric characters are allowed.');

    assert.deepEqual(flattenError(Immutable.fromJS([{}, {
        first: ['Only alphanumeric characters are allowed'],
        last: ['Only alphanumeric characters are allowed'],
    }, {}])),
        'Only alphanumeric characters are allowed.');

    assert.throws(() => flattenError({}), { message: 'Argument should be Immutable.Map or Immutable.List' });
});

it('should ensure there are no recurring errors', () => {
    const errors = Immutable.fromJS({
        name: {
            first: ['Only alphanumeric characters are allowed'],
            last: ['Only alphanumeric characters are allowed'],
        },
        names: [{}, {
            first: ['Only alphanumeric characters are allowed'],
            last: ['Only alphanumeric characters are allowed'],
        }, {}],
    });

    assert.deepEqual(transformErrors(errors).toJS(), {
        name: 'Only alphanumeric characters are allowed.',
        names: 'Only alphanumeric characters are allowed.',
    });
});

it('should tranform errors', () => {
    // example error object returned from API converted to Immutable.Map
    const errors = Immutable.fromJS({
        name: ['This field is required'],
        age: ['This field is required', 'Only numeric characters are allowed'],
        urls: [{}, {}, {
            site: {
                code: ['This site code is invalid'],
                id: ['Unsupported id'],
            }
        }],
        url: {
            site: {
                code: ['This site code is invalid'],
                id: ['Unsupported id'],
            }
        },
        tags: [{}, {
            non_field_errors: ['Only alphanumeric characters are allowed'],
            another_error: ['Only alphanumeric characters are allowed'],
            third_error: ['Third error']
        }, {}, {
            non_field_errors: [
                'Minumum length of 10 characters is required',
                'Only alphanumeric characters are allowed',
            ],
        }],
        tag: {
            nested: {
                non_field_errors: ['Only alphanumeric characters are allowed'],
            },
        },
    });

    // in this specific case,
    // errors for `url` and `urls` keys should be nested
    // see expected object below
    const result = transformErrors(errors, { preserveStructureForKeys: ['url', 'urls'] });

    assert.deepEqual(result.toJS(), {
        name: 'This field is required.',
        age: 'This field is required. Only numeric characters are allowed.',
        urls: [{}, {}, {
            site: {
                code: 'This site code is invalid.',
                id: 'Unsupported id.',
            },
        }],
        url: {
            site: {
                code: 'This site code is invalid.',
                id: 'Unsupported id.',
            },
        },
        tags: 'Only alphanumeric characters are allowed. Third error. ' +
            'Minumum length of 10 characters is required.',
        tag: 'Only alphanumeric characters are allowed.',
    });
});


