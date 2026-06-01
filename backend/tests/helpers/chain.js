/**
 * Creates a Jest mock that behaves like a chainable Mongoose query.
 * @param {*} result - Value resolved by terminal query methods.
 * @returns {Object} Chainable query mock with `select`, `populate`, `sort`, `skip`, `limit`, `exec`, and `then`.
 */
function makeQuery(result) {
  const query = {
    select: jest.fn(() => query),
    populate: jest.fn(() => query),
    sort: jest.fn(() => query),
    skip: jest.fn(() => query),
    limit: jest.fn(() => Promise.resolve(result)),
    exec: jest.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  };

  return query;
}

/**
 * Creates a Jest mock document with persistence helpers.
 * @param {Object} data - Plain fields to expose on the mock document.
 * @returns {Object} Document-like object with mocked `save` and `toObject` methods.
 */
function makeDoc(data = {}) {
  return {
    ...data,
    save: jest.fn().mockResolvedValue(undefined),
    toObject: jest.fn(() => ({ ...data }))
  };
}

module.exports = { makeQuery, makeDoc };

