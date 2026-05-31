/**
 * Runs the make query workflow.
 * @param {Object} result - result used by the function.
 * @returns {void|Object|string|Array<Object>|null} The result produced by the function.
 */
function makeQuery(result) {
  const query = {
    select: jest.fn(() => query),
    populate: jest.fn(() => query),
    sort: jest.fn(() => query),
    limit: jest.fn(() => Promise.resolve(result)),
    exec: jest.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  };

  return query;
}

/**
 * Runs the make doc workflow.
 * @param {Object} data - data used by the function.
 * @returns {void|Object|string|Array<Object>|null} The result produced by the function.
 */
function makeDoc(data = {}) {
  return {
    ...data,
    save: jest.fn().mockResolvedValue(undefined),
    toObject: jest.fn(() => ({ ...data }))
  };
}

module.exports = { makeQuery, makeDoc };

