const assert = require('assert');
const Immutable = require('immutable');
const { Map, List } = Immutable;

// =============================================================================
// Code
// 
// Calls to processStructuredError are recursive and should be probably limited
//  to only certain depth or rewritten into procedural form
// From the spec it is not clear if keys that should preserve structure
//  are only top level or can point deep into the objects hierarchy
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

module.exports = { transformErrors, flattenError, processStructuredError };