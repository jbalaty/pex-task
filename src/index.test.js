const assert = require('assert');
const Immutable = require('immutable');
const { transformErrors, flattenError, processStructuredError } = require('./index');
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

    // this test does not work in node 8.4
    //assert.throws(() => flattenError({}), { message: 'Argument should be Immutable.Map or Immutable.List' });
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

it('should process nested error type', () => {
    const errors = Immutable.fromJS([{}, {}, {
        site: {
            code: ['This site code is invalid'],
            id: ['Unsupported id'],
        }
    }]);

    assert.deepEqual(processStructuredError(errors).toJS(), [{}, {}, {
        site: {
            code: 'This site code is invalid.',
            id: 'Unsupported id.',
        },
    }]);

    assert.deepEqual(processStructuredError({}), {});
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


